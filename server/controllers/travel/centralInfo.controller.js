import { PrismaClient } from '@prisma/client';
import * as centralInfoRequestService from '../../services/shared/centralInfoRequest.service.js';
import { processIncomingChat } from '../../services/ai_agent/handler.service.js';
import { broadcast } from '../../services/shared/sse.service.js';
import { sendText } from '../../services/shared/messaging.service.js';
import { saveMessage } from '../../services/shared/chat.service.js';

const prisma = new PrismaClient();

export const getCancellations = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const cancellations = await prisma.transaction.findMany({
      where: {
        tenant_id: tenantId,
        status: 'canceled',
        is_modified: 0 // Only actual cancellations, not modifications that auto-cancelled the old one
      },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        order_id: true,
        customer_name: true,
        user_phone: true,
        destination: true,
        total_price: true,
        admin_note: true,
        created_at: true,
        updated_at: true
      }
    });

    res.json({ success: true, data: cancellations });
  } catch (error) {
    console.error('[CentralInfo] Error fetching cancellations:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data pembatalan' });
  }
};

export const getModifications = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Fetch pending/approved modification requests
    const modRequests = await prisma.customerRequest.findMany({
      where: {
        tenant_id: tenantId,
        request_type: 'modification'
      },
      include: {
        transaction: {
          select: {
            order_id: true,
            total_price: true,
            destination: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    // Fetch auto-approved modifications (transactions with is_modified = 1)
    const autoMods = await prisma.transaction.findMany({
      where: {
        tenant_id: tenantId,
        is_modified: 1
      },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        order_id: true,
        customer_name: true,
        user_phone: true,
        destination: true,
        total_price: true,
        admin_note: true,
        created_at: true,
        updated_at: true
      }
    });

    res.json({ 
      success: true, 
      data: {
        requests: modRequests,
        auto_approved: autoMods
      }
    });
  } catch (error) {
    console.error('[CentralInfo] Error fetching modifications:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data modifikasi' });
  }
};

export const getCustomerManagement = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const allCm = await prisma.customerManagement.findMany({
      where: { tenant_id: tenantId },
      orderBy: { updated_at: 'desc' }
    });

    // ── Group by phone: merge multiple CM records per customer ──
    const byPhone = {};
    for (const cm of allCm) {
      if (!byPhone[cm.phone]) {
        byPhone[cm.phone] = cm; // First (most recent) becomes primary
      } else {
        // Merge collected_data from older records into primary
        const primary = byPhone[cm.phone];
        try {
          const primaryData = primary.collected_data ? JSON.parse(primary.collected_data) : {};
          const secondaryData = cm.collected_data ? JSON.parse(cm.collected_data) : {};
          // Older data fills gaps (primary takes precedence)
          const merged = { ...secondaryData, ...primaryData };
          primary.collected_data = JSON.stringify(merged);
        } catch {}
        // Use better customer_name if primary is generic
        const genericNames = ['----', 'pelanggan', 'kosong', '', null];
        if (genericNames.includes((primary.customer_name || '').toLowerCase().trim())) {
          primary.customer_name = cm.customer_name;
        }
        // Keep admin_note history
        if (cm.admin_note && primary.admin_note) {
          primary.admin_note = cm.admin_note + '\n' + primary.admin_note;
        } else if (cm.admin_note) {
          primary.admin_note = cm.admin_note;
        }
      }
    }

    const customers = Object.values(byPhone);

    // ── Enrich with lead profile data ──
    const phones = customers.map(c => c.phone);
    const leads = await prisma.lead.findMany({
      where: { tenant_id: tenantId, phone: { in: phones } },
      select: {
        phone: true,
        saved_name: true,
        push_name: true,
        email: true,
        first_name: true,
        last_name: true,
        preferences: true,
        chat_summary: true,
        city: true,
        personal_notes: true,
        pipeline_status: true,
      }
    });
    const leadMap = {};
    for (const l of leads) leadMap[l.phone] = l;

    const enriched = customers.map(cm => {
      const lead = leadMap[cm.phone] || {};
      // Fix generic customer_name from lead data
      const genericNames = ['----', 'pelanggan', 'kosong', '', null];
      let bestName = cm.customer_name;
      if (genericNames.includes((bestName || '').toLowerCase().trim())) {
        bestName = lead.saved_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || cm.phone || null;
      }
      return {
        ...cm,
        customer_name: bestName,
        lead_profile: {
          email: lead.email || null,
          first_name: lead.first_name || null,
          last_name: lead.last_name || null,
          preferences: lead.preferences || null,
          chat_summary: lead.chat_summary || null,
          city: lead.city || null,
          personal_notes: lead.personal_notes || null,
          pipeline_status: lead.pipeline_status || null,
        }
      };
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('[CentralInfo] Error fetching customer management:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data customer management' });
  }
};

