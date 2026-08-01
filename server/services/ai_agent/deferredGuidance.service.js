/**
 * ================================================================
 * DEFERRED GUIDANCE SERVICE — Smart Data Collection Before Admin Request
 * ================================================================
 *
 * When AI detects a knowledge gap requiring System Guider, it doesn't
 * send the request immediately. Instead, it:
 *   1. Creates a "deferred intent" with required data fields
 *   2. Pre-fills from existing CRM/Lead data
 *   3. Only asks customer for truly missing data
 *   4. Auto-triggers request_admin_guidance when all data collected
 *
 * Storage: Redis with 7-day TTL
 * Cleanup: Ghost timer expiry, customer cancellation, or TTL
 */

import redisClient, { REDIS_PREFIX } from '../../config/redis.js';
import prisma from '../../config/database.js';
import * as centralInfoRequestService from '../shared/centralInfoRequest.service.js';

const INTENT_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
const GHOST_LINKED_TTL = 2 * 24 * 60 * 60; // 48 hours — same as ghost timer
const KEY_PREFIX = `deferred_guidance:${REDIS_PREFIX}`;

const getKey = (tenantId, phone) => `${KEY_PREFIX}:${tenantId}:${phone}`;

/**
 * Map a required data key to the corresponding CRM/Lead field value.
 * Returns the value if found, null otherwise.
 */
const matchCrmField = (key, lead) => {
  if (!lead) return null;

  const mapping = {
    customer_name: lead.saved_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || null,
    nama: lead.saved_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || null,
    name: lead.saved_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || null,
    email: lead.email || null,
    phone: lead.phone || null,
    city: lead.city || null,
    kota: lead.city || null,
    country: lead.country || null,
    company_name: lead.company_name || null,
    perusahaan: lead.company_name || null,
    company: lead.company_name || null,
    position_title: lead.position_title || null,
    jabatan: lead.position_title || null,
    gender: lead.gender || null,
    preferences: lead.preferences || null,
    preferensi: lead.preferences || null,
    // Common AI-generated field keys that map to CRM preferences
    hotel_preference: lead.preferences || null,
    hotel_pref: lead.preferences || null,
    hotel: lead.preferences || null,
    bintang_hotel: lead.preferences || null,
    preferensi_hotel: lead.preferences || null,
    personal_notes: lead.personal_notes || null,
    industry: lead.industry || null,
    industri: lead.industry || null,
  };

  // Direct match
  const normalized = key.toLowerCase().replace(/[^a-z_]/g, '');
  if (mapping[normalized] && mapping[normalized] !== '----') return mapping[normalized];

  // Fuzzy match: check if key contains any mapping key
  for (const [mapKey, mapValue] of Object.entries(mapping)) {
    if (mapValue && mapValue !== '----' && (normalized.includes(mapKey) || mapKey.includes(normalized))) {
      return mapValue;
    }
  }

  return null;
};

/**
 * Create a deferred guidance intent.
 * Pre-fills from CRM data and only marks unfilled fields as needed.
 *
 * @param {number} tenantId
 * @param {string} phone
 * @param {string} question - What the customer asked that AI can't answer
 * @param {Array<{key: string, label: string}>} requiredData - Fields AI needs to collect
 * @param {string} aiNotes - Additional context from AI
 * @returns {Promise<{created: boolean, autoExecuted: boolean, intent: Object, missingFields: Array}>}
 */
