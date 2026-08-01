/**
 * ================================================================
 * STAGE 3 — Conversation State Resolver  ★ CORE OF THE ENGINE ★
 * ================================================================
 *
 * Computes the current conversation state DETERMINISTALLY from CRM data.
 * The state drives which prompt modules are loaded, and whether to
 * continue, hold, or rollback.
 *
 * State transition table:
 *
 *   PAYMENT_PROOF    ← customer sent a payment image right now
 *   ADMIN_PENDING    ← admin has an instruction queued for this customer
 *   INVOICE_PENDING  ← active unpaid transaction exists
 *   WAITING_DATE     ← date requested, pending admin approval
 *                      AI STILL ANSWERS all topics — but tracks pendingItems
 *   DATE_CONFIRMED   ← date approved, proceed to order/invoice
 *   ORDER_FORM       ← active order form in collecting/pending_confirm
 *   REQUEST_STUCK    ← customer has unresolved custom request + stuck signal
 *   NEGOTIATION      ← offer history exists
 *   PACKAGE_DISCUSS  ← package context detected in previous messages
 *   EXPLORATION      ← default / new customer
 *   COMPLETED        ← all transactions done
 *
 * PENDING ITEMS SYSTEM:
 *   States can accumulate "pending items" that AI must resolve before
 *   the conversation advances to a downstream stage like INVOICE_PENDING.
 *
 *   Example: Customer is in WAITING_DATE. They also have a custom request
 *   pending. Both must be resolved (date approved + request processed)
 *   before AI should trigger invoice creation.
 *
 *   The pending list is injected into personaText so AI is always aware.
 */

import * as centralInfoRequestService from '../../../shared/centralInfoRequest.service.js';
import { CONVERSATION_STATES, STAGE_INDEX } from '../pipeline.context.js';
import prisma from '../../../../config/database.js';
import { recordCrmHistory } from '../../../shared/crm_history.service.js';

