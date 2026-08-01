import express from 'express';
import crypto from 'crypto';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import * as instagramService from '../../services/instagram/instagram.service.js';
import { processIncomingWebhook } from '../../services/shared/webhook.service.js';
import prisma from '../../config/database.js';

// =========================================================
// Helper: Parse & Verify Meta signed_request (HMAC-SHA256)
// =========================================================
const parseSignedRequest = (signedRequest, appSecret) => {
  const [encodedSig, payload] = signedRequest.split('.');
  if (!encodedSig || !payload) throw new Error('Invalid signed_request format');

  const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const data = JSON.parse(
    Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  );

  const expectedSig = crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest();

  if (!crypto.timingSafeEqual(sig, expectedSig)) {
    throw new Error('Invalid signed_request signature');
  }
  return data;
};

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

    const result = await instagramService.handleInstagramAuth(tenantId, accessToken);
    res.json({ success: true, message: 'Instagram Configured', data: result });
  } catch (error) {
    console.error('[InstagramRoutes] Auth Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to authenticate with Instagram.' });
  }
});

// New endpoint for Direct Instagram Login
router.post('/oauth/exchange-ig', authMiddleware, tenantMiddleware, async (req, res) => {
  try {
    const { code, redirectUri } = req.body;
    const tenantId = req.tenant.id;

    if (!code || !redirectUri) {
      return res.status(400).json({ success: false, message: 'Code and redirectUri are required' });
    }

    const { exchangeInstagramCode } = await import('../../services/instagram/instagram.service.js');
    const config = await exchangeInstagramCode(tenantId, code, redirectUri);
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('[Instagram OAuth Route Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================================================
// Facebook OAuth Exchange untuk Instagram DM (POST /api/instagram/oauth/exchange-fb)
// Menukar Facebook OAuth code → Page Access Token → IG Business Account ID
// Ini WAJIB untuk DM webhook (Basic Display API token tidak support DM)
// =========================================================
router.post('/oauth/exchange-fb', authMiddleware, tenantMiddleware, async (req, res) => {
  try {
    const { code, redirectUri } = req.body;
    const tenantId = req.tenant.id;

    if (!code || !redirectUri) {
      return res.status(400).json({ success: false, message: 'Code and redirectUri are required' });
    }

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
      return res.status(500).json({ success: false, message: 'META_APP_ID / META_APP_SECRET belum dikonfigurasi.' });
    }

    const axios = (await import('axios')).default;

    // 1. Tukar Facebook OAuth code dengan User Access Token
    const tokenRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: { client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code }
    });
    const userToken = tokenRes.data.access_token;
    console.log('[Instagram FB OAuth] ✓ Got Facebook User Access Token');

    // 2. Ambil Pages yang dikelola user
    const pagesRes = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
      params: { access_token: userToken }
    });
    const pages = pagesRes.data?.data || [];
    if (pages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada Facebook Page yang ditemukan. Pastikan akun Anda mengelola minimal satu Page.'
      });
    }

    const page = pages[0];
    const pageId = page.id;
    const pageToken = page.access_token;
    console.log(`[Instagram FB OAuth] ✓ Page: ${page.name} (${pageId})`);

    // 3. Dapatkan Instagram Business Account ID dari Page
    let finalIgId = null;
    try {
      const igRes = await axios.get(`https://graph.facebook.com/v19.0/${pageId}`, {
        params: { fields: 'instagram_business_account,instagram_accounts', access_token: pageToken }
      });
      console.log('[Instagram FB OAuth] Page API response:', JSON.stringify(igRes.data));
      finalIgId = igRes.data?.instagram_business_account?.id || igRes.data?.instagram_accounts?.data?.[0]?.id;
    } catch (igErr) {
      console.warn('[Instagram FB OAuth] ⚠️ Could not fetch IG Business Account:', igErr.response?.data || igErr.message);
    }

    // Fallback: gunakan ig_account_id yang sudah ada di DB (dari webhook yang masuk)
    const { default: prisma } = await import('../../config/database.js');
    if (!finalIgId) {
      const existing = await prisma.globalSetting.findFirst({
        where: { tenant_id: tenantId, setting_key: 'ig_account_id' }
      });
      finalIgId = existing?.setting_value || null;
      if (finalIgId) {
        console.log(`[Instagram FB OAuth] ✓ Using existing IG Account ID from DB: ${finalIgId}`);
      } else {
        console.warn('[Instagram FB OAuth] ⚠️ No IG Account ID found — will be set when first webhook arrives');
      }
    } else {
      console.log(`[Instagram FB OAuth] ✓ IG Business Account ID: ${finalIgId}`);
    }

    // 4. Simpan ke database — SELALU simpan token, ini yang penting!
    const upsert = async (key, value) => {
      if (!value) return;
      await prisma.globalSetting.upsert({
        where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: key } },
        update: { setting_value: String(value) },
        create: { tenant_id: tenantId, setting_key: key, setting_value: String(value) }
      });
    };
    await upsert('ig_access_token', pageToken);
    if (finalIgId) await upsert('ig_account_id', finalIgId);
    await upsert('ig_page_id', pageId);
    console.log(`[Instagram FB OAuth] ✓ Token & Page ID saved to DB`);

    // 5. Subscribe Page ke webhook messages (KUNCI agar DM webhook berjalan)
    try {
      const subRes = await axios.post(`https://graph.facebook.com/v19.0/${pageId}/subscribed_apps`, null, {
        params: { subscribed_fields: 'messages,messaging_postbacks', access_token: pageToken }
      });
      console.log(`[Instagram FB OAuth] ✓ Page webhook subscribed:`, subRes.data);
    } catch (subErr) {
      console.error('[Instagram FB OAuth] ⚠️ Webhook subscription failed:', subErr.response?.data || subErr.message);
    }

    res.json({ success: true, data: { igAccountId: finalIgId, pageId, tokenSaved: true } });
  } catch (error) {
    console.error('[Instagram FB OAuth Error]', error.response?.data || error.message);
    res.status(500).json({ success: false, message: error.response?.data?.error?.message || error.message });
  }
});

