import prisma from '../../config/database.js';
import { sendText } from '../../services/shared/messaging.service.js';
import { saveMessage } from '../../services/shared/chat.service.js';
import { executeLangChain } from '../../services/ai_agent/logic.service.js';

/**
 * Generate AI natural language reply and send to customer via WA
 */
const sendAiReply = async (tenantId, phone, customerName, aiPrompt) => {
  const [personaSetting, tenant, lead] = await Promise.all([
    prisma.globalSetting.findUnique({
      where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: 'ai_persona_sales' } }
    }),
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.lead.findUnique({ where: { uk_tenant_phone: { tenant_id: tenantId, phone } } })
  ]);

  const personaText = personaSetting?.setting_value
    ? `Nama Bisnis: ${tenant?.business_name}\n${personaSetting.setting_value}`
    : `Kamu adalah asisten virtual untuk ${tenant?.business_name}.`;

  const aiResponse = await executeLangChain({
    tenantId,
    personaText,
    kbContext: 'Tidak ada knowledge base tambahan.',
    bankInfo: '',
    userMessage: aiPrompt,
    longTermMemory: '',
    customerContext: {
      savedName: lead?.saved_name || customerName || null,
      pushName: customerName || 'Pelanggan',
      email: lead?.email || null,
      preferences: lead?.preferences || null,
      notes: null
    }
  });

  const rawReply = typeof aiResponse === 'string' ? aiResponse : (aiResponse?.content || '');
  if (!rawReply) throw new Error('AI returned empty reply');

  // Split by [NEXT] and send each bubble separately (mimic webhook pipeline behavior)
  const bubbles = rawReply
    .split(/\[NEXT\]/gi)
    .map(b => b.replace(/\[SISTEM:.*?\]/gis, '').trim())
    .filter(b => b.length > 0);

  const fullReply = bubbles.join('\n');

  for (let i = 0; i < bubbles.length; i++) {
    await sendText(prisma, phone, bubbles[i], { tenantId });
    if (i < bubbles.length - 1) await new Promise(r => setTimeout(r, 1500));
  }

  await saveMessage(prisma, phone, 'assistant', fullReply, tenantId);
  await prisma.lead.updateMany({
    where: { tenant_id: tenantId, phone },
    data: { last_message_preview: fullReply.substring(0, 500), last_message_at: new Date() }
  });
  return fullReply;
};

export const getRequests = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { status, type } = req.query;
    const where = { tenant_id: tenantId };
    if (status && status !== 'all') where.status = status;
    if (type) where.request_type = type;
    const requests = await prisma.customerRequest.findMany({ where, orderBy: { created_at: 'desc' } });

    // ── Enrich with CustomerManagement context per phone ──
    const uniquePhones = [...new Set(requests.map(r => r.phone))];
    const cmRecords = {};
    if (uniquePhones.length > 0) {
      const cms = await prisma.customerManagement.findMany({
        where: { tenant_id: tenantId, phone: { in: uniquePhones } },
        orderBy: { created_at: 'desc' },
      });
      for (const cm of cms) {
        if (!cmRecords[cm.phone]) cmRecords[cm.phone] = cm;
      }
    }

    const enriched = requests.map(r => {
      const cm = cmRecords[r.phone] || null;
      return {
        ...r,
        context: cm ? {
          package_name: cm.package_name,
          departure_date: cm.departure_date,
          requested_date: cm.requested_date,
          collected_data: cm.collected_data,
          ai_context_notes: cm.ai_context_notes,
          crm_status: cm.status,
        } : null,
      };
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('[CustomerRequest] Error fetching:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data request' });
  }
};

export const takeOver = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;
    const request = await prisma.customerRequest.findFirst({ where: { id: parseInt(id), tenant_id: tenantId } });
    if (!request) return res.status(404).json({ success: false, message: 'Request tidak ditemukan' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'Request sudah diproses' });
    await prisma.customerRequest.update({
      where: { id: parseInt(id) },
      data: { status: 'taken_over', resolved_at: new Date(), updated_at: new Date() }
    });
    res.json({ success: true, message: 'Ambil alih berhasil.', phone: request.phone });
  } catch (error) {
    console.error('[CustomerRequest] Error takeOver:', error);
    res.status(500).json({ success: false, message: 'Gagal ambil alih request' });
  }
};

