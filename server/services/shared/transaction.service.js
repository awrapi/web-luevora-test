import prisma from '../../config/database.js';
import { sendText } from './messaging.service.js';

// Helper: Get integer from setting, with fallback
const getSettingInt = async (tenantId, key, fallback) => {
  const s = await prisma.globalSetting.findUnique({
    where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: key } }
  });
  if (!s || !s.setting_value) return fallback;
  const val = parseInt(s.setting_value);
  return isNaN(val) ? fallback : val;
};

// Helper: Get bool from setting
const getSettingBool = async (tenantId, key, fallback) => {
  const s = await prisma.globalSetting.findUnique({
    where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: key } }
  });
  if (!s || !s.setting_value) return fallback;
  return s.setting_value === 'true' || s.setting_value === '1';
};

export const createTransaction = async (tenantId, phone, customerName, orderId, items) => {
  // 1. Calculate total price from items array
  let totalPrice = 0;
  let packageName = '';
  let paxCount = 1;

  if (items && items.length > 0) {
    items.forEach(item => {
      const subtotal = (item.unitPrice || 0) * (item.quantity || 1);
      totalPrice += subtotal;
    });
    packageName = items[0]?.itemName || '';
    paxCount = items[0]?.quantity || 1;
  }

  // 2. Check DP settings
  const isDpEnabled = await getSettingBool(tenantId, 'dp_enabled', false);
  let dpPercentage = 0;
  let dpAmount = null;

  if (isDpEnabled) {
    dpPercentage = await getSettingInt(tenantId, 'dp_percentage', 50);
    dpAmount = (totalPrice * dpPercentage) / 100;
  }

  // 3. Create Transaction (no items relation in schema - store package info in destination field)
  const transaction = await prisma.transaction.create({
    data: {
      tenant_id: tenantId,
      user_phone: phone,
      customer_name: customerName,
      order_id: orderId,
      total_price: totalPrice,
      destination: packageName,
      pax_count: paxCount,
      status: 'pending',
      invoice_sent_at: new Date()
    }
  });

  return transaction;
};

export const getTransactions = async (tenantId, filters = {}) => {
  const where = { tenant_id: tenantId };

  if (filters.status && filters.status !== 'all') {
    where.status = filters.status;
  }

  // Date range filter (same logic as getPerformanceData in travel.service.js)
  const { range, startDate, endDate } = filters;
  if (range && range !== 'all') {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    end.setHours(23, 59, 59, 999);

    if (range === 'custom' && startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      switch (range) {
        case 'today':
          start.setHours(0, 0, 0, 0);
          break;
        case '7d':
          start.setDate(now.getDate() - 7);
          start.setHours(0, 0, 0, 0);
          break;
        case '1m':
          start.setDate(now.getDate() - 30);
          start.setHours(0, 0, 0, 0);
          break;
        case '1y':
          start.setFullYear(now.getFullYear() - 1);
          start.setHours(0, 0, 0, 0);
          break;
        default:
          start = null;
          end = null;
      }
    }

    if (start && end) {
      where.created_at = { gte: start, lte: end };
    }
  }

  return await prisma.transaction.findMany({
    where,
    include: { refund_requests: true, customer_requests: true },
    orderBy: { created_at: 'desc' }
  });
};

export const updateStatus = async (tenantId, transactionId, newStatus, additionalData = {}) => {
  const trx = await prisma.transaction.update({
    where: { id: parseInt(transactionId) },
    data: {
      status: newStatus,
      ...additionalData
    }
  });

  // Sync to CustomerManagement
  try {
    const cm = await prisma.customerManagement.findFirst({
      where: { tenant_id: tenantId, phone: trx.user_phone, status: { notIn: ['canceled_customer', 'done'] } }
    });
    if (cm) {
      if (['completed', 'done', 'paid_full'].includes(newStatus)) {
        await prisma.customerManagement.update({
          where: { id: cm.id },
          data: { status: 'done', admin_note: cm.admin_note ? cm.admin_note + '\n- [SISTEM] Transaksi Lunas/Selesai' : '- [SISTEM] Transaksi Lunas/Selesai' }
        });
      } else if (['cancelled', 'rejected'].includes(newStatus)) {
        await prisma.customerManagement.update({
          where: { id: cm.id },
          data: { status: 'canceled_customer', admin_note: cm.admin_note ? cm.admin_note + '\n- [SISTEM] Transaksi Dibatalkan' : '- [SISTEM] Transaksi Dibatalkan' }
        });
      }
    }
  } catch (err) {
    console.error('[Transaction Service] Failed to sync CustomerManagement:', err.message);
  }

  return trx;
};

