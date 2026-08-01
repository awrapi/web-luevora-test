import axios from 'axios';
import prisma from '../../config/database.js';
import { normalizePhone } from '../shared/webhook.service.js'; // Might not need normalizePhone for IG, but good to have

/**
 * Handle Instagram OAuth (Embedded Signup) Token Exchange
 */
export const handleInstagramAuth = async (tenantId, shortLivedToken) => {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error('META_APP_ID dan META_APP_SECRET belum dikonfigurasi di environment variables.');
  }

  let longLivedToken = shortLivedToken;
  try {
    const exchangeUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
    const tokenRes = await axios.get(exchangeUrl);
    if (tokenRes.data && tokenRes.data.access_token) {
      longLivedToken = tokenRes.data.access_token;
    }
  } catch (err) {
    console.warn('[Instagram] Failed to exchange for long-lived token', err.response?.data || err.message);
  }

  // Helper untuk menyimpan ke database
  const upsertSettings = async (key, value) => {
    if (!value) return;
    const stringValue = String(value);
    try {
      await prisma.globalSetting.upsert({
        where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: key } },
        update: { setting_value: stringValue },
        create: { tenant_id: tenantId, setting_key: key, setting_value: stringValue }
      });
    } catch (err) {
      if (err.code !== 'P2002') throw err; // Ignore unique constraint race conditions
    }
  };

  await upsertSettings('ig_access_token', longLivedToken);

  let pageId = null;
  let igAccountId = null;

  try {
    // 1. Dapatkan Halaman Facebook (Pages) yang dikelola oleh user ini
    const pagesUrl = `https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedToken}`;
    const pagesRes = await axios.get(pagesUrl);
    
    if (pagesRes.data && pagesRes.data.data && pagesRes.data.data.length > 0) {
      // Kita asumsikan Page pertama (Bisa dikembangkan untuk milih Page nantinya)
      pageId = pagesRes.data.data[0].id;
      const pageAccessToken = pagesRes.data.data[0].access_token; // Sebaiknya gunakan page access token untuk reply pesan

      // 2. Dapatkan Instagram Business Account ID dari Page tersebut
      const igUrl = `https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${longLivedToken}`;
      const igRes = await axios.get(igUrl);
      
      if (igRes.data && igRes.data.instagram_business_account) {
        igAccountId = igRes.data.instagram_business_account.id;
      }
      
      // Override ig_access_token menjadi Page Access Token karena itu yang dibutuhkan untuk membalas DM
      longLivedToken = pageAccessToken;
      await upsertSettings('ig_access_token', longLivedToken);
    }
  } catch (err) {
    console.warn('[Instagram] Gagal menarik Page ID / IG Account ID otomatis', err.response?.data || err.message);
  }

  await upsertSettings('ig_page_id', pageId);
  await upsertSettings('ig_account_id', igAccountId);

  return { tokenSaved: true, pageId, igAccountId };
};

/**
 * Handle Direct Instagram Login (OAuth Code Exchange)
 */