export const updateCustomerManagementStatus = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;
    const { status, admin_note } = req.body;

    const updated = await prisma.customerManagement.update({
      where: { id: parseInt(id), tenant_id: tenantId },
      data: { status, admin_note }
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[CentralInfo] Error updating customer management:', error);
    res.status(500).json({ success: false, message: 'Gagal mengubah status' });
  }
};

/**
 * PUT /customer-management/:id/approve-date
 * Admin approves a requested departure date (basic package workflow).
 */
export const approveDateRequest = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;
    const { admin_note } = req.body;
    const adminName = req.user?.name || 'Admin';

    const cm = await prisma.customerManagement.findFirst({
      where: { id: parseInt(id), tenant_id: tenantId }
    });
    if (!cm) {
      return res.status(404).json({ success: false, message: 'Data customer tidak ditemukan' });
    }

    const timestamp = new Date().toLocaleString('id-ID');
    const existingNote = cm.admin_note || '';
    const approvalNote = `\n- [${timestamp}] ✅ Tanggal ${cm.requested_date ? cm.requested_date.toISOString().split('T')[0] : '-'} DISETUJUI oleh ${adminName}${admin_note ? `. Catatan: ${admin_note}` : ''}`;

    const updated = await prisma.customerManagement.update({
      where: { id: parseInt(id), tenant_id: tenantId },
      data: {
        date_status: 'approved',
        departure_date: cm.requested_date,
        date_approved_at: new Date(),
        date_actioned_by: adminName,
        ai_context_notes: admin_note || null,
        status: 'waiting_offer',
        admin_note: existingNote + approvalNote,
        updated_at: new Date()
      }
    });

    // ── Broadcast to dashboard ──
    broadcast(tenantId, 'customer_management_updated', {
      phone: cm.phone,
      date_status: 'approved',
      id: cm.id,
    });

    // ── Proactive AI follow-up: notify customer about the approval ──
    // Fire & forget — don't block the API response
    (async () => {
      try {
        const lead = await prisma.lead.findUnique({
          where: { uk_tenant_phone: { tenant_id: tenantId, phone: cm.phone } }
        });

        // Only trigger if lead is in AI mode (not manual)
        if (lead && lead.is_manual !== 1) {
          const approvalDate = cm.requested_date ? cm.requested_date.toISOString().split('T')[0] : 'tanggal yang diminta';
          const systemMessage = `[SISTEM: Admin telah MENYETUJUI tanggal keberangkatan ${approvalDate} untuk paket ${cm.package_name || 'yang dipesan'}. ${admin_note ? `Catatan admin: ${admin_note}.` : ''} Segera informasikan pelanggan bahwa tanggal sudah dikonfirmasi dan lanjutkan proses pemesanan. Tanyakan data yang belum lengkap (child policy, hotel, dll) secara natural.]`;

          console.log(`[CentralInfo] 🚀 Triggering proactive AI follow-up for ${cm.phone} (date approved)`);

          const result = await processIncomingChat({
            tenantId,
            userPhone: cm.phone,
            userMessage: systemMessage,
            chatType: 'sales',
          });

          if (result.success && result.data?.reply) {
            // Send each bubble to customer
            const bubbles = result.data.bubbles || [result.data.reply];
            for (let i = 0; i < bubbles.length; i++) {
              const text = bubbles[i]
                .replace(/\[SISTEM[^\]]*\]/gi, '')
                .replace(/\[CONVERSATION_INTENT:[^\]]+\]/gi, '')
                .replace(/\[NEXT\]/gi, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
              if (!text) continue;

              const saved = await saveMessage(prisma, cm.phone, 'assistant', text, tenantId);
              await sendText(prisma, cm.phone, text, { tenantId });

              broadcast(tenantId, 'new_message', {
                phone: cm.phone,
                message: text,
                role: 'assistant',
                timestamp: new Date().toISOString(),
                created_at: new Date().toISOString(),
                id: saved?.id ?? null,
              });

              // Delay between bubbles
              if (i < bubbles.length - 1) {
                await new Promise(r => setTimeout(r, 3000 + Math.random() * 1000));
              }
            }

            // Update lead preview
            const lastBubble = bubbles[bubbles.length - 1] || result.data.reply;
            await prisma.lead.update({
              where: { uk_tenant_phone: { tenant_id: tenantId, phone: cm.phone } },
              data: {
                last_message_preview: lastBubble.substring(0, 500),
                last_ai_reply: result.data.reply.substring(0, 2000),
                last_message_at: new Date(),
              }
            });

            broadcast(tenantId, 'lead_updated', {
              phone: cm.phone,
              last_message_preview: lastBubble.substring(0, 500),
              last_message_at: new Date().toISOString(),
            });

            console.log(`[CentralInfo] ✅ Proactive follow-up sent to ${cm.phone} (${bubbles.length} bubble(s))`);
          }
        } else {
          console.log(`[CentralInfo] ℹ️ Lead ${cm.phone} is in manual mode — skipping proactive follow-up`);
        }
      } catch (proactiveErr) {
        console.error(`[CentralInfo] ❌ Proactive follow-up failed for ${cm.phone}:`, proactiveErr.message);
      }
    })();

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[CentralInfo] Error approving date request:', error);
    res.status(500).json({ success: false, message: 'Gagal menyetujui tanggal' });
  }
};

