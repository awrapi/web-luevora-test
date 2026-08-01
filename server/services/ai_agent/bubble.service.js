/**
 * ================================================================
 * Bubble Service — Multi-Bubble AI Reply System
 * ================================================================
 * Membuat AI membalas dengan beberapa bubble terpisah agar
 * terasa lebih natural seperti manusia chatting.
 *
 * Flow (NEW — Single-Call Architecture):
 *   1. generateAllBubbles() — 1 LLM call, semua bubble sekaligus (JSON)
 *   2. Jika gagal → fallback ke planBubbles() + executeBubble() lama
 *
 * Keunggulan Single-Call:
 *   - AI menulis semua bubble dalam 1 context window → tidak bisa mengulang diri sendiri
 *   - N+1 LLM calls → 1 LLM call (lebih cepat & hemat token)
 *   - Tidak butuh anti-repeat directive, dedup, atau strip greeting
 * ================================================================
 */

import { executeFastJsonAI, executePlainAI } from './logic.service.js';

/**
 * Helper: Extract JSON from text that may contain markdown, extra text, etc.
 */
const extractJsonFromText = (text) => {
  if (!text) return null;
  // Strip markdown code blocks
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  // Try direct parse first
  try { return JSON.parse(cleaned); } catch {}
  // Try to find { ... } block
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {}
  }
  return null;
};

/**
 * Helper: Deduplicate near-identical bubbles (safety net for fallback path).
 *
 * Strategy:
 * 1. Word-overlap similarity >55%  → drop the shorter/later bubble
 * 2. Repeated greeting detection   → strip the repeated opening from later bubbles
 */
const deduplicateBubbles = (bubbles) => {
  if (!bubbles || bubbles.length <= 1) return bubbles;

  const normalize = (text) => {
    return text
      .toLowerCase()
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 1);
  };

  const similarity = (a, b) => {
    const wordsA = new Set(normalize(a));
    const wordsB = new Set(normalize(b));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    let overlap = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) overlap++;
    }
    const smaller = Math.min(wordsA.size, wordsB.size);
    return overlap / smaller;
  };

  const extractOpening = (text) => {
    const stripped = text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
    const match = stripped.match(/^[^.!?\n]+[.!?]?/);
    return match ? match[0].trim().toLowerCase() : '';
  };

  const stripRepeatedOpening = (current, previousOpening) => {
    if (!previousOpening || previousOpening.length < 5) return current;
    const currentOpening = extractOpening(current);
    const sim = similarity(currentOpening, previousOpening);
    if (sim > 0.6) {
      const strippedEmoji = current.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');
      const firstSentenceEnd = strippedEmoji.search(/[.!?]/);
      if (firstSentenceEnd > 0 && firstSentenceEnd < current.length - 1) {
        let realPos = 0;
        let count = 0;
        for (let j = 0; j < current.length && count <= firstSentenceEnd; j++) {
          if (!/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(current[j])) count++;
          realPos = j;
        }
        const cleaned = current.slice(realPos + 1).trim();
        if (cleaned.length > 5) {
          console.log(`[Bubble Dedup] Stripped repeated greeting. Remaining: "${cleaned.substring(0, 60)}"`);
          return cleaned;
        }
      }
    }
    return current;
  };

  const result = [bubbles[0]];
  for (let i = 1; i < bubbles.length; i++) {
    const prev = result[result.length - 1];
    const sim = similarity(bubbles[i], prev);
    if (sim > 0.55) {
      console.log(`[Bubble Dedup] Bubble ${i + 1} is ${Math.round(sim * 100)}% similar → merging (keeping longer)`);
      if (bubbles[i].length > prev.length) result[result.length - 1] = bubbles[i];
    } else {
      const prevOpening = extractOpening(prev);
      const cleaned = stripRepeatedOpening(bubbles[i], prevOpening);
      result.push(cleaned);
    }
  }
  return result;
};

