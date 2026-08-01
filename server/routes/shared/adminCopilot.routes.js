import express from 'express';
import { 
  handleAdminCopilotChat,
  handleGetAdminSessions,
  handleGetSessionHistory,
  handleDeleteSession
} from '../../controllers/adminCopilot.controller.js';

const router = express.Router();

// GET /api/v1/admin-copilot/sessions
router.get('/sessions', handleGetAdminSessions);

// GET /api/v1/admin-copilot/sessions/:sessionId
router.get('/sessions/:sessionId', handleGetSessionHistory);

// DELETE /api/v1/admin-copilot/sessions/:sessionId
router.delete('/sessions/:sessionId', handleDeleteSession);

// POST /api/v1/admin-copilot/chat
router.post('/chat', handleAdminCopilotChat);

export default router;
