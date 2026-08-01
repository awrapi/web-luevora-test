/**
 * ================================================================
 * Webhook Routes — Central Webhook for All Tenants
 * ================================================================
 * Production-ready B2B architecture:
 *   - POST /api/webhook/incoming     → Central endpoint (recommended)
 *   - POST /api/webhook/twilio/:id   → Legacy per-tenant endpoint (backward compatible)
 * 
 * The central endpoint resolves the tenant from the destination
 * phone number (Twilio's "To" field), so all tenants share one URL.
 * ================================================================
 */

import express from 'express';
import {
  normalizePhone,
  resolveTenantFromPhone,
  processIncomingWebhook,
} from '../../services/shared/webhook.service.js';

const router = express.Router();

/**
 * ================================================================
 * CENTRAL WEBHOOK ENDPOINT (Production)
 * ================================================================
 * 
 * Single URL for ALL tenants. Twilio Console only needs this one URL:
 *   https://your-domain.com/api/webhook/incoming
 * 
 * Tenant is resolved automatically from the "To" phone number
 * via the `tenant_phone_numbers` lookup table.
 * 
 * Supports: Twilio WhatsApp (form-urlencoded payload)
 * ================================================================
 */
router.post('/incoming', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const payload = req.body;

    // Extract Twilio fields
    const fromRaw = payload.From || '';        // "whatsapp:+628123456789"
    const toRaw = payload.To || '';            // "whatsapp:+14155238886"
    let userMessage = payload.Body || '';
    const profileName = payload.ProfileName || '';
    const mediaUrl = payload.MediaUrl0 || null;
    const mediaContentType = payload.MediaContentType0 || '';

    // Fast TwiML response — MUST respond within 15s to prevent Twilio retry
    res.type('text/xml');
    res.send('<Response></Response>');

    // Validate required fields
    if (!fromRaw || (!userMessage && !mediaUrl)) {
      console.warn('[Webhook] Missing From, Body, or Media in payload');
      return;
    }

    // ── Resolve tenant from destination number ──
    const tenant = await resolveTenantFromPhone(toRaw);

    if (!tenant) {
      console.error(`[Webhook] ✗ No tenant mapped for number: ${toRaw}`);
      console.error('[Webhook] Register this number in tenant_phone_numbers table first.');
      return;
    }

    // Clean phone number (strip whatsapp: and +)
    const userPhone = normalizePhone(fromRaw);

    // ── Voice Note detection & transcription ──
    let audioUrl = null;
    let isVoiceNote = false;

    if (mediaUrl && (mediaContentType.startsWith('audio/') || mediaContentType === 'video/ogg')) {
      console.log(`[Webhook] Voice note detected from ${userPhone} (${mediaContentType})`);
      try {
        const { transcribeFromUrl } = await import('../../services/shared/voiceNote.service.js');
        const vnResult = await transcribeFromUrl(mediaUrl);
        userMessage = `🎤 [Voice Note]: ${vnResult.transcript}`;
        audioUrl = vnResult.audioPath;
        isVoiceNote = true;
      } catch (vnErr) {
        console.error('[Webhook] VN transcription failed:', vnErr.message);
        userMessage = `🎤 [Voice Note]: [Voice note tidak dapat ditranskrip]`;
        isVoiceNote = true;
      }
    }

    // ── Process in background (non-blocking) ──
    processIncomingWebhook({
      tenantId: tenant.tenantId,
      userPhone,
      userMessage: userMessage || '[Gambar/Media Dikirim]',
      profileName,
      provider: tenant.provider,
      mediaUrl: isVoiceNote ? null : mediaUrl,
      audioUrl,
      isVoiceNote,
    }).catch(err => {
      console.error('[Webhook] Background processing error:', err);
    });

  } catch (err) {
    console.error('[Webhook Central Error]:', err);
    // If headers not sent yet, respond with error
    if (!res.headersSent) {
      res.status(500).json({ status: false, message: err.message });
    }
  }
});



/**
 * ================================================================
 * HEALTH CHECK
 * ================================================================
 * Quick endpoint to verify webhook is reachable.
 *   GET /api/webhook/status
 * ================================================================
 */
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Webhook endpoint is active',
    endpoints: {
      central: 'POST /api/webhook/incoming',
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