export const runStage3StateResolver = async (ctx) => {
  const { crmData, routerSignals, userMessage, currentMediaData } = ctx;
  const { activeTransactions, activeOrder, requests, offers } = crmData;

  // ── 1. Compute conversation state ─────────────────────────────
  const state = computeState(ctx);
  ctx.conversationState = state;
  console.log(`[Stage3] 🧭 Conversation state: ${state}`);

  // ── 2. Build pending items list ───────────────────────────────
  ctx.pendingItems = computePendingItems(ctx);
  if (ctx.pendingItems.length > 0) {
    console.log(`[Stage3] 📋 Pending items (${ctx.pendingItems.length}):`, ctx.pendingItems.map(i => i.label).join(', '));
  }

  // ── 3. Fetch Central Info pending instruction ─────────────────
  try {
    const pendingInstruction = await centralInfoRequestService.getPendingInstructionForCustomer(ctx.tenantId, ctx.userPhone);
    ctx.crmData.pendingCentralInfo = pendingInstruction;
    ctx.pendingCentralInfoInstruction = pendingInstruction;
    ctx.routerSignals.hasCentralInfoPending = !!pendingInstruction;

    if (pendingInstruction) {
      ctx.personaText += `\n\n[INSTRUKSI DARI ADMIN - WAJIB DIIKUTI]
Admin telah memberikan instruksi untuk menjawab pertanyaan pelanggan yang sebelumnya belum terjawab.
Pertanyaan yang belum terjawab sebelumnya:
${pendingInstruction.questions}

Instruksi dari Admin:
${pendingInstruction.instruction}

ATURAN:
1. Gunakan instruksi di atas untuk menjawab pertanyaan pelanggan secara natural dan profesional.
2. Sampaikan seolah-olah Anda memang sudah mengetahuinya (jangan bilang "admin bilang" atau "setelah dikonfirmasi").
3. Setelah menjawab, WAJIB sisipkan tag [CENTRAL_INFO_RESOLVED] di BARIS PALING AKHIR pesan Anda.`;
      console.log(`[Stage3] 📩 Central info instruction injected for ${ctx.userPhone}`);
    }
  } catch (err) {
    console.error('[Stage3] Failed to fetch central info:', err.message);
  }

  // ── 3b. Inject pending guider request awareness ────────────────
  // When there are CentralInfoRequests waiting for admin (status: 'pending'),
  // inject explicit rules so AI doesn't repeat requests or hallucinate answers.
  const pendingGuiderReqs = ctx.crmData.pendingGuiderRequests || [];
  if (pendingGuiderReqs.length > 0) {
    const now = new Date();
    const reqList = pendingGuiderReqs.map((r, i) => {
      const agoMs = now.getTime() - new Date(r.created_at).getTime();
      const agoMin = Math.round(agoMs / 60000);
      const agoText = agoMin < 60 ? `${agoMin} menit lalu`
        : agoMin < 1440 ? `${Math.round(agoMin / 60)} jam lalu`
        : `${Math.round(agoMin / 1440)} hari lalu`;
      return `${i + 1}. "${r.questions}" (dikirim ${agoText})`;
    }).join('\n');

    ctx.personaText += `\n\n[PERMINTAAN INFORMASI SEDANG MENUNGGU ADMIN — WAJIB DIPATUHI]
⚠️ Anda SUDAH meminta bantuan admin untuk pertanyaan berikut, dan admin BELUM menjawab:
${reqList}

ATURAN KRITIS:
1. JANGAN ulangi request yang sama ke admin — jangan panggil defer_guidance_request untuk topik yang SUDAH ada di daftar pending di atas.
2. JANGAN menjawab pertanyaan tersebut dengan informasi yang Anda karang — admin belum memberikan jawaban resmi.
3. Jika customer menanyakan progres/follow-up tentang topik pending: jawab "Masih dalam proses konfirmasi ke tim, Kak. Mohon ditunggu sebentar ya 🙏"
4. Anda TETAP BOLEH menjawab pertanyaan LAIN yang TIDAK berhubungan dengan topik pending di atas.
5. Anda TETAP BOLEH melanjutkan proses order form, negosiasi harga, dan diskusi paket untuk topik lain.
6. JANGAN bilang "saya akan koordinasi ke tim" lagi untuk topik yang SUDAH pending — bilang "masih dalam proses".`;
    console.log(`[Stage3] ⏳ Injected ${pendingGuiderReqs.length} pending guider request awareness for ${ctx.userPhone}`);
  }

  // ── 4. Inject state context into personaText ──────────────────
  injectStateContext(ctx);

  // ── 5. Inject pending items awareness into personaText ────────
  injectPendingItemsContext(ctx);

  // ── 6. Inject ghost timer intent classification instruction ─────
  injectGhostTimerInstruction(ctx);

  // ── NOTE: No hold/rollback decisions in Stage 3 ──────────────
  // WAITING_DATE → AI still answers all topics (per user decision).
  // The pending items list is how AI knows what to prioritize.
  // Stage 7 (PostProcessor) can trigger rollback if a tag signals a new state.
};

// ──────────────────────────────────────────────────────────────────
// State computation (priority-ordered, deterministic)
// ──────────────────────────────────────────────────────────────────