export const createIntent = async (tenantId, phone, question, requiredData, aiNotes, adminFields) => {
  const key = getKey(tenantId, phone);

  // Defensive: ensure requiredData is an array
  let safeRequiredData = requiredData;
  if (!Array.isArray(safeRequiredData) || safeRequiredData.length === 0) {
    console.warn(`[DeferredGuidance] ⚠️ requiredData is invalid (${typeof requiredData}), falling back to default [customer_name]`);
    safeRequiredData = [{ key: 'customer_name', label: 'Nama lengkap customer' }];
  }

  // Load CRM data for pre-fill
  const lead = await prisma.lead.findUnique({
    where: { uk_tenant_phone: { tenant_id: tenantId, phone } },
    select: {
      saved_name: true, first_name: true, last_name: true, push_name: true,
      email: true, preferences: true, city: true, country: true,
      company_name: true, position_title: true, industry: true,
      gender: true, personal_notes: true, phone: true,
      chat_summary: true,
    }
  });

  // Pre-fill from CRM
  const collectedValues = {};
  const updatedRequiredData = safeRequiredData.map(field => {
    const crmValue = matchCrmField(field.key, lead);
    if (crmValue) {
      collectedValues[field.key] = crmValue;
      return { ...field, collected: true };
    }
    return { ...field, collected: false };
  });

  const missingFields = updatedRequiredData.filter(f => !f.collected);

  // Defensive: ensure question is non-empty string
  // Fallback to ai_notes excerpt, then last customer message
  let safeQuestion = question;
  if (!safeQuestion || typeof safeQuestion !== 'string' || safeQuestion.trim().length < 5) {
    if (aiNotes && aiNotes.trim().length > 5) {
      safeQuestion = aiNotes.substring(0, 200);
    } else {
      try {
        const lastMsg = await prisma.chatHistory.findFirst({
          where: { tenant_id: tenantId, user_phone: phone, role: 'user' },
          orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
          select: { message: true }
        });
        safeQuestion = lastMsg?.message
          ? `Customer bertanya: ${lastMsg.message.substring(0, 200)} — AI tidak bisa menjawab karena informasi tidak tersedia di Knowledge Base.`
          : '(Pertanyaan tidak terdeteksi)';
      } catch {
        safeQuestion = '(Pertanyaan tidak terdeteksi)';
      }
    }
    console.warn(`[DeferredGuidance] ⚠️ question was empty, auto-detected: "${safeQuestion.substring(0, 80)}"`);
  }

  // Check if linked to active order form
  let hasLinkedOrderForm = false;
  try {
    const activeForm = await prisma.orderForm.findFirst({
      where: { tenant_id: tenantId, phone, status: { in: ['collecting', 'pending_confirm'] } }
    });
    hasLinkedOrderForm = !!activeForm;
  } catch {}

  // If ALL data already available → auto-execute immediately
  if (missingFields.length === 0) {
    console.log(`[DeferredGuidance] ⚡ All data pre-filled from CRM for ${phone}. Auto-executing request_admin_guidance...`);

    const result = await executeIntentInternal(tenantId, phone, safeQuestion, collectedValues, aiNotes, lead, adminFields);
    return { created: false, autoExecuted: true, result, missingFields: [] };
  }

  // Store intent in Redis (including adminFields for use when executing)
  const intent = {
    question: safeQuestion,
    requiredData: updatedRequiredData,
    collectedValues,
    aiNotes: aiNotes || '',
    adminFields: adminFields || null,
    createdAt: new Date().toISOString(),
    hasLinkedOrderForm,
  };

  const ttl = hasLinkedOrderForm ? GHOST_LINKED_TTL : INTENT_TTL;
  await redisClient.setex(key, ttl, JSON.stringify(intent));

  const preFilledCount = updatedRequiredData.filter(f => f.collected).length;
  console.log(`[DeferredGuidance] 📋 Intent created for ${phone}: "${safeQuestion.substring(0, 80)}" | Pre-filled: ${preFilledCount}/${updatedRequiredData.length} | Missing: ${missingFields.map(f => f.key).join(', ')} | AdminFields: ${adminFields?.length || 0} | TTL: ${ttl / 3600}h`);

  return { created: true, autoExecuted: false, intent, missingFields };
};

/**
 * Get the current deferred intent for a customer.
 * @returns {Promise<Object|null>}
 */
