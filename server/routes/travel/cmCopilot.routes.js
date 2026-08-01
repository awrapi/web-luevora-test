import express from 'express';
import {
  sendCmMessage,
  getCmHistory,
  updateItemStatus,
  setItemQuestion,
  proceedDraft,
  sendToCustomer
} from '../../controllers/cmCopilot.controller.js';

const router = express.Router();

// POST /api/cm-copilot/:cmId/chat — Admin sends message, gets AI response
router.post('/:cmId/chat', sendCmMessage);

// GET /api/cm-copilot/:cmId/history — Get chat history + items + lead
router.get('/:cmId/history', getCmHistory);

// PUT /api/cm-copilot/:cmId/items/:itemId — Update item status (approve/reject/notes)
router.put('/:cmId/items/:itemId', updateItemStatus);

// PUT /api/cm-copilot/:cmId/items/:itemId/question — Set pending question (AI asks customer)
router.put('/:cmId/items/:itemId/question', setItemQuestion);

// POST /api/cm-copilot/:cmId/proceed — Generate proceed draft
router.post('/:cmId/proceed', proceedDraft);

// POST /api/cm-copilot/:cmId/send — Send finalized message to customer
router.post('/:cmId/send', sendToCustomer);

export default router;
