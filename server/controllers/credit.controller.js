/**
 * ================================================================
 * AI Credit Controller
 * ================================================================
 * Endpoints for managing and viewing AI credit usage per tenant.
 * ================================================================
 */

import {
  getCreditStatus,
  syncEdenAiUsage,
  resetCredits,
  updateCreditLimit,
} from '../services/ai_agent/credit.service.js';

/**
 * GET /api/ai-credits/status
 * Returns full credit status for the current tenant.
 */
export const handleGetCreditStatus = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID required' });
    }

    const status = await getCreditStatus(tenantId);
    return res.json({ success: true, data: status });
  } catch (err) {
    console.error('[CreditController] getStatus error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/ai-credits/sync
 * Syncs usage data from EdenAI cost monitoring API.
 */
export const handleSyncUsage = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID required' });
    }

    const result = await syncEdenAiUsage(tenantId);
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[CreditController] syncUsage error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/ai-credits/reset
 * Resets credits for the tenant (admin action).
 * Body: { new_limit?: number }
 */
export const handleResetCredits = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID required' });
    }

    const { new_limit } = req.body || {};
    const result = await resetCredits(tenantId, new_limit || null);
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[CreditController] resetCredits error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/ai-credits/limit
 * Updates credit limit for the tenant (admin action).
 * Body: { credit_limit: number }
 */
export const handleUpdateLimit = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID required' });
    }

    const { credit_limit } = req.body;
    if (!credit_limit || typeof credit_limit !== 'number') {
      return res.status(400).json({ success: false, message: 'credit_limit (number) is required' });
    }

    const result = await updateCreditLimit(tenantId, credit_limit);
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[CreditController] updateLimit error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
