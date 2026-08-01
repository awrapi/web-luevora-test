import express from 'express';
import { chat, summarizeChat, getConfig } from '../controllers/aiTest.controller.js';

const router = express.Router();

router.post('/chat', chat);
router.post('/summarize', summarizeChat);
router.get('/config', getConfig);

export default router;