/**
 * PUT /customer-management/:id/reject-date
 * Admin rejects a requested departure date with mandatory reason + optional suggested dates.
 */
export const rejectDateRequest = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;
    const { reason, suggested_dates } = req.body;
    const adminName = req.user?.name || 'Admin';

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Alasan penolakan wajib diisi' });
    }

    const cm = await prisma.customerManagement.findFirst({
      where: { id: parseInt(id), tenant_id: tenantId }
    });
    if (!cm) {
      return res.status(404).json({ success: false, message: 'Data customer tidak ditemukan' });
    }

    const timestamp = new Date().toLocaleString('id-ID');
    const existingNote = cm.admin_note || '';
    const suggestedText = suggested_dates && suggested_dates.length > 0
      ? ` Tanggal alternatif: ${suggested_dates.join(', ')}`
      : '';
    const rejectionNote = `\n- [${timestamp}] ❌ Tanggal ${cm.requested_date ? cm.requested_date.toISOString().split('T')[0] : '-'} DITOLAK oleh ${adminName}. Alasan: ${reason.trim()}.${suggestedText}`;

    const updated = await prisma.customerManagement.update({
      where: { id: parseInt(id), tenant_id: tenantId },
      data: {
        date_status: 'rejected',
        date_reject_reason: reason.trim(),
        date_suggested: suggested_dates && suggested_dates.length > 0 ? JSON.stringify(suggested_dates) : null,
        date_actioned_by: adminName,
        status: 'waiting_date',
        admin_note: existingNote + rejectionNote,
        updated_at: new Date()
      }
    });

    // ── Broadcast to dashboard ──
    broadcast(tenantId, 'customer_management_updated', {
      phone: cm.phone,
      date_status: 'rejected',
      id: cm.id,
    });

    // ── Proactive AI follow-up: inform customer about the rejection ──
    (async () => {
      try {
        const lead = await prisma.lead.findUnique({
          where: { uk_tenant_phone: { tenant_id: tenantId, phone: cm.phone } }
        });

        if (lead && lead.is_manual !== 1) {
          const rejectedDate = cm.requested_date ? cm.requested_date.toISOString().split('T')[0] : 'tanggal yang diminta';
          const suggestedInfo = suggested_dates && suggested_dates.length > 0
            ? ` Admin menyarankan tanggal alternatif: ${suggested_dates.join(', ')}.`
            : '';
          const systemMessage = `[SISTEM: Admin MENOLAK tanggal keberangkatan ${rejectedDate} untuk paket ${cm.package_name || 'yang dipesan'}. Alasan: ${reason.trim()}.${suggestedInfo} Sampaikan ke pelanggan secara HALUS dan EMPATIS bahwa tanggal tersebut belum tersedia. ${suggestedInfo ? 'Tawarkan tanggal alternatif yang disarankan admin.' : 'Tanyakan apakah ada tanggal lain yang diinginkan.'} JANGAN gunakan kata "ditolak" — gunakan frasa seperti "belum tersedia" atau "sedang penuh".]`;

          console.log(`[CentralInfo] 🚀 Triggering proactive AI follow-up for ${cm.phone} (date rejected)`);

          const result = await processIncomingChat({
            tenantId,
            userPhone: cm.phone,
            userMessage: systemMessage,
            chatType: 'sales',
          });

          if (result.success && result.data?.reply) {
            const bubbles = result.data.bubbles || [result.data.reply];
            for (let i = 0; i < bubbles.length; i++) {
              const text = bubbles[i]
                .replace(/\[SISTEM[^\]]*\]/gi, '')
                .replace(/\[CONVERSATION_INTENT:[^\]]+\]/gi, '')
                .replace(/\[NEXT\]/gi, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
              if (!text) continue;

              const saved = await saveMessage(prisma, cm.phone, 'assistant', text, tenantId);
              await sendText(prisma, cm.phone, text, { tenantId });

              broadcast(tenantId, 'new_message', {
                phone: cm.phone,
                message: text,
                role: 'assistant',
                timestamp: new Date().toISOString(),
                created_at: new Date().toISOString(),
                id: saved?.id ?? null,
              });

              if (i < bubbles.length - 1) {
                await new Promise(r => setTimeout(r, 3000 + Math.random() * 1000));
              }
            }

            const lastBubble = bubbles[bubbles.length - 1] || result.data.reply;
            await prisma.lead.update({
              where: { uk_tenant_phone: { tenant_id: tenantId, phone: cm.phone } },
              data: {
                last_message_preview: lastBubble.substring(0, 500),
                last_ai_reply: result.data.reply.substring(0, 2000),
                last_message_at: new Date(),
              }
            });

            broadcast(tenantId, 'lead_updated', {
              phone: cm.phone,
              last_message_preview: lastBubble.substring(0, 500),
              last_message_at: new Date().toISOString(),
            });

            console.log(`[CentralInfo] ✅ Proactive rejection follow-up sent to ${cm.phone}`);
          }
        }
      } catch (proactiveErr) {
        console.error(`[CentralInfo] ❌ Proactive rejection follow-up failed for ${cm.phone}:`, proactiveErr.message);
      }
    })();

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[CentralInfo] Error rejecting date request:', error);
    res.status(500).json({ success: false, message: 'Gagal menolak tanggal' });
  }
};