export const exchangeInstagramCode = async (tenantId, code, redirectUri) => {
  const appId = process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error('INSTAGRAM_APP_ID dan INSTAGRAM_APP_SECRET belum dikonfigurasi.');
  }

  // 1. Tukar Code dengan Short-Lived Access Token
  const tokenUrl = 'https://api.instagram.com/oauth/access_token';
  const formData = new URLSearchParams();
  formData.append('client_id', appId);
  formData.append('client_secret', appSecret);
  formData.append('grant_type', 'authorization_code');
  formData.append('redirect_uri', redirectUri);
  formData.append('code', code);

  let shortToken = null;
  let userId = null;

  try {
    const tokenRes = await axios.post(tokenUrl, formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    shortToken = tokenRes.data.access_token;
    userId = tokenRes.data.user_id;
  } catch (err) {
    console.error('[Instagram OAuth Error]', err.response?.data || err.message);
    throw new Error('Gagal menukar kode otentikasi dari Instagram.');
  }

  // 2. Tukar dengan Long-Lived Access Token
  let longToken = shortToken;
  try {
    const longTokenUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`;
    const longTokenRes = await axios.get(longTokenUrl);
    if (longTokenRes.data && longTokenRes.data.access_token) {
      longToken = longTokenRes.data.access_token;
    }
  } catch (err) {
    console.warn('[Instagram] Gagal menarik long-lived token', err.response?.data || err.message);
  }

  // 3. Simpan kredensial ke database
  const upsertSettings = async (key, value) => {
    if (!value) return;
    const stringValue = String(value);
    try {
      await prisma.globalSetting.upsert({
        where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: key } },
        update: { setting_value: stringValue },
        create: { tenant_id: tenantId, setting_key: key, setting_value: stringValue }
      });
    } catch (err) {
      if (err.code !== 'P2002') throw err; // Ignore unique constraint race conditions
    }
  };

  await upsertSettings('ig_access_token', longToken);
  await upsertSettings('ig_account_id', userId);

  // 4. Subscribe akun ini ke webhook messages
  // Langkah WAJIB agar Meta mengirim event DM ke webhook kita
  try {
    const subscribeUrl = `https://graph.instagram.com/v19.0/${userId}/subscribed_apps`;
    const subscribeRes = await axios.post(subscribeUrl, null, {
      params: {
        subscribed_fields: 'messages',
        access_token: longToken
      }
    });
    console.log(`[Instagram OAuth] ✓ Webhook subscribed for user ${userId}:`, subscribeRes.data);
  } catch (err) {
    console.error('[Instagram OAuth] ⚠️ Failed to subscribe webhook:', err.response?.data || err.message);
    // Jangan throw — token sudah tersimpan, subscription bisa dicoba ulang nanti
  }

  return { tokenSaved: true, igAccountId: userId };
};

/**
 * Helper: Ambil kredensial Instagram dari database
 */
export const getInstagramCredentials = async (tenantId) => {
  const settings = await prisma.globalSetting.findMany({
    where: { tenant_id: tenantId, setting_key: { in: ['ig_access_token', 'ig_account_id'] } }
  });
  const config = {};
  settings.forEach(s => config[s.setting_key] = s.setting_value);
  
  if (!config.ig_access_token || !config.ig_account_id) {
    throw new Error('Instagram API credentials (token/account_id) tidak lengkap untuk tenant ini.');
  }
  return config;
};

/**
 * Kirim Pesan Teks via Instagram Graph API
 */
export const sendInstagramMessage = async (tenantId, toUserId, message) => {
  const { ig_access_token, ig_account_id } = await getInstagramCredentials(tenantId);

  const payload = {
    recipient: { id: toUserId },
    message: { text: message }
  };

  try {
    const response = await axios.post(`https://graph.facebook.com/v19.0/me/messages`, payload, {
      headers: {
        'Authorization': `Bearer ${ig_access_token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('[Instagram API Error]', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Kirim Media via Instagram Graph API
 */
export const sendInstagramMedia = async (tenantId, toUserId, mediaUrl, caption = '') => {
  const { ig_access_token } = await getInstagramCredentials(tenantId);

  const isPdf = mediaUrl.toLowerCase().endsWith('.pdf');
  const type = isPdf ? 'file' : 'image';

  const payload = {
    recipient: { id: toUserId },
    message: {
      attachment: {
        type: type,
        payload: {
          url: mediaUrl,
          is_reusable: true
        }
      }
    }
  };

  try {
    const response = await axios.post(`https://graph.facebook.com/v19.0/me/messages`, payload, {
      headers: {
        'Authorization': `Bearer ${ig_access_token}`,
        'Content-Type': 'application/json'
      }
    });

    // Instagram API doesn't support caption natively in attachment payload like WhatsApp.
    // If there's a caption, we send it as a follow-up text message.
    if (caption) {
      await sendInstagramMessage(tenantId, toUserId, caption);
    }

    return response.data;
  } catch (error) {
    console.error('[Instagram API Error]', error.response?.data || error.message);
    throw error;
  }
};
