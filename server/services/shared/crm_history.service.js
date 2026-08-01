import prisma from '../../config/database.js';
import { upsertDocument } from '../ai_agent/vector.service.js';

/**
 * Merekam jejak CRM History pelanggan secara persisten dan menyimpannya ke Redis Vector DB
 * agar AI bisa melakukan Retrieval-Augmented Generation (RAG) di masa depan.
 * 
 * @param {number} tenantId - Tenant ID
 * @param {string} phone - Nomor telepon pelanggan
 * @param {string} eventType - Jenis aktivitas (misal: "TRANS_COMPLETED", "NAME_UPDATED", "NEW_INQUIRY")
 * @param {string} eventDetail - Detail aktivitas (misal: "Menyelesaikan trip ke Bali pada 10 Okt 2023")
 */
export const recordCrmHistory = async (tenantId, phone, eventType, eventDetail) => {
  try {
    // 1. Simpan ke database relasional (Audit Log)
    const historyRecord = await prisma.customerCrmHistory.create({
      data: {
        tenant_id: tenantId,
        phone: phone,
        event_type: eventType,
        event_detail: eventDetail
      }
    });

    console.log(`[CRM History] Tersimpan ke DB: ${phone} - ${eventType}`);

    // 2. Simpan ke Vector Database (Redis) via Ollama Embedding
    const vectorText = `Pelanggan dengan kontak ${phone} memiliki riwayat: ${eventDetail}. Tipe: ${eventType}`;
    
    // Asynchronous Vector Upsert (Fire & Forget)
    upsertDocument(tenantId, 'CustomerCrmHistory', historyRecord.id, vectorText, { phone: phone })
      .catch(err => console.error('[CRM History] Gagal push ke Vector DB:', err));

  } catch (error) {
    console.error('[CRM History] Gagal merekam history:', error.message);
  }
};