// ================================================================
// PRIMARY PATH: Single-Call Multi-Bubble Generator
// ================================================================

/**
 * generateAllBubbles — Satu LLM call menghasilkan SEMUA bubble sekaligus.
 *
 * Keunggulan vs N-call:
 * - AI menulis semua bubble dalam satu context window → tidak bisa mengulang diri sendiri
 * - Lebih cepat, lebih hemat token
 * - Tidak butuh anti-repeat directive atau dedup
 *
 * Format output yang diminta dari AI:
 * {
 *   "bubbles": ["teks bubble 1", "teks bubble 2", ...]
 * }
 *
 * System tags ([UPDATE_INFO], [OFFER_DETECTED], dll) tetap di teks bubble TERAKHIR
 * agar combinedReply masih compatible dengan tag parsing yang sudah ada.
 *
 * @returns {Promise<{bubbles: string[], success: boolean}>}
 */
export const generateAllBubbles = async ({
  tenantId,
  personaText,
  kbContext,
  bankInfo,
  userMessage,
  mediaUrl,
  longTermMemory,
  customerContext,
  promoInstruction,
  executeLangChainFn,
  selectedModuleIds = null,
  models = null,
}) => {

  const multiBubbleDirective = `


=== MODE RESPONS: MULTI-BUBBLE WHATSAPP ===
Anda WAJIB merespons dalam format JSON. Output harus berupa objek JSON dengan array "bubbles".

CARA KERJA:
Anda menulis SEMUA bubble sekaligus dalam satu respons. Karena Anda melihat semua yang Anda tulis sekaligus, Anda secara otomatis TIDAK AKAN mengulang sapaan atau konten yang sama di bubble berbeda.

ATURAN JUMLAH BUBBLE:
- Reaksi 1 kata ("oke", "siap", "baik") → 1 bubble saja
- Sapaan/greeting sederhana → 2 bubble: (1) balas salam hangat, (2) buka percakapan dengan pertanyaan
- Pertanyaan/request sederhana → 2 bubble: (1) respons/konfirmasi, (2) detail + pertanyaan lanjutan
- Penjelasan detail produk/paket → 3 bubble: (1) intro, (2) detail, (3) CTA/pertanyaan
- Pertanyaan kompleks multi-bagian → 3-4 bubble sesuai kebutuhan

ATURAN KONTEN:
1. Setiap bubble = 1 pikiran/ide = MAKS 1-2 kalimat singkat
2. Bubble 1 = acknowledge/respons pesan customer
3. Bubble terakhir = pertanyaan atau call-to-action untuk lanjutkan percakapan
4. Tulis natural seperti manusia chatting WhatsApp, bukan robot
5. Semua TAG SISTEM ([UPDATE_INFO:...], [OFFER_DETECTED:...], [SEND_INVOICE_TO:...], dll) HANYA boleh ada di teks bubble TERAKHIR

FORMAT OUTPUT WAJIB:
{
  "bubbles": [
    "Teks bubble pertama",
    "Teks bubble kedua",
    "Teks bubble terakhir [TAG_SISTEM_JIKA_ADA]"
  ]
}

CONTOH sapaan "halo kak / selamat malam":
{
  "bubbles": [
    "Halo Kak! Selamat malam juga! 😊",
    "Ada yang bisa saya bantu untuk rencana liburan Kakak malam ini?"
  ]
}

CONTOH pertanyaan "ada paket ke bali?":
{
  "bubbles": [
    "Wah, Bali pilihan yang tepat Kak! 🌴 Kami punya beberapa paket seru ke sana.",
    "Ada Paket Bali 3D2N dan Paket Bali 4D3N — masing-masing dengan itinerary yang beda.",
    "Kakak rencananya pergi berapa hari dan sama siapa nih? Biar saya bisa rekomendasikan yang paling cocok 😊"
  ]
}

OUTPUT HANYA JSON. Jangan tulis apapun di luar JSON.`;

  const enhancedPersona = personaText + multiBubbleDirective;

  try {
    // executeLangChainFn: full LangChain with tools + RAG context
    const rawReply = await executeLangChainFn({
      tenantId,
      personaText: enhancedPersona,
      kbContext,
      bankInfo,
      userMessage,
      mediaUrl,
      longTermMemory,
      promoInstruction,
      customerContext,
      selectedModuleIds,
      models,
    });

    console.log('[Bubble Gen] Raw reply (first 300):', rawReply?.substring(0, 300));

    // Extract JSON from response (handles markdown wrapping, extra text, etc.)
    const parsed = extractJsonFromText(rawReply);

    if (parsed && Array.isArray(parsed.bubbles) && parsed.bubbles.length > 0) {
      const bubbles = parsed.bubbles
        .map(b => (typeof b === 'string' ? b.trim() : String(b).trim()))
        .filter(b => b.length > 0);

      if (bubbles.length > 0) {
        console.log(`[Bubble Gen] ✅ Single-call generated ${bubbles.length} bubble(s):`, bubbles.map(b => `"${b.substring(0, 60)}"`));
        return { bubbles, success: true };
      }
    }

    // JSON parse failed — try fallback with executeFastJsonAI (pure JSON, no tools)
    console.warn('[Bubble Gen] ⚠️ Tool-calling path failed JSON parse. Retrying with FastJsonAI...');
    try {
      const { executeFastJsonAI } = await import('./logic.service.js');

      // Assemble all context into a single prompt for FastJsonAI
      const contextBlock = [
        longTermMemory ? `[RIWAYAT PERCAKAPAN]\n${longTermMemory}` : '',
        kbContext ? `[KNOWLEDGE BASE]\n${kbContext}` : '',
        bankInfo ? `[INFO REKENING]\n${bankInfo}` : '',
        customerContext?.crmHistory ? `[CRM HISTORY]\n${customerContext.crmHistory}` : '',
        customerContext?.savedName ? `[NAMA CUSTOMER] ${customerContext.savedName}` : '',
        promoInstruction || '',
      ].filter(Boolean).join('\n\n');

      const systemPrompt = `${personaText}\n\n${contextBlock}\n\n${multiBubbleDirective}`;
      const userPrompt = mediaUrl
        ? `Pesan customer: "${userMessage}"\n(Gambar dilampirkan: ${mediaUrl})`
        : `Pesan customer: "${userMessage}"`;

      const jsonResult = await executeFastJsonAI(tenantId, systemPrompt, userPrompt, [], 'bubble_gen_fallback');

      if (jsonResult && Array.isArray(jsonResult.bubbles) && jsonResult.bubbles.length > 0) {
        const bubbles = jsonResult.bubbles
          .map(b => (typeof b === 'string' ? b.trim() : String(b).trim()))
          .filter(b => b.length > 0);

        if (bubbles.length > 0) {
          console.log(`[Bubble Gen] ✅ FastJsonAI fallback generated ${bubbles.length} bubble(s)`);
          return { bubbles, success: true };
        }
      }
    } catch (fallbackErr) {
      console.warn('[Bubble Gen] FastJsonAI fallback also failed:', fallbackErr.message);
    }

    // Ultimate fallback: use raw reply as single bubble
    if (rawReply && rawReply.trim().length > 0) {
      let cleanedReply = rawReply.trim();
      
      // If the reply looks like JSON bubbles structure but failed parsing, strip the JSON framing
      const prefixRegex = /^\{[\s\n]*"bubbles"[\s\n]*:[\s\n]*\[[\s\n]*"/i;
      if (prefixRegex.test(cleanedReply)) {
        console.log('[Bubble Gen] 🧹 Stripping broken JSON framing from fallback raw reply');
        cleanedReply = cleanedReply.replace(prefixRegex, '');
        cleanedReply = cleanedReply.replace(/"[\s\n]*\][\s\n]*\}[\s\n]*$/i, '');
        cleanedReply = cleanedReply.replace(/"[\s\n]*\][\s\n]*$/i, '');
        cleanedReply = cleanedReply.replace(/"[\s\n]*$/i, '');
        
        // Replace intermediate quotes and commas with [NEXT] if multiple bubbles were partially generated
        cleanedReply = cleanedReply.replace(/"[\s\n]*,[\s\n]*"/g, '[NEXT]');
      }

      console.warn('[Bubble Gen] ⚠️ Single-call non-JSON fallback: using as 1 bubble (cleaned)');
      return { bubbles: [cleanedReply.trim()], success: false };
    }
    return { bubbles: null, success: false };

  } catch (err) {
    console.error('[Bubble Gen] ❌ Error:', err.message);
    return { bubbles: null, success: false };
  }
};


// ================================================================
// FALLBACK PATH: Plan + Execute (kept for safety)
// ================================================================

/**
 * planBubbles — FALLBACK ONLY. AI memutuskan struktur bubble.
 * Hanya digunakan jika generateAllBubbles() gagal.
 */
export const planBubbles = async (tenantId, userMessage, chatHistorySnippet, kbContext) => {
  const systemPrompt = `You are a conversation structure planner for a WhatsApp sales assistant.

Your job is to decide HOW MANY separate WhatsApp messages (bubbles) the assistant should send, and WHAT each bubble should contain.

IMPORTANT: The "Latest Customer Message" may contain MULTIPLE lines — these are separate messages the customer sent in rapid succession that have been COMBINED into one input. Treat ALL lines as ONE customer turn.

RULES:
1. Use 1 bubble ONLY for: truly one-word reactions ("oke", "siap", "noted").
2. Use 2 bubbles for: any response with 2 different thoughts — e.g. (a) greeting + (b) question. Even simple greetings = 2 bubbles.
3. Use 3+ bubbles for: 3+ meaningfully different ideas/thoughts.
4. ALWAYS separate "acknowledging/greeting" from "asking a question" into DIFFERENT bubbles.
5. Each bubble instruction must describe a DIFFERENT action. No duplicates.
6. Keep each bubble instruction concise (1 sentence).

Return ONLY a JSON object:
{
  "bubbleCount": number,
  "instructions": ["instruction for bubble 1", "instruction for bubble 2", ...]
}

Examples:
- User says "oke" → {"bubbleCount": 1, "instructions": ["Konfirmasi singkat bahwa sudah noted"]}
- User says "halo" → {"bubbleCount": 2, "instructions": ["Balas sapaan dengan hangat", "Tanyakan ada yang bisa dibantu"]}
- User says "halo kak\\nselamat sore" → {"bubbleCount": 2, "instructions": ["Balas sapaan dan ucapkan selamat sore juga dengan hangat", "Tanyakan ada yang bisa dibantu untuk rencana liburan mereka"]}
- User says "ada paket apa aja?" → {"bubbleCount": 2, "instructions": ["Balas dengan antusias bahwa ada paket menarik, sebutkan nama-namanya secara singkat", "Tanyakan destinasi mana yang paling menarik"]}
- User says "ceritain dong paket bali" → {"bubbleCount": 3, "instructions": ["Balas dengan excited tentang paket Bali, jelaskan highlight utamanya", "Jelaskan itinerary ringkas dan fasilitas yang didapat", "Tanyakan rencana keberangkatan dengan CTA"]}`;

  const prompt = `Chat History:\n${chatHistorySnippet}\n\nLatest Customer Message: ${userMessage}`;

  try {
    const rawText = await executePlainAI(tenantId, systemPrompt, prompt, [], 'bubble_gen');
    console.log('[Bubble Planner] Raw text:', rawText?.substring(0, 300));
    const result = extractJsonFromText(rawText);
    console.log('[Bubble Planner] Parsed result:', JSON.stringify(result)?.substring(0, 500));

    if (!result || !result.instructions || !Array.isArray(result.instructions)) {
      console.warn('[Bubble Planner] Invalid result, falling back to single bubble.');
      return ['Balas pesan customer secara natural dan lengkap'];
    }

    const instructions = result.instructions;
    if (instructions.length === 0) return ['Balas pesan customer secara natural dan lengkap'];

    console.log(`[Bubble Planner] Planned ${instructions.length} bubble(s):`, instructions);
    return instructions;

  } catch (err) {
    console.error('[Bubble Planner] Error:', err.message);
    return ['Balas pesan customer secara natural dan lengkap'];
  }
};

/**
 * executeBubble — FALLBACK ONLY. Eksekusi satu instruksi bubble.
 * Hanya digunakan jika generateAllBubbles() gagal.
 */
export const executeBubble = async ({
  tenantId,
  instruction,
  userMessage,
  personaText,
  kbContext,
  bankInfo,
  longTermMemory,
  customerContext,
  mediaUrl,
  previousBubbles,
  bubbleIndex,
  totalBubbles,
  promoInstruction,
  executeLangChainFn,
  selectedModuleIds = null,
  models = null,
}) => {
  let bubbleDirective = `\n\n=== INSTRUKSI BUBBLE (WAJIB DIIKUTI) ===\n`;
  bubbleDirective += `Anda sedang mengirim pesan ke-${bubbleIndex + 1} dari ${totalBubbles} pesan terpisah.\n`;
  bubbleDirective += `ATURAN:\n`;
  bubbleDirective += `1. HANYA tulis konten sesuai instruksi di bawah. MAKSIMAL 1-2 kalimat.\n`;
  bubbleDirective += `2. DILARANG mengulangi salam/sapaan yang sudah ada di pesan sebelumnya.\n`;
  bubbleDirective += `3. Tulis natural seperti manusia chatting WhatsApp.\n`;

  if (bubbleIndex === 0) {
    bubbleDirective += `4. Pesan PERTAMA: langsung respons/acknowledge pesan customer.\n`;
  } else if (bubbleIndex === totalBubbles - 1) {
    bubbleDirective += `4. Pesan TERAKHIR: akhiri dengan pertanyaan atau CTA. TAG SISTEM boleh di sini.\n`;
  } else {
    bubbleDirective += `4. Pesan TENGAH: lanjutkan informasi. JANGAN taruh tag sistem di sini.\n`;
  }

  if (previousBubbles.length > 0) {
    const prevOpening = previousBubbles[0].split(/[.!?\n]/)[0].trim();
    if (prevOpening.length > 3) {
      bubbleDirective += `\nLARANGAN: Pesan pertama dimulai dengan "${prevOpening}". DILARANG memulai dengan kata-kata yang sama!\n`;
    }
  }

  const enhancedPersona = personaText + bubbleDirective;

  let enhancedUserMessage = '';
  if (previousBubbles.length > 0) {
    enhancedUserMessage += `[PESAN YANG SUDAH ANDA KIRIM — JANGAN ULANGI]:\n`;
    previousBubbles.forEach((b, i) => {
      enhancedUserMessage += `Pesan ${i + 1}: "${b}"\n`;
    });
    enhancedUserMessage += `\n`;
  }
  enhancedUserMessage += `[PESAN CUSTOMER]: ${userMessage}\n\n`;
  enhancedUserMessage += `[INSTRUKSI PESAN ANDA SEKARANG]: ${instruction}`;

  const bubbleReply = await executeLangChainFn({
    tenantId,
    personaText: enhancedPersona,
    kbContext,
    bankInfo,
    userMessage: enhancedUserMessage,
    mediaUrl: bubbleIndex === 0 ? mediaUrl : null,
    longTermMemory,
    promoInstruction,
    customerContext,
    selectedModuleIds,
    models,
  });

  return bubbleReply;
};

// ================================================================
// ORCHESTRATOR
// ================================================================

/**
 * processMultiBubble — Orchestrator utama.
 *
 * Primary path: generateAllBubbles() — 1 LLM call, semua bubble sekaligus.
 * Fallback path: planBubbles() + executeBubble() loop (N LLM calls).
 *
 * @param {object} params
 * @returns {Promise<{combinedReply: string, bubbles: string[]}>}
 */
export const processMultiBubble = async ({
  tenantId,
  personaText,
  kbContext,
  bankInfo,
  userMessage,
  mediaUrl,
  longTermMemory,
  customerContext,
  chatHistorySnippet,
  promoInstruction,
  executeLangChainFn,
  selectedModuleIds = null,
  models = null,
}) => {

  // ── PRIMARY PATH: Single-call generation ──
  console.log('[Bubble] Trying single-call multi-bubble generation...');
  const genResult = await generateAllBubbles({
    tenantId,
    personaText,
    kbContext,
    bankInfo,
    userMessage,
    mediaUrl,
    longTermMemory,
    customerContext,
    promoInstruction,
    executeLangChainFn,
    selectedModuleIds,
    models,
  });

  if (genResult.success && genResult.bubbles && genResult.bubbles.length > 0) {
    const combinedReply = genResult.bubbles.join('\n\n');
    console.log(`[Bubble] ✅ Single-call path: ${genResult.bubbles.length} bubble(s). Combined: ${combinedReply.length} chars`);
    return { combinedReply, bubbles: genResult.bubbles };
  }

  // If single-call returned a raw string (non-JSON fallback), use it as 1 bubble
  if (!genResult.success && genResult.bubbles && genResult.bubbles.length === 1) {
    const singleBubble = genResult.bubbles[0];
    console.warn('[Bubble] ⚠️ Single-call non-JSON fallback: using as 1 bubble');
    return { combinedReply: singleBubble, bubbles: [singleBubble] };
  }

  // ── FALLBACK PATH: Plan + Execute (N-call) ──
  console.warn('[Bubble] ⚠️ Single-call failed entirely. Falling back to sequential execution...');

  const instructions = await planBubbles(tenantId, userMessage, chatHistorySnippet, kbContext);
  console.log(`[Bubble] Fallback plan: ${instructions.length} bubble(s)`);

  const bubbles = [];
  for (let i = 0; i < instructions.length; i++) {
    console.log(`[Bubble] Fallback executing bubble ${i + 1}/${instructions.length}: "${instructions[i]}"`);
    const bubbleReply = await executeBubble({
      tenantId,
      instruction: instructions[i],
      userMessage,
      personaText,
      kbContext,
      bankInfo,
      longTermMemory,
      customerContext,
      mediaUrl,
      previousBubbles: bubbles,
      bubbleIndex: i,
      totalBubbles: instructions.length,
      promoInstruction,
      executeLangChainFn,
      selectedModuleIds,
      models,
    });
    bubbles.push(bubbleReply);
    console.log(`[Bubble] Fallback bubble ${i + 1} (${bubbleReply.length} chars): "${bubbleReply.substring(0, 80)}..."`);
  }

  // Dedup safety net for fallback path
  const deduplicatedBubbles = deduplicateBubbles(bubbles);
  if (deduplicatedBubbles.length < bubbles.length) {
    console.log(`[Bubble] Fallback dedup: ${bubbles.length} → ${deduplicatedBubbles.length} bubble(s)`);
  }

  const combinedReply = deduplicatedBubbles.join('\n\n');
  console.log(`[Bubble] Fallback done: ${deduplicatedBubbles.length} bubble(s). Combined: ${combinedReply.length} chars`);

  return { combinedReply, bubbles: deduplicatedBubbles };
};

export default { generateAllBubbles, planBubbles, executeBubble, processMultiBubble };
