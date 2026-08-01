/**
 * ================================================================
 * CM COPILOT SERVICE — AI Chat Room for Customer Management
 * ================================================================
 *
 * Mirip systemGuider.service.js, tapi untuk Customer Management.
 * Admin bisa berdiskusi dengan AI tentang request items customer
 * (booking, bargain, date, custom request).
 *
 * AI bisa:
 *   - Menampilkan summary request items
 *   - Mengkonfirmasi keputusan admin sebelum ceklis
 *   - Generate proceed card (summary + status per item)
 *   - Draft pesan untuk dikirim ke customer
 */

import prisma from '../../config/database.js';
import { executeFastJsonAI, executePlainAI } from './logic.service.js';
import { broadcast } from '../shared/sse.service.js';
import { sendText } from '../shared/messaging.service.js';
import { saveMessage } from '../shared/chat.service.js';

// ─── Helper: Get or Create Active CM ───────────────────────────
/**
 * Find an active (non-completed) CM record for a customer,
 * or create one if none exists.
 */
export const getOrCreateActiveCm = async (tenantId, phone, customerName, packageName) => {
  // Look for an active CM (not completed/canceled)
  let cm = await prisma.customerManagement.findFirst({
    where: {
      tenant_id: tenantId,
      phone,
      status: { notIn: ['completed', 'canceled'] }
    },
    orderBy: { updated_at: 'desc' }
  });

  if (!cm) {
    cm = await prisma.customerManagement.create({
      data: {
        tenant_id: tenantId,
        phone,
        customer_name: customerName || null,
        package_name: packageName || null,
        status: 'waiting_offer',
        created_at: new Date(),
        updated_at: new Date()
      }
    });
    console.log(`[CmCopilot] 📋 Created new CM #${cm.id} for ${phone}`);
  } else {
    // Update name/package if better data available
    const updates = {};
    const genericNames = ['----', 'pelanggan', 'kosong', '', null];
    if (customerName && genericNames.includes((cm.customer_name || '').toLowerCase().trim())) {
      updates.customer_name = customerName;
    }
    if (packageName && !cm.package_name) {
      updates.package_name = packageName;
    }
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date();
      cm = await prisma.customerManagement.update({
        where: { id: cm.id },
        data: updates
      });
    }
  }

  return cm;
};

// ─── Helper: Add Request Item to CM ────────────────────────────
/**
 * Add a new request item to the active CM for a customer.
 * Deduplicates by item_type + similar title.
 */
export const addRequestItem = async (tenantId, phone, itemType, title, detail, dataJson, customerName, packageName) => {
  const cm = await getOrCreateActiveCm(tenantId, phone, customerName, packageName);

  // Check for duplicate (same type + similar title within same CM)
  const existing = await prisma.cmRequestItem.findFirst({
    where: {
      tenant_id: tenantId,
      cm_id: cm.id,
      item_type: itemType,
      status: 'pending'
    }
  });

  if (existing) {
    // Update existing instead of creating duplicate
    const updated = await prisma.cmRequestItem.update({
      where: { id: existing.id },
      data: {
        title,
        detail: detail || existing.detail,
        data_json: dataJson || existing.data_json,
        updated_at: new Date()
      }
    });
    console.log(`[CmCopilot] 🔄 Updated existing request item #${updated.id} (${itemType}) in CM #${cm.id}`);
    return { cm, item: updated, isNew: false };
  }

  const item = await prisma.cmRequestItem.create({
    data: {
      tenant_id: tenantId,
      cm_id: cm.id,
      phone,
      item_type: itemType,
      title,
      detail: detail || null,
      data_json: dataJson || undefined,
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    }
  });

  // Update CM timestamp
  await prisma.customerManagement.update({
    where: { id: cm.id },
    data: { updated_at: new Date() }
  });

  console.log(`[CmCopilot] ➕ Added request item #${item.id} (${itemType}): "${title.substring(0, 80)}" to CM #${cm.id}`);

  // Broadcast to dashboard
  broadcast(tenantId, 'cm_item_added', {
    cm_id: cm.id,
    phone,
    item_id: item.id,
    item_type: itemType,
    title
  });

  return { cm, item, isNew: true };
};

