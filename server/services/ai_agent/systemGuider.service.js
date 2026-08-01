/**
 * ================================================================
 * SYSTEM GUIDER SERVICE — Admin ↔ AI Chat for Customer Guidance
 * ================================================================
 * 
 * Ketika AI tidak punya informasi atau butuh arahan admin,
 * admin bisa berdiskusi dengan AI melalui System Guider.
 * 
 * AI punya akses ke:
 *   - Customer chat history (15 pesan terakhir + summarization + vector)
 *   - Dynamic form (order form aktif)
 *   - KB & Inventory (vector search + deep read)
 *   - CRM data (Lead, CustomerManagement, transactions)
 *   - Original question (dari CentralInfoRequest)
 * 
 * Memory System:
 *   - 15 pesan terakhir dari SystemGuiderChat
 *   - Pesan pertama (context awal)
 *   - chat_summary (rolling summarization)
 * 
 * Instruction Flow:
 *   1. Admin kirim instruksi → AI detect + buat to-do
 *   2. AI kirim to-do card → Admin review
 *   3. Admin "Proceed" → Auto-execute ke customer chat
 * ================================================================
 */

import prisma from '../../config/database.js';
import { executeFastJsonAI, executePlainAI } from './logic.service.js';
import { sendText } from '../shared/messaging.service.js';
import { saveMessage } from '../shared/chat.service.js';
import { broadcast } from '../shared/sse.service.js';
import { getPipelineProgress } from './pipelineProgress.service.js';

// ============================================================
// CONTEXT LOADER — Build full customer context for AI
// ============================================================

const buildCustomerContext = async (tenantId, phone) => {
  const parts = [];

  // 1. Lead profile
  const lead = await prisma.lead.findFirst({
    where: { tenant_id: tenantId, phone },
    select: {
      id: true, saved_name: true, push_name: true, first_name: true, last_name: true,
      email: true, preferences: true, chat_summary: true, active_topics: true,
      status: true, label: true, pipeline_status: true, personal_notes: true, city: true
    }
  });
  if (lead) {
    const name = lead.saved_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.phone;
    parts.push(`[PROFIL PELANGGAN]
Nama: ${name}
Phone: ${phone}
Email: ${lead.email || '-'}
Status: ${lead.status || '-'} | Label: ${lead.label || '-'}
Kota: ${lead.city || '-'}
Preferensi: ${lead.preferences || '-'}
Catatan Pribadi: ${lead.personal_notes || '-'}
Active Topics: ${lead.active_topics || '-'}`);
    
    if (lead.chat_summary) {
      parts.push(`[RINGKASAN CHAT CUSTOMER]\n${lead.chat_summary}`);
    }
  }

  // 2. Recent chat history (15 messages)
  const recentChats = await prisma.chatHistory.findMany({
    where: { tenant_id: tenantId, user_phone: phone },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    take: 15,
    select: { role: true, message: true, created_at: true }
  });
  if (recentChats.length > 0) {
    const chatText = [...recentChats].reverse().map(c => 
      `[${c.role.toUpperCase()}] ${c.message.substring(0, 300)}`
    ).join('\n');
    parts.push(`[15 PESAN TERAKHIR CUSTOMER]\n${chatText}`);
  }

  // 3. Active order form
  const form = await prisma.orderForm.findFirst({
    where: { tenant_id: tenantId, phone, status: { in: ['collecting', 'pending_confirm'] } },
    orderBy: { updated_at: 'desc' }
  });
  if (form) {
    const formData = JSON.parse(form.form_data || '{}');
    const formEntries = Object.entries(formData).filter(([, v]) => v && v !== '');
    parts.push(`[FORM PESANAN AKTIF — Status: ${form.status}]\n${
      formEntries.length > 0 
        ? formEntries.map(([k, v]) => `- ${k}: ${v}`).join('\n')
        : '(Belum ada data)'
    }`);
  }

  // 4. CustomerManagement (CRM pipeline)
  let cm = null;
  try {
    cm = await prisma.customerManagement.findFirst({
      where: {
        tenant_id: tenantId,
        phone,
        NOT: [{ status: 'completed' }, { status: 'canceled' }, { status: 'cancelled' }]
      },
      orderBy: { updated_at: 'desc' }
    });
  } catch { /* ignore if schema doesn't support this query */ }
  if (cm) {
    const collectedData = cm.collected_data ? JSON.parse(cm.collected_data) : {};
    parts.push(`[STATUS CRM]
Paket: ${cm.package_name || '-'}
Tanggal Diminta: ${cm.requested_date ? cm.requested_date.toISOString().split('T')[0] : '-'}
Date Status: ${cm.date_status || '-'}
Status CRM: ${cm.status || '-'}
Data Terkumpul: ${JSON.stringify(collectedData)}
Catatan Admin: ${cm.admin_note || '-'}`);
  }

  // 5. Recent bookings/transactions
  const bookings = await prisma.travelBooking.findMany({
    where: { tenant_id: tenantId, phone },
    orderBy: { created_at: 'desc' },
    take: 3,
    select: { package_name: true, departure_date: true, pax_count: true, total_price: true, status: true, payment_status: true }
  });
  if (bookings.length > 0) {
    parts.push(`[RIWAYAT BOOKING]\n${bookings.map(b => 
      `- ${b.package_name} | ${b.departure_date ? b.departure_date.toISOString().split('T')[0] : '-'} | ${b.pax_count} pax | Rp${Number(b.total_price || 0).toLocaleString('id-ID')} | ${b.status}/${b.payment_status}`
    ).join('\n')}`);
  }

  return parts.join('\n\n');
};

// ============================================================
// MEMORY SYSTEM — Build guider chat memory
// ============================================================

const buildGuiderMemory = async (tenantId, requestId) => {
  // Get all guider chats for this request
  const allChats = await prisma.systemGuiderChat.findMany({
    where: { tenant_id: tenantId, request_id: requestId, role: { notIn: ['system'] } },
    orderBy: { created_at: 'asc' }
  });

  if (allChats.length === 0) return { recentMessages: [], firstMessage: null, summary: null };

  // First message
  const firstMessage = allChats[0];

  // Last 15 messages
  const recentMessages = allChats.slice(-15).map(c => ({
    role: c.role,
    message: c.message,
    type: c.message_type
  }));

  // Get summary from CentralInfoRequest
  const request = await prisma.centralInfoRequest.findUnique({
    where: { id: requestId },
    select: { chat_summary: true }
  });

  return {
    recentMessages,
    firstMessage: firstMessage ? { role: firstMessage.role, message: firstMessage.message } : null,
    summary: request?.chat_summary || null,
    totalMessages: allChats.length
  };
};

