import prisma from '../config/database.js';
import { sendText } from '../services/shared/messaging.service.js';
import { saveMessage } from '../services/shared/chat.service.js';
import { broadcast } from '../services/shared/sse.service.js';

export const getOffers = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const offers = await prisma.offer.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' }
    });

    // ── Enrich offers with CustomerManagement context per phone ──
    // Gives admin full context: what package, pax count, departure date, AI notes
    const uniquePhones = [...new Set(offers.map(o => o.phone))];
    const cmRecords = {};
    if (uniquePhones.length > 0) {
      const cms = await prisma.customerManagement.findMany({
        where: { tenant_id: tenantId, phone: { in: uniquePhones } },
        orderBy: { created_at: 'desc' },
      });
      // Keep latest record per phone
      for (const cm of cms) {
        if (!cmRecords[cm.phone]) cmRecords[cm.phone] = cm;
      }
    }

    const enriched = offers.map(o => {
      const cm = cmRecords[o.phone] || null;
      return {
        ...o,
        // Attach CustomerManagement context
        context: cm ? {
          package_name: cm.package_name,
          departure_date: cm.departure_date,
          requested_date: cm.requested_date,
          collected_data: cm.collected_data,   // JSON string with pax, destination, etc.
          ai_context_notes: cm.ai_context_notes,
          crm_status: cm.status,
        } : null,
      };
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('[Offers] Error fetching offers:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data penawaran' });
  }
};

export const approveOffer = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;

    const offer = await prisma.offer.findUnique({
      where: { id: parseInt(id) }
    });

    if (!offer || offer.tenant_id !== tenantId) {
      return res.status(404).json({ success: false, message: 'Penawaran tidak ditemukan' });
    }

    if (offer.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Penawaran sudah diproses' });
    }

    // Update status
    await prisma.offer.update({
      where: { id: parseInt(id) },
      data: { status: 'approved', updated_at: new Date() }
    });

    // ── AI-generated contextual follow-up (replace hardcoded template) ──
    // Fetch last few messages for context
    let message;
    try {
      const recentChats = await prisma.chatHistory.findMany({
        where: { tenant_id: tenantId, phone: offer.phone },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: 10,
        select: { role: true, message: true, created_at: true }
      });
      const chatContext = recentChats.reverse().map(c => `${c.role === 'user' ? 'Customer' : 'AI'}: ${c.message}`).join('\n');

      // Fetch CM data for extra context (pax, hotel, etc)
      const cmData = await prisma.customerManagement.findFirst({
        where: { tenant_id: tenantId, phone: offer.phone, status: { notIn: ['done', 'canceled_customer', 'canceled'] } },
        orderBy: { updated_at: 'desc' },
        select: { admin_note: true, collected_data: true }
      });
      const contextNotes = cmData?.admin_note || '';

      const systemPrompt = `Kamu adalah asisten travel WhatsApp yang hangat dan natural. Owner baru saja menyetujui penawaran harga dari customer. Tugas kamu adalah mengirim kabar baik ini kepada customer dengan cara yang ALAMI dan KONTEKSTUAL — bukan template kaku.

Data penawaran yang disetujui:
- Nama: ${offer.customer_name}
- Paket: ${offer.package_name}
- Harga yang disetujui: Rp ${offer.offered_price.toLocaleString('id-ID')}

Catatan konteks dari percakapan sebelumnya:
${contextNotes || '(tidak ada catatan tambahan)'}

Pedoman penulisan:
- Tulis seperti orang asli mengirim WA, bukan robot
- Sampaikan kabar baik dengan antusias tapi tidak berlebihan
- Sebutkan detail relevan dari konteks (misal: tanggal keberangkatan, pax, hotel) jika diketahui
- Tanyakan langkah selanjutnya secara natural (invoice, konfirmasi, dll)
- Bahasa Indonesia kasual, pakai "Kak", boleh emoji 1-2 yang relevan
- JANGAN copy-paste template. Buat mengalir dari konteks percakapan
- Maksimal 3 kalimat, singkat dan clear

Return JSON: { "message": "pesan follow-up yang natural" }`;

      const userPrompt = `Riwayat percakapan terakhir:\n${chatContext}\n\nBuatkan pesan follow-up yang natural setelah penawaran harga Rp ${offer.offered_price.toLocaleString('id-ID')} disetujui.`;

      const { executeFastJsonAI } = await import('../services/ai_agent/logic.service.js');
      const aiResult = await executeFastJsonAI(tenantId, systemPrompt, userPrompt, [], 'offer_approve_followup');
      message = aiResult?.message || null;
    } catch (aiErr) {
      console.warn('[Offers] AI follow-up generation failed, using fallback:', aiErr.message);
    }

    // Fallback jika AI gagal
    if (!message) {
      message = `Halo Kak ${offer.customer_name || ''}, kabar baik! Manajer kami sudah menyetujui harga Rp ${offer.offered_price.toLocaleString('id-ID')} untuk paket ${offer.package_name}. 🎉\n\nMau saya buatkan invoicenya sekarang Kak?`;
    }

    await sendText(prisma, offer.phone, message, { tenantId });
    await saveMessage(prisma, offer.phone, 'assistant', message, tenantId);

    // Broadcast to dashboard
    broadcast(tenantId, 'new_message', {
      phone: offer.phone,
      message,
      role: 'assistant',
      timestamp: new Date().toISOString(),
    });

    // Update Lead to trigger frontend refresh
    await prisma.lead.update({
      where: { uk_tenant_phone: { tenant_id: tenantId, phone: offer.phone } },
      data: { last_message_preview: message.substring(0, 500), last_message_at: new Date() }
    });

    res.json({ success: true, message: 'Penawaran disetujui dan pesan terkirim.' });
  } catch (error) {
    console.error('[Offers] Error approving offer:', error);
    res.status(500).json({ success: false, message: 'Gagal menyetujui penawaran' });
  }
};

