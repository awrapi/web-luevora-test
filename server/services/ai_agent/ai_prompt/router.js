/**
 * ================================================================
 * PROMPT ROUTER — AI-powered module selection for system prompt
 * ================================================================
 * Analyzes user message + chat history + deterministic signals
 * to decide which prompt modules are needed for the AI response.
 *
 * IMPORTANT: Router uses its OWN AI model, separate from the main AI.
 * Configure via env variables:
 *   ROUTER_AI_MODEL     — Model name (default: falls back to OPENAI_MODEL)
 *   ROUTER_AI_BASE_URL  — Base URL (default: falls back to OPENAI_BASE_URL)
 *   ROUTER_AI_API_KEY   — API Key (default: falls back to OPENAI_API_KEY)
 *
 * Approach: SELECTIVE (strict) — only include modules that are clearly needed.
 * Exclusion-first: better to exclude an uncertain module than bloat the prompt.
 * Optimizations: in-memory cache, deterministic ceiling, post-selection ceiling.
 */

import { ChatOpenAI } from '@langchain/openai';
import prisma from '../../../config/database.js';
import { PROMPT_MODULE_IDS } from './index.js';

/**
 * In-memory router cache — avoids redundant AI calls for repeated signal patterns.
 * Key: hash of (signals + message snippet), Value: { modules: string[], ts: number }
 * TTL: 5 minutes per entry.
 */
const routerCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 500;

/**
 * Build a lightweight cache key from deterministic signals + first 80 chars of message.
 */
const buildCacheKey = (userMessage, signals) => {
  const sigHash = [
    signals.hasPackageContext ? 'P' : '',
    signals.hasActiveTransaction ? 'T' : '',
    signals.hasOfferHistory ? 'O' : '',
    signals.hasMedia ? 'M' : '',
    signals.hasBrochures ? 'B' : '',
    signals.hasRequests ? 'R' : '',
    signals.hasCentralInfoPending ? 'C' : '',
    signals.hasActiveOrder ? 'A' : '',
    signals.isBasicPackage ? 'K' : '',
  ].join('');
  const msgSnippet = (userMessage || '').substring(0, 80).toLowerCase().replace(/\s+/g, '_');
  return `${sigHash}:${msgSnippet}`;
};

/**
 * Ceiling threshold — if deterministic signals already force-include this % of all
 * modules, skip the AI call entirely and just load all modules.
 */
const DETERMINISTIC_CEILING_RATIO = 0.90; // 90% = ~12 out of 13 — only force ALL if almost every signal fires
const SELECTIVE_MAX_RATIO = 0.95; // If final selection > 95%, just load all (near-impossible edge case)

/**
 * Parse JSON from AI response content, handling markdown blocks and edge cases.
 */
const parseRouterJson = (content) => {
  if (!content) return null;
  let cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  // Strip <think>...</think> blocks (reasoning models)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {}
  }
  return null;
};

/**
 * Execute AI call using the ROUTER's own model configuration.
 * Supports EdenAI (ROUTER_AI_API_URL) and OpenAI-compatible (ROUTER_AI_BASE_URL).
 * Falls back to main EDENAI or OPENAI env vars if ROUTER_AI vars not set.
 *
 * @param {number} tenantId
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @returns {Promise<Object|null>} Parsed JSON response
 */