// ============================================================
// BACKGROUND SUMMARIZATION
// ============================================================

const triggerGuiderSummarization = async (tenantId, requestId) => {
  try {
    const chats = await prisma.systemGuiderChat.findMany({
      where: { tenant_id: tenantId, request_id: requestId, role: { notIn: ['system'] } },
      orderBy: { created_at: 'asc' }
    });

    if (chats.length === 0 || chats.length % 5 !== 0) return;

    const request = await prisma.centralInfoRequest.findUnique({
      where: { id: requestId },
      select: { chat_summary: true, questions: true }
    });

    const existingSummary = request?.chat_summary || '(Belum ada ringkasan)';
    const chatText = chats.map(c => `[${c.role.toUpperCase()}]: ${c.message}`).join('\n');

    const summaryPrompt = `Anda bertugas meringkas percakapan antara Admin dan AI Guider tentang penanganan customer.
Topik awal: "${request?.questions || '-'}"

Ringkasan Lama: "${existingSummary}"

Percakapan Lengkap:
${chatText}

Buat ringkasan baru yang menggabungkan ringkasan lama + percakapan baru. Fokus pada:
- Keputusan yang diambil admin
- Instruksi yang diberikan
- Informasi penting yang ditemukan
- Status terkini penanganan

Format JSON: {"chat_summary": "ringkasan"}`;

    const result = await executeFastJsonAI(tenantId, summaryPrompt, 'Update ringkasan.', [], 'system_guider');
    if (result?.chat_summary) {
      await prisma.centralInfoRequest.update({
        where: { id: requestId },
        data: { chat_summary: result.chat_summary, updated_at: new Date() }
      });
      console.log(`[SystemGuider] ✅ Summary updated for request #${requestId}`);
    }
  } catch (err) {
    console.error(`[SystemGuider] Summarization error:`, err.message);
  }
};

// ============================================================
// MAIN CHAT ENGINE
// ============================================================

