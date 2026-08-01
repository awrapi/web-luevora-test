import express from 'express';
import { orderFormConfigService } from '../../services/travel/orderFormConfig.service.js';
import { orderFormService } from '../../services/ai_agent/orderForm.service.js';

const router = express.Router();

// Form Config CRUD
router.get('/config', async (req, res) => {
  try {
    const data = await orderFormConfigService.getAll(req.tenant.id, req.query);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/config', async (req, res) => {
  try {
    const data = await orderFormConfigService.create(req.tenant.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/config/:id', async (req, res) => {
  try {
    const data = await orderFormConfigService.update(req.tenant.id, parseInt(req.params.id), req.body);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/config/:id', async (req, res) => {
  try {
    await orderFormConfigService.remove(req.tenant.id, parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/config/reorder', async (req, res) => {
  try {
    await orderFormConfigService.reorder(req.tenant.id, req.body.items);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/config/sync', async (req, res) => {
  try {
    const { package_id, package_type, fields } = req.body;
    await orderFormConfigService.sync(req.tenant.id, package_id, package_type, fields);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Order Forms (for dashboard)
router.get('/forms', async (req, res) => {
  try {
    const data = await orderFormService.getAllForms(req.tenant.id, req.query.status || null);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/forms/pending', async (req, res) => {
  try {
    const data = await orderFormService.getAllForms(req.tenant.id, 'awaiting_admin');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/forms/:id/approve', async (req, res) => {
  try {
    const result = await orderFormService.approveManualForm(req.tenant.id, parseInt(req.params.id));
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/forms/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await orderFormService.rejectManualForm(req.tenant.id, parseInt(req.params.id), reason);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
