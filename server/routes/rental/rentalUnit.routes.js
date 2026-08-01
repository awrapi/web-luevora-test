/**
 * Rental Unit Routes — Unit Management & Availability
 * Ported from: api_rental_request.php (unit sections)
 */
import express from 'express';
import RentalUnitService from '../../services/rental/rentalUnit.service.js';

const router = express.Router();

// GET /api/rental/unit — Fetch all units
router.get('/', async (req, res) => {
  try {
    const units = await RentalUnitService.fetchAllUnits(req.db);
    res.json({ status: true, units });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

// GET /api/rental/unit/available
router.get('/available', async (req, res) => {
  try {
    const { start_date, end_date, unit_type } = req.query;
    const units = await RentalUnitService.fetchAvailableUnits(req.db, {
      startDate: start_date, endDate: end_date, unitType: unit_type,
    });
    res.json({ status: true, units });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

// GET /api/rental/unit/active-rentals
router.get('/active-rentals', async (req, res) => {
  try {
    const rentals = await RentalUnitService.fetchActiveRentals(req.db);
    res.json({ status: true, rentals });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

// GET /api/rental/unit/stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await RentalUnitService.fetchStats(req.db);
    res.json({ status: true, stats });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

// GET /api/rental/unit/check-availability
router.get('/check-availability', async (req, res) => {
  try {
    const { unit_id, start_date, end_date } = req.query;
    const available = await RentalUnitService.checkAvailability(req.db, parseInt(unit_id), start_date, end_date);
    res.json({ status: true, available });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

// GET /api/rental/unit/calculate-price
router.get('/calculate-price', async (req, res) => {
  try {
    const { unit_id, duration_days } = req.query;
    const price = await RentalUnitService.calculatePrice(req.db, parseInt(unit_id), parseInt(duration_days));
    res.json({ status: true, price });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

// POST /api/rental/unit
router.post('/', async (req, res) => {
  try {
    const result = await RentalUnitService.addUnit(req.db, req.body);
    res.json({ status: true, ...result });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

// PUT /api/rental/unit/:id
router.put('/:id', async (req, res) => {
  try {
    const result = await RentalUnitService.updateUnit(req.db, parseInt(req.params.id), req.body);
    res.json({ status: true, ...result });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

// PATCH /api/rental/unit/:id/status
router.patch('/:id/status', async (req, res) => {
  try {
    const result = await RentalUnitService.updateUnitStatus(req.db, parseInt(req.params.id), req.body.status);
    res.json({ status: true, ...result });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

// DELETE /api/rental/unit/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await RentalUnitService.deleteUnit(req.db, parseInt(req.params.id));
    res.json({ status: true, ...result });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

// POST /api/rental/unit/return
router.post('/return', async (req, res) => {
  try {
    const { rental_id, condition } = req.body;
    const result = await RentalUnitService.returnUnit(req.db, parseInt(rental_id), condition || '');
    res.json({ status: true, ...result });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

export default router;