export const processGuiderChat = async (tenantId, requestId, adminMessage) => {
  try {
    // 1. Fetch the CentralInfoRequest
    const request = await prisma.centralInfoRequest.findFirst({
      where: { id: requestId, tenant_id: tenantId }
    });
    if (!request) throw new Error('Request not found');

    // 2. Save admin message
    await prisma.systemGuiderChat.create({
      data: {
        tenant_id: tenantId,
        request_id: requestId,
        role: 'admin',
        message: adminMessage,
        message_type: 'text'
      }
    });

    // 3. Build full context
    const [customerContext, memory] = await Promise.all([
      buildCustomerContext(tenantId, request.phone),
      buildGuiderMemory(tenantId, requestId)
    ]);

    // 4. Check for pending todos
    const pendingTodos = await prisma.systemGuiderTodo.findMany({
      where: { tenant_id: tenantId, request_id: requestId, status: 'pending' },
      orderBy: { created_at: 'desc' }
    });

    // 5. Build system prompt
    const systemPrompt = `Anda adalah AI Assistant yang membantu Admin/Owner menangani pertanyaan atau kebutuhan pelanggan yang Anda (sebagai AI CS) tidak bisa jawab sendiri.

[KONTEKS PERMINTAAN AWAL]
📋 Laporan AI CS (ini adalah ringkasan masalah dari AI, BUKAN kutipan mentah customer):
"${request.questions}"

⚠️ CATATAN PENTING: Teks di atas adalah laporan AI CS yang menjelaskan masalah secara ringkas. Jika laporan ini kurang jelas, gunakan konteks percakapan di bawah untuk memahami lebih lengkap.

Konteks percakapan saat itu:
${request.conversation_context ? request.conversation_context.substring(0, 1500) : '(tidak ada)'}

AI Notes:
${request.ai_notes || '(tidak ada)'}

${customerContext}

${memory.summary ? `[RINGKASAN DISKUSI SEBELUMNYA]\n${memory.summary}` : ''}

${pendingTodos.length > 0 ? `[TO-DO PENDING]
${pendingTodos.map(t => `- [${t.status}] ${t.instruction}`).join('\n')}` : ''}

${(() => {
  const fields = Array.isArray(request.required_info) ? request.required_info : [];
  if (fields.length === 0) return '';
  const answeredCount = fields.filter(f => f.answered).length;
  const lines = fields.map(f => f.answered
    ? `✅ [key: ${f.key}] ${f.label}: "${f.value}"`
    : `❌ [key: ${f.key}] ${f.label}: (belum dijawab admin)`);
  return `[FORM INFO YANG PERLU DIJAWAB ADMIN — ${answeredCount}/${fields.length} terjawab]
${lines.join('\n')}

⚡ ATURAN FILL_FIELD (WAJIB DIIKUTI):
- SEGERA sisipkan [FILL_FIELD] di pesan kamu SETIAP KALI admin menjawab salah satu field di atas
- Gunakan key persis seperti yang tercantum di [key: xxx] di atas
- Format: [FILL_FIELD]{"key": "nama_key_persis", "value": "jawaban persis dari admin"}[/FILL_FIELD]
- Untuk beberapa field sekaligus: sisipkan SATU [FILL_FIELD] per field
- JANGAN tunda pengisian field — fill LANGSUNG di pesan yang sama saat admin memberikan jawaban
- Setelah fill, ucapkan konfirmasi: "✅ Saya catat: [label] = [value]"

Contoh: Admin bilang "harga bintang 3 itu 75 juta untuk 57 pax"
→ Sisipkan: [FILL_FIELD]{"key": "harga_paket", "value": "Rp 75.000.000 untuk 57 pax hotel Bintang 3"}[/FILL_FIELD]`;
})()
}


1. Anda berdiskusi dengan ADMIN tentang cara menangani customer ini.
2. Anda punya akses ke data customer: chat history, form pesanan, CRM, booking.
3. Jika admin BERTANYA tentang customer (isi chat, status, dll) → jawab dari data yang ada.
4. Jika admin memberikan INSTRUKSI atau JAWABAN PASTI (harga, ketersediaan, keputusan) → LANGSUNG emit TODO_CARD. JANGAN tanya konfirmasi "benar pak/bu?" terlebih dahulu.
5. Jika admin mengirim konfirmasi singkat ("iya", "ya", "benar", "betul", "oke", "lanjut", "ok", "yep", "yep", "yes") SETELAH kamu merangkum → LANGSUNG emit TODO_CARD berdasarkan rangkuman sebelumnya. JANGAN tanya ulang.

⚠️ CRITICAL — LARANGAN KERAS:
- DILARANG menanya "Benar Pak/Bu?" setelah admin sudah bilang "iya/ya/benar/oke"
- DILARANG merangkum ulang setelah admin konfirmasi — langsung TODO_CARD
- DILARANG meminta konfirmasi lebih dari SATU kali untuk instruksi yang sama
- Jika admin sudah konfirmasi → TODO_CARD langsung, tidak perlu teks tambahan apapun

6. ⚠️ CRITICAL — TODO harus berisi APA YANG DISAMPAIKAN/DILAKUKAN KE CUSTOMER, bukan koordinasi internal:
   - ❌ SALAH: "Koordinasikan dengan tim untuk quotation"
   - ❌ SALAH: "Siapkan opsi hotel bintang 3/4/5"
   - ✅ BENAR: "Sampaikan ke Kak Rizky: untuk 57 pax tersedia hotel Bintang 3, harga total Rp 75.000.000"
   - ✅ BENAR: "Informasikan customer bahwa paket Pesona Bali 4H3M untuk 43 pax harga Rp X sudah include transport"
7. ⚠️ CRITICAL — JANGAN copy dari [TO-DO PENDING] ketika admin sudah beri jawaban baru.

FLOW YANG BENAR:
- Admin: "untuk 57 pax hanya bintang 3, harga 75 juta" → AI langsung emit TODO_CARD (info sudah cukup, tidak perlu tanya konfirmasi)
- Admin: "sampaikan ke customer harga 70 juta" → AI langsung emit TODO_CARD
- Admin: "iya" / "ya" / "benar" / "oke" → AI langsung emit TODO_CARD berdasarkan diskusi sebelumnya

FLOW YANG SALAH (JANGAN LAKUKAN):
- Admin: "harga 70 juta" → AI: "Jadi saya akan sampaikan... Benar pak?" → Admin: "iya" → AI: "Baik! Jadi saya akan sampaikan... Benar pak?" ← LOOP! DILARANG!

8. Jawab dengan bahasa santai tapi profesional.

[FORMAT INSTRUKSI → TODO_CARD]
Ketika admin sudah memberikan JAWABAN PASTI atau KONFIRMASI:
[TODO_CARD]
{"items": ["instruksi spesifik untuk CS"], "summary": "ringkasan singkat"}
[/TODO_CARD]

[FORMAT FOLLOW-UP KE CUSTOMER → NEED_INFO_CARD]
Ketika admin bertanya sesuatu yang JAWABANNYA ADA DI CUSTOMER (bukan di admin), atau admin bilang "tanya dulu", "cek ke customer":
[NEED_INFO_CARD]
{"questions": [{"key": "company_name", "question": "Dari perusahaan mana?"}, {"key": "hotel_pref", "question": "Preferensi hotel bintang berapa?"}], "summary": "Ringkasan singkat kenapa info ini dibutuhkan"}
[/NEED_INFO_CARD]

Setelah emit NEED_INFO_CARD, JANGAN langsung bertanya "ada yang lain?" — cukup tampilkan card dan tunggu admin klik Proceed atau kirim revisi.
Key harus unik dan deskriptif (snake_case). Question harus natural dan sopan.

PENTING:
- TODO_CARD = untuk instruksi/jawaban yang LANGSUNG disampaikan ke customer sekarang
- NEED_INFO_CARD = untuk pertanyaan yang AI akan tanyakan ke customer secara PROAKTIF (AI langsung follow up, tidak menunggu customer chat duluan)
- items dalam TODO_CARD adalah array of STRINGS
- Setiap item harus dimulai dengan action word: "Sampaikan ke customer...", "Informasikan bahwa...", dll.`;


    // 6. Build messages array
    const messages = [];
    if (memory.firstMessage && memory.recentMessages.length > 15) {
      messages.push({ role: memory.firstMessage.role === 'admin' ? 'user' : 'assistant', content: memory.firstMessage.message });
    }
    for (const msg of memory.recentMessages) {
      messages.push({
        role: msg.role === 'admin' ? 'user' : 'assistant',
        content: msg.message
      });
    }
    // Add current admin message
    messages.push({ role: 'user', content: adminMessage });

    // 7. Call AI
    const aiResponse = await executePlainAI(tenantId, systemPrompt, adminMessage, [], 'system_guider');

    if (!aiResponse) {
      const errorMsg = 'Maaf, saya gagal memproses permintaan saat ini. Coba lagi.';
      await prisma.systemGuiderChat.create({
        data: { tenant_id: tenantId, request_id: requestId, role: 'ai', message: errorMsg, message_type: 'text' }
      });
      return { success: true, message: errorMsg, type: 'text', todos: [] };
    }

    // 8a. Parse [FILL_FIELD] tags — update required_info fields in DB
    const fillFieldMatches = [...aiResponse.matchAll(/\[FILL_FIELD\]\s*([\s\S]*?)\s*\[\/FILL_FIELD\]/gi)];
    if (fillFieldMatches.length > 0 && Array.isArray(request.required_info)) {
      try {
        const updatedFields = [...request.required_info];
        for (const match of fillFieldMatches) {
          const fill = JSON.parse(match[1].trim());
          const idx = updatedFields.findIndex(f => f.key === fill.key);
          if (idx !== -1 && fill.value) {
            updatedFields[idx] = { ...updatedFields[idx], value: fill.value, answered: true };
            console.log(`[SystemGuider] Filled field '${fill.key}' = '${fill.value}' for request #${requestId}`);
          }
        }
        await prisma.centralInfoRequest.update({
          where: { id: requestId },
          data: { required_info: updatedFields, updated_at: new Date() }
        });
        // Refresh request object
        request.required_info = updatedFields;
      } catch (fillErr) {
        console.error('[SystemGuider] Failed to parse FILL_FIELD:', fillErr.message);
      }
    }

    // 8b. Parse response — check for TODO_CARD
    const todoCardMatch = aiResponse.match(/\[TODO_CARD\]\s*([\s\S]*?)\s*\[\/TODO_CARD\]/i);
    let responseType = 'text';
    let cleanMessage = aiResponse;
    let todoItems = [];

    if (todoCardMatch) {
      responseType = 'todo_card';
      try {
        const todoData = JSON.parse(todoCardMatch[1].trim());
        todoItems = todoData.items || [];
        
        // Cancel old pending todos — mereka sudah tidak relevan karena admin kirim info baru
        const cancelledCount = await prisma.systemGuiderTodo.updateMany({
          where: { tenant_id: tenantId, request_id: requestId, status: 'pending' },
          data: { status: 'cancelled', result: 'Digantikan oleh instruksi baru dari admin.' }
        });
        if (cancelledCount.count > 0) {
          console.log(`[SystemGuider] Cancelled ${cancelledCount.count} stale todos for request #${requestId}`);
        }

        // Save new todos to DB — items can be string[] or {instruction: string}[]
        for (const item of todoItems) {
          const instruction = typeof item === 'string' ? item : (item.instruction || item.text || JSON.stringify(item));
          if (!instruction) continue;
          await prisma.systemGuiderTodo.create({
            data: {
              tenant_id: tenantId,
              request_id: requestId,
              phone: request.phone,
              instruction,
              ai_confirmation: todoData.summary || null,
              status: 'pending'
            }
          });
        }

        // Clean message: remove TODO_CARD block AND FILL_FIELD tags, keep surrounding text
        cleanMessage = aiResponse
          .replace(/\[TODO_CARD\][\s\S]*?\[\/TODO_CARD\]/gi, '')
          .replace(/\[FILL_FIELD\][\s\S]*?\[\/FILL_FIELD\]/gi, '')
          .trim();
        if (!cleanMessage) {
          cleanMessage = `✅ To-do sudah dibuat (${todoItems.length} instruksi). Klik "Proceed" untuk eksekusi ke customer.`;
        }
      } catch (parseErr) {
        console.error('[SystemGuider] Failed to parse TODO_CARD:', parseErr.message, '| Raw:', todoCardMatch[1].substring(0, 200));
        responseType = 'text';
        // Still try to clean the tag even if parse fails
        cleanMessage = aiResponse
          .replace(/\[TODO_CARD\][\s\S]*?\[\/TODO_CARD\]/gi, '[Todo card gagal diproses]')
          .replace(/\[FILL_FIELD\][\s\S]*?\[\/FILL_FIELD\]/gi, '')
          .trim();
      }
    } else {
      // No TODO_CARD — still clean FILL_FIELD tags from display message
      cleanMessage = aiResponse.replace(/\[FILL_FIELD\][\s\S]*?\[\/FILL_FIELD\]/gi, '').trim();
    }

    // 8c. Parse [NEED_INFO_CARD] — proactive follow-up: AI will ask customer directly
    const needInfoMatch = cleanMessage.match(/\[NEED_INFO_CARD\]\s*([\s\S]*?)\s*\[\/NEED_INFO_CARD\]/i)
      || aiResponse.match(/\[NEED_INFO_CARD\]\s*([\s\S]*?)\s*\[\/NEED_INFO_CARD\]/i);
    if (needInfoMatch && responseType !== 'todo_card') {
      try {
        const infoData = JSON.parse(needInfoMatch[1].trim());
        const questions = infoData.questions || [];
        const summary = infoData.summary || '';

        if (questions.length > 0) {
          // Cancel old need_info drafts
          await prisma.systemGuiderTodo.updateMany({
            where: { tenant_id: tenantId, request_id: requestId, todo_type: 'need_info', status: 'draft' },
            data: { status: 'cancelled', result: 'Digantikan oleh card baru.' }
          });

          // Save as single todo with questions in instruction (JSON)
          await prisma.systemGuiderTodo.create({
            data: {
              tenant_id: tenantId,
              request_id: requestId,
              phone: request.phone,
              instruction: JSON.stringify({ questions, summary }),
              todo_type: 'need_info',
              ai_confirmation: summary,
              status: 'draft'
            }
          });
          responseType = 'need_info_card';
          console.log(`[SystemGuider] 📋 Need info card created: ${questions.length} question(s) for ${request.phone}`);
        }

        // Clean NEED_INFO_CARD from display message
        cleanMessage = cleanMessage
          .replace(/\[NEED_INFO_CARD\][\s\S]*?\[\/NEED_INFO_CARD\]/gi, '')
          .trim();
        if (!cleanMessage) {
          cleanMessage = `📋 Daftar pertanyaan sudah disiapkan. Klik "Proceed" untuk langsung follow up ke customer, atau kirim revisi.`;
        }
      } catch (niParseErr) {
        console.error('[SystemGuider] Failed to parse NEED_INFO_CARD:', niParseErr.message);
        cleanMessage = cleanMessage.replace(/\[NEED_INFO_CARD\][\s\S]*?\[\/NEED_INFO_CARD\]/gi, '[Need info card gagal diproses]').trim();
      }
    }

    // 8c-legacy. Parse [QUESTION_CARD] — fallback compatibility
    const questionCardMatch = cleanMessage.match(/\[QUESTION_CARD\]\s*([\s\S]*?)\s*\[\/QUESTION_CARD\]/i)
      || aiResponse.match(/\[QUESTION_CARD\]\s*([\s\S]*?)\s*\[\/QUESTION_CARD\]/i);
    if (questionCardMatch && responseType !== 'todo_card' && responseType !== 'need_info_card') {
      try {
        const qData = JSON.parse(questionCardMatch[1].trim());
        const questionText = qData.question || '';
        if (questionText) {
          // Convert legacy QUESTION_CARD to NEED_INFO_CARD format
          await prisma.systemGuiderTodo.create({
            data: {
              tenant_id: tenantId,
              request_id: requestId,
              phone: request.phone,
              instruction: JSON.stringify({ questions: [{ key: 'question_1', question: questionText }], summary: qData.context || '' }),
              todo_type: 'need_info',
              ai_confirmation: qData.context || '',
              status: 'draft'
            }
          });
          responseType = 'need_info_card';
        }
        cleanMessage = cleanMessage.replace(/\[QUESTION_CARD\][\s\S]*?\[\/QUESTION_CARD\]/gi, '').trim();
        if (!cleanMessage) cleanMessage = `📋 Pertanyaan disiapkan. Klik "Proceed" untuk follow up ke customer.`;
      } catch (qParseErr) {
        console.error('[SystemGuider] Failed to parse QUESTION_CARD:', qParseErr.message);
        cleanMessage = cleanMessage.replace(/\[QUESTION_CARD\][\s\S]*?\[\/QUESTION_CARD\]/gi, '[Card gagal diproses]').trim();
      }
    }

    // 9. Save AI response
    await prisma.systemGuiderChat.create({
      data: {
        tenant_id: tenantId,
        request_id: requestId,
        role: 'ai',
        message: cleanMessage,
        message_type: responseType
      }
    });

    // 10. Get updated todos
    const allTodos = await prisma.systemGuiderTodo.findMany({
      where: { tenant_id: tenantId, request_id: requestId },
      orderBy: { created_at: 'desc' }
    });

    // 11. Background summarization
    triggerGuiderSummarization(tenantId, requestId).catch(e => 
      console.error('[SystemGuider] BG summarization error:', e.message)
    );

    return {
      success: true,
      message: cleanMessage,
      type: responseType,
      required_info: Array.isArray(request.required_info) ? request.required_info : null,
      todos: allTodos.map(t => ({
        id: t.id,
        instruction: t.instruction,
        status: t.status,
        todo_type: t.todo_type || 'action',
        question_text: t.question_text,
        customer_answer: t.customer_answer,
        asked_at: t.asked_at,
        ai_confirmation: t.ai_confirmation,
        result: t.result,
        created_at: t.created_at,
        executed_at: t.executed_at
      }))
    };

  } catch (err) {
    console.error('[SystemGuider] processGuiderChat error:', err);
    throw err;
  }
};

