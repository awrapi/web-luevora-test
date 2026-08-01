import prisma from '../../config/database.js';
import { executeFastJsonAI, executePlainAI } from './logic.service.js';
import { documentReaderService } from './documentReader.service.js';
import { searchSemantic } from './vector.service.js';
import { searchWeb, formatSearchResults } from './webSearch.service.js';

// Kamus Tabel (Table Registry) yang menjelaskan fungsi tabel-tabel sistem secara ringkas dan aman.
// Tabel sensitif seperti Tenant tidak diekspos ke AI.
const TABLE_REGISTRY = {
  Lead: {
    description: "Data prospek/lead masuk. Termasuk nama, nomor, status funnel (baru/prospek/negosiasi/jadi/batal), label (potensial/panas/dingin/tidak_relevan), ringkasan chat, preferensi, kapan terakhir ada pesan (last_message_at), dan apakah sedang di-handle manual oleh admin (is_manual).",
    safe_fields: ["id", "phone", "push_name", "saved_name", "status", "label", "email", "preferences", "chat_summary", "last_message_preview", "last_message_at", "is_manual", "channel", "created_at", "updated_at"],
    searchable_fields: ["push_name", "saved_name", "phone", "preferences", "chat_summary", "email", "last_message_preview"]
  },
  Transaction: {
    description: "Transaksi pembayaran. Status: pending/sign/verified/done/failed. Termasuk nama pelanggan, nominal, bank, tanggal deteksi, catatan admin.",
    safe_fields: ["id", "order_id", "user_phone", "customer_name", "destination", "pax_count", "total_price", "status", "payment_flow", "detected_amount", "detected_bank", "detected_date", "sender_name", "admin_note", "created_at", "updated_at"],
    searchable_fields: ["order_id", "user_phone", "customer_name", "destination", "sender_name", "admin_note"]
  },
  TravelBooking: {
    description: "Pemesanan/booking produk atau layanan. Berisi jadwal, jumlah peserta/kuantitas, status booking dan pembayaran. Penting untuk memantau siapa yang terjadwal dalam waktu dekat.",
    safe_fields: ["id", "phone", "customer_name", "travel_package_id", "package_name", "pax_count", "departure_date", "return_date", "total_price", "status", "payment_status", "booking_code", "booking_source", "destination", "created_at", "updated_at"],
    searchable_fields: ["phone", "customer_name", "package_name", "booking_code", "destination"]
  },
  CustomerRequest: {
    description: "Request atau keluhan pelanggan yang perlu ditangani admin. Status: pending/resolved. Berisi detail kebutuhan khusus pelanggan yang AI tidak bisa handle sendiri.",
    safe_fields: ["id", "phone", "customer_name", "request_type", "request_detail", "package_name", "status", "admin_note", "created_at", "updated_at"],
    searchable_fields: ["phone", "customer_name", "request_detail", "package_name", "admin_note"]
  },
  Offer: {
    description: "Data penawaran/tawar-menawar harga paket. Pelanggan minta harga khusus dan admin bisa approve/reject. Status: pending (menunggu keputusan admin), approved (disetujui), rejected (ditolak), active, inactive. Berisi harga asli (original_price), harga yang diminta pelanggan (offered_price), dan harga yang ditawarkan admin balik (admin_offer).",
    safe_fields: ["id", "phone", "customer_name", "package_name", "original_price", "offered_price", "admin_offer", "status", "created_at", "updated_at"],
    searchable_fields: ["phone", "customer_name", "package_name"]
  },
  CustomerManagement: {
    description: "Pipeline CRM untuk tracking status pelanggan dari tahap awal sampai selesai. Status: waiting_offer (menunggu penawaran), pending (proses), approved (deal/setuju), rejected (batal/tidak jadi). Berisi nama, paket yang diminati, tanggal keberangkatan, dan catatan admin.",
    safe_fields: ["id", "phone", "customer_name", "package_name", "departure_date", "status", "admin_note", "created_at", "updated_at"],
    searchable_fields: ["phone", "customer_name", "package_name", "admin_note"]
  },
  StatusInformation: {
    description: "Catatan informasi/update status khusus untuk pelanggan tertentu. Berisi tipe info (info_type) dan detail pesan. Berguna untuk tracking komunikasi atau catatan penting terkait pelanggan.",
    safe_fields: ["id", "phone", "customer_name", "info_type", "detail", "created_at"],
    searchable_fields: ["phone", "customer_name", "detail", "info_type"]
  },
  RefundRequest: {
    description: "Permintaan refund dari pelanggan. Status: pending (menunggu keputusan admin), approved (disetujui), rejected (ditolak). Berisi alasan refund, jumlah refund yang diminta, dan catatan admin.",
    safe_fields: ["id", "phone", "customer_name", "transaction_id", "reason", "refund_amount", "status", "admin_note", "created_at", "updated_at"],
    searchable_fields: ["phone", "customer_name", "reason", "admin_note"]
  },
  ChatHistory: {
    description: "Log percakapan lengkap antara AI/admin dengan pelanggan. Gunakan untuk membaca isi chat terbaru, memahami konteks negosiasi, atau melihat apa yang sudah dibicarakan dengan calon pelanggan tertentu.",
    safe_fields: ["id", "user_phone", "role", "message", "media_url", "created_at"],
    searchable_fields: ["user_phone", "message"]
  },
  TravelPackage: {
    description: "Katalog produk/layanan basic/reguler. Berisi nama, deskripsi, harga, durasi, inklusi, ekslusi, status aktif/nonaktif.",
    safe_fields: ["id", "package_name", "destination", "description", "duration_days", "duration_nights", "price", "status", "category", "inclusions", "exclusions", "created_at"],
    searchable_fields: ["package_name", "destination", "description"]
  },
  AdvancedTravelPackage: {
    description: "Katalog produk/layanan advanced (dengan varian/sub-item/jadwal). Termasuk slot/kuota, validitas, harga, status.",
    safe_fields: ["id", "package_type", "title", "description", "price", "has_sub_items", "validity_type", "expiry_date", "availability_type", "slot_mode", "slot_daily", "slot_total", "slot_used_total", "status", "ai_summary", "context_description", "created_at"],
    searchable_fields: ["title", "description", "ai_summary", "context_description"]
  },
  KnowledgeBase: {
    description: "Knowledge Base / SOP / kebijakan perusahaan / FAQ / promo. Berisi aturan refund, promo aktif, info tambahan, SOP pelayanan.",
    safe_fields: ["id", "type", "title", "content_text", "ai_context", "price", "stock", "slot_unlimited", "is_promo", "promo_context", "image_url", "info_additional", "created_at"],
    searchable_fields: ["title", "content_text", "ai_context", "promo_context", "info_additional", "type"]
  }
};

/**
 * Membangun query Prisma secara dinamis berdasarkan instruksi AI dan batasan tenant_id.
 * Sangat aman: Selalu menyuntikkan tenant_id, membatasi kolom (select), dan membatasi jumlah data.
 */
