import prisma from '../../config/database.js';
import { executeLangChain } from './logic.service.js';

/**
 * Triggers a background task to summarize the chat history for a specific lead.
 * This function handles the "sliding window summary" concept.
 * It will run only if the lead's msg_count_since_summary >= 5 or if forced.
 * 
 * @param {number} tenantId 
 * @param {string} userPhone 
 * @param {boolean} force - Force summarization even if count < 5
 */
export const triggerBackgroundSummarization = async (tenantId, userPhone, force = false) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { uk_tenant_phone: { tenant_id: tenantId, phone: userPhone } }
    });

    if (!lead) return;

    if (!force && (lead.msg_count_since_summary || 0) < 5) {
      // Not yet time to summarize
      return;
    }

    console.log(`[Memory Service] Triggering background summarization for ${userPhone} (Messages since last: ${lead.msg_count_since_summary})`);

    // Fetch the raw chat history for this user (oldest first)
    const chats = await prisma.chatHistory.findMany({
      where: { tenant_id: tenantId, user_phone: userPhone },
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }]
    });

    if (chats.length <= 5) {
      // If total chats are 5 or less, we don't summarize yet because we always keep 5 raw messages
      await prisma.lead.update({
        where: { uk_tenant_phone: { tenant_id: tenantId, phone: userPhone } },
        data: { msg_count_since_summary: 0 }
      });
      return;
    }

    // Prepare context for summarization AI
    const existingSummary = lead.chat_summary || 'Belum ada ringkasan.';
    
    // We want to summarize the messages that fell out of the active window.
    // Active window = top 5 + bottom 15. Everything in between needs summarization.
    // We take all messages from index 5 up to (length - 15).
    const messagesToSummarize = chats.length > 20 ? chats.slice(5, chats.length - 15) : [];
    
    if (messagesToSummarize.length === 0 && !force) {
       await prisma.lead.update({
        where: { uk_tenant_phone: { tenant_id: tenantId, phone: userPhone } },
        data: { msg_count_since_summary: 0 }
      });
      return;
    }

    const conversationTranscript = messagesToSummarize.map(c => `${c.role === 'user' ? 'Pelanggan' : 'Customer Service'}: ${c.message}`).join('\n');

    const summarizeInstruction = `
Tugas Anda adalah membuat ringkasan memori percakapan antara Pelanggan dan Customer Service (CS).
Ini adalah tugas *internal system*, JANGAN membalas seolah-olah Anda bicara dengan pelanggan. Output Anda HANYA berupa catatan ringkasan.

ATURAN RINGKASAN:
1. Ringkas inti pembicaraan, permintaan pelanggan, penawaran harga, atau masalah yang sedang didiskusikan.
2. Jika ada Ringkasan Lama, gabungkan informasi penting dari sana dengan percakapan baru. Jangan buang info krusial.
3. Buat seringkas mungkin TAPI tetap WAJIB mencantumkan DATA KRUSIAL berikut (jika sudah disebutkan pelanggan):
   - **Nama pelanggan** (nama lengkap jika sudah diketahui)
   - **Jumlah peserta & komposisi** (contoh: "4 orang: 2 dewasa + 1 anak 7 tahun (CWB) + 1 remaja 15 tahun (dewasa)")
   - **Tanggal keberangkatan** yang diminta/dibahas
   - **Budget / anggaran** yang disebutkan pelanggan
   - **Preferensi hotel** (bintang berapa, nama hotel)
   - **Paket yang dibahas** (nama paket spesifik)
   - **Keputusan yang sudah dibuat** (CWB/CNB, upgrade, tambahan layanan, dll)
   - **Status negosiasi** (sudah deal, masih diskusi, menunggu approval, dll)
4. Format: Gunakan bullet points. Maksimal 5 paragraf.
5. JANGAN hanya menulis ringkasan abstrak seperti "masih eksplorasi" — CANTUMKAN DATA SPESIFIK!

CONTOH RINGKASAN YANG BAIK:
- Pelanggan: Akbar (4 orang: suami-istri + anak 7 tahun + anak 15 tahun)
- Paket: Pesona Bali Selatan & Ubud 4H3M
- Preferensi: Hotel Bintang 3, anak 7 tahun pilih CWB
- Tanggal: Ingin berangkat 3 Juli 2026 (menunggu konfirmasi admin)
- Budget: ~50 juta total
- Status: Sudah diskusi harga, menunggu konfirmasi tanggal

ATURAN DETEKSI PERGANTIAN TOPIK (TOPIC SHIFT):
Jika Anda mendeteksi bahwa percakapan baru-baru ini telah SEPENUHNYA BERGANTI TOPIK secara drastis (misalnya, sebelumnya bahas Paket Bali, sekarang bahas Rental Mobil, dan urusan Paket Bali sudah dianggap selesai/ditutup), maka:
Outputkan kata kunci rahasia: [TOPIC_RESET] di akhir ringkasan Anda.

⚠️ PENTING — MESKIPUN TERJADI TOPIC SHIFT, DATA BERIKUT WAJIB DIPERTAHANKAN:
- Jumlah peserta/pax/kuantitas yang sudah disebutkan customer (contoh: "47 orang", "10 unit")
- Nama customer dan perusahaan
- Nominal harga/budget yang sudah disebutkan atau disepakati
- Tanggal spesifik (keberangkatan, deadline, jadwal)
- Keputusan yang sudah dibuat (upgrade, CWB/CNB, varian dipilih)
Angka-angka dan fakta spesifik ini TIDAK BOLEH dihapus dari ringkasan meskipun topik bergeser. Tulis sebagai bagian "Data Terkonfirmasi" di ringkasan.

=== RINGKASAN LAMA ===
${existingSummary}

=== PERCAKAPAN BARU YANG PERLU DIRINGKAS ===
${conversationTranscript}

Berikan output ringkasan gabungan Anda sekarang:
`;

    // Execute Langchain with our summarizer instruction. We use executeLangChain directly to use the tenant's AI config.
    const summaryResponse = await executeLangChain({
      tenantId,
      personaText: 'Anda adalah AI spesialis penganalisis dan peringkas percakapan sistem.',
      kbContext: 'Hanya fokus pada meringkas percakapan pelanggan.',
      bankInfo: '',
      userMessage: summarizeInstruction,
      selectedModuleIds: [], // Core-only — summarization doesn't need any prompt modules
    });

    let finalSummary = summaryResponse;
    let topicResetDetected = false;

    if (finalSummary.includes('[TOPIC_RESET]')) {
      topicResetDetected = true;
      finalSummary = finalSummary.replace('[TOPIC_RESET]', '').trim();
      console.log(`[Memory Service] Topic Reset Detected for ${userPhone}!`);
      // Optional: If topic reset is fully detected, we could just say "Topic changed, starting fresh: " + finalSummary
    }

    // Update the Lead table with the new summary and reset the counter
    await prisma.lead.update({
      where: { uk_tenant_phone: { tenant_id: tenantId, phone: userPhone } },
      data: {
        chat_summary: finalSummary,
        msg_count_since_summary: 0
      }
    });

    console.log(`[Memory Service] Background summarization completed for ${userPhone}.`);

  } catch (error) {
    console.error(`[Memory Service Error] Failed to summarize for ${userPhone}:`, error);
  }
};