// ─── Set Pending Question on CM Item ───────────────────────────
/**
 * Admin sets a question on a CmRequestItem that the AI CS should
 * ask the customer naturally in the next conversation turn.
 * Status changes to 'pending_question' so Stage 2 picks it up.
 */
export const setItemPendingQuestion = async (tenantId, cmId, itemId, question) => {
  if (!question || !question.trim()) {
    throw new Error('Pertanyaan tidak boleh kosong');
  }

  // Verify item belongs to this CM and tenant
  const item = await prisma.cmRequestItem.findFirst({
    where: { id: itemId, cm_id: cmId, tenant_id: tenantId }
  });
  if (!item) throw new Error('Request item tidak ditemukan');

  const updated = await prisma.cmRequestItem.update({
    where: { id: itemId },
    data: {
      status: 'pending_question',
      pending_question: question.trim(),
      question_answer: null,     // Reset previous answer if any
      question_asked_at: null,
      updated_at: new Date()
    }
  });

  // Broadcast so CM modal refreshes
  broadcast(tenantId, 'cm_item_updated', {
    cm_id: cmId,
    item_id: itemId,
    status: 'pending_question',
    pending_question: question.trim()
  });

  // Also create a chat card so AI in CM copilot knows
  await prisma.cmChat.create({
    data: {
      tenant_id: tenantId,
      cm_id: cmId,
      role: 'system',
      message: JSON.stringify({
        type: 'question_pending',
        item_id: itemId,
        title: item.title,
        question: question.trim()
      }),
      message_type: 'question_pending'
    }
  });

  console.log(`[CmCopilot] ❓ Pending question set on item #${itemId}: "${question.trim().substring(0, 80)}"`);
  return updated;
};

// ─── Get CM History ────────────────────────────────────────────
export const getCmHistory = async (tenantId, cmId) => {
  const cm = await prisma.customerManagement.findFirst({
    where: { id: cmId, tenant_id: tenantId },
    include: {
      cm_request_items: { orderBy: { created_at: 'asc' } },
      cm_chats: { orderBy: { created_at: 'asc' } }
    }
  });

  if (!cm) throw new Error('Customer Management record not found');

  // Enrich with lead data
  const lead = await prisma.lead.findUnique({
    where: { uk_tenant_phone: { tenant_id: tenantId, phone: cm.phone } },
    select: {
      saved_name: true, push_name: true, first_name: true, last_name: true,
      email: true, preferences: true, chat_summary: true, city: true,
      personal_notes: true, company_name: true, position_title: true,
      pipeline_status: true
    }
  });

  return {
    cm,
    items: cm.cm_request_items,
    chats: cm.cm_chats,
    lead: lead || null
  };
};

