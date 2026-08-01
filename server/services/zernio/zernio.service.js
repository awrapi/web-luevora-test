import Zernio from '@zernio/node';
import prisma from '../../config/database.js';
import { normalizePhone } from '../shared/webhook.service.js';
import crypto from 'crypto';

// Cache sandbox accountId (refresh setiap 1 jam)
const _sandboxCache = new Map(); // tenantId → { accountId, expiry }

/**
 * Helper: Retrieve Zernio credentials from database
 */
export const getZernioCredentials = async (tenantId) => {
  const settings = await prisma.globalSetting.findMany({
    where: { 
      tenant_id: tenantId, 
      setting_key: { in: ['zernio_api_key', 'zernio_whatsapp_account_id', 'zernio_instagram_account_id', 'zernio_profile_id'] } 
    }
  });
  
  const config = {};
  settings.forEach(s => config[s.setting_key] = s.setting_value);
  
  // Fallback to env for api key
  config.zernio_api_key = config.zernio_api_key || process.env.ZERNIO_API_KEY;
  
  if (!config.zernio_api_key) {
    throw new Error('Zernio API key tidak ditemukan untuk tenant ini.');
  }
  return config;
};

/**
 * Get configured Zernio SDK Client
 */
export const getZernioClient = async (tenantId) => {
  const { zernio_api_key } = await getZernioCredentials(tenantId);
  return new Zernio({ apiKey: zernio_api_key });
};

/**
 * Kirim Pesan Teks via Zernio Unified API
 * 
 * Alur:
 *  - Jika conversationId ADA (thread aktif dari webhook) → sendInboxMessage (freeform)
 *  - Jika conversationId TIDAK ADA:
 *    - WhatsApp: createInboxConversation DENGAN templateName (WAJIB per aturan WhatsApp 24h window)
 *    - Instagram: createInboxConversation DENGAN message teks biasa
 */
/**
 * Helper: Cek apakah tenant menggunakan sandbox mode
 */
export const isSandboxMode = async (tenantId) => {
  try {
    const setting = await prisma.globalSetting.findUnique({
      where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: 'zernio_sandbox_mode' } }
    });
    return setting?.setting_value === 'true' || setting?.setting_value === '1';
  } catch {
    return false;
  }
};

/**
 * Helper: Ambil sandbox accountId dari Zernio API
 * Hasil di-cache 1 jam untuk menghindari rate limiting.
 */
export const getWhatsAppSandboxAccountId = async (tenantId) => {
  const cached = _sandboxCache.get(tenantId);
  if (cached && cached.expiry > Date.now()) {
    return cached.accountId;
  }

  const client = await getZernioClient(tenantId);

  // GET /v1/whatsapp/phone-numbers — sandbox info ada di field response.sandbox
  const { data, error } = await client.whatsappphonenumbers.getWhatsAppPhoneNumbers();
  if (error) throw new Error(error.error || 'Gagal mengambil info sandbox Zernio');

  const sandboxInfo = data?.sandbox;
  if (!sandboxInfo || !sandboxInfo.accountId) {
    throw new Error('Sandbox WhatsApp belum dikonfigurasi di akun Zernio ini. Pastikan fitur sandbox diaktifkan.');
  }

  _sandboxCache.set(tenantId, { accountId: sandboxInfo.accountId, expiry: Date.now() + 3600_000 });
  return sandboxInfo.accountId;
};

/**
 * Helper: List sandbox sessions untuk tenant
 */
export const listSandboxSessions = async (tenantId) => {
  const client = await getZernioClient(tenantId);
  const { data, error } = await client.whatsappsandbox.listWhatsAppSandboxSessions();
  if (error) throw new Error(error.error || 'Gagal mengambil sandbox sessions');
  return data;
};

/**
 * Helper: Buat atau refresh sandbox session untuk nomor tertentu
 */
export const createSandboxSession = async (tenantId, phone) => {
  const client = await getZernioClient(tenantId);
  const { data, error } = await client.whatsappsandbox.createWhatsAppSandboxSession({
    body: { phone }
  });
  if (error) throw new Error(error.error || 'Gagal membuat sandbox session');
  return data;
};

/**
 * Helper: Hapus sandbox session
 */
export const deleteSandboxSession = async (tenantId, sessionId) => {
  const client = await getZernioClient(tenantId);
  const { data, error } = await client.whatsappsandbox.deleteWhatsAppSandboxSession({
    path: { sessionId }
  });
  if (error) throw new Error(error.error || 'Gagal menghapus sandbox session');
  return data;
};