const computeState = (ctx) => {
  const { crmData, currentMediaData, routerSignals } = ctx;
  const { activeTransactions, activeOrder, requests, offers } = crmData;

  // Highest priority: live signals from this very message
  if (currentMediaData?.image_category === 'bukti_transfer') {
    return CONVERSATION_STATES.PAYMENT_PROOF;
  }

  // ── Cancelled: recent cancelled transaction/order ─────────────
  // Check if lead has cancelled orders and NO active ones
  if (ctx.crmData.hasCancelledTransaction && !activeTransactions?.length && !activeOrder) {
    return CONVERSATION_STATES.CANCELLED;
  }

  // Active unpaid invoice → highest financial priority
  if (activeTransactions && activeTransactions.length > 0) {
    return CONVERSATION_STATES.INVOICE_PENDING;
  }

  // Date awaiting admin approval (customer management)
  if (activeOrder && activeOrder.date_status === 'pending_approval') {
    return CONVERSATION_STATES.WAITING_DATE;
  }

  // Date approved by admin → move to next phase
  if (activeOrder && activeOrder.date_status === 'approved') {
    return CONVERSATION_STATES.DATE_CONFIRMED;
  }

  // Active order management exists (collecting data)
  if (activeOrder && !activeTransactions?.length) {
    return CONVERSATION_STATES.ORDER_FORM;
  }

  // Customer has custom requests that need escalation
  if (requests && requests.length > 0 && isCustomerStuck(ctx)) {
    return CONVERSATION_STATES.REQUEST_STUCK;
  }

  // Pending System Guider request — admin hasn't responded yet
  // Only triggers if no higher-priority states exist (invoice, order, etc.)
  if (crmData.pendingGuiderRequests && crmData.pendingGuiderRequests.length > 0) {
    return CONVERSATION_STATES.ADMIN_PENDING;
  }

  // ── Ghosted/Idle return: customer came back after timer expired ──
  // Uses previousGhostStatus set by Stage 2 when timer was cancelled
  const ghostReturn = detectGhostReturn(ctx);
  if (ghostReturn) {
    return ghostReturn;
  }

  // ── Considering: has offers/interest but not decided ───────────
  if (isConsidering(ctx)) {
    return CONVERSATION_STATES.CONSIDERING;
  }

  // Offer/negotiation history exists
  if (offers && offers.length > 0) {
    return CONVERSATION_STATES.NEGOTIATION;
  }

  // Has package context from previous messages (active_topics)
  if (ctx.lead?.active_topics) {
    try {
      const topics = JSON.parse(ctx.lead.active_topics);
      if (Array.isArray(topics) && topics.length > 0) return CONVERSATION_STATES.PACKAGE_DISCUSS;
    } catch {}
  }

  return CONVERSATION_STATES.EXPLORATION;
};

/**
 * Detect if customer is "stuck" (has a request but showing frustration signals).
 */
const isCustomerStuck = (ctx) => {
  const msg = (ctx.userMessage || '').toLowerCase();
  const stuckSignals = [
    /masa gak bisa/i, /gimana dong/i, /saya cuma sendiri/i, /tidak bisa/i,
    /kenapa tidak/i, /tolong bantu/i, /minta tolong/i, /bisa tidak/i,
    /harus bagaimana/i, /terus bagaimana/i
  ];
  return stuckSignals.some(r => r.test(msg));
};

/**
 * Detect if customer returned after ghost timer expired.
 * Uses previousGhostStatus set by Stage 2 (cancelTimer was called).
 * Returns the appropriate conversation state or null if no ghost return.
 */
const detectGhostReturn = (ctx) => {
  const prevStatus = ctx.previousGhostStatus;
  if (!prevStatus) return null;

  // Customer was 'ghosted' (serious intent, then disappeared) → GHOSTED state
  if (prevStatus === 'ghosted') {
    return CONVERSATION_STATES.GHOSTED;
  }

  // Customer was 'idle' (casual, just browsing, then left) → EXPLORATION
  if (prevStatus === 'idle') {
    return CONVERSATION_STATES.EXPLORATION;
  }

  // Customer was 'at_risk' (timer was still running) → they replied before expiry
  // This shouldn't normally reach here (timer gets cancelled), but handle gracefully
  return null;
};

/**
 * Detect if customer is in "considering" mode — weighing options.
 * Signals: asked for time, comparing packages, last messages show indecision.
 */
const isConsidering = (ctx) => {
  const msg = (ctx.userMessage || '').toLowerCase();
  const considerSignals = [
    /pikir.?pikir/i, /pertimban/i, /nanti (dulu|aja|ya)/i,
    /belum (yakin|pasti|tau|tahu|decide)/i, /masih (mikir|ragu|bingung)/i,
    /tanya.*(suami|istri|keluarga|teman|bos|atasan)/i,
    /bandingkan/i, /compare/i, /cek dulu/i,
    /nanti (saya|aku) (kabari|hubungi|konfirmasi)/i,
    /belum bisa (jawab|pastikan|konfirmasi)/i,
  ];
  return considerSignals.some(r => r.test(msg));
};

// ──────────────────────────────────────────────────────────────────
// Pending items computation
// ──────────────────────────────────────────────────────────────────