// ─── Build AI Context ──────────────────────────────────────────
const buildCmContext = async (cm, items, lead, chatHistory, tenantId) => {
  const customerName = cm.customer_name || lead?.saved_name || lead?.push_name || cm.phone;

  let context = `Anda adalah asisten AI untuk admin dalam mengelola request customer di Customer Management.\n`;
  context += `Anda sedang dalam chat room Customer Management dengan admin.\n\n`;

  context += `=== CUSTOMER INFO ===\n`;
  context += `Nama: ${customerName}\n`;
  context += `Phone: ${cm.phone}\n`;
  if (lead?.email) context += `Email: ${lead.email}\n`;
  if (lead?.city) context += `Kota: ${lead.city}\n`;
  if (lead?.company_name) context += `Perusahaan: ${lead.company_name}\n`;
  if (lead?.position_title) context += `Jabatan: ${lead.position_title}\n`;
  if (lead?.preferences) context += `Preferensi: ${lead.preferences}\n`;
  if (cm.package_name) context += `Paket: ${cm.package_name}\n`;
  context += `\n`;

  // ── CRITICAL: Chat Summary — AI's primary knowledge source ──
  if (lead?.chat_summary) {
    context += `=== RINGKASAN PERCAKAPAN DENGAN CUSTOMER ===\n`;
    context += `${lead.chat_summary}\n\n`;
  }

  // ── CRITICAL: Personal Notes — contains admin decisions & pricing info ──
  if (lead?.personal_notes) {
    context += `=== CATATAN PENTING ADMIN & KEPUTUSAN SEBELUMNYA ===\n`;
    context += `${lead.personal_notes}\n\n`;
  }

  // ── Order Form Data — confirmed pricing, booking details ──
  try {
    const orderForm = await prisma.orderForm.findFirst({
      where: { tenant_id: tenantId, phone: cm.phone },
      orderBy: { updated_at: 'desc' }
    });
    if (orderForm?.form_data) {
      try {
        const formData = typeof orderForm.form_data === 'string' ? JSON.parse(orderForm.form_data) : orderForm.form_data;
        const entries = Object.entries(formData).filter(([, v]) => v != null && v !== '' && v !== 'belum diisi');
        if (entries.length > 0) {
          context += `=== ORDER FORM DATA ===\n`;
          context += `Status: ${orderForm.status}\n`;
          for (const [k, v] of entries) {
            context += `${k}: ${v}\n`;
          }
          if (orderForm.ai_notes) context += `AI Notes: ${orderForm.ai_notes}\n`;
          context += `\n`;
        }
      } catch {}
    }
  } catch (err) {
    console.error('[CmCopilot] OrderForm load error:', err.message);
  }

  // ── Recent customer chat messages — last 15 for negotiation context ──
  try {
    const recentMessages = await prisma.message.findMany({
      where: { tenant_id: tenantId, phone: cm.phone },
      orderBy: { created_at: 'desc' },
      take: 15,
      select: { role: true, content: true, created_at: true }
    });
    if (recentMessages.length > 0) {
      context += `=== PERCAKAPAN TERAKHIR DI PLATFORM (WA/IG/Tele) ===\n`;
      for (const msg of recentMessages.reverse()) {
        const sender = msg.role === 'user' ? 'Customer' : msg.role === 'assistant' ? 'AI CS' : 'System';
        const time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
        // Truncate very long messages
        const content = (msg.content || '').substring(0, 300);
        context += `[${sender} ${time}]: ${content}\n`;
      }
      context += `\n`;
    }
  } catch (err) {
    console.error('[CmCopilot] Recent messages load error:', err.message);
  }

  // Request items
  context += `=== DAFTAR REQUEST ITEMS ===\n`;
  if (items.length === 0) {
    context += `(Belum ada request item)\n`;
  } else {
    for (const item of items) {
      const statusEmoji = item.status === 'approved' ? '✅' :
                          item.status === 'rejected' ? '❌' :
                          item.status === 'notes_added' ? '📝' :
                          item.status === 'pending_question' ? '❓' :
                          item.status === 'question_answered' ? '💬' : '⏳';
      const typeLabel = {
        booking_request: '📦 Booking',
        bargain_offer: '💰 Penawaran',
        date_request: '📅 Tanggal',
        custom_request: '📋 Request'
      }[item.item_type] || `📋 ${item.item_type}`;

      context += `${statusEmoji} [#${item.id}] ${typeLabel}: ${item.title}\n`;
      if (item.detail) context += `   Detail: ${item.detail}\n`;
      if (item.data_json) {
        try {
          const data = typeof item.data_json === 'string' ? JSON.parse(item.data_json) : item.data_json;
          const entries = Object.entries(data).filter(([, v]) => v != null && v !== '');
          if (entries.length > 0) {
            context += `   Data: ${entries.map(([k, v]) => `${k}=${v}`).join(', ')}\n`;
          }
        } catch {}
      }
      if (item.admin_decision) context += `   Keputusan Admin: ${item.admin_decision}\n`;
      if (item.pending_question) {
        context += `   ❓ Pertanyaan ke Customer: ${item.pending_question}\n`;
        if (item.question_answer) {
          context += `   💬 Jawaban Customer: ${item.question_answer}\n`;
        }
      }
      context += `\n`;
    }
  }

  // Chat history
  if (chatHistory && chatHistory.length > 0) {
    context += `\n=== RIWAYAT CHAT CM COPILOT ===\n`;
    const recentChats = chatHistory.slice(-20); // Last 20 messages
    for (const chat of recentChats) {
      const sender = chat.role === 'admin' ? 'Admin' : chat.role === 'ai' ? 'AI' : 'System';
      context += `[${sender}]: ${chat.message}\n`;
    }
  }

  // Instructions
  context += `\n=== INSTRUKSI ANDA ===\n`;
  context += `1. Anda membantu admin mengelola request-request dari customer ${customerName}.\n`;
  context += `2. GUNAKAN SELURUH DATA DI ATAS — jangan bilang "tidak ada info" kalau data sudah tersedia di ringkasan/catatan.\n`;
  context += `3. Jika admin menyetujui/menolak suatu request, WAJIB konfirmasi terlebih dahulu sebelum ceklis.\n`;
  context += `   Contoh: "Jadi request #1 (Booking Bali 47 pax) di-APPROVE ya Pak? Mohon konfirmasi."\n`;
  context += `4. Setelah admin konfirmasi (ya/oke/benar/setuju), jawab dengan JSON action:\n`;
  context += `   {"action":"update_item","item_id":1,"status":"approved","decision":"Disetujui oleh admin"}\n`;
  context += `   (Sistem akan otomatis membuat draft pesan ke customer jika semua request sudah tidak ada yang pending. Anda tidak perlu bertanya "langkah selanjutnya" jika semua item sudah selesai).\n`;
  context += `5. Jika admin bilang "proceed" atau "kirim ke customer" atau "follow up" (saat belum selesai semua):\n`;
  context += `   Jawab dengan JSON action:\n`;
  context += `   {"action":"proceed_card"}\n`;
  context += `6. Jawab dengan natural dan profesional. Jangan terlalu kaku.\n`;
  context += `7. Jika admin bertanya tentang data customer, jawab berdasarkan data di atas.\n`;
  context += `8. PENTING: Selalu akhiri respons teks Anda dengan baris terakhir berisi JSON action jika ada action yang perlu dilakukan.\n`;
  context += `   Jika tidak ada action, cukup jawab teks biasa tanpa JSON.\n`;

  return context;
};

