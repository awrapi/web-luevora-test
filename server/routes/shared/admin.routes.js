/**
 * Admin Routes — Knowledge Base, Store Config, Analytics, Transactions
 * Ported from: api_admin.php (all sections)
 */
import express from 'express';
import AdminService from '../../services/shared/admin.service.js';
import AnalyticsService from '../../services/shared/analytics.service.js';

const router = express.Router();

// ==================== Knowledge Base ====================

// GET /api/admin/knowledge?type=product
router.get('/knowledge', async (req, res) => {
  try {
    const data = await AdminService.fetchKnowledge(req.db, req.query.type || null);
    res.json({ status: true, data });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

// POST /api/admin/knowledge
router.post('/knowledge', async (req, res) => {
  try {
    const result = await AdminService.saveKnowledge(req.db, req.body);
    res.json({ status: true, ...result });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

// PUT /api/admin/knowledge/:id
router.put('/knowledge/:id', async (req, res) => {
  try {
    const result = await AdminService.editKnowledge(req.db, parseInt(req.params.id), req.body);
    res.json({ status: true, ...result });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

// DELETE /api/admin/knowledge/:id
router.delete('/knowledge/:id', async (req, res) => {
  try {
    const result = await AdminService.deleteKnowledge(req.db, parseInt(req.params.id));
    res.json({ status: true, ...result });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

// ==================== Store Config ====================

// GET /api/admin/store-config
router.get('/store-config', async (req, res) => {
  try {
    const config = await AdminService.fetchStoreConfig(req.db);
    res.json({ status: true, config });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

// POST /api/admin/store-config
router.post('/store-config', async (req, res) => {
  try {
    const result = await AdminService.saveStoreConfig(req.db, req.body);
    res.json({ status: true, ...result });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});



// ==================== Analytics ====================

// GET /api/admin/analytics
router.get('/analytics', async (req, res) => {
  try {
    const { period, start_date, end_date } = req.query;
    const result = await AnalyticsService.fetchAnalytics(req.db, { period, startDate: start_date, endDate: end_date });
    res.json({ status: true, ...result });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

// GET /api/admin/product-analytics
router.get('/product-analytics', async (req, res) => {
  try {
    const { period, start_date, end_date } = req.query;
    const result = await AnalyticsService.fetchProductAnalytics(req.db, { period, startDate: start_date, endDate: end_date });
    res.json({ status: true, ...result });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

// ==================== WA Session ====================

// POST /api/admin/wa-session
router.post('/wa-session', async (req, res) => {
  try {
    const { act, session_id } = req.body;
    const result = await AdminService.manageWaSession(req.db, act, session_id);
    res.json({ status: true, ...result });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

export default router;
