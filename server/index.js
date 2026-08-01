import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.middleware.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { processIncomingWebhook } from './services/shared/webhook.service.js';
import { processIncomingChat } from './services/ai_agent/handler.service.js';
import { processLifecycle } from './services/shared/transaction.service.js';
import { startAiChatWorker } from './workers/aiChatWorker.js';
import { processExpiredTimers } from './services/ai_agent/ghostTimer.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fix for BigInt serialization (Prisma raw queries return BigInt)
BigInt.prototype.toJSON = function() {
  return this.toString();
};



const app = express();

// Trust proxy configuration for production (Nginx/Cloudflare)
// This ensures that express-rate-limit reads the actual client IP, not the proxy's IP.
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// API Routes
app.use('/api', routes);

// Static file serving for uploads (PDFs, images, media)
// Serve both server-local uploads (invoices, receipts, wa_media) and project-root uploads (package-media, kb-media)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// RAG Playground test page
app.get('/test-rag', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test-rag.html'));
});

app.post('/api/dev/test-chat', async (req, res) => {
  try {
    const { tenantId = 11, userPhone = '6283811221775', userMessage, chatType = 'sales' } = req.body;
    
    if (!userMessage) {
      return res.status(400).json({ error: 'userMessage is required' });
    }

    const result = await processIncomingChat({
      tenantId: parseInt(tenantId),
      userPhone,
      userMessage,
      chatType
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Endpoint untuk tes performa/validitas API AI secara murni (tanpa RAG/Database CRM)
app.post('/api/dev/test-raw-model', async (req, res) => {
  try {
    const { messages, systemPrompt } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const useEdenAI = process.env.USE_EDENAI === 'true';
    const startTime = Date.now();
    let reply = '';

    const finalMessages = [];
    if (systemPrompt) finalMessages.push({ role: 'system', content: systemPrompt });
    finalMessages.push(...messages);

    if (useEdenAI) {
      const apiUrl = process.env.EDENAI_API_URL || 'https://api.edenai.run/v3/chat/completions';
      const apiKey = process.env.EDENAI_API_KEY;
      const model = process.env.EDENAI_MODEL || 'openai/gpt-4o-mini';

      if (!apiKey) throw new Error('EDENAI_API_KEY is missing in .env');

      const payload = {
        model: model,
        messages: finalMessages,
        temperature: 0.7,
        max_tokens: 2000
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || data.detail || JSON.stringify(data));
      }

      reply = data?.choices?.[0]?.message?.content || '[Tidak ada teks balasan]';
    } else {
      // Menggunakan Langchain OpenAI asli (jika disetting di .env)
      const { ChatOpenAI } = await import('@langchain/openai');
      const chatModel = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.7,
        configuration: { baseURL: process.env.OPENAI_BASE_URL }
      });

      const lcMessages = finalMessages.map(m => [m.role, m.content]);
      const response = await chatModel.invoke(lcMessages);
      reply = response.content;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    res.json({
      success: true,
      data: {
        reply,
        duration,
        provider: useEdenAI ? 'EDEN_AI / CUSTOM URL' : 'OPENAI DIRECT',
        model: useEdenAI ? process.env.EDENAI_MODEL : process.env.OPENAI_MODEL
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Error handling
app.use(errorHandler);


// Import Prisma
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

app.get('/api/dev/users', async (req, res) => {
  const users = await prisma.user.findMany({ select: { id: true, name: true, tenant_id: true } });
  res.json(users);
});

app.get('/api/dev/reset-sarah', async (req, res) => {
  try {
    const tenantId = 16; // Hardcoded for Sarah Travel

    const tablesToClear = [
      'CustomerInteractionLog',
      'CentralInfoRequest',
      'OrderForm',
      'CustomerCrmHistory',
      'Offer',
      'EmailMessage',
      'Invoice',
      'RefundRequest',
      'CmChat',
      'CmRequestItem',
      'CustomerManagement',
      'CustomerRequest',
      'TravelBooking',
      'ActiveRental',
      'RentalRequest',
      'CustomerServiceLabel',
      'CustomerStat',
      'RescheduleRequest',
      'DateRequest',
      'CustomerSchedule',
      'ScheduleFollowupQueue',
      'ScheduleContact',
      'ModeChangeLog',
      'MessageQueue',
      'ChatHistory',
      'Transaction',
      'Lead',
      'AiCreditUsageLog'
    ];

    for (const table of tablesToClear) {
      if (prisma[table]) {
        await prisma[table].deleteMany({ where: { tenant_id: tenantId } });
      }
    }

    await prisma.tenantAiCredit.update({
      where: { tenant_id: tenantId },
      data: {
        credits_used: 0,
        credit_limit: 700,
        rate_dollar_per_credit: 0.00056,
        is_active: 1
      }
    });

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscription_plan: 'free',
        subscription_status: 'expired'
      }
    });

    res.json({ success: true, message: "Cleared Sarah Travel data" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

import { initializeTelegramBots } from './services/telegram/telegram.service.js';
import { warmupRouterAI } from './services/ai_agent/ai_prompt/router.js';
import { syncAllTenantsCredits } from './services/ai_agent/credit.service.js';
import { expireSubscriptions } from './services/shared/subscription.service.js';

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[Server] Luevora Backend running on http://127.0.0.1:${PORT}`);
  console.log(`[Server] Webhook is active and waiting for messages.`);
  
  // Warmup EdenAI connection for prompt router (prevents cold-start failures)
  warmupRouterAI(); // non-blocking fire-and-forget
  
  // Initialize Telegram bots (starts polling if running locally)
  await initializeTelegramBots();
  
  // Start Background Workers
  startAiChatWorker();

  // Start Transaction Lifecycle Cron
  setInterval(() => {
    processLifecycle().catch(err => console.error('[Cron] processLifecycle error:', err));
  }, 15 * 60 * 1000); // every 15 minutes

  // Start Ghost/Idle Timer Cron — transition at_risk leads to idle/ghosted
  setInterval(() => {
    processExpiredTimers().catch(err => console.error('[Cron] processExpiredTimers error:', err));
  }, 5 * 60 * 1000); // every 5 minutes

  // Start AI Credit Sync Cron — reconcile all tenants with EdenAI usage
  setInterval(() => {
    syncAllTenantsCredits().catch(err => console.error('[Cron] syncAllTenantsCredits error:', err));
  }, 5 * 60 * 1000); // every 5 minutes

  // Start Subscription Expiry Cron — downgrade expired tenants back to free plan
  setInterval(() => {
    expireSubscriptions().catch(err => console.error('[Cron] expireSubscriptions error:', err));
  }, 60 * 60 * 1000); // every 1 hour
  // Run once immediately on startup to catch any already-expired tenants
  expireSubscriptions().catch(err => console.error('[Cron] expireSubscriptions (startup) error:', err));
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\n[Server] Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGUSR2', shutdown);

// Prevent crash loop from unhandled rejections / uncaught exceptions
// Log the error but keep the process alive. PM2 will still see the logs.
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] UNHANDLED REJECTION (not crashing):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Process] UNCAUGHT EXCEPTION (not crashing):', err.stack || err.message);
  // Only exit for truly catastrophic errors (e.g. OOM), not for AI/API failures
  if (err.message && (err.message.includes('ENOMEM') || err.message.includes('heap'))) {
    process.exit(1);
  }
});