/**
 * Compute list of pending items that must be resolved before the
 * conversation can advance to downstream stages (like INVOICE).
 *
 * Pending items are accumulated when multiple things are unresolved.
 * For example: WAITING_DATE + open NEGOTIATION offer + open custom REQUEST
 * → all 3 must be resolved before AI creates an invoice.
 */
const computePendingItems = (ctx) => {
  const { crmData, conversationState } = ctx;
  const { activeOrder, offers, requests, activeTransactions, refundRequests, rescheduleRequests } = crmData;
  const items = [];

  // Date approval pending
  if (activeOrder && activeOrder.date_status === 'pending_approval') {
    items.push({
      type: 'date_approval',
      id:   activeOrder.id,
      label: `Konfirmasi tanggal keberangkatan (${activeOrder.requested_date ? activeOrder.requested_date.toISOString().split('T')[0] : 'belum disebutkan'}) masih menunggu persetujuan admin`,
      resolved: false,
    });
  }

  // Unresolved offer decisions
  if (offers && offers.length > 0) {
    const openOffers = offers.filter(o => o.status === 'pending' || o.status === 'counter_offered');
    for (const offer of openOffers) {
      items.push({
        type:  'offer_decision',
        id:    offer.id,
        label: `Penawaran harga untuk paket "${offer.package_name}" (Rp ${offer.offered_price}) masih menunggu keputusan`,
        resolved: false,
      });
    }
  }

  // Unresolved custom requests
  if (requests && requests.length > 0) {
    const openRequests = requests.filter(r => r.status === 'pending' || r.status === 'waiting');
    for (const req of openRequests) {
      items.push({
        type:  'custom_request',
        id:    req.id,
        label: `Request custom "${req.request_detail || req.package_name}" (Status: ${req.status}) belum selesai`,
        resolved: false,
      });
    }
  }

  // ── Edge cases: post-invoice events ───────────────────────────

  // Order revision (transaction modified after invoice)
  if (activeTransactions && activeTransactions.length > 0) {
    for (const trx of activeTransactions) {
      if (trx.is_modified) {
        items.push({
          type: 'order_revision',
          id:   trx.id,
          label: `Pesanan #${trx.order_id || trx.id} telah direvisi — detail perlu diperbarui`,
          resolved: false,
        });
      }
    }

    // Requests linked to active transaction (revision during invoice)
    if (requests && requests.length > 0) {
      const trxIds = new Set(activeTransactions.map(t => t.id));
      const linkedRequests = requests.filter(r => r.transaction_id && trxIds.has(r.transaction_id) && (r.status === 'pending' || r.status === 'waiting'));
      for (const req of linkedRequests) {
        // Avoid duplicate if already added as custom_request
        if (!items.some(i => i.type === 'custom_request' && i.id === req.id)) {
          items.push({
            type: 'invoice_revision',
            id:   req.id,
            label: `Perubahan rincian "${req.request_detail || 'detail pesanan'}" saat invoice sudah terbit`,
            resolved: false,
          });
        }
      }
    }
  }

  // Refund requests
  if (refundRequests && refundRequests.length > 0) {
    for (const refund of refundRequests) {
      items.push({
        type: 'refund_request',
        id:   refund.id,
        label: `Permintaan refund${refund.refund_amount ? ` (Rp ${refund.refund_amount})` : ''} — ${refund.reason || 'alasan tidak disebutkan'}`,
        resolved: false,
      });
    }
  }

  // Reschedule requests
  if (rescheduleRequests && rescheduleRequests.length > 0) {
    for (const resched of rescheduleRequests) {
      items.push({
        type: 'reschedule_request',
        id:   resched.id,
        label: `Permintaan reschedule ke tanggal ${resched.requested_date ? resched.requested_date.toISOString().split('T')[0] : 'baru'}`,
        resolved: false,
      });
    }
  }

  return items;
};

// ──────────────────────────────────────────────────────────────────
// State context injection into AI persona
// ──────────────────────────────────────────────────────────────────

