import express from 'express';
import rateLimit from 'express-rate-limit';
import { handleChat } from '../controllers/ai.controller.js';
import { handleFormAssistantChat } from '../controllers/aiFormAssistant.controller.js';

const router = express.Router();

// Setup Rate Limiter untuk Endpoint AI (20 request per menit per IP)
const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 menit
  max: 20, // maksimal 20 request per IP dalam 1 menit
  message: {
    success: false,
    message: "Tunggu sebentar, Anda mengirim pesan terlalu cepat."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/ai/chat
router.post('/chat', aiLimiter, handleChat);

// POST /api/ai/form-assistant/chat
router.post('/form-assistant/chat', aiLimiter, handleFormAssistantChat);

export default router;