// ============================================================
// EXECUTE TODO — Send instruction to customer chat
// ============================================================

export const executeTodo = async (tenantId, requestId, todoId) => {
  try {
    const todo = await prisma.systemGuiderTodo.findFirst({
      where: { id: todoId, tenant_id: tenantId, request_id: requestId, status: 'pending' }
    });
    if (!todo) throw new Error('Todo not found or already executed');

    const request = await prisma.centralInfoRequest.findUnique({
      where: { id: requestId },
      select: { phone: true, questions: true, required_info: true }
    });
    if (!request) throw new Error('Request not found');

    // ── Session lock check: if pipeline is active for this customer, queue the todo ──
    const progress = await getPipelineProgress(tenantId, request.phone);
    const isActive = progress && (Date.now() - (progress.updatedAt || 0)) < 20000;
    if (isActive) {
      await prisma.systemGuiderTodo.update({
        where: { id: todoId },
        data: { status: 'queued' }
      });
      console.log(`[SystemGuider] Todo #${todoId} queued — pipeline active (stage ${progress.stage}) for ${request.phone}`);
      return { success: true, queued: true, message: 'Todo queued — AI sedang membalas customer. Akan digabung otomatis.' };
    }

    // Build verified fact sheet from answered required_info fields (if any)
    const answeredFields = Array.isArray(request.required_info)
      ? request.required_info.filter(f => f.answered && f.value)
      : [];
    const factSheet = answeredFields.length > 0
      ? `\n\n[DATA FAKTUAL DARI ADMIN — GUNAKAN NILAI PERSIS INI]\n${answeredFields.map(f => `- ${f.label}: ${f.value}`).join('\n')}\nJANGAN ubah angka/nilai di atas. Gunakan persis seperti tertulis.`
      : '';

    // Update status to executing
    await prisma.systemGuiderTodo.update({
      where: { id: todoId },
      data: { status: 'executing' }
    });

    console.log(`[SystemGuider] 🚀 Executing todo #${todoId} for ${request.phone}: ${todo.instruction.substring(0, 100)}`);

    // Build customer context for natural reply generation
    const customerContext = await buildCustomerContext(tenantId, request.phone);

    // Get tenant persona
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { business_name: true } });
    const persona = 'Customer service profesional dan ramah';

    const replyPrompt = `Kamu adalah customer service yang ramah dan natural dari bisnis travel.

${customerContext}

[INSTRUKSI DARI ADMIN — IKUTI PERSIS]
Admin memberikan instruksi ini untuk disampaikan ke customer:
"${todo.instruction}"${factSheet}

TUGAS: Tulis pesan WhatsApp/Telegram ke customer berdasarkan instruksi admin di atas.

ATURAN KETAT:
1. Gunakan informasi PERSIS dari instruksi dan data faktual di atas — jangan tambah, ubah, atau kurangi angka/harga/detail apapun.
2. JANGAN sebut "tim sales", "konfirmasi", "proses pengajuan" KECUALI memang ada di instruksi admin.
3. JANGAN tambahkan harga atau opsi hotel yang tidak ada di instruksi maupun data faktual.
4. Tulis dengan gaya percakapan natural dan hangat — bukan template robot.
5. Sambungkan dengan konteks percakapan sebelumnya secara natural.
6. Tulis HANYA teks pesan untuk customer. Tanpa penjelasan, tanpa prefix, tanpa kutipan.
7. Jika data faktual menyebut harga TOTAL, sampaikan sebagai total — bukan per-pax kecuali diminta.`;

    const customerReply = await executePlainAI(tenantId, replyPrompt, todo.instruction, [], 'system_guider');

    if (customerReply && customerReply.trim()) {
      const text = customerReply
        .replace(/\[SISTEM[^\]]*\]/gi, '')
        .replace(/\[CONVERSATION_INTENT:[^\]]+\]/gi, '')
        .replace(/\[CENTRAL_INFO_RESOLVED\]/gi, '')
        .replace(/\[NEXT\]/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      // Save and send to customer
      const saved = await saveMessage(prisma, request.phone, 'assistant', text, tenantId);
      await sendText(prisma, request.phone, text, { tenantId });

      broadcast(tenantId, 'new_message', {
        phone: request.phone,
        message: text,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
        id: saved?.id ?? null,
      });

      // Update lead preview
      await prisma.lead.updateMany({
        where: { tenant_id: tenantId, phone: request.phone },
        data: {
          last_message_preview: text.substring(0, 500),
          last_ai_reply: text.substring(0, 2000),
          last_message_at: new Date(),
        }
      });

      // Mark todo as done
      await prisma.systemGuiderTodo.update({
        where: { id: todoId },
        data: { status: 'done', result: `Terkirim: ${text.substring(0, 200)}`, executed_at: new Date() }
      });

      // ── MEMORY PATCH: Save delivered instruction to lead notes ──
      // This ensures AI remembers the info for subsequent customer messages
      try {
        const lead = await prisma.lead.findFirst({
          where: { tenant_id: tenantId, phone: request.phone },
          select: { id: true, personal_notes: true }
        });
        if (lead) {
          const deliveredNote = `[Info tersampaikan ke customer ${new Date().toLocaleDateString('id-ID')}]: ${todo.instruction.substring(0, 300)}`;
          const existingNotes = lead.personal_notes || '';
          const updatedNotes = existingNotes
            ? `${existingNotes}\n${deliveredNote}`
            : deliveredNote;
          await prisma.lead.update({
            where: { id: lead.id },
            data: { personal_notes: updatedNotes.substring(0, 2000) }
          });
          console.log(`[SystemGuider] 🧠 Saved delivered instruction to lead notes for ${request.phone}`);
        }
      } catch (noteErr) {
        console.error('[SystemGuider] Failed to save note:', noteErr.message);
      }

      // Log in guider chat
      await prisma.systemGuiderChat.create({
        data: {
          tenant_id: tenantId,
          request_id: requestId,
          role: 'system',
          message: `✅ Instruksi "${todo.instruction.substring(0, 80)}..." telah dikirim ke customer.`,
          message_type: 'system'
        }
      });

      // Check if all todos done → resolve request
      const remainingTodos = await prisma.systemGuiderTodo.count({
        where: { tenant_id: tenantId, request_id: requestId, status: { in: ['pending', 'executing'] } }
      });
      if (remainingTodos === 0) {
        await prisma.centralInfoRequest.update({
          where: { id: requestId },
          data: { status: 'resolved', resolved_at: new Date(), updated_at: new Date() }
        });
        console.log(`[SystemGuider] 🎉 All todos done — request #${requestId} resolved`);
      }

      return { success: true, sentText: text.substring(0, 200), status: 'done' };
    } else {
      await prisma.systemGuiderTodo.update({
        where: { id: todoId },
        data: { status: 'failed', result: 'AI tidak menghasilkan respons' }
      });
      return { success: false, error: 'AI failed to generate response' };
    }

  } catch (err) {
    console.error('[SystemGuider] executeTodo error:', err);
    await prisma.systemGuiderTodo.update({
      where: { id: todoId },
      data: { status: 'failed', result: err.message }
    }).catch(() => {});
    throw err;
  }
};

