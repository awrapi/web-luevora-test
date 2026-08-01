import { Bot, InputFile } from 'grammy';
import prisma from '../../config/database.js';
import { processIncomingWebhook } from '../shared/webhook.service.js';

/**
 * Cache for active bot instances.
 * Key: tenant_id
 */
const botInstances = {};

/**
 * Get or initialize a Telegram Bot instance for a tenant.
 * Uses grammY (replacement for deprecated node-telegram-bot-api)
 */
export const getTelegramBot = async (tenantId) => {
  if (botInstances[tenantId]) {
    return botInstances[tenantId];
  }

  const account = await prisma.telegramAccount.findUnique({
    where: { tenant_id: tenantId }
  });

  if (!account || !account.bot_token || account.is_active !== 1) {
    throw new Error(`Telegram account not configured or inactive for tenant ${tenantId}`);
  }

  // Initialize bot (grammY doesn't have polling by default unless bot.start() is called)
  const bot = new Bot(account.bot_token);
  botInstances[tenantId] = bot;

  // Handle incoming messages in case we are using long-polling
  bot.on('message', async (ctx) => {
    // Reconstruct the payload to match what handleTelegramWebhook expects (Update object)
    const reqBody = { message: ctx.update.message };
    try {
      await handleTelegramWebhook(tenantId, reqBody);
    } catch (err) {
      console.error(`[Telegram] Error handling polled message for tenant ${tenantId}:`, err.message);
    }
  });

  // If there's no public URL or it's localhost, fallback to Long Polling automatically
  if (!process.env.PUBLIC_URL || process.env.PUBLIC_URL.includes('localhost') || process.env.PUBLIC_URL.includes('127.0.0.1')) {
    bot.start({
      onStart: (botInfo) => {
        console.log(`[Telegram] Long Polling started for @${botInfo.username} (Tenant: ${tenantId})`);
      }
    }).catch(e => console.error(`[Telegram] Polling error for tenant ${tenantId}:`, e.message));
  } else {
    // If we have a public URL, setup webhook with delete-first + retry strategy
    const webhookUrl = `${process.env.PUBLIC_URL}/api/telegram/webhook/${tenantId}`;
    const setWithRetry = async (retries = 3, delayMs = 2000) => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const currentWebhook = await bot.api.getWebhookInfo();
          if (currentWebhook.url === webhookUrl) {
            console.log(`[Telegram] Webhook is already correctly set to ${webhookUrl} for tenant ${tenantId}`);
            return;
          }

          // Always delete stale webhook first to prevent ghost state
          await bot.api.deleteWebhook({ drop_pending_updates: false });
          await bot.api.setWebhook(webhookUrl);
          console.log(`[Telegram] Webhook successfully updated to ${webhookUrl} for tenant ${tenantId} (attempt ${attempt})`);
          return;
        } catch (e) {
          console.warn(`[Telegram] Webhook attempt ${attempt}/${retries} failed for tenant ${tenantId}: ${e.message}`);
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, delayMs * attempt));
          } else {
            console.error(`[Telegram] All ${retries} webhook attempts failed for tenant ${tenantId}. Bot will not receive Telegram messages until webhook is set manually.`);
          }
        }
      }
    };
    setWithRetry();
  }

  return bot;
};

/**
 * Initialize all active Telegram bots on server startup.
 */
export const initializeTelegramBots = async () => {
  try {
    const accounts = await prisma.telegramAccount.findMany({
      where: { is_active: 1 }
    });
    for (const account of accounts) {
      await getTelegramBot(account.tenant_id).catch(e => console.error(`[Telegram] Failed to init bot for tenant ${account.tenant_id}:`, e.message));
    }
    if (accounts.length > 0) {
      console.log(`[Telegram] Initialized ${accounts.length} active bot(s).`);
    }
  } catch (error) {
    console.error('[Telegram] Error initializing bots:', error.message);
  }
};

/**
 * Set up webhook for a specific tenant.
 * The webhook URL should be the Cloudflare tunnel URL pointing to the tenant's webhook route.
 */
export const setupWebhook = async (tenantId, webhookUrl) => {
  const bot = await getTelegramBot(tenantId);
  // Only set webhook if we actually want webhooks (not local)
  if (webhookUrl && !webhookUrl.includes('localhost') && !webhookUrl.includes('127.0.0.1')) {
    await bot.api.deleteWebhook({ drop_pending_updates: false });
    await bot.api.setWebhook(webhookUrl);
    console.log(`[Telegram] Webhook set to ${webhookUrl} for tenant ${tenantId}`);
  }
};

/**
 * Helper: Get public download URL for a file by its file_id.
 * Equivalent to old bot.getFileLink(fileId)
 */
