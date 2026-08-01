import express from 'express';
import {
  handleGetCreditStatus,
  handleSyncUsage,
  handleResetCredits,
  handleUpdateLimit,
} from '../controllers/credit.controller.js';

const router = express.Router();

// GET /api/ai-credits/status — Get current credit status for tenant
router.get('/status', handleGetCreditStatus);

// POST /api/ai-credits/sync — Sync usage from EdenAI
router.post('/sync', handleSyncUsage);

// POST /api/ai-credits/reset — Reset credits (admin)
router.post('/reset', handleResetCredits);

// PUT /api/ai-credits/limit — Update credit limit (admin)
router.put('/limit', handleUpdateLimit);

export default router;
