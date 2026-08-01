/**
 * ================================================================
 * Webhook Service — Central Webhook Processing Pipeline
 * ================================================================
 * Handles all incoming webhook messages from any provider (Twilio, Meta, etc.)
 * Resolves tenant from destination phone number and processes the message
 * through the full pipeline: save → upsert lead → SSE → AI → reply.
 * 
 * Architecture: Production-ready B2B multi-tenant central webhook.
 * ================================================================
 */

import prisma from '../../config/database.js';
import { processIncomingChat } from '../ai_agent/handler.service.js';
import { sendText, sendMedia } from './messaging.service.js';
import { saveMessage } from './chat.service.js';
import { broadcast } from './sse.service.js';
import { pdfGeneratorService } from '../pdfGenerator.service.js';
import { bufferMessage } from './messageBuffer.service.js';
import { recordMediaSent } from './mediaDedup.service.js';
import * as interruptState from './interruptState.js';
import { createTransaction } from './transaction.service.js';
import { handleNameExtraction, handleLeadMerge } from './identity.service.js';
import { embedChatPair } from '../ai_agent/chatMemory.service.js';

/**
 * Normalize a phone number by stripping "whatsapp:" prefix and "+" symbol.
 * Twilio sends: "whatsapp:+6281234567890" → we need: "6281234567890"
 * 
 * @param {string} raw - Raw phone string from webhook payload
 * @returns {string} Cleaned phone number
 */
export const normalizePhone = (raw) => {
  if (!raw) return '';
  return raw
    .replace(/^whatsapp:/i, '')
    .replace(/^\+/, '')
    .trim();
};

/**
 * Normalize a WA number for lookup purposes.
 * Strips "whatsapp:" prefix but keeps "+" for consistent DB matching.
 * 
 * @param {string} raw - Raw phone string
 * @returns {string} Normalized for DB lookup
 */
export const normalizeForLookup = (raw) => {
  if (!raw) return '';
  return raw.replace(/^whatsapp:/i, '').trim();
};

/**
 * Resolve tenant from a destination WhatsApp number.
 * Looks up the `tenant_phone_numbers` table for a matching active record.
 * 
 * Supports multiple lookup formats to handle Twilio's format variations:
 *   1. Exact match (e.g. "+14155238886")
 *   2. With whatsapp: prefix (e.g. "whatsapp:+14155238886")
 *   3. Without + prefix (e.g. "14155238886")
 * 
 * @param {string} toNumber - The destination WA number from webhook (e.g. "whatsapp:+14155238886")
 * @returns {Promise<{tenantId: number, provider: string} | null>}
 */
export const resolveTenantFromPhone = async (toNumber) => {
  if (!toNumber) return null;

  // Generate all possible format variations for lookup
  const normalized = normalizeForLookup(toNumber);           // "+14155238886"
  const withPrefix = `whatsapp:${normalized}`;               // "whatsapp:+14155238886"
  const withoutPlus = normalized.replace(/^\+/, '');          // "14155238886"
  const withPlus = normalized.startsWith('+') ? normalized : `+${normalized}`; // "+14155238886"

  const lookupValues = [...new Set([normalized, withPrefix, withoutPlus, withPlus])];

  const record = await prisma.tenantPhoneNumber.findFirst({
    where: {
      wa_number: { in: lookupValues },
      is_active: 1,
    },
    include: {
      tenant: {
        select: {
          id: true,
          business_name: true,
          business_type: true,
          is_active: true,
        }
      }
    }
  });

  if (!record) {
    console.warn(`[Webhook] No tenant found for number: ${toNumber} (tried: ${lookupValues.join(', ')})`);
    return null;
  }

  if (record.tenant.is_active !== 1) {
    console.warn(`[Webhook] Tenant ${record.tenant.business_name} (ID: ${record.tenant_id}) is inactive`);
    return null;
  }

  console.log(`[Webhook] Resolved: ${toNumber} → Tenant "${record.tenant.business_name}" (ID: ${record.tenant_id})`);

  return {
    tenantId: record.tenant_id,
    provider: record.provider,
    tenantName: record.tenant.business_name,
    businessType: record.tenant.business_type,
  };
};

/**
 * Resolve tenant from Meta Phone ID (for Meta Webhooks).
 * Looks up the GlobalSetting table for meta_phone_id.
 * 
 * @param {string} metaPhoneId - The phone_number_id from Meta webhook payload
 * @returns {Promise<{tenantId: number, provider: string} | null>}
 */
export const resolveTenantFromMetaPhoneId = async (metaPhoneId) => {
  if (!metaPhoneId) return null;

  const setting = await prisma.globalSetting.findFirst({
    where: {
      setting_key: 'meta_phone_id',
      setting_value: metaPhoneId
    },
    include: {
      tenant: {
        select: {
          id: true,
          business_name: true,
          business_type: true,
          is_active: true,
        }
      }
    }
  });

  if (!setting) {
    return null;
  }

  if (setting.tenant.is_active !== 1) {
    return null;
  }

  console.log(`[Webhook] Resolved from Meta Phone ID: ${metaPhoneId} → Tenant "${setting.tenant.business_name}" (ID: ${setting.tenant_id})`);

  return {
    tenantId: setting.tenant_id,
    provider: 'meta',
    tenantName: setting.tenant.business_name,
    businessType: setting.tenant.business_type,
  };
};

/**
 * Helper to update or create an active order note (CustomerManagement)
 * This ensures the AI always has persistent context about the current active order.
 */
export const upsertActiveOrderNote = async (tenantId, userPhone, customerName, packageName, noteDetail, departureDate = null, collectedData = null) => {
  try {
    const existing = await prisma.customerManagement.findFirst({
      where: { tenant_id: tenantId, phone: userPhone, status: { notIn: ['done', 'canceled_customer', 'canceled'] } },
      orderBy: { updated_at: 'desc' }
    });

    const timestamp = new Date().toLocaleString('id-ID');
    const newNote = noteDetail ? `\n- [${timestamp}] ${noteDetail}` : '';

    // Merge collected_data: parse existing, merge new keys on top
    const mergeCollectedData = (existingRaw, newData) => {
      if (!newData && !existingRaw) return null;
      let base = {};
      if (existingRaw) {
        try { base = typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw; } catch { base = {}; }
      }
      if (newData && typeof newData === 'object') {
        base = { ...base, ...newData };
      }
      return Object.keys(base).length > 0 ? JSON.stringify(base) : (existingRaw || null);
    };

    if (existing) {
      await prisma.customerManagement.update({
        where: { id: existing.id },
        data: {
          customer_name: customerName && customerName !== 'Pelanggan' ? customerName : existing.customer_name,
          package_name: packageName || existing.package_name,
          departure_date: departureDate || existing.departure_date,
          admin_note: existing.admin_note ? existing.admin_note + newNote : (noteDetail ? `- [${timestamp}] ${noteDetail}` : null),
          collected_data: mergeCollectedData(existing.collected_data, collectedData),
          updated_at: new Date()
        }
      });
    } else {
      await prisma.customerManagement.create({
        data: {
          tenant_id: tenantId,
          phone: userPhone,
          customer_name: customerName || 'Pelanggan',
          package_name: packageName || null,
          departure_date: departureDate || null,
          admin_note: noteDetail ? `- [${timestamp}] ${noteDetail}` : null,
          collected_data: collectedData ? JSON.stringify(collectedData) : null,
          status: 'waiting_offer'
        }
      });
    }
  } catch (err) {
    console.error('[Webhook Pipeline] Failed to upsert active order note:', err.message);
  }
};

/**
 * Process an incoming webhook message through the full pipeline.
 * This is the core function that handles message flow for any provider.
 * 
 * Pipeline:
 *   1. Save incoming user message to chat_history
 *   2. Upsert lead (create if new, update last_message if existing)
 *   3. Broadcast new_message event via SSE to dashboard
 *   4. Check manual mode — skip AI if admin has taken over
 *   5. AI Processing — generate reply using tenant's KB and persona
 *   6. Send reply back via the original provider (Twilio, Meta, etc.)
 *   7. Broadcast AI reply via SSE
 * 
 * @param {Object} params
 * @param {number} params.tenantId - Resolved tenant ID
 * @param {string} params.userPhone - Customer phone number (cleaned)
 * @param {string} params.userMessage - Message body
 * @param {string} [params.profileName] - Customer's WhatsApp display name
 * @param {string} [params.provider] - Messaging provider ('twilio', 'meta', etc.)
 * @param {string} [params.mediaUrl] - URL of attached media if any
 * @param {string} [params.providerMsgId] - Provider's original message ID
 * @param {boolean} [params.isEdit] - Flag indicating if this is an edited message
 * @param {string} [params.sentAt] - Provider's original message timestamp (ISO string)
 */
