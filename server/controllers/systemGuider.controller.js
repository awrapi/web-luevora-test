/**
 * System Guider Controller
 * Handles admin ↔ AI chat for customer guidance
 */

import * as guiderService from '../services/ai_agent/systemGuider.service.js';

/**
 * POST /system-guider/:requestId/chat
 * Admin sends a message, gets AI response
 */
export const sendGuiderMessage = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const requestId = parseInt(req.params.requestId);
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Pesan tidak boleh kosong' });
    }

    const result = await guiderService.processGuiderChat(tenantId, requestId, message.trim());
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[SystemGuider Controller] chat error:', error.message);
    res.status(500).json({ success: false, message: 'Gagal memproses pesan' });
  }
};

/**
 * GET /system-guider/:requestId/history
 * Get chat history + todos for a request
 */
export const getGuiderHistory = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const requestId = parseInt(req.params.requestId);

    const data = await guiderService.getGuiderHistory(tenantId, requestId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('[SystemGuider Controller] history error:', error.message);
    res.status(500).json({ success: false, message: 'Gagal mengambil history' });
  }
};

/**
 * POST /system-guider/:requestId/execute-todo/:todoId
 * Execute a single todo item
 */
export const executeTodoItem = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const requestId = parseInt(req.params.requestId);
    const todoId = parseInt(req.params.todoId);

    const result = await guiderService.executeTodo(tenantId, requestId, todoId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[SystemGuider Controller] execute-todo error:', error.message);
    res.status(500).json({ success: false, message: 'Gagal mengeksekusi instruksi' });
  }
};

/**
 * POST /system-guider/:requestId/execute-all
 * Execute all pending todos for a request
 */
export const executeAllTodos = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const requestId = parseInt(req.params.requestId);

    const results = await guiderService.executeAllTodos(tenantId, requestId);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('[SystemGuider Controller] execute-all error:', error.message);
    res.status(500).json({ success: false, message: 'Gagal mengeksekusi instruksi' });
  }
};

/**
 * POST /system-guider/:requestId/execute-need-info/:todoId
 * Execute proactive follow-up to customer (NEED_INFO_CARD)
 */
export const executeNeedInfoItem = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const requestId = parseInt(req.params.requestId);
    const todoId = parseInt(req.params.todoId);

    const result = await guiderService.executeNeedInfo(tenantId, requestId, todoId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[SystemGuider Controller] execute-need-info error:', error.message);
    res.status(500).json({ success: false, message: 'Gagal mengirim follow-up ke customer' });
  }
};
