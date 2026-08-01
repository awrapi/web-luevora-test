/**
 * CM Copilot Controller
 * Handles admin ↔ AI chat for Customer Management
 */

import * as cmCopilotService from '../services/ai_agent/cmCopilot.service.js';

/**
 * POST /cm-copilot/:cmId/chat
 * Admin sends a message, gets AI response
 */
export const sendCmMessage = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const cmId = parseInt(req.params.cmId);
    const { message } = req.body || {};

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Pesan tidak boleh kosong' });
    }

    const result = await cmCopilotService.processCmChat(tenantId, cmId, message.trim());
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[CmCopilot Controller] chat error:', error.message);
    res.status(500).json({ success: false, message: 'Gagal memproses pesan' });
  }
};

/**
 * GET /cm-copilot/:cmId/history
 * Get chat history + request items + lead data
 */
export const getCmHistory = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const cmId = parseInt(req.params.cmId);

    const data = await cmCopilotService.getCmHistory(tenantId, cmId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('[CmCopilot Controller] history error:', error.message);
    res.status(500).json({ success: false, message: 'Gagal mengambil history' });
  }
};

/**
 * PUT /cm-copilot/:cmId/items/:itemId
 * Update request item status manually (approve/reject/notes)
 */
export const updateItemStatus = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const cmId = parseInt(req.params.cmId);
    const itemId = parseInt(req.params.itemId);
    const { status, decision } = req.body || {};

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status wajib diisi' });
    }

    const result = await cmCopilotService.updateItemStatus(tenantId, cmId, itemId, status, decision);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[CmCopilot Controller] update-item error:', error.message);
    res.status(500).json({ success: false, message: 'Gagal mengubah status item' });
  }
};

/**
 * PUT /cm-copilot/:cmId/items/:itemId/question
 * Set a pending question on an item — AI CS will ask customer naturally in next turn
 */
export const setItemQuestion = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const cmId = parseInt(req.params.cmId);
    const itemId = parseInt(req.params.itemId);
    const { question } = req.body || {};

    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, message: 'Pertanyaan tidak boleh kosong' });
    }

    const result = await cmCopilotService.setItemPendingQuestion(tenantId, cmId, itemId, question.trim());
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[CmCopilot Controller] set-question error:', error.message);
    res.status(500).json({ success: false, message: 'Gagal menyimpan pertanyaan' });
  }
};

/**
 * POST /cm-copilot/:cmId/proceed
 * Generate proceed draft (AI drafts message for customer)
 */
export const proceedDraft = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const cmId = parseInt(req.params.cmId);
    const { item_decisions } = req.body || {};

    const result = await cmCopilotService.executeProceed(tenantId, cmId, item_decisions || []);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[CmCopilot Controller] proceed error:', error.message);
    res.status(500).json({ success: false, message: 'Gagal membuat draft' });
  }
};

/**
 * POST /cm-copilot/:cmId/send
 * Send the finalized message to customer via WhatsApp
 */
export const sendToCustomer = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const cmId = parseInt(req.params.cmId);
    const { message } = req.body || {};

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Pesan tidak boleh kosong' });
    }

    const result = await cmCopilotService.sendProceedToCustomer(tenantId, cmId, message.trim());
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[CmCopilot Controller] send error:', error.message);
    res.status(500).json({ success: false, message: 'Gagal mengirim pesan ke customer' });
  }
};
