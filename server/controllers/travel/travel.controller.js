import { travelService } from '../../services/travel/travel.service.js';

export const travelController = {
  getDashboardSummary: async (req, res) => {
    try {
      const tenantId = req.tenant.id;
      const data = await travelService.getDashboardSummary(tenantId);
      
      return res.status(200).json({
        status: true,
        message: 'Dashboard summary retrieved successfully',
        data
      });
    } catch (error) {
      console.error('Error getDashboardSummary:', error);
      return res.status(500).json({
        status: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  getAllPackages: async (req, res) => {
    try {
      const tenantId = req.tenant.id;
      const data = await travelService.getAllPackages(tenantId);
      
      return res.status(200).json({
        status: true,
        data
      });
    } catch (error) {
      return res.status(500).json({ status: false, message: error.message });
    }
  },

  createPackage: async (req, res) => {
    try {
      const tenantId = req.tenant.id;
      const data = await travelService.createPackage(tenantId, req.body);
      
      return res.status(201).json({
        status: true,
        message: 'Package created successfully',
        data
      });
    } catch (error) {
      return res.status(500).json({ status: false, message: error.message });
    }
  },

  getAllBookings: async (req, res) => {
    try {
      const tenantId = req.tenant.id;
      const data = await travelService.getAllBookings(tenantId);
      
      return res.status(200).json({
        status: true,
        data
      });
    } catch (error) {
      return res.status(500).json({ status: false, message: error.message });
    }
  },

  createBooking: async (req, res) => {
    try {
      const tenantId = req.tenant.id;
      const data = await travelService.createBooking(tenantId, req.body);
      
      return res.status(201).json({
        status: true,
        message: 'Booking created successfully',
        data
      });
    } catch (error) {
      return res.status(500).json({ status: false, message: error.message });
    }
  },

  updateBookingStatus: async (req, res) => {
    try {
      const tenantId = req.tenant.id;
      const { id } = req.params;
      const { status, payment_status } = req.body;
      
      await travelService.updateBookingStatus(tenantId, id, status, payment_status);
      
      return res.status(200).json({
        status: true,
        message: 'Booking updated successfully'
      });
    } catch (error) {
      return res.status(500).json({ status: false, message: error.message });
    }
  },

  deletePackage: async (req, res) => {
    try {
      const tenantId = req.tenant.id;
      const { id } = req.params;
      
      await travelService.deletePackage(tenantId, parseInt(id));
      
      return res.status(200).json({
        status: true,
        message: 'Package deleted successfully'
      });
    } catch (error) {
      if (error.code === 'P2025') {
        // Record already doesn't exist, treat as success
        return res.status(200).json({
          status: true,
          message: 'Package already deleted'
        });
      }
      return res.status(500).json({ status: false, message: error.message });
    }
  },

  updatePackage: async (req, res) => {
    try {
      const tenantId = req.tenant.id;
      const { id } = req.params;
      
      const data = await travelService.updatePackage(tenantId, parseInt(id), req.body);
      
      return res.status(200).json({
        status: true,
        message: 'Package updated successfully',
        data
      });
    } catch (error) {
      return res.status(500).json({ status: false, message: error.message });
    }
  },

  getPendingApprovals: async (req, res) => {
    try {
      const tenantId = req.tenant.id;
      const data = await travelService.getPendingApprovals(tenantId);
      return res.status(200).json({ status: true, data });
    } catch (error) {
      return res.status(500).json({ status: false, message: error.message });
    }
  },

  approvePayment: async (req, res) => {
    try {
      const tenantId = req.tenant.id;
      const { id } = req.params;
      const data = await travelService.approvePayment(tenantId, id);
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ status: false, message: error.message });
    }
  },

  rejectPayment: async (req, res) => {
    try {
      const tenantId = req.tenant.id;
      const { id } = req.params;
      const { reason } = req.body;
      const data = await travelService.rejectPayment(tenantId, id, reason);
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ status: false, message: error.message });
    }
  },

  getPerformanceData: async (req, res) => {
    try {
      const tenantId = req.tenant.id;
      const { range, startDate, endDate } = req.query;
      const data = await travelService.getPerformanceData(tenantId, { range, startDate, endDate });
      return res.status(200).json({ status: true, data });
    } catch (error) {
      console.error('Error getting performance data:', error);
      return res.status(500).json({ status: false, message: error.message });
    }
  }
};