// =========================================================
// Webhook Endpoints (Public)
// =========================================================

// Verification from Meta for Instagram
router.get('/webhook', (req, res) => {
  const verify_token = process.env.META_VERIFY_TOKEN || 'LUEVORA_META_WEBHOOK_VERIFY';
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === verify_token) {
      console.log('[Instagram Webhook] WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.status(400).send('Bad Request');
  }
});

// Resolve Tenant by Instagram Account ID
const resolveTenantFromIgAccountId = async (igAccountId) => {
  const setting = await prisma.globalSetting.findFirst({
    where: { setting_key: 'ig_account_id', setting_value: igAccountId },
    include: { tenant: true }
  });
  if (setting && setting.tenant) {
    return { tenantId: setting.tenant.id, businessName: setting.tenant.business_name };
  }
  return null;
};

// Receiving messages from Instagram
router.post('/webhook', express.json(), async (req, res) => {
  try {
    const payload = req.body;

    console.log('[Instagram Webhook] ============ INCOMING WEBHOOK ============');
    console.log('[Instagram Webhook] payload.object:', payload.object);
    console.log('[Instagram Webhook] Full payload:', JSON.stringify(payload, null, 2));

    // Fast response to Meta
    res.status(200).send('EVENT_RECEIVED');

    if (payload.object === 'instagram') {
      for (const entry of payload.entry) {
        const igAccountId = entry.id;
        const igAccountIdStr = String(igAccountId);

        // Skip entries with no messaging array
        if (!entry.messaging || entry.messaging.length === 0) {
          console.log('[Instagram Webhook] Skipping entry with no messaging:', igAccountIdStr);
          continue;
        }

        // Check if this entry only has non-message events (read receipts, typing, etc.)
        const hasRealMessage = entry.messaging.some(e => e.message?.text || e.message?.attachments);
        if (!hasRealMessage) {
          console.log('[Instagram Webhook] Skipping non-message event (read receipt/typing) for:', igAccountIdStr);
          continue;
        }

        console.log('[Instagram Webhook] entry.id (igAccountId):', igAccountIdStr);

        // Try to resolve tenant by entry.id first, then by recipient.id
        let tenant = await resolveTenantFromIgAccountId(igAccountIdStr);
        if (!tenant) {
          // Fallback: try recipient.id from first messaging event
          const recipientId = String(entry.messaging?.[0]?.recipient?.id || '');
          if (recipientId && recipientId !== igAccountIdStr) {
            console.log('[Instagram Webhook] Fallback: trying recipient.id:', recipientId);
            tenant = await resolveTenantFromIgAccountId(recipientId);
          }
        }

        if (!tenant) {
          console.warn(`[Instagram Webhook] No tenant for entry.id=${igAccountIdStr} — skipping`);
          continue;
        }
        
        console.log('[Instagram Webhook] ✓ Tenant found:', tenant.tenantId, tenant.businessName);

        if (entry.messaging) {
          for (const messageEvent of entry.messaging) {
            if (!messageEvent.sender || !messageEvent.sender.id) continue;
            
            const senderId = messageEvent.sender.id;
            const message = messageEvent.message;

            // Skip read receipts, typing indicators, and echo messages
            if (messageEvent.read || messageEvent.typing) continue;
            if (message?.is_echo) continue; // Pesan yang dikirim oleh page sendiri
            if (senderId === igAccountIdStr) continue; // fallback echo check

            if (message && message.text) {
              const userMessage = message.text;
              
              processIncomingWebhook({
                tenantId: tenant.tenantId,
                userPhone: senderId,
                userMessage: userMessage,
                profileName: 'Instagram User',
                provider: 'instagram',
                mediaUrl: null,
                audioUrl: null,
                isVoiceNote: false,
              }).catch(err => {
                console.error('[Instagram Webhook] Background processing error:', err);
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[Instagram Webhook Error]:', err);
  }
});

// =========================================================
// Meta Compliance: Deauthorize Callback
// POST /api/instagram/deauthorize
// Dipanggil Meta saat user mencabut akses app dari akun IG-nya.
// Menghapus credentials Instagram tenant yang terkait.
// =========================================================
router.post('/deauthorize', express.urlencoded({ extended: true }), express.json(), async (req, res) => {
  // Selalu balas 200 dulu agar Meta tidak retry
  res.status(200).send('OK');

  try {
    const signedRequest = req.body?.signed_request;
    if (!signedRequest) {
      console.warn('[Instagram Deauth] No signed_request in payload');
      return;
    }

    const appSecret = process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET;
    const data = parseSignedRequest(signedRequest, appSecret);
    const igUserId = String(data.user_id || data.uid || '');

    console.log(`[Instagram Deauth] User deauthorized: ${igUserId}`);

    if (!igUserId) return;

    // Temukan tenant berdasarkan ig_account_id
    const setting = await prisma.globalSetting.findFirst({
      where: { setting_key: 'ig_account_id', setting_value: igUserId },
    });

    if (!setting) {
      console.warn(`[Instagram Deauth] No tenant found for IG user: ${igUserId}`);
      return;
    }

    // Hapus semua credentials Instagram milik tenant ini
    await prisma.globalSetting.deleteMany({
      where: {
        tenant_id: setting.tenant_id,
        setting_key: { in: ['ig_access_token', 'ig_account_id', 'ig_page_id'] },
      },
    });

    console.log(`[Instagram Deauth] ✓ Credentials cleared for tenant: ${setting.tenant_id}`);
  } catch (err) {
    console.error('[Instagram Deauth Error]:', err.message);
  }
});

// =========================================================
// Meta Compliance: Data Deletion Request (GDPR)
// POST /api/instagram/data-deletion
// Dipanggil Meta saat user meminta penghapusan data.
// Menghapus semua data IG tenant & mengembalikan confirmation.
// =========================================================
router.post('/data-deletion', express.urlencoded({ extended: true }), express.json(), async (req, res) => {
  try {
    const signedRequest = req.body?.signed_request;
    if (!signedRequest) {
      return res.status(400).json({ error: 'signed_request is required' });
    }

    const appSecret = process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET;
    const data = parseSignedRequest(signedRequest, appSecret);
    const igUserId = String(data.user_id || data.uid || '');

    console.log(`[Instagram DataDeletion] Request for user: ${igUserId}`);

    // Generate confirmation code unik
    const confirmationCode = crypto
      .createHash('sha256')
      .update(`${igUserId}-${Date.now()}`)
      .digest('hex')
      .slice(0, 16);

    if (igUserId) {
      // Temukan tenant
      const setting = await prisma.globalSetting.findFirst({
        where: { setting_key: 'ig_account_id', setting_value: igUserId },
      });

      if (setting) {
        // Hapus credentials Instagram
        await prisma.globalSetting.deleteMany({
          where: {
            tenant_id: setting.tenant_id,
            setting_key: { in: ['ig_access_token', 'ig_account_id', 'ig_page_id'] },
          },
        });

        // Hapus chat history dari IG user ini
        await prisma.chatHistory.deleteMany({
          where: { tenant_id: setting.tenant_id, user_phone: igUserId },
        });

        // Hapus lead jika ada
        await prisma.lead.deleteMany({
          where: { tenant_id: setting.tenant_id, phone: igUserId },
        });

        console.log(`[Instagram DataDeletion] ✓ Data deleted for tenant: ${setting.tenant_id}, IG user: ${igUserId}`);
      }
    }

    const publicUrl = process.env.PUBLIC_URL || 'https://develop.luevora.com';

    // Response wajib sesuai format Meta
    return res.status(200).json({
      url: `${publicUrl}/api/instagram/data-deletion/status?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  } catch (err) {
    console.error('[Instagram DataDeletion Error]:', err.message);
    return res.status(400).json({ error: 'Invalid signed_request' });
  }
});

// Status page untuk data deletion (dipanggil user untuk verifikasi)
router.get('/data-deletion/status', (req, res) => {
  const code = req.query.code || 'unknown';
  res.json({
    status: 'deleted',
    confirmation_code: code,
    message: 'Your Instagram data associated with Luevora has been deleted.',
  });
});

export default router;