const executeRouterAI = async (tenantId, systemPrompt, userMessage, routerModelOverride = null) => {
  const routerApiUrl  = process.env.ROUTER_AI_API_URL;
  const routerApiKey  = process.env.ROUTER_AI_API_KEY;
  const routerModel   = process.env.ROUTER_AI_MODEL;

  // ── Path A: EdenAI-style (ROUTER_AI_API_URL set) ──
  const apiUrl  = routerApiUrl  || process.env.EDENAI_API_URL || null;
  const apiKey  = routerApiKey  || process.env.EDENAI_API_KEY || process.env.OPENAI_API_KEY;
  // Priority: per-tier override → ROUTER_AI_MODEL env → lightweight default
  const model   = routerModelOverride || routerModel || 'google/gemini-2.5-flash-lite';

  if (!apiKey) throw new Error('No API key for Router AI');

  const isEdenStyle = !!(routerApiUrl || process.env.EDENAI_API_URL);

  console.log(`[PromptRouter] 🧠 Using model: ${model} via ${isEdenStyle ? 'EdenAI-style' : 'OpenAI-compat'} (${apiUrl || 'default'})`);

  if (isEdenStyle && apiUrl) {
    // EdenAI-style HTTP fetch
    const payload = {
      model,
      messages: [
        { role: 'system', content: systemPrompt + '\n\nIMPORTANT: Return ONLY valid JSON.' },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json();
    if (!res.ok) throw new Error(`Router AI HTTP ${res.status}: ${JSON.stringify(data)}`);

    let content = data?.choices?.[0]?.message?.content || '{}';
    return parseRouterJson(content);
  }

  // ── Path B: OpenAI-compatible LangChain (ROUTER_AI_BASE_URL or fallback) ──
  let openAIApiKey = routerApiKey || process.env.OPENAI_API_KEY;
  if (tenantId && !routerApiKey) {
    try {
      const aiSetting = await prisma.globalSetting.findUnique({
        where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: 'openai_api_key' } }
      });
      if (aiSetting?.setting_value) openAIApiKey = aiSetting.setting_value;
    } catch {}
  }

  const baseURL = process.env.ROUTER_AI_BASE_URL || process.env.OPENAI_BASE_URL;
  const chatModel = new ChatOpenAI({
    openAIApiKey,
    modelName: model,
    temperature: 0.1,
    maxRetries: 1,
    timeout: 15000,
    maxTokens: 500,
    modelKwargs: { response_format: { type: 'json_object' } },
    configuration: { baseURL },
  });

  const response = await chatModel.invoke([
    ['system', systemPrompt + '\n\nIMPORTANT: Return ONLY valid JSON.'],
    ['human', userMessage],
  ]);

  return parseRouterJson(response.content);
};

/**
 * Route prompt modules based on context analysis.
 *
 * @param {number} tenantId
 * @param {string} userMessage - Current user message
 * @param {string} chatHistorySnippet - Last 3 messages
 * @param {Object} signals - Deterministic signals from handler
 * @param {boolean} signals.hasActiveTransaction - Has unpaid invoices
 * @param {boolean} signals.hasOfferHistory - Has bargaining history
 * @param {boolean} signals.hasMedia - User sent image/media
 * @param {boolean} signals.hasBrochures - Brochures available in context
 * @param {boolean} signals.hasPackageContext - KB context contains packages
 * @param {boolean} signals.hasRequests - Has customer request history
 * @param {boolean} signals.hasCentralInfoPending - Admin instruction pending
 * @param {boolean} signals.hasActiveOrder - Has active order management entry
 * @param {boolean} signals.isBasicPackage - Discussing a basic (non-scheduled) package
 * @returns {Promise<string[]>} Array of module IDs to load
 */