// ============================================================
// EXECUTE ALL TODOS for a request
// ============================================================

export const executeAllTodos = async (tenantId, requestId) => {
  const todos = await prisma.systemGuiderTodo.findMany({
    where: { tenant_id: tenantId, request_id: requestId, status: 'pending' },
    orderBy: { created_at: 'asc' }
  });

  if (todos.length === 0) return [];

  // ── SINGLE-TODO: just execute directly ──
  if (todos.length === 1) {
    try {
      const result = await executeTodo(tenantId, requestId, todos[0].id);
      return [{ todoId: todos[0].id, ...result }];
    } catch (err) {
      return [{ todoId: todos[0].id, success: false, error: err.message }];
    }
  }

  // ── MULTI-TODO: merge all instructions into ONE customer message ──
  // This prevents flooding the customer with multiple separate messages
  console.log(`[SystemGuider] 📋 MULTI-TODO (${todos.length}) — merging into single message for ${todos[0]?.phone}`);

  const request = await prisma.centralInfoRequest.findUnique({
    where: { id: requestId },
    select: { phone: true, questions: true, required_info: true }
  });
  if (!request) return todos.map(t => ({ todoId: t.id, success: false, error: 'Request not found' }));

  // Check pipeline lock
  const progress = await getPipelineProgress(tenantId, request.phone);
  const isActive = progress && (Date.now() - (progress.updatedAt || 0)) < 20000;
  if (isActive) {
    // Queue all todos
    await prisma.systemGuiderTodo.updateMany({
      where: { id: { in: todos.map(t => t.id) } },
      data: { status: 'queued' }
    });
    console.log(`[SystemGuider] All ${todos.length} todos queued — pipeline active for ${request.phone}`);
    return todos.map(t => ({ todoId: t.id, success: true, queued: true }));
  }

  // Build combined fact sheet
  const answeredFields = Array.isArray(request.required_info)
    ? request.required_info.filter(f => f.answered && f.value)
    : [];
  const factSheet = answeredFields.length > 0
    ? `\n\n[DATA FAKTUAL DARI ADMIN — GUNAKAN NILAI PERSIS INI]\n${answeredFields.map(f => `- ${f.label}: ${f.value}`).join('\n')}\nJANGAN ubah angka/nilai di atas.`
    : '';

  // Mark all as executing
  await prisma.systemGuiderTodo.updateMany({
    where: { id: { in: todos.map(t => t.id) } },
    data: { status: 'executing' }
  });

  const customerContext = await buildCustomerContext(tenantId, request.phone);
  const combinedInstructions = todos.map((t, i) => `${i + 1}. ${t.instruction}`).join('\n');

  const replyPrompt = `Kamu adalah customer service yang ramah dan natural dari bisnis travel.

${customerContext}

[INSTRUKSI DARI ADMIN — IKUTI PERSIS]
Sampaikan semua informasi berikut ke customer dalam SATU pesan yang natural dan mengalir:
${combinedInstructions}${factSheet}

ATURAN KETAT:
1. Gunakan informasi PERSIS dari instruksi dan data faktual — jangan tambah, ubah, atau kurangi angka/harga/detail.
2. Gabungkan semua poin menjadi 1-2 pesan yang mengalir natural — BUKAN daftar bullet kaku.
3. Tulis dengan gaya percakapan hangat — bukan template robot.
4. Sambungkan dengan konteks percakapan sebelumnya secara natural.
5. Tulis HANYA teks pesan untuk customer. Tanpa penjelasan, tanpa prefix.`;

  try {
    const customerReply = await executePlainAI(tenantId, replyPrompt, combinedInstructions, [], 'system_guider');

    if (customerReply && customerReply.trim()) {
      const text = customerReply
        .replace(/\[SISTEM[^\]]*\]/gi, '')
        .replace(/\[CONVERSATION_INTENT:[^\]]+\]/gi, '')
        .replace(/\[CENTRAL_INFO_RESOLVED\]/gi, '')
        .replace(/\[NEXT\]/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      const saved = await saveMessage(prisma, request.phone, 'assistant', text, tenantId);
      await sendText(prisma, request.phone, text, { tenantId });

      broadcast(tenantId, 'new_message', {
        phone: request.phone, message: text, role: 'assistant',
        timestamp: new Date().toISOString(), created_at: new Date().toISOString(),
        id: saved?.id ?? null,
      });

      await prisma.lead.updateMany({
        where: { tenant_id: tenantId, phone: request.phone },
        data: {
          last_message_preview: text.substring(0, 500),
          last_ai_reply: text.substring(0, 2000),
          last_message_at: new Date(),
        }
      });

      // ── MEMORY PATCH: Save combined instruction to lead notes ──
      try {
        const lead = await prisma.lead.findFirst({
          where: { tenant_id: tenantId, phone: request.phone },
          select: { id: true, personal_notes: true }
        });
        if (lead) {
          const deliveredNote = `[Info tersampaikan ${new Date().toLocaleDateString('id-ID')}]: ${combinedInstructions.substring(0, 400)}`;
          const existingNotes = lead.personal_notes || '';
          const updatedNotes = existingNotes ? `${existingNotes}\n${deliveredNote}` : deliveredNote;
          await prisma.lead.update({
            where: { id: lead.id },
            data: { personal_notes: updatedNotes.substring(0, 2000) }
          });
        }
      } catch (noteErr) {
        console.error('[SystemGuider] Failed to save combined note:', noteErr.message);
      }

      // Mark all todos as done
      await prisma.systemGuiderTodo.updateMany({
        where: { id: { in: todos.map(t => t.id) } },
        data: { status: 'done', result: `Merged delivery: ${text.substring(0, 150)}`, executed_at: new Date() }
      });

      // Log in guider chat
      await prisma.systemGuiderChat.create({
        data: {
          tenant_id: tenantId, request_id: requestId, role: 'system',
          message: `✅ ${todos.length} instruksi digabung dan dikirim ke customer.`,
          message_type: 'system'
        }
      });

      // Resolve request if all done
      const remaining = await prisma.systemGuiderTodo.count({
        where: { tenant_id: tenantId, request_id: requestId, status: { in: ['pending', 'executing'] } }
      });
      if (remaining === 0) {
        await prisma.centralInfoRequest.update({
          where: { id: requestId },
          data: { status: 'resolved', resolved_at: new Date(), updated_at: new Date() }
        });
        console.log(`[SystemGuider] 🎉 All todos done (merged) — request #${requestId} resolved`);
      }

      return todos.map(t => ({ todoId: t.id, success: true, merged: true, sentText: text.substring(0, 200) }));
    } else {
      await prisma.systemGuiderTodo.updateMany({
        where: { id: { in: todos.map(t => t.id) } },
        data: { status: 'failed', result: 'AI tidak menghasilkan respons' }
      });
      return todos.map(t => ({ todoId: t.id, success: false, error: 'AI failed' }));
    }
  } catch (err) {
    console.error('[SystemGuider] executeAllTodos merge error:', err.message);
    await prisma.systemGuiderTodo.updateMany({
      where: { id: { in: todos.map(t => t.id) } },
      data: { status: 'failed', result: err.message }
    }).catch(() => {});
    return todos.map(t => ({ todoId: t.id, success: false, error: err.message }));
  }
};

