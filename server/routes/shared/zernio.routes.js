import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantMiddleware } from '../../middleware/tenant.middleware.js';
import * as zernioService from '../../services/zernio/zernio.service.js';
import { processIncomingWebhook } from '../../services/shared/webhook.service.js';
import prisma from '../../config/database.js';

// Helper: upsert GlobalSetting untuk tenant
const upsertTenantSetting = async (tenantId, key, value) => {
  await prisma.globalSetting.upsert({
    where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: key } },
    update: { setting_value: value },
    create: { tenant_id: tenantId, setting_key: key, setting_value: value }
  });
};

const router = express.Router();

// =========================================================
// Dashboard Endpoints (Requires Auth)
// =========================================================

/**
 * POST /api/zernio/auth
 * Simpan API Key Zernio per-tenant (hanya dipakai jika tenant punya key sendiri).
 * Untuk SaaS global, gunakan env ZERNIO_API_KEY di server.
 */
router.post('/auth', authMiddleware, tenantMiddleware, async (req, res) => {
  try {
    const { apiKey, whatsappAccountId, instagramAccountId } = req.body;
    const tenantId = req.tenant.id;

    if (!apiKey) {
      return res.status(400).json({ success: false, message: 'API Key is required.' });
    }

    const upsertSettings = async (key, value) => {
      if (!value) return;
      await prisma.globalSetting.upsert({
        where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: key } },
        update: { setting_value: value },
        create: { tenant_id: tenantId, setting_key: key, setting_value: value }
      });
    };

    await upsertSettings('zernio_api_key', apiKey);
    if (whatsappAccountId) await upsertSettings('zernio_whatsapp_account_id', whatsappAccountId);
    if (instagramAccountId) await upsertSettings('zernio_instagram_account_id', instagramAccountId);

    res.json({ success: true, message: 'Zernio Configured Successfully' });
  } catch (error) {
    console.error('[ZernioRoutes] Auth Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to configure Zernio.' });
  }
});

/**
 * POST /api/zernio/connect-url
 * Mulai alur OAuth Zernio untuk menghubungkan platform.
 * - Membuat Zernio Profile untuk tenant jika belum ada (1 profile per tenant)
 * - Memanggil SDK getConnectUrl dengan redirect_url
 * - Zernio akan me-redirect user ke halaman auth platform, lalu kembali ke redirect_url
 *   dengan query params: ?connected={platform}&profileId=X&accountId=Y&username=Z
 */