export const processIncomingWebhook = async ({ tenantId, userPhone, userMessage, profileName, provider = 'meta', mediaUrl = null, audioUrl = null, isVoiceNote = false, providerMsgId = null, isEdit = false, sentAt = null }) => {
  try {
    let crmPhone = userPhone;
    let activePhone = userPhone;
    
    // Check if this lead is a merged alias
    const existingAlias = await prisma.lead.findUnique({
      where: { uk_tenant_phone: { tenant_id: tenantId, phone: userPhone } },
      select: { traffic_source: true }
    });

    if (existingAlias && existingAlias.traffic_source && existingAlias.traffic_source.startsWith('MERGED_TO:')) {
      crmPhone = existingAlias.traffic_source.replace('MERGED_TO:', '').trim();
      console.log(`[Webhook Pipeline] Merged Alias detected: Forwarding ${activePhone} -> CRM Phone: ${crmPhone}`);
    }

    const existingLead = await prisma.lead.findUnique({
      where: { uk_tenant_phone: { tenant_id: tenantId, phone: crmPhone } },
      select: { last_message_at: true }
    });

    console.log(`[Webhook Pipeline] Immediate: saving message from CRM: ${crmPhone} (Active: ${activePhone})${isVoiceNote ? ' [VN]' : ''}${isEdit ? ' [EDIT]' : ''}`);

    const now = new Date();
    const msgTime = sentAt ? new Date(sentAt) : now;
    const saveMediaUrl = isVoiceNote ? audioUrl : mediaUrl;

    const shouldUpdatePreview = !existingLead || !existingLead.last_message_at || msgTime.getTime() >= new Date(existingLead.last_message_at).getTime();

    // --- AUTO-DETECT EDITS / DUPLICATES ---
    let finalIsEdit = isEdit;
    if (providerMsgId && !finalIsEdit) {
      const existingMsg = await prisma.chatHistory.findFirst({
        where: { provider_msg_id: providerMsgId }
      });
      if (existingMsg) {
        if (existingMsg.message === userMessage) {
          console.log(`[Webhook Pipeline] Duplicate message detected (ID: ${providerMsgId}). Ignoring.`);
          return { success: true, mode: 'duplicate', message: 'Ignored duplicate webhook payload' };
        } else {
          console.log(`[Webhook Pipeline] Existing message found with different text. Treating as EDIT.`);
          finalIsEdit = true;
        }
      }
    }

    if (finalIsEdit && providerMsgId) {
      // Handle edited message flow
      const { updateEditedMessage } = await import('./chat.service.js');
      const updatedMsg = await updateEditedMessage(prisma, providerMsgId, userMessage);
      
      if (updatedMsg) {
        console.log(`[Webhook Pipeline] Successfully updated edited message in DB (ID: ${updatedMsg.id})`);
        
        // Broadcast to UI so it can replace the bubble text
        broadcast(tenantId, 'message_edited', {
          id: updatedMsg.id,
          phone: crmPhone,
          message: userMessage,
          is_edited: 1,
          updated_at: now.toISOString()
        });
      }
      
      // -- ADD INTERRUPT HANDLING FOR EDITS --
      const interruptKey = `${tenantId}:${userPhone}`;
      const { isProcessing, pushPending } = await import('./interruptState.js');
      if (await isProcessing(interruptKey)) {
        console.log(`[Webhook Pipeline] Edit received while AI is processing! Interrupting AI...`);
        await pushPending(interruptKey, {
          text: `[CUSTOMER MENGOREKSI PESANNYA MENJADI]: ${userMessage}`,
          mediaUrl: null,
          isEdit: true,
          timestamp: msgTime
        });
      }
      
      // Update Lead's last message preview if this was the last message
      if (shouldUpdatePreview) {
        await prisma.lead.update({
          where: { uk_tenant_phone: { tenant_id: tenantId, phone: crmPhone } },
          data: {
            last_message_preview: userMessage.substring(0, 500),
            updated_at: now
          }
        });
      }
      
      // Skip AI processing for edits to avoid repeating responses
      return { success: true, mode: 'edited', message: 'Message edited in DB, skipped AI' };
    }

    // ── Step 1: Save incoming user message (INSTANT) ──
    // For VN: save transcript as message, audioUrl as media_url reference
    
    let mediaSummary = null;
    if (saveMediaUrl && !isVoiceNote) {
      try {
        const { summarizeImage } = await import('../ai_agent/logic.service.js');
        mediaSummary = await summarizeImage(tenantId, saveMediaUrl);
        console.log(`[Webhook Pipeline] Image summarized: ${mediaSummary}`);
      } catch (e) {
        console.error(`[Webhook Pipeline] Failed to summarize image:`, e.message);
      }
    }

    const savedUserMsg = await saveMessage(prisma, crmPhone, 'user', userMessage, tenantId, saveMediaUrl, mediaSummary, providerMsgId, sentAt);

    // ── Step 2: Upsert Lead (INSTANT) ──
    const safeProfileName = profileName || crmPhone;
    let upsertedLead;

    // Build platform identity data based on provider.
    // Set HANYA field platform identity yang sesuai — jangan pernah mengisi
    // whatsapp_phone untuk lead Instagram/Telegram (bug lama: IG lead salah
    // tercatat punya nomor WhatsApp padahal tidak pernah memberikan nomor WA).
    const platformData = {};
    if (provider === 'telegram') {
      platformData.telegram_id = crmPhone;
    } else if (provider === 'instagram') {
      platformData.instagram_username = crmPhone;
    } else {
      // whatsapp, twilio, meta, zernio whatsapp, dll. → nomor WhatsApp
      platformData.whatsapp_phone = crmPhone;
    }

    try {
      const updatePayload = {
        updated_at: now,
        channel: provider,
        ...(profileName && !profileName.startsWith('Contact ') && profileName !== userPhone ? { push_name: profileName } : {}),
        ...platformData,
      };
      if (shouldUpdatePreview) {
        updatePayload.last_message_preview = userMessage.substring(0, 500);
        updatePayload.last_message_at = msgTime;
      }

      upsertedLead = await prisma.lead.upsert({
        where: { uk_tenant_phone: { tenant_id: tenantId, phone: crmPhone } },
        update: updatePayload,
        create: {
          tenant_id: tenantId,
          phone: crmPhone,
          push_name: safeProfileName,
          status: 'baru',
          label: 'potensial',
          last_message_preview: userMessage.substring(0, 500),
          last_message_at: msgTime,
          channel: provider,
          ...platformData,
        }
      });
    } catch (upsertErr) {
      // P2002 = race condition — dua pesan masuk bersamaan, lead sudah dibuat oleh pesan pertama
      if (upsertErr.code === 'P2002') {
        console.log(`[Webhook Pipeline] Lead upsert race condition for ${crmPhone} — retrying as update`);
        const updatePayload = {
          updated_at: now,
          channel: provider,
          ...(profileName && !profileName.startsWith('Contact ') && profileName !== userPhone ? { push_name: profileName } : {}),
          ...platformData,
        };
        if (shouldUpdatePreview) {
          updatePayload.last_message_preview = userMessage.substring(0, 500);
          updatePayload.last_message_at = msgTime;
        }

        upsertedLead = await prisma.lead.update({
          where: { uk_tenant_phone: { tenant_id: tenantId, phone: crmPhone } },
          data: updatePayload
        });
      } else {
        throw upsertErr;
      }
    }

    // ── Step 3: Broadcast to dashboard (INSTANT) ──
    broadcast(tenantId, 'new_message', {
      phone: crmPhone,
      message: userMessage,
      media_url: saveMediaUrl || null,
      role: 'user',
      timestamp: msgTime.toISOString(),
      created_at: msgTime.toISOString(),
      id: savedUserMsg?.id ?? null,
      provider_msg_id: providerMsgId,
    });

    broadcast(tenantId, 'lead_updated', {
      phone: crmPhone,
      push_name: profileName || upsertedLead.push_name || crmPhone,
      saved_name: upsertedLead.saved_name || null,
      last_message_preview: shouldUpdatePreview ? userMessage.substring(0, 500) : (upsertedLead.last_message_preview || userMessage.substring(0, 500)),
      last_message_at: shouldUpdatePreview ? msgTime.toISOString() : (upsertedLead.last_message_at ? new Date(upsertedLead.last_message_at).toISOString() : msgTime.toISOString()),
      status: upsertedLead.status,
      label: upsertedLead.label,
      id: upsertedLead.id,
      channel: provider,
    });

    // ── Step 4: Check manual mode ──
    const lead = await prisma.lead.findUnique({
      where: { uk_tenant_phone: { tenant_id: tenantId, phone: crmPhone } },
      select: { is_manual: true }
    });

    if (lead?.is_manual === 1) {
      console.log(`[Webhook Pipeline] Lead ${crmPhone} is in MANUAL mode — skipping buffer`);
      return { success: true, mode: 'manual', message: 'Skipped AI — manual mode active' };
    }

    // ── Step 5: Push ke buffer (DEBOUNCED — menunggu 10 detik) ──
    bufferMessage({ 
      tenantId, 
      userPhone: crmPhone, 
      activePhone, 
      userMessage, 
      profileName, 
      provider, 
      mediaUrl, 
      audioUrl, 
      isVoiceNote,
      timestamp: msgTime
    });

    return { success: true, mode: 'buffered', message: 'Message buffered, waiting for more bubbles...' };

  } catch (error) {
    console.error(`[Webhook Pipeline Error] Tenant ${tenantId}, Phone ${userPhone}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Process buffered messages — dipanggil oleh messageBuffer.service.js
 * setelah debounce timer habis (10 detik tanpa pesan baru).
 *
 * Menerima array pesan yang dikumpulkan, menggabungkan menjadi satu
 * konteks untuk AI, lalu menjalankan pipeline lengkap.
 *
 * @param {Object} params
 * @param {number} params.tenantId
 * @param {string} params.userPhone
 * @param {Array} params.bufferedMessages - Array of {text, mediaUrl, timestamp}
 * @param {string} params.profileName
 * @param {string} params.provider
 */
export const processBufferedMessages = async ({ tenantId, userPhone, bufferedMessages, profileName, provider = 'meta' }) => {
  const interruptKey = `${tenantId}:${userPhone}`;
  try {
    console.log(`[Webhook Buffered] Processing ${bufferedMessages.length} bubble(s) from ${userPhone}`);

    // Broadcast typing indicator
    broadcast(tenantId, 'ai_typing', { phone: userPhone, typing: true });

    // ── Context Analysis: cek apakah multi-bubble ini 1 konteks atau beda ──
    let contextGroups;
    if (bufferedMessages.length === 1) {
      // Hanya 1 bubble — langsung proses
      contextGroups = [{
        context: 'Single',
        combinedText: bufferedMessages[0].text,
        mediaUrl: bufferedMessages[0].mediaUrl || null,
        hasVoiceNote: bufferedMessages[0].isVoiceNote || false,
      }];
    } else {
      // 2+ bubble — analisis konteks (supports mixed: text + image + VN)
      const { analyzeContextGroups } = await import('../ai_agent/contextAnalyzer.service.js');
      contextGroups = await analyzeContextGroups(tenantId, bufferedMessages);
      console.log(`[Webhook Buffered] Context analysis: ${contextGroups.length} group(s)`);
    }

    // ── Proses setiap context group secara sequential ──
    for (let g = 0; g < contextGroups.length; g++) {
      const group = contextGroups[g];
      console.log(`[Webhook Buffered] Processing context ${g + 1}/${contextGroups.length}: "${group.context}"`);

      // Panggil AI pipeline per context group
      let result = await processIncomingChat({
        tenantId,
        userPhone,
        userMessage: group.combinedText,
        mediaUrl: group.mediaUrl,
        chatType: 'sales',
      });

      if (!result.success || !result.data?.reply) {
        // If gatekeeper aborted, this is expected — pending messages will be re-buffered by worker
        if (result.data?.metadata?.gatekeeperAbort) {
          console.log(`[Webhook Buffered] Gatekeeper aborted (${result.data.metadata.abortReason || 'topic changed'}) — pending messages will be re-buffered by worker`);
        } else {
          console.warn(`[Webhook Buffered] AI returned no reply for context "${group.context}"`);
        }
        continue; // Lanjut ke context group berikutnya
      }

      // ══════════════════════════════════════════════════════════════
      // GATEKEEPER POST-CHECK — Simple check after Agent 1 finishes
      // ══════════════════════════════════════════════════════════════
      // The Gatekeeper Agent (Agent 2) already handles pending messages
      // during pipeline execution (HOLD responses, ABORT signals).
      // Here we just check if there are unhandled pending messages left.
      // Pending messages yang masuk saat pipeline jalan dibiarkan saja di pending.
      // Worker akan cek & handle setelah cycle ini selesai.
      // ══════════════════════════════════════════════════════════════

      // ── Proses reply untuk context group ini ──
      await processAndSendAIReply({
        tenantId,
        userPhone,
        result,
        profileName,
        userMessage: group.combinedText,
        mediaUrl: group.mediaUrl,
      });

      // Delay antar context group (agar terlihat natural)
      if (g < contextGroups.length - 1) {
        const interContextDelay = 2000 + Math.random() * 1000;
        console.log(`[Webhook Buffered] Waiting ${Math.round(interContextDelay)}ms before next context...`);
        await new Promise(r => setTimeout(r, interContextDelay));
      }
    }

    broadcast(tenantId, 'ai_typing', { phone: userPhone, typing: false });
    console.log(`[Webhook Buffered] ✓ All ${contextGroups.length} context(s) completed for ${userPhone}`);
    return { success: true, mode: 'ai', message: 'AI reply sent successfully' };

  } catch (error) {
    console.error(`[Webhook Buffered Error] Tenant ${tenantId}, Phone ${userPhone}:`, error);
    broadcast(tenantId, 'ai_typing', { phone: userPhone, typing: false });
    return { success: false, error: error.message };
  }
};

/**
 * Helper: Process AI reply — tag detection, bubble send, save, broadcast.
 * Dipanggil per-context group dari processBufferedMessages.
 */
const processAndSendAIReply = async ({ tenantId, userPhone, result, profileName, userMessage = '', mediaUrl = null }) => {
    let aiReply = result.data.reply;
    let invoicePdfUrl = null;

    // Strip [NEXT] separators from combined reply for tag detection
    aiReply = aiReply.replace(/\[NEXT\]/gi, '\n\n').trim();

    // DEBUG: Log raw AI reply to check if tags are present
    console.log(`[Webhook DEBUG] Raw AI reply:\n---\n${aiReply}\n---`);

    // --- DETECT UPDATE NAME TAG ---
    const updateNameMatch = aiReply.match(/\[UPDATE_NAME:\s*(.+?)\]/i);
    if (updateNameMatch) {
      const newSavedName = updateNameMatch[1].trim();
      aiReply = aiReply.replace(updateNameMatch[0], '').trim();

      // GUARD: Block saving push_name as saved_name
      const leadForNameCheck = await prisma.lead.findUnique({
        where: { uk_tenant_phone: { tenant_id: tenantId, phone: userPhone } },
        select: { push_name: true }
      });
      const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (leadForNameCheck?.push_name && normalize(newSavedName) === normalize(leadForNameCheck.push_name)) {
        console.log(`[Webhook Pipeline] BLOCKED UPDATE_NAME — "${newSavedName}" matches push_name. Not saving.`);
      } else {
        console.log(`[Webhook Pipeline] AI learned new name: ${newSavedName}`);
        await handleNameExtraction(tenantId, { phone: userPhone }, newSavedName);
      }
    }

    // --- DETECT MERGE LEAD TAG ---
    const mergeMatch = aiReply.match(/\[MERGE_LEAD:\s*(.+?)\]/i);
    if (mergeMatch) {
      const oldPhone = mergeMatch[1].trim();
      aiReply = aiReply.replace(mergeMatch[0], '').trim();
      console.log(`[Webhook Pipeline] Executing Lead Merge: ${oldPhone} into ${userPhone}`);
      await handleLeadMerge(tenantId, { phone: userPhone }, oldPhone);
    }

    // --- DETECT UPDATE INFO TAG ---
    // Extended to support: first_name, last_name, email, position, company, industry,
    // company_size, annual_revenue, city, country, address, linkedin, gender, birth_date,
    // lead_source, preferences, notes, comm_pref, personal_notes
    const updateInfoMatch = aiReply.match(/\[UPDATE_INFO:(.+?)\]/is);
    if (updateInfoMatch) {
      const infoContent = updateInfoMatch[1].trim();

      const extractField = (key) => {
        const m = infoContent.match(new RegExp(`${key}=(.*?)(?:\\||$)`, 'is'));
        return m ? m[1].trim() : null;
      };
      const isReal = (v) => v && v !== '...' && v !== '-' && v.toLowerCase() !== 'kosong';

      aiReply = aiReply.replace(updateInfoMatch[0], '').trim();

      // Map tag keys → DB column names
      const fieldMap = {
        email:            'email',
        first_name:       'first_name',
        last_name:        'last_name',
        position:         'position_title',
        city:             'city',
        country:          'country',
        address:          'full_address',
        linkedin:         'linkedin_url',
        social_media:     'social_media',
        preferences:      'preferences',
        notes:            'chat_summary',
        company:          'company_name',
        industry:         'industry',
        company_size:     'company_size',
        annual_revenue:   'annual_revenue',
        gender:           'gender',
        lead_source:      'lead_source',
        comm_pref:        'communication_preference',
        personal_notes:   'personal_notes',
        pipeline_status:  'pipeline_status',
      };

      const updateData = {};
      for (const [tagKey, dbCol] of Object.entries(fieldMap)) {
        const val = extractField(tagKey);
        if (isReal(val)) updateData[dbCol] = val.replace(/\\n/g, '\n');
      }

      // Special: birth_date parsing (accepts YYYY-MM-DD or DD/MM/YYYY)
      const bdRaw = extractField('birth_date');
      if (isReal(bdRaw)) {
        let parsed = new Date(bdRaw);
        if (isNaN(parsed.getTime())) {
          // Try DD/MM/YYYY → YYYY-MM-DD
          const parts = bdRaw.split('/');
          if (parts.length === 3) {
            parsed = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          }
        }
        if (!isNaN(parsed.getTime())) updateData.birth_date = parsed;
      }

      // Special: nps_score (integer 0–10)
      const npsRaw = extractField('nps_score');
      if (isReal(npsRaw)) {
        const nps = parseInt(npsRaw, 10);
        if (!isNaN(nps) && nps >= 0 && nps <= 10) updateData.nps_score = nps;
      }

      console.log(`[Webhook Pipeline] AI learned new info → fields: ${Object.keys(updateData).join(', ')}`);

      if (Object.keys(updateData).length > 0) {
        await prisma.lead.update({
          where: { uk_tenant_phone: { tenant_id: tenantId, phone: userPhone } },
          data: updateData
        });
      }
    }

    // --- DETECT PAYMENT PROOF TAG ---
    // Format: [PAYMENT_PROOF_DETECTED: NAMA_PELANGGAN | NAMA_PAKET]
    const paymentProofMatch = aiReply.match(/\[PAYMENT_PROOF_DETECTED:\s*(.+?)\s*\|\s*(.+?)\]/i);
    if (paymentProofMatch && mediaUrl) {
      aiReply = aiReply.replace(paymentProofMatch[0], '').trim();
      const customerName = paymentProofMatch[1].trim();
      const packageName = paymentProofMatch[2].trim();

      console.log(`[Webhook Pipeline] AI detected payment proof for ${customerName} (Package: ${packageName})`);

      try {
        // Find the unpaid transaction
        let transaction = await prisma.transaction.findFirst({
          where: {
            tenant_id: tenantId,
            phone: userPhone,
            status: { in: ['pending', 'sign', '2nd_pending'] }
          },
          orderBy: { created_at: 'desc' }
        });

        if (transaction) {
          // Update transaction proof image
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { 
              proof_image: mediaUrl,
              // We keep status as is or change to something to indicate proof received, e.g. 'pending' means pending admin approval
            }
          });
          
          console.log(`[Webhook Pipeline] Transaction ${transaction.id} updated with payment proof`);
          // Broadcast to UI to refresh Pending Approvals
          broadcast(tenantId, 'payment_proof_received', {
            transaction_id: transaction.id,
            phone: userPhone,
            media_url: mediaUrl
          });
        } else {
          console.warn(`[Webhook Pipeline] Payment proof detected but no unpaid transaction found for ${userPhone}`);
        }
      } catch (err) {
        console.error('[Webhook Pipeline] Error processing payment proof:', err);
      }
    }
    // --- Helper: Safe price parsing (Indonesian format aware) ---
    const parseSafePrice = (raw) => {
      if (!raw) return 0;
      let str = String(raw).trim();
      // Remove currency prefix (Rp, IDR, etc.)
      str = str.replace(/^(rp|idr|rupiah)\.?\s*/i, '');
      // Remove trailing text like 'pax', 'per orang', etc.
      str = str.replace(/\s*(per\s*\w+|pax|orang|org).*$/i, '');
      // Handle "juta", "jt", "ribu", "rb", "k" suffixes
      const jtMatch = str.match(/([\d.,]+)\s*(?:juta|jt|jutaan)/i);
      if (jtMatch) return Math.round(parseFloat(jtMatch[1].replace(/\./g, '').replace(',', '.')) * 1000000);
      const rbMatch = str.match(/([\d.,]+)\s*(?:ribu|rb|k)\b/i);
      if (rbMatch) return Math.round(parseFloat(rbMatch[1].replace(/\./g, '').replace(',', '.')) * 1000);
      // Indonesian format: dots = thousands sep, comma = decimal
      // If has comma AND dots before comma → Indonesian format (e.g. 3.200.000 or 1.500,00)
      // If only dots → could be thousands separator OR decimal
      str = str.replace(/\s/g, '');
      // Remove dots used as thousands separators (Indonesian style)
      // Rule: if there are multiple dots, or dot followed by exactly 3 digits, treat as thousands sep
      if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) {
        str = str.replace(/\./g, '').replace(',', '.');
      } else if (/^\d+(,\d+)?$/.test(str)) {
        // Only comma as decimal separator
        str = str.replace(',', '.');
      } else {
        // Fallback: strip all non-numeric except dots
        str = str.replace(/[^\d.]/g, '');
      }
      const val = parseFloat(str) || 0;
      // Clamp to DECIMAL(12,2) max: 9,999,999,999.99
      return Math.min(val, 9999999999.99);
    };

    // --- DETECT OFFER / BARGAINING TAG ---
    // Format: [OFFER_DETECTED: NAMA_PELANGGAN | NAMA_PAKET | HARGA_ASLI | HARGA_TAWAR]
    const offerMatch = aiReply.match(/\[OFFER_DETECTED:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*([0-9.,Rp\s]+)\s*\|\s*([0-9.,Rp\s]+)\s*\]/i);
    if (offerMatch) {
      aiReply = aiReply.replace(offerMatch[0], '').trim();
      
      const customerName = offerMatch[1].trim();
      const packageName = offerMatch[2].trim();
      const originalPrice = parseSafePrice(offerMatch[3]);
      const offeredPrice = parseSafePrice(offerMatch[4]);

      console.log(`[Webhook Pipeline] AI detected an offer from ${customerName} for ${packageName}. Original: ${originalPrice}, Offered: ${offeredPrice}`);
      
      // Skip if both prices are 0 (invalid offer)
      if (originalPrice === 0 && offeredPrice === 0) {
        console.warn(`[Webhook Pipeline] Skipping offer: both prices parsed as 0. Raw: "${offerMatch[3]}" / "${offerMatch[4]}"`);
      } else {
  
      try {
        const existingOffer = await prisma.offer.findFirst({
          where: { tenant_id: tenantId, phone: userPhone, status: 'pending' }
        });

        if (existingOffer) {
          // Overwrite existing pending offer
          const updatedOffer = await prisma.offer.update({
            where: { id: existingOffer.id },
            data: {
              package_name: packageName,
              original_price: originalPrice,
              offered_price: offeredPrice
            }
          });
          console.log(`[Webhook Pipeline] Updated pending Offer ID: ${updatedOffer.id}`);
          broadcast(tenantId, 'new_offer', updatedOffer);
        } else {
          const newOffer = await prisma.offer.create({
            data: {
              tenant_id: tenantId,
              phone: userPhone,
              customer_name: customerName,
              package_name: packageName,
              original_price: originalPrice,
              offered_price: offeredPrice,
              status: 'pending'
            }
          });
          
          console.log(`[Webhook Pipeline] Created Offer ID: ${newOffer.id}`);
          broadcast(tenantId, 'new_offer', newOffer);
        }
      } catch (err) {
        console.error('[Webhook Pipeline] Error saving offer:', err);
      }
      } // end else (skip 0-price offers)
    } else {
      // ── FALLBACK: Detect offer from customer message if AI forgot the tag ──
      // Only trigger if BOTH conditions are met:
      // 1. AI mentions "manajer" indicating negotiation handling
      // 2. Customer message contains EXPLICIT bargaining language AND a price
      const aiMentionsManajer = /manajer|manager|konfirmasi.*harga|tanyakan.*harga|persetujuan.*harga/i.test(aiReply);
      // Check for explicit bargaining intent in customer message
      const bargainingKeywords = /bisa kurang|kurang dong|mahal|diskon|potongan|nego|negoisasi|tawar|bisa turun|harga.*seg.*aja|saya.*bayar.*sekian|bisa.*harga|gak bisa.*lebih|terlalu mahal|kemahalan|bisa murah|mintak.?turun|bisa nego/i.test(userMessage);
      
      if (aiMentionsManajer && bargainingKeywords) {
        // Extract price from customer message (e.g. "2 juta", "1.5jt", "Rp1500000")
        const pricePattern = /(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(?:juta|jt|ribu|rb|k)?(?:\s*(?:per\s*pax|\/pax|pax))?/gi;
        const priceMatches = [...userMessage.matchAll(pricePattern)];
        
        if (priceMatches.length > 0) {
          let offeredPrice = parseSafePrice(priceMatches[0][0]);

          if (offeredPrice > 0 && offeredPrice <= 9999999999.99) {
            console.log(`[Webhook Pipeline] FALLBACK offer detected from customer msg. Price: ${offeredPrice}`);
            try {
              const lead = await prisma.lead.findUnique({
                where: { uk_tenant_phone: { tenant_id: tenantId, phone: userPhone } }
              });
              const newOffer = await prisma.offer.create({
                data: {
                  tenant_id: tenantId,
                  phone: userPhone,
                  customer_name: lead?.saved_name || 'Pelanggan',
                  package_name: 'Ditentukan Admin',
                  original_price: 0,
                  offered_price: offeredPrice,
                  status: 'pending'
                }
              });
              console.log(`[Webhook Pipeline] FALLBACK Offer ID: ${newOffer.id}`);
              broadcast(tenantId, 'new_offer', newOffer);
            } catch (err) {
              console.error('[Webhook Pipeline] Error saving fallback offer:', err);
            }
          }
        }
      }
    }

    // --- DETECT CUSTOMER REQUEST TAG ---
    // Format: [CUSTOMER_REQUEST: NAMA | NAMA_PAKET | DESKRIPSI_REQUEST]
    const customerRequestMatch = aiReply.match(/\[CUSTOMER_REQUEST:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\]/i);
    if (customerRequestMatch) {
      aiReply = aiReply.replace(customerRequestMatch[0], '').trim();
      const crCustomerName = customerRequestMatch[1].trim();
      const crPackageName = customerRequestMatch[2].trim();
      const crDetail = customerRequestMatch[3].trim();
  
      try {
        const existingRequest = await prisma.customerRequest.findFirst({
          where: { tenant_id: tenantId, phone: userPhone, status: 'pending', request_type: 'custom' }
        });

        if (existingRequest) {
          if (existingRequest.request_detail === crDetail && existingRequest.package_name === crPackageName) {
            console.log(`[Webhook Pipeline] Identical pending CustomerRequest exists. Ignoring duplicate.`);
          } else {
            await prisma.customerRequest.update({
              where: { id: existingRequest.id },
              data: {
                package_name: crPackageName,
                request_detail: crDetail
              }
            });
            console.log(`[Webhook Pipeline] Updated pending CustomerRequest - ${crCustomerName}: ${crDetail}`);
            broadcast(tenantId, 'new_customer_request', {
              phone: userPhone,
              customer_name: crCustomerName,
              package_name: crPackageName,
              request_detail: crDetail,
            });
          }
        } else {
          await prisma.customerRequest.create({
            data: {
              tenant_id: tenantId,
              phone: userPhone,
              customer_name: crCustomerName,
              package_name: crPackageName,
              request_detail: crDetail,
              request_type: 'custom',
              status: 'pending',
            }
          });
          console.log(`[Webhook Pipeline] CustomerRequest saved → ${crCustomerName}: ${crDetail}`);
          broadcast(tenantId, 'new_customer_request', {
            phone: userPhone,
            customer_name: crCustomerName,
            package_name: crPackageName,
            request_detail: crDetail,
          });
        }
        
        await upsertActiveOrderNote(tenantId, userPhone, crCustomerName, crPackageName, `Request Khusus: ${crDetail}`);

      } catch (crErr) {
        console.error('[Webhook Pipeline] Failed to save CustomerRequest:', crErr.message);
      }
    }

    // --- DETECT DATE CONFIRMATION REQUEST TAG ---
    // Format: [REQUEST:date_confirmation:Detail_Paket_dan_Tanggal]
    const dateRequestMatch = aiReply.match(/\[REQUEST:date_confirmation:\s*(.+?)\]/i);
    if (dateRequestMatch) {
      aiReply = aiReply.replace(dateRequestMatch[0], '').trim();
      const detail = dateRequestMatch[1].trim();

      try {
        // Coba cari nama customer dari DB jika tidak ada di match
        const lead = await prisma.lead.findUnique({
          where: { uk_tenant_phone: { tenant_id: tenantId, phone: userPhone } }
        });
        const cName = lead?.saved_name || 'Pelanggan';

        await prisma.customerRequest.create({
          data: {
            tenant_id: tenantId,
            phone: userPhone,
            customer_name: cName,
            package_name: 'Menunggu Konfirmasi',
            request_detail: detail,
            request_type: 'date_confirmation',
            status: 'pending',
          }
        });
        console.log(`[Webhook Pipeline] Date Confirmation Request saved → ${cName}: ${detail}`);
        broadcast(tenantId, 'new_customer_request', {
          phone: userPhone,
          customer_name: cName,
          package_name: 'Menunggu Konfirmasi',
          request_detail: detail,
        });

        await upsertActiveOrderNote(tenantId, userPhone, cName, null, `Konfirmasi Tanggal: ${detail}`);
      } catch (crErr) {
        console.error('[Webhook Pipeline] Failed to save Date Confirmation Request:', crErr.message);
      }
    }

    // --- DETECT REVISE REQUEST TAG ---
    const reviseRequestMatch = aiReply.match(/\[REVISE_REQUEST:\s*(.+?)\]/i);
    if (reviseRequestMatch) {
      aiReply = aiReply.replace(reviseRequestMatch[0], '').trim();
      const reason = reviseRequestMatch[1].trim();

      try {
        const lead = await prisma.lead.findUnique({
          where: { uk_tenant_phone: { tenant_id: tenantId, phone: userPhone } }
        });
        const cName = lead?.saved_name || 'Pelanggan';

        const pendingReq = await prisma.customerRequest.findFirst({
          where: { tenant_id: tenantId, phone: userPhone, status: 'pending' },
          orderBy: { created_at: 'desc' }
        });

        if (pendingReq) {
           await prisma.customerRequest.update({
             where: { id: pendingReq.id },
             data: { 
               request_detail: `REVISI TERBARU: ${reason}\n\n(Data Lama: ${pendingReq.request_detail})`,
               revision_note: reason
             }
           });
           console.log(`[Webhook Pipeline] Pending request updated with revision: ${reason}`);
        } else {
           await prisma.customerRequest.create({
             data: {
               tenant_id: tenantId,
               phone: userPhone,
               customer_name: cName,
               package_name: 'Revisi Request',
               request_detail: `REVISI: ${reason}`,
               request_type: 'revision',
               status: 'pending',
             }
           });
           console.log(`[Webhook Pipeline] New Revise Request saved: ${reason}`);
        }
        
        // Cek jika ini adalah pembatalan request, catat di StatusInformation
        if (reason.toLowerCase().includes('batal')) {
           await prisma.statusInformation.create({
             data: {
               tenant_id: tenantId,
               phone: userPhone,
               customer_name: cName,
               info_type: 'canceled_request',
               detail: reason
             }
           });
        }
        console.log(`[Webhook Pipeline] Revise Request saved: ${reason}`);
      } catch (err) {
        console.error('[Webhook Pipeline] Failed to save Revise Request:', err.message);
      }
    }

    // --- DETECT SERIOUS INTENT TAG ---
    const seriousIntentMatch = aiReply.match(/\[SERIOUS_INTENT:\s*(.+?)\]/i);
    if (seriousIntentMatch) {
      aiReply = aiReply.replace(seriousIntentMatch[0], '').trim();
      const intentValue = seriousIntentMatch[1].trim();

      try {
        const lead = await prisma.lead.findUnique({
          where: { uk_tenant_phone: { tenant_id: tenantId, phone: userPhone } }
        });
        const cName = lead?.saved_name || 'Pelanggan';

        // Parse Indonesian date format e.g. "Jumat, 19 Juni 2026" or "19 Juni 2026"
        const parseIndonesianDate = (str) => {
          const monthMap = {
            januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
            juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11
          };
          // Remove day name prefix e.g. "Jumat, "
          const cleaned = str.replace(/^[\w]+,\s*/i, '').trim();
          const parts = cleaned.split(/[\s,]+/);
          if (parts.length >= 3) {
            const day = parseInt(parts[0]);
            const month = monthMap[parts[1].toLowerCase()];
            const year = parseInt(parts[2]);
            if (!isNaN(day) && month !== undefined && !isNaN(year)) {
              return new Date(year, month, day);
            }
          }
          // Fallback to native parse
          const d = new Date(str);
          return isNaN(d.getTime()) ? null : d;
        };

        // Check if the value is a real date or a "waiting" signal
        const isDateValue = /\d/.test(intentValue) && !intentValue.toLowerCase().includes('menunggu');
        const parseDate = isDateValue ? parseIndonesianDate(intentValue) : null;
        const noteDetail = parseDate
          ? null  // Date-only intent — no extra note needed
          : `Minat kuat terdeteksi (${intentValue}). Pelanggan menunjukkan sinyal keseriusan meski belum konfirmasi tanggal pasti.`;

        await upsertActiveOrderNote(tenantId, userPhone, cName, null, noteDetail, parseDate);
        console.log(`[Webhook Pipeline] Serious intent note upserted for ${cName}, date: ${parseDate || 'pending'}, type: ${parseDate ? 'date_confirmed' : 'strong_interest'}`);
      } catch (err) {
        console.error('[Webhook Pipeline] Failed to save Serious Intent:', err.message);
      }
    }

    // --- DETECT BASIC_DATE_REQUEST TAG ---
    // Format: [BASIC_DATE_REQUEST: TANGGAL | NAMA_PAKET | DATA_TAMBAHAN]
    const basicDateMatch = aiReply.match(/\[BASIC_DATE_REQUEST:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\]/i)
      || aiReply.match(/\[BASIC_DATE_REQUEST:\s*(.+?)\s*\|\s*(.+?)\s*\]/i);
    if (basicDateMatch) {
      aiReply = aiReply.replace(basicDateMatch[0], '').trim();
      const dateStr = basicDateMatch[1].trim();
      const pkgName = basicDateMatch[2] ? basicDateMatch[2].trim() : null;
      const extraDataRaw = basicDateMatch[3] ? basicDateMatch[3].trim() : null;

      // Parse Indonesian date
      const parseIndoDate = (str) => {
        const monthMap = {
          januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
          juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11
        };
        const cleaned = str.replace(/^[\w]+,\s*/i, '').trim();
        const parts = cleaned.split(/[\s,]+/);
        if (parts.length >= 3) {
          const day = parseInt(parts[0]);
          const month = monthMap[parts[1].toLowerCase()];
          const year = parseInt(parts[2]);
          if (!isNaN(day) && month !== undefined && !isNaN(year)) return new Date(year, month, day);
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
      };

      const parsedDate = parseIndoDate(dateStr);

      // Parse extra data into JSON object
      let collectedDataObj = {};
      if (extraDataRaw) {
        extraDataRaw.split('|').forEach(pair => {
          const eqIdx = pair.indexOf('=');
          if (eqIdx > 0) {
            collectedDataObj[pair.substring(0, eqIdx).trim()] = pair.substring(eqIdx + 1).trim();
          }
        });
      }

      try {
        const lead = await prisma.lead.findUnique({
          where: { uk_tenant_phone: { tenant_id: tenantId, phone: userPhone } }
        });
        const cName = lead?.saved_name || 'Pelanggan';
        const timestamp = new Date().toLocaleString('id-ID');

        // Find existing pending date request for this customer
        const existingCm = await prisma.customerManagement.findFirst({
          where: { tenant_id: tenantId, phone: userPhone, date_status: 'pending_approval' },
          orderBy: { updated_at: 'desc' }
        });

        if (existingCm) {
          // Merge collected_data with existing
          let existingData = {};
          try { existingData = JSON.parse(existingCm.collected_data || '{}'); } catch (e) {}
          const mergedData = { ...existingData, ...collectedDataObj };

          await prisma.customerManagement.update({
            where: { id: existingCm.id },
            data: {
              customer_name: cName !== 'Pelanggan' ? cName : existingCm.customer_name,
              package_name: pkgName || existingCm.package_name,
              requested_date: parsedDate || existingCm.requested_date,
              date_status: 'pending_approval',
              collected_data: JSON.stringify(mergedData),
              admin_note: existingCm.admin_note
                ? existingCm.admin_note + `\n- [${timestamp}] Tanggal request diperbarui: ${parsedDate ? parsedDate.toISOString().split('T')[0] : dateStr}`
                : `- [${timestamp}] Tanggal request: ${parsedDate ? parsedDate.toISOString().split('T')[0] : dateStr}`,
              updated_at: new Date()
            }
          });
          console.log(`[Webhook Pipeline] BASIC_DATE_REQUEST updated CM#${existingCm.id} for ${cName}: ${parsedDate || dateStr}`);
        } else {
          await prisma.customerManagement.create({
            data: {
              tenant_id: tenantId,
              phone: userPhone,
              customer_name: cName,
              package_name: pkgName,
              requested_date: parsedDate,
              date_status: 'pending_approval',
              status: 'waiting_date',
              collected_data: Object.keys(collectedDataObj).length > 0 ? JSON.stringify(collectedDataObj) : null,
              admin_note: `- [${timestamp}] Tanggal request: ${parsedDate ? parsedDate.toISOString().split('T')[0] : dateStr}`,
            }
          });
          console.log(`[Webhook Pipeline] BASIC_DATE_REQUEST created CM for ${cName}: ${parsedDate || dateStr}`);
        }

        broadcast(tenantId, 'customer_management_updated', { phone: userPhone, date_status: 'pending_approval' });
      } catch (err) {
        console.error('[Webhook Pipeline] Failed to process BASIC_DATE_REQUEST:', err.message);
      }
    }

    // --- DETECT BASIC_DATE_CHANGED TAG ---
    // Format: [BASIC_DATE_CHANGED: TANGGAL_BARU | ALASAN]
    const basicDateChangedMatch = aiReply.match(/\[BASIC_DATE_CHANGED:\s*(.+?)\s*\|\s*(.+?)\s*\]/i);
    if (basicDateChangedMatch) {
      aiReply = aiReply.replace(basicDateChangedMatch[0], '').trim();
      const newDateStr = basicDateChangedMatch[1].trim();
      const changeReason = basicDateChangedMatch[2].trim();

      const parseIndoDate2 = (str) => {
        const monthMap = {
          januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
          juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11
        };
        const cleaned = str.replace(/^[\w]+,\s*/i, '').trim();
        const parts = cleaned.split(/[\s,]+/);
        if (parts.length >= 3) {
          const day = parseInt(parts[0]);
          const month = monthMap[parts[1].toLowerCase()];
          const year = parseInt(parts[2]);
          if (!isNaN(day) && month !== undefined && !isNaN(year)) return new Date(year, month, day);
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
      };

      const newParsedDate = parseIndoDate2(newDateStr);

      try {
        const existingCm = await prisma.customerManagement.findFirst({
          where: { tenant_id: tenantId, phone: userPhone, date_status: { in: ['pending_approval', 'rejected'] } },
          orderBy: { updated_at: 'desc' }
        });

        const timestamp = new Date().toLocaleString('id-ID');

        if (existingCm) {
          const oldDate = existingCm.requested_date ? existingCm.requested_date.toISOString().split('T')[0] : 'unknown';
          await prisma.customerManagement.update({
            where: { id: existingCm.id },
            data: {
              requested_date: newParsedDate || existingCm.requested_date,
              date_status: 'pending_approval',
              date_reject_reason: null,
              date_suggested: null,
              admin_note: (existingCm.admin_note || '') + `\n- [${timestamp}] Customer ubah tanggal dari ${oldDate} ke ${newParsedDate ? newParsedDate.toISOString().split('T')[0] : newDateStr}. Alasan: ${changeReason}`,
              updated_at: new Date()
            }
          });
          console.log(`[Webhook Pipeline] BASIC_DATE_CHANGED: CM#${existingCm.id} date changed from ${oldDate} to ${newParsedDate || newDateStr}`);
          broadcast(tenantId, 'customer_management_updated', { phone: userPhone, date_status: 'pending_approval', changed: true });
        }
      } catch (err) {
        console.error('[Webhook Pipeline] Failed to process BASIC_DATE_CHANGED:', err.message);
      }
    }

    // --- DETECT EXECUTE CANCEL TAG ---
    const executeCancelMatch = aiReply.match(/\[EXECUTE_CANCEL:\s*(.+?)\]/i);
    if (executeCancelMatch) {
      aiReply = aiReply.replace(executeCancelMatch[0], '').trim();
      const reason = executeCancelMatch[1].trim();

      try {
        const activeTx = await prisma.transaction.findFirst({
          where: { tenant_id: tenantId, user_phone: userPhone, status: 'pending' },
          orderBy: { created_at: 'desc' }
        });
        if (activeTx) {
          await prisma.transaction.update({
            where: { id: activeTx.id },
            data: { status: 'cancelled', admin_note: `Dibatalkan: ${reason}` }
          });
        }

        const cm = await prisma.customerManagement.findFirst({
          where: { tenant_id: tenantId, phone: userPhone, status: { notIn: ['canceled_customer', 'done'] } }
        });
        if (cm) {
          await prisma.customerManagement.update({
            where: { id: cm.id },
            data: { status: 'canceled_customer', admin_note: reason }
          });
        }
      } catch (err) {
        console.error('[Webhook Pipeline] Failed to Execute Cancel:', err.message);
      }
    }

    // --- DETECT EXECUTE REFUND TAG ---
    const executeRefundMatch = aiReply.match(/\[EXECUTE_REFUND:\s*(.+?)\]/i);
    if (executeRefundMatch) {
      aiReply = aiReply.replace(executeRefundMatch[0], '').trim();
      const reason = executeRefundMatch[1].trim();

      try {
        const paidTx = await prisma.transaction.findFirst({
          where: { tenant_id: tenantId, user_phone: userPhone, status: { in: ['paid_full', 'paid_dp'] } },
          orderBy: { created_at: 'desc' }
        });

        if (paidTx) {
           const lead = await prisma.lead.findUnique({
             where: { uk_tenant_phone: { tenant_id: tenantId, phone: userPhone } }
           });
           const cName = lead?.saved_name || 'Pelanggan';

           await prisma.refundRequest.create({
             data: {
               tenant_id: tenantId,
               phone: userPhone,
               customer_name: cName,
               transaction_id: paidTx.id,
               reason: reason,
               status: 'pending'
             }
           });
           console.log(`[Webhook Pipeline] Refund Request created for Tx ${paidTx.id}`);
        }
      } catch (err) {
        console.error('[Webhook Pipeline] Failed to Execute Refund:', err.message);
      }
    }

    const systemInjectedBubbles = [];

    // --- DETECT CANCEL_INVOICE TAG ---
    const cancelInvoiceMatch = aiReply.match(/\[CANCEL_INVOICE\]/i);
    if (cancelInvoiceMatch) {
      aiReply = aiReply.replace(cancelInvoiceMatch[0], '').trim();
      try {
        const activeTx = await prisma.transaction.findFirst({
          where: { tenant_id: tenantId, user_phone: userPhone, status: 'pending' },
          orderBy: { created_at: 'desc' }
        });
        if (activeTx) {
          await prisma.transaction.update({
            where: { id: activeTx.id },
            data: { status: 'cancelled', admin_note: 'Dibatalkan oleh AI (Customer Request)' }
          });
          console.log(`[Webhook Pipeline] Transaction ${activeTx.id} cancelled by AI.`);
          
          if (activeTx.booking_id) {
            await prisma.travelBooking.update({
              where: { id: activeTx.booking_id },
              data: { status: 'cancelled' }
            });
          }
          
          broadcast(tenantId, 'transaction_updated', { id: activeTx.id, status: 'cancelled' });
        }
      } catch (cancelErr) {
        console.error('[Webhook Pipeline] Failed to cancel invoice:', cancelErr.message);
      }
    }

    // --- DETECT MODIFY_INVOICE TAG ---
    const modifyInvoiceMatch = aiReply.match(/\[MODIFY_INVOICE:\s*(.+?)\]/i);
    if (modifyInvoiceMatch) {
      aiReply = aiReply.replace(modifyInvoiceMatch[0], '').trim();
      const modifyReason = modifyInvoiceMatch[1].trim();

      try {
        const activeTx = await prisma.transaction.findFirst({
          where: { tenant_id: tenantId, user_phone: userPhone, status: 'pending' },
          orderBy: { created_at: 'desc' }
        });
        
        if (activeTx) {
          const autoApproveSetting = await prisma.globalSetting.findUnique({
            where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: 'auto_approve_modification' } }
          });
          const isAutoApprove = autoApproveSetting?.setting_value === 'true';

          const lead = await prisma.lead.findUnique({
             where: { uk_tenant_phone: { tenant_id: tenantId, phone: userPhone } }
          });
          const cName = lead?.saved_name || 'Pelanggan';

          if (isAutoApprove) {
            // Cancel old transaction
            await prisma.transaction.update({
              where: { id: activeTx.id },
              data: { status: 'cancelled', is_modified: 1, admin_note: `Modifikasi otomatis. Alasan: ${modifyReason}` }
            });
            // Inject system note to AI
            systemInjectedBubbles.push(`[SISTEM: Modifikasi Invoice (Trans ID ${activeTx.id}) disetujui secara otomatis. Alasan customer: ${modifyReason}. Silakan kalkulasi ulang dan kirim invoice baru menggunakan tag SEND_INVOICE_TO dengan rincian terbaru.]`);
          } else {
            // Create CustomerRequest
            const cr = await prisma.customerRequest.create({
              data: {
                tenant_id: tenantId,
                phone: userPhone,
                customer_name: cName,
                request_type: 'modification',
                request_detail: modifyReason,
                transaction_id: activeTx.id,
                status: 'pending_customer',
              }
            });
            console.log(`[Webhook Pipeline] Modification request saved for Trans ID ${activeTx.id}`);
            broadcast(tenantId, 'new_customer_request', cr);
          }
        }
      } catch (modErr) {
        console.error('[Webhook Pipeline] Failed to handle invoice modification:', modErr.message);
      }
    }

    // --- DETECT ACCEPT_TERMS / REJECT_TERMS TAG ---
    const acceptTermsMatch = aiReply.match(/\[ACCEPT_TERMS:\s*(\d+)\]/i);
    const rejectTermsMatch = aiReply.match(/\[REJECT_TERMS:\s*(\d+)\]/i);
    
    if (acceptTermsMatch || rejectTermsMatch) {
      const match = acceptTermsMatch || rejectTermsMatch;
      const isAccept = !!acceptTermsMatch;
      aiReply = aiReply.replace(match[0], '').trim();
      const requestId = parseInt(match[1]);

      try {
        await prisma.customerRequest.update({
          where: { id: requestId },
          data: { status: isAccept ? 'approved' : 'rejected', resolved_at: new Date() }
        });
        broadcast(tenantId, 'customer_request_updated', { id: requestId, status: isAccept ? 'approved' : 'rejected' });
        
        if (isAccept) {
            systemInjectedBubbles.push(`[SISTEM: Customer telah menyetujui solusi dari admin (Request ID: ${requestId}). Segera proses dan buat invoice jika diperlukan.]`);
        } else {
            systemInjectedBubbles.push(`[SISTEM: Customer telah menolak solusi dari admin (Request ID: ${requestId}). Tanyakan apakah ada opsi lain yang diinginkan.]`);
        }
      } catch (termErr) {
        console.error('[Webhook Pipeline] Failed to update request terms:', termErr.message);
      }
    }

    // --- DETECT INVOICE TAG (enriched format) ---
    // Format: [SEND_INVOICE_TO: NAMA | NAMA_PAKET | JUMLAH_PAX | TOTAL_HARGA]
    let localPdfPath = null;
    const invoiceMatch = aiReply.match(/\[SEND_INVOICE_TO:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\]/i);
    // Fallback: old format [SEND_INVOICE_TO: NAMA]
    const invoiceMatchOld = !invoiceMatch ? aiReply.match(/\[SEND_INVOICE_TO:\s*(.+?)\]/i) : null;
    
    const activeInvoiceMatch = invoiceMatch || invoiceMatchOld;
    
    if (activeInvoiceMatch) {
      aiReply = aiReply.replace(activeInvoiceMatch[0], '').trim();

      let customerName, packageName, paxCount, dealPrice, departureDateParsed;

      if (invoiceMatch) {
        // New enriched format
        customerName = invoiceMatch[1].trim();
        packageName = invoiceMatch[2].trim();
        paxCount = parseInt(invoiceMatch[3]) || 1;
        dealPrice = parseInt(invoiceMatch[4]) || 0;

        // Try to extract departure date from recent user message (or fallback to existing in CustomerManagement later)
        const departureDateMatch = typeof userMessage !== 'undefined' ? userMessage.match(/(\d{1,2}\s+(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+\d{4})/i) : null;
        if (departureDateMatch) {
          const monthMap = {
            januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
            juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11
          };
          const parts = departureDateMatch[1].split(/\s+/);
          const day = parseInt(parts[0]);
          const month = monthMap[parts[1].toLowerCase()];
          const year = parseInt(parts[2]);
          if (!isNaN(day) && month !== undefined && !isNaN(year)) {
            departureDateParsed = new Date(year, month, day);
          }
        }
      } else {
        // Old format fallback
        customerName = invoiceMatchOld[1].trim();
        packageName = null;
        paxCount = 1;
        dealPrice = 0;
      }

      console.log(`[Webhook Pipeline] AI requested invoice → Name: ${customerName}, Package: ${packageName}, Pax: ${paxCount}, Price: ${dealPrice}`);

      try {
        // 1. Match package from database (exact match)
        let matchedPackage = null;
        if (packageName) {
          matchedPackage = await prisma.travelPackage.findFirst({
            where: { tenant_id: tenantId, package_name: packageName }
          });
          if (!matchedPackage) {
            // Try case-insensitive fallback
            const allPackages = await prisma.travelPackage.findMany({
              where: { tenant_id: tenantId }
            });
            matchedPackage = allPackages.find(p => 
              p.package_name.toLowerCase() === packageName.toLowerCase()
            );
          }
          if (matchedPackage) {
            console.log(`[Webhook Pipeline] Matched package: ${matchedPackage.package_name} (ID: ${matchedPackage.id})`);
          } else {
            console.warn(`[Webhook Pipeline] Package "${packageName}" not found in DB, using name from AI`);
          }
        }

        // 2. Create the new Transaction via Transaction Service
        const contextPackageName = matchedPackage?.package_name || packageName || 'Paket Custom';
        const orderId = `INV-${Date.now()}`;
        const transactionItems = [{
          itemName: contextPackageName,
          quantity: paxCount,
          unitPrice: dealPrice / (paxCount || 1)
        }];

        const trx = await createTransaction(tenantId, userPhone, customerName, orderId, transactionItems);
        console.log(`[Webhook Pipeline] Created Transaction ID: ${trx.id}`);

        // Auto-populate Central Information (CustomerManagement) on invoice creation
        try {
          const invoiceDate = (typeof departureDateParsed !== 'undefined') ? departureDateParsed : null;
          await upsertActiveOrderNote(tenantId, userPhone, customerName, packageName, `Invoice diterbitkan sejumlah Rp ${dealPrice.toLocaleString('id-ID')} (${paxCount} pax). Menunggu pembayaran.`, invoiceDate);

          const existingCm = await prisma.customerManagement.findFirst({
            where: { tenant_id: tenantId, phone: userPhone },
            orderBy: { created_at: 'desc' }
          });
          if (existingCm && !['done', 'completed', 'canceled', 'canceled_customer'].includes(existingCm.status)) {
            await prisma.customerManagement.update({
              where: { id: existingCm.id },
              data: { status: 'waiting_payment' }
            });
          }
          console.log(`[Webhook Pipeline] CustomerManagement synced for invoice: ${customerName}`);
        } catch (cmErr) {
          console.error('[Webhook Pipeline] Failed to sync CustomerManagement:', cmErr.message);
        }

        // 3. Generate invoice with real data
        const invoiceContext = {
          invoiceNumber: `INV-${Date.now()}`,
          customerName: customerName,
          customerPhone: userPhone,
          packageDetails: `${matchedPackage?.package_name || packageName || 'Paket Custom'} (${paxCount} Pax)`,
          amount: dealPrice,
          paymentInfo: 'Transfer Bank BCA\nNo Rek: 1234567890\nA/N: PT Luevora'
        };

        // Try to get actual bank info
        const bankAccounts = await prisma.bankAccount.findMany({ where: { tenant_id: tenantId } });
        if (bankAccounts.length > 0) {
          invoiceContext.paymentInfo = bankAccounts.map(b => 
            `Transfer ${b.bank_name}\nNo Rek: ${b.account_number}\nA/N: ${b.account_holder}`
          ).join('\n\n');
        }

        const pdfResult = await pdfGeneratorService.generateInvoice(tenantId, null, invoiceContext);
        
        if (pdfResult.success) {
          const baseUrl = process.env.PUBLIC_URL || 'https://api.luevora.com';
          invoicePdfUrl = pdfResult.fileUrl.startsWith('http') ? pdfResult.fileUrl : `${baseUrl}${pdfResult.fileUrl}`;
          localPdfPath = pdfResult.filePath;
          console.log(`[Webhook Pipeline] Generated Invoice PDF: ${invoicePdfUrl} (Local: ${localPdfPath})`);
        } else {
          console.error(`[Webhook Pipeline] Failed to generate invoice: ${pdfResult.error}`);
        }
      } catch (err) {
        console.error('[Webhook Pipeline] Error during invoice generation:', err);
      }
    }

    // ── Step 7-10: MULTI-BUBBLE Send, Save, Broadcast ──
    const aiBubbles = result.data.bubbles || [aiReply];
    const lastBubbleIdx = aiBubbles.length - 1;

    // ── Process [SEND_BROCHURE: package_name] tag ──
    const availableBrochures = result.data.metadata?.availableBrochures || {};
    const brochureTagRegex = /\[SEND_BROCHURE:\s*(.+?)\s*\]/gi;
    const requestedBrochureUrls = [];
    const requestedBrochureMeta = [];
    let brochureMatch;
    while ((brochureMatch = brochureTagRegex.exec(aiReply)) !== null) {
      const requestedName = brochureMatch[1].trim();
      // Fuzzy match: find brochure by exact or contains match
      const matchedKey = Object.keys(availableBrochures).find(k => 
        k.toLowerCase() === requestedName.toLowerCase() || 
        k.toLowerCase().includes(requestedName.toLowerCase()) ||
        requestedName.toLowerCase().includes(k.toLowerCase())
      );
      if (matchedKey && availableBrochures[matchedKey]) {
        const brochure = availableBrochures[matchedKey];
        requestedBrochureUrls.push(brochure.mediaUrl);
        requestedBrochureMeta.push(brochure.meta);
        console.log(`[SEND_BROCHURE] AI requested brochure "${requestedName}" → matched: "${matchedKey}"`);
      } else {
        console.warn(`[SEND_BROCHURE] AI requested "${requestedName}" but no matching brochure found in availableBrochures.`);
      }
    }

    // Pre-calculate media URLs & metadata for chat_history and dedup recording
    // Priority: invoice PDF > AI-requested brochures > auto-injected docMediaUrls (KB docs, deep-read docs)
    const autoMediaUrls = result.data.metadata?.docMediaUrls || [];
    const preFinalMediaUrls = invoicePdfUrl 
      ? [invoicePdfUrl] 
      : [...requestedBrochureUrls, ...autoMediaUrls];
    const docMediaMeta = [...requestedBrochureMeta, ...(result.data.metadata?.docMediaMeta || [])];
    const firstMediaUrlForHistory = preFinalMediaUrls.length > 0 ? preFinalMediaUrls[0] : null;

    // Strip tags from all bubbles (tags already processed from combinedReply above)
    const cleanBubbles = aiBubbles.map(b => {
      return b
        .replace(/\[UPDATE_NAME:\s*.+?\]/gi, '')
        .replace(/\[UPDATE_INFO:.+?\]/gis, '')
        .replace(/\[PAYMENT_PROOF_DETECTED:\s*.+?\]/gi, '')
        .replace(/\[OFFER_DETECTED:\s*.+?\]/gi, '')
        .replace(/\[CUSTOMER_REQUEST:\s*.+?\]/gi, '')
        .replace(/\[REQUEST:.+?\]/gi, '')
        .replace(/\[REVISE_REQUEST:\s*.+?\]/gi, '')
        .replace(/\[SERIOUS_INTENT:\s*.+?\]/gi, '')
        .replace(/\[BASIC_DATE_REQUEST:\s*.+?\]/gi, '')
        .replace(/\[BASIC_DATE_CHANGED:\s*.+?\]/gi, '')
        .replace(/\[EXECUTE_CANCEL:\s*.+?\]/gi, '')
        .replace(/\[EXECUTE_REFUND:\s*.+?\]/gi, '')
        .replace(/\[SEND_INVOICE_TO:\s*.+?\]/gi, '')
        .replace(/\[SEND_PKG_MEDIA\s*:\s*\d+\s*:\s*\d+\s*\]/gi, '')
        .replace(/\[CANCEL_INVOICE\]/gi, '')
        .replace(/\[MODIFY_INVOICE:\s*.+?\]/gi, '')
        .replace(/\[ACCEPT_TERMS:\s*\d+\]/gi, '')
        .replace(/\[REJECT_TERMS:\s*\d+\]/gi, '')
        .replace(/\[SEND_BROCHURE:\s*.+?\]/gi, '')
        // Tags that were missing — caused [CONVERSATION_INTENT:serious] leak to customer
        .replace(/\[CONVERSATION_INTENT:\s*[^\]]+\]/gi, '')
        .replace(/\[CENTRAL_INFO_REQUEST:\s*[^\]]+\]/gi, '')
        .replace(/\[CENTRAL_INFO_RESOLVED\]/gi, '')
        .replace(/\[ORDER_FORM_UPDATE:\s*[^\]]+\]/gi, '')
        .replace(/\[ORDER_FORM_CONFIRM\]/gi, '')
        .replace(/\[ORDER_FORM_FINALIZE\]/gi, '')
        .replace(/\[MERGE_LEAD:\s*[^\]]+\]/gi, '')
        .replace(/\[INTERNAL[^\]]*\]/gi, '')
        .replace(/\[AI_NOTE[^\]]*\]/gi, '')
        .replace(/\[DEBUG[^\]]*\]/gi, '')
        .replace(/\[ACTIVE_TOPICS?[^\]]*\]/gi, '')
        .replace(/\[SISTEM[:\s][^\]]*\]/gi, '')
        .replace(/UPDATE_ACTIVE_TOPICS:?\s*[^\n]*/gi, '')
        .replace(/\[NEXT\]/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }).filter(b => b.length > 0);

    // Push any injected system bubbles that the AI should see in history but the customer shouldn't see directly
    cleanBubbles.push(...systemInjectedBubbles);

    console.log(`[Webhook Pipeline] Sending ${cleanBubbles.length} bubble(s) to ${userPhone}`);

    let lastSavedMsgId = null;
    let failedBubbleCount = 0;
    for (let i = 0; i < cleanBubbles.length; i++) {
      const bubbleText = cleanBubbles[i];
      const bubbleTime = new Date();
      const isLast = i === cleanBubbles.length - 1;

      // Save each bubble as separate chat_history record
      const savedMsg = await saveMessage(prisma, userPhone, 'assistant', bubbleText, tenantId, null, null);
      lastSavedMsgId = savedMsg?.id ?? null;

      // Clean the text specifically for customer view (strip system notes)
      const textToCustomer = bubbleText.replace(/\[SISTEM:.*?\]/gis, '').trim();

      // Send via provider (Meta/Telegram/Instagram) with result checking
      try {
        if (textToCustomer.length > 0) {
          const textResult = await sendText(prisma, userPhone, textToCustomer, { tenantId });
          
          if (textResult.status === false && textResult.via !== 'queue') {
            // Send truly failed (not even queued)
            failedBubbleCount++;
            console.error(`[Webhook Pipeline] ❌ Bubble ${i + 1}/${cleanBubbles.length} SEND FAILED (no queue fallback):`, textResult.error);
            broadcast(tenantId, 'bubble_send_failed', {
              phone: userPhone,
              bubble_index: i + 1,
              total_bubbles: cleanBubbles.length,
              message: textToCustomer.substring(0, 500),
              error: textResult.error,
              chat_history_id: savedMsg?.id ?? null,
            });
          } else if (textResult.via === 'queue') {
            console.warn(`[Webhook Pipeline] ⚠️ Bubble ${i + 1}/${cleanBubbles.length} queued for retry:`, textResult.message);
          } else {
            console.log(`[Webhook Pipeline] Bubble ${i + 1}/${cleanBubbles.length} sent:`, textResult);
          }
        } else {
          console.log(`[Webhook Pipeline] Bubble ${i + 1}/${cleanBubbles.length} skipped (empty after strip).`);
        }
      } catch (sendErr) {
        failedBubbleCount++;
        console.error(`[Webhook Pipeline] ❌ Bubble ${i + 1} SEND EXCEPTION:`, sendErr.message);
        broadcast(tenantId, 'bubble_send_failed', {
          phone: userPhone,
          bubble_index: i + 1,
          total_bubbles: cleanBubbles.length,
          message: textToCustomer.substring(0, 500),
          error: sendErr.message,
          chat_history_id: savedMsg?.id ?? null,
        });
      }

      // Broadcast to dashboard SSE (use raw bubbleText so system notes are visible in dashboard but not to customer)
      broadcast(tenantId, 'new_message', {
        phone: userPhone,
        message: textToCustomer,
        media_url: null,
        role: 'assistant',
        timestamp: bubbleTime.toISOString(),
        created_at: bubbleTime.toISOString(),
        id: savedMsg?.id ?? null,
      });

      // Random delay between bubbles (3-4s) to prevent out-of-order delivery by Twilio/WA
      if (!isLast) {
        const delay = 3000 + Math.random() * 1000;
        console.log(`[Webhook Pipeline] Waiting ${Math.round(delay)}ms before next bubble...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    // ── Embed chat pair for vector memory recall (BACKGROUND, non-blocking) ──
    const leadId = result.data.metadata?.leadId;
    if (leadId) {
      const combinedReply = cleanBubbles.join('\n');
      embedChatPair(tenantId, leadId, userMessage, combinedReply)
        .catch(err => console.error('[Webhook Pipeline] Chat memory embed error:', err.message));
    }

    // Send invoice PDF or Doc Media as separate media messages after all bubbles
    // Uses preFinalMediaUrls calculated above
    
    if (preFinalMediaUrls.length > 0) {
      for (let mIdx = 0; mIdx < preFinalMediaUrls.length; mIdx++) {
        const finalMediaUrl = preFinalMediaUrls[mIdx];
        try {
          await new Promise(r => setTimeout(r, 1500));
          let fullMediaUrl = finalMediaUrl;
          let resolvedLocalPath = (finalMediaUrl === invoicePdfUrl && localPdfPath) ? localPdfPath : null;

          // If URL is already absolute (Cloudinary, etc.), use directly — no resolution needed
          if (finalMediaUrl.startsWith('http')) {
            console.log(`[Webhook Pipeline] Using absolute media URL: ${finalMediaUrl.substring(0, 80)}...`);
            fullMediaUrl = finalMediaUrl;

            // Twilio/WhatsApp has a strict 5MB limit for images.
            // If it's a Cloudinary image URL, append dynamic compression flags to guarantee it stays under the limit.
            if (fullMediaUrl.includes('res.cloudinary.com') && fullMediaUrl.includes('/image/upload/')) {
              fullMediaUrl = fullMediaUrl.replace('/image/upload/', '/image/upload/q_auto:good,w_1600,c_limit/');
              console.log(`[Webhook Pipeline] Applied Cloudinary auto-compression for WA: ${fullMediaUrl.substring(0, 80)}...`);
            }
          } else {
            // Legacy: Resolve local path from uploads directory so WA Web can send directly
            if (finalMediaUrl.startsWith('/uploads') && !resolvedLocalPath) {
              const { default: path } = await import('path');
              const { fileURLToPath } = await import('url');
              const __dirname = path.dirname(fileURLToPath(import.meta.url));
              resolvedLocalPath = path.resolve(__dirname, '../../..', finalMediaUrl.replace(/^\//, ''));
              console.log(`[Webhook Pipeline] Resolved local path: ${resolvedLocalPath}`);
            }

            if (finalMediaUrl.startsWith('/')) {
              const baseUrl = process.env.PUBLIC_URL || 'https://api.luevora.com';
              fullMediaUrl = `${baseUrl}${finalMediaUrl}`;
            }
          }

          console.log(`[Webhook Pipeline] Sending media ${mIdx + 1}/${preFinalMediaUrls.length} to ${userPhone}`);
          
          // Build meaningful caption from docMediaMeta so customer knows what the image is
          let mediaCaption = '';
          let mediaFilename = '';
          if (finalMediaUrl === invoicePdfUrl) {
            mediaCaption = '📄 Berikut invoice Anda.';
            mediaFilename = 'invoice.pdf';
          } else {
            const meta = docMediaMeta.find(m => m.mediaUrl === finalMediaUrl);
            console.log(`[Webhook Pipeline] Meta lookup for URL=${finalMediaUrl.substring(0, 60)}: found=${!!meta}, filename=${meta?.filename || '(none)'}, title=${meta?.title || '(none)'}`);
            if (meta?.description) {
              mediaCaption = `📎 ${meta.description}`;
            }
            if (meta?.filename) {
              mediaFilename = meta.filename;
            } else if (meta?.title) {
              mediaFilename = meta.title;
            }
          }

          console.log(`[Webhook Pipeline] Media ${mIdx + 1}: URL=${fullMediaUrl.substring(0, 60)}... filename=${mediaFilename || '(none)'}`);

          // Send media with retry (2 attempts)
          let mediaSendSuccess = false;
          for (let retry = 0; retry <= 2; retry++) {
            try {
              const mediaResult = await sendMedia(prisma, userPhone, mediaCaption, fullMediaUrl, { tenantId, localPath: resolvedLocalPath, filename: mediaFilename });
              console.log(`[Webhook Pipeline] ✅ Media ${mIdx + 1} send result:`, mediaResult);
              mediaSendSuccess = true;
              break;
            } catch (retryErr) {
              if (retry < 2) {
                const delay = 2000 * Math.pow(2, retry);
                console.warn(`[Webhook Pipeline] Media send attempt ${retry + 1} failed: ${retryErr.message}. Retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
              } else {
                console.error(`[Webhook Pipeline] \u274c Media send failed after 3 attempts:`, retryErr.message);
              }
            }
          }
          
          if (!mediaSendSuccess) {
            broadcast(tenantId, 'bubble_send_failed', {
              phone: userPhone,
              bubble_index: `media_${mIdx + 1}`,
              total_bubbles: preFinalMediaUrls.length,
              message: '[Media/Gambar gagal dikirim]',
              error: 'Media send failed after retries',
              media_url: finalMediaUrl,
            });
          }
          
          // Broadcast media message to dashboard SSE so it appears in real-time (without refresh)
          const mediaTime = new Date();
          const savedMediaMsg = await saveMessage(prisma, userPhone, 'assistant', '[Gambar/Media Dikirim]', tenantId, finalMediaUrl);
          broadcast(tenantId, 'new_message', {
            phone: userPhone,
            message: '[Gambar/Media Dikirim]',
            media_url: finalMediaUrl,
            role: 'assistant',
            timestamp: mediaTime.toISOString(),
            created_at: mediaTime.toISOString(),
            id: savedMediaMsg?.id ?? null,
          });

          // Record successful media send to CRM history for dedup tracking
          if (finalMediaUrl !== invoicePdfUrl) {
            try {
              const meta = docMediaMeta[mIdx];
              if (meta) {
                await recordMediaSent(tenantId, userPhone, meta.mediaKey, finalMediaUrl, meta.description, meta.fileUpdatedAt);
              } else {
                await recordMediaSent(tenantId, userPhone, finalMediaUrl, finalMediaUrl, 'Media dikirim oleh AI');
              }
            } catch (recordErr) {
              console.error('[Webhook Pipeline] Failed to record media sent:', recordErr.message);
            }
          }
        } catch (mediaErr) {
          console.error(`[Webhook Pipeline] ❌ MEDIA SEND FAILED:`, mediaErr.message);
        }
      }
    }

    // Update lead with last bubble preview
    if (failedBubbleCount > 0) {
      console.error(`[Webhook Pipeline] ⚠️ ${failedBubbleCount}/${cleanBubbles.length} bubble(s) FAILED to send to ${userPhone}. Check dashboard for details.`);
    }

    const lastBubble = cleanBubbles[cleanBubbles.length - 1] || aiReply;
    const aiNow = new Date();
    await prisma.lead.update({
      where: { uk_tenant_phone: { tenant_id: tenantId, phone: userPhone } },
      data: {
        // JANGAN overwrite last_message_preview dengan reply AI.
        // last_message_preview harus tetap menampilkan pesan TERAKHIR dari USER,
        // bukan dari AI. Ini penting agar sidebar Leads Inbox menampilkan
        // preview pesan customer, bukan balasan AI (seperti WhatsApp chat list).
        last_ai_reply: aiReply.substring(0, 2000),
        last_message_at: aiNow,
      }
    });

    broadcast(tenantId, 'lead_updated', {
      phone: userPhone,
      active_phone: userPhone,
      // Kirim last_message_preview kosong agar frontend TIDAK meng-overwrite
      // preview yang sudah benar (pesan user) dengan teks balasan AI.
      last_message_preview: null,
      last_message_at: aiNow.toISOString(),
      channel: 'whatsapp',
    });

};

export default {
  normalizePhone,
  normalizeForLookup,
  resolveTenantFromPhone,
  processIncomingWebhook,
  processBufferedMessages,
};