export const routePromptModules = async (tenantId, userMessage, chatHistorySnippet, signals = {}, models = null) => {
  const startTime = Date.now();

  try {
    return await _routePromptModulesInner(tenantId, userMessage, chatHistorySnippet, signals, startTime, models);
  } catch (outerErr) {
    // ── Top-level safety net: any unexpected error returns deterministic-only modules ──
    // This prevents the handler from falling back to ALL modules due to non-AI errors
    // (e.g., DB timeout, network glitch during cache key build, etc.)
    console.error(`[PromptRouter] ⚠️ Top-level safety catch triggered: ${outerErr.message}. Returning deterministic-only modules.`);
    const fallbackForced = new Set();
    if (signals.hasPackageContext) { fallbackForced.add('mod_package_rules'); fallbackForced.add('mod_soft_selling'); fallbackForced.add('mod_serious_intent'); }
    if (signals.hasActiveTransaction) { fallbackForced.add('mod_invoice'); fallbackForced.add('mod_modify_invoice'); fallbackForced.add('mod_cancellation'); }
    if (signals.hasOfferHistory) { fallbackForced.add('mod_negotiation'); }
    if (signals.hasMedia) { fallbackForced.add('mod_payment_proof'); }
    if (signals.hasBrochures) { fallbackForced.add('mod_brochure'); }
    if (signals.hasRequests) { fallbackForced.add('mod_customer_request'); fallbackForced.add('mod_revision'); }
    if (signals.hasCentralInfoPending) { fallbackForced.add('mod_admin_response'); }
    if (signals.hasActiveOrder || signals.isBasicPackage) { fallbackForced.add('mod_basic_date'); }
    const elapsed = Date.now() - startTime;
    console.log(`[PromptRouter] 🛡️ Safety fallback (${elapsed}ms): ${fallbackForced.size}/${PROMPT_MODULE_IDS.length} deterministic modules`);
    return [...fallbackForced];
  }
};

/**
 * Inner routing logic — separated so the outer function can catch ALL errors.
 */
