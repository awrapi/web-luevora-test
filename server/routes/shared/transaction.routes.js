import express from 'express';
import { getTransactions, updateStatus } from '../../services/shared/transaction.service.js';
import prisma from '../../config/database.js';
import { sendText } from '../../services/shared/messaging.service.js';

const router = express.Router();

// GET /api/transactions
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const transactions = await getTransactions(tenantId, req.query);
    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('[Transactions API] Error fetching transactions:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil transaksi' });
  }
});

// GET /api/transactions/:id
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;
    const transaction = await prisma.transaction.findFirst({
      where: { id: parseInt(id), tenant_id: tenantId },
      include: { refund_requests: true, customer_requests: true }
    });
    if (!transaction) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: transaction });
  } catch (error) {
    console.error('[Transactions API] Error fetching transaction:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil transaksi' });
  }
});

// POST /api/transactions/:id/follow-up
router.post('/:id/follow-up', async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;
    const trx = await prisma.transaction.findFirst({ where: { id: parseInt(id), tenant_id: tenantId } });
    
    if (!trx) return res.status(404).json({ success: false, message: 'Not found' });
    if (trx.status !== 'sign') return res.status(400).json({ success: false, message: 'Status must be sign' });

    const msg = `Halo Kak ${trx.customer_name || ''}! Mengingatkan kembali untuk tagihan invoice ${trx.order_id} masih menunggu pembayaran ya Kak 😊`;
    await sendText(prisma, trx.phone, msg, { tenantId });

    await updateStatus(tenantId, id, '2nd_pending', { followed_up_at: new Date() });
    res.json({ success: true, message: 'Follow up sent' });
  } catch (error) {
    console.error('[Transactions API] Error follow-up:', error);
    res.status(500).json({ success: false, message: 'Gagal mengirim follow up' });
  }
});

// POST /api/transactions/:id/approve
router.post('/:id/approve', async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;
    const { payment_type } = req.body; // 'dp' or 'full'
    
    const trx = await prisma.transaction.findFirst({ where: { id: parseInt(id), tenant_id: tenantId } });
    if (!trx) return res.status(404).json({ success: false, message: 'Not found' });

    const newStatus = payment_type === 'dp' ? 'paid_dp' : 'paid_full';
    await updateStatus(tenantId, id, newStatus, { paid_at: new Date() });
    res.json({ success: true, message: `Payment approved as ${payment_type}` });
  } catch (error) {
    console.error('[Transactions API] Error approve:', error);
    res.status(500).json({ success: false, message: 'Gagal approve' });
  }
});

export default router;
