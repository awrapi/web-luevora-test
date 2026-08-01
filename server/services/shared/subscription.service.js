import prisma from '../../config/database.js';
import { snap } from '../../utils/midtrans.js';
import { v4 as uuidv4 } from 'uuid';

export const PLANS = {
  lite: { name: 'Lite', price: 799000 },
  starter: { name: 'Starter', price: 1749000 },
  growth: { name: 'Growth', price: 3499000 },
  scale: { name: 'Scale', price: 6249000 },
};

/**
 * Mapping paket langganan → jumlah kredit AI
 * - free:        700 kredit  (tidak berlangganan, AI diblokir)
 * - development: 15.000 kredit (akun internal/testing)
 * - lite:        10.000 kredit
 * - starter:     50.000 kredit
 * - growth:      125.000 kredit
 * - scale:       200.000 kredit
 */
export const PLAN_CREDITS = {
  free:        700,
  development: 15000,
  lite:        10000,
  starter:     50000,
  growth:      125000,
  scale:       200000,
};

/**
 * Buat transaksi Midtrans untuk berlangganan
 */
export const createSubscriptionTransaction = async (tenantId, planKey) => {
  const plan = PLANS[planKey];
  if (!plan) throw new Error('Paket tidak valid');

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { users: { where: { role: 'owner' } } }
  });

  if (!tenant) throw new Error('Tenant tidak ditemukan');
  const owner = tenant.users[0];

  const orderId = `SUB-${tenantId}-${Date.now()}-${uuidv4().substring(0,6)}`;

  // Simpan record ke database sebagai pending
  await prisma.subscriptionPayment.create({
    data: {
      tenant_id: tenantId,
      order_id: orderId,
      gross_amount: plan.price,
      plan_name: planKey,
      transaction_status: 'pending'
    }
  });

  // Buat parameter Midtrans Snap
  const parameter = {
    transaction_details: {
      order_id: orderId,
      gross_amount: plan.price
    },
    customer_details: {
      first_name: owner?.name || tenant.business_name,
      email: tenant.owner_email,
      phone: tenant.owner_phone || ''
    },
    item_details: [
      {
        id: planKey,
        price: plan.price,
        quantity: 1,
        name: `Luevora CRM - Paket ${plan.name} (1 Bulan)`
      }
    ]
  };

  const transaction = await snap.createTransaction(parameter);
  return transaction.token;
};

/**
 * Handle Webhook dari Midtrans
 */