// ─── Process CM Chat ───────────────────────────────────────────
export const processCmChat = async (tenantId, cmId, adminMessage) => {
  // Save admin message
  await prisma.cmChat.create({
    data: {
      tenant_id: tenantId,
      cm_id: cmId,
      role: 'admin',
      message: adminMessage,
      message_type: 'text',
      created_at: new Date()
    }
  });

  // Load context
  const cm = await prisma.customerManagement.findFirst({
    where: { id: cmId, tenant_id: tenantId },
    include: {
      cm_request_items: { orderBy: { created_at: 'asc' } },
      cm_chats: { orderBy: { created_at: 'asc' } }
    }
  });

  if (!cm) throw new Error('CM not found');

  const lead = await prisma.lead.findUnique({
    where: { uk_tenant_phone: { tenant_id: tenantId, phone: cm.phone } },
    select: {
      saved_name: true, push_name: true, first_name: true, last_name: true,
      email: true, preferences: true, chat_summary: true, city: true,
      personal_notes: true, company_name: true, position_title: true
    }
  });

  const context = await buildCmContext(cm, cm.cm_request_items, lead, cm.cm_chats, tenantId);

  // Call AI
  let aiResponse;
  try {
    aiResponse = await executePlainAI(tenantId, context, adminMessage, [], 'cm_copilot');
  } catch (err) {
    console.error('[CmCopilot] AI call failed:', err.message);
    aiResponse = 'Maaf, terjadi error saat memproses. Silakan coba lagi.';
  }

  // Parse potential JSON actions from AI response
  let cleanMessage = aiResponse;
  let messageType = 'text';
  let actionResult = null;

  // Check for JSON action in response
  const jsonMatch = aiResponse.match(/\{[\s\S]*"action"\s*:\s*"[^"]+"/);
  if (jsonMatch) {
    try {
      // Try to extract the JSON block
      const jsonStart = aiResponse.indexOf(jsonMatch[0]);
      let braceCount = 0;
      let jsonEnd = jsonStart;
      for (let i = jsonStart; i < aiResponse.length; i++) {
        if (aiResponse[i] === '{') braceCount++;
        if (aiResponse[i] === '}') braceCount--;
        if (braceCount === 0) { jsonEnd = i + 1; break; }
      }
      const jsonStr = aiResponse.substring(jsonStart, jsonEnd);
      const actionData = JSON.parse(jsonStr);

      // Extract text part (before JSON)
      cleanMessage = aiResponse.substring(0, jsonStart).trim();
      if (!cleanMessage) cleanMessage = null;

      if (actionData.action === 'update_item') {
        // Update item status
        const item = await prisma.cmRequestItem.findFirst({
          where: { id: actionData.item_id, tenant_id: tenantId, cm_id: cmId }
        });
        if (item) {
          await prisma.cmRequestItem.update({
            where: { id: item.id },
            data: {
              status: actionData.status || 'approved',
              admin_decision: actionData.decision || null,
              updated_at: new Date()
            }
          });
          actionResult = { updated: true, item_id: item.id, status: actionData.status };
          console.log(`[CmCopilot] ✅ Item #${item.id} updated to ${actionData.status}`);

          // Check if all items are resolved (approved or rejected)
          const allCmItems = await prisma.cmRequestItem.findMany({
            where: { tenant_id: tenantId, cm_id: cmId },
            orderBy: { created_at: 'asc' }
          });
          const resolvedStatuses = ['approved', 'rejected'];
          const remainingUnresolved = allCmItems.filter(i => !resolvedStatuses.includes(i.status));

          if (remainingUnresolved.length === 0 && allCmItems.length > 0) {
            console.log(`[CmCopilot] 🚀 All items resolved via AI chat, generating summary...`);
            const proceedRes = await executeProceed(tenantId, cmId, []);
            actionResult.auto_proceed = true;
            actionResult.draft = proceedRes.draft;
            actionResult.items = proceedRes.items;
            
            // Append friendly message
            cleanMessage = (cleanMessage || '') + '\n\n(Semua request telah selesai di-review. Saya sudah menyiapkan draft pesan untuk dikirim ke customer di bawah ini.)';
          }
        }
      } else if (actionData.action === 'proceed_card') {
        messageType = 'action_card';
        const proceedRes = await executeProceed(tenantId, cmId, []);
        actionResult = { 
          action: 'proceed_card', 
          items: proceedRes.items,
          draft: proceedRes.draft
        };
        cleanMessage = cleanMessage || 'Berikut draft pesan untuk customer:';
      }
    } catch (e) {
      // JSON parse failed, keep original message
      cleanMessage = aiResponse;
    }
  }

  // Save AI response
  const savedChat = await prisma.cmChat.create({
    data: {
      tenant_id: tenantId,
      cm_id: cmId,
      role: 'ai',
      message: cleanMessage || aiResponse,
      message_type: messageType,
      created_at: new Date()
    }
  });

  // Broadcast update
  broadcast(tenantId, 'cm_chat_message', {
    cm_id: cmId,
    chat: savedChat,
    action: actionResult
  });

  return {
    message: cleanMessage || aiResponse,
    type: messageType,
    action: actionResult,
    chat_id: savedChat.id
  };
};

// ─── Update Item Status (manual by admin) ──────────────────────
export const updateItemStatus = async (tenantId, cmId, itemId, status, decision) => {
  const item = await prisma.cmRequestItem.findFirst({
    where: { id: itemId, tenant_id: tenantId, cm_id: cmId }
  });

  if (!item) throw new Error('Item not found');

  const updated = await prisma.cmRequestItem.update({
    where: { id: item.id },
    data: {
      status,
      admin_decision: decision || null,
      updated_at: new Date()
    }
  });

  // Build structured status update message for chat UI
  const statusLabel = status === 'approved' ? '✅ Disetujui' :
                      status === 'rejected' ? '❌ Ditolak' :
                      status === 'notes_added' ? '📝 Dicatat' : status;

  const typeLabel = {
    booking_request: '📦 Booking', bargain_offer: '💰 Penawaran',
    date_request: '📅 Tanggal', custom_request: '📋 Request'
  }[item.item_type] || `📋 ${item.item_type}`;

  // Save as structured status_update for rich card rendering
  const statusUpdateData = JSON.stringify({
    item_id: item.id,
    item_type: item.item_type,
    type_label: typeLabel,
    title: item.title,
    status,
    status_label: statusLabel,
    decision: decision || null
  });

  const chatMsg = await prisma.cmChat.create({
    data: {
      tenant_id: tenantId,
      cm_id: cmId,
      role: 'system',
      message: statusUpdateData,
      message_type: 'status_update',
      created_at: new Date()
    }
  });

  // Broadcast item update + chat message to frontend
  broadcast(tenantId, 'cm_item_updated', {
    cm_id: cmId,
    item_id: itemId,
    status,
    decision
  });

  broadcast(tenantId, 'cm_chat_message', {
    cm_id: cmId,
    chat: chatMsg,
    action: null
  });

  // Check if all items are now resolved (approved or rejected)
  // notes_added is NOT considered resolved — owner still needs to make a final decision
  const allItems = await prisma.cmRequestItem.findMany({
    where: { tenant_id: tenantId, cm_id: cmId },
    orderBy: { created_at: 'asc' }
  });

  const resolvedStatuses = ['approved', 'rejected'];
  const pendingItems = allItems.filter(i => !resolvedStatuses.includes(i.status));
  const allResolved = pendingItems.length === 0 && allItems.length > 0;

  let decisionSummary = null;
  let autoDraft = null;

  if (allResolved) {
    // All items have been decided — generate decision summary card
    decisionSummary = await generateDecisionSummary(tenantId, cmId, allItems);
    
    // Generate the proceed draft automatically so the admin can send it
    console.log(`[CmCopilot] 🚀 All items manually resolved, generating auto-draft...`);
    const proceedRes = await executeProceed(tenantId, cmId, []);
    autoDraft = proceedRes.draft;
  }

  return {
    item: updated,
    chat_message: chatMsg,
    all_resolved: allResolved,
    pending_count: pendingItems.length,
    total_count: allItems.length,
    decision_summary: decisionSummary,
    draft: autoDraft
  };
};

// ─── Generate Decision Summary Card ────────────────────────────
/**
 * When all request items are resolved (approved/rejected),
 * generate a summary card showing all decisions.
 */
const generateDecisionSummary = async (tenantId, cmId, items) => {
  const summaryItems = items.map(item => {
    const typeLabel = {
      booking_request: '📦 Booking', bargain_offer: '💰 Penawaran',
      date_request: '📅 Tanggal', custom_request: '📋 Request'
    }[item.item_type] || `📋 ${item.item_type}`;

    return {
      id: item.id,
      item_type: item.item_type,
      type_label: typeLabel,
      title: item.title,
      status: item.status,
      decision: item.admin_decision || null
    };
  });

  const summaryData = JSON.stringify({
    items: summaryItems,
    all_resolved: true,
    resolved_at: new Date().toISOString(),
    approved_count: items.filter(i => i.status === 'approved').length,
    rejected_count: items.filter(i => i.status === 'rejected').length,
    total_count: items.length
  });

  const chatMsg = await prisma.cmChat.create({
    data: {
      tenant_id: tenantId,
      cm_id: cmId,
      role: 'system',
      message: summaryData,
      message_type: 'decision_summary',
      created_at: new Date()
    }
  });

  // Mark CM as completed
  await prisma.customerManagement.update({
    where: { id: cmId },
    data: {
      status: 'completed',
      updated_at: new Date()
    }
  });

  // Broadcast completion
  broadcast(tenantId, 'cm_completed', { cm_id: cmId });
  broadcast(tenantId, 'cm_chat_message', {
    cm_id: cmId,
    chat: chatMsg,
    action: null
  });

  console.log(`[CmCopilot] 🎉 All items resolved for CM #${cmId} — session completed`);

  return {
    chat: chatMsg,
    items: summaryItems
  };
};

// ─── Execute Proceed (send to customer) ────────────────────────
export const executeProceed = async (tenantId, cmId, itemDecisions) => {
  const cm = await prisma.customerManagement.findFirst({
    where: { id: cmId, tenant_id: tenantId },
    include: {
      cm_request_items: { orderBy: { created_at: 'asc' } }
    }
  });

  if (!cm) throw new Error('CM not found');

  // Apply final decisions from admin
  if (itemDecisions && itemDecisions.length > 0) {
    for (const dec of itemDecisions) {
      await prisma.cmRequestItem.updateMany({
        where: { id: dec.id, tenant_id: tenantId, cm_id: cmId },
        data: {
          status: dec.status,
          admin_decision: dec.decision || null,
          updated_at: new Date()
        }
      });
    }
  }

  // Reload items with updated statuses
  const items = await prisma.cmRequestItem.findMany({
    where: { tenant_id: tenantId, cm_id: cmId },
    orderBy: { created_at: 'asc' }
  });

  // Build AI prompt to draft customer message
  const lead = await prisma.lead.findUnique({
    where: { uk_tenant_phone: { tenant_id: tenantId, phone: cm.phone } },
    select: { saved_name: true, push_name: true, chat_summary: true, personal_notes: true }
  });

  const customerName = cm.customer_name || lead?.saved_name || lead?.push_name || 'Kak';

  let draftPrompt = `Anda adalah konsultan perjalanan yang ramah dan profesional. Buatlah pesan WhatsApp yang natural dan hangat untuk customer "${customerName}" berdasarkan keputusan berikut:\n\n`;

  for (const item of items) {
    const statusLabel = item.status === 'approved' ? 'DISETUJUI' :
                        item.status === 'rejected' ? 'DITOLAK' :
                        item.status === 'notes_added' ? 'PERLU CATATAN' : 'PENDING';
    
    const typeLabel = {
      booking_request: 'Booking',
      bargain_offer: 'Penawaran Harga',
      date_request: 'Permintaan Tanggal',
      custom_request: 'Request Khusus'
    }[item.item_type] || item.item_type;

    draftPrompt += `- ${typeLabel}: ${item.title} → ${statusLabel}`;
    if (item.admin_decision) draftPrompt += ` (${item.admin_decision})`;
    draftPrompt += `\n`;
  }

  if (lead?.chat_summary) {
    draftPrompt += `\n=== RINGKASAN PERCAKAPAN SEBELUMNYA ===\n`;
    draftPrompt += `${lead.chat_summary}\n`;
  }

  if (lead?.personal_notes) {
    draftPrompt += `\n=== CATATAN PENTING & KEPUTUSAN ADMIN ===\n`;
    draftPrompt += `${lead.personal_notes}\n`;
  }

  draftPrompt += `\nATURAN:\n`;
  draftPrompt += `- Sampaikan setiap keputusan dengan sopan dan jelas.\n`;
  draftPrompt += `- Untuk yang DITOLAK, sampaikan dengan HALUS (jangan gunakan kata "ditolak", gunakan "belum bisa" atau "alternatif").\n`;
  draftPrompt += `- Untuk yang DISETUJUI, sampaikan dengan antusias.\n`;
  draftPrompt += `- Jangan terlalu panjang. Maksimal 5-6 kalimat.\n`;
  draftPrompt += `- Gunakan emoji secukupnya.\n`;
  draftPrompt += `- Akhiri dengan langkah selanjutnya atau pertanyaan follow-up.\n`;

  let draftMessage;
  try {
    draftMessage = await executePlainAI(
      tenantId,
      'Anda adalah konsultan perjalanan profesional yang ramah.',
      draftPrompt,
      [],
      'cm_copilot'
    );
  } catch (err) {
    console.error('[CmCopilot] Draft generation failed:', err.message);
    draftMessage = `Halo ${customerName}! Berikut update terkait request Anda:\n\n` +
      items.map(item => {
        const emoji = item.status === 'approved' ? '✅' : item.status === 'rejected' ? '❌' : '📝';
        return `${emoji} ${item.title}: ${item.admin_decision || item.status}`;
      }).join('\n') +
      `\n\nMohon info jika ada pertanyaan ya! 😊`;
  }

  // Save proceed action to chat
  await prisma.cmChat.create({
    data: {
      tenant_id: tenantId,
      cm_id: cmId,
      role: 'system',
      message: `[PROCEED] Admin memulai pengiriman keputusan ke customer. Draft: ${draftMessage.substring(0, 200)}...`,
      message_type: 'system',
      created_at: new Date()
    }
  });

  return {
    draft: draftMessage,
    items: items.map(i => ({
      id: i.id,
      title: i.title,
      item_type: i.item_type,
      status: i.status,
      admin_decision: i.admin_decision
    }))
  };
};

// ─── Send Proceed Message to Customer ──────────────────────────
export const sendProceedToCustomer = async (tenantId, cmId, finalMessage) => {
  const cm = await prisma.customerManagement.findFirst({
    where: { id: cmId, tenant_id: tenantId }
  });

  if (!cm) throw new Error('CM not found');

  // Send via WhatsApp
  const saved = await saveMessage(prisma, cm.phone, 'assistant', finalMessage, tenantId);
  await sendText(prisma, cm.phone, finalMessage, { tenantId });

  // Broadcast new message
  broadcast(tenantId, 'new_message', {
    phone: cm.phone,
    message: finalMessage,
    role: 'assistant',
    timestamp: new Date().toISOString(),
    created_at: new Date().toISOString(),
    id: saved?.id ?? null
  });

  // Save info to lead personal_notes for AI memory
  try {
    const items = await prisma.cmRequestItem.findMany({
      where: { tenant_id: tenantId, cm_id: cmId },
      orderBy: { created_at: 'asc' }
    });

    const decisionSummary = items.map(i => {
      const statusLabel = i.status === 'approved' ? '✅ Approved' :
                          i.status === 'rejected' ? '❌ Rejected' : '📝 Noted';
      return `${i.item_type}: ${i.title} → ${statusLabel}${i.admin_decision ? ` (${i.admin_decision})` : ''}`;
    }).join('; ');

    const lead = await prisma.lead.findUnique({
      where: { uk_tenant_phone: { tenant_id: tenantId, phone: cm.phone } },
      select: { personal_notes: true }
    });

    const timestamp = new Date().toLocaleString('id-ID');
    const noteEntry = `\n[CM Proceed ${timestamp}] ${decisionSummary}`;
    const existingNotes = lead?.personal_notes || '';

    await prisma.lead.update({
      where: { uk_tenant_phone: { tenant_id: tenantId, phone: cm.phone } },
      data: {
        personal_notes: existingNotes + noteEntry,
        last_message_preview: finalMessage.substring(0, 500),
        last_ai_reply: finalMessage.substring(0, 2000),
        last_message_at: new Date(),
        last_ai_reply_at: new Date()
      }
    });
  } catch (err) {
    console.error('[CmCopilot] Failed to save decision to lead notes:', err.message);
  }

  // Update CM status
  await prisma.customerManagement.update({
    where: { id: cmId },
    data: {
      status: 'completed',
      updated_at: new Date()
    }
  });

  // Log in CM chat
  await prisma.cmChat.create({
    data: {
      tenant_id: tenantId,
      cm_id: cmId,
      role: 'system',
      message: `✅ Pesan berhasil dikirim ke customer: "${finalMessage.substring(0, 200)}..."`,
      message_type: 'system',
      created_at: new Date()
    }
  });

  broadcast(tenantId, 'cm_proceed_sent', { cm_id: cmId, phone: cm.phone });
  broadcast(tenantId, 'lead_updated', {
    phone: cm.phone,
    last_message_preview: finalMessage.substring(0, 500),
    last_message_at: new Date().toISOString()
  });

  console.log(`[CmCopilot] ✅ Proceed message sent to ${cm.phone} for CM #${cmId}`);

  return { success: true, phone: cm.phone };
};
