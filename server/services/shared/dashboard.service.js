import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Generate time slots for chart data based on the selected period.
 * - "Hari ini"     → hourly slots for today
 * - "Minggu ini"   → daily slots for this week (Mon–Sun)
 * - "Bulan ini"    → daily slots for this month
 * - "Tahun ini"    → monthly slots for this year
 * - "Semua waktu"  → monthly slots for the last 12 months
 */
function generateTimeSlots(period) {
  const slots = [];
  const now = new Date();

  if (period === 'Hari ini') {
    // Hourly slots for today (00:00 → current hour)
    const currentHour = now.getHours();
    for (let h = 0; h <= currentHour; h++) {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 59, 59, 999);
      slots.push({
        start,
        end,
        label: `${String(h).padStart(2, '0')}:00`
      });
    }
    // Ensure at least 1 slot
    if (slots.length === 0) {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      slots.push({ start, end, label: '00:00' });
    }

  } else if (period === 'Minggu ini') {
    // Daily slots for this week (Monday → today)
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    const day = startOfWeek.getDay() || 7; // Sunday = 7
    startOfWeek.setDate(startOfWeek.getDate() - (day - 1)); // Go to Monday

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      if (d > now) break; // Don't include future days
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      slots.push({
        start,
        end,
        label: d.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit' })
      });
    }

  } else if (period === 'Bulan ini') {
    // Daily slots for this month (1st → today)
    const currentDay = now.getDate();
    for (let d = 1; d <= currentDay; d++) {
      const start = new Date(now.getFullYear(), now.getMonth(), d, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), d, 23, 59, 59, 999);
      slots.push({
        start,
        end,
        label: start.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
      });
    }

  } else if (period === 'Tahun ini') {
    // Monthly slots for this year (Jan → current month)
    const currentMonth = now.getMonth();
    for (let m = 0; m <= currentMonth; m++) {
      const start = new Date(now.getFullYear(), m, 1, 0, 0, 0, 0);
      const lastDay = new Date(now.getFullYear(), m + 1, 0).getDate();
      const end = new Date(now.getFullYear(), m, lastDay, 23, 59, 59, 999);
      slots.push({
        start,
        end,
        label: start.toLocaleDateString('id-ID', { month: 'short' })
      });
    }

  } else {
    // "Semua waktu" → monthly slots for the last 12 months
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0, 0, 0);
      const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
      const end = new Date(start.getFullYear(), start.getMonth(), lastDay, 23, 59, 59, 999);
      slots.push({
        start,
        end,
        label: start.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
      });
    }
  }

  return slots;
}