const STATE_LABELS = {
  [CONVERSATION_STATES.EXPLORATION]:    '🌱 Eksplorasi',
  [CONVERSATION_STATES.PACKAGE_DISCUSS]:'📦 Diskusi Produk/Layanan',
  [CONVERSATION_STATES.NEGOTIATION]:    '🤝 Negosiasi Harga',
  [CONVERSATION_STATES.ORDER_FORM]:     '📝 Registrasi Order',
  [CONVERSATION_STATES.WAITING_DATE]:   '⏳ Menunggu Konfirmasi Jadwal/Tanggal',
  [CONVERSATION_STATES.DATE_CONFIRMED]: '✅ Jadwal/Tanggal Dikonfirmasi',
  [CONVERSATION_STATES.INVOICE_PENDING]:'🧾 Invoice Aktif (Belum Lunas)',
  [CONVERSATION_STATES.PAYMENT_PROOF]:  '💳 Bukti Pembayaran',
  [CONVERSATION_STATES.REQUEST_STUCK]:  '🆘 Request Buntu',
  [CONVERSATION_STATES.ADMIN_PENDING]:  '📩 Menunggu Info Admin',
  [CONVERSATION_STATES.CONSIDERING]:    '🤔 Mempertimbangkan',
  [CONVERSATION_STATES.GHOSTED]:        '👻 Kembali Setelah Lama',

  [CONVERSATION_STATES.CANCELLED]:      '❌ Dibatalkan',
  [CONVERSATION_STATES.COMPLETED]:      '🎉 Selesai',
};