router.post('/connect-url', authMiddleware, tenantMiddleware, async (req, res) => {
  try {
    const { platform, redirectUrl } = req.body;
    const tenantId = req.tenant.id;
    
    const client = await zernioService.getZernioClient(tenantId);
    
    // Cek apakah tenant sudah punya profileId
    const profileSetting = await prisma.globalSetting.findUnique({
      where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: 'zernio_profile_id' } }
    });
    
    let profileId = profileSetting?.setting_value;
    
    if (!profileId) {
      // Buat profile baru untuk tenant ini
      const { data, error } = await client.profiles.createProfile({
        body: {
          name: `Luevora Tenant ${tenantId}`,
          description: `Auto-created profile for tenant ${tenantId}`
        }
      });
      
      if (error) {
        console.error('[ZernioRoutes] Create Profile Error:', error);
        throw new Error(error.error || 'Failed to create profile');
      }
      
      const profile = data.profile;
      profileId = profile._id || profile.id;
      
      await prisma.globalSetting.upsert({
        where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: 'zernio_profile_id' } },
        update: { setting_value: profileId },
        create: { tenant_id: tenantId, setting_key: 'zernio_profile_id', setting_value: profileId }
      });
    }
    
    // Panggil SDK dengan parameter yang benar sesuai dokumentasi OpenAPI
    const { data, error } = await client.connect.getConnectUrl({
      path: { platform },
      query: {
        profileId,
        redirect_url: redirectUrl || undefined
      }
    });
    
    if (error) {
      console.error('[ZernioRoutes] Get Connect URL API Error:', error);
      throw new Error(error.error || 'Failed to get connect URL');
    }
    
    res.json({ success: true, authUrl: data.authUrl });
  } catch (error) {
    console.error('[ZernioRoutes] Connect URL Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/zernio/callback
 * Dipanggil oleh ZernioCallback.jsx setelah OAuth selesai.
 * 
 * Setelah OAuth berhasil, Zernio me-redirect ke:
 *   redirect_url?connected={platform}&profileId=X&accountId=Y&username=Z
 * 
 * Frontend membaca query params tersebut dan mengirimnya ke endpoint ini.
 * Kita langsung menyimpan accountId, tanpa perlu listAccounts lagi.
 */
router.post('/callback', authMiddleware, tenantMiddleware, async (req, res) => {
  try {
    const { platform, accountId } = req.body;
    const tenantId = req.tenant.id;
    
    // ── Primary: accountId langsung dari redirect Zernio ──
    if (accountId) {
      const key = platform === 'instagram' ? 'zernio_instagram_account_id' : 'zernio_whatsapp_account_id';
      
      await prisma.globalSetting.upsert({
        where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: key } },
        update: { setting_value: accountId },
        create: { tenant_id: tenantId, setting_key: key, setting_value: accountId }
      });
      
      return res.json({ success: true, message: `Akun ${platform} berhasil terhubung!`, accountId });
    }
    
    // ── Fallback: jika frontend tidak mengirim accountId, list accounts dengan filter profileId ──
    const client = await zernioService.getZernioClient(tenantId);
    
    const profileSetting = await prisma.globalSetting.findUnique({
      where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: 'zernio_profile_id' } }
    });
    
    const profileId = profileSetting?.setting_value;
    if (!profileId) {
      return res.status(400).json({ success: false, message: 'Profile Zernio belum dibuat. Silakan mulai ulang proses koneksi.' });
    }
    
    // Filter akun berdasarkan profileId agar hanya mendapatkan akun milik tenant ini
    const { accounts } = await client.accounts.listAccounts({ profileId });
    const platformAccounts = accounts.filter(a => a.platform === platform);
    
    if (platformAccounts.length === 0) {
      return res.status(400).json({ success: false, message: `Belum ada akun ${platform} yang terkoneksi di Zernio untuk tenant ini.` });
    }
    
    // Ambil akun terbaru (paling akhir di array)
    const foundAccount = platformAccounts[platformAccounts.length - 1];
    const foundAccountId = foundAccount._id || foundAccount.id;
    
    const key = platform === 'instagram' ? 'zernio_instagram_account_id' : 'zernio_whatsapp_account_id';
    
    await prisma.globalSetting.upsert({
      where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: key } },
      update: { setting_value: foundAccountId },
      create: { tenant_id: tenantId, setting_key: key, setting_value: foundAccountId }
    });
    
    res.json({ success: true, message: 'Akun berhasil terhubung!', accountId: foundAccountId });
  } catch (error) {
    console.error('[ZernioRoutes] Callback Error:', error);
    res.status(500).json({ success: false, message: error.response?.data?.error || error.message });
  }
});

// =========================================================
// WhatsApp Sandbox Endpoints (Requires Auth)
// =========================================================

/**
 * GET /api/zernio/sandbox/status
 * Ambil status sandbox + sessions aktif + sandbox mode flag untuk tenant.
 */