export const processLifecycle = async () => {
  try {
    console.log('[Transaction Lifecycle] Running check...');
    // Since we handle multi-tenant, we should group by tenant to get their specific settings
    const tenants = await prisma.tenant.findMany({ where: { is_active: 1 } });

    for (const tenant of tenants) {
      const tenantId = tenant.id;
      const signDelayHours = await getSettingInt(tenantId, 'sign_delay_hours', 4);
      const autoFollowUpExpiry = await getSettingInt(tenantId, 'auto_followup_expiry_hours', 72);
      const expiredDelayHours = await getSettingInt(tenantId, 'expired_delay_hours', 48);
      const isAutoFollowUpEnabled = await getSettingBool(tenantId, 'auto_follow_up', false);

      const now = new Date();

      // 1. PENDING -> SIGN
      const signThreshold = new Date(now.getTime() - signDelayHours * 60 * 60 * 1000);
      const pendingToSign = await prisma.transaction.findMany({
        where: {
          tenant_id: tenantId,
          status: 'pending',
          invoice_sent_at: { lte: signThreshold }
        }
      });

      for (const trx of pendingToSign) {
        let newStatus = 'sign';
        let followUpDate = null;
        
        // If Auto Follow Up is enabled, AI takes over directly and we skip to 2nd_pending
        if (isAutoFollowUpEnabled) {
          console.log(`[Lifecycle] Auto Follow-Up for Transaction ${trx.order_id}`);
          const msg = `Halo Kak ${trx.customer_name || ''}! Mengingatkan kembali untuk tagihan invoice ${trx.order_id} masih menunggu pembayaran ya Kak 😊`;
          await sendText(prisma, trx.phone, msg, { tenantId });
          
          newStatus = 'second_pending';
          followUpDate = new Date();
        }

        await prisma.transaction.update({
          where: { id: trx.id },
          data: { 
            status: newStatus, 
            sign_at: new Date(),
            followed_up_at: followUpDate
          }
        });
      }

      // 2. SIGN -> 2nd_pending (If auto follow up is OFF, wait for auto_followup_expiry_hours)
      const followUpThreshold = new Date(now.getTime() - autoFollowUpExpiry * 60 * 60 * 1000);
      await prisma.transaction.updateMany({
        where: {
          tenant_id: tenantId,
          status: 'sign',
          sign_at: { lte: followUpThreshold }
        },
        data: {
          status: 'second_pending',
          followed_up_at: new Date() // Mark as followed up to trigger next timer
        }
      });

      // 3. second_pending -> EXPIRED
      const expiredThreshold = new Date(now.getTime() - expiredDelayHours * 60 * 60 * 1000);
      await prisma.transaction.updateMany({
        where: {
          tenant_id: tenantId,
          status: 'second_pending',
          followed_up_at: { lte: expiredThreshold }
        },
        data: {
          status: 'expired',
          expired_at: new Date()
        }
      });

      // 4. Auto-Expire Pending Offers and Requests after 7 days of ghosting (Anti-Ghosting AI)
      //    Only expire for leads with ghost_status = 'ghosted' (not idle/at_risk)
      const ghostingThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get phones of truly ghosted leads (ghost_status = 'ghosted')
      const ghostedLeads = await prisma.lead.findMany({
        where: { tenant_id: tenantId, ghost_status: 'ghosted' },
        select: { phone: true },
      });
      const ghostedPhones = ghostedLeads.map(l => l.phone);

      if (ghostedPhones.length > 0) {
        const expiredOffers = await prisma.offer.updateMany({
          where: { tenant_id: tenantId, status: 'pending', created_at: { lte: ghostingThreshold }, phone: { in: ghostedPhones } },
          data: { status: 'canceled_customer' }
        });
        if (expiredOffers.count > 0) {
          console.log(`[Lifecycle] Expired ${expiredOffers.count} ghosted offers for Tenant ${tenantId}`);
        }

        const expiredRequests = await prisma.customerRequest.updateMany({
          where: { tenant_id: tenantId, status: 'pending', created_at: { lte: ghostingThreshold }, phone: { in: ghostedPhones } },
          data: { status: 'canceled_customer', revision_note: 'Dibatalkan otomatis karena kustomer tidak melanjutkan (Ghosting 7 Hari).' }
        });
        if (expiredRequests.count > 0) {
          console.log(`[Lifecycle] Expired ${expiredRequests.count} ghosted requests for Tenant ${tenantId}`);
        }
      }
    }

    console.log('[Transaction Lifecycle] Check complete.');
  } catch (error) {
    console.error('[Transaction Lifecycle] Error:', error);
  }
};
