import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { HumanMessage } from '@langchain/core/messages';
import prisma from '../../config/database.js';
import { executeLangchainWithTools, edenAiToolsSchema } from './toolExecutor.service.js';
import { activeAITools } from './tools.service.js';
import { assemblePrompt, assembleFullPrompt, PROMPT_MODULE_IDS } from './ai_prompt/index.js';
import { recordUsage } from './credit.service.js';
import { getModelsForPlan } from '../../config/subscriptionModels.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Cached tenant plan resolver ──
// Menghindari DB lookup berulang setiap AI call untuk tenant yang sama.
const _tenantPlanCache = new Map();
const _getModelForTenant = async (tenantId, role = 'mainModel') => {
  if (!tenantId) return getModelsForPlan('lite')[role];
  let plan = _tenantPlanCache.get(tenantId);
  if (!plan) {
    try {
      const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { subscription_plan: true } });
      plan = t?.subscription_plan || 'lite';
    } catch { plan = 'lite'; }
    _tenantPlanCache.set(tenantId, plan);
    setTimeout(() => _tenantPlanCache.delete(tenantId), 5 * 60_000); // cache 5 menit
  }
  return getModelsForPlan(plan)[role];
};

// Token estimation for non-EdenAI paths (no cost data from API)
// Approximate: 1 token ≈ 4 chars. Rates based on gpt-4o-mini pricing.
const OPENAI_RATE_INPUT  = 0.00000015; // $0.15 per 1M input tokens
const OPENAI_RATE_OUTPUT = 0.0000006;  // $0.60 per 1M output tokens
const estimateOpenAICost = (promptText, responseText) => {
  const inputTokens  = Math.ceil((promptText || '').length / 4);
  const outputTokens = Math.ceil((responseText || '').length / 4);
  const cost = (inputTokens * OPENAI_RATE_INPUT) + (outputTokens * OPENAI_RATE_OUTPUT);
  return { cost, inputTokens, outputTokens };
};

const parseJsonResponse = (content) => {
  if (!content) return {};
  if (typeof content === 'object') return content;

  let cleaned = String(content).replace(/```json/gi, '').replace(/```/g, '').trim();
  
  // Handle models that prefix JSON with non-JSON text (e.g. "null{...}" or "OK {...}" or "Here is the JSON: {...}")
  // Strategy: find the first '{' or '[' and try parsing from there
  try {
    return JSON.parse(cleaned);
  } catch (_firstErr) {
    // Try extracting JSON object or array from the response
    for (const opener of ['{', '[']) {
      const closer = opener === '{' ? '}' : ']';
      const start = cleaned.indexOf(opener);
      const end = cleaned.lastIndexOf(closer);
      if (start !== -1 && end > start) {
        try {
          return JSON.parse(cleaned.slice(start, end + 1));
        } catch (_e) {
          // continue trying
        }
      }
    }
    // Last resort: try to clean up common model artifacts
    // Remove "null", "undefined", "None" prefixes
    cleaned = cleaned.replace(/^(null|undefined|None|OK|Here is the JSON:?|Here is the result:?)\s*/i, '');
    try {
      return JSON.parse(cleaned);
    } catch (_finalErr) {
      console.warn('[parseJsonResponse] Could not parse as JSON, returning empty object. Input:', cleaned.substring(0, 100));
      return {};
    }
  }
};

/**
 * Get image as base64 from either:
 * - A remote URL (Twilio, etc.) → fetch with optional Basic Auth
 * - A local file path (WaWeb uploads)
 * Returns { base64, mimeType } or null on failure.
 */
const getImageBase64 = async (mediaUrl) => {
  if (!mediaUrl) return null;

  try {
    // Remote URL (Twilio or any https:// URL)
    if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
      const headers = {};

      const res = await fetch(mediaUrl, { headers });
      if (!res.ok) {
        console.warn(`[Vision] Failed to fetch media URL (${res.status}): ${mediaUrl}`);
        return null;
      }

      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const mimeType = contentType.split(';')[0].trim();
      const buffer = Buffer.from(await res.arrayBuffer());
      const base64 = buffer.toString('base64');
      console.log(`[Vision] Fetched remote image (${mimeType}, ${buffer.length} bytes)`);
      return { base64, mimeType };
    }

    // Local file path (WaWeb / Baileys)
    const filePath = path.join(__dirname, '../../..', mediaUrl);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).substring(1) || 'jpeg';
      const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      const base64 = fs.readFileSync(filePath, { encoding: 'base64' });
      console.log(`[Vision] Read local image (${mimeType})`);
      return { base64, mimeType };
    }

    console.warn(`[Vision] Local file not found: ${filePath}`);
    return null;
  } catch (err) {
    console.error('[Vision] getImageBase64 error:', err.message);
    return null;
  }
};

