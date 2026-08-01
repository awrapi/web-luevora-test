import * as SubscriptionService from '../../services/shared/subscription.service.js';
import prisma from '../../config/database.js';

export const createTransaction = async (req, res) => {
  try {
    const { planKey } = req.body;
    const tenantId = req.tenant.id; // dari authMiddleware

    const token = await SubscriptionService.createSubscriptionTransaction(tenantId, planKey);

    return res.status(200).json({
      status: true,
      token
    });
  } catch (error) {
    console.error('[Subscription] Create Transaction Error:', error);
    return res.status(400).json({
      status: false,
      message: error.message || 'Gagal memproses transaksi.'
    });
  }
};

export const midtransWebhook = async (req, res) => {
  try {
    await SubscriptionService.handleMidtransNotification(req.body);
    return res.status(200).json({ status: 'OK' });
  } catch (error) {
    console.error('[Subscription] Webhook Error:', error);
    return res.status(500).json({ status: 'ERROR', message: error.message });
  }
};

export const getSubscriptionStatus = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        subscription_plan: true,
        subscription_status: true,
        subscription_expires_at: true
      }
    });

    return res.status(200).json({
      status: true,
      data: tenant
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: 'Gagal mengambil status langganan'
    });
  }
};