export const getStatusInformation = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const statusInfos = await prisma.statusInformation.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' }
    });
    res.json({ success: true, data: statusInfos });
  } catch (error) {
    console.error('[CentralInfo] Error fetching status information:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data status information' });
  }
};

// ================================================================
// CENTRAL INFO REQUESTS (AI Knowledge Gap)
// ================================================================

/**
 * GET /info-requests
 * List all central info requests, optionally filtered by status query param.
 */
export const getInfoRequests = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { status } = req.query;
    const requests = await centralInfoRequestService.getRequests(tenantId, status || null);
    res.json({ success: true, data: requests });
  } catch (error) {
    console.error('[CentralInfo] Error fetching info requests:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data permintaan informasi' });
  }
};

/**
 * PUT /info-requests/:id/instruct
 * Admin provides instruction for AI to answer the customer.
 */
export const instructInfoRequest = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;
    const { instruction } = req.body;

    if (!instruction || !instruction.trim()) {
      return res.status(400).json({ success: false, message: 'Instruksi tidak boleh kosong' });
    }

    const adminName = req.user?.name || null;
    const updated = await centralInfoRequestService.setAdminInstruction(
      parseInt(id), tenantId, instruction.trim(), adminName
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Request tidak ditemukan' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[CentralInfo] Error instructing info request:', error);
    res.status(500).json({ success: false, message: 'Gagal mengirim instruksi' });
  }
};

/**
 * PUT /info-requests/:id/takeover
 * Admin takes over the conversation manually.
 */
export const takeoverInfoRequest = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;
    const adminName = req.user?.name || null;

    const updated = await centralInfoRequestService.markTakenOver(
      parseInt(id), tenantId, adminName
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Request tidak ditemukan' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[CentralInfo] Error taking over info request:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil alih percakapan' });
  }
};

/**
 * PUT /info-requests/:id/resolve
 * Mark an info request as resolved.
 */
export const resolveInfoRequest = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;

    const updated = await centralInfoRequestService.markResolved(
      parseInt(id), tenantId
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Request tidak ditemukan' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[CentralInfo] Error resolving info request:', error);
    res.status(500).json({ success: false, message: 'Gagal menyelesaikan request' });
  }
};