// ============================================================
// GET CHAT HISTORY
// ============================================================

export const getGuiderHistory = async (tenantId, requestId) => {
  const [chats, todos, request] = await Promise.all([
    prisma.systemGuiderChat.findMany({
      where: { tenant_id: tenantId, request_id: requestId },
      orderBy: { created_at: 'asc' }
    }),
    prisma.systemGuiderTodo.findMany({
      where: { tenant_id: tenantId, request_id: requestId },
      orderBy: { created_at: 'desc' }
    }),
    prisma.centralInfoRequest.findUnique({
      where: { id: requestId },
      select: { id: true, phone: true, customer_name: true, questions: true, ai_notes: true, required_info: true, status: true, created_at: true }
    })
  ]);

  return {
    request,
    chats: chats.map(c => ({
      id: c.id,
      role: c.role,
      message: c.message,
      type: c.message_type || 'text',
      created_at: c.created_at
    })),
    todos: todos.map(t => ({
      id: t.id,
      instruction: t.instruction,
      status: t.status,
      todo_type: t.todo_type || 'action',
      ai_confirmation: t.ai_confirmation,
      result: t.result,
      created_at: t.created_at,
      executed_at: t.executed_at
    }))
  };
};

// ============================================================
// EXECUTE NEED INFO — Proactive follow-up to customer
// ============================================================