/**
 * Summarize an image using Vision AI.
 * @param {number} tenantId
 * @param {string} mediaUrl
 * @returns {Promise<string|null>} Summary text
 */
export const summarizeImage = async (tenantId, mediaUrl) => {
  if (!mediaUrl) return null;
  try {
    const imgData = await getImageBase64(mediaUrl);
    if (!imgData) return "Gambar tidak dapat diakses.";
    
    const prompt = `Analisis gambar ini dan kembalikan HANYA dalam format JSON yang valid.
Skema JSON:
{
  "image_category": "brosur" | "bukti_transfer" | "lainnya",
  "detected_package_name": "Nama produk/layanan HANYA JIKA gambar adalah brosur/poster produk, selain itu null",
  "payment_amount": "Total nominal pembayaran berupa ANGKA BULAT HANYA JIKA gambar adalah bukti transfer, selain itu null",
  "summary": "Deskripsi ringkas 1-2 kalimat tentang isi gambar (misal: 'Foto pantai dengan ombak' atau 'Bukti transfer BCA 2 juta')"
}
Aturan Kategori:
- brosur: Gambar promo, poster, pamflet, atau brosur produk/layanan.
- bukti_transfer: Struk ATM, resi M-Banking, screenshot mutasi saldo/pembayaran.
- lainnya: Foto selfie, pemandangan, meme, atau gambar umum lainnya.`;
    
    const summaryData = await executeFastJsonAI(tenantId, 'Kamu adalah asisten analisis visi komputer pengurai JSON.', prompt, [imgData]);
    
    if (summaryData && summaryData.image_category) {
      // Return stringified JSON so it can be saved in the database text column
      return JSON.stringify(summaryData);
    }
    
    return JSON.stringify({
      image_category: 'lainnya',
      detected_package_name: null,
      payment_amount: null,
      summary: "Gambar gagal diproses oleh sistem analisis visual."
    });
  } catch (err) {
    console.error('[SummarizeImage Error]:', err.message);
    return JSON.stringify({
      image_category: 'lainnya',
      detected_package_name: null,
      payment_amount: null,
      summary: "Terjadi kesalahan sistem saat memproses gambar."
    });
  }
};

/**
 * Eksekusi LangChain untuk menghasilkan balasan AI.
 * @param {Object} params
 * @param {string} params.personaText - Instruksi persona AI dari GlobalSetting.
 * @param {string} params.kbContext - Kumpulan informasi Knowledge Base.
 * @param {string} params.bankInfo - Info rekening bank tenant.
 * @param {string} params.userMessage - Pesan dari user/pelanggan.
 * @param {string} [params.mediaUrl] - URL gambar/media yang dikirim (jika ada).
 * @param {Array} [images] - Array of { mimeType, base64 } objects.
 * @returns {Promise<string>} Balasan dari AI.
 */
