import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import * as metaService from '../../services/whatsapp/meta.service.js';
import { normalizePhone, resolveTenantFromPhone, resolveTenantFromMetaPhoneId, processIncomingWebhook } from '../../services/shared/webhook.service.js';

const router = express.Router();

// =========================================================
// Dashboard Endpoints (Requires Auth)
// =========================================================
router.post('/auth', authMiddleware, tenantMiddleware, async (req, res) => {
  try {
    const { accessToken } = req.body;
    const tenantId = req.tenant.id;

    if (!accessToken) {
      return res.status(400).json({ success: false, message: 'Access token is required.' });
    }

    const result = await metaService.handleMetaAuth(tenantId, accessToken);
    res.json({ success: true, message: 'Meta WhatsApp Configured', data: result });
  } catch (error) {
    console.error('[MetaRoutes] Auth Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to authenticate with Meta.' });
  }
});

// =========================================================
// Webhook Endpoints (Public)
// =========================================================

// Verification from Meta
router.get('/webhook', (req, res) => {
  const verify_token = process.env.META_VERIFY_TOKEN || 'LUEVORA_META_WEBHOOK_VERIFY';
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === verify_token) {
      console.log('[Meta Webhook] WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.status(400).send('Bad Request');
  }
});

// Receiving messages from Meta
router.post('/webhook', express.json(), async (req, res) => {
  try {
    const payload = req.body;

    // Fast response to Meta
    res.status(200).send('EVENT_RECEIVED');

    if (payload.object === 'whatsapp_business_account') {
      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.value && change.value.messages && change.value.messages[0]) {
            const message = change.value.messages[0];
            const contact = change.value.contacts ? change.value.contacts[0] : null;
            
            // Meta Phone ID (Destination)
            const toRaw = change.value.metadata.display_phone_number;
            const metaPhoneId = change.value.metadata.phone_number_id;
            
            // Sender Phone
            const fromRaw = message.from;
            const profileName = contact?.profile?.name || '';
            
            let userMessage = '';
            let mediaUrl = null;
            let audioUrl = null;
            let isVoiceNote = false;

            if (message.type === 'text') {
              userMessage = message.text.body;
            } else if (message.type === 'audio') {
              // We need to fetch the media via Meta API later if needed,
              // for now just pass the media ID
              mediaUrl = message.audio.id; 
              isVoiceNote = true;
            } else if (message.type === 'image') {
              mediaUrl = message.image.id;
            } else if (message.type === 'button') {
              userMessage = message.button.text;
            } else if (message.type === 'interactive') {
              if (message.interactive.type === 'button_reply') {
                userMessage = message.interactive.button_reply.title;
              } else if (message.interactive.type === 'list_reply') {
                userMessage = message.interactive.list_reply.title;
              }
            }

            // Resolve Tenant - Try by Meta Phone ID first, fallback to Phone Number string
            let tenant = await resolveTenantFromMetaPhoneId(metaPhoneId);
            if (!tenant) {
              tenant = await resolveTenantFromPhone(toRaw);
            }
            
            if (!tenant) {
              console.error(`[Meta Webhook] X No tenant mapped for number: ${toRaw} (ID: ${metaPhoneId})`);
              continue;
            }

            const userPhone = normalizePhone(fromRaw);

            // Process in background
            processIncomingWebhook({
              tenantId: tenant.tenantId,
              userPhone,
              userMessage: userMessage || `[Meta: ${message.type} dikirim]`,
              profileName,
              provider: 'meta',
              mediaUrl: isVoiceNote ? null : mediaUrl,
              audioUrl: isVoiceNote ? mediaUrl : null,
              isVoiceNote,
              providerMsgId: message.id,
              sentAt: message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : null,
            }).catch(err => {
              console.error('[Meta Webhook] Background processing error:', err);
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('[Meta Webhook Error]:', err);
  }
});

export default router;