const STATE_INSTRUCTIONS = {
  [CONVERSATION_STATES.EXPLORATION]: `
Anda sedang dalam fase EKSPLORASI — pelanggan masih menjelajahi pilihan. 
Fokus pada soft selling, membangun kepercayaan, dan memahami kebutuhan mereka.
JANGAN langsung push untuk beli atau buat invoice.`,

  [CONVERSATION_STATES.PACKAGE_DISCUSS]: `
Anda sedang dalam fase DISKUSI PRODUK/LAYANAN — pelanggan menanyakan detail produk/layanan spesifik.
Berikan informasi akurat berdasarkan data produk/layanan. Jawab semua pertanyaan dengan percaya diri.
Jika relevan, tawarkan untuk membantu menentukan tanggal pelaksanaan/jadwal.`,

  [CONVERSATION_STATES.NEGOTIATION]: `
Anda sedang dalam fase NEGOSIASI — ada riwayat penawaran harga.
Ikuti aturan tawaran yang sudah ada di [PENAWARAN HARGA (BARGAIN) LALU].
Jika tawaran sudah APPROVED, gunakan harga tawaran sebagai acuan resmi.
Setelah harga disepakati, arahkan ke konfirmasi tanggal/jadwal dan pembuatan order.`,

  [CONVERSATION_STATES.ORDER_FORM]: `
Anda sedang dalam fase REGISTRASI ORDER — ada formulir pesanan yang aktif.
Ikuti aturan form pesanan di [SISTEM FORM PESANAN BELAKANG LAYAR].
Fokus pada mengisi semua field yang kosong secara natural dan mengalir.`,

  [CONVERSATION_STATES.WAITING_DATE]: `
Anda sedang dalam fase MENUNGGU KONFIRMASI JADWAL/TANGGAL.
Tanggal pelaksanaan/jadwal yang diminta oleh pelanggan SEDANG MENUNGGU PERSETUJUAN ADMIN.
ATURAN PENTING:
1. TETAP jawab semua pertanyaan pelanggan secara normal — harga, fasilitas, detail spesifikasi, dsb. GUNAKAN DATA DARI KNOWLEDGE BASE untuk menjawab! DILARANG bilang "saya koordinasi ke tim" untuk informasi yang SUDAH ADA di data produk/layanan!
2. TETAP LANJUTKAN mengisi form pesanan! Jika ada field wajib yang masih kosong, tanyakan secara natural.
3. Jangan membuat invoice atau konfirmasi pemesanan final SAMPAI tanggal disetujui admin.
4. Yang SEDANG MENUNGGU ADMIN adalah HANYA soal KONFIRMASI TANGGAL/JADWAL/SLOT. Untuk pertanyaan lain (harga, detail, aturan, dsb), Anda HARUS menjawab langsung dari data yang tersedia.
5. Jika pelanggan menanyakan status konfirmasi jadwal/tanggal, sampaikan bahwa jadwal masih menunggu konfirmasi admin.
6. Jika ada hal baru (request, negosiasi, dll.), tangani seperti biasa dan catat.`,

  [CONVERSATION_STATES.DATE_CONFIRMED]: `
Anda sedang dalam fase TANGGAL DIKONFIRMASI — admin sudah menyetujui tanggal keberangkatan.
Lanjutkan ke tahap berikutnya: konfirmasi detail paket, jumlah peserta, dan buat invoice.
Ini saatnya closing!`,

  [CONVERSATION_STATES.INVOICE_PENDING]: `
Anda sedang dalam fase INVOICE AKTIF — ada invoice/transaksi yang belum lunas.
Fokus pada membantu pelanggan menyelesaikan pembayaran.
Jika pelanggan ingin modifikasi invoice atau membatalkan, ikuti aturan di modul terkait.
JANGAN buat invoice baru jika sudah ada yang aktif.`,

  [CONVERSATION_STATES.PAYMENT_PROOF]: `
Pelanggan baru saja mengirimkan BUKTI PEMBAYARAN/TRANSFER.
Segera ucapkan terima kasih dan konfirmasi bahwa pembayaran sedang diverifikasi admin.
JANGAN membuat klaim bahwa pembayaran sudah diterima — admin yang memverifikasi.`,

  [CONVERSATION_STATES.REQUEST_STUCK]: `
Anda sedang dalam situasi REQUEST BUNTU — pelanggan memiliki permintaan khusus yang belum bisa diproses.
Dengarkan dengan empati. Jika belum ada jalan keluar, panggil tool "generate_customer_request" untuk eskalasi ke admin.`,

  [CONVERSATION_STATES.ADMIN_PENDING]: `
Ada instruksi khusus dari admin yang perlu Anda sampaikan ke pelanggan ini.
Lihat [INSTRUKSI DARI ADMIN - WAJIB DIIKUTI] di atas dan ikuti dengan tepat.`,

  [CONVERSATION_STATES.CONSIDERING]: `
Pelanggan SEDANG MEMPERTIMBANGKAN — mereka belum memutuskan dan butuh waktu.
ATURAN PENTING:
1. JANGAN memaksa atau terlalu agresif push untuk closing.
2. Tunjukkan pengertian: "Tentu, Kak, silakan dipertimbangkan dulu."
3. Berikan informasi tambahan yang bisa membantu keputusan (testimoni, keunggulan paket, slot tersisa).
4. Tawarkan diri untuk menjawab pertanyaan kapan saja.
5. Jika ada promo terbatas atau slot terbatas, sampaikan secara halus (FOMO lembut, BUKAN tekanan).
6. JANGAN lupa simpan konteks — ketika mereka kembali nanti, Anda harus ingat apa yang mereka pertimbangkan.`,

  [CONVERSATION_STATES.GHOSTED]: `
Pelanggan ini KEMBALI SETELAH LAMA MENGHILANG (ghosted). Mereka pernah tertarik sebelumnya.
ATURAN PENTING:
1. Sambut dengan hangat dan TANPA menghakimi: "Hai Kak [Nama]! Senang bisa ngobrol lagi 😊"
2. JANGAN bilang "Anda sudah lama tidak membalas" atau sejenisnya — itu membuat tidak nyaman.
3. Gunakan data dari [RIWAYAT CRM PELANGGAN] untuk personalisasi: ingatkan apa yang mereka tertarik sebelumnya.
4. Sebutkan secara halus apa yang terakhir dibahas: "Kalau tidak salah terakhir kita membahas paket [X], apakah masih tertarik?"
5. Berikan update jika ada perubahan harga, promo baru, atau slot baru sejak terakhir ngobrol.
6. Bangun kembali kepercayaan sebelum push untuk closing.`,



  [CONVERSATION_STATES.CANCELLED]: `
Pelanggan ini sebelumnya MEMBATALKAN pesanan/transaksi.
ATURAN PENTING:
1. Jangan langsung menyinggung pembatalan — biarkan pelanggan yang memulai topik tersebut.
2. Jika mereka menyinggung pembatalan, tanyakan dengan empati apakah ada yang bisa diperbaiki.
3. Jika mereka membicarakan hal baru (paket lain, tanggal baru), layani dengan antusias — ini peluang kedua!
4. JANGAN menolak atau mempersulit pelanggan yang pernah cancel — semua pelanggan berharga.
5. Jika ada refund yang masih diproses, informasikan statusnya (lihat [DAFTAR PENDING ITEMS]).
6. Fokus pada membangun kembali hubungan dan kepercayaan.`,

  [CONVERSATION_STATES.COMPLETED]: `
Transaksi dengan pelanggan ini sudah selesai. Sampaikan dengan hangat dan tanyakan apakah ada yang bisa dibantu lagi.`,
};