export const executeFastJsonAI = async (tenantId, systemPrompt, userMessage, images = [], sourceOverride = null, modelOverride = null) => {
  const useEdenAI = process.env.USE_EDENAI === 'true';
  const configuredTimeout = parseInt(process.env.FAST_JSON_AI_TIMEOUT_MS || '45000', 10);
  const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 45000;
  try {
    let messageContent = userMessage;
    if (images && images.length > 0) {
      messageContent = [{ type: 'text', text: userMessage }];
      images.forEach(img => {
        messageContent.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}` } });
      });
    }

    if (useEdenAI) {
      const edenAiApiKey = process.env.EDENAI_API_KEY;
      if (!edenAiApiKey) throw new Error('Eden AI API Key required');
      const model = modelOverride || await _getModelForTenant(tenantId, 'mainModel');
      const apiUrl = process.env.EDENAI_API_URL || 'https://api.edenai.run/v3/chat/completions';

      const payload = {
        model: model,
        messages: [
          { role: 'system', content: systemPrompt + '\n\nIMPORTANT: YOU MUST RETURN ONLY PURE JSON WITHOUT MARKDOWN BACKTICKS.' },
          { role: 'user', content: messageContent }
        ],
        temperature: 0.1,
        max_tokens: 10000,
        response_format: { type: 'json_object' }
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${edenAiApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      // Safely parse JSON (EdenAI may return non-JSON on errors)
      const rawBody = await res.text();
      let data;
      try {
        data = JSON.parse(rawBody);
      } catch (jsonErr) {
        throw new Error(`Non-JSON response from EdenAI (${res.status}): ${rawBody.substring(0, 200)}`);
      }
      if (!res.ok) {
        throw new Error(`API Error: ${res.status} - ${JSON.stringify(data)}`);
      }
      const msg = data?.choices?.[0]?.message;
      let content = msg?.content || '';
      if (!content && msg?.reasoning_content) {
          content = msg.reasoning_content;
      }
      if (!content) content = '{}';

      // Record credit usage from EdenAI response
      if (data?.cost && tenantId) {
        recordUsage(tenantId, {
          model: model,
          cost_usd: data.cost,
          tokens_prompt: data?.usage?.prompt_tokens || 0,
          tokens_completion: data?.usage?.completion_tokens || 0,
          source: sourceOverride || 'fast_json_ai',
        }).catch(err => console.warn('[CreditService] recordUsage error:', err.message));
      }

      return parseJsonResponse(content);
    } else {
      let openAIApiKey = process.env.OPENAI_API_KEY;
      if (tenantId) {
        const aiSetting = await prisma.globalSetting.findUnique({
          where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: 'openai_api_key' } }
        });
        if (aiSetting?.setting_value) openAIApiKey = aiSetting.setting_value;
      }
      const chatModel = new ChatOpenAI({
        openAIApiKey: openAIApiKey,
        modelName: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.1,
        maxRetries: 1,
        modelKwargs: { response_format: { type: 'json_object' } },
        configuration: { baseURL: process.env.OPENAI_BASE_URL }
      });
      let finalMessages = [['system', systemPrompt + '\n\nIMPORTANT: You must return valid JSON.']];
      if (images && images.length > 0) {
        finalMessages.push(new HumanMessage({ content: messageContent }));
      } else {
        finalMessages.push(['human', userMessage]);
      }
      
      const response = await chatModel.invoke(finalMessages);

      // Record credit usage for OpenAI path (estimate tokens)
      if (tenantId) {
        const est = estimateOpenAICost(systemPrompt + userMessage, response.content || '');
        recordUsage(tenantId, {
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          cost_usd: est.cost,
          tokens_prompt: est.inputTokens,
          tokens_completion: est.outputTokens,
          source: sourceOverride || 'fast_json_ai',
        }).catch(err => console.warn('[CreditService] recordUsage error:', err.message));
      }

      return parseJsonResponse(response.content);
    }
  } catch (err) {
    console.error('[FastJsonAI Error]:', err.message);
    return null;
  }
};

export const executePlainAI = async (tenantId, systemPrompt, userMessage, images = [], sourceOverride = null) => {
  const useEdenAI = process.env.USE_EDENAI === 'true';
  const timeoutMs = 45000;
  try {
    let messageContent = userMessage;
    if (images && images.length > 0) {
      messageContent = [{ type: 'text', text: userMessage }];
      images.forEach(img => {
        messageContent.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}` } });
      });
    }

    if (useEdenAI) {
      const edenAiApiKey = process.env.EDENAI_API_KEY;
      if (!edenAiApiKey) throw new Error('Eden AI API Key required');
      const model = await _getModelForTenant(tenantId, 'mainModel');
      const apiUrl = process.env.EDENAI_API_URL || 'https://api.edenai.run/v3/chat/completions';

      const payload = {
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: messageContent }
        ],
        temperature: 0.1,
        max_tokens: 10000
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${edenAiApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      // Safely parse JSON (EdenAI may return non-JSON on errors)
      const rawBody = await res.text();
      let data;
      try {
        data = JSON.parse(rawBody);
      } catch (jsonErr) {
        throw new Error(`Non-JSON response from EdenAI (${res.status}): ${rawBody.substring(0, 200)}`);
      }
      if (!res.ok) {
        throw new Error(`API Error: ${res.status} - ${JSON.stringify(data)}`);
      }

      // Record credit usage from EdenAI response
      if (data?.cost && tenantId) {
        recordUsage(tenantId, {
          model: model,
          cost_usd: data.cost,
          tokens_prompt: data?.usage?.prompt_tokens || 0,
          tokens_completion: data?.usage?.completion_tokens || 0,
          source: sourceOverride || 'plain_ai',
        }).catch(err => console.warn('[CreditService] recordUsage error:', err.message));
      }

      return data?.choices?.[0]?.message?.content || '';
    } else {
      let openAIApiKey = process.env.OPENAI_API_KEY;
      if (tenantId) {
        const aiSetting = await prisma.globalSetting.findUnique({
          where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: 'openai_api_key' } }
        });
        if (aiSetting?.setting_value) openAIApiKey = aiSetting.setting_value;
      }
      const chatModel = new ChatOpenAI({
        openAIApiKey: openAIApiKey,
        modelName: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.1,
        maxRetries: 1,
        configuration: { baseURL: process.env.OPENAI_BASE_URL }
      });
      let finalMessages = [['system', systemPrompt]];
      if (images && images.length > 0) {
        finalMessages.push(new HumanMessage({ content: messageContent }));
      } else {
        finalMessages.push(['human', userMessage]);
      }
      
      const response = await chatModel.invoke(finalMessages);

      // Record credit usage for OpenAI path (estimate tokens)
      if (tenantId) {
        const est = estimateOpenAICost(systemPrompt + userMessage, response.content || '');
        recordUsage(tenantId, {
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          cost_usd: est.cost,
          tokens_prompt: est.inputTokens,
          tokens_completion: est.outputTokens,
          source: sourceOverride || 'plain_ai',
        }).catch(err => console.warn('[CreditService] recordUsage error:', err.message));
      }

      return response.content;
    }
  } catch (err) {
    console.error('[PlainAI Error]:', err.message);
    return null;
  }
};

