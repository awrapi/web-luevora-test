import { sendZernioMessage, sendZernioMedia } from '../zernio/zernio.service.js';
import { sendTelegramMessage as callTelegramMessage, sendTelegramMedia as callTelegramMedia } from '../telegram/telegram.service.js';

/**
 * Retry a send function with exponential backoff.
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Max number of retries (default: 2)
 * @param {number} baseDelayMs - Base delay in ms (default: 1500)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
const retryWithBackoff = async (fn, maxRetries = 2, baseDelayMs = 1500) => {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await fn();
      return { success: true };
    } catch (err) {
      lastError = err.message;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.warn(`[Messaging] Send attempt ${attempt + 1} failed: ${err.message}. Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  return { success: false, error: lastError };
};

/**
 * Send a text message to a phone number.
 * Automatically routes to Zernio (WhatsApp/Instagram) or Telegram based on Lead channel.
 * Includes automatic retry (2 attempts) and queue fallback on failure.
 */
export const sendText = async (db, phone, message, options = {}) => {
  const tenantId = options.tenantId;
  
  if (!tenantId) {
    throw new Error('Tenant ID is required to send messages');
  }

  // 1. Determine Channel by looking up the Lead
  let channel = 'whatsapp';
  let activePhone = phone;
  let zernioConversationId = null;
  try {
    const lead = await db.lead.findUnique({
      where: { uk_tenant_phone: { tenant_id: tenantId, phone: phone } },
      select: { channel: true, platform_ids: true }
    });
    if (lead && lead.channel) {
      channel = lead.channel;
      // If it's not whatsapp, check if we have an alias ID in platform_ids
      if (lead.platform_ids) {
        try {
          const pIds = JSON.parse(lead.platform_ids);
          if (channel !== 'whatsapp' && pIds[channel]) {
            activePhone = pIds[channel];
          }
          if (pIds.zernio_conversation_id) {
            zernioConversationId = pIds.zernio_conversation_id;
          }
        } catch(e) {}
      }
    }
  } catch (err) {
    console.warn('[Messaging] Failed to lookup channel for lead, defaulting to whatsapp');
  }

  // 2. Route message to respective API with retry
  if (channel === 'telegram') {
    const retryResult = await retryWithBackoff(() => callTelegramMessage(tenantId, activePhone, message));
    if (retryResult.success) {
      return { status: true, via: 'telegram', message: 'Sent via Telegram API' };
    }
    console.error('[Messaging] Telegram send text failed after retries:', retryResult.error);
    return await queueMessage(db, 'default', phone, message, tenantId);
  } else if (channel === 'instagram') {
    const retryResult = await retryWithBackoff(() => sendZernioMessage(tenantId, 'instagram', activePhone, message, zernioConversationId));
    if (retryResult.success) {
      return { status: true, via: 'zernio_instagram', message: 'Sent via Zernio (Instagram)' };
    }
    console.error('[Messaging] Zernio Instagram send text failed after retries:', retryResult.error);
    return await queueMessage(db, 'default', phone, message, tenantId);
  } else {
    // Default to WhatsApp via Zernio
    const retryResult = await retryWithBackoff(() => sendZernioMessage(tenantId, 'whatsapp', activePhone, message, zernioConversationId));
    if (retryResult.success) {
      return { status: true, via: 'zernio_whatsapp', message: 'Sent via Zernio (WhatsApp)' };
    }
    console.error('[Messaging] Zernio WhatsApp send text failed after retries:', retryResult.error);
    return await queueMessage(db, 'default', phone, message, tenantId);
  }
};

/**
 * Queue a message for delivery via message queue.
 */
export const queueMessage = async (db, sessionId, phone, message, tenantId) => {
  console.log(`[Messaging] Queuing message to ${phone}`);
  await db.messageQueue.create({
    data: {
      tenant_id: tenantId,
      session_id: sessionId,
      target: phone,
      message: message,
      status: 'pending',
    }
  });
  return { status: true, via: 'queue', message: 'Queued for delivery' };
};

/**
 * Send media to a phone number.
 * Automatically routes to Zernio (WhatsApp/Instagram) or Telegram based on Lead channel.
 */
export const sendMedia = async (db, phone, message, mediaUrl, options = {}) => {
  const tenantId = options.tenantId;

  if (!tenantId) {
    throw new Error('Tenant ID is required to send media');
  }

  // 1. Determine Channel
  let channel = 'whatsapp';
  let activePhone = phone;
  let zernioConversationId = null;
  try {
    const lead = await db.lead.findUnique({
      where: { uk_tenant_phone: { tenant_id: tenantId, phone: phone } },
      select: { channel: true, platform_ids: true }
    });
    if (lead && lead.channel) {
      channel = lead.channel;
      // If it's not whatsapp, check if we have an alias ID in platform_ids
      if (lead.platform_ids) {
        try {
          const pIds = JSON.parse(lead.platform_ids);
          if (channel !== 'whatsapp' && pIds[channel]) {
            activePhone = pIds[channel];
          }
          if (pIds.zernio_conversation_id) {
            zernioConversationId = pIds.zernio_conversation_id;
          }
        } catch(e) {}
      }
    }
  } catch (err) {
    console.warn('[Messaging] Failed to lookup channel for lead, defaulting to whatsapp');
  }

  // 2. Route media to respective API
  if (channel === 'telegram') {
    try {
      await callTelegramMedia(tenantId, activePhone, message, mediaUrl);
      return { status: true, via: 'telegram', message: 'Sent media via Telegram API' };
    } catch (err) {
      console.error('[Messaging] Telegram media send failed:', err.message);
      return { status: false, error: err.message };
    }
  } else if (channel === 'instagram') {
    try {
      await sendZernioMedia(tenantId, 'instagram', activePhone, mediaUrl, message, zernioConversationId);
      return { status: true, via: 'zernio_instagram', message: 'Sent media via Zernio (Instagram)' };
    } catch (err) {
      console.error('[Messaging] Zernio Instagram media send failed:', err.message);
      return { status: false, error: err.message };
    }
  } else {
    // Default to WhatsApp via Zernio
    try {
      await sendZernioMedia(tenantId, 'whatsapp', activePhone, mediaUrl, message, zernioConversationId);
      return { status: true, via: 'zernio_whatsapp', message: 'Sent media via Zernio (WhatsApp)' };
    } catch (err) {
      console.error('[Messaging] Zernio WhatsApp media send failed:', err.message);
      return { status: false, error: err.message };
    }
  }
};

export default { sendText, queueMessage, sendMedia };