export const getIntent = async (tenantId, phone) => {
  const key = getKey(tenantId, phone);
  const raw = await redisClient.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * Update collected data in the intent by cross-referencing current CRM state.
 * Called after AI updates CRM (via update_crm_profile or conversation).
 *
 * @returns {Promise<{updated: boolean, allCollected: boolean, missingFields: Array}>}
 */
export const refreshFromCrm = async (tenantId, phone) => {
  const key = getKey(tenantId, phone);
  const intent = await getIntent(tenantId, phone);
  if (!intent) return { updated: false, allCollected: false, missingFields: [] };

  // Re-read CRM data
  const lead = await prisma.lead.findUnique({
    where: { uk_tenant_phone: { tenant_id: tenantId, phone } },
    select: {
      saved_name: true, first_name: true, last_name: true, push_name: true,
      email: true, preferences: true, city: true, country: true,
      company_name: true, position_title: true, industry: true,
      gender: true, personal_notes: true, phone: true,
    }
  });

  let anyUpdated = false;
  const updatedData = intent.requiredData.map(field => {
    if (field.collected) return field;

    const crmValue = matchCrmField(field.key, lead);
    if (crmValue) {
      intent.collectedValues[field.key] = crmValue;
      anyUpdated = true;
      return { ...field, collected: true };
    }
    return field;
  });

  intent.requiredData = updatedData;
  const missingFields = updatedData.filter(f => !f.collected);
  const allCollected = missingFields.length === 0;

  if (anyUpdated) {
    // Preserve existing TTL
    const ttl = await redisClient.ttl(key);
    await redisClient.setex(key, ttl > 0 ? ttl : INTENT_TTL, JSON.stringify(intent));
    console.log(`[DeferredGuidance] 🔄 Refreshed intent for ${phone}: ${updatedData.filter(f => f.collected).length}/${updatedData.length} collected`);
  }

  return { updated: anyUpdated, allCollected, missingFields };
};

/**
 * Execute the deferred intent — sends request_admin_guidance and cleans up.
 * Called when all required data is collected.
 */
export const executeIntent = async (tenantId, phone) => {
  const intent = await getIntent(tenantId, phone);
  if (!intent) return null;

  const lead = await prisma.lead.findUnique({
    where: { uk_tenant_phone: { tenant_id: tenantId, phone } },
    select: {
      saved_name: true, first_name: true, last_name: true, push_name: true,
      email: true, preferences: true, chat_summary: true,
    }
  });

  const result = await executeIntentInternal(
    tenantId, phone, intent.question, intent.collectedValues, intent.aiNotes, lead, intent.adminFields
  );

  // Clean up Redis
  await cancelIntent(tenantId, phone);
  return result;
};

/**
 * Internal: execute the actual request_admin_guidance call.
 */
const executeIntentInternal = async (tenantId, phone, question, collectedValues, aiNotes, lead, adminFields) => {
  const customerName = lead?.saved_name ||
    [lead?.first_name, lead?.last_name].filter(Boolean).join(' ') ||
    null;

  // ── AI-Powered Summary Generator ──
  let safeQuestion = question;
  const needsAiSummary = !safeQuestion 
    || typeof safeQuestion !== 'string' 
    || safeQuestion.trim().length < 40
    || /bertanya:|meminta:/i.test(safeQuestion)
    || (safeQuestion.match(/\|/g) || []).length >= 2;

  if (needsAiSummary) {
    try {
      const recentChat = await prisma.chatHistory.findMany({
        where: { tenant_id: tenantId, user_phone: phone },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: 8,
        select: { role: true, message: true }
      });
      const chatContext = recentChat.reverse().map(m =>
        `${m.role === 'user' ? 'Customer' : 'AI'}: ${m.message.substring(0, 150)}`
      ).join('\n');

      const { executeFastJsonAI } = await import('../ai_agent/logic.service.js');
      const aiSummary = await executeFastJsonAI(tenantId,
        `Kamu adalah AI yang membuat LAPORAN INTERNAL untuk admin. Baca percakapan dan buat KESIMPULAN jelas.

TUGAS: Buat laporan 2-3 kalimat:
1. SIAPA customer (nama + konteks)
2. APA yang diminta secara SPESIFIK
3. KENAPA AI tidak bisa menjawab
4. APA yang dibutuhkan dari admin

DATA CUSTOMER:
- Nama: ${customerName || phone}
- Preferensi: ${lead?.preferences || 'Belum ada'}
${aiNotes ? `- Catatan AI: ${aiNotes}` : ''}
${collectedValues ? `- Data terkumpul: ${JSON.stringify(collectedValues)}` : ''}

FORMAT: Memo internal singkat tapi informatif. JANGAN kutip kata customer mentah. JANGAN sertakan nomor telepon.
Output JSON: { "summary": "Laporan 2-3 kalimat..." }`,
        `PERCAKAPAN:\n${chatContext || '(tidak ada)'}${safeQuestion ? `\n\nRingkasan awal: ${safeQuestion}` : ''}`,
        [], 'deferred_guidance'
      );

      if (aiSummary?.summary && aiSummary.summary.length > 20) {
        safeQuestion = aiSummary.summary;
        console.log(`[DeferredGuidance] ✅ AI-generated summary: "${safeQuestion.substring(0, 100)}"`);
      }
    } catch (aiErr) {
      console.warn('[DeferredGuidance] AI summary failed:', aiErr.message);
      // Fallback: use raw question or build minimal context
      if (!safeQuestion || safeQuestion.length < 10) {
        safeQuestion = `Customer ${customerName || phone} memiliki pertanyaan yang tidak dapat dijawab AI. Mohon cek riwayat chat.`;
      }
    }
  }

  // Ensure customer name is in the summary
  if (customerName && customerName !== '----' && !safeQuestion.includes(customerName)) {
    safeQuestion = safeQuestion.replace(/^Customer\s*/i, `Customer ${customerName} `);
  }

  // Final safeguard
  if (!safeQuestion || safeQuestion.length < 20) {
    safeQuestion = `Customer ${customerName || phone} memiliki pertanyaan yang tidak dapat dijawab AI dari Knowledge Base. Mohon cek riwayat chat.`;
  }



  // Build context with all collected data
  const dataEntries = Object.entries(collectedValues || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  const contextSnippet = [
    `Customer: ${customerName || phone}`,
    `Pertanyaan: ${safeQuestion}`,
    dataEntries ? `Data terkumpul: ${dataEntries}` : null,
    lead?.chat_summary ? `Ringkasan chat: ${lead.chat_summary}` : null,
  ].filter(Boolean).join('\n');

  const fullNotes = [
    aiNotes || null,
    dataEntries ? `📋 Data dari Deferred Guidance: ${dataEntries}` : null,
    lead?.email ? `📧 Email: ${lead.email}` : null,
    lead?.preferences ? `⭐ Preferensi: ${lead.preferences}` : null,
  ].filter(Boolean).join('\n');

  // Build required_info fields for System Guider form
  // If AI provided specific admin_info_fields, use those; else fall back to one generic field
  let requiredInfo;
  if (Array.isArray(adminFields) && adminFields.length > 0) {
    // Use specific fields defined by AI — this creates a structured checklist for admin
    requiredInfo = adminFields.map(f => ({
      key: f.key,
      label: f.label,
      value: null,
      answered: false
    }));
    console.log(`[DeferredGuidance] Using ${requiredInfo.length} specific admin fields: ${requiredInfo.map(f => f.key).join(', ')}`);
  } else {
    // Generic single field — label generik, pertanyaan sudah tampil di "Pertanyaan Awal"
    requiredInfo = [{
      key: 'answer',
      label: 'Jawaban admin',
      value: null,
      answered: false
    }];
  }


  // Enrich with order form data if available
  try {
    const orderForm = await prisma.orderForm.findFirst({
      where: { tenant_id: tenantId, phone, status: { in: ['collecting', 'pending_confirm'] } },
      orderBy: { updated_at: 'desc' }
    });
    if (orderForm) {
      const formData = JSON.parse(orderForm.form_data || '{}');
      const filled = Object.entries(formData).filter(([, v]) => v && v !== '');
      if (filled.length > 0) {
        const formNote = '📋 Data Form: ' + filled.map(([k, v]) => `${k}=${v}`).join(', ');
        // Already in fullNotes via aiNotes
      }
    }
  } catch {}

  const result = await centralInfoRequestService.createOrUpdateRequest(
    tenantId,
    phone,
    customerName,
    safeQuestion,
    contextSnippet,
    fullNotes,
    requiredInfo
  );

  if (result) {
    console.log(`[DeferredGuidance] ✅ Request #${result.id} sent to System Guider for ${phone}: "${safeQuestion.substring(0, 80)}"`);

    // Broadcast to dashboard
    try {
      const { broadcast } = await import('../shared/sse.service.js');
      broadcast(tenantId, 'central_info_request_created', {
        id: result.id,
        phone,
        deferredGuidance: true
      });
    } catch (sseErr) {
      console.warn('[DeferredGuidance] SSE broadcast failed:', sseErr.message);
    }
  }

  return result;
};

/**
 * Collect a specific data field for the deferred intent.
 * Called directly by the collect_deferred_data tool — bypasses CRM mapping entirely.
 *
 * @param {number} tenantId
 * @param {string} phone
 * @param {string} fieldKey - Must match a key from requiredData (e.g. 'hotel_preference')
 * @param {string} value - The collected value
 * @returns {Promise<{success: boolean, allCollected: boolean, remaining: string[]}>}
 */
export const collectData = async (tenantId, phone, fieldKey, value) => {
  const key = getKey(tenantId, phone);
  const intent = await getIntent(tenantId, phone);
  if (!intent) {
    return { success: false, error: 'no_intent', allCollected: false, remaining: [] };
  }

  // Find the matching field in requiredData
  const fieldIndex = intent.requiredData.findIndex(
    f => f.key.toLowerCase() === fieldKey.toLowerCase()
  );

  if (fieldIndex === -1) {
    // Fuzzy match: try partial match
    const fuzzyIndex = intent.requiredData.findIndex(
      f => f.key.toLowerCase().includes(fieldKey.toLowerCase()) ||
           fieldKey.toLowerCase().includes(f.key.toLowerCase())
    );
    if (fuzzyIndex === -1) {
      console.warn(`[DeferredGuidance] collectData: key "${fieldKey}" not found in requiredData for ${phone}`);
      return { success: false, error: 'key_not_found', allCollected: false, remaining: intent.requiredData.filter(f => !f.collected).map(f => f.label || f.key) };
    }
    // Use fuzzy match
    intent.requiredData[fuzzyIndex].collected = true;
    intent.collectedValues[intent.requiredData[fuzzyIndex].key] = value;
    console.log(`[DeferredGuidance] 📝 Collected (fuzzy match "${fieldKey}" → "${intent.requiredData[fuzzyIndex].key}"): "${value}" for ${phone}`);
  } else {
    intent.requiredData[fieldIndex].collected = true;
    intent.collectedValues[intent.requiredData[fieldIndex].key] = value;
    console.log(`[DeferredGuidance] 📝 Collected "${fieldKey}": "${value}" for ${phone}`);
  }

  const missingFields = intent.requiredData.filter(f => !f.collected);
  const allCollected = missingFields.length === 0;

  // Save updated intent back to Redis
  const ttl = await redisClient.ttl(key);
  await redisClient.setex(key, ttl > 0 ? ttl : INTENT_TTL, JSON.stringify(intent));

  // If all collected → auto-execute immediately
  if (allCollected) {
    console.log(`[DeferredGuidance] ⚡ All data collected via collectData for ${phone}! Auto-executing...`);
    const result = await executeIntent(tenantId, phone);
    return { success: true, allCollected: true, autoExecuted: true, requestId: result?.id, remaining: [] };
  }

  return {
    success: true,
    allCollected: false,
    remaining: missingFields.map(f => f.label || f.key)
  };
};

/**
 * Cancel the deferred intent — customer changed their mind or ghosted.
 */
export const cancelIntent = async (tenantId, phone) => {
  const key = getKey(tenantId, phone);
  const existed = await redisClient.del(key);
  if (existed) {
    console.log(`[DeferredGuidance] 🗑️ Intent cancelled for ${phone}`);
  }
  return !!existed;
};

/**
 * Check if an intent exists for this customer.
 */
export const hasIntent = async (tenantId, phone) => {
  const key = getKey(tenantId, phone);
  return !!(await redisClient.exists(key));
};

export default {
  createIntent,
  getIntent,
  refreshFromCrm,
  collectData,
  executeIntent,
  cancelIntent,
  hasIntent,
};
