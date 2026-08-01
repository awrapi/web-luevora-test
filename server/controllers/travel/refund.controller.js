import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const refundController = {
  getRefunds: async (req, res) => {
    try {
      const tenantId = req.tenant.id;
      const refunds = await prisma.refundRequest.findMany({
        where: { tenant_id: tenantId },
        include: {
          transaction: {
            select: { order_id: true, total_price: true, destination: true }
          }
        },
        orderBy: { created_at: 'desc' }
      });
      res.json({ success: true, data: refunds });
    } catch (error) {
      console.error('[RefundController] Error fetching refunds:', error);
      res.status(500).json({ success: false, message: 'Gagal mengambil data refund' });
    }
  },

  updateRefund: async (req, res) => {
    try {
      const tenantId = req.tenant.id;
      const { id } = req.params;
      const { status, admin_note } = req.body;

      const refund = await prisma.refundRequest.update({
        where: { id: parseInt(id), tenant_id: tenantId },
        data: { status, admin_note }
      });

      // Jika disetujui atau ditolak, Anda mungkin mau mengubah status transaksi juga, 
      // tapi untuk saat ini kita cukup update status refundnya.
      if (status === 'approved' || status === 'rejected') {
         await prisma.transaction.update({
            where: { id: refund.transaction_id },
            data: { status: 'cancelled', admin_note: `Refund: ${status}` }
         });
      }

      res.json({ success: true, data: refund });
    } catch (error) {
      console.error('[RefundController] Error updating refund:', error);
      res.status(500).json({ success: false, message: 'Gagal mengubah status refund' });
    }
  }
};