export const sendZernioMessage = async (tenantId, platform, toPhone, messageText, conversationId = null) => {
  const { zernio_api_key, zernio_whatsapp_account_id, zernio_instagram_account_id } = await getZernioCredentials(tenantId);

  // Jika sandbox mode aktif dan platform WhatsApp, gunakan sandbox accountId
  let accountId;
  if (platform === 'instagram') {
    accountId = zernio_instagram_account_id;
  } else {
    const sandboxMode = await isSandboxMode(tenantId);
    if (sandboxMode) {
      accountId = await getWhatsAppSandboxAccountId(tenantId);
      console.log(`[Zernio] Sandbox mode active for tenant ${tenantId}, using sandbox accountId: ${accountId}`);
    } else {
      accountId = zernio_whatsapp_account_id;
    }
  }

  if (!accountId) {
    throw new Error(`Zernio ${platform} account ID belum dikonfigurasi. ${platform === 'whatsapp' ? 'Hubungkan akun WhatsApp atau aktifkan sandbox mode.' : ''}`);
  }

  const client = new Zernio({ apiKey: zernio_api_key });
  
  try {
    if (conversationId) {
      // Thread aktif — kirim freeform message ke conversation yang sudah ada
      // SDK signature: path: { conversationId }, body: { accountId, message }
      const { data, error } = await client.messages.sendInboxMessage({
        path: { conversationId },
        body: {
          accountId,
          message: messageText
        }
      });
      if (error) throw new Error(error.error || 'Gagal mengirim pesan via sendInboxMessage');
      return data;
    } else {
      // Belum ada thread — buat conversation baru
      if (platform === 'whatsapp') {
        // WhatsApp WAJIB pakai template untuk memulai percakapan baru.
        // Template default bisa dikonfigurasi per tenant, tapi kita fallback ke satu template standar.
        // Jika tenant belum punya template, Zernio akan mengembalikan error TEMPLATE_REQUIRED.
        const templateConfig = await getWhatsAppTemplate(tenantId);
        const { data, error } = await client.messages.createInboxConversation({
          body: {
            accountId,
            participantId: normalizePhone(toPhone),
            templateName: templateConfig.name,
            templateLanguage: templateConfig.language,
            templateParams: [messageText]  // Isi variable {{1}} dengan pesan
          }
        });
        if (error) throw new Error(error.error || 'Gagal membuat percakapan WhatsApp');
        return data;
      } else {
        // Instagram & platform lain — bisa kirim freeform
        const { data, error } = await client.messages.createInboxConversation({
          body: {
            // toPhone untuk IG sekarang sudah pure username (tanpa prefix "ig_").
            // replace(/^ig_/,'') tetap dipertahankan sebagai safety-net untuk
            // lead lama yang masih tersimpan dengan prefix "ig_".
            participantUsername: platform === 'instagram' ? toPhone.replace(/^ig_/, '') : undefined,
            participantId: platform !== 'instagram' ? toPhone : undefined,
            message: messageText,
            skipDmCheck: true
          }
        });
        if (error) throw new Error(error.error || `Gagal membuat percakapan ${platform}`);
        return data;
      }
    }
  } catch (error) {
    console.error(`[Zernio API Error - ${platform}]`, error.message || error);
    throw error;
  }
};

/**
 * Kirim Media via Zernio Unified API
 * Menggunakan attachmentUrl (URL publik) — tidak perlu fetch ke Blob.
 */