const _routePromptModulesInner = async (tenantId, userMessage, chatHistorySnippet, signals, startTime, models = null) => {
  // ── Step 1: Deterministic force-includes (no AI needed) ──
  // NOTE: Each module is assigned to ONE primary signal to minimize overlap.
  const forced = new Set();

  // Package context → package rules, soft selling, serious intent
  if (signals.hasPackageContext) {
    forced.add('mod_package_rules');
    forced.add('mod_soft_selling');
    forced.add('mod_serious_intent');
  }

  // Active transaction → invoice, modify invoice, cancellation (PRIMARY owner)
  if (signals.hasActiveTransaction) {
    forced.add('mod_invoice');
    forced.add('mod_modify_invoice');
    forced.add('mod_cancellation');
  }

  // Offer history → negotiation only (revision moved to hasRequests)
  if (signals.hasOfferHistory) {
    forced.add('mod_negotiation');
  }

  // Media attached → payment proof
  if (signals.hasMedia) {
    forced.add('mod_payment_proof');
  }

  // Brochures available → brochure rules
  if (signals.hasBrochures) {
    forced.add('mod_brochure');
  }

  // Requests history → customer request + revision (PRIMARY owner)
  if (signals.hasRequests) {
    forced.add('mod_customer_request');
    forced.add('mod_revision');
  }

  // Admin instruction pending → admin response
  if (signals.hasCentralInfoPending) {
    forced.add('mod_admin_response');
  }

  // Active order → basic date only (invoice/cancellation already owned by hasActiveTransaction)
  if (signals.hasActiveOrder) {
    forced.add('mod_basic_date');
  }

  // Basic package specifically → basic date (idempotent, already added by hasActiveOrder)
  if (signals.isBasicPackage) {
    forced.add('mod_basic_date');
  }

  console.log(`[PromptRouter] 🔧 Deterministic force-includes: [${[...forced].join(', ')}] (${forced.size}/${PROMPT_MODULE_IDS.length})`);

  // ── Cache lookup ──
  const cacheKey = buildCacheKey(userMessage, signals);
  const cached = routerCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
    const elapsed = Date.now() - startTime;
    console.log(`[PromptRouter] ⚡ Cache HIT (${elapsed}ms). Returning [${cached.modules.join(', ')}]`);
    return cached.modules;
  }
  // Evict stale entries if cache is full
  if (routerCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = routerCache.keys().next().value;
    routerCache.delete(oldestKey);
  }

  // ── Ceiling check: if deterministic already covers >= 75%, skip AI and load ALL ──
  if (forced.size >= Math.ceil(PROMPT_MODULE_IDS.length * DETERMINISTIC_CEILING_RATIO)) {
    const allModules = [...PROMPT_MODULE_IDS];
    const elapsed = Date.now() - startTime;
    console.log(`[PromptRouter] 🏠 Deterministic ceiling hit (${forced.size}/${PROMPT_MODULE_IDS.length} >= ${Math.round(DETERMINISTIC_CEILING_RATIO * 100)}%). Loading ALL modules, skipping AI (${elapsed}ms)`);
    routerCache.set(cacheKey, { modules: allModules, ts: Date.now() });
    return allModules;
  }

  // ── Step 2: AI-powered routing for uncovered modules only ──
  const uncoveredModules = PROMPT_MODULE_IDS.filter(id => !forced.has(id));

  if (uncoveredModules.length === 0) {
    // All modules already force-included (edge case)
    const result = [...forced];
    const elapsed = Date.now() - startTime;
    console.log(`[PromptRouter] ✅ All modules force-included (${elapsed}ms). Final: [${result.join(', ')}]`);
    routerCache.set(cacheKey, { modules: result, ts: Date.now() });
    return result;
  }

  try {
    const systemPrompt = `Kamu adalah AI router untuk sistem prompt modular. Tugasmu menganalisis pesan customer dan riwayat chat untuk memutuskan modul instruksi TAMBAHAN mana yang STRICTLY DIPERLUKAN.

Modul yang BELUM terpilih dan perlu kamu evaluasi:
${uncoveredModules.map(id => {
  const descriptions = {
    mod_soft_selling: 'Pendekatan soft selling / consultative (HANYA jika ini percakapan awal atau customer baru eksplorasi)',
    mod_invoice: 'Aturan pembuatan invoice (HANYA jika customer JELAS mau beli/bayar SEKARANG)',
    mod_payment_proof: 'Deteksi bukti pembayaran (HANYA jika gambar adalah struk/transfer)',
    mod_negotiation: 'Deteksi tawar-menawar harga (HANYA jika customer menyebut angka tawaran atau minta diskon)',
    mod_brochure: 'Aturan pengiriman brosur/gambar (HANYA jika customer minta dikirimi brosur/gambar/lampiran)',
    mod_package_rules: 'Aturan detail produk/layanan (HANYA jika customer bertanya detail spesifik)',
    mod_customer_request: 'Eskalasi request di luar SOP (HANYA jika customer minta sesuatu yang tidak standar)',
    mod_cancellation: 'Aturan pembatalan (HANYA jika customer menyebut kata batal/cancel/refund)',
    mod_serious_intent: 'Sinyal keseriusan beli (HANYA jika customer bilang mau pesan/deal/transfer)',
    mod_basic_date: 'Request tanggal pelaksanaan/jadwal (HANYA jika customer bahas tanggal/jadwal)',
    mod_modify_invoice: 'Modifikasi invoice (HANYA jika customer minta ubah invoice yang SUDAH ada)',
    mod_revision: 'Revisi request/tawaran (HANYA jika customer minta ubah request sebelumnya)',
    mod_admin_response: 'Handling persetujuan admin (HANYA jika ada instruksi admin pending)',
  };
  return `- "${id}": ${descriptions[id] || id}`;
}).join('\n')}

ATURAN PENTING (SELEKTIF / STRICT):
- HANYA include modul yang JELAS diperlukan berdasarkan pesan customer SEKARANG
- JANGAN include modul yang hanya MUNGKIN berguna — hanya yang PASTI relevan
- Jika ragu apakah modul diperlukan atau tidak → JANGAN include (exclusion-first)
- Modul yang sudah ada di force-include TIDAK PERLU ditambahkan lagi
- Greeting/sapaan sederhana → TIDAK PERLU modul tambahan sama sekali
- Pertanyaan umum tentang produk/layanan → cukup mod_package_rules saja, JANGAN tambahkan yang lain
- Customer bilang "oke" / "siap" / "terima kasih" → kembalikan array kosong

Kembalikan HANYA JSON: { "additionalModules": ["mod_xxx"] }
Jika tidak ada modul tambahan yang STRICTLY diperlukan, kembalikan: { "additionalModules": [] }`;

    const prompt = `Riwayat Chat:\n${chatHistorySnippet || '(tidak ada)'}\n\nPesan Customer Terbaru: ${userMessage}`;

    const result = await executeRouterAI(tenantId, systemPrompt, prompt, models?.routerModel || null);

    if (result && Array.isArray(result.additionalModules)) {
      // Validate module IDs
      const validAdditional = result.additionalModules.filter(id => PROMPT_MODULE_IDS.includes(id));
      validAdditional.forEach(id => forced.add(id));
      console.log(`[PromptRouter] 🤖 AI added modules: [${validAdditional.join(', ')}]`);
    }
  } catch (err) {
    console.error(`[PromptRouter] ⚠️ AI routing failed: ${err.message}. Using deterministic-only.`);
  }

  let finalModules = [...forced];

  // ── Post-selection ceiling: if final > 80%, just load ALL to avoid marginal savings ──
  if (finalModules.length > Math.ceil(PROMPT_MODULE_IDS.length * SELECTIVE_MAX_RATIO)) {
    console.log(`[PromptRouter] 🏠 Post-selection ceiling: ${finalModules.length}/${PROMPT_MODULE_IDS.length} > ${Math.round(SELECTIVE_MAX_RATIO * 100)}%. Upgrading to ALL modules.`);
    finalModules = [...PROMPT_MODULE_IDS];
  }

  const elapsed = Date.now() - startTime;

  // ── Logging ──
  const totalAvailable = PROMPT_MODULE_IDS.length;
  const totalSelected = finalModules.length;
  const reduction = Math.round((1 - totalSelected / totalAvailable) * 100);

  console.log(`[PromptRouter] ✅ Final selection (${elapsed}ms): ${totalSelected}/${totalAvailable} modules (${reduction}% reduction)`);
  console.log(`[PromptRouter] 📋 Selected modules: [${finalModules.join(', ')}]`);
  console.log(`[PromptRouter] 🚫 Excluded modules: [${PROMPT_MODULE_IDS.filter(id => !forced.has(id)).join(', ')}]`);

  // ── Cache the result ──
  routerCache.set(cacheKey, { modules: finalModules, ts: Date.now() });

  return finalModules;
};

