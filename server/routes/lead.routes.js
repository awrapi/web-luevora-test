import express from 'express';
import { getLeads, getChatMessages } from '../controllers/lead.controller.js';

const router = express.Router();

// GET /api/lead
router.get('/', getLeads);

// GET /api/lead/chat/:user_phone
router.get('/chat/:user_phone', getChatMessages);

export default router;
