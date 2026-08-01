import express from 'express';
import prisma from '../../config/database.js';
import { handleTelegramWebhook, setupWebhook } from '../../services/telegram/telegram.service.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';

const router = express.Router();

// 1. Webhook endpoint from Telegram (Public)
// URL Format: POST /api/telegram/webhook/:tenantId
router.post('/webhook/:tenantId', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    await handleTelegramWebhook(tenantId, req.body);
    res.status(200).send('OK');
  } catch (err) {
    console.error('[Telegram Webhook Error]', err);
    res.status(500).send('Internal Server Error');
  }
});

// 2. Configuration endpoint for Dashboard (Protected)
// GET /api/telegram/config
router.get('/config', authMiddleware, tenantMiddleware, async (req, res) => {
  try {
    const account = await prisma.telegramAccount.findUnique({
      where: { tenant_id: req.tenant.id }
    });
    res.json({
      success: true,
      data: account || { bot_token: '', bot_username: '', is_active: 0 }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/telegram/config
router.post('/config', authMiddleware, tenantMiddleware, async (req, res) => {
  const { bot_token, bot_username, is_active } = req.body;
  const tenantId = req.tenant.id;
  
  try {
    const account = await prisma.telegramAccount.upsert({
      where: { tenant_id: tenantId },
      update: {
        bot_token,
        bot_username,
        is_active: is_active ? 1 : 0
      },
      create: {
        tenant_id: tenantId,
        bot_token,
        bot_username,
        is_active: is_active ? 1 : 0
      }
    });

    // If active, try to set webhook automatically if the server knows its public URL
    // Usually we might need the client to pass the base URL, or read from env.
    // For now we just save the config. 
    // If you have a TUNNEL_URL or BASE_URL env var, you could call setupWebhook here.
    if (process.env.PUBLIC_URL && is_active) {
      const webhookUrl = `${process.env.PUBLIC_URL}/api/telegram/webhook/${tenantId}`;
      await setupWebhook(tenantId, webhookUrl).catch(e => console.warn('Failed to set webhook', e.message));
    }

    res.json({ success: true, message: 'Konfigurasi Telegram berhasil disimpan', data: account });
  } catch (error) {
    console.error('[Telegram Config Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