export const sendZernioMedia = async (tenantId, platform, toPhone, mediaUrl, caption = '', conversationId = null) => {
  const { zernio_api_key, zernio_whatsapp_account_id, zernio_instagram_account_id } = await getZernioCredentials(tenantId);

  // Sandbox mode check (sama seperti sendZernioMessage)
  let accountId;
  if (platform === 'instagram') {
    accountId = zernio_instagram_account_id;
  } else {
    const sandboxMode = await isSandboxMode(tenantId);
    if (sandboxMode) {
      accountId = await getWhatsAppSandboxAccountId(tenantId);
    } else {
      accountId = zernio_whatsapp_account_id;
    }
  }

  if (!accountId) {
    throw new Error(`Zernio ${platform} account ID belum dikonfigurasi.`);
  }

  const client = new Zernio({ apiKey: zernio_api_key });

  // Tentukan tipe attachment berdasarkan ekstensi URL
  const attachmentType = detectAttachmentType(mediaUrl);

  try {
    if (conversationId) {
      // Thread aktif — kirim ke conversation yang sudah ada
      const { data, error } = await client.messages.sendInboxMessage({
        path: { conversationId },
        body: {
          accountId,
          message: caption || undefined,
          attachmentUrl: mediaUrl,
          attachmentType
        }
      });
      if (error) throw new Error(error.error || 'Gagal mengirim media via sendInboxMessage');
      console.log(`[Zernio] ✅ Media sent to existing conversation ${conversationId}`);
      return data;
    } else {
      // Belum ada thread — buat conversation baru terlebih dahulu
      if (platform === 'whatsapp') {
        const templateConfig = await getWhatsAppTemplate(tenantId);
        const { data: convData, error: convError } = await client.messages.createInboxConversation({
          body: {
            accountId,
            participantId: normalizePhone(toPhone),
            templateName: templateConfig.name,
            templateLanguage: templateConfig.language,
            templateParams: [caption || 'Media']
          }
        });
        if (convError) throw new Error(convError.error || 'Gagal membuat percakapan WhatsApp media');

        const newConversationId = convData?.id || convData?.conversationId;
        console.log(`[Zernio] ✅ New WA conversation created: ${newConversationId}`);

        // Setelah conversation terbuat, kirim media ke dalamnya
        if (newConversationId && mediaUrl) {
          const { data: msgData, error: msgError } = await client.messages.sendInboxMessage({
            path: { conversationId: newConversationId },
            body: {
              accountId,
              attachmentUrl: mediaUrl,
              attachmentType,
              message: caption || undefined
            }
          });
          if (msgError) {
            console.warn(`[Zernio] ⚠️ Media attachment failed after creating conversation: ${msgError.error}`);
          } else {
            console.log(`[Zernio] ✅ Media sent to new conversation ${newConversationId}`);
          }
          return msgData || convData;
        }

        return convData;
      } else {
        const { data, error } = await client.messages.createInboxConversation({
          body: {
            // toPhone untuk IG sekarang sudah pure username (tanpa prefix "ig_").
            // replace(/^ig_/,'') tetap dipertahankan sebagai safety-net untuk
            // lead lama yang masih tersimpan dengan prefix "ig_".
            participantUsername: platform === 'instagram' ? toPhone.replace(/^ig_/, '') : undefined,
            participantId: platform !== 'instagram' ? toPhone : undefined,
            message: caption || undefined,
            attachmentUrl: mediaUrl,
            skipDmCheck: true
          }
        });
        if (error) throw new Error(error.error || `Gagal membuat percakapan media ${platform}`);
        console.log(`[Zernio] ✅ Media conversation created for ${platform}`);
        return data;
      }
    }
  } catch (error) {
    console.error(`[Zernio API Error - ${platform}]`, error.message || error);
    throw error;
  }
};

/**
 * Helper: Detect attachment type dari URL
 */
const detectAttachmentType = (url) => {
  if (!url) return 'file';
  const lower = url.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)/.test(lower)) return 'image';
  if (/\.(mp4|mov|avi|webm|mkv)/.test(lower)) return 'video';
  if (/\.(mp3|ogg|opus|wav|aac|m4a)/.test(lower)) return 'audio';
  return 'file';
};

/**
 * Helper: Ambil konfigurasi WhatsApp template untuk tenant
 * Template ini digunakan saat membuka percakapan baru (di luar 24h window).
 */
const getWhatsAppTemplate = async (tenantId) => {
  try {
    const setting = await prisma.globalSetting.findUnique({
      where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: 'zernio_wa_template_name' } }
    });
    
    const langSetting = await prisma.globalSetting.findUnique({
      where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: 'zernio_wa_template_lang' } }
    });
    
    return {
      name: setting?.setting_value || process.env.ZERNIO_WA_TEMPLATE_NAME || 'hello_world',
      language: langSetting?.setting_value || process.env.ZERNIO_WA_TEMPLATE_LANG || 'en_US'
    };
  } catch {
    return {
      name: process.env.ZERNIO_WA_TEMPLATE_NAME || 'hello_world',
      language: process.env.ZERNIO_WA_TEMPLATE_LANG || 'en_US'
    };
  }
};

/**
 * Verify Webhook Signature
 */
export const verifyWebhookSignature = (rawBody, signature, secret) => {
  if (!signature || !secret) return false;
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return signature === computedSignature;
};