export const executeNeedInfo = async (tenantId, requestId, todoId) => {
  try {
    const todo = await prisma.systemGuiderTodo.findFirst({
      where: { id: todoId, tenant_id: tenantId, request_id: requestId, todo_type: 'need_info', status: 'draft' }
    });
    if (!todo) throw new Error('Need info todo not found or already executed');

    const request = await prisma.centralInfoRequest.findUnique({
      where: { id: requestId },
      select: { phone: true, questions: true }
    });
    if (!request) throw new Error('Request not found');

    // Parse questions from instruction
    let parsed;
    try { parsed = JSON.parse(todo.instruction); } catch { throw new Error('Invalid todo instruction JSON'); }
    const questions = parsed.questions || [];
    if (questions.length === 0) throw new Error('No questions to ask');

    // Session lock check
    const progress = await getPipelineProgress(tenantId, request.phone);
    const isActive = progress && (Date.now() - (progress.updatedAt || 0)) < 20000;
    if (isActive) {
      await prisma.systemGuiderTodo.update({ where: { id: todoId }, data: { status: 'queued' } });
      return { success: true, queued: true, message: 'Todo queued — AI sedang membalas customer.' };
    }

    // Mark as executing
    await prisma.systemGuiderTodo.update({ where: { id: todoId }, data: { status: 'executing' } });

    // Build customer context for natural flowing message
    const customerContext = await buildCustomerContext(tenantId, request.phone);
    const questionList = questions.map((q, i) => `${i + 1}. ${q.question}`).join('\n');

    const replyPrompt = `Kamu adalah customer service yang ramah dan natural dari bisnis travel.

${customerContext}

[INSTRUKSI — FOLLOW UP KE CUSTOMER]
Admin membutuhkan informasi berikut dari customer. Tanyakan pertanyaan-pertanyaan ini secara NATURAL dan MENGALIR dalam satu pesan yang ramah:

${questionList}

ATURAN KETAT:
1. Gabungkan semua pertanyaan menjadi pesan yang MENGALIR NATURAL — bukan daftar kaku.
2. Sambungkan dengan konteks percakapan sebelumnya — customer harus merasa ini kelanjutan alami.
3. Jangan bilang "admin minta saya tanya" — tanyakan seolah kamu sendiri yang butuh info.
4. Gunakan gaya percakapan hangat dan natural seperti manusia chatting WhatsApp.
5. Tulis HANYA teks pesan untuk customer. Tanpa penjelasan, tanpa prefix.
6. Jika summary ada konteks kenapa info dibutuhkan, gunakan untuk membuat pertanyaan lebih natural.

Konteks kenapa info dibutuhkan: "${parsed.summary || 'Admin membutuhkan informasi tambahan'}"`;

    const customerReply = await executePlainAI(tenantId, replyPrompt, questionList, [], 'system_guider');

    if (customerReply && customerReply.trim()) {
      const text = customerReply
        .replace(/\[SISTEM[^\]]*\]/gi, '')
        .replace(/\[CONVERSATION_INTENT:[^\]]+\]/gi, '')
        .replace(/\[NEXT\]/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      // Send to customer
      const saved = await saveMessage(prisma, request.phone, 'assistant', text, tenantId);
      await sendText(prisma, request.phone, text, { tenantId });

      broadcast(tenantId, 'new_message', {
        phone: request.phone, message: text, role: 'assistant',
        timestamp: new Date().toISOString(), created_at: new Date().toISOString(),
        id: saved?.id ?? null,
      });

      // Update lead preview
      await prisma.lead.updateMany({
        where: { tenant_id: tenantId, phone: request.phone },
        data: {
          last_message_preview: text.substring(0, 500),
          last_ai_reply: text.substring(0, 2000),
          last_message_at: new Date(),
        }
      });

      // Save open_questions to Lead for AI pipeline detection
      const openQuestions = questions.map(q => ({
        key: q.key,
        question: q.question,
        answer: null,
        answered: false,
        request_id: requestId
      }));
      const targetLead = await prisma.lead.findFirst({
        where: { tenant_id: tenantId, phone: request.phone },
        select: { id: true }
      });
      if (targetLead) {
        await prisma.lead.update({
          where: { id: targetLead.id },
          data: { open_questions: openQuestions }
        });
        console.log(`[SystemGuider] 📝 Saved ${openQuestions.length} open_questions to Lead #${targetLead.id}`);
      }

      // Update todo status
      await prisma.systemGuiderTodo.update({
        where: { id: todoId },
        data: { status: 'awaiting_customer', result: `Follow-up terkirim: ${text.substring(0, 200)}`, executed_at: new Date() }
      });

      // Update request status
      await prisma.centralInfoRequest.update({
        where: { id: requestId },
        data: { status: 'awaiting_customer', updated_at: new Date() }
      });

      // Log in guider chat
      await prisma.systemGuiderChat.create({
        data: {
          tenant_id: tenantId, request_id: requestId, role: 'system',
          message: `🔍 Follow-up terkirim ke customer (${questions.length} pertanyaan). AI sedang menunggu jawaban.`,
          message_type: 'system'
        }
      });

      // Save to lead notes for AI memory
      try {
        const lead = await prisma.lead.findFirst({
          where: { tenant_id: tenantId, phone: request.phone },
          select: { id: true, personal_notes: true }
        });
        if (lead) {
          const note = `[Follow-up ${new Date().toLocaleDateString('id-ID')}]: AI menanyakan — ${questionList.substring(0, 300)}`;
          const existing = lead.personal_notes || '';
          await prisma.lead.update({
            where: { id: lead.id },
            data: { personal_notes: (existing ? existing + '\n' + note : note).substring(0, 2000) }
          });
        }
      } catch {}

      console.log(`[SystemGuider] 🚀 Need info follow-up sent to ${request.phone}: ${questions.length} question(s)`);
      return { success: true, sentText: text.substring(0, 200), status: 'awaiting_customer' };
    } else {
      await prisma.systemGuiderTodo.update({
        where: { id: todoId },
        data: { status: 'failed', result: 'AI tidak menghasilkan respons' }
      });
      return { success: false, error: 'AI failed to generate response' };
    }
  } catch (err) {
    console.error('[SystemGuider] executeNeedInfo error:', err);
    await prisma.systemGuiderTodo.update({
      where: { id: todoId },
      data: { status: 'failed', result: err.message }
    }).catch(() => {});
    throw err;
  }
};

// ============================================================
// REVISE NEED INFO — Admin revises the question list
// ============================================================

export const reviseNeedInfo = async (tenantId, requestId, revisionMessage) => {
  // Just process as a regular guider chat — AI will detect the revision context
  // and emit a new NEED_INFO_CARD with the updated questions
  return processGuiderChat(tenantId, requestId, revisionMessage);
};