export const getDashboardStats = async (tenant_id, period = 'Hari ini') => {
  // Determine date range based on period
  let startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  let endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  if (period === 'Minggu ini') {
    const day = startDate.getDay() || 7; 
    if (day !== 1) startDate.setHours(-24 * (day - 1)); 
  } else if (period === 'Bulan ini') {
    startDate.setDate(1);
  } else if (period === 'Tahun ini') {
    startDate.setMonth(0, 1);
  } else if (period === 'Semua waktu') {
    startDate = new Date(0); // Epoch
  }

  const dateFilter = {
    gte: startDate,
    lte: endDate,
  };

  // 1. Original Stats + New KPI Cards
  const allTransactions = await prisma.transaction.findMany({
    where: { tenant_id, created_at: dateFilter },
    select: { status: true, total_price: true, user_phone: true }
  });

  const totalTransaksi = allTransactions.length;
  const menungguBayar = allTransactions.filter(t => ['pending', 'sign', '2nd_pending', 'second_pending'].includes(t.status)).length;
  
  const totalRevenue = allTransactions
    .filter(t => ['paid', 'completed', 'done', 'approved', 'paid_dp', 'paid_full'].includes(t.status))
    .reduce((sum, t) => sum + Number(t.total_price || 0), 0);

  const activeLeads = await prisma.lead.count({
    where: { tenant_id, status: { in: ['baru', 'follow_up', 'closing', 'menunggu_pembayaran'] } }
  });

  const allLeads = await prisma.lead.findMany({
    where: { tenant_id, created_at: dateFilter },
    select: { ghost_status: true, status: true }
  });
  const totalLeads = allLeads.length;
  const leadsGhosting = allLeads.filter(l => l.ghost_status === 'at_risk' || l.ghost_status === 'ghosted').length;
  
  const pelangganSerius = await prisma.customerManagement.count({
    where: { tenant_id, status: { in: ['waiting_offer', 'waiting_payment', 'waiting_date'] } }
  }).catch(() => 0); // Ignore if table doesn't exist



  // AI Closing Rate: closed transactions without manual intervention vs total closed
  const closedTransactions = allTransactions.filter(t => ['paid', 'completed', 'done', 'approved', 'paid_dp', 'paid_full'].includes(t.status));

  let aiClosedCount = 0;
  for (const t of closedTransactions) {
    const lead = await prisma.lead.findFirst({
      where: { tenant_id, phone: t.user_phone },
      select: { is_manual: true }
    });
    // If the lead was never manual, AI closed it
    if (lead && lead.is_manual === 0) {
      aiClosedCount++;
    }
  }
  const aiClosingRate = closedTransactions.length > 0 
    ? Math.round((aiClosedCount / closedTransactions.length) * 100) 
    : 0;

  // AI Cost Efficiency (Total AI Cost / Total Closed Transactions)
  const aiCostAgg = await prisma.aiCreditUsageLog.aggregate({
    _sum: { cost_usd: true },
    where: { tenant_id, created_at: dateFilter }
  }).catch(() => ({ _sum: { cost_usd: 0 } }));
  const totalAiCost = aiCostAgg._sum.cost_usd || 0;
  
  // Format as IDR (approx 15000 per USD)
  const aiCostEfficiency = closedTransactions.length > 0
    ? (totalAiCost * 15000) / closedTransactions.length
    : 0;

  // 2. Sales Funnel Data (All time active + closed in period)
  const leadsBaru = await prisma.lead.count({ where: { tenant_id, status: 'baru' } });
  const leadsFollowUp = await prisma.lead.count({ where: { tenant_id, status: { in: ['follow_up', 'potensial'] } } });
  const leadsClosing = await prisma.lead.count({ where: { tenant_id, status: 'menunggu_pembayaran' } });
  const leadsClosed = closedTransactions.length;

  const funnelData = [
    { stage: 'Leads Baru', count: leadsBaru },
    { stage: 'Prospek', count: leadsFollowUp },
    { stage: 'Menunggu Bayar', count: leadsClosing },
    { stage: 'Closing', count: leadsClosed }
  ];

  // 3. Generate time slots based on period for chart data
  const timeSlots = generateTimeSlots(period);
  const trendData = [];

  for (const slot of timeSlots) {
    const slotFilter = { gte: slot.start, lte: slot.end };

    const revAgg = await prisma.transaction.aggregate({
      _sum: { total_price: true },
      where: {
        tenant_id,
        status: { in: ['paid', 'completed', 'done', 'approved'] },
        created_at: slotFilter
      }
    });

    const msgCount = await prisma.chatHistory.count({
      where: {
        tenant_id,
        created_at: slotFilter
      }
    });

    trendData.push({
      date: slot.label,
      revenue: Number(revAgg._sum.total_price || 0),
      messages: msgCount
    });
  }

  // 4. Action Center Alerts
  const pendingRequests = await prisma.centralInfoRequest.count({
    where: { tenant_id, status: 'pending' }
  }).catch(() => 0);
  const pendingTodos = await prisma.systemGuiderTodo.count({
    where: { tenant_id, status: 'pending' }
  }).catch(() => 0);
  const ghostingLeads = await prisma.lead.count({
    where: { tenant_id, ghost_status: 'at_risk' }
  });

  const actionCenter = [
    { label: 'AI Butuh Bantuan', count: pendingRequests + pendingTodos, type: 'critical' },
    { label: 'Leads Terancam Ghosting', count: ghostingLeads, type: 'warning' }
  ];

  // 4b. Leads & Repeat Order Trend + 4c. Comprehensive Lead Trends
  const leadsRepeatTrend = [];
  const leadTrends = [];

  for (const slot of timeSlots) {
    const slotFilter = { gte: slot.start, lte: slot.end };

    const leadsCount = await prisma.lead.count({
      where: {
        tenant_id,
        created_at: slotFilter
      }
    });

    const repeatCount = await prisma.customerStat.count({
      where: {
        tenant_id,
        category: 'repeat',
        created_at: slotFilter
      }
    }).catch(() => 0);

    const ghostingCount = await prisma.lead.count({
      where: {
        tenant_id,
        created_at: slotFilter,
        ghost_status: { in: ['at_risk', 'ghosted'] }
      }
    });

    const cancelCount = await prisma.lead.count({
      where: {
        tenant_id,
        created_at: slotFilter,
        status: { in: ['batal', 'cancelled'] }
      }
    });

    leadsRepeatTrend.push({
      date: slot.label,
      leads: leadsCount,
      repeatOrders: repeatCount
    });

    leadTrends.push({
      date: slot.label,
      incoming: leadsCount,
      ghosting: ghostingCount,
      cancelOrder: cancelCount,
      repeatOrder: repeatCount
    });
  }

  // 5. Top Products/Services (Global calculation based on transaction destination/package_name)
  // Fetching all paid transactions in period to group them manually (Prisma groupBy on nullable fields can be tricky)
  const allPaid = await prisma.transaction.findMany({
    where: {
      tenant_id,
      status: { in: ['paid', 'completed', 'done', 'approved'] },
      created_at: dateFilter
    },
    select: { destination: true, total_price: true }
  });

  const productMap = {};
  for (const t of allPaid) {
    const name = t.destination || 'Layanan Lainnya';
    if (!productMap[name]) productMap[name] = 0;
    productMap[name] += Number(t.total_price || 0);
  }

  const topProducts = Object.keys(productMap)
    .map(name => ({ name, revenue: productMap[name] }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return {
    kpis: {
      totalLeads,
      leadsGhosting,
      pelangganSerius,
      totalTransaksi,
      menungguBayar,
      totalRevenue: Number(totalRevenue),
      aiClosingRate,
      aiCostEfficiency: Math.round(aiCostEfficiency)
    },
    funnelData,
    trendData,
    leadsRepeatTrend,
    leadTrends,
    actionCenter,
    topProducts
  };
};

export default { getDashboardStats };
