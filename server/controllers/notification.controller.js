import prisma from '../config/database.js';
import { globalDbEmitter } from '../config/database.js';

export const streamNotifications = (req, res) => {
  const tenantId = req.tenant.id;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Kirim event ping awal untuk mengkonfirmasi koneksi
  res.write(`data: connected\n\n`);

  const listener = (eventData) => {
    // Hanya teruskan jika event ini milik tenant yang sedang terkoneksi
    if (eventData.tenant_id === tenantId) {
      res.write(`data: NEW_DATA\n\n`);
    }
  };

  globalDbEmitter.on('db_change', listener);

  req.on('close', () => {
    globalDbEmitter.removeListener('db_change', listener);
  });
};

export const getNotifications = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Fetch from all sources in parallel
    const [transactions, requests, statuses, offers] = await Promise.all([
      prisma.transaction.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
        take: skip + limit,
      }),
      prisma.customerRequest.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
        take: skip + limit,
      }),
      prisma.statusInformation.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
        take: skip + limit,
      }),
      prisma.offer.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
        take: skip + limit,
      })
    ]);

    // Format transactions
    const mappedTransactions = transactions.map(t => ({
      id: `trx-${t.id}`,
      type: 'transaction',
      title: `Transaksi Baru: ${t.customer_name || t.user_phone}`,
      message: `Pesanan baru untuk ${t.destination || 'Paket'} (${t.pax_count} pax)`,
      phone: t.user_phone,
      customer_name: t.customer_name,
      created_at: t.created_at,
      status: t.status,
      link: '/transactions'
    }));

    // Format customer requests
    const mappedRequests = requests.map(r => ({
      id: `req-${r.id}`,
      type: 'request',
      title: `Permintaan Pelanggan: ${r.customer_name || r.phone}`,
      message: r.request_detail,
      phone: r.phone,
      customer_name: r.customer_name,
      created_at: r.created_at,
      status: r.status,
      link: '/customer-requests'
    }));

    // Format status info
    const mappedStatuses = statuses.map(s => ({
      id: `stat-${s.id}`,
      type: 'info',
      title: `Pembaruan Info: ${s.customer_name || s.phone}`,
      message: s.detail,
      phone: s.phone,
      customer_name: s.customer_name,
      created_at: s.created_at,
      status: 'info',
      link: '/central-info' // Assuming status information is part of central info
    }));

    // Format offers
    const mappedOffers = offers.map(o => ({
      id: `off-${o.id}`,
      type: 'offer',
      title: `Penawaran: ${o.customer_name || o.phone}`,
      message: `Penawaran untuk paket ${o.package_name}`,
      phone: o.phone,
      customer_name: o.customer_name,
      created_at: o.created_at,
      status: o.status,
      link: '/offers'
    }));

    // Merge and sort
    const allNotifications = [
      ...mappedTransactions,
      ...mappedRequests,
      ...mappedStatuses,
      ...mappedOffers
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Calculate pagination on the merged array
    // Since we took (skip + limit) from each, we have enough data to paginate correctly for this page
    const paginatedNotifications = allNotifications.slice(skip, skip + limit);

    // Get total counts for accurate pagination metadata
    const [countTrx, countReq, countStat, countOff] = await Promise.all([
      prisma.transaction.count({ where: { tenant_id: tenantId } }),
      prisma.customerRequest.count({ where: { tenant_id: tenantId } }),
      prisma.statusInformation.count({ where: { tenant_id: tenantId } }),
      prisma.offer.count({ where: { tenant_id: tenantId } })
    ]);
    
    const totalItems = countTrx + countReq + countStat + countOff;
    const totalPages = Math.ceil(totalItems / limit);

    res.json({
      success: true,
      data: paginatedNotifications,
      meta: {
        current_page: page,
        total_pages: totalPages,
        total_items: totalItems,
        limit
      }
    });
  } catch (error) {
    console.error('[Notification Controller] Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