const injectStateContext = (ctx) => {
  const stateLabel = STATE_LABELS[ctx.conversationState] || ctx.conversationState;
  const stateInstruction = STATE_INSTRUCTIONS[ctx.conversationState] || '';

  ctx.personaText += `\n\n[STATUS FASE PERCAKAPAN SAAT INI: ${stateLabel}]${stateInstruction}`;

  // ── Sync pipeline_status to Lead table (fire & forget) ────────
  if (ctx.lead?.id) {
    prisma.lead.update({
      where: { id: ctx.lead.id },
      data: { pipeline_status: ctx.conversationState }
    }).catch(err => console.error('[Stage3] Failed to sync pipeline_status:', err.message));
  }

  // ── Record state transition in CRM history (fire & forget) ────
  recordCrmHistory(
    ctx.tenantId,
    ctx.userPhone,
    'STATE_TRANSITION',
    `Fase percakapan: ${stateLabel}. Pending items: ${ctx.pendingItems.length > 0 ? ctx.pendingItems.map(i => i.label).join('; ') : 'Tidak ada'}.`
  );
};

const injectPendingItemsContext = (ctx) => {
  if (ctx.pendingItems.length === 0) return;

  const itemsList = ctx.pendingItems.map((item, i) => `${i + 1}. ${item.label}`).join('\n');

  ctx.personaText += `\n\n[DAFTAR PENDING ITEMS — HARUS DISELESAIKAN SEBELUM LANJUT]
Ada ${ctx.pendingItems.length} hal yang BELUM selesai dan harus ditangani sebelum percakapan bisa maju ke fase selanjutnya (misalnya pembuatan invoice):

${itemsList}

ATURAN PENDING ITEMS:
1. Anda boleh menjawab semua pertanyaan pelanggan secara normal.
2. Namun, JANGAN buat invoice atau konfirmasi pemesanan final jika masih ada pending items di atas.
3. Secara aktif usahakan untuk menyelesaikan setiap item (misalnya: tawarkan tanggal alternatif, proses offer, dll.).
4. Jika semua item di atas sudah selesai di pesan ini, barulah Anda boleh lanjut ke tahap berikutnya.`;
};

const injectGhostTimerInstruction = (ctx) => {
  ctx.personaText += `\n\n[KLASIFIKASI INTENT PERCAKAPAN — WAJIB DIIKUTI]
Di BARIS PALING AKHIR setiap balasan Anda (setelah semua teks selesai), WAJIB output SALAH SATU tag berikut:

[CONVERSATION_INTENT:casual]  — gunakan jika pelanggan HANYA bertanya-tanya umum, belum menunjukkan sinyal keseriusan (belum memberi tanggal keberangkatan, jumlah peserta, tawar harga, atau data pemesanan)
[CONVERSATION_INTENT:serious] — gunakan jika pelanggan SUDAH menunjukkan sinyal keseriusan: menyebut tanggal keberangkatan, jumlah peserta, negosiasi harga, deep-dive paket spesifik, pertanyaan pembayaran, atau memberikan data form pemesanan

ATURAN:
1. Output HANYA SATU tag di baris paling akhir.
2. JANGAN output keduanya.
3. Jika ragu, pilih 'casual'.
4. Tag ini TIDAK terlihat oleh pelanggan — ini hanya untuk sistem internal.`;
};