const getFileUrl = async (bot, fileId) => {
  const file = await bot.api.getFile(fileId);
  // bot.token is the token string in grammY
  return `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
};

/**
 * Handle incoming webhook payload from Telegram.
 */
export const handleTelegramWebhook = async (tenantId, reqBody) => {
  // Telegram sends Update objects. We care about 'message' and 'edited_message'
  const isEdit = !!reqBody.edited_message;
  const msg = reqBody.message || reqBody.edited_message;
  
  if (msg) {
    const chatId = msg.chat.id.toString();
    const text = msg.text || msg.caption || '';
    const messageId = msg.message_id ? msg.message_id.toString() : null;
    
    // Fallback names
    const firstName = msg.from.first_name || '';
    const lastName = msg.from.last_name ? ` ${msg.from.last_name}` : '';
    const profileName = `${firstName}${lastName}`.trim() || chatId;

    // Default to text
    let mediaUrl = null;
    let audioUrl = null;
    let isVoiceNote = false;

    const bot = await getTelegramBot(tenantId);

    // Handle incoming photos
    if (msg.photo && msg.photo.length > 0) {
      // Photo is an array of different sizes. Grab the largest one.
      const largestPhoto = msg.photo[msg.photo.length - 1];
      mediaUrl = await getFileUrl(bot, largestPhoto.file_id);
    }

    // Handle document/pdf
    if (msg.document) {
      mediaUrl = await getFileUrl(bot, msg.document.file_id);
    }

    // Handle voice notes
    if (msg.voice) {
      audioUrl = await getFileUrl(bot, msg.voice.file_id);
      isVoiceNote = true;
    }

    console.log(`[Telegram] Received message from ${chatId} (Tenant: ${tenantId})`);

    // Pass to central webhook pipeline
    await processIncomingWebhook({
      tenantId,
      userPhone: chatId, // We use Chat ID as the unique phone equivalent
      userMessage: text,
      profileName,
      provider: 'telegram',
      mediaUrl,
      audioUrl,
      isVoiceNote,
      providerMsgId: messageId,
      isEdit: isEdit
    });

    // ── Fetch & store Telegram profile photo (best-effort, non-blocking) ──
    // Only fetch if the user has a profile photo (indicated by msg.from.id being present)
    if (msg.from && msg.from.id) {
      setImmediate(async () => {
        try {
          const userId = msg.from.id;
          const photos = await bot.api.getUserProfilePhotos(userId, { limit: 1 });
          if (photos && photos.total_count > 0 && photos.photos.length > 0) {
            // Grab the largest size of the first photo
            const photoSizes = photos.photos[0];
            const largest = photoSizes[photoSizes.length - 1];
            const photoUrl = await getFileUrl(bot, largest.file_id);
            // Update lead's profile_photo_url
            const lead = await prisma.lead.findUnique({
              where: { uk_tenant_phone: { tenant_id: tenantId, phone: chatId } }
            });
            if (lead && photoUrl && photoUrl !== lead.profile_photo_url) {
              await prisma.lead.update({
                where: { id: lead.id },
                data: { profile_photo_url: photoUrl }
              });
              console.log(`[Telegram] Saved profile photo for chat ${chatId}`);
            }
          }
        } catch (photoErr) {
          // Non-critical — silently log
          console.warn(`[Telegram] Could not fetch profile photo for chat ${chatId}: ${photoErr.message}`);
        }
      });
    }
  }

  return { ok: true };
};

/**
 * Send text message via Telegram.
 * grammY equivalent of bot.sendMessage()
 * Includes automatic plain-text fallback when Markdown parsing fails.
 */
export const sendTelegramMessage = async (tenantId, chatId, message) => {
  const bot = await getTelegramBot(tenantId);
  try {
    const result = await bot.api.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    return result;
  } catch (error) {
    // If Telegram rejects due to broken Markdown entities, retry as plain text
    if (error.message && error.message.includes("can't parse")) {
      console.warn('[Telegram API] Markdown parse failed, stripping formatting and retrying as plain text...');
      try {
        const plainText = message
          .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold** → bold
          .replace(/\*(.+?)\*/g, '$1')         // *bold* → bold
          .replace(/_(.+?)_/g, '$1')           // _italic_ → italic
          .replace(/~(.+?)~/g, '$1')           // ~strikethrough~ → strikethrough
          .replace(/`(.+?)`/g, '$1')           // `code` → code
          .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, '')) // code blocks
          .replace(/\[(.+?)\]\(.+?\)/g, '$1'); // [link](url) → link
        const result = await bot.api.sendMessage(chatId, plainText);
        console.log('[Telegram API] Plain-text fallback succeeded.');
        return result;
      } catch (plainError) {
        console.error('[Telegram API Error] Plain-text fallback also failed:', plainError.message);
        throw plainError;
      }
    }
    console.error('[Telegram API Error]', error.message);
    throw error;
  }
};

export const sendTelegramMedia = async (tenantId, chatId, message, mediaUrl) => {
  const bot = await getTelegramBot(tenantId);
  try {
    // Detect type based on URL (simplistic check)
    const isPdf = mediaUrl.toLowerCase().endsWith('.pdf');
    
    // Fetch file to buffer to avoid Telegram "failed to get HTTP URL content" error
    const response = await fetch(mediaUrl);
    if (!response.ok) throw new Error(`Failed to download media: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let filename = isPdf ? 'document.pdf' : 'image.jpg';
    const urlParts = mediaUrl.split('/');
    if (urlParts.length > 0) {
       const lastPart = urlParts[urlParts.length - 1];
       if (lastPart.includes('.')) filename = lastPart.split('?')[0];
    }
    
    const inputFile = new InputFile(buffer, filename);

    if (isPdf) {
      return await bot.api.sendDocument(chatId, inputFile, { caption: message });
    } else {
      return await bot.api.sendPhoto(chatId, inputFile, { caption: message });
    }
  } catch (error) {
    console.error('[Telegram API Error]', error.message);
    throw error;
  }
};
