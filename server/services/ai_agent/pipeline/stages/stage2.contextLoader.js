/**
 * ================================================================
 * STAGE 2 — Context Loader
 * ================================================================
 * Loads all CRM data, chat history, persona, and order form config.
 * Populates ctx with everything downstream stages need.
 *
 * Extracted from handler.service.js processIncomingChat() lines ~67–524
 */

import prisma from '../../../../config/database.js';
import { triggerBackgroundSummarization } from '../../memory.service.js';
import { getMediaSendHistory } from '../../../shared/mediaDedup.service.js';
import { cancelTimer } from '../../ghostTimer.service.js';

// ──────────────────────────────────────────────────────────────────
// Activity Summary Builder
// Builds a comprehensive text summary of ALL active/pending processes
// for a customer so the AI has full situational awareness.
// ──────────────────────────────────────────────────────────────────

const buildActivitySummary = ({
  pendingGuiderRequests,
  activeTransactions,
  activeOrder,
  requests,
  offers,
  refundRequests,
  rescheduleRequests,
  now,
}) => {
  const sections = [];

  // 1. System Guider — pending requests waiting for admin
  if (pendingGuiderRequests && pendingGuiderRequests.length > 0) {
    const lines = pendingGuiderRequests.map((r, i) => {
      const agoMs = now.getTime() - new Date(r.created_at).getTime();
      const agoMin = Math.round(agoMs / 60000);
      const agoText = agoMin < 60
        ? `${agoMin} menit lalu`
        : agoMin < 1440
          ? `${Math.round(agoMin / 60)} jam lalu`
          : `${Math.round(agoMin / 1440)} hari lalu`;
      return `  ${i + 1}. ⏳ PENDING: "${r.questions}" (dikirim ${agoText})`;
    }).join('\n');

    sections.push(`📋 SYSTEM GUIDER (Permintaan Informasi ke Admin):
${lines}
  → Anda SUDAH meminta bantuan admin untuk topik-topik di atas. Admin BELUM menjawab.
  → JANGAN ulangi request (defer_guidance_request) untuk topik yang SAMA.
  → JANGAN menjawab pertanyaan tersebut dengan informasi yang Anda karang.
  → Jika customer menanyakan progres: "Masih dalam proses konfirmasi ke tim, Kak. Mohon ditunggu sebentar ya 🙏"`);
  } else {
    sections.push(`📋 SYSTEM GUIDER: ✅ Tidak ada request yang menunggu admin`);
  }

  // 2. Transactions
  if (activeTransactions && activeTransactions.length > 0) {
    const lines = activeTransactions.map(trx =>
      `  - Order #${trx.order_id}: ${trx.status} — Rp ${parseFloat(trx.total_price).toLocaleString('id-ID')}`
    ).join('\n');
    sections.push(`💳 TRANSAKSI AKTIF:\n${lines}`);
  } else {
    sections.push(`💳 TRANSAKSI: ✅ Tidak ada transaksi aktif`);
  }

  // 3. Active Order (CustomerManagement)
  if (activeOrder) {
    const dateStatus = activeOrder.date_status === 'pending_approval' ? '⏳ Menunggu Persetujuan Tanggal'
      : activeOrder.date_status === 'approved' ? '✅ Tanggal Disetujui'
      : activeOrder.date_status === 'rejected' ? '❌ Tanggal Ditolak'
      : activeOrder.status || 'aktif';
    sections.push(`📝 ORDER: Aktif — ${activeOrder.package_name || 'Paket belum ditentukan'} (${dateStatus})`);
  } else {
    sections.push(`📝 ORDER: ✅ Tidak ada order aktif`);
  }

  // 4. Negotiations
  const pendingOffers = offers ? offers.filter(o => o.status === 'pending' || o.status === 'counter_offered') : [];
  if (pendingOffers.length > 0) {
    const lines = pendingOffers.map(o =>
      `  - Paket "${o.package_name}": Rp ${o.offered_price} (${o.status})`
    ).join('\n');
    sections.push(`🤝 NEGOSIASI PENDING:\n${lines}`);
  } else {
    sections.push(`🤝 NEGOSIASI: ✅ Tidak ada penawaran pending`);
  }

  // 5. Custom Requests
  const pendingRequests = requests ? requests.filter(r => r.status === 'pending' || r.status === 'waiting') : [];
  if (pendingRequests.length > 0) {
    const lines = pendingRequests.map(r =>
      `  - "${r.request_detail || r.package_name}" (${r.status})`
    ).join('\n');
    sections.push(`📩 REQUEST PENDING:\n${lines}`);
  } else {
    sections.push(`📩 REQUEST: ✅ Tidak ada request pending`);
  }

  // 6. Refund Requests
  if (refundRequests && refundRequests.length > 0) {
    const lines = refundRequests.map(r =>
      `  - Refund${r.refund_amount ? ` Rp ${r.refund_amount}` : ''}: ${r.status}`
    ).join('\n');
    sections.push(`💰 REFUND PENDING:\n${lines}`);
  }

  // 7. Reschedule Requests
  if (rescheduleRequests && rescheduleRequests.length > 0) {
    const lines = rescheduleRequests.map(r =>
      `  - Reschedule ke ${r.requested_date ? r.requested_date.toISOString().split('T')[0] : 'tanggal baru'}: ${r.status}`
    ).join('\n');
    sections.push(`📅 RESCHEDULE PENDING:\n${lines}`);
  }

  // Only inject if there's at least one notable activity
  const hasNotableActivity = pendingGuiderRequests?.length > 0
    || activeTransactions?.length > 0
    || !!activeOrder
    || pendingOffers.length > 0
    || pendingRequests.length > 0
    || refundRequests?.length > 0
    || rescheduleRequests?.length > 0;

  if (!hasNotableActivity) return '';

  return `[RINGKASAN AKTIVITAS PELANGGAN — WAJIB DIBACA SEBELUM MENJAWAB]
Sebelum menjawab, pahami status terkini semua proses yang sedang berjalan untuk pelanggan ini:

${sections.join('\n\n')}

Gunakan ringkasan ini untuk menjawab secara kontekstual. Jika customer menanyakan sesuatu yang SUDAH masuk ke System Guider (PENDING), jangan mengulang proses — cukup informasikan bahwa sedang menunggu konfirmasi.\n\n`;
};

