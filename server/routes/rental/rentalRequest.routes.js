/**
 * Rental Request Routes — Request Lifecycle Management
 * Ported from: api_rental_request.php
 */
import express from 'express';
import RentalRequestService from '../../services/rental/rentalRequest.service.js';

const router = express.Router();

// GET /api/rental/request — Fetch requests with counts
router.get('/', async (req, res) => {
  try {
    const result = await RentalRequestService.fetchRequests(req.db, req.query.status || 'all');
    res.json({ status: true, ...result });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

// POST /api/rental/request — Save request (from AI or form)
router.post('/', async (req, res) => {
  try {
    const result = await RentalRequestService.saveRequest(req.db, req.body);
    res.json({ status: true, ...result });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

// POST /api/rental/request/approve
router.post('/approve', async (req, res) => {
  try {
    const { request_id, unit_id, admin_note, send_followup, custom_price } = req.body;
    const result = await RentalRequestService.approveRequest(req.db, req.aiConfig || {}, {
      requestId: parseInt(request_id),
      unitId: parseInt(unit_id) || 0,
      adminNote: admin_note || '',
      sendFollowup: send_followup !== false,
      customPrice: parseInt(custom_price) || 0,
    });
    res.json({ status: true, ...result });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

// POST /api/rental/request/reject
router.post('/reject', async (req, res) => {
  try {
    const { request_id, reason, send_followup } = req.body;
    const result = await RentalRequestService.rejectRequest(req.db, req.aiConfig || {}, {
      requestId: parseInt(request_id),
      reason,
      sendFollowup: send_followup !== false,
    });
    res.json({ status: true, ...result });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

// POST /api/rental/request/activate
router.post('/activate', async (req, res) => {
  try {
    const { request_id, transaction_id } = req.body;
    const result = await RentalRequestService.activateRental(
      req.db, req.aiConfig || {},
      parseInt(request_id),
      parseInt(transaction_id) || 0,
    );
    res.json({ status: true, ...result });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

export default router;
