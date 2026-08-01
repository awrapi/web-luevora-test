import DashboardService from '../../services/shared/dashboard.service.js';

export const getStats = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    const { period } = req.query; // 'Hari ini', 'Minggu ini', 'Bulan ini', 'Tahun ini', 'Semua waktu'
    
    if (!tenantId) {
      return res.status(400).json({ status: false, message: 'Tenant ID required.' });
    }

    const data = await DashboardService.getDashboardStats(tenantId, period);
    return res.json({ status: true, data });
  } catch (error) {
    console.error('[Dashboard Controller] Error fetching stats:', error);
    return res.status(500).json({ status: false, message: 'Failed to fetch dashboard stats.', error: error.message });
  }
};

export default { getStats };
