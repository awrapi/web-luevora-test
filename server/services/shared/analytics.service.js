/**
 * ================================================================
 * Analytics Service — Dashboard Analytics & Reporting
 * ================================================================
 * Ported from: api_admin.php (sections 9, 9B)
 * 
 * Provides time-series data for dashboard charts:
 * total users, serious/casual/repeat, closing, new leads.
 * ================================================================
 */

/**
 * Fetch analytics data with time-series chart data.
 * 
 * @param {import('@prisma/client').PrismaClient} db
 * @param {object} params
 */
export const fetchAnalytics = async (db, { period = '7d', startDate = null, endDate = null } = {}) => {
  console.log(`[Analytics] Fetching — period=${period}, range=${startDate}→${endDate}`);

  // Calculate date range
  let start, end, numDays;

  if (startDate && endDate) {
    start = startDate;
    end = endDate;
    numDays = Math.max(1, Math.ceil((new Date(end) - new Date(start)) / 86400000) + 1);
  } else {
    const periodDays = { '7d': 7, '30d': 30, '1y': 365 };
    numDays = periodDays[period] || 7;
    end = new Date().toISOString().split('T')[0];
    const sDate = new Date();
    sDate.setDate(sDate.getDate() - (numDays - 1));
    start = sDate.toISOString().split('T')[0];
  }

  // Determine grouping mode
  let groupMode;
  if (numDays <= 31) groupMode = 'daily';
  else if (numDays <= 180) groupMode = 'weekly';
  else groupMode = 'monthly';

  // Generate labels
  const labels = [];
  const labelsFormatted = [];

  if (groupMode === 'daily') {
    for (let i = 0; i < numDays; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      labels.push(dateStr);
      labelsFormatted.push(d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }));
    }
  } else if (groupMode === 'weekly') {
    let cur = new Date(start);
    const endD = new Date(end);
    const dow = cur.getDay() || 7;
    cur.setDate(cur.getDate() - (dow - 1));
    while (cur <= endD) {
      const wStart = cur.toISOString().split('T')[0];
      const wEnd = new Date(cur);
      wEnd.setDate(wEnd.getDate() + 6);
      labels.push(`${wStart}|${wEnd.toISOString().split('T')[0]}`);
      labelsFormatted.push(cur.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }));
      cur.setDate(cur.getDate() + 7);
    }
  } else {
    const startD = new Date(start);
    const endD = new Date(end);
    let curM = startD.getMonth();
    let curY = startD.getFullYear();
    const endM = endD.getMonth();
    const endY = endD.getFullYear();
    while (curY < endY || (curY === endY && curM <= endM)) {
      const ym = `${curY}-${String(curM + 1).padStart(2, '0')}`;
      labels.push(ym);
      labelsFormatted.push(new Date(curY, curM).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }));
      curM++;
      if (curM > 11) { curM = 0; curY++; }
    }
  }

  const totalBuckets = labels.length;
  const chartData = {
    labels: labelsFormatted,
    total: new Array(totalBuckets).fill(0),
    serious: new Array(totalBuckets).fill(0),
    casual: new Array(totalBuckets).fill(0),
    closing: new Array(totalBuckets).fill(0),
    repeat: new Array(totalBuckets).fill(0),
    new_leads: new Array(totalBuckets).fill(0),
  };

  // We have to use raw query here because of complex NOT EXISTS condition
  const stats = await db.$queryRaw`
    SELECT COUNT(*) as total_users,
      SUM(CASE WHEN cs.category='serious' THEN 1 ELSE 0 END) as serious,
      SUM(CASE WHEN cs.category='casual' THEN 1 ELSE 0 END) as casual,
      SUM(CASE WHEN cs.category='repeat' THEN 1 ELSE 0 END) as repeat_cust
    FROM customer_stats cs
    WHERE NOT EXISTS (
      SELECT 1 FROM leads l WHERE l.phone = cs.user_phone AND l.label = 'customer'
    )
  `;

  const totalUsers = Number(stats[0]?.total_users || 0);
  const seriousChats = Number(stats[0]?.serious || 0);
  const casualChats = Number(stats[0]?.casual || 0);
  const repeatOrders = Number(stats[0]?.repeat_cust || 0);

  const closingRows = await db.$queryRaw`
    SELECT COUNT(*) as cnt FROM transactions t
    WHERE t.status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM leads l WHERE l.phone = t.user_phone AND l.label = 'customer'
      )
  `;
  const totalClosing = Number(closingRows[0]?.cnt || 0);

  const newUsersInPeriod = await db.lead.count({
    where: {
      created_at: {
        gte: new Date(start),
        lt: new Date(new Date(end).getTime() + 86400000) // end + 1 day
      },
      OR: [
        { label: null },
        { label: { not: 'customer' } }
      ]
    }
  });

  return {
    period,
    start_date: start,
    end_date: end,
    group_mode: groupMode,
    total_users: totalUsers,
    total_closing: totalClosing,
    serious_chats: seriousChats,
    casual_chats: casualChats,
    repeat_orders: repeatOrders,
    new_users: newUsersInPeriod,
    chart_data: chartData,
  };
};

/**
 * Fetch product-level analytics.
 */
export const fetchProductAnalytics = async (db, { period = '30d', startDate = null, endDate = null } = {}) => {
  console.log(`[Analytics] Fetching product analytics — period=${period}`);

  let start, end;
  if (startDate && endDate) {
    start = startDate;
    end = endDate;
  } else {
    const days = { '7d': 7, '30d': 30, '1y': 365 }[period] || 30;
    end = new Date().toISOString().split('T')[0];
    const s = new Date();
    s.setDate(s.getDate() - (days - 1));
    start = s.toISOString().split('T')[0];
  }

  const products = await db.knowledgeBase.findMany({
    where: { type: 'product' },
    orderBy: { id: 'asc' }
  });

  const productStats = [];
  for (const p of products) {
    const sales = await db.transaction.count({
      where: {
        status: 'approved',
        destination: { contains: p.title || '' },
        created_at: {
          gte: new Date(start),
          lt: new Date(new Date(end).getTime() + 86400000)
        }
      }
    });

    const mentions = await db.chatHistory.count({
      where: {
        role: 'user',
        message: { contains: p.title || '' }
      }
    });

    productStats.push({
      id: p.id,
      title: p.title,
      stock: p.stock,
      slot_unlimited: p.slot_unlimited,
      sales,
      mentions,
    });
  }

  return { products: productStats, start_date: start, end_date: end };
};

export default { fetchAnalytics, fetchProductAnalytics };
