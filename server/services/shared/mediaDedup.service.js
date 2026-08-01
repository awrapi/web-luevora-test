/**
 * ================================================================
 * Media Dedup Service — Smart Media Deduplication
 * ================================================================
 * Mencegah AI mengirim foto/brosur/file yang sama berulang kali,
 * sambil tetap tahu KAPAN boleh mengirim ulang:
 *
 *   1. Versi Baru   — Admin sudah update file → kirim lagi
 *   2. Cooldown      — Sudah lewat 7 hari → kirim lagi
 *   3. Customer Minta — "kirim lagi brosurnya" → kirim lagi
 *   4. Belum Pernah  — Pertama kali → kirim
 *
 * Flow:
 *   getMediaSendHistory()  → panggil 1x per request (query DB)
 *   checkMediaAllowed()    → panggil per media (tanpa query DB)
 *   recordMediaSent()      → panggil setelah media berhasil terkirim
 * ================================================================
 */

import prisma from '../../config/database.js';

// ─── Konfigurasi ────────────────────────────────────
const COOLDOWN_DAYS = 7;

// Removed RE_REQUEST_KEYWORDS as we now rely on pure AI reasoning (analyzeIntent)

// ─── 1. Ambil Riwayat (panggil sekali per request) ──
/**
 * Ambil semua riwayat SENT_MEDIA untuk customer ini.
 * Panggil sekali di awal, lalu pass hasilnya ke checkMediaAllowed().
 *
 * @param {number} tenantId
 * @param {string} phone
 * @returns {Promise<Array>}
 */
export const getMediaSendHistory = async (tenantId, phone) => {
  try {
    return await prisma.customerCrmHistory.findMany({
      where: { tenant_id: tenantId, phone, event_type: 'SENT_MEDIA' },
      orderBy: { created_at: 'desc' },
      take: 50
    });
  } catch (err) {
    console.error('[MediaDedup] Failed to fetch history:', err.message);
    return [];
  }
};

// ─── 2. Cek Apakah Boleh Kirim (tanpa query DB) ────
/**
 * Cek apakah media boleh dikirim berdasarkan 4 kondisi.
 * TIDAK melakukan query DB — gunakan hasil getMediaSendHistory().
 *
 * @param {Array} sentHistory - Hasil dari getMediaSendHistory()
 * @param {string} mediaKey - Key unik (misal "pkg:5:file:12" atau URL)
 * @param {boolean} isMediaReRequest - Boolean from AI reasoning (analyzeIntent)
 * @param {Date|string|null} currentFileUpdatedAt - Kapan file terakhir di-update
 * @returns {{ allowed: boolean, reason: string, isNewVersion: boolean }}
 */
export const checkMediaAllowed = (sentHistory, mediaKey, isMediaReRequest = false, currentFileUpdatedAt = null) => {
  // ── Kondisi 3: Customer minta ulang (Pure AI Reasoning) ──
  if (isMediaReRequest) {
    return { allowed: true, reason: 'Customer meminta ulang media berdasarkan penalaran AI', isNewVersion: false };
  }

  // ── Kondisi 4: Belum pernah kirim ──
  if (!sentHistory || sentHistory.length === 0) {
    return { allowed: true, reason: 'Belum pernah mengirim media apapun', isNewVersion: false };
  }

  // Cari record yang cocok (paling baru dulu karena DESC)
  let matchingRecord = null;
  for (const record of sentHistory) {
    try {
      const detail = JSON.parse(record.event_detail);
      if (detail.media_key === mediaKey) {
        matchingRecord = { ...record, parsedDetail: detail };
        break;
      }
    } catch {
      // Format lama (non-JSON) — backward compat: cek substring URL
      if (record.event_detail && record.event_detail.includes(mediaKey)) {
        matchingRecord = { ...record, parsedDetail: null };
        break;
      }
    }
  }

  if (!matchingRecord) {
    return { allowed: true, reason: 'Media ini belum pernah dikirim ke customer', isNewVersion: false };
  }

  // ── Kondisi 1: Versi baru (file di-update admin) ──
  if (currentFileUpdatedAt && matchingRecord.parsedDetail?.file_updated_at) {
    const lastKnownUpdate = new Date(matchingRecord.parsedDetail.file_updated_at);
    const currentUpdate = new Date(currentFileUpdatedAt);
    if (currentUpdate > lastKnownUpdate) {
      return { allowed: true, reason: 'Versi baru tersedia — file telah diperbarui admin', isNewVersion: true };
    }
  }

  // ── Kondisi 2: Cooldown habis ──
  const daysSinceSent = (Date.now() - new Date(matchingRecord.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceSent >= COOLDOWN_DAYS) {
    return { allowed: true, reason: `Cooldown ${COOLDOWN_DAYS} hari habis (terakhir kirim ${Math.floor(daysSinceSent)} hari lalu)`, isNewVersion: false };
  }

  // ── BLOKIR — semua kondisi tidak terpenuhi ──
  return {
    allowed: false,
    reason: `Media sudah dikirim ${Math.floor(daysSinceSent)} hari lalu, cooldown ${COOLDOWN_DAYS} hari belum habis`,
    isNewVersion: false
  };
};

// ─── 3. Catat Pengiriman (panggil setelah send berhasil) ──
/**
 * Catat bahwa media berhasil dikirim ke customer.
 * Dipanggil di webhook.service.js setelah sendMedia() berhasil.
 *
 * @param {number} tenantId
 * @param {string} phone
 * @param {string} mediaKey - Key unik (sama dengan yang dicek di checkMediaAllowed)
 * @param {string} mediaUrl - URL lengkap media yang dikirim
 * @param {string} description - Deskripsi human-readable
 * @param {Date|string|null} fileUpdatedAt - Kapan file terakhir di-update
 */
export const recordMediaSent = async (tenantId, phone, mediaKey, mediaUrl, description, fileUpdatedAt = null) => {
  try {
    const eventDetail = JSON.stringify({
      media_key: mediaKey,
      media_url: mediaUrl,
      description: description,
      file_updated_at: fileUpdatedAt
        ? (fileUpdatedAt instanceof Date ? fileUpdatedAt.toISOString() : String(fileUpdatedAt))
        : null,
      sent_at: new Date().toISOString()
    });

    await prisma.customerCrmHistory.create({
      data: {
        tenant_id: tenantId,
        phone: phone,
        event_type: 'SENT_MEDIA',
        event_detail: eventDetail
      }
    });

    console.log(`[MediaDedup] ✔ Recorded: ${mediaKey} → ${phone}`);
  } catch (err) {
    console.error('[MediaDedup] Failed to record media sent:', err.message);
  }
};

export default { getMediaSendHistory, checkMediaAllowed, recordMediaSent };