export const approveRequest = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;
    const { with_terms, ai_context } = req.body;
    const request = await prisma.customerRequest.findFirst({ where: { id: parseInt(id), tenant_id: tenantId } });
    if (!request) return res.status(404).json({ success: false, message: 'Request tidak ditemukan' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'Request sudah diproses' });

    await prisma.customerRequest.update({
      where: { id: parseInt(id) },
      data: { status: with_terms ? 'pending_customer' : 'approved', ai_context: ai_context || null, resolved_at: with_terms ? null : new Date(), updated_at: new Date() }
    });

    const aiPrompt = with_terms && ai_context
      ? `[ADMIN_APPROVAL_WITH_TERMS] Request dari ${request.customer_name || 'pelanggan'} untuk "${request.request_detail}" pada paket ${request.package_name} DISETUJUI ADMIN dengan syarat/biaya tambahan: "${ai_context}". Sampaikan kabar baik ini dengan bahasa ramah dan antusias. Jelaskan syaratnya dengan jelas lalu tanya langkah selanjutnya. PENTING: Jika pelanggan setuju, pastikan Anda menambahkan biaya ekstra ini ke perhitungan Total Harga akhir saat nanti mengeluarkan tag [SEND_INVOICE_TO], dan WAJIB membalas dengan tag [ACCEPT_TERMS: ${request.id}] jika setuju, atau [REJECT_TERMS: ${request.id}] jika menolak.`
      : `[ADMIN_APPROVAL] Request dari ${request.customer_name || 'pelanggan'} untuk "${request.request_detail}" pada paket ${request.package_name} DISETUJUI ADMIN. Sampaikan kabar baik ini dengan bahasa sangat ramah dan antusias. Tanya langkah selanjutnya untuk booking.`;

    try {
      await sendAiReply(tenantId, request.phone, request.customer_name, aiPrompt);
    } catch (aiErr) {
      console.error('[CustomerRequest] AI failed, fallback:', aiErr.message);
      const fallback = with_terms
        ? `Halo Kak ${request.customer_name || ''}! Kabar baik, request Anda disetujui dengan catatan: ${ai_context} 😊`
        : `Halo Kak ${request.customer_name || ''}! Kabar baik, tim manajemen menyetujui request Anda! 🎉`;
      await sendText(prisma, request.phone, fallback, { tenantId });
      await saveMessage(prisma, request.phone, 'assistant', fallback, tenantId);
    }

    res.json({ success: true, message: 'Request disetujui dan notifikasi dikirim.' });
  } catch (error) {
    console.error('[CustomerRequest] Error approveRequest:', error);
    res.status(500).json({ success: false, message: 'Gagal menyetujui request' });
  }
};

export const rejectRequest = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;
    const { reason, suggested_date } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ success: false, message: 'Alasan penolakan wajib diisi' });

    const request = await prisma.customerRequest.findFirst({ where: { id: parseInt(id), tenant_id: tenantId } });
    if (!request) return res.status(404).json({ success: false, message: 'Request tidak ditemukan' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'Request sudah diproses' });

    await prisma.customerRequest.update({
      where: { id: parseInt(id) },
      data: { status: 'rejected', admin_note: reason, ai_context: suggested_date || null, resolved_at: new Date(), updated_at: new Date() }
    });

    let aiPrompt = `[ADMIN_REJECTION] Request dari ${request.customer_name || 'pelanggan'} untuk "${request.request_detail}" pada paket ${request.package_name} DITOLAK ADMIN dengan alasan: "${reason}". `;
    if (suggested_date) {
      aiPrompt += `Sampaikan penolakan ini dengan bahasa sangat sopan. Admin menawarkan alternatif tanggal keberangkatan: ${suggested_date}. Tawarkan alternatif ini kepada kustomer dan tanyakan apakah mereka setuju dengan tanggal tersebut.`;
    } else {
      aiPrompt += `Sampaikan penolakan ini dengan bahasa sangat sopan, penuh empati, dan tetap jaga hubungan baik. Tawarkan alternatif lain jika ada.`;
    }

    try {
      await sendAiReply(tenantId, request.phone, request.customer_name, aiPrompt);
    } catch (aiErr) {
      console.error('[CustomerRequest] AI failed for rejection:', aiErr.message);
      const fallback = `Halo Kak ${request.customer_name || ''}, mohon maaf request Anda untuk paket ${request.package_name} belum bisa dipenuhi. ${reason} 🙏`;
      await sendText(prisma, request.phone, fallback, { tenantId });
      await saveMessage(prisma, request.phone, 'assistant', fallback, tenantId);
    }

    res.json({ success: true, message: 'Request ditolak dan notifikasi dikirim.' });
  } catch (error) {
    console.error('[CustomerRequest] Error rejectRequest:', error);
    res.status(500).json({ success: false, message: 'Gagal menolak request' });
  }
};