export const executeLangChain = async ({ 
  tenantId, 
  personaText, 
  kbContext, 
  bankInfo, 
  userMessage,
  mediaUrl,
  longTermMemory,
  promoInstruction,
  customerContext,
  chatType = 'sales',
  selectedModuleIds = null,
  models = null,
}) => {
  try {
    const useEdenAI = process.env.USE_EDENAI === 'true';
    let chatModel;

    if (!useEdenAI) {
      let openAIApiKey = process.env.OPENAI_API_KEY;

      if (tenantId) {
        const aiSetting = await prisma.globalSetting.findUnique({
          where: { uk_tenant_setting: { tenant_id: tenantId, setting_key: 'openai_api_key' } }
        });
        if (aiSetting?.setting_value) {
          openAIApiKey = aiSetting.setting_value;
        }
      }

      if (!openAIApiKey) {
        throw new Error('OpenAI API Key is not configured for this tenant or globally.');
      }

      // Inisialisasi model OpenAI
      chatModel = new ChatOpenAI({
        openAIApiKey: openAIApiKey,
        modelName: process.env.OPENAI_MODEL || "qwen3.6-flash",
        temperature: 0.4,
        maxRetries: 0,
        timeout: 10000,
        configuration: {
          baseURL: process.env.OPENAI_BASE_URL
        }
      });
    }

    // Dinamis Aturan Gaya Bahasa dan Format (Email vs WA)
    let dynamicStyleRules = '';
    if (chatType === 'email') {
      dynamicStyleRules = `
ATURAN GAYA BAHASA & FORMAT (SANGAT PENTING - KHUSUS EMAIL):
- PROFESIONAL & FORMAL: Anda membalas via EMAIL. Gunakan bahasa Indonesia baku, formal, dan profesional.
- BUKAN WHATSAPP: DILARANG menggunakan sapaan "Kak", "Nih", emotikon berlebihan, atau bahasa gaul. Gunakan sapaan formal seperti "Bapak/Ibu" (jika nama belum diketahui, sapa dengan sopan).
- TERSTRUKTUR: Gunakan baris baru (ENTER / \n\n) secara natural untuk memisahkan paragraf.
- DILARANG KERAS MENGGUNAKAN TAG [NEXT]! Anda membalas dalam SATU EMAIL UTUH, bukan pesan pendek beruntun.
- Susun balasan dengan salam pembuka (Yth. Bapak/Ibu) dan salam penutup (Hormat kami, Tim Sales).
- Jika pelanggan bertanya harga, buatlah daftar menggunakan Markdown (bullet points).

CONTOH BENAR (Email Balasan):
Yth. Bapak/Ibu Tio,

Terima kasih telah menghubungi Pesona Indonesia Travel. Kami dengan senang hati akan membantu merencanakan liburan Anda.

Berikut adalah detail paket yang tersedia:
- Paket Bali 3D2N: Rp ...

Hormat kami,
Pesona Indonesia Travel
`;
    } else {
      dynamicStyleRules = `
ATURAN GAYA BAHASA (SANGAT PENTING - WHATSAPP):
- RAMAH & HANGAT: Boleh pakai "Kak", emoji secukupnya (1-2 per bubble max), dan bahasa santai tapi sopan.
- ELEGAN & PROFESIONAL: DILARANG KERAS menggunakan hiperbola berlebihan seperti "hits banget", "auto aesthetic abis", "bikin speechless".

ATURAN FORMAT MULTI-BUBBLE (WAJIB DIIKUTI):
Kamu membalas via WhatsApp. Tujuannya adalah agar terasa seperti manusia asli yang mengetik pesan bertahap — BUKAN robot yang mengirim 1 blok teks panjang.
Gunakan tag [NEXT] untuk memisahkan TOPIK/IDE yang berbeda — BUKAN untuk memecah setiap kalimat!

ATURAN KAPAN MENGGUNAKAN [NEXT]:
✅ Gunakan [NEXT] untuk memisahkan: pembukaan → isi utama → pertanyaan lanjut
✅ Gunakan [NEXT] jika berganti topik atau berganti konteks
❌ JANGAN [NEXT] di tengah satu list/katalog paket — tulis seluruh list dalam 1 bubble
❌ JANGAN [NEXT] untuk memecah kalimat yang masih 1 ide

ATURAN PENTING: Jika kamu menyebutkan DAFTAR PAKET (lebih dari 1 paket), tulis seluruh daftar dalam SATU bubble. Gunakan newline (\\n) untuk membuat list di dalam bubble tersebut, bukan [NEXT].

FILOSOFI UTAMA: HEMAT KATA, TINGGI NILAI — TAPI TETAP TERASA MANUSIAWI DAN PROFESIONAL.

CONTOH BENAR (List paket = 1 bubble):
"Wah pas banget, ada 2 minggu lagi! 😊 Kami punya beberapa pilihan seru:[NEXT]🏖️ *Bali Eksotis & Nusa Penida 3H2M* — snorkeling, sunset di Uluwatu\n🏛️ *Yogyakarta Klasik 3H2M* — budaya, Prambanan, Malioboro\n🌋 *Sunrise Bromo & Kawah Ijen 2H1M* — petualangan alam\n\nKakak lebih suka suasana pantai, budaya, atau petualangan? 😊"

CONTOH BENAR (Satu paket, multi-bubble):
"Kebetulan kami punya *Paket Bali Eksotis & Nusa Penida 3H2M* yang sangat cocok untuk liburan santai, Kak.[NEXT]Di paket ini Kakak akan diajak snorkeling di Nusa Penida dan menikmati sunset dinner di Uluwatu.[NEXT]Rencananya berangkat berdua atau bersama keluarga, Kak?"

CONTOH SALAH (List dipecah jadi banyak bubble — DILARANG KERAS):
"Kami punya Paket Bali. [NEXT] Kami juga punya Yogyakarta. [NEXT] Ada juga Bromo." ← INI SALAH, harus jadi 1 bubble list.

`;
    }

    // Susun sistem prompt template menggunakan modular prompt assembly
    let systemTemplate;
    const totalModules = PROMPT_MODULE_IDS.length;

    if (selectedModuleIds !== null && Array.isArray(selectedModuleIds)) {
      // Router succeeded — trust its selective decision (even 0 modules is valid for greetings)
      systemTemplate = assemblePrompt(dynamicStyleRules, selectedModuleIds);
      console.log(`[PromptAssembler] 🎯 Selective: ${selectedModuleIds.length}/${totalModules} modules`);
    } else {
      // Router failed (null) — true fallback, load ALL modules
      console.log(`[PromptAssembler] 🔄 Router unavailable — loading ALL modules (full prompt)`);
      systemTemplate = assembleFullPrompt(dynamicStyleRules);
    }

    const promptTemplate = ChatPromptTemplate.fromMessages([
      ['system', systemTemplate],
      ['human', '{user_message}'],
    ]);

    // Format prompt dengan variabel
    const prompt = await promptTemplate.formatMessages({
      persona: personaText || 'Kamu adalah asisten AI yang membantu.',
      knowledge_base: kbContext || 'Tidak ada informasi tambahan.',
      bank_info: bankInfo || 'Tidak ada info bank.',
      long_term_memory: longTermMemory || 'Belum ada riwayat obrolan sebelumnya.',
      saved_name: customerContext?.savedName || 'Kosong',
      customer_whatsapp: customerContext?.whatsapp_phone || 'Belum diketahui',
      customer_telegram: customerContext?.telegram_id || 'Belum diketahui',
      customer_instagram: customerContext?.instagram_username || 'Belum diketahui',
      customer_email: customerContext?.email || 'Belum diketahui',
      customer_first_name: customerContext?.first_name || 'Belum diketahui',
      customer_last_name: customerContext?.last_name || 'Belum diketahui',
      customer_position: customerContext?.position_title || 'Belum diketahui',
      customer_company: customerContext?.company_name || 'Belum diketahui',
      customer_industry: customerContext?.industry || 'Belum diketahui',
      customer_city: customerContext?.city || 'Belum diketahui',
      customer_country: customerContext?.country || 'Belum diketahui',
      customer_gender: customerContext?.gender || 'Belum diketahui',
      customer_preferences: customerContext?.preferences || 'Belum ada data',
      customer_notes: customerContext?.notes || 'Belum ada data',
      customer_comm_pref: customerContext?.communication_preference || 'Belum diketahui',
      customer_personal_notes: customerContext?.personal_notes || 'Belum ada data',
      customer_lead_source: customerContext?.lead_source || 'Belum diketahui',
      customer_crm_history: customerContext?.crmHistory || 'Belum ada histori layanan di CRM',
      user_message: userMessage,
      promo_instruction: promoInstruction || '',
    });

    // Panggil AI
    if (useEdenAI) {
      const edenAiApiKey = process.env.EDENAI_API_KEY;
      if (!edenAiApiKey) throw new Error('Eden AI API Key is required when USE_EDENAI is true.');

      // Model configuration — murni per tier, tidak ada EDENAI_MODEL fallback
      const mainModel = (models?.mainModel) || await _getModelForTenant(tenantId, 'mainModel');
      const toolModel = (models?.toolModel) || await _getModelForTenant(tenantId, 'toolModel');
      const apiUrl = process.env.EDENAI_API_URL || 'https://api.edenai.run/v3/chat/completions';
      const toolApiKey = process.env.TOOL_CALL_AI_API_KEY || edenAiApiKey;
      const toolApiUrl = process.env.TOOL_CALL_AI_API_URL || apiUrl;

      const systemMessage = prompt.find(m => m._getType() === 'system').content;
      let humanMessageContent = prompt.find(m => m._getType() === 'human').content;

      // Resolve image from URL or local disk
      let messageContent = humanMessageContent;
      if (mediaUrl) {
        const imgData = await getImageBase64(mediaUrl);
        if (imgData) {
          messageContent = [
            { type: 'text', text: humanMessageContent || 'Berikut gambar yang diminta.' },
            { type: 'image_url', image_url: { url: `data:${imgData.mimeType};base64,${imgData.base64}` } }
          ];
        }
      }

      // Cumulative cost tracking
      let totalCostUsd = 0;
      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;

      /**
       * Execute EdenAI call with tool loop support.
       * @param {string} model - Model identifier (e.g. "minimax/minimax-m3")
       * @param {string} apiKey - API key for this model
       * @param {string} url - API URL
       * @param {string} label - Label for logging
       * @returns {Promise<string>} Final text response
       */
      const edenAiToolLoop = async (model, apiKey, url, label) => {
        const payload = {
          model: model,
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: messageContent }
          ],
          temperature: 0.4,
          max_tokens: 10000,
          tools: edenAiToolsSchema,
        };

        console.log(`[${label}] Using model="${model}" with Tools`);

        let data;
        const maxToolLoops = 4;
        let currentLoop = 0;

        while (currentLoop < maxToolLoops) {
          currentLoop++;
          let resOk = false;
          let lastError = '';

          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 120000);

              const res = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
              });
              clearTimeout(timeoutId);

              // Safely parse JSON response (EdenAI may return non-JSON on errors)
              const rawBody = await res.text();
              try {
                data = JSON.parse(rawBody);
              } catch (jsonErr) {
                lastError = `Non-JSON response (${res.status}): ${rawBody.substring(0, 200)}`;
                console.warn(`[${label}] Attempt ${attempt} - response not JSON:`, lastError);
                if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
                continue;
              }
              if (!res.ok) {
                lastError = data?.error?.message || data?.detail || JSON.stringify(data);
                console.warn(`[${label}] Attempt ${attempt} failed (${res.status}):`, lastError);
                if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
                continue;
              }
              resOk = true;
              break;
            } catch (fetchErr) {
              lastError = fetchErr.message;
              console.warn(`[${label}] Fetch attempt ${attempt} failed:`, lastError);
              if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
            }
          }

          if (!resOk) {
            throw new Error(lastError || 'Max retries reached');
          }

          const msg = data?.choices?.[0]?.message;
          if (!msg) break;

          // Track cost
          if (data?.cost) totalCostUsd += data.cost;
          if (data?.usage?.prompt_tokens) totalPromptTokens += data.usage.prompt_tokens;
          if (data?.usage?.completion_tokens) totalCompletionTokens += data.usage.completion_tokens;

          // No tool calls → final answer
          if (!msg.tool_calls || msg.tool_calls.length === 0) {
            console.log(`[${label}] Final Answer Loop ${currentLoop}`);

            // ── Safety net: Detect models that embed tool calls as raw text/XML ──
            // Some models (e.g. Minimax M3) return tool calls embedded in content
            // as XML-like syntax instead of using the structured tool_calls array.
            // This causes critical tools (defer_guidance_request, etc.) to never execute.
            // Detect this pattern and throw to trigger tool model fallback.
            if (msg.content && currentLoop === 1) {
              const embeddedToolPattern = /invoke\s+name=|<tool_call>|function_call|"name"\s*:\s*"(defer_guidance_request|request_admin_guidance|generate_customer_request|generate_bargain_offer|update_order_form|calculate_exact_price)/i;
              if (embeddedToolPattern.test(msg.content)) {
                console.warn(`[${label}] ⚠️ Detected embedded tool calls in raw content — model failed to use structured tool_calls. Triggering fallback.`);
                throw new Error('Model returned embedded tool calls as raw text instead of structured tool_calls. Falling back to tool model.');
              }
            }

            if (!msg.content && currentLoop > 1) {
              // Empty after tool loop — retry without tools
              delete payload.tools;
              payload.messages.push({ role: 'system', content: 'Please provide your final answer in text format based on the tool results.' });
              const fallbackRes = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              const fallbackData = await fallbackRes.json();
              if (fallbackData?.cost) totalCostUsd += fallbackData.cost;
              return fallbackData?.choices?.[0]?.message?.content || 'Maaf, saya tidak bisa merespons saat ini.';
            }

            return msg.content || 'Maaf, saya tidak bisa merespons saat ini.';
          }

          // Execute tools
          payload.messages.push(msg);
          console.log(`[${label}] Tool Loop ${currentLoop} — tools:`, msg.tool_calls.map(t => t.function.name));

          for (const toolCall of msg.tool_calls) {
            const selectedTool = activeAITools.find(t => t.name === toolCall.function.name);
            let toolResultStr = '';
            if (selectedTool) {
              try {
                const args = JSON.parse(toolCall.function.arguments || '{}');
                const context = { tenantId, phone: customerContext?.phone || '' };
                toolResultStr = await selectedTool.func(args, context);
              } catch (err) {
                toolResultStr = JSON.stringify({ error: err.message });
              }
            } else {
              toolResultStr = JSON.stringify({ error: 'Tool not found' });
            }
            console.log(`[${label}] Tool Result ${toolCall.function.name}:`, toolResultStr.substring(0, 200));
            payload.messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: toolResultStr
            });
          }
        }

        return data?.choices?.[0]?.message?.content || 'Maaf, saya tidak bisa merespons saat ini.';
      };

      // ── STEP 1: Try main model ──
      let reply;
      try {
        reply = await edenAiToolLoop(mainModel, edenAiApiKey, apiUrl, 'MainModel');
      } catch (mainErr) {
        // ── STEP 2: Main model failed (likely tool calling issue) → fall back to tool model ──
        if (toolModel !== mainModel) {
          console.warn(`[MainModel] Failed: ${mainErr.message}. Falling back to ToolModel: ${toolModel}`);
          try {
            reply = await edenAiToolLoop(toolModel, toolApiKey, toolApiUrl, 'ToolModel');
          } catch (toolErr) {
            console.error(`[ToolModel] Also failed: ${toolErr.message}`);
            reply = 'Maaf, saya tidak bisa merespons saat ini. Silakan coba lagi.';
          }
        } else {
          console.error(`[MainModel] Failed (no separate tool model configured): ${mainErr.message}`);
          reply = 'Maaf, saya tidak bisa merespons saat ini. Silakan coba lagi.';
        }
      }

      // Record credit usage
      if (totalCostUsd > 0 && tenantId) {
        recordUsage(tenantId, {
          model: mainModel, cost_usd: totalCostUsd,
          tokens_prompt: totalPromptTokens, tokens_completion: totalCompletionTokens,
          source: 'langchain_main',
        }).catch(err => console.warn('[CreditService] recordUsage error:', err.message));
      }

      return reply;

    } else {
      // Menggunakan LangChain OpenAI
      let finalMessages = prompt;

      // Resolve image from URL or local disk
      if (mediaUrl) {
        const imgData = await getImageBase64(mediaUrl);
        if (imgData) {
          const systemMessage = prompt.find(m => m._getType() === 'system').content;
          const humanMessageContent = prompt.find(m => m._getType() === 'human').content;

          finalMessages = [
            ['system', systemMessage],
            new HumanMessage({
              content: [
                { type: 'text', text: humanMessageContent || 'Berikut gambar dari pengguna.' },
                { type: 'image_url', image_url: { url: `data:${imgData.mimeType};base64,${imgData.base64}` } }
              ]
            })
          ];
        }
      }

      const context = { tenantId, phone: customerContext?.phone || '' };
      const response = await executeLangchainWithTools(chatModel, finalMessages, context);
      let content = response?.content || '';
      // Strip Qwen/DeepSeek <think>...</think> reasoning blocks
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

      // Record credit usage for OpenAI/LangChain path (estimate tokens)
      if (tenantId) {
        const promptText = (personaText || '') + (kbContext || '') + (longTermMemory || '') + (userMessage || '');
        const est = estimateOpenAICost(promptText, content);
        recordUsage(tenantId, {
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          cost_usd: est.cost,
          tokens_prompt: est.inputTokens,
          tokens_completion: est.outputTokens,
          source: 'langchain_main',
        }).catch(err => console.warn('[CreditService] recordUsage error:', err.message));
      }

      return content;
    }
  } catch (error) {
    console.error('[LangChain Logic Error]:', error);
    throw new Error('Gagal memproses pesan dengan AI.');
  }
};

/**
 * Wrapper lama untuk kompatibilitas dengan transaction.service.js
 * @param {string} prompt 
 * @param {string} systemPrompt 
 */
export const callAI = async (prompt, systemPrompt = 'Anda adalah asisten AI yang membantu.', tenantId = null) => {
  return await executeLangChain({
    tenantId: tenantId,
    personaText: systemPrompt,
    kbContext: '',
    bankInfo: '',
    userMessage: prompt,
    selectedModuleIds: [], // Core-only — legacy wrapper doesn't need prompt modules
  });
};