export const handleMidtransNotification = async (notification) => {
  const statusResponse = await snap.transaction.notification(notification);
  
  const orderId = statusResponse.order_id;
  const transactionStatus = statusResponse.transaction_status;
  const fraudStatus = statusResponse.fraud_status;
  const paymentType = statusResponse.payment_type;

  const payment = await prisma.subscriptionPayment.findUnique({
    where: { order_id: orderId }
  });

  if (!payment) {
    console.log(`[Midtrans Webhook] Order ID ${orderId} tidak ditemukan.`);
    return;
  }

  let finalStatus = payment.transaction_status;

  if (transactionStatus === 'capture') {
    if (fraudStatus === 'challenge') {
      finalStatus = 'challenge';
    } else if (fraudStatus === 'accept') {
      finalStatus = 'success';
    }
  } else if (transactionStatus === 'settlement') {
    finalStatus = 'success';
  } else if (['cancel', 'deny', 'expire'].includes(transactionStatus)) {
    finalStatus = transactionStatus;
  } else if (transactionStatus === 'pending') {
    finalStatus = 'pending';
  }

  // Update payment status
  await prisma.subscriptionPayment.update({
    where: { order_id: orderId },
    data: { 
      transaction_status: finalStatus,
      payment_type: paymentType,
      paid_at: finalStatus === 'success' ? new Date() : null
    }
  });

  // Jika sukses, perbarui masa aktif Tenant (+30 hari) dan update kredit AI
  if (finalStatus === 'success' && payment.transaction_status !== 'success') {
    const tenant = await prisma.tenant.findUnique({ where: { id: payment.tenant_id } });
    
    // Tentukan waktu berlaku: jika sudah ada dan masih aktif, tambah 30 hari dari batas itu. Jika tidak, tambah dari sekarang.
    let currentExpiry = tenant.subscription_expires_at || new Date();
    if (currentExpiry < new Date()) currentExpiry = new Date(); // Kalau sudah kedaluwarsa, mulai dari sekarang

    const newExpiry = new Date(currentExpiry.getTime() + (30 * 24 * 60 * 60 * 1000));

    await prisma.tenant.update({
      where: { id: payment.tenant_id },
      data: {
        subscription_plan: payment.plan_name,
        subscription_status: 'active',
        subscription_expires_at: newExpiry
      }
    });

    // ── Update kredit AI sesuai paket yang dibeli ──
    const newCreditLimit = PLAN_CREDITS[payment.plan_name] ?? PLAN_CREDITS.free;
    await prisma.tenantAiCredit.upsert({
      where: { tenant_id: payment.tenant_id },
      create: {
        tenant_id: payment.tenant_id,
        credits_used: 0,
        credit_limit: newCreditLimit,
        rate_dollar_per_credit: 0.00056,
        is_active: 1,
      },
      update: {
        credit_limit: newCreditLimit,
        updated_at: new Date(),
      }
    });

    console.log(`[Subscription] Tenant ${tenant.id} sukses perpanjang paket ${payment.plan_name} sampai ${newExpiry}`);
    console.log(`[Subscription] Kredit AI diperbarui: ${newCreditLimit} kredit untuk paket ${payment.plan_name}`);
  }
};

/**
 * Cron Job: Expire subscriptions that have passed their expiry date.
 * 
 * Runs every hour. For each tenant whose subscription_expires_at < now AND
 * subscription_status is still 'active':
 *   1. Set subscription_status → 'expired', subscription_plan → 'free'
 *   2. Reset credit_limit → 700 (free tier)
 * 
 * Does NOT reset credits_used — only the limit is lowered.
 */
export const expireSubscriptions = async () => {
  const now = new Date();

  // Find all tenants that have expired but haven't been marked yet
  const expiredTenants = await prisma.tenant.findMany({
    where: {
      subscription_status: 'active',
      subscription_expires_at: { lt: now },
      subscription_plan: { not: 'free' },
    },
    select: { id: true, business_name: true, subscription_plan: true, subscription_expires_at: true },
  });

  if (expiredTenants.length === 0) return;

  console.log(`[SubscriptionCron] Found ${expiredTenants.length} expired tenant(s) to process.`);

  for (const tenant of expiredTenants) {
    try {
      // 1. Mark tenant as expired
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          subscription_plan: 'free',
          subscription_status: 'expired',
        },
      });

      // 2. Lower credit limit back to free tier (700)
      //    We use upsert in case they somehow don't have a credit record yet.
      await prisma.tenantAiCredit.upsert({
        where: { tenant_id: tenant.id },
        create: {
          tenant_id: tenant.id,
          credits_used: 0,
          credit_limit: PLAN_CREDITS.free,
          rate_dollar_per_credit: 0.00056,
          is_active: 1,
        },
        update: {
          credit_limit: PLAN_CREDITS.free,
          updated_at: new Date(),
        },
      });

      console.log(
        `[SubscriptionCron] Tenant ${tenant.id} (${tenant.business_name}) expired. ` +
        `Plan: ${tenant.subscription_plan} → free. Credit limit → ${PLAN_CREDITS.free}.`
      );
    } catch (err) {
      console.error(`[SubscriptionCron] Failed to expire tenant ${tenant.id}:`, err.message);
    }
  }

  console.log(`[SubscriptionCron] Done processing ${expiredTenants.length} tenant(s).`);
};
