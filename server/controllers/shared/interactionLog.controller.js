/**
 * ================================================================
 * Interaction Log Controller — HTTP Handlers
 * ================================================================
 * Thin HTTP layer over the InteractionLogService.
 */

import InteractionLogService from '../../services/shared/interactionLog.service.js';

export const getInteractionLogs = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { phone } = req.params;
    const { limit, type } = req.query;

    if (!phone) {
      return res.status(400).json({ status: false, message: 'Phone wajib diisi' });
    }

    const logs = await InteractionLogService.fetchInteractionLogs(tenantId, phone, {
      limit: limit ? parseInt(limit, 10) : 100,
      type: type || null
    });

    res.json({ status: true, data: logs });
  } catch (err) {
    next(err);
  }
};

export const createInteractionLog = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { phone } = req.params;

    if (!phone) {
      return res.status(400).json({ status: false, message: 'Phone wajib diisi' });
    }

    const log = await InteractionLogService.createInteractionLog(tenantId, phone, req.body || {});
    res.status(201).json({ status: true, data: log });
  } catch (err) {
    if (err.message?.includes('wajib diisi')) {
      return res.status(400).json({ status: false, message: err.message });
    }
    next(err);
  }
};

export const deleteInteractionLog = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { logId } = req.params;

    if (!logId) {
      return res.status(400).json({ status: false, message: 'Log ID wajib diisi' });
    }

    const result = await InteractionLogService.deleteInteractionLog(tenantId, parseInt(logId, 10));
    res.json({ status: true, ...result });
  } catch (err) {
    next(err);
  }
};

export default {
  getInteractionLogs,
  createInteractionLog,
  deleteInteractionLog
};