/**
 * Warmup ping to EdenAI on server startup.
 * Prevents cold-start failures on the first router AI call.
 * Non-blocking — fires and forgets.
 */
export const warmupRouterAI = async () => {
  const apiUrl = process.env.ROUTER_AI_API_URL || process.env.EDENAI_API_URL;
  const apiKey = process.env.ROUTER_AI_API_KEY || process.env.EDENAI_API_KEY || process.env.OPENAI_API_KEY;
  const model  = process.env.ROUTER_AI_MODEL || 'google/gemini-2.5-flash-lite';

  if (!apiUrl || !apiKey) {
    console.log('[PromptRouter] ⏭️ Warmup skipped — no API URL/key configured');
    return;
  }

  try {
    console.log(`[PromptRouter] 🔥 Warmup ping to EdenAI (model: ${model})...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: '{"additionalModules":[]}' }],
        max_tokens: 10,
        temperature: 0,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      console.log(`[PromptRouter] ✅ Warmup OK (${res.status})`);
    } else {
      console.warn(`[PromptRouter] ⚠️ Warmup returned ${res.status} — first request may still work`);
    }
  } catch (err) {
    console.warn(`[PromptRouter] ⚠️ Warmup failed: ${err.message} — non-blocking, first request may retry`);
  }
};

export default { routePromptModules, warmupRouterAI };

