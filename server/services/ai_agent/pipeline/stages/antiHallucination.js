/**
 * ================================================================
 * ANTI-HALLUCINATION VERIFICATION
 * ================================================================
 * Verifies AI response against KB context to catch fabricated
 * prices, facilities, schedules, or other factual claims.
 *
 * Uses a separate fast LLM call to fact-check the response.
 * If violations are found, returns a corrected reply.
 *
 * Extracted from stage7.postProcessor.js for maintainability.
 */

import { executeFastJsonAI } from '../../logic.service.js';

/**
 * Verify AI response for hallucinations against KB context.
 *
 * @param {number} tenantId
 * @param {string} userMessage - Original customer question
 * @param {string} finalReply - AI reply to verify
 * @param {string} contextForVerify - KB context to verify against
 * @returns {{ verified: boolean, correctedReply: string|null, violations: string[] }}
 */
export const verifyAntiHallucination = async (tenantId, userMessage, finalReply, contextForVerify) => {
  if (!contextForVerify || contextForVerify.length < 100) {
    return { verified: true, correctedReply: null, violations: [] };
  }

  try {
    const systemPrompt = `Kamu adalah AI fact-checker. Tugasmu mengecek apakah balasan AI Sales konsisten dengan data yang tersedia.

ATURAN VERIFIKASI:
1. Periksa apakah AI menyebutkan HARGA ANGKA SPESIFIK yang TIDAK ADA di data konteks.
2. Periksa apakah AI menyebutkan FASILITAS atau LAYANAN yang jelas-jelas TIDAK ADA di data konteks.
3. Periksa apakah AI mengarang JADWAL atau TANGGAL yang TIDAK ADA di data konteks.
4. Jika jawaban hanya basa-basi/sapaan/rekomendasi umum TANPA klaim data spesifik, itu AMAN.
5. Jika AI menyebut ketentuan minimal peserta, estimasi, atau rekomendasi berdasarkan jenis paket yang sudah ada di konteks, itu AMAN.
6. Jika AI merekomendasikan paket berdasarkan konteks promosi yang diberikan, itu AMAN.
7. Hanya flag jika ada angka harga atau fasilitas yang benar-benar dikarang.
8. Perbedaan ejaan Indonesia-Inggris (jip/jeep, tur/tour) = AMAN.
9. PENTING: Jika data konteks mengandung "JAWABAN DARI DOKUMEN PRODUK/LAYANAN" atau "JAWABAN DARI DOKUMEN BASIS PENGETAHUAN", maka harga, tarif khusus, dan informasi detail yang disebutkan AI VALID karena berasal dari pembacaan dokumen pendukung yang telah diverifikasi. JANGAN flag informasi dari sumber ini sebagai halusinasi.
10. PENTING: Jika ada "CATATAN HARGA" yang menyatakan harga detail tersedia di dokumen lampiran, maka harga spesifik yang muncul di jawaban AI kemungkinan besar berasal dari dokumen tersebut dan AMAN.
11. SANGAT PENTING: Jika data konteks mengandung "RIWAYAT PERCAKAPAN DENGAN PELANGGAN", maka informasi yang berasal dari percakapan sebelumnya (seperti jumlah peserta, komposisi keluarga, usia anak, tanggal keberangkatan, preferensi hotel, nama pelanggan, pilihan CWB/CNB, dll) adalah VALID dan BUKAN halusinasi. AI BERHAK mengingat dan mereferensikan data dari percakapan sebelumnya.

Kembalikan HANYA JSON valid:
{
  "is_safe": true/false,
  "violations": ["deskripsi singkat pelanggaran"],
  "corrected_reply": "balasan yang sudah diperbaiki (HANYA jika is_safe=false)"
}`;
    const prompt = `Data Konteks:\n${contextForVerify.substring(0, 50000)}\n\nPertanyaan Customer: ${userMessage}\n\nBalasan AI yang perlu diverifikasi:\n${finalReply}`;
    const result = await executeFastJsonAI(tenantId, systemPrompt, prompt, [], 'anti_hallucination');

    if (result?.is_safe === false && result?.corrected_reply) {
      console.warn('[AntiHallucination] ⚠️ Hallucination detected:', result.violations);
      return {
        verified: false,
        correctedReply: result.corrected_reply,
        violations: result.violations || [],
      };
    }

    return { verified: true, correctedReply: null, violations: [] };
  } catch (e) {
    console.error('[AntiHallucination] Verify error:', e.message);
    return { verified: true, correctedReply: null, violations: [] };
  }
};