const executeSafeQuery = async (tenantId, querySpec) => {
  const { table, conditions } = querySpec;
  const registry = TABLE_REGISTRY[table];

  if (!registry) {
    throw new Error(`Akses ditolak atau tabel tidak terdaftar: ${table}`);
  }

  // Petakan nama model ke camelCase sesuai dengan Prisma Client
  const prismaModelName = table.charAt(0).toLowerCase() + table.slice(1);
  const model = prisma[prismaModelName];
  if (!model) {
    throw new Error(`Model Prisma tidak ditemukan: ${prismaModelName}`);
  }

  // Bangun parameter "where"
  const where = { tenant_id: tenantId };

  // Filter berdasarkan Tanggal Hari Ini (todayOnly)
  if (conditions?.todayOnly) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    if (['TravelBooking', 'Transaction', 'CustomerRequest', 'ChatHistory', 'Lead', 'TravelPackage', 'AdvancedTravelPackage', 'KnowledgeBase'].includes(table)) {
      where.created_at = {
        gte: startOfDay,
        lte: endOfDay
      };
    }
  }

  // Filter berdasarkan Nomor Telepon (Hanya jika tabel mendukung field telepon)
  if (conditions?.phone) {
    const cleanPhone = String(conditions.phone).replace(/[^0-9]/g, '');
    if (table === 'ChatHistory' || table === 'Transaction') {
      where.user_phone = { contains: cleanPhone };
    } else if (['Lead', 'TravelBooking', 'CustomerRequest'].includes(table)) {
      where.phone = { contains: cleanPhone };
    }
  }

  // Filter kondisi tambahan lainnya secara dinamis jika field terdaftar di safe_fields
  if (conditions) {
    Object.keys(conditions).forEach(key => {
      // Kecualikan filter khusus yang ditangani tersendiri
      if (['todayOnly', 'phone', 'searchQuery', 'limit'].includes(key)) return;
      
      // Jika field ada di safe_fields, terapkan equality filter
      if (registry.safe_fields.includes(key)) {
        if (key === 'type' && table === 'KnowledgeBase') {
          // Hanya gunakan equality jika type adalah salah satu type yang valid di DB
          const validTypes = ['custom_info', 'faq', 'sop'];
          if (validTypes.includes(conditions[key])) {
            where[key] = conditions[key];
          }
        } else if (key === 'created_at' || key === 'updated_at') {
          // Guard: Abaikan jika AI mengirim string seperti "today" atau "desc"
          // Hanya proses jika nilainya adalah Date object atau objek dengan gte/lte
          const val = conditions[key];
          if (val instanceof Date) {
            where[key] = val;
          } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            // Bisa berupa { gte: Date, lte: Date } dll — tetap terima
            where[key] = val;
          } else {
            console.warn(`[AdminCopilot] Abaikan kondisi tidak valid untuk field "${key}": ${JSON.stringify(val)}`);
          }
        } else {
          where[key] = conditions[key];
        }
      }
    });
  }

  // Filter Pencarian Keyword (searchQuery)
  if (conditions?.searchQuery) {
    const keyword = String(conditions.searchQuery).trim();
    
    // INTERCEPT: Gunakan Vector Semantic Search untuk tabel yang didukung!
    const vectorSupportedTables = ['KnowledgeBase', 'TravelPackage', 'AdvancedTravelPackage'];
    let vectorIds = [];
    
    if (vectorSupportedTables.includes(querySpec.table)) {
      console.log(`[AdminCopilot] Mencegat pencarian "${keyword}" dan mengalihkannya ke Vector Search (Ollama+Redis)...`);
      const matchedStringIds = await searchSemantic(tenantId, keyword, querySpec.table, 5);
      vectorIds = matchedStringIds.map(id => Number(id)).filter(id => !isNaN(id));
    }

    if (vectorIds.length > 0) {
      console.log(`[AdminCopilot] Vector Search berhasil menemukan ${vectorIds.length} kecocokan makna.`);
      where.id = { in: vectorIds };
    } else {
      // FALLBACK: Jika Vector gagal atau tabel tidak didukung, gunakan SQL LIKE konvensional
      const words = keyword.split(/\s+/).filter(w => w.length > 2);
      if (words.length > 1) {
        const orConditions = [];
        words.forEach(word => {
          registry.searchable_fields.forEach(field => {
            orConditions.push({ [field]: { contains: word } });
          });
        });
        where.OR = orConditions;
      } else {
        const orConditions = registry.searchable_fields.map(field => ({
          [field]: { contains: keyword }
        }));
        where.OR = orConditions;
      }
    }
  }

  // Bentuk objek select untuk menyaring kolom sensitif secara mutlak & Optimalisasi Token
  const select = {};
  if (querySpec.fields && Array.isArray(querySpec.fields) && querySpec.fields.length > 0) {
    querySpec.fields.forEach(field => {
      if (registry.safe_fields.includes(field)) {
        select[field] = true;
      }
    });
    // Pastikan field relasional esensial selalu ditarik
    select['id'] = true;
    if (registry.safe_fields.includes('has_sub_items')) select['has_sub_items'] = true;
  } else {
    registry.safe_fields.forEach(field => {
      select[field] = true;
    });
  }

  // Eksekusi query dengan limitasi default maksimal 150 baris demi performa dan context window
  const limit = conditions?.limit || 150;
  const records = await model.findMany({
    where,
    select,
    orderBy: { created_at: 'desc' },
    take: limit
  });

  return records;
};

/**
 * Mengambil Business Intelligence Snapshot secara otomatis.
 * Dipanggil setiap sesi copilot untuk memberikan konteks bisnis terkini.
 * Ringan & cepat — hanya ambil data kritis yang sering dibutuhkan.
 */