router.get('/sandbox/status', authMiddleware, tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const sandboxMode = await zernioService.isSandboxMode(tenantId);

    let sessionsData = null;
    try {
      sessionsData = await zernioService.listSandboxSessions(tenantId);
    } catch (err) {
      console.warn(`[ZernioRoutes] Gagal ambil sandbox sessions: ${err.message}`);
    }

    res.json({
      success: true,
      sandboxMode,
      sessions: sessionsData?.sessions || [],
      sandboxNumber: sessionsData?.sandboxNumber || null,
    });
  } catch (err) {
    console.error('[ZernioRoutes] Sandbox Status Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/zernio/sandbox/sessions
 * Aktivasi sandbox untuk nomor telepon yang diberikan.
 * Zernio akan mengirim template verifikasi ke nomor tersebut.
 * Body: { phone: string } — format internasional, misal "+628123456789"
 */
router.post('/sandbox/sessions', authMiddleware, tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Nomor telepon (phone) wajib diisi dalam format internasional.' });
    }

    const result = await zernioService.createSandboxSession(tenantId, phone);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[ZernioRoutes] Create Sandbox Session Error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/zernio/sandbox/sessions/:sessionId
 * Cabut sandbox session yang sudah ada.
 */
router.delete('/sandbox/sessions/:sessionId', authMiddleware, tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { sessionId } = req.params;

    const result = await zernioService.deleteSandboxSession(tenantId, sessionId);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[ZernioRoutes] Delete Sandbox Session Error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/zernio/sandbox/mode
 * Aktifkan atau nonaktifkan sandbox mode untuk tenant.
 * Body: { enabled: boolean }
 */
router.patch('/sandbox/mode', authMiddleware, tenantMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Field "enabled" (boolean) wajib diisi.' });
    }

    await upsertTenantSetting(tenantId, 'zernio_sandbox_mode', enabled ? 'true' : 'false');

    res.json({
      success: true,
      sandboxMode: enabled,
      message: enabled
        ? 'Sandbox mode diaktifkan. Pesan WhatsApp akan dikirim via nomor sandbox Zernio.'
        : 'Sandbox mode dinonaktifkan. Pesan akan dikirim via akun WhatsApp produksi.'
    });
  } catch (err) {
    console.error('[ZernioRoutes] Sandbox Mode Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================
// Webhook Endpoints (Public — tidak perlu auth)
// =========================================================

/**
 * POST /api/zernio/webhook
 * Menerima event dari Zernio (message.received, message.sent, dll.)
 * 
 * Payload schema (message.received):
 * {
 *   id, event, timestamp,
 *   message: { id, conversationId, platform, direction, text, attachments[], sender: {...}, sentAt, isRead },
 *   conversation: { id, platform, ... },
 *   account: { id, platform, username, ... }    ← accountId ada di SINI, bukan di message
 * }
 */
router.post('/webhook', express.json(), async (req, res) => {
  try {
    const payload = req.body;

    // Acknowledge cepat agar Zernio tidak retry
    res.status(200).send('EVENT_RECEIVED');

    // Hanya proses event message.received
    if (payload.event === 'message.received' && payload.message) {
      const msg = payload.message;

      // Abaikan pesan outgoing (dikirim oleh bot sendiri)
      if (msg.direction === 'outgoing') return;

      const conversationId = msg.conversationId;
      const platform = msg.platform; // whatsapp, instagram, facebook, telegram
      // ── Identifikasi pengirim (userPhone) ──
      const sender = msg.sender;
      console.log(`[Zernio Webhook] sender FULL: ${JSON.stringify(sender)}`);
      console.log(`[Zernio Webhook] sender.picture: ${sender.picture || 'NONE'}`);
      
      let userPhone = '';
      if (platform === 'whatsapp') {
        // Prioritaskan phoneNumber, fallback ke businessScopedUserId, lalu sender.id
        userPhone = sender.phoneNumber
          ? sender.phoneNumber.replace('+', '')
          : (sender.businessScopedUserId || sender.id);
      } else if (platform === 'instagram') {
        // Simpan pure username (TANPA prefix "ig_") agar nama user di CRM bersih.
        // Prefix "ig_" sebelumnya dipakai untuk menghindari tabrakan dengan nomor WA
        // di kolom `phone`, tapi sekarang platform identity disimpan di kolom
        // terpisah (instagram_username), jadi pure username aman dipakai.
        userPhone = sender.username || sender.id;
      } else {
        userPhone = sender.id;
      }

      // ── Parse konten pesan ──
      let userMessage = msg.text || '';
      let mediaUrl = null;
      let audioUrl = null;
      let isVoiceNote = false;

      if (msg.attachments && msg.attachments.length > 0) {
        const attachment = msg.attachments[0];
        mediaUrl = attachment.url;
        if (attachment.type === 'audio') {
          isVoiceNote = true;
          audioUrl = attachment.url;
        } else if (attachment.type === 'image' || attachment.type === 'video') {
          userMessage = userMessage || `[Gambar/Video dikirim via ${platform}]`;
        }
      }

      // ── Resolusi tenant berdasarkan accountId ──
      // PENTING: accountId ada di `payload.account.id`, BUKAN `msg.accountId`
      const accountId = payload.account?.id;
      const accountPlatform = payload.account?.platform;
      console.log(`[Zernio Webhook] account: id=${accountId}, platform=${accountPlatform}, username=${payload.account?.username || 'N/A'}`);
      
      let tenantId = null;
      
      if (accountId) {
        // 1. Cari di akun produksi + inbox account IDs (cached dari fallback sebelumnya)
        const setting = await prisma.globalSetting.findFirst({
          where: {
            setting_key: { in: [
              'zernio_whatsapp_account_id', 'zernio_instagram_account_id',
              'zernio_whatsapp_inbox_account_id', 'zernio_instagram_inbox_account_id'
            ] },
            setting_value: accountId
          }
        });
        
        if (setting) {
          tenantId = setting.tenant_id;
        }
        
        // 2. Fallback: Zernio webhook accountId might differ from the connected account ID
        //    Try matching via the Zernio API by checking if this accountId belongs to a known profileId
        if (!tenantId) {
          console.log(`[Zernio Webhook] accountId ${accountId} not found in stored settings, trying profileId fallback...`);
          
          // Check all tenants that have a zernio_profile_id and try to match
          const profileSettings = await prisma.globalSetting.findMany({
            where: { setting_key: 'zernio_profile_id' },
            select: { tenant_id: true, setting_value: true }
          });
          
          // For now, if there's only one tenant with Zernio configured, use it
          if (profileSettings.length === 1) {
            tenantId = profileSettings[0].tenant_id;
            console.log(`[Zernio Webhook] Single-tenant fallback → tenant ${tenantId}`);
            
            // Also store this accountId for future direct matches
            const settingKey = platform === 'instagram' 
              ? 'zernio_instagram_inbox_account_id' 
              : platform === 'whatsapp' 
                ? 'zernio_whatsapp_inbox_account_id' 
                : `zernio_${platform}_inbox_account_id`;
            await prisma.globalSetting.upsert({
              where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: settingKey } },
              update: { setting_value: accountId },
              create: { tenant_id: tenantId, setting_key: settingKey, setting_value: accountId }
            });
          } else if (profileSettings.length > 1) {
            // Multi-tenant: try to match accountId via Zernio API
            for (const ps of profileSettings) {
              try {
                const { getZernioClient } = await import('../../services/zernio/zernio.service.js');
                const client = await getZernioClient(ps.tenant_id);
                const { data } = await client.accounts.listAccounts({ query: { profileId: ps.setting_value } });
                const accounts = data?.accounts || [];
                if (accounts.some(a => (a._id || a.id) === accountId)) {
                  tenantId = ps.tenant_id;
                  console.log(`[Zernio Webhook] Matched via Zernio API → tenant ${tenantId}`);
                  break;
                }
              } catch (e) {
                console.warn(`[Zernio Webhook] Gagal API lookup tenant ${ps.tenant_id}:`, e.message);
              }
            }
          }
        }
        
        // 3. Fallback: cek apakah ini sandbox accountId
        if (!tenantId && platform === 'whatsapp') {
          console.log(`[Zernio Webhook] accountId ${accountId} tidak ditemukan, cek sandbox tenants...`);
          const sandboxTenants = await prisma.globalSetting.findMany({
            where: { setting_key: 'zernio_sandbox_mode', setting_value: 'true' },
            select: { tenant_id: true }
          });
          
          for (const st of sandboxTenants) {
            try {
              const { getWhatsAppSandboxAccountId } = await import('../../services/zernio/zernio.service.js');
              const sandboxAccountId = await getWhatsAppSandboxAccountId(st.tenant_id);
              if (sandboxAccountId === accountId) {
                tenantId = st.tenant_id;
                console.log(`[Zernio Webhook] Matched sandbox accountId → tenant ${tenantId}`);
                break;
              }
            } catch (e) {
              console.warn(`[Zernio Webhook] Gagal cek sandbox accountId untuk tenant ${st.tenant_id}:`, e.message);
            }
          }
        }
      }

      if (!tenantId) {
        console.error(`[Zernio Webhook] No tenant mapped for accountId: ${accountId}`);
        return;
      }

      // ── Proses pesan masuk via pipeline standar ──
      // Capture profile photo URL dari sender
      // Per Zernio docs: message.received → sender.picture (string)
      // NOTE: For Instagram, sender.picture is ALWAYS null (Meta platform limitation)
      let profilePhotoUrl = sender.picture || null;

      await processIncomingWebhook({
        tenantId,
        userPhone,
        userMessage: userMessage || `[Zernio: ${platform} message]`,
        profileName: sender.name || sender.username || '',
        provider: platform,
        mediaUrl: isVoiceNote ? null : mediaUrl,
        audioUrl,
        isVoiceNote,
        providerMsgId: msg.id,
        sentAt: msg.sentAt || null,
      }).then(async () => {
        // ── Update Lead dengan conversationId terbaru + profile photo ──
        try {
          const lead = await prisma.lead.findUnique({
            where: { uk_tenant_phone: { tenant_id: tenantId, phone: userPhone } }
          });
          
          let platformIds = {};
          if (lead && lead.platform_ids) {
            try { platformIds = JSON.parse(lead.platform_ids); } catch (_e) { /* ignore */ }
          }
          
          platformIds.zernio_conversation_id = conversationId;
          
          // If no profile photo from webhook AND platform is Instagram, try fetching from IG web API
          if (!profilePhotoUrl && platform === 'instagram' && sender.username && !lead?.profile_photo_url) {
            try {
              const { default: axios } = await import('axios');
              const igRes = await axios.get(
                `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(sender.username)}`,
                {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'x-ig-app-id': '936619743392459'
                  },
                  timeout: 5000
                }
              );
              const user = igRes.data?.data?.user;
              profilePhotoUrl = user?.profile_pic_url_hd || user?.profile_pic_url || null;
              if (profilePhotoUrl) {
                console.log(`[Zernio Webhook] Fetched IG profile pic for @${sender.username}`);
              }
            } catch (igErr) {
              console.warn(`[Zernio Webhook] Could not fetch IG profile pic for @${sender.username}: ${igErr.message}`);
            }
          }
          
          if (lead) {
            const updateData = { platform_ids: JSON.stringify(platformIds) };
            // Simpan foto profil jika tersedia dan belum ada (atau ada URL baru)
            if (profilePhotoUrl && profilePhotoUrl !== lead.profile_photo_url) {
              updateData.profile_photo_url = profilePhotoUrl;
              console.log(`[Zernio Webhook] Saved profile photo for ${userPhone}: ${profilePhotoUrl.substring(0, 80)}...`);
            }
            // Simpan platform identity yang benar untuk Instagram (pure username)
            if (platform === 'instagram' && sender.username && lead.instagram_username !== sender.username) {
              updateData.instagram_username = sender.username;
            }
            await prisma.lead.update({
              where: { id: lead.id },
              data: updateData
            });
          }
        } catch (err) {
          console.warn('[Zernio Webhook] Could not update platform_ids with conversationId:', err.message);
        }
      }).catch(err => {
        console.error('[Zernio Webhook] Background processing error:', err);
      });
    }
  } catch (err) {
    console.error('[Zernio Webhook Error]:', err);
  }
});

export default router;
