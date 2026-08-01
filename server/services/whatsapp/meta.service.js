import axios from 'axios';
import prisma from '../../config/database.js';
import { normalizePhone } from '../shared/webhook.service.js';

/**
 * Handle Meta OAuth (Embedded Signup) Token Exchange
 */
export const handleMetaAuth = async (tenantId, shortLivedToken) => {
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
    console.warn('[Meta] Failed to exchange for long-lived token', err.response?.data || err.message);
  }

  // Helper untuk menyimpan ke database
  const upsertSettings = async (key, value) => {
    if (!value) return;
    await prisma.globalSetting.upsert({
      where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: key } },
      update: { setting_value: value },
      create: { tenant_id: tenantId, setting_key: key, setting_value: value }
    });
  };

  await upsertSettings('meta_access_token', longLivedToken);

  let wabaId = null;
  let phoneId = null;

  try {
    // 1. Dapatkan WABA ID menggunakan debug_token endpoint
    const appAccessToken = `${appId}|${appSecret}`;
    const debugUrl = `https://graph.facebook.com/v19.0/debug_token?input_token=${longLivedToken}&access_token=${appAccessToken}`;
    const debugRes = await axios.get(debugUrl);
    
    const granularScopes = debugRes.data?.data?.granular_scopes || [];
    const whatsappScope = granularScopes.find(s => s.scope === 'whatsapp_business_management' || s.scope === 'whatsapp_business_messaging');
    
    if (whatsappScope && whatsappScope.target_ids && whatsappScope.target_ids.length > 0) {
      wabaId = whatsappScope.target_ids[0]; // Ambil WABA pertama yang diotorisasi
      
      // 2. Dapatkan Phone ID menggunakan WABA ID tersebut
      const phoneUrl = `https://graph.facebook.com/v19.0/${wabaId}/phone_numbers?access_token=${longLivedToken}`;
      const phoneRes = await axios.get(phoneUrl);
      
      if (phoneRes.data?.data && phoneRes.data.data.length > 0) {
        phoneId = phoneRes.data.data[0].id; // Ambil nomor pertama
      }
    }
  } catch (err) {
    console.warn('[Meta] Gagal menarik WABA / Phone ID otomatis', err.response?.data || err.message);
  }

  await upsertSettings('meta_waba_id', wabaId);
  await upsertSettings('meta_phone_id', phoneId);

  return { tokenSaved: true, wabaId, phoneId };
};

/**
 * Helper: Ambil kredensial Meta dari database
 */
const getMetaCredentials = async (tenantId) => {
  const settings = await prisma.globalSetting.findMany({
    where: { tenant_id: tenantId, setting_key: { in: ['meta_access_token', 'meta_phone_id'] } }
  });
  const config = {};
  settings.forEach(s => config[s.setting_key] = s.setting_value);
  
  // Gunakan fallback ke .env jika ID belum sempat disimpan ke database
  config.meta_phone_id = config.meta_phone_id || process.env.META_PHONE_ID;
  
  if (!config.meta_access_token || !config.meta_phone_id) {
    throw new Error('Meta API credentials (token/phone_id) tidak lengkap untuk tenant ini.');
  }
  return config;
};

/**
 * Kirim Pesan Teks via Meta Cloud API
 */
export const sendMetaMessage = async (tenantId, toPhone, message) => {
  const { meta_access_token, meta_phone_id } = await getMetaCredentials(tenantId);
  const to = normalizePhone(toPhone);

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'text',
    text: {
      preview_url: true,
      body: message
    }
  };

  try {
    const response = await axios.post(`https://graph.facebook.com/v19.0/${meta_phone_id}/messages`, payload, {
      headers: {
        'Authorization': `Bearer ${meta_access_token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('[Meta API Error]', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Kirim Media via Meta Cloud API
 */
export const sendMetaMedia = async (tenantId, toPhone, mediaUrl, caption = '', filename = '') => {
  const { meta_access_token, meta_phone_id } = await getMetaCredentials(tenantId);
  const to = normalizePhone(toPhone);

  // Deteksi tipe media dari ekstensi & URL pattern
  const urlLower = mediaUrl.toLowerCase();
  const filenameLower = filename.toLowerCase();

  // Image extensions
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
  // Document extensions
  const docExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];

  const hasImageExt = imageExts.some(ext => urlLower.endsWith(ext) || filenameLower.endsWith(ext));
  const hasDocExt = docExts.some(ext => urlLower.endsWith(ext) || filenameLower.endsWith(ext));

  // Cloudinary /image/upload/ → image, /raw/upload/ → document (no extension = treat as document)
  const isCloudinaryImage = urlLower.includes('/image/upload/');
  const isCloudinaryRaw = urlLower.includes('/raw/upload/');

  let type;
  if (hasDocExt) {
    type = 'document';
  } else if (hasImageExt || isCloudinaryImage) {
    type = 'image';
  } else if (isCloudinaryRaw) {
    // Raw Cloudinary files are typically PDFs/documents uploaded without transformation
    type = 'document';
  } else {
    // Fallback: if no clue, default to document (safer than image — WA will show as downloadable file)
    type = 'document';
  }

  // Resolve effective filename:
  // Priority: (1) explicitly passed filename, (2) extract from URL path, (3) 'file.pdf' last resort
  let effectiveFilename = filename;
  if (!effectiveFilename && type === 'document') {
    try {
      // Ambil nama file dari segment terakhir URL (support Cloudinary & path lokal)
      // Contoh: https://res.cloudinary.com/.../raw/upload/v123/Brosur_Bali.pdf → Brosur_Bali.pdf
      const urlPath = new URL(mediaUrl.startsWith('http') ? mediaUrl : `https://placeholder.com${mediaUrl}`).pathname;
      const rawSegment = urlPath.split('/').filter(Boolean).pop() || '';
      // Decode URL encoding (misal %20 → spasi) dan ambil bagian sebelum tanda tanya
      const decoded = decodeURIComponent(rawSegment.split('?')[0]);
      if (decoded && decoded.length > 0 && decoded !== 'upload') {
        effectiveFilename = decoded;
      }
    } catch (e) { /* ignore URL parse error */ }
    // Last resort fallback
    if (!effectiveFilename) effectiveFilename = 'dokumen.pdf';
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: type,
    [type]: {
      link: mediaUrl,
      caption: caption,
      ...(type === 'document' && effectiveFilename ? { filename: effectiveFilename } : {})
    }
  };

  try {
    const response = await axios.post(`https://graph.facebook.com/v19.0/${meta_phone_id}/messages`, payload, {
      headers: {
        'Authorization': `Bearer ${meta_access_token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('[Meta API Error]', error.response?.data || error.message);
    throw error;
  }
};