export const runStage2ContextLoader = async (ctx) => {
  const { tenantId, userPhone, chatType, tenant } = ctx;
  const now = new Date();

  // ── 1. Persona from GlobalSetting ─────────────────────────────
  const settingKey = `ai_persona_${chatType}`;
  const personaSetting = await prisma.globalSetting.findUnique({
    where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: settingKey } }
  });

  const dpSettings = await prisma.globalSetting.findMany({
    where: { tenant_id: tenantId, setting_key: { in: ['dp_enabled', 'dp_percentage'] } }
  });

  dpSettings.forEach(s => {
    if (s.setting_key === 'dp_enabled' && s.setting_value === 'true') ctx.isDpEnabled = true;
    if (s.setting_key === 'dp_percentage') ctx.dpPercent = parseInt(s.setting_value, 10) || 50;
  });

  let personaText = personaSetting?.setting_value
    ? `Nama Bisnis: ${tenant.business_name}\n${personaSetting.setting_value}`
    : `Nama Bisnis: ${tenant.business_name}\nAnda adalah asisten AI dari ${tenant.business_name}. Jawab pertanyaan dengan sopan dan ramah.`;

  // ── 2. Anti-hallucination guardrails ──────────────────────────
  personaText += `\n\n[PRIORITAS TERTINGGI: JAWABAN DARI DOKUMEN]
Jika di konteks Anda terdapat bagian bertanda "=== JAWABAN DARI DOKUMEN PRODUK/LAYANAN ===" atau "=== JAWABAN DARI DOKUMEN BASIS PENGETAHUAN ===" atau "=== JAWABAN DARI LAMPIRAN KB ===" atau "=== JAWABAN DARI DOKUMEN BASIS PENGETAHUAN ADVANCE ===", itu adalah informasi yang SUDAH DITEMUKAN dari dokumen resmi perusahaan. Anda WAJIB:
1. Menggunakan informasi tersebut untuk menjawab pertanyaan pelanggan secara LANGSUNG dan PERCAYA DIRI.
2. DILARANG KERAS mengatakan "saya konfirmasi ke tim" atau "saya cek dulu" jika jawaban SUDAH ADA di bagian dokumen tersebut.
3. Sampaikan jawabannya secara natural, seolah Anda memang menguasai informasi tersebut.

[ATURAN KETAT ANTI-HALUSINASI (GUARDRAILS)]
1. DILARANG KERAS mengarang harga, produk, layanan, diskon, atau fasilitas tambahan yang tidak tertera di dalam dokumen Knowledge Base atau Deskripsi Produk/Layanan.
2. Jika pelanggan menanyakan sesuatu yang informasinya TIDAK ADA di data Anda DAN JUGA TIDAK ADA di bagian "JAWABAN DARI DOKUMEN":
   - DILARANG KERAS berkata "Maaf, informasi tersebut tidak tersedia" atau varian serupa.
   - SEBALIKNYA, jawab dengan PROFESIONAL seolah Anda sedang memproses permintaan mereka. Contoh: "Pertanyaan bagus, Kak! Izinkan saya konfirmasi detailnya ke tim terkait agar informasinya akurat ya."
   - WAJIB MUTLAK panggil tool \`defer_guidance_request\` secara paralel dengan ringkasan pertanyaan customer dan tentukan data apa saja yang perlu Anda kumpulkan (nama, posisi, jumlah kuantitas, dll). TANPA memanggil tool ini, pertanyaan tidak akan diteruskan ke admin! Jangan gunakan tool request_admin_guidance secara langsung.
3. DILARANG menjanjikan ketersediaan pasti tanpa memeriksa.
4. Patuhi HANYA data yang diberikan di [KONTEKS DARI DATABASE] dan dokumen.

[ATURAN KRITIS: KAPAN BOLEH DAN TIDAK BOLEH BILANG "KOORDINASI KE TIM"]
- DILARANG KERAS bilang "saya koordinasi ke tim", "saya cek dulu ke tim", atau varian serupa untuk informasi yang SUDAH ADA di Knowledge Base / Deskripsi Produk/Layanan (seperti: harga, fasilitas, spesifikasi, jadwal pelaksanaan, min quantity, aturan).
- Frasa "koordinasi ke tim" HANYA BOLEH digunakan untuk hal-hal yang BENAR-BENAR TIDAK ADA di data Anda, seperti: pertanyaan custom yang tidak tercakup di KB, request khusus di luar penawaran standar, perubahan yang butuh persetujuan admin.
- Jika ragu apakah info ada di KB atau tidak, BACA ULANG bagian KNOWLEDGE BASE sebelum memutuskan. Jika ditemukan, JAWAB LANGSUNG.`;

  // ── 3. Omnichannel identity ────────────────────────────────────
  personaText += `\n\n[SISTEM IDENTITAS OMNICHANNEL]
1. Jika pengguna memberitahukan nama lengkap/panggilan mereka, Anda WAJIB LANGSUNG memanggil tool \`update_customer_name\` secara RAHASIA di background dengan parameter full_name berisi nama yang disebutkan. JANGAN gunakan tag [UPDATE_NAME:]. JANGAN tunda — panggil tool ini SEGERA saat nama terdeteksi.
2. Jika ada \`[SYSTEM_NOTE]\` mendeteksi pelanggan bernama sama di platform lain, Anda HARUS bertanya/memastikan apakah mereka orang yang sama.
3. Jika pengguna membenarkan, panggil tool \`merge_lead\` dengan parameter old_phone berisi nomor/ID lama.`;

  // ── 4. DP rules ───────────────────────────────────────────────
  if (ctx.isDpEnabled) {
    personaText += `\n\n[ATURAN PEMBAYARAN - DP (DOWN PAYMENT)]:
Sistem memberlakukan DP sebesar ${ctx.dpPercent}% dari total harga. Jika pelanggan sudah setuju memesan, beritahu bahwa mereka HANYA PERLU membayar DP sebesar ${ctx.dpPercent}% untuk mengamankan slot. Nominal DP harus disebutkan dengan jelas.`;
  } else {
    personaText += `\n\n[ATURAN PEMBAYARAN - LUNAS (FULL PAYMENT)]:
Sistem SAAT INI TIDAK menerima DP atau cicilan. Pelanggan diwajibkan membayar LUNAS (100%) untuk mengamankan pemesanan.`;
  }

  // ── 5. Email style rules ──────────────────────────────────────
  if (chatType === 'email') {
    personaText += `\n\n[ATURAN GAYA BAHASA KHUSUS EMAIL]
Karena Anda sedang membalas via EMAIL, Anda HARUS menggunakan gaya bahasa yang SANGAT PROFESIONAL, formal, dan rapi.
1. Gunakan format surat bisnis (Ada salam pembuka resmi dan salam penutup seperti "Hormat kami,").
2. DILARANG menggunakan gaya bahasa santai WA, singkatan chat, atau emotikon berlebihan.
3. Jelaskan penawaran dengan terstruktur menggunakan poin-poin/tabel Markdown.
4. JANGAN asumsikan Display Name Email adalah nama lengkap asli pelanggan.`;
  }

  // ── 6. Time context & greeting logic ─────────────────────────
  const jakartaHour = parseInt(new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false }).format(now));
  const greeting = jakartaHour >= 5 && jakartaHour < 12 ? 'Pagi'
                 : jakartaHour >= 12 && jakartaHour < 15 ? 'Siang'
                 : jakartaHour >= 15 && jakartaHour < 19 ? 'Sore'
                 : 'Malam';
  const timeString = now.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', weekday: 'long', year: 'numeric',
    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const lastChat = await prisma.chatHistory.findFirst({
    where: { tenant_id: tenantId, user_phone: userPhone },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    select: { created_at: true }
  });
  const timeSinceLastMs = lastChat?.created_at ? (now.getTime() - new Date(lastChat.created_at).getTime()) : Infinity;
  const timeSinceLastMinutes = Math.round(timeSinceLastMs / 60000);
  const isRecentChat = timeSinceLastMinutes < 120;
  const isCustomerGreeting = /^(halo|hai|hi|hello|hey|assalamualaikum|selamat|pagi|siang|sore|malam|p|kak)\b/i.test((ctx.userMessage || '').trim());

  let greetingInstruction = '';
  if (!isRecentChat) {
    greetingInstruction = `Interaksi terakhir: ${timeSinceLastMinutes > 1440 ? 'lebih dari 1 hari lalu' : `${timeSinceLastMinutes} menit lalu`}. BOLEH gunakan salam "Selamat ${greeting}" di awal (HANYA SATU KALI).`;
  } else if (isCustomerGreeting) {
    greetingInstruction = `Interaksi terakhir: ${timeSinceLastMinutes} menit lalu (sesi aktif). Customer menyapa duluan, BOLEH balas sapaan singkat seperti "Halo Kak!" (HANYA SATU KALI), lalu langsung ke inti.`;
  } else {
    greetingInstruction = `Interaksi terakhir: ${timeSinceLastMinutes} menit lalu (sesi aktif). DILARANG KERAS menggunakan salam/sapaan apapun. LANGSUNG jawab isi pesannya.`;
  }

  personaText += `\n\n[KONTEKS WAKTU SAAT INI]\nSekarang adalah: ${timeString} WIB (Jam ${jakartaHour}:xx WIB).\nSalam yang benar saat ini: "Selamat ${greeting}".\n${greetingInstruction}\nPENTING: Gunakan MAKSIMAL SATU jenis sapaan!`;

  // ── 7. Media proactive instruction ───────────────────────────
  personaText += `\n\n[INSTRUKSI PENGIRIMAN MEDIA PROAKTIF]
Jika di bagian data terdapat informasi "[MEDIA PENDUKUNG...]" berupa gambar promo, poster, atau brosur yang RELEVAN, kamu HARUS proaktif mengirimkannya.
CARA MENGIRIM MEDIA: Sisipkan tag \`[SEND_MEDIA_CTX:TIPE:ID]\` di akhir kalimatmu.
PENTING: Baca riwayat chat. Jika kamu sudah pernah mengirimkan media yang sama, JANGAN kirim ulang.`;

  ctx.personaText = personaText;

  // ── 8. Load lead & CRM data ────────────────────────────────────
  if (!userPhone) return;

  ctx.lead = await prisma.lead.findUnique({
    where: { uk_tenant_phone: { tenant_id: tenantId, phone: userPhone } }
  });

  // ── REMOVED: Auto-populate saved_name from push_name ──────────────────
  // Previously, the WhatsApp push_name (display name set by the user in their
  // WhatsApp profile) was auto-saved into saved_name so the AI would treat it
  // as the customer's real name. This caused the AI to call customers by their
  // WhatsApp display name / username, which is NOT their real name.
  //
  // Per new requirement: The AI must ONLY use a customer's name once the
  // customer has actually told us their name and it has been saved to the CRM
  // (saved_name). Usernames / display names from WhatsApp, Telegram, and
  // Instagram must NEVER be treated as the real name.
  //
  // push_name is still kept available on ctx.lead for display purposes only
  // (e.g. shown in the UI as a secondary subtitle), but it is NOT used as a
  // name source for the AI.

  // ── Ghost Timer: Cancel timer on customer reply ────────────────
  // If lead was at_risk, idle, or ghosted — they just came back, reset status.
  if (ctx.lead) {
    const ghostStatus = ctx.lead.ghost_status;
    if (ghostStatus === 'at_risk' || ghostStatus === 'idle' || ghostStatus === 'ghosted') {
      // Store previous ghost status for Stage 3 to detect "ghosted return"
      ctx.previousGhostStatus = ghostStatus;
      cancelTimer(tenantId, userPhone).catch(err =>
        console.error('[Stage2] cancelTimer failed:', err.message)
      );
    }
  }

  try {
    const [schedules, requests, offers, crmLabels, activeTransactions, activeOrder, refundRequests, rescheduleRequests, pendingGuiderRequests] = await Promise.all([
      prisma.customerSchedule.findMany({
        where: { tenant_id: tenantId, phone: userPhone }, orderBy: { schedule_date: 'desc' }, take: 3
      }),
      prisma.customerRequest.findMany({
        where: { tenant_id: tenantId, phone: userPhone }, orderBy: { created_at: 'desc' }, take: 5
      }),
      prisma.offer.findMany({
        where: { tenant_id: tenantId, phone: userPhone }, orderBy: { created_at: 'desc' }, take: 5
      }),
      prisma.customerServiceLabel.findMany({ where: { tenant_id: tenantId, phone: userPhone } })
        .then(async cLabels => {
          const labelIds = cLabels.map(l => l.label_id);
          if (!labelIds.length) return [];
          return prisma.serviceLabel.findMany({ where: { id: { in: labelIds } } });
        }),
      prisma.transaction.findMany({
        where: { tenant_id: tenantId, user_phone: userPhone, status: { notIn: ['canceled', 'completed', 'canceled_customer', 'rejected'] } },
        orderBy: { created_at: 'desc' }
      }),
      prisma.customerManagement.findFirst({
        where: { tenant_id: tenantId, phone: userPhone, status: { notIn: ['done', 'canceled_customer', 'canceled'] } },
        orderBy: { updated_at: 'desc' }
      }),
      // Edge case: active refund requests
      prisma.refundRequest.findMany({
        where: { tenant_id: tenantId, phone: userPhone, status: { in: ['pending', 'processing'] } },
        orderBy: { created_at: 'desc' }, take: 3
      }),
      // Edge case: active reschedule requests
      prisma.rescheduleRequest.findMany({
        where: { tenant_id: tenantId, phone: userPhone, status: { in: ['pending', 'processing'] } },
        orderBy: { created_at: 'desc' }, take: 3
      }),
      // Pending System Guider requests (waiting for admin to answer)
      prisma.centralInfoRequest.findMany({
        where: { tenant_id: tenantId, phone: userPhone, status: 'pending' },
        orderBy: { created_at: 'desc' }, take: 3,
        select: { id: true, questions: true, created_at: true, ai_notes: true }
      })
    ]);

    // ── Check for recently cancelled transactions ────────────────
    const cancelledTrx = await prisma.transaction.findFirst({
      where: {
        tenant_id: tenantId,
        user_phone: userPhone,
        status: { in: ['canceled', 'canceled_customer'] },
        updated_at: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      },
      orderBy: { updated_at: 'desc' }
    });

    // ── Load CRM history (last 10 events for AI context) ─────────
    const crmHistory = await prisma.customerCrmHistory.findMany({
      where: { tenant_id: tenantId, phone: userPhone },
      orderBy: { created_at: 'desc' },
      take: 10
    });

    ctx.crmData = {
      schedules, requests, offers, crmLabels, activeTransactions, activeOrder,
      pendingCentralInfo: null, pendingGuiderRequests: pendingGuiderRequests || [],
      refundRequests, rescheduleRequests,
      hasCancelledTransaction: !!cancelledTrx,
      cancelledTransaction: cancelledTrx,
      crmHistory,
    };

    if (pendingGuiderRequests && pendingGuiderRequests.length > 0) {
      console.log(`[Stage2] 📊 Found ${pendingGuiderRequests.length} pending System Guider request(s) for ${userPhone}`);
    }

    // ── Populate router signals from CRM ─────────────────────────
    ctx.routerSignals.hasOfferHistory      = offers && offers.length > 0;
    ctx.routerSignals.hasRequests          = requests && requests.length > 0;
    ctx.routerSignals.hasActiveTransaction = activeTransactions && activeTransactions.length > 0;
    ctx.routerSignals.hasActiveOrder       = !!activeOrder;
    ctx.routerSignals.hasMedia             = !!ctx.mediaUrl;

    // ── Build customerHistoryText ─────────────────────────────────
    let customerHistoryText = '';

    // ── Inject CRM journey history ───────────────────────────────
    if (crmHistory.length > 0) {
      customerHistoryText += `[RIWAYAT CRM PELANGGAN — ${crmHistory.length} event terakhir]\n` +
        crmHistory.map(h => `- [${h.created_at ? h.created_at.toISOString().split('T')[0] : '?'}] ${h.event_type}: ${h.event_detail}`).join('\n') +
        '\n\nGunakan riwayat ini untuk memahami perjalanan pelanggan dan memberikan pelayanan yang personal.\n\n';
    }

    // ── Inject lead profile for personalization ──────────────────
    const lead = ctx.lead;
    if (lead) {
      const profileParts = [];
      const confirmedName = lead.saved_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || null;
      if (confirmedName) {
        profileParts.push(`Nama (TERKONFIRMASI, boleh dipanggil): ${confirmedName}`);
      } else {
        profileParts.push(`Nama: BELUM TERKONFIRMASI (Kosong) — JANGAN panggil pelanggan dengan nama apapun, JANGAN tebak nama dari username/display name. Sapa dengan "Kak"/"Kakak" dan tanyakan namanya secara natural.`);
      }
      // push_name / username display HANYA untuk referensi, BUKAN nama asli
      if (lead.push_name)
        profileParts.push(`[Display Name Platform — BUKAN NAMA ASLI, JANGAN PERNAH dipanggil dengan ini]: ${lead.push_name}`);
      if (lead.email) profileParts.push(`Email: ${lead.email}`);
      if (lead.position_title) profileParts.push(`Jabatan: ${lead.position_title}`);
      if (lead.company_name) profileParts.push(`Perusahaan: ${lead.company_name}`);
      if (lead.industry) profileParts.push(`Industri: ${lead.industry}`);
      if (lead.company_size) profileParts.push(`Ukuran Perusahaan: ${lead.company_size}`);
      if (lead.gender) profileParts.push(`Jenis Kelamin: ${lead.gender}`);
      if (lead.birth_date) profileParts.push(`Tanggal Lahir: ${lead.birth_date instanceof Date ? lead.birth_date.toISOString().split('T')[0] : lead.birth_date}`);
      if (lead.city) profileParts.push(`Kota: ${lead.city}`);
      if (lead.country) profileParts.push(`Negara: ${lead.country}`);
      if (lead.full_address) profileParts.push(`Alamat: ${lead.full_address}`);
      if (lead.lead_source) profileParts.push(`Sumber: ${lead.lead_source}`);
      if (lead.communication_preference) profileParts.push(`Preferensi Komunikasi: ${lead.communication_preference}`);
      if (lead.preferences) profileParts.push(`Minat/Preferensi: ${lead.preferences}`);
      if (lead.personal_notes) profileParts.push(`Catatan Personal: ${lead.personal_notes}`);
      if (lead.former_services) profileParts.push(`Riwayat Layanan: ${lead.former_services}`);
      if (lead.total_spent && parseFloat(lead.total_spent) > 0)
        profileParts.push(`Total Spent: Rp ${parseFloat(lead.total_spent).toLocaleString('id-ID')}`);
      if (lead.pipeline_status) profileParts.push(`Status Pipeline: ${lead.pipeline_status}`);
      if (lead.chat_summary) profileParts.push(`Rangkuman Chat: ${lead.chat_summary}`);

      if (profileParts.length > 0) {
        const hasConfirmedName = !!confirmedName;
        customerHistoryText += `[PROFIL PELANGGAN]\n` + profileParts.join('\n') +
          (hasConfirmedName
            ? '\n\nGunakan profil ini untuk personalisasi. Panggil nama mereka, rujuk preferensi dan riwayat mereka. JANGAN tanyakan data yang sudah ada di atas!\n\n'
            : '\n\nGunakan profil ini untuk personalisasi. KARENA NAMA BELUM TERKONFIRMASI, JANGAN panggil pelanggan dengan nama apapun — sapa dengan "Kak"/"Kakak" dan tanyakan namanya secara natural. Rujuk preferensi/riwayat yang sudah ada, JANGAN tanyakan data yang sudah ada di atas!\n\n');
      }
    }

    // ── Cancelled transaction context ────────────────────────────
    if (cancelledTrx) {
      customerHistoryText += `[TRANSAKSI YANG DIBATALKAN]\n` +
        `- Order ID: ${cancelledTrx.order_id || cancelledTrx.id}\n` +
        `- Dibatalkan: ${cancelledTrx.updated_at ? cancelledTrx.updated_at.toISOString().split('T')[0] : '?'}\n` +
        `- Alasan: ${cancelledTrx.decline_reason || cancelledTrx.admin_note || 'Tidak disebutkan'}\n\n`;
    }

    if (offers && offers.length > 0) {
      customerHistoryText += `[PENAWARAN HARGA (BARGAIN) LALU]\n` + offers.map(o => {
        let line = `- Paket: ${o.package_name}\n  Harga Asli: Rp ${o.original_price}\n  Harga Tawaran: Rp ${o.offered_price}\n  Status: ${o.status.toUpperCase()}`;
        if (o.status === 'rejected' && o.admin_note) {
          line += `\n  Catatan Admin Saat Menolak: ${o.admin_note}`;
          line += `\n  Izinkan Re-Request: ${o.allow_rerequest ? 'YA' : 'TIDAK'}`;
        }
        if (o.status === 'rejected' && o.admin_offer) {
          line += `\n  Counter-Offer Admin: Rp ${o.admin_offer}`;
        }
        return line;
      }).join('\n') + '\n\nPENTING: Jika status tawaran adalah APPROVED, WAJIB gunakan "Harga Tawaran" sebagai acuan resmi.\n\n';
    }

    if (schedules.length > 0) {
      customerHistoryText += `[Jadwal Perjalanan/Pemesanan LALU]\n` + schedules.map(s =>
        `- Layan/Paket: ${s.service_label || 'Trip'}\n  Tgl: ${s.schedule_date ? s.schedule_date.toISOString().split('T')[0] : '?'} (Jam ${s.schedule_time || '-'})`
      ).join('\n') + '\n\n';
    }

    if (requests.length > 0) {
      customerHistoryText += `[Request/Booking LALU]\n` + requests.map(r =>
        `- ${r.request_type || 'Custom'}: ${r.package_name || r.request_detail} (Status: ${r.status})${r.ai_context ? `\n  Catatan Admin/Tambahan Biaya: ${r.ai_context}` : ''}`
      ).join('\n') + '\n\n';
    }

    if (crmLabels.length > 0) {
      customerHistoryText += `[Label Customer]\n` + crmLabels.map(l => l.label_name).filter(Boolean).join(', ') + '\n\n';
    }

    if (activeTransactions.length > 0) {
      customerHistoryText += `[TRANSAKSI AKTIF / INVOICE BELUM LUNAS]\n` + activeTransactions.map(trx =>
        `- Order ID: ${trx.order_id}\n` +
        `  Status: ${trx.status}\n` +
        `  Item: ${trx.items.map(i => i.item_name).join(', ')}\n` +
        `  Total: Rp ${parseFloat(trx.total_price).toLocaleString('id-ID')}\n` +
        (parseFloat(trx.dp_amount) > 0 ? `  DP Dibutuhkan: Rp ${parseFloat(trx.dp_amount).toLocaleString('id-ID')} (${trx.dp_percentage}%)\n` : '')
      ).join('\n') + '\n\n';
    }

    if (activeOrder) {
      let dateContextBlock = '';
      if (activeOrder.date_status === 'pending_approval') {
        dateContextBlock = `- ⏳ STATUS TANGGAL: MENUNGGU PERSETUJUAN ADMIN\n- Tanggal diminta: ${activeOrder.requested_date ? activeOrder.requested_date.toISOString().split('T')[0] : 'Belum disebutkan'}\n- Beritahu pelanggan bahwa tanggal masih dikonfirmasi admin.\n\n`;
      } else if (activeOrder.date_status === 'approved') {
        dateContextBlock = `- ✅ STATUS TANGGAL: SUDAH DISETUJUI ADMIN\n- Tanggal pelaksanaan/pengiriman: ${activeOrder.departure_date ? activeOrder.departure_date.toISOString().split('T')[0] : '-'}\n${activeOrder.ai_context_notes ? `- Catatan Admin: ${activeOrder.ai_context_notes}\n` : ''}- Lanjutkan ke tahap berikutnya (konfirmasi produk/layanan, jumlah kuantitas, negosiasi harga, pembuatan invoice).\n\n`;
      } else if (activeOrder.date_status === 'rejected') {
        let suggestedDatesText = 'Tidak ada';
        try {
          const parsed = JSON.parse(activeOrder.date_suggested || '[]');
          if (parsed.length > 0) suggestedDatesText = parsed.join(', ');
        } catch (e) { suggestedDatesText = activeOrder.date_suggested || 'Tidak ada'; }
        dateContextBlock = `- ❌ STATUS TANGGAL: DITOLAK ADMIN\n- Tanggal ditolak: ${activeOrder.requested_date ? activeOrder.requested_date.toISOString().split('T')[0] : '-'}\n- Alasan: ${activeOrder.date_reject_reason || 'Tidak disebutkan'}\n- Tanggal alternatif: ${suggestedDatesText}\n- WAJIB sampaikan alasan penolakan dan tawarkan tanggal alternatif.\n\n`;
      }

      let collectedDataBlock = '';
      if (activeOrder.collected_data) {
        try {
          const cd = JSON.parse(activeOrder.collected_data);
          if (Object.keys(cd).length > 0) collectedDataBlock = `- Data terkumpul: ${Object.entries(cd).map(([k, v]) => `${k}=${v}`).join(', ')}\n`;
        } catch (e) {}
      }

      customerHistoryText += `[STATUS PESANAN AKTIF SAAT INI]\n` +
        `- Nama: ${activeOrder.customer_name || 'Belum diketahui'}\n` +
        `- Paket: ${activeOrder.package_name || 'Belum diketahui'}\n` +
        `- Keberangkatan: ${activeOrder.departure_date ? activeOrder.departure_date.toISOString().split('T')[0] : 'Belum diketahui'}\n` +
        `- Status CRM: ${activeOrder.status}\n` +
        collectedDataBlock +
        `- Catatan Detail: ${activeOrder.admin_note || 'Belum ada detail khusus'}\n\n` +
        dateContextBlock +
        `PENTING: Selalu gunakan informasi dari [STATUS PESANAN AKTIF SAAT INI] ini jika pelanggan menanyakan detail pesanan.\n\n`;
    }

    // ── Activity Summary — Comprehensive status of all pending activities ──
    customerHistoryText += buildActivitySummary({
      pendingGuiderRequests: pendingGuiderRequests || [],
      activeTransactions: activeTransactions || [],
      activeOrder,
      requests: requests || [],
      offers: offers || [],
      refundRequests: refundRequests || [],
      rescheduleRequests: rescheduleRequests || [],
      now,
    });

    ctx.customerHistoryText = customerHistoryText;
  } catch (err) {
    console.error('[Stage2] Failed to fetch CRM data:', err.message);
  }

  // ── 9. Order Form (Dynamic — linked to active package) ──────
  try {
    let formConfigs = [];
    let activeForm = await prisma.orderForm.findFirst({
      where: { tenant_id: tenantId, phone: userPhone, status: { in: ['collecting', 'pending_confirm'] } },
      orderBy: { updated_at: 'desc' }
    });

    let currentData = activeForm ? JSON.parse(activeForm.form_data || '{}') : {};
    let matchedPackageName = currentData.paket || currentData.package || currentData.paket_yang_diambil || null;
    let matchedPackageId = null;

    // ── Determine which package the customer is interested in ──
    // Priority: active_topics > CustomerManagement > existing form data
    if (!matchedPackageName && ctx.lead?.active_topics) {
      try {
        const topics = JSON.parse(ctx.lead.active_topics);
        if (Array.isArray(topics) && topics.length > 0) {
          matchedPackageName = topics[0]; // First active topic = primary package
        }
      } catch {}
    }
    if (!matchedPackageName) {
      // Check CustomerManagement for pending order
      try {
        const cm = await prisma.customerManagement.findFirst({
          where: { tenant_id: tenantId, phone: userPhone, status: { notIn: ['completed', 'canceled', 'canceled_customer'] } },
          orderBy: { updated_at: 'desc' },
          select: { package_name: true }
        });
        if (cm?.package_name) matchedPackageName = cm.package_name;
      } catch {}
    }

    // ── Find package-specific form config ──
    if (matchedPackageName) {
      // Try Basic package first (travel_package_id) — full name match
      let basicPkg = await prisma.travelPackage.findFirst({
        where: { tenant_id: tenantId, package_name: { contains: matchedPackageName } },
        select: { id: true, package_name: true }
      });

      // If full match fails, try word-by-word fuzzy match (first meaningful word)
      if (!basicPkg) {
        const firstWord = matchedPackageName.split(/\s+/).find(w => w.length >= 3) || matchedPackageName;
        basicPkg = await prisma.travelPackage.findFirst({
          where: { tenant_id: tenantId, package_name: { contains: firstWord } },
          select: { id: true, package_name: true }
        });
        if (basicPkg) {
          console.log(`[Stage2] 📋 Fuzzy-matched package: "${matchedPackageName}" → "${basicPkg.package_name}"`);
        }
      }

      if (basicPkg) {
        matchedPackageId = basicPkg.id;
        formConfigs = await prisma.orderFormConfig.findMany({
          where: { tenant_id: tenantId, travel_package_id: basicPkg.id },
          orderBy: { sort_order: 'asc' }
        });
      }
    }

    // Fallback 1: global form configs (no package linkage)
    if (formConfigs.length === 0) {
      formConfigs = await prisma.orderFormConfig.findMany({
        where: { tenant_id: tenantId, advanced_package_id: null, travel_package_id: null },
        orderBy: { sort_order: 'asc' }
      });
    }

    // Fallback 2 (CRITICAL): load ALL tenant form configs if nothing found yet.
    // This handles the case where form configs are package-linked but the name
    // matching above failed — we should never leave formConfigs empty when the
    // admin has clearly defined forms in the system.
    if (formConfigs.length === 0) {
      formConfigs = await prisma.orderFormConfig.findMany({
        where: { tenant_id: tenantId },
        orderBy: { sort_order: 'asc' }
      });
      if (formConfigs.length > 0) {
        console.log(`[Stage2] ⚠️ Package match failed — using all ${formConfigs.length} tenant form config(s) as catch-all fallback`);
      }
    }

    // ── Auto-create form when form configs are available and no active form yet ──
    // FIX: Removed `&& matchedPackageName` gate — form should auto-create whenever
    // there are configs defined (even without a matched package name), because
    // form configs are set up by admin for ALL customers, not just package-specific ones.
    if (formConfigs.length > 0 && !activeForm) {
      // Pre-fill known data from conversation context
      const preFilled = {};
      
      // Pre-fill package name if known
      if (matchedPackageName) preFilled.paket = matchedPackageName;

      // Pre-fill customer name from Lead (including auto-populated push_name)
      const customerName = ctx.lead?.saved_name || [ctx.lead?.first_name, ctx.lead?.last_name].filter(Boolean).join(' ') || null;
      if (customerName && customerName !== '----') {
        // Find the "nama" field key from configs
        const nameField = formConfigs.find(f => /nama/i.test(f.field_key));
        if (nameField) preFilled[nameField.field_key] = customerName;
      }

      // Pre-fill email from Lead
      if (ctx.lead?.email) {
        const emailField = formConfigs.find(f => /email/i.test(f.field_key));
        if (emailField) preFilled[emailField.field_key] = ctx.lead.email;
      }

      // Pre-fill phone
      const phoneField = formConfigs.find(f => /telp|phone|hp|telepon/i.test(f.field_key));
      if (phoneField) preFilled[phoneField.field_key] = userPhone;

      // Pre-fill from CustomerManagement collected_data
      try {
        const cm = await prisma.customerManagement.findFirst({
          where: { tenant_id: tenantId, phone: userPhone, status: { notIn: ['completed', 'canceled', 'canceled_customer'] } },
          orderBy: { updated_at: 'desc' }
        });
        if (cm?.collected_data) {
          const cmData = JSON.parse(cm.collected_data);
          for (const [key, val] of Object.entries(cmData)) {
            const matchField = formConfigs.find(f => 
              f.field_key.toLowerCase() === key.toLowerCase() ||
              f.field_label.toLowerCase().includes(key.toLowerCase())
            );
            if (matchField && val && !preFilled[matchField.field_key]) {
              preFilled[matchField.field_key] = val;
            }
          }
        }
      } catch {}

      // Create the form
      activeForm = await prisma.orderForm.create({
        data: {
          tenant_id: tenantId,
          phone: userPhone,
          customer_name: customerName,
          form_data: JSON.stringify(preFilled),
          status: 'collecting'
        }
      });
      currentData = preFilled;
      
      const preFilledFields = Object.keys(preFilled).filter(k => preFilled[k]);
      console.log(`[Stage2] 📋 Auto-created order form #${activeForm.id} (pkg: ${matchedPackageName || 'unknown'}) with ${preFilledFields.length} pre-filled field(s): ${preFilledFields.join(', ')}`);
    }

    if (formConfigs.length > 0) {
      const fieldList = formConfigs.map(f =>
        `- ${f.field_key} (${f.field_label})${f.is_required ? ' [WAJIB]' : ' [Opsional]'}${f.placeholder ? ` — Hint: ${f.placeholder}` : ''}`
      ).join('\n');

      const filledEntries = Object.entries(currentData).filter(([, v]) => v && v !== '');
      const filledText = filledEntries.length > 0 ? filledEntries.map(([k, v]) => `- ${k}: ${v}`).join('\n') : 'Belum ada data yang terisi.';
      const emptyRequired = formConfigs.filter(f => f.is_required && (!currentData[f.field_key] || currentData[f.field_key] === '')).map(f => f.field_label);
      const emptyText = emptyRequired.length > 0 ? `Field wajib yang MASIH KOSONG: ${emptyRequired.join(', ')}` : '✅ Semua field wajib sudah terisi!';

      // Build a precise "next field to ask" hint to prevent AI from being vague
      const nextRequiredField = formConfigs.find(f => f.is_required && (!currentData[f.field_key] || currentData[f.field_key] === ''));
      const nextFieldHint = nextRequiredField
        ? `\n\n🎯 FIELD BERIKUTNYA YANG HARUS DITANYAKAN: "${nextRequiredField.field_label}" (key: ${nextRequiredField.field_key})${nextRequiredField.placeholder ? ` — Contoh: ${nextRequiredField.placeholder}` : ''}`
        : '';

      ctx.personaText += `\n\n[SISTEM FORM PESANAN BELAKANG LAYAR — WAJIB DIGUNAKAN]
Anda memiliki formulir pesanan aktif yang HARUS diisi secara bertahap.
Paket terkait: ${matchedPackageName || '(belum ditentukan)'}

Field formulir yang tersedia:
${fieldList}

Data yang sudah terisi:
${filledText}

${emptyText}${nextFieldHint}

ATURAN WAJIB FORM — BACA DAN PATUHI:
1. SIMPAN LANGSUNG: Setiap kali customer memberikan info yang cocok dengan field di atas, LANGSUNG panggil tool "update_order_form" — jangan tunggu, jangan tanya ulang!
   Contoh: Customer bilang "email saya budi@gmail.com" → panggil update_order_form({ field_updates: { email: "budi@gmail.com" } })
2. GUNAKAN FIELD KEY YANG TEPAT sesuai daftar di atas (bukan nama bebas).
3. TANYAKAN SATU FIELD: Jika ada field wajib kosong, tanyakan HANYA SATU field berikutnya. JANGAN tanya pertanyaan terbuka seperti "ada yang ingin ditanyakan?". Langsung tanya field spesifik yang kosong!
4. JIKA CUSTOMER BILANG "LANJUT/OKE/SETUJU/PROCEED": Ini sinyal untuk SEGERA mulai mengumpulkan data. Panggil update_order_form untuk data yang sudah diketahui dari percakapan, lalu tanyakan field wajib berikutnya yang kosong secara langsung.
5. JIKA SEMUA FIELD WAJIB TERISI: Tampilkan ringkasan data lalu panggil tool "confirm_order_form" untuk mengunci form.
6. SETELAH CUSTOMER KONFIRMASI BENAR: Panggil tool "finalize_order_form" untuk memproses pesanan menjadi booking + invoice.
7. JIKA CUSTOMER KOREKSI DATA: Panggil update_order_form dengan data koreksi, lalu tampilkan ringkasan ulang.
8. DILARANG KERAS: Jangan panggil confirm_order_form jika masih ada field wajib kosong!
9. DILARANG: Jangan tanyakan informasi yang sudah tersimpan di "Data yang sudah terisi" di atas!`;
    }
  } catch (err) {
    console.error('[Stage2] Failed to inject order form:', err.message);
  }

  // ── 10. Chat history ──────────────────────────────────────────
  const chats = await prisma.chatHistory.findMany({
    where: { tenant_id: tenantId, user_phone: userPhone }, orderBy: [{ created_at: 'asc' }, { id: 'asc' }]
  });

  let historicalChats = [...chats];
  ctx.currentMediaSummary = null;
  ctx.currentMediaData = null;

  // Pop trailing user messages to avoid duplication
  while (historicalChats.length > 0 && historicalChats[historicalChats.length - 1].role === 'user') {
    const popped = historicalChats.pop();
    if (popped.media_summary && !ctx.currentMediaSummary) {
      try {
        const parsed = JSON.parse(popped.media_summary);
        if (parsed && typeof parsed === 'object' && parsed.image_category) {
          ctx.currentMediaData = parsed;
          ctx.currentMediaSummary = parsed.summary || 'Gambar dilampirkan';
        } else {
          ctx.currentMediaSummary = popped.media_summary;
        }
      } catch (e) { ctx.currentMediaSummary = popped.media_summary; }
    }
  }

  // Media send history for dedup
  ctx.mediaSendHistory = await getMediaSendHistory(tenantId, userPhone);
  if (ctx.mediaSendHistory.length > 0) {
    ctx.sentMediaHistoryText = '\n[CATATAN PENGIRIMAN DOKUMEN/MEDIA TERAKHIR OLEH AI]\nPENTING: Jangan mengirimkan dokumen/media yang SAMA jika sudah dikirim baru-baru ini:\n';
    ctx.mediaSendHistory.slice(0, 5).forEach(m => {
      let detail = m.event_detail;
      try { const parsed = JSON.parse(m.event_detail); detail = parsed.description || m.event_detail; } catch {}
      ctx.sentMediaHistoryText += `- Pada ${m.created_at.toLocaleString('id-ID')}: ${detail}\n`;
    });
  }

  ctx.chatHistory = historicalChats;

  const formatChat = (c) => {
    let summaryText = c.media_summary;
    if (summaryText) {
      try { const p = JSON.parse(summaryText); if (p?.summary) summaryText = p.summary; } catch {}
    }
    return `[${c.role.toUpperCase()}]: ${c.message}${summaryText ? `\n(AI Note: Gambar dilampirkan. Rangkuman: ${summaryText})` : ''}`;
  };

  const totalChats = historicalChats.length;
  if (totalChats <= 20) {
    ctx.longTermMemory = historicalChats.map(formatChat).join('\n');
  } else {
    const top5   = historicalChats.slice(0, 5).map(formatChat).join('\n');
    const bottom15 = historicalChats.slice(totalChats - 15).map(formatChat).join('\n');
    const summary = ctx.lead?.chat_summary || 'Tidak ada ringkasan percakapan tengah.';
    ctx.longTermMemory = `[AWAL PERCAKAPAN]\n${top5}\n\n[RINGKASAN LALU]\n${summary}\n\n[15 PERCAKAPAN TERAKHIR SEBELUM PESAN INI]\n${bottom15}`;
  }

  // ── 10b. Embedding-based memory recall (3rd memory layer) ─────
  // Only active when there are chats outside the sliding window
  if (totalChats > 20 && ctx.lead?.id) {
    try {
      const { recallRelevantChats } = await import('../../chatMemory.service.js');
      const recall = await recallRelevantChats(tenantId, ctx.lead.id, ctx.userMessage, 3);
      if (recall.found && recall.chunks.length > 0) {
        const recalledText = recall.chunks
          .map((c, i) => `[Percakapan Relevan #${i + 1} (skor: ${c.score.toFixed(2)})]:\n${c.text}`)
          .join('\n\n');
        ctx.longTermMemory += `\n\n[MEMORI RELEVAN DARI PERCAKAPAN LALU — ditemukan via pencarian semantik]\n${recalledText}`;
        console.log(`[Stage2] 🧠 Chat memory recall: ${recall.chunks.length} relevant chunk(s) injected`);
      }
    } catch (recallErr) {
      console.error('[Stage2] Chat memory recall error:', recallErr.message);
    }
  }

  ctx.chatHistorySnippet = historicalChats.slice(-10).map(formatChat).join('\n');

  // ── 11. Trigger background summarization ───────────────────────
  if (ctx.lead) {
    const newMsgCount = (ctx.lead.msg_count_since_summary || 0) + 1;
    await prisma.lead.update({ where: { id: ctx.lead.id }, data: { msg_count_since_summary: newMsgCount } });
    if (newMsgCount >= 5) {
      triggerBackgroundSummarization(tenantId, userPhone).catch(err => console.error('[Stage2]', err));
    }
  }

  // ── 12. System Guider todo injection (Path C) ──────────────────
  // If any guider todos are queued/executing for this customer, inject them
  // into the pipeline context so the AI can deliver them as part of its response.
  try {
    const queuedTodos = await prisma.systemGuiderTodo.findMany({
      where: {
        tenant_id: tenantId,
        phone: userPhone,
        status: { in: ['queued', 'executing'] }
      },
      orderBy: { created_at: 'asc' }
    });

    if (queuedTodos.length > 0) {
      // Mark as pipeline_injected immediately so executeTodo skips them
      await prisma.systemGuiderTodo.updateMany({
        where: { id: { in: queuedTodos.map(t => t.id) } },
        data: { status: 'pipeline_injected' }
      });

      // Fetch required_info fact sheet from the request (for exact values)
      const requestIds = [...new Set(queuedTodos.map(t => t.request_id))];
      const requests = await prisma.centralInfoRequest.findMany({
        where: { id: { in: requestIds } },
        select: { id: true, required_info: true }
      });
      const reqMap = Object.fromEntries(requests.map(r => [r.id, r.required_info]));

      const todoLines = queuedTodos.map(t => {
        const fields = Array.isArray(reqMap[t.request_id])
          ? reqMap[t.request_id].filter(f => f.answered && f.value)
          : [];
        const factStr = fields.length > 0
          ? ' | Data: ' + fields.map(f => `${f.label}: ${f.value}`).join(', ')
          : '';
        return `- ${t.instruction}${factStr}`;
      }).join('\n');

      ctx.longTermMemory = (ctx.longTermMemory || '') +
        `\n\n[INSTRUKSI DARI ADMIN — WAJIB DISAMPAIKAN DALAM RESPONS INI]\n` +
        `Selain menjawab pesan customer, admin telah memberikan instruksi berikut yang HARUS kamu gabungkan secara natural dalam balasanmu:\n` +
        todoLines +
        `\n\nPENTING: Gunakan nilai angka/harga PERSIS seperti tertulis. Jangan ubah atau tambah informasi lain.`;

      ctx.pendingGuiderTodos = queuedTodos;
      console.log(`[Stage2] 📋 Injected ${queuedTodos.length} queued guider todo(s) for ${userPhone}`);
    }
  } catch (injectErr) {
    console.error('[Stage2] Guider todo injection error:', injectErr.message);
  }

  // ── 12b. Todo Questions (type: 'question') — inject SEPARATE from action todos ──
  // These are questions admin wants AI to ask customer before making a decision.
  try {
    // Questions not yet asked to customer
    const pendingQuestions = await prisma.systemGuiderTodo.findMany({
      where: {
        tenant_id: tenantId,
        phone: userPhone,
        todo_type: 'question',
        status: 'pending_customer'
      },
      orderBy: { created_at: 'asc' }
    });

    if (pendingQuestions.length > 0) {
      ctx.pendingTodoQuestions = pendingQuestions;
      // Only inject the FIRST one — one question at a time per plan
      const firstQ = pendingQuestions[0];
      ctx.personaText += `\n\n[PERTANYAAN YANG HARUS DITANYAKAN KE CUSTOMER — BACKGROUND TASK]\nAdmin/sistem meminta Anda menggali informasi dari customer secara natural sebelum keputusan bisa diambil.\n\nPertanyaan yang HARUS ditanyakan:\n- [Todo ID: ${firstQ.id}] "${firstQ.question_text}"\n${pendingQuestions.length > 1 ? `(Ada ${pendingQuestions.length - 1} pertanyaan lain, tanyakan satu per satu di percakapan berikutnya)\n` : ''}
ATURAN WAJIB:
1. Tanyakan poin di atas secara NATURAL dalam percakapan — jangan terasa seperti kuesioner
2. Gabungkan dengan topik percakapan yang sedang berjalan
3. Setelah menanyakan, WAJIB panggil tool "mark_todo_question_asked" secara background dengan todo_id = ${firstQ.id}
4. JANGAN beritahu customer bahwa ini "tugas dari admin" — lakukan seolah Anda sendiri yang penasaran
5. Jika pertanyaan tidak relevan dengan konteks percakapan saat ini, tunda ke percakapan berikutnya`;
      console.log(`[Stage2] 💬 Injected ${pendingQuestions.length} pending todo question(s) for ${userPhone} (showing first: #${firstQ.id})`);
    }

    // Questions already asked — detect if customer is answering now
    const askedQuestions = await prisma.systemGuiderTodo.findMany({
      where: {
        tenant_id: tenantId,
        phone: userPhone,
        todo_type: 'question',
        status: 'asked'
      },
      orderBy: { asked_at: 'asc' }
    });

    if (askedQuestions.length > 0) {
      ctx.askedTodoQuestions = askedQuestions;
      const qList = askedQuestions.map((q, i) =>
        `${i + 1}. [Todo ID: ${q.id}] "${q.question_text}"`
      ).join('\n');

      ctx.personaText += `\n\n[PERTANYAAN YANG SUDAH DITANYAKAN — DETEKSI JAWABAN CUSTOMER]\nAnda pernah menanyakan hal-hal berikut dan sedang menunggu jawaban dari customer:\n${qList}\n\nATURAN WAJIB:\n1. Jika pesan customer saat ini MENJAWAB atau RELEVAN dengan salah satu pertanyaan di atas, langsung panggil tool "answer_todo_question" secara background\n2. Gunakan todo_id yang sesuai dan customer_answer berisi inti jawaban customer\n3. Lanjutkan percakapan normal — jangan sebutkan ke customer bahwa jawaban mereka sedang diteruskan ke admin\n4. Jika customer menjawab dengan ambigu atau belum menjawab pertanyaannya, jangan panggil tool ini`;
      console.log(`[Stage2] 👂 Injected ${askedQuestions.length} asked todo question(s) for ${userPhone} — AI will detect answers`);
    }
  } catch (qErr) {
    console.error('[Stage2] Todo question injection error:', qErr.message);
  }

  // ── 12c. CM Item Pending Questions — detect customer answers ───
  // When admin sets a pending_question on a CmRequestItem via CM Copilot sidebar
  try {
    const cmPendingQuestions = await prisma.cmRequestItem.findMany({
      where: {
        tenant_id: tenantId,
        phone: userPhone,
        status: { in: ['pending_question', 'question_asked'] },
        pending_question: { not: null }
      },
      orderBy: { updated_at: 'asc' }
    });

    if (cmPendingQuestions.length > 0) {
      const notAsked = cmPendingQuestions.filter(i => i.status === 'pending_question');
      const alreadyAsked = cmPendingQuestions.filter(i => i.status === 'question_asked');

      // Inject the first un-asked one
      if (notAsked.length > 0) {
        const firstCmQ = notAsked[0];
        ctx.personaText += `\n\n[PERTANYAAN CM ITEM YANG HARUS DITANYAKAN]\nUntuk keputusan request customer, admin perlu informasi berikut:\n- [Item ID: ${firstCmQ.id}] Terkait "${firstCmQ.title}": "${firstCmQ.pending_question}"\n\nATURAN:\n1. Tanyakan secara natural, jangan langsung ke poinnya\n2. Setelah menanyakan, panggil tool "mark_todo_question_asked" (gunakan item_id bukan todo_id — SKIP jika tidak ada todo terkait, cukup tanyakan saja)\n3. Update status item dengan cara natural saja`;
      }

      // Inject detection for already-asked ones
      if (alreadyAsked.length > 0) {
        const qList = alreadyAsked.map((q, i) =>
          `${i + 1}. [Item ID: ${q.id}] Terkait "${q.title}": "${q.pending_question}"`
        ).join('\n');
        ctx.personaText += `\n\n[PERTANYAAN CM ITEM — DETEKSI JAWABAN CUSTOMER]\nPertanyaan yang sudah ditanyakan dan menunggu jawaban:\n${qList}\n\nATURAN:\n1. Jika pesan customer menjawab salah satu pertanyaan di atas, langsung panggil tool "answer_cm_item_question" dengan item_id yang sesuai\n2. Lanjutkan percakapan normal`;
      }

      console.log(`[Stage2] 📋 CM pending questions: ${notAsked.length} not-asked, ${alreadyAsked.length} awaiting answer for ${userPhone}`);
    }
  } catch (cmQErr) {
    console.error('[Stage2] CM item question injection error:', cmQErr.message);
  }

  // ── 12d. Open Questions — proactive follow-up from System Guider ──
  // When AI has sent follow-up questions to customer via NEED_INFO_CARD,
  // detect answers and fill them into open_questions on Lead.
  try {
    const openQuestions = ctx.lead?.open_questions;
    if (Array.isArray(openQuestions) && openQuestions.length > 0) {
      const unanswered = openQuestions.filter(q => !q.answered);
      const answered = openQuestions.filter(q => q.answered);

      if (unanswered.length > 0) {
        const qList = openQuestions.map((q, i) => {
          const status = q.answered ? `✅ TERJAWAB: "${q.answer}"` : '❌ BELUM TERJAWAB';
          return `${i + 1}. [key: ${q.key}] "${q.question}" → ${status}`;
        }).join('\n');

        ctx.personaText += `\n\n[OPEN QUESTIONS — DETEKSI JAWABAN CUSTOMER — PRIORITAS TERTINGGI]
Anda sebelumnya sudah menanyakan pertanyaan-pertanyaan berikut ke customer sebagai follow-up dari System Guider:
${qList}

Progress: ${answered.length}/${openQuestions.length} terjawab

⚠️ ATURAN WAJIB — TIDAK BOLEH DILANGGAR:
1. SEBELUM menjawab apapun, CEK DULU: apakah pesan customer saat ini MENJAWAB salah satu pertanyaan ❌ di atas?
   - Contoh: Jika pertanyaan ❌ adalah "Dari perusahaan mana?" dan customer bilang "dari PT ABC" → INI ADALAH JAWABAN! SEGERA panggil tool "answer_open_question" dengan question_key dan answer.
   - Contoh: Jika pertanyaan ❌ adalah "Preferensi hotel bintang berapa?" dan customer bilang "bintang 4" → INI ADALAH JAWABAN!
2. Jika customer tidak bisa menjawab (bilang "tidak tahu", "gatau", "nanti aja", dll), panggil tool "answer_open_question" dengan answer = "Customer tidak bisa menjawab: [alasan]".
3. Setelah SEMUA pertanyaan terjawab (tidak ada ❌ lagi), SEGERA panggil tool "complete_open_questions" secara background.
4. JANGAN beritahu customer bahwa jawaban mereka diteruskan ke admin.
5. Lanjutkan percakapan dengan natural — bukan kuesioner kaku.
6. Jika customer menjawab beberapa pertanyaan sekaligus, panggil tool SATU PER SATU untuk setiap jawaban.

🚨 LARANGAN KERAS:
- DILARANG bilang "sudah mendapatkan konfirmasi dari tim" atau "paket tersedia" atau "siap dipesan" JIKA admin BELUM memberikan instruksi melalui System Guider.
- Anda HANYA mengumpulkan data dari customer — BUKAN memberikan konfirmasi ketersediaan.
- Setelah data terkumpul, yang benar adalah: "Terima kasih datanya, Kak. Saya akan konfirmasikan ke tim terkait ya 🙏"`;

        console.log(`[Stage2] 🔍 Open questions injected for ${userPhone}: ${unanswered.length} unanswered of ${openQuestions.length}`);
      }
    }
  } catch (oqErr) {
    console.error('[Stage2] Open questions injection error:', oqErr.message);
  }

  // ── 13. Deferred Guidance Intent injection ─────────────────────
  // If there's a pending deferred guidance intent, inject it so AI knows
  // to continue collecting data before sending to System Guider.
  try {
    const { getIntent } = await import('../../deferredGuidance.service.js');
    const deferredIntent = await getIntent(tenantId, userPhone);

    if (deferredIntent && Array.isArray(deferredIntent.requiredData)) {
      const questionText = deferredIntent.question || '(pertanyaan tidak terdeteksi)';

      const collectedFields = deferredIntent.requiredData
        .filter(f => f.collected)
        .map(f => `  ✅ ${f.label || f.key}: ${deferredIntent.collectedValues?.[f.key] || '?'}`)
        .join('\n');

      const missingFields = deferredIntent.requiredData
        .filter(f => !f.collected)
        .map(f => `  ❌ ${f.label || f.key} (Key: "${f.key}"): (belum didapatkan)`)
        .join('\n');

      ctx.personaText += `\n\n[RENCANA TERTUNDA — PENGUMPULAN DATA SEBELUM KIRIM KE ADMIN — PRIORITAS TINGGI]
Anda memiliki rencana untuk mengirim request ke System Guider tentang:
"${questionText}"

Status data yang dibutuhkan:
${collectedFields}
${missingFields}

⚠️ ATURAN WAJIB — TIDAK BOLEH DILANGGAR:
1. 🚨 KRITIS — CEK RIWAYAT CHAT TERLEBIH DAHULU: Sebelum menanyakan data ❌ ke customer, BACA ULANG seluruh riwayat percakapan di atas. Jika customer SUDAH PERNAH menyebutkan informasi terkait (misalnya: sudah bilang jumlah peserta, sudah sebut nama, sudah kasih tanggal), JANGAN TANYAKAN LAGI! Langsung panggil tool "collect_deferred_data" dengan data yang sudah ada di percakapan.
   - CONTOH: Customer sebelumnya bilang "47 pax" → DILARANG KERAS tanya ulang "berapa orang?" → LANGSUNG panggil collect_deferred_data(key: "quantity", value: "47")
2. Tanyakan data yang masih ❌ DAN BELUM PERNAH DISEBUTKAN CUSTOMER secara natural — MAKS 1-2 pertanyaan per respons.
3. ⚡ KRITIS: Setiap kali customer memberikan jawaban/informasi untuk data ❌ di atas, Anda WAJIB LANGSUNG panggil tool "collect_deferred_data" dengan key yang sesuai untuk menyimpannya.
   - Contoh: Customer bilang "bintang 3" untuk key "preference" → PANGGIL collect_deferred_data(key: "preference", value: "bintang 3")
   - Contoh: Customer bilang "PT ABC" untuk key "company_name" → PANGGIL collect_deferred_data(key: "company_name", value: "PT ABC")
   - JIKA ANDA TIDAK MEMANGGIL tool "collect_deferred_data", DATA TIDAK AKAN TERCATAT DAN REQUEST TIDAK AKAN PERNAH TERKIRIM KE ADMIN!
4. JANGAN sebutkan bahwa Anda sedang "mengumpulkan data" — lakukan secara halus dan natural.
5. Jika customer berubah pikiran atau bilang tidak jadi, panggil tool "cancel_deferred_guidance".
6. Setelah SEMUA data terkumpul (semua ❌ berubah menjadi ✅), request akan OTOMATIS dikirim ke admin secara di belakang layar.
7. DILARANG bilang "sudah mendapatkan konfirmasi dari tim" atau "paket tersedia" — admin BELUM menjawab.`;

      ctx.hasDeferredGuidance = true;
      console.log(`[Stage2] 📋 Deferred guidance intent loaded for ${userPhone}: "${questionText.substring(0, 60)}" | Missing: ${deferredIntent.requiredData.filter(f => !f.collected).length} field(s)`);
    }
  } catch (deferErr) {
    console.error('[Stage2] Deferred guidance injection error:', deferErr.message);
  }
};