const getBusinessSnapshot = async (tenantId) => {
  const now = new Date();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const nextSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  try {
    const [
      totalLeads,
      hotLeads,
      neglectedLeads,
      pendingTransactions,
      pendingRequests,
      recentNewLeads,
      upcomingDepartures,
      recentBookings,
      monthlyRevenue,
      pendingOffers,
      pendingCrmPipeline,
      pendingRefunds,
    ] = await Promise.all([
      // Total leads aktif (tidak closed/failed/cancelled/customer)
      prisma.lead.count({
        where: { tenant_id: tenantId, status: { notIn: ['closed', 'failed', 'batal', 'cancelled', 'customer'] } },
      }).catch(() => 0),

      // Leads hot yang perlu perhatian (label = hot, belum closed)
      prisma.lead.findMany({
        where: { tenant_id: tenantId, label: 'hot', status: { notIn: ['closed', 'failed', 'batal', 'cancelled', 'customer'] } },
        select: { phone: true, push_name: true, saved_name: true, last_message_preview: true, last_message_at: true, chat_summary: true },
        orderBy: { last_message_at: 'desc' },
        take: 10,
      }).catch(() => []),

      // Leads yang belum dibalas > 3 hari (berpotensi ghosting)
      prisma.lead.findMany({
        where: {
          tenant_id: tenantId,
          status: { notIn: ['closed', 'failed', 'batal', 'cancelled', 'customer'] },
          last_message_at: { lt: threeDaysAgo, gt: thirtyDaysAgo },
          is_manual: { not: 1 },
        },
        select: { phone: true, push_name: true, saved_name: true, last_message_preview: true, last_message_at: true, label: true, status: true },
        orderBy: { last_message_at: 'asc' },
        take: 10,
      }).catch(() => []),

      // Transaksi pending (perlu verifikasi) — GenericStatus: pending, active
      prisma.transaction.findMany({
        where: { tenant_id: tenantId, status: { in: ['pending', 'active'] } },
        select: { id: true, customer_name: true, user_phone: true, total_price: true, status: true, detected_amount: true, detected_bank: true, created_at: true },
        orderBy: { created_at: 'desc' },
        take: 10,
      }).catch(() => []),

      // Customer requests yang belum di-resolve
      prisma.customerRequest.findMany({
        where: { tenant_id: tenantId, status: 'pending' },
        select: { id: true, customer_name: true, phone: true, request_type: true, request_detail: true, package_name: true, created_at: true },
        orderBy: { created_at: 'desc' },
        take: 10,
      }).catch(() => []),

      // Leads baru masuk 7 hari terakhir
      prisma.lead.count({
        where: { tenant_id: tenantId, created_at: { gte: sevenDaysAgo } },
      }).catch(() => 0),

      // Keberangkatan dalam 7 hari ke depan — status valid di GenericStatus: excluded canceled/completed
      prisma.travelBooking.findMany({
        where: {
          tenant_id: tenantId,
          departure_date: { gte: now, lte: nextSevenDays },
          status: { notIn: ['canceled', 'canceled_customer', 'rejected'] },
        },
        select: { customer_name: true, phone: true, package_name: true, departure_date: true, pax_count: true, payment_status: true },
        orderBy: { departure_date: 'asc' },
        take: 10,
      }).catch(() => []),

      // Booking baru 30 hari terakhir
      prisma.travelBooking.count({
        where: { tenant_id: tenantId, created_at: { gte: thirtyDaysAgo } },
      }).catch(() => 0),

      // Estimasi revenue bulan ini (transaksi approved/done/completed)
      prisma.transaction.findMany({
        where: {
          tenant_id: tenantId,
          status: { in: ['approved', 'done', 'completed'] },
          created_at: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        },
        select: { total_price: true },
      }).catch(() => []),

      // Offer/penawaran harga yang masih pending
      prisma.offer.findMany({
        where: { tenant_id: tenantId, status: 'pending' },
        select: { id: true, customer_name: true, phone: true, package_name: true, original_price: true, offered_price: true, admin_offer: true, status: true, created_at: true },
        orderBy: { created_at: 'desc' },
        take: 10,
      }).catch(() => []),

      // CRM Pipeline: customer yang masih dalam proses (waiting_offer/pending)
      prisma.customerManagement.findMany({
        where: { tenant_id: tenantId, status: { in: ['pending', 'waiting_offer'] } },
        select: { id: true, customer_name: true, phone: true, package_name: true, departure_date: true, status: true, admin_note: true, created_at: true },
        orderBy: { created_at: 'desc' },
        take: 10,
      }).catch(() => []),

      // Refund requests yang masih pending
      prisma.refundRequest.findMany({
        where: { tenant_id: tenantId, status: 'pending' },
        select: { id: true, customer_name: true, phone: true, reason: true, refund_amount: true, status: true, admin_note: true, created_at: true },
        orderBy: { created_at: 'desc' },
        take: 10,
      }).catch(() => []),
    ]);

    const totalRevenueThisMonth = monthlyRevenue.reduce((sum, t) => sum + (Number(t.total_price) || 0), 0);

    // Format neglected leads dengan info berapa hari tak dibalas
    const neglectedWithDays = neglectedLeads.map(l => ({
      ...l,
      days_silent: Math.floor((now - new Date(l.last_message_at)) / (1000 * 60 * 60 * 24)),
    }));

    return {
      summary: {
        total_active_leads: totalLeads,
        new_leads_7d: recentNewLeads,
        hot_leads_count: hotLeads.length,
        neglected_leads_count: neglectedLeads.length,
        pending_transactions_count: pendingTransactions.length,
        pending_requests_count: pendingRequests.length,
        bookings_30d: recentBookings,
        revenue_this_month: totalRevenueThisMonth,
        upcoming_departures_count: upcomingDepartures.length,
        pending_offers_count: pendingOffers.length,
        pending_crm_count: pendingCrmPipeline.length,
        pending_refunds_count: pendingRefunds.length,
      },
      hot_leads: hotLeads,
      neglected_leads: neglectedWithDays,
      pending_transactions: pendingTransactions,
      pending_requests: pendingRequests,
      upcoming_departures: upcomingDepartures,
      pending_offers: pendingOffers,
      pending_crm_pipeline: pendingCrmPipeline,
      pending_refunds: pendingRefunds,
    };
  } catch (err) {
    console.error('[AdminCopilot] getBusinessSnapshot error:', err.message);
    return null;
  }
};

/**
 * Melakukan proses ringkasan per-potongan data (Map-Reduce) apabila ukuran data terlalu besar.
 */
const summarizeChunk = async (tenantId, table, userMessage, recordsChunk, chunkIndex, totalChunks) => {
  const systemPrompt = `Anda adalah asisten AI Analitis Backend untuk LUEVORA CRM.
Tugas Anda adalah merangkum potongan data (Chunk ${chunkIndex + 1} dari ${totalChunks}) dari tabel ${table} berdasarkan pertanyaan pengguna.

Pertanyaan Pengguna: "${userMessage}"

Rangkumlah data yang diberikan di bawah ini secara objektif, singkat, padat, dan fokus pada hal-hal yang ditanyakan pengguna. Hitung total angka atau agregat jika relevan.
DILARANG memberikan jawaban subjektif, DILARANG berhalusinasi, dan DILARANG menyebutkan data kredensial sensitif.`;

  const userMessageContent = `Berikut adalah potongan data dari tabel ${table}:\n${JSON.stringify(recordsChunk, null, 2)}`;
  
  // Gunakan FastJsonAI dengan format respons teks rangkuman di dalam properti JSON
  const res = await executeFastJsonAI(tenantId, systemPrompt, `Tolong buat ringkasan dalam format JSON: {"summary": "Tulis ringkasan data di sini..."}\n\nData:\n${userMessageContent}`, [], 'admin_copilot');
  return res?.summary || JSON.stringify(recordsChunk);
};