export const rejectOffer = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;
    const { admin_offer, admin_note, allow_rerequest } = req.body;

    const offer = await prisma.offer.findUnique({
      where: { id: parseInt(id) }
    });

    if (!offer || offer.tenant_id !== tenantId) {
      return res.status(404).json({ success: false, message: 'Penawaran tidak ditemukan' });
    }

    if (offer.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Penawaran sudah diproses' });
    }

    const adminOfferValue = admin_offer ? parseFloat(admin_offer) : null;

    // Update status
    await prisma.offer.update({
      where: { id: parseInt(id) },
      data: { 
        status: 'rejected', 
        admin_offer: adminOfferValue,
        admin_note: admin_note || null,
        allow_rerequest: allow_rerequest === true,
        updated_at: new Date() 
      }
    });

    // ── AI-generated contextual reject follow-up ──
    let message;
    try {
      const recentChats = await prisma.chatHistory.findMany({
        where: { tenant_id: tenantId, phone: offer.phone },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: 10,
        select: { role: true, message: true }
      });
      const chatContext = recentChats.reverse().map(c => `${c.role === 'user' ? 'Customer' : 'AI'}: ${c.message}`).join('\n');

      const systemPrompt = `Kamu adalah asisten travel WhatsApp yang hangat dan natural. Owner MENOLAK penawaran harga dari customer. Tugas kamu adalah menyampaikan kabar ini dengan cara yang SOPAN, JUJUR, dan tetap MENJAGA HUBUNGAN BAIK — bukan template kaku.

Data penawaran yang DITOLAK:
- Nama: ${offer.customer_name}
- Paket: ${offer.package_name}
- Harga yang customer minta: Rp ${offer.offered_price.toLocaleString('id-ID')}
- Harga asli: Rp ${offer.original_price.toLocaleString('id-ID')}
${adminOfferValue ? `- Harga counter dari owner: Rp ${adminOfferValue.toLocaleString('id-ID')} (tawarkan ini!)` : '- Tidak ada harga counter (tolak dengan harga final)'}
${admin_note ? `- Catatan khusus dari owner: ${admin_note}` : ''}
${allow_rerequest ? '- Owner mengizinkan negosiasi ulang jika ada alasan baru' : '- Keputusan sudah FINAL, tidak bisa negosiasi ulang'}

Pedoman:
- Sampaikan dengan empati, bukan kaku
- ${adminOfferValue ? `Tawarkan harga counter Rp ${adminOfferValue.toLocaleString('id-ID')} dengan natural` : 'Sampaikan harga sudah final dan tidak bisa diturunkan lagi'}
- Jika ada catatan owner, jadikan sebagai konteks alasan penolakan (tapi jangan dikutip mentah-mentah)
- Bahasa Indonesia kasual, pakai "Kak", boleh 1 emoji
- Maksimal 2-3 kalimat, to the point
- JANGAN minta maaf berlebihan

Return JSON: { "message": "pesan reject yang natural" }`;

      const userPrompt = `Riwayat percakapan:\n${chatContext}\n\nBuatkan pesan penolakan yang natural dan kontekstual.`;

      const { executeFastJsonAI } = await import('../services/ai_agent/logic.service.js');
      const aiResult = await executeFastJsonAI(tenantId, systemPrompt, userPrompt, [], 'offer_reject_followup');
      message = aiResult?.message || null;
    } catch (aiErr) {
      console.warn('[Offers] AI reject follow-up failed, using fallback:', aiErr.message);
    }

    // Fallback jika AI gagal
    if (!message) {
      if (adminOfferValue) {
        message = `Halo Kak ${offer.customer_name || ''}, mohon maaf ya Kak, untuk harga Rp ${offer.offered_price.toLocaleString('id-ID')} belum bisa kami proses. Tapi manajer kami bisa kasih harga spesial Rp ${adminOfferValue.toLocaleString('id-ID')} untuk Kakak. Bagaimana Kak? 😊`;
      } else {
        message = `Halo Kak ${offer.customer_name || ''}, mohon maaf ya Kak, setelah diskusi dengan manajer harga Rp ${offer.offered_price.toLocaleString('id-ID')} belum bisa kami penuhi. Harga final untuk paket ${offer.package_name} tetap Rp ${offer.original_price.toLocaleString('id-ID')} ya Kak 🙏`;
      }
    }

    await sendText(prisma, offer.phone, message, { tenantId });
    await saveMessage(prisma, offer.phone, 'assistant', message, tenantId);

    // Broadcast to dashboard
    broadcast(tenantId, 'new_message', {
      phone: offer.phone,
      message,
      role: 'assistant',
      timestamp: new Date().toISOString(),
    });

    // Update Lead to trigger frontend refresh
    await prisma.lead.update({
      where: { uk_tenant_phone: { tenant_id: tenantId, phone: offer.phone } },
      data: { last_message_preview: message.substring(0, 500), last_message_at: new Date() }
    });

    res.json({ success: true, message: 'Penawaran ditolak dan pesan terkirim.' });
  } catch (error) {
    console.error('[Offers] Error rejecting offer:', error);
    res.status(500).json({ success: false, message: 'Gagal menolak penawaran' });
  }
};
