import express from 'express';
import { travelController } from '../../controllers/travel/travel.controller.js';

const router = express.Router();

// Dashboard & Analytics
router.get('/dashboard-summary', travelController.getDashboardSummary);
router.get('/performance', travelController.getPerformanceData);

// Packages
router.get('/packages', travelController.getAllPackages);
router.post('/packages', travelController.createPackage);
router.put('/packages/:id', travelController.updatePackage);
router.delete('/packages/:id', travelController.deletePackage);

// Bookings
router.get('/', travelController.getAllBookings);
router.get('/pending-approvals', travelController.getPendingApprovals);
router.post('/', travelController.createBooking);
router.put('/:id/status', travelController.updateBookingStatus);
router.post('/:id/approve-payment', travelController.approvePayment);
router.post('/:id/reject-payment', travelController.rejectPayment);

export default router;