/**
 * Mesin utama Admin AI Copilot dengan penalaran multi-langkah (Multi-Step Reasoning).
 */
/**
 * Menyimpan pesan obrolan admin atau asisten ke database secara aman.
 */
export const saveAdminMessage = async (tenantId, sessionId, role, message) => {
  try {
    return await prisma.chatHistory.create({
      data: {
        tenant_id: tenantId,
        user_phone: `ADMIN_SESSION_${sessionId}`,
        role,
        message
      }
    });
  } catch (error) {
    console.error(`[AdminCopilot Service] Gagal menyimpan pesan admin (${role}):`, error);
  }
};

/**
 * Mendapatkan atau membuat baris metadata sesi chat (session_meta).
 * Jika baru, gunakan AI untuk men-generate judul obrolan singkat yang elegan berdasarkan pesan pertama.
 */
export const getOrCreateAdminSessionMeta = async (tenantId, sessionId, firstMessageText) => {
  const userPhone = `ADMIN_SESSION_${sessionId}`;
  try {
    const metaRecord = await prisma.chatHistory.findFirst({
      where: {
        tenant_id: tenantId,
        user_phone: userPhone,
        role: 'session_meta'
      }
    });

    if (metaRecord) {
      try {
        return JSON.parse(metaRecord.message);
      } catch (err) {
        console.error(`[AdminCopilot Service] Gagal parse metadata JSON:`, err);
        return { title: 'Percakapan Lama', chat_summary: '' };
      }
    }

    // Jika belum ada, buat judul percakapan menggunakan AI berdasarkan pesan pertama admin
    console.log(`[AdminCopilot Service] Membuat sesi baru untuk ${sessionId}. Men-generate judul...`);
    const titlePrompt = `Anda adalah asisten AI yang bertugas membuat judul percakapan singkat yang elegan (maksimal 4-5 kata) dalam Bahasa Indonesia berdasarkan pesan pertama dari admin pengguna.
Pesan Pertama: "${firstMessageText}"
Berikan respons dalam format JSON murni: {"title": "Judul Percakapan yang Elegan"}`;

    let title = 'Percakapan Baru';
    try {
      const res = await executeFastJsonAI(tenantId, titlePrompt, firstMessageText, [], 'admin_copilot');
      if (res?.title) {
        title = res.title.trim().replace(/^["']|["']$/g, '');
      }
    } catch (aiErr) {
      console.error(`[AdminCopilot Service] Gagal generate judul dengan AI:`, aiErr);
    }

    const initialMeta = { title, chat_summary: '' };
    
    await prisma.chatHistory.create({
      data: {
        tenant_id: tenantId,
        user_phone: userPhone,
        role: 'session_meta',
        message: JSON.stringify(initialMeta)
      }
    });

    return initialMeta;
  } catch (error) {
    console.error(`[AdminCopilot Service] Gagal mendapatkan atau membuat session_meta:`, error);
    return { title: 'Percakapan Baru', chat_summary: '' };
  }
};

/**
 * Pemicu summarization latar belakang (background summarization) secara asinkron.
 * Mereplikasi perilaku summarization bot WhatsApp.
 */
export const triggerAdminBackgroundSummarization = async (tenantId, sessionId) => {
  const userPhone = `ADMIN_SESSION_${sessionId}`;
  try {
    // 1. Hitung jumlah total pesan percakapan raw (tidak termasuk session_meta)
    const messagesCount = await prisma.chatHistory.count({
      where: {
        tenant_id: tenantId,
        user_phone: userPhone,
        role: { not: 'session_meta' }
      }
    });

    // Memicu summarization hanya jika pesan berkelipatan 5 untuk menjaga efisiensi token
    if (messagesCount === 0 || messagesCount % 5 !== 0) {
      return;
    }

    console.log(`[AdminCopilot Background Memory] Memicu summarization untuk sesi ${sessionId} (Total pesan: ${messagesCount})`);

    // 2. Ambil metadata sesi lama
    const metaRecord = await prisma.chatHistory.findFirst({
      where: {
        tenant_id: tenantId,
        user_phone: userPhone,
        role: 'session_meta'
      }
    });

    if (!metaRecord) return;

    let metaData = { title: 'Percakapan', chat_summary: '' };
    try {
      metaData = JSON.parse(metaRecord.message);
    } catch (e) {}

    // 3. Ambil semua pesan percakapan raw dalam sesi ini
    const rawMessages = await prisma.chatHistory.findMany({
      where: {
        tenant_id: tenantId,
        user_phone: userPhone,
        role: { not: 'session_meta' }
      },
      orderBy: { created_at: 'asc' }
    });

    const formattedHistory = rawMessages.map(m => `[${m.role.toUpperCase()}]: ${m.message}`).join('\n');

    const summaryPrompt = `Anda adalah asisten AI LUEVORA yang bertugas mengelola memori jangka panjang (chat summary) antara Admin dan Copilot AI.
Tugas Anda adalah memperbarui ringkasan memori jangka panjang dengan merangkum poin-poin keputusan penting, detail data yang dicari, preferensi, atau info taktis lainnya dari percakapan baru, lalu menggabungkannya dengan ringkasan lama (jika ada).
Pastikan ringkasan tetap padat, ringkas, informatif, dan tidak melupakan fakta penting (seperti harga, nama paket, kebijakan refund, dll).

Ringkasan Lama:
"${metaData.chat_summary || '(Belum ada ringkasan sebelumnya)'}"

Seluruh Percakapan Sesi:
${formattedHistory}

Berikan respons dalam format JSON murni: {"chat_summary": "Tulis ringkasan memori gabungan yang padat dan komprehensif di sini..."}`;

    const res = await executeFastJsonAI(tenantId, summaryPrompt, 'Tolong update ringkasan memori percakapan.', [], 'admin_copilot');
    if (res?.chat_summary) {
      console.log(`[AdminCopilot Background Memory] Berhasil memperbarui ringkasan memori jangka panjang untuk sesi ${sessionId}`);
      metaData.chat_summary = res.chat_summary;

      await prisma.chatHistory.update({
        where: { id: metaRecord.id },
        data: {
          message: JSON.stringify(metaData)
        }
      });
    }
  } catch (error) {
    console.error(`[AdminCopilot Background Memory Error] Gagal melakukan summarization sesi ${sessionId}:`, error);
  }
};

/**
 * Mesin utama Admin AI Copilot dengan penalaran multi-langkah (Multi-Step Reasoning) dan Chat Memory Persisten.
 */
export const runAdminCopilot = async (tenantId, sessionId, userMessage) => {
  try {
    console.log(`[AdminCopilot] Memulai penalaran untuk tenant_id: ${tenantId}, session_id: ${sessionId}`);

    // 1. Ambil atau buat session meta (judul dan memori jangka panjang)
    const sessionMeta = await getOrCreateAdminSessionMeta(tenantId, sessionId, userMessage);
    const longTermMemory = sessionMeta.chat_summary || "Belum ada memori jangka panjang untuk sesi ini.";

    // 2. Simpan pesan pengguna ke database secara persisten
    await saveAdminMessage(tenantId, sessionId, 'user', userMessage);

    // 3. Ambil Business Intelligence Snapshot (paralel dengan history fetch)
    const [rawHistory, bizSnapshot] = await Promise.all([
      prisma.chatHistory.findMany({
        where: {
          tenant_id: tenantId,
          user_phone: `ADMIN_SESSION_${sessionId}`,
          role: { not: 'session_meta' }
        },
        orderBy: { created_at: 'desc' },
        take: 6
      }),
      getBusinessSnapshot(tenantId),
    ]);
    
    // Urutkan kembali agar kronologis (terlama -> terbaru)
    const sortedHistory = [...rawHistory].reverse();

    if (sortedHistory.length > 0 && sortedHistory[sortedHistory.length - 1].role === 'user' && sortedHistory[sortedHistory.length - 1].message === userMessage) {
      sortedHistory.pop();
    }

    const recentMessages = sortedHistory.slice(-5).map(h => ({
      role: h.role,
      message: h.message
    }));

    // Format business snapshot menjadi teks konteks
    const bizSnapshotText = bizSnapshot ? `
=== BUSINESS INTELLIGENCE SNAPSHOT (Real-time) ===
Ringkasan Bisnis:
- Total leads aktif: ${bizSnapshot.summary.total_active_leads}
- Leads baru (7 hari): ${bizSnapshot.summary.new_leads_7d}
- Leads PANAS: ${bizSnapshot.summary.hot_leads_count} orang
- Leads terabaikan (>3 hari tanpa balas): ${bizSnapshot.summary.neglected_leads_count} orang
- Transaksi pending verifikasi: ${bizSnapshot.summary.pending_transactions_count}
- Customer requests belum di-handle: ${bizSnapshot.summary.pending_requests_count}
- Penawaran harga (Offer) belum diputuskan: ${bizSnapshot.summary.pending_offers_count}
- CRM Pipeline dalam proses: ${bizSnapshot.summary.pending_crm_count}
- Refund requests pending: ${bizSnapshot.summary.pending_refunds_count}
- Booking bulan ini: ${bizSnapshot.summary.bookings_30d}
- Revenue bulan ini (verified): Rp ${bizSnapshot.summary.revenue_this_month.toLocaleString('id-ID')}
- Keberangkatan dalam 7 hari: ${bizSnapshot.summary.upcoming_departures_count} grup

${bizSnapshot.hot_leads.length > 0 ? `Leads PANAS (perlu follow-up):
${bizSnapshot.hot_leads.map(l => `• ${l.saved_name || l.push_name} (${l.phone})${l.last_message_at ? ` — terakhir chat: ${new Date(l.last_message_at).toLocaleDateString('id-ID')}` : ''}
  Pesan terakhir: ${l.last_message_preview || '-'}
  ${l.chat_summary ? `Summary: ${l.chat_summary}` : ''}`).join('\n')}` : 'Tidak ada leads panas saat ini.'}

${bizSnapshot.neglected_leads.length > 0 ? `Leads Terabaikan (potensial ghosting - perlu follow-up segera):
${bizSnapshot.neglected_leads.map(l => `• ${l.saved_name || l.push_name} (${l.phone}) — DIAM ${l.days_silent} hari
  Status: ${l.status}, Label: ${l.label}
  Pesan terakhir: ${l.last_message_preview || '-'}`).join('\n')}` : ''}

${bizSnapshot.pending_transactions.length > 0 ? `Transaksi Pending Verifikasi:
${bizSnapshot.pending_transactions.map(t => `• ${t.customer_name} (${t.user_phone}) — Status: ${t.status}
  Total: Rp ${Number(t.total_price || 0).toLocaleString('id-ID')} | Terdeteksi: Rp ${Number(t.detected_amount || 0).toLocaleString('id-ID')} via ${t.detected_bank || '-'}`).join('\n')}` : ''}

${bizSnapshot.pending_requests.length > 0 ? `Customer Requests Belum Di-handle:
${bizSnapshot.pending_requests.map(r => `• ${r.customer_name} (${r.phone}) — ${r.request_type}: ${r.request_detail}`).join('\n')}` : ''}

${bizSnapshot.pending_offers.length > 0 ? `Penawaran Harga (Offer) Menunggu Keputusan Admin:
${bizSnapshot.pending_offers.map(o => `• ${o.customer_name} (${o.phone}) — Paket: ${o.package_name}
  Harga asli: Rp ${Number(o.original_price || 0).toLocaleString('id-ID')} | Ditawar: Rp ${Number(o.offered_price || 0).toLocaleString('id-ID')}${o.admin_offer ? ` | Counter offer: Rp ${Number(o.admin_offer).toLocaleString('id-ID')}` : ''}`).join('\n')}` : ''}

${bizSnapshot.pending_crm_pipeline.length > 0 ? `CRM Pipeline Dalam Proses:
${bizSnapshot.pending_crm_pipeline.map(c => `• ${c.customer_name} (${c.phone}) — Status: ${c.status}
  Paket: ${c.package_name || '-'}${c.departure_date ? ` | Keberangkatan: ${new Date(c.departure_date).toLocaleDateString('id-ID')}` : ''}
  ${c.admin_note ? `Catatan: ${c.admin_note}` : ''}`).join('\n')}` : ''}

${bizSnapshot.pending_refunds.length > 0 ? `Refund Requests Menunggu Keputusan:
${bizSnapshot.pending_refunds.map(r => `• ${r.customer_name} (${r.phone}) — Jumlah: Rp ${Number(r.refund_amount || 0).toLocaleString('id-ID')}
  Alasan: ${r.reason}`).join('\n')}` : ''}

${bizSnapshot.upcoming_departures.length > 0 ? `Keberangkatan dalam 7 Hari:
${bizSnapshot.upcoming_departures.map(b => `• ${b.customer_name} (${b.pax_count} pax) — ${b.package_name} — ${new Date(b.departure_date).toLocaleDateString('id-ID')} | Bayar: ${b.payment_status}`).join('\n')}` : ''}
=== END SNAPSHOT ===` : '(Business snapshot tidak tersedia)';

    // ==========================================
    // LANGKAH 1: Reasoning & Penentuan Strategi (Agentic Loop)
    // ==========================================
    let dynamicDataText = "";
    const collectedAttachments = [];
    let iteration = 0;
    const maxIterations = 3;
    let finalSynthesisPromptReady = false;
    let directAnswerFound = null;

    while (iteration < maxIterations && !finalSynthesisPromptReady) {
      iteration++;
      console.log(`[AdminCopilot] Memulai Agentic Loop iterasi ke-${iteration} untuk tenant_id: ${tenantId}`);

      const reasoningSystemPrompt = `Kamu adalah Reasoning Engine dari Business Intelligence Advisor untuk owner bisnis LUEVORA.
Tugas: Analisis pertanyaan owner dan tentukan data apa yang perlu digali lebih dalam untuk memberikan jawaban yang actionable.

Business Snapshot sudah tersedia (tidak perlu di-query ulang):
${bizSnapshotText}

Riwayat percakapan terakhir:
${JSON.stringify(recentMessages, null, 2)}

Data yang sudah terkumpul dari iterasi sebelumnya:
====================================
${dynamicDataText}
====================================

Kamus Tabel untuk Query Tambahan:
${JSON.stringify(TABLE_REGISTRY, null, 2)}

ATURAN STRATEGI:
1. DILARANG query data kredensial.
2. Snapshot bisnis di atas SUDAH mencakup: leads panas, leads terabaikan, transaksi pending, customer request, keberangkatan. JANGAN query ulang data yang sudah ada di snapshot kecuali perlu detail lebih dalam (misal: baca isi chat spesifik seseorang).
3. KAPAN perlu query tambahan:
   - Owner tanya detail spesifik seseorang (baca ChatHistory untuk lihat isi percakapan)
   - Owner tanya tentang paket/produk (query TravelPackage/AdvancedTravelPackage)
   - Owner tanya metric tertentu yang tidak ada di snapshot (misal: semua leads dengan status 'negosiasi')
   - Owner tanya soal KB/SOP/kebijakan
4. OPTIMASI: Jika query ChatHistory untuk seseorang, gunakan kondisi phone dan ambil 20 pesan terakhir dengan fields ["role", "message", "created_at", "media_url"].
5. WEB SEARCH: Gunakan untuk info real-time dari internet (kurs, berita, cuaca, tren pasar). JANGAN untuk data internal.
6. Jika snapshot + data terkumpul sudah cukup, langsung pilih "answer".

Format JSON:
{
  "reasoning": "Penalaran singkat...",
  "action": "query" | "web_search" | "answer",
  "queries": [
    {
      "table": "NamaTabel",
      "fields": [],
      "conditions": { "phone": "628...", "searchQuery": "...", "limit": 20 }
    }
  ],
  "searchQuery": "kata kunci internet",
  "directAnswer": "Jawaban langsung jika tidak perlu sintesis"
}`;

      const reasoningResponse = await executeFastJsonAI(tenantId, reasoningSystemPrompt, userMessage, [], 'admin_copilot');
      console.log(`[AdminCopilot] Hasil Strategi AI (Iterasi ${iteration}):`, JSON.stringify(reasoningResponse, null, 2));

      if (!reasoningResponse) {
        if (iteration === 1) return "Maaf, saya gagal menganalisis permintaan Anda saat ini.";
        break; // Hentikan loop jika error di iterasi selanjutnya
      }

      if (reasoningResponse.action === 'answer') {
        finalSynthesisPromptReady = true;
        // Jika reasoning AI punya hint jawaban, jadikan konteks tambahan untuk synthesis
        // TIDAK di-return langsung agar tetap melewati synthesis (persona kasual)
        if (reasoningResponse.directAnswer) {
          dynamicDataText += (dynamicDataText ? '\n\n' : '') + `[Hint dari Reasoning Engine]: ${reasoningResponse.directAnswer}`;
        }
        break;
      }

      // ── WEB SEARCH ACTION ──
      if (reasoningResponse.action === 'web_search' && reasoningResponse.searchQuery) {
        try {
          console.log(`[AdminCopilot] Memulai pencarian web: "${reasoningResponse.searchQuery}"`);
          const webResult = await searchWeb(reasoningResponse.searchQuery);
          const formattedResult = formatSearchResults(webResult, reasoningResponse.searchQuery);
          dynamicDataText += (dynamicDataText ? '\n\n' : '') + formattedResult;
          console.log(`[AdminCopilot] Web search selesai. Hasil: ${formattedResult.length} chars`);
        } catch (webErr) {
          console.error(`[AdminCopilot] Web search error:`, webErr.message);
          dynamicDataText += `\n[Pencarian Web gagal: ${webErr.message}]`;
        }
        // Setelah web search, lanjut ke iterasi berikutnya untuk synthesis
        finalSynthesisPromptReady = true;
        break;
      }

      if (reasoningResponse.action === 'query' && reasoningResponse.queries && reasoningResponse.queries.length > 0) {
        const dataResults = [];

        for (const querySpec of reasoningResponse.queries) {
          try {
            console.log(`[AdminCopilot] Menjalankan query ke tabel: ${querySpec.table}`);
            const records = await executeSafeQuery(tenantId, querySpec);
            console.log(`[AdminCopilot] Berhasil mengambil ${records.length} baris dari ${querySpec.table}`);

            if (records.length === 0) {
              dataResults.push(`Tabel ${querySpec.table}: Tidak ditemukan data untuk filter yang Anda berikan.`);
              continue;
            }

            const chunkSize = 40;
            if (records.length > chunkSize) {
              const chunksCount = Math.ceil(records.length / chunkSize);
              const chunkSummaries = [];
              for (let i = 0; i < chunksCount; i++) {
                const chunk = records.slice(i * chunkSize, (i + 1) * chunkSize);
                const summary = await summarizeChunk(tenantId, querySpec.table, userMessage, chunk, i, chunksCount);
                chunkSummaries.push(summary);
              }
              dataResults.push(`Tabel ${querySpec.table} (Hasil ringkasan gabungan dari ${records.length} data):\n${chunkSummaries.join('\n')}`);
            } else {
              dataResults.push(`Tabel ${querySpec.table}:\n${JSON.stringify(records, null, 2)}`);
            }

          // ============================================================
          // INTEGRASI DEEP RAG & PENGUMPULAN ATTACHMENT
          // ============================================================
          
          // 1. Basic Travel Package RAG
          if (querySpec.table === 'TravelPackage') {
            const packageIds = records.map(r => r.id);
            const mediaContexts = await prisma.packageMediaContext.findMany({
              where: { tenant_id: tenantId, travel_package_id: { in: packageIds } },
              include: { files: true }
            });
            
            try {
              const selectedFileIds = await documentReaderService.evaluateContextNeed(tenantId, userMessage, records);
              if (selectedFileIds && selectedFileIds.length > 0) {
                console.log(`[AdminCopilot RAG] File basic package yang relevan dideteksi:`, selectedFileIds);
                const filesToRead = await prisma.packageMediaFile.findMany({
                  where: { tenant_id: tenantId, id: { in: selectedFileIds } },
                  include: { context: true }
                });
                for (const f of filesToRead) {
                  const packageId = f.context.travel_package_id;
                  const ragResult = await documentReaderService.deepReadDocumentFiles(tenantId, 'ADMIN', packageId, [f.id], userMessage);
                  if (ragResult && ragResult.found) {
                    console.log(`[AdminCopilot RAG] Hasil Deep Read File "${f.file_name}":`, ragResult.answer);
                    dataResults.push(`[Deep RAG - Dokumen/Gambar Lampiran Paket ID: ${packageId}]:\n${ragResult.answer}`);
                  }
                }
              }
            } catch (ragErr) {
              console.error(`[AdminCopilot RAG] Gagal RAG TravelPackage:`, ragErr);
            }
            
            mediaContexts.forEach(ctx => {
              ctx.files.forEach(f => {
                const downloadUrl = f.file_path.startsWith('http') 
                  ? f.file_path 
                  : `${process.env.PUBLIC_URL || 'http://localhost:3001'}/uploads/${f.file_path.replace('uploads/', '')}`;
                collectedAttachments.push({
                  type: 'Brosur/Lampiran Produk',
                  parent_id: ctx.travel_package_id,
                  file_name: f.file_name,
                  description: f.ai_description || '',
                  download_url: downloadUrl
                });
              });
            });
          }

          // 2. Knowledge Base (SOP/Policies) RAG
          if (querySpec.table === 'KnowledgeBase') {
            const kbIds = records.map(r => r.id);
            const mediaContexts = await prisma.kbMediaContext.findMany({
              where: { tenant_id: tenantId, knowledge_base_id: { in: kbIds } },
              include: { files: true }
            });
            
            try {
              const selectedFileIds = await documentReaderService.evaluateKbContextNeed(tenantId, userMessage, records);
              if (selectedFileIds && selectedFileIds.length > 0) {
                console.log(`[AdminCopilot RAG] File KB yang relevan dideteksi:`, selectedFileIds);
                const filesToRead = await prisma.kbMediaFile.findMany({
                  where: { tenant_id: tenantId, id: { in: selectedFileIds } },
                  include: { context: true }
                });
                for (const f of filesToRead) {
                  const kbId = f.context.knowledge_base_id;
                  const ragResult = await documentReaderService.deepReadKbDocumentFiles(tenantId, 'ADMIN', kbId, [f.id], userMessage);
                  if (ragResult && ragResult.found) {
                    console.log(`[AdminCopilot RAG] Hasil Deep Read KB File "${f.file_name}":`, ragResult.answer);
                    dataResults.push(`[Deep RAG - SOP Lampiran KB ID: ${kbId}]:\n${ragResult.answer}`);
                  }
                }
              }
            } catch (ragErr) {
              console.error(`[AdminCopilot RAG] Gagal RAG KnowledgeBase:`, ragErr);
            }
            
            mediaContexts.forEach(ctx => {
              ctx.files.forEach(f => {
                const downloadUrl = f.file_path.startsWith('http') 
                  ? f.file_path 
                  : `${process.env.PUBLIC_URL || 'http://localhost:3001'}/uploads/${f.file_path.replace('uploads/', '')}`;
                collectedAttachments.push({
                  type: 'Dokumen Resmi Kebijakan/SOP',
                  parent_id: ctx.knowledge_base_id,
                  file_name: f.file_name,
                  description: f.ai_description || '',
                  download_url: downloadUrl
                });
              });
            });
          }

          // 3. Advanced Travel Package RAG
          if (querySpec.table === 'AdvancedTravelPackage') {
            const advancedIds = records.map(r => r.id);
            
            try {
              const selectedRefs = await documentReaderService.evaluateAdvancedContextNeed(tenantId, userMessage);
              if (selectedRefs && selectedRefs.length > 0) {
                console.log(`[AdminCopilot RAG] Berkas Advanced Package yang relevan dideteksi:`, selectedRefs.length);
                for (const fileRef of selectedRefs) {
                  const ragResult = await documentReaderService.deepReadAdvancedDocument(tenantId, 'ADMIN', fileRef, userMessage);
                  if (ragResult && ragResult.found) {
                    console.log(`[AdminCopilot RAG] Hasil Deep Read Advanced File "${fileRef.packageTitle}":`, ragResult.answer);
                    dataResults.push(`[Deep RAG - Dokumen Lampiran Advanced Package "${fileRef.packageTitle}"]:\n${ragResult.answer}`);
                  }
                }
              }
            } catch (ragErr) {
              console.error(`[AdminCopilot RAG] Gagal RAG AdvancedTravelPackage:`, ragErr);
            }
            
            try {
              // Kumpulkan main files
              const mainFiles = await prisma.mainPackageMediaFile.findMany({
                where: { tenant_id: tenantId, package_id: { in: advancedIds } }
              });
              mainFiles.forEach(f => {
                const downloadUrl = f.file_path.startsWith('http') 
                  ? f.file_path 
                  : `${process.env.PUBLIC_URL || 'http://localhost:3001'}/uploads/${f.file_path.replace('uploads/', '')}`;
                collectedAttachments.push({
                  type: 'Brosur Utama Paket Advance',
                  parent_id: f.package_id,
                  file_name: f.file_name,
                  description: 'Lampiran Utama Paket',
                  download_url: downloadUrl
                });
              });
              
              // Kumpulkan subitem files dan INJEKSI HARGA KE MEMORI AI
              const subItems = await prisma.advancedPackageSubItem.findMany({
                where: { tenant_id: tenantId, package_id: { in: advancedIds } },
                include: { files: true }
              });
              
              if (subItems.length > 0) {
                const subItemTexts = subItems.map(sub => `- ${sub.title} (Harga: Rp ${sub.price}): ${sub.description || ''}`);
                dataResults.push(`[Informasi Sub-Paket / Varian Harga untuk Advanced Packages]:\n${subItemTexts.join('\n')}`);
              }

              subItems.forEach(sub => {
                sub.files.forEach(f => {
                  const downloadUrl = f.file_path.startsWith('http') 
                    ? f.file_path 
                    : `${process.env.PUBLIC_URL || 'http://localhost:3001'}/uploads/${f.file_path.replace('uploads/', '')}`;
                  collectedAttachments.push({
                    type: 'Lampiran Sub-Item Paket Advance',
                    parent_id: sub.package_id,
                    sub_item_id: sub.id,
                    file_name: f.file_name,
                    description: `Lampiran Sub-Item: ${sub.title}`,
                    download_url: downloadUrl
                  });
                });
              });
              
              // Kumpulkan addon files dan INJEKSI HARGA ADDON KE MEMORI AI
              const addons = await prisma.advancedPackageAddon.findMany({
                where: { tenant_id: tenantId, package_id: { in: advancedIds } },
                include: { files: true }
              });

              if (addons.length > 0) {
                const addonTexts = addons.map(addon => `- ${addon.title} (Tambahan Harga: Rp ${addon.price}): ${addon.description || ''}`);
                dataResults.push(`[Informasi Add-on Tambahan untuk Advanced Packages]:\n${addonTexts.join('\n')}`);
              }

              addons.forEach(addon => {
                addon.files.forEach(f => {
                  const downloadUrl = f.file_path.startsWith('http') 
                    ? f.file_path 
                    : `${process.env.PUBLIC_URL || 'http://localhost:3001'}/uploads/${f.file_path.replace('uploads/', '')}`;
                  collectedAttachments.push({
                    type: 'Lampiran Addon Paket Advance',
                    parent_id: addon.package_id,
                    addon_id: addon.id,
                    file_name: f.file_name,
                    description: `Lampiran Addon: ${addon.title}`,
                    download_url: downloadUrl
                  });
                });
              });
            } catch (mediaErr) {
              console.error(`[AdminCopilot RAG] Gagal mengumpulkan attachment Advanced:`, mediaErr);
            }
          }

        } catch (queryErr) {
          console.error(`[AdminCopilot] Gagal mengeksekusi query ke ${querySpec.table}:`, queryErr.message);
          dataResults.push(`Tabel ${querySpec.table}: Gagal membaca data akibat kesalahan sistem.`);
        }
      }

      // Gabungkan hasil query ke dynamicDataText untuk dibaca oleh iterasi AI selanjutnya
      if (directAnswerFound) {
        dataResults.push(`[Direct Answer]: ${directAnswerFound}`);
      }
      dynamicDataText += (dynamicDataText ? '\n\n' : '') + dataResults.join('\n\n');
    }
  } // END OF AGENTIC LOOP

    // ==========================================
    // LANGKAH 2: Sintesis & Formulasi Jawaban Akhir
    // (Semua jawaban selalu melewati synthesis untuk konsistensi persona)
    // ==========================================
    const synthesisSystemPrompt = `Kamu adalah **Business Intelligence Advisor** sekaligus asisten pribadi untuk PEMILIK bisnis travel LUEVORA. Kamu punya akses penuh ke semua data bisnis secara real-time dan tugas utamamu adalah membantu owner membuat keputusan yang tepat, cepat, dan menguntungkan.

Persona kamu: seperti Chief of Staff yang cerdas + partner bisnis yang jujur. Ngobrolnya santai dan natural tapi analisisnya tajam. Kamu proaktif — kalau ada hal penting yang kamu lihat dari data, kamu angkat sendiri tanpa perlu diminta.

---
**KONTEKS BISNIS REAL-TIME (Business Snapshot):**
${bizSnapshotText}

**Data Tambahan yang Digali (jika ada):**
${dynamicDataText || '(tidak ada data tambahan)'}

**Lampiran/Dokumen:**
${collectedAttachments.length > 0 ? JSON.stringify(collectedAttachments, null, 2) : '(tidak ada)'}

**Memori Sesi Ini:**
${longTermMemory}

**Riwayat Chat Terakhir:**
${JSON.stringify(recentMessages, null, 2)}

**Pertanyaan Owner:** "${userMessage}"
---

**CARA KAMU MENJAWAB:**

**🗣️ GAYA BAHASA:**
- Santai dan natural, kayak ngobrol sama partner bisnis yang cerdas. Pakai "nih", "sih", "dong", "btw", "lho", "nah", "gimana", dll kalau cocok dengan konteks.
- Kalau owner singkat/casual, jawab singkat juga. Kalau tanya detail, jawab detail.
- DILARANG: frasa robot, "Sebagai AI...", "Mohon maaf atas kebingungan...", "Berdasarkan database...", dll.
- Kalau owner curhat/kesal, empati dulu baru kasih solusi.
**🔍 PROACTIVE INSIGHT:**
- Bedakan secara cerdas antara "obrolan biasa/curhat" dengan "permintaan update bisnis".
- Jika percakapan hanyalah obrolan biasa atau sapaan tanpa konteks operasional, JANGAN membeberkan angka/data secara tiba-tiba. Cukup respon secara natural dengan empati.
- Namun jika percakapan mengarah pada kondisi, update, masalah, atau ringkasan bisnis saat ini, kamu harus proaktif menyajikan poin-poin penting dari Business Snapshot.
- Jika menyajikan insight, prioritaskan hal-hal yang butuh tindakan owner:
  * Leads yang terabaikan (potensi ghosting) atau leads potensial
  * Transaksi, Refund, atau Penawaran yang masih menggantung (pending)
  * Keberangkatan dekat yang butuh atensi
- Selalu sebutkan entitas spesifik (misal: "Pak Budi", bukan sekadar "ada 1 leads").

**💡 ACTION SUGGESTIONS:**
- Setiap jawaban yang relevan WAJIB diakhiri dengan 1-3 saran tindakan konkret yang bisa langsung dilakukan owner. Contoh:
  * "➡️ Follow up Pak Andi sekarang — terakhir nanya soal paket Lombok tapi belum closing"
  * "➡️ Konfirmasi pembayaran Bu Sari — bukti transfer sudah masuk tapi belum diverifikasi"
  * "➡️ Cek apakah slot Bali trip tanggal 15 masih ada sebelum konfirmasi ke peserta baru"
- Kalau pertanyaannya factual/data saja (misal: "harga paket A berapa?"), tidak perlu action suggestion.

**📊 FORMAT JAWABAN:**
- Pakai Markdown dengan bijak. Untuk laporan bisnis: pakai bullet + bold. Untuk obrolan santai: teks biasa saja.
- Tabel kalau ada data komparatif/banyak angka.
- Jawaban pendek untuk pertanyaan pendek.

**📎 DATA & LAMPIRAN:**
- Share link lampiran secara natural jika relevan: "Nih brosurnya: [Download PDF](url)"
- Pakai download_url dari data lampiran. JANGAN karang link fiktif.
- Kalau data kosong/nol, bilang apa adanya.

**🌐 INFO INTERNET:**
- Gunakan data web search untuk menjawab soal kurs, berita, tren pasar. Sebutkan ini info real-time dari internet.

**⚠️ KONFLIK PAKET:**
- Kalau ada paket mirip di Basic DAN Advanced, WAJIB tanya klarifikasi dulu.`;

    const answer = await executePlainAI(tenantId, synthesisSystemPrompt, "Berikan jawaban akhir Anda dalam format markdown yang bersih dan rapi. Jangan membalutnya dengan format JSON, berikan teks langsung.", [], 'admin_copilot');
    if (!answer) {
      return "Maaf, saya tidak dapat memformulasikan rangkuman analisis saat ini akibat kesalahan jaringan model AI.";
    }
    
    // Simpan jawaban AI ke database secara persisten
    await saveAdminMessage(tenantId, sessionId, 'assistant', answer);

    // Picu summarization di background secara asinkron
    triggerAdminBackgroundSummarization(tenantId, sessionId).catch(e => {
      console.error(`[Background Summarization Trigger Error]:`, e);
    });

    return answer;

  } catch (error) {
    console.error("[AdminCopilot Error]:", error);
    return "Terjadi kesalahan internal pada sistem penalaran Admin Copilot. Silakan hubungi tim teknis.";
  }
};

