/**
 * ================================================================
 * DEEP SMART AGENTIC RAG ENGINE
 * ================================================================
 * 
 * Domain-agnostic deep document search engine.
 * Can be used by any business domain (travel, course, rental, retail).
 * 
 * USAGE:
 *   import { deepRagEngine } from '../deep_rag_engine/index.js';
 * 
 *   // Text document search
 *   const result = await deepRagEngine.search(tenantId, question, fullText, {
 *     title: 'Kebijakan Pembatalan',
 *     summary: 'Dokumen berisi aturan pembatalan...'
 *   });
 *   // Returns: { found: boolean, answer: string | null }
 * 
 *   // Image analysis (Vision AI)
 *   const result = await deepRagEngine.analyzeImage(tenantId, question, imagePath);
 *   // Returns: { found: boolean, answer: string | null }
 * 
 * This engine does NOT handle:
 * - Database models / Prisma queries
 * - Caching (handled by the caller/adapter)
 * - File I/O or file type detection
 * - Business-specific logic
 * 
 * It ONLY handles:
 * - AI keyword generation (SOP-thinking)
 * - Pure text search (instant batch find)
 * - Smart expansion reading (targeted AI analysis)
 * - Sequential fallback reading
 * ================================================================
 */

import { executeFastJsonAI, executeLangChain } from '../ai_agent/logic.service.js';
import { embeddingService } from './embedding.service.js';

// ============================================================
// TEXT UTILITIES
// ============================================================

/**
 * Split text into chunks with sentence boundary awareness.
 * If a chunk cuts mid-sentence, extends to the next sentence-ending punctuation.
 * @param {string} text - Full document text
 * @param {number} maxWords - Max words per chunk (default 1000)
 * @returns {string[]} Array of text chunks
 */
const chunkTextWithBoundary = (text, maxWords = 1000) => {
  const words = text.split(/\s+/);
  const chunks = [];
  let i = 0;

  while (i < words.length) {
    let end = Math.min(i + maxWords, words.length);
    let chunk = words.slice(i, end).join(' ');

    if (end < words.length) {
      const lastChar = chunk.trim().slice(-1);
      if (!['.', '!', '?', '\n'].includes(lastChar)) {
        let extended = 0;
        while (end + extended < words.length && extended < 100) {
          extended++;
          const nextWord = words[end + extended - 1];
          chunk += ' ' + nextWord;
          const endChar = nextWord.trim().slice(-1);
          if (['.', '!', '?'].includes(endChar)) break;
        }
        end += extended;
      }
    }

    chunks.push(chunk);
    i = end;
  }

  return chunks;
};

// ============================================================
// STEP 1: AI "SOP THINKING" KEYWORD GENERATION
// ============================================================

/**
 * Generate document-style search keywords using AI.
 * AI thinks like a SOP/agreement/policy writer — NOT like a customer.
 * No fixed limit on keyword count.
 * 
 * @param {number} tenantId
 * @param {string} question - Customer's question
 * @param {string} docTitle - Document/context title
 * @param {string} summary - Document AI summary
 * @returns {Promise<string[]>} Array of keywords
 */
const generateSearchKeywords = async (tenantId, question, docTitle, summary) => {
  const systemPrompt = `Kamu adalah mesin pencari informasi di dalam dokumen resmi (SOP, agreement, kebijakan, peraturan, syarat & ketentuan, panduan, katalog, modul, buku).

TUGAS: Berdasarkan pertanyaan pelanggan, generate KATA KUNCI dan FRASA SPESIFIK yang kemungkinan besar tertulis di dalam dokumen.

ATURAN KRITIS:
- JANGAN generate kata-kata umum/generik seperti: "untuk", "yang", "dengan", "dari", "ini", "itu", "ada", "bisa", "saja", "juga", "akan", "sudah", "pada", "atau", "dan", "the", "is", "in", "of", "a", "an".
- SETIAP keyword harus BERMAKNA SPESIFIK — jika kata itu berdiri sendiri, apakah ia menunjuk ke topik/konsep tertentu?
- PRIORITASKAN frasa 2-3 kata daripada kata tunggal. Contoh: "belajar mandiri" lebih baik dari "belajar".
- Berpikirlah: kata/frasa apa yang PASTI ADA tertulis di dokumen ini jika dokumen membahas topik yang ditanyakan?
- Sertakan istilah teknis, nama konsep, judul bagian, nomor tahap, label yang mungkin ada di dokumen.
- Sertakan variasi: sinonim, versi singkat, versi panjang.
- JANGAN batasi jumlah — semakin banyak keyword spesifik semakin baik.

Konteks Dokumen:
- Judul: ${docTitle || 'Tidak diketahui'}
- Ringkasan: ${summary || 'Tidak ada ringkasan'}

Output HARUS JSON valid: { "keywords": ["keyword1", "frasa keyword2", ...] }`;

  const prompt = `Pertanyaan pelanggan: "${question}"`;

  // Stop words to filter out
  const STOP_WORDS = new Set([
    'untuk', 'yang', 'dengan', 'dari', 'ini', 'itu', 'ada', 'bisa', 'saja',
    'juga', 'akan', 'sudah', 'pada', 'atau', 'dan', 'oleh', 'ke', 'di',
    'apa', 'bagaimana', 'mengapa', 'kapan', 'dimana', 'siapa', 'berapa',
    'the', 'is', 'in', 'of', 'a', 'an', 'to', 'for', 'and', 'or',
    'tidak', 'bukan', 'belum', 'saya', 'kami', 'kita', 'mereka',
    'very', 'what', 'how', 'when', 'where', 'who',
  ]);

  try {
    const result = await executeFastJsonAI(tenantId, systemPrompt, prompt, [], 'deep_rag');
    if (result?.keywords && Array.isArray(result.keywords) && result.keywords.length > 0) {
      // Post-process: remove single stop words, keep phrases that contain them
      const filtered = result.keywords.filter(kw => {
        const trimmed = kw.trim().toLowerCase();
        if (trimmed.length < 2) return false;
        // If single word, reject if it's a stop word
        if (!trimmed.includes(' ') && STOP_WORDS.has(trimmed)) return false;
        return true;
      });

      console.log(`[DeepRAG] Generated ${filtered.length} keywords (filtered from ${result.keywords.length}) for: "${question}"`);
      return filtered.length > 0 ? filtered : result.keywords;
    }
  } catch (err) {
    console.error('[DeepRAG] Keyword generation failed:', err.message);
  }

  // Minimal fallback: extract significant words, filter stop words
  const fallbackWords = question
    .replace(/[?!.,]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w.toLowerCase()));
  return fallbackWords.length > 0 ? fallbackWords : [question.trim()];
};

// ============================================================
// STEP 2: BATCH FIND (INSTANT — NO AI)
// ============================================================

/**
 * Find ALL occurrences of ALL keywords in the document text.
 * Returns results GROUPED BY KEYWORD (preserving keyword priority order).
 * Each keyword may have multiple positions.
 * 
 * @param {string} fullText - Full document text
 * @param {string[]} keywords - Array of keywords to search (ordered by priority)
 * @returns {{ keyword: string, occurrences: { position: number, length: number }[] }[]}
 */
const batchFindKeywords = (fullText, keywords) => {
  const lowerText = fullText.toLowerCase();
  const results = [];

  for (const kw of keywords) {
    const lowerKw = kw.toLowerCase().trim();
    if (!lowerKw) continue;

    // Find ALL occurrences of this keyword
    const occurrences = [];
    let searchFrom = 0;
    while (searchFrom < lowerText.length) {
      const pos = lowerText.indexOf(lowerKw, searchFrom);
      if (pos === -1) break;
      occurrences.push({ position: pos, length: kw.length });
      searchFrom = pos + lowerKw.length; // move past this match
    }

    if (occurrences.length > 0) {
      results.push({ keyword: kw, occurrences });
    }
  }

  const totalOccurrences = results.reduce((sum, r) => sum + r.occurrences.length, 0);
  console.log(`[DeepRAG] Batch find: ${keywords.length} keywords → ${results.length} matched, ${totalOccurrences} total occurrences`);
  results.forEach(r => console.log(`[DeepRAG]   "${r.keyword}" → ${r.occurrences.length} occurrences`));
  return results;
};

// ============================================================
// STEP 3: EXPAND + ANALYZE (1 AI CALL PER ROUND)
// ============================================================

/**
 * Extract a text range around a match position.
 * @param {string} fullText
 * @param {number} position - Character position of the match
 * @param {number} keywordLength
 * @param {number} upChars - Characters to expand upward
 * @param {number} downChars - Characters to expand downward
 * @returns {{ text: string, start: number, end: number, atDocStart: boolean, atDocEnd: boolean }}
 */
const expandFromPosition = (fullText, position, keywordLength, upChars = 500, downChars = 500) => {
  const start = Math.max(0, position - upChars);
  const end = Math.min(fullText.length, position + keywordLength + downChars);
  return {
    text: fullText.substring(start, end),
    start,
    end,
    atDocStart: start === 0,
    atDocEnd: end === fullText.length,
  };
};

/**
 * Single AI call to analyze the expanded text range (read top-to-bottom).
 * Determines if the answer is found and whether further expansion is needed.
 */
const analyzeExpandedText = async (tenantId, expandedText, question, expansion) => {
  const systemPrompt = `Kamu sedang membaca POTONGAN DOKUMEN untuk mencari jawaban atas pertanyaan pelanggan.
Baca teks di bawah dari AWAL hingga AKHIR secara utuh.

Pertanyaan pelanggan: "${question}"

TUGAS:
1. Apakah jawaban untuk pertanyaan pelanggan ADA di potongan teks ini?
2. Jika DITEMUKAN: berikan jawaban detail berdasarkan teks.
3. Jika BELUM ditemukan tapi ada PETUNJUK (informasi terkait tapi belum lengkap):
   - Periksa ujung ATAS teks: apakah ada kalimat terpotong atau sepertinya paragraf sebelumnya mengandung info?
   - Periksa ujung BAWAH teks: apakah ada kalimat terpotong atau paragraf selanjutnya mengandung info?
4. Jika teks ini TIDAK RELEVAN sama sekali (topik berbeda), katakan dengan jelas.

Output HARUS JSON valid:
{
  "found": true/false,
  "answer": "jawaban detail jika ditemukan",
  "partial_info": "info parsial jika ada tapi belum lengkap",
  "expand_up": true/false,
  "expand_down": true/false,
  "up_reason": "alasan expand ke atas",
  "down_reason": "alasan expand ke bawah"
}`;

  const posInfo = `[Posisi: char ${expansion.start}-${expansion.end}${expansion.atDocStart ? ' (AWAL DOKUMEN)' : ''}${expansion.atDocEnd ? ' (AKHIR DOKUMEN)' : ''}]`;
  const prompt = `${posInfo}\n\nPotongan Dokumen:\n"""\n${expandedText}\n"""`;

  try {
    return await executeFastJsonAI(tenantId, systemPrompt, prompt, [], 'deep_rag');
  } catch (err) {
    console.error('[DeepRAG] Analysis failed:', err.message);
    return null;
  }
};

// ============================================================
// STEP 4: DRILL INTO A KEYWORD MATCH
// ============================================================

/**
 * Drill into a single keyword match with iterative expansion.
 * Each round: expand up+down → read full range with 1 AI call → decide.
 * Max 3 rounds per match, with smart early stopping.
 * 
 * @param {number} tenantId
 * @param {string} fullText
 * @param {{ keyword: string, position: number, length: number }} match
 * @param {string} question
 * @returns {Promise<{ found: boolean, answer?: string }>}
 */
const drillKeywordMatch = async (tenantId, fullText, match, question) => {
  const MAX_ROUNDS = 2;  // Reduced from 3 — vector search handles most cases
  const EXPAND_SIZE = 500;

  let currentUpExtra = 0;
  let currentDownExtra = 0;
  let frozenUp = false;
  let frozenDown = false;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const upChars = EXPAND_SIZE + currentUpExtra;
    const downChars = EXPAND_SIZE + currentDownExtra;

    const expansion = expandFromPosition(fullText, match.position, match.length, upChars, downChars);

    console.log(`[DeepRAG] Drill "${match.keyword}" round ${round + 1}: range ${expansion.start}-${expansion.end} (${expansion.text.length} chars)`);

    const analysis = await analyzeExpandedText(tenantId, expansion.text, question, expansion);

    if (!analysis) {
      console.log(`[DeepRAG] Analysis returned null for round ${round + 1}, skipping`);
      break;
    }

    if (analysis.found && analysis.answer) {
      console.log(`[DeepRAG] ✅ Answer found at keyword "${match.keyword}" round ${round + 1}`);
      return { found: true, answer: analysis.answer };
    }

    const shouldExpandUp = analysis.expand_up && !frozenUp && !expansion.atDocStart;
    const shouldExpandDown = analysis.expand_down && !frozenDown && !expansion.atDocEnd;

    if (!shouldExpandUp && !shouldExpandDown) {
      console.log(`[DeepRAG] No further expansion needed/possible for "${match.keyword}"`);
      break;
    }

    if (!analysis.expand_up || expansion.atDocStart) frozenUp = true;
    if (!analysis.expand_down || expansion.atDocEnd) frozenDown = true;

    if (shouldExpandUp) currentUpExtra += EXPAND_SIZE;
    if (shouldExpandDown) currentDownExtra += EXPAND_SIZE;
  }

  return { found: false };
};

// ============================================================
// STEP 5: SEQUENTIAL FALLBACK
// ============================================================

/**
 * Fallback: read document sequentially in 1000-word chunks.
 * Only runs if keyword search completely fails.
 * Uses sentence boundary awareness to avoid cutting mid-sentence.
 * 
 * @param {number} tenantId
 * @param {string} question
 * @param {string} fullText
 * @returns {Promise<{ found: boolean, answer?: string }>}
 */
const sequentialFallback = async (tenantId, question, fullText) => {
  console.log(`[DeepRAG] Entering sequential fallback for ${fullText.length} chars`);

  const chunks = chunkTextWithBoundary(fullText, 1000);
  const MAX_CHUNKS = Math.min(5, chunks.length);
  let contextHistory = '';

  for (let i = 0; i < MAX_CHUNKS; i++) {
    console.log(`[DeepRAG] Fallback reading chunk ${i + 1}/${chunks.length}...`);

    const systemPrompt = `Kamu sedang membaca dokumen secara bertahap (chunk per chunk).
Pertanyaan pelanggan: "${question}"
Tugas:
1. Cari jawaban untuk pertanyaan tersebut di bagian dokumen ini.
2. Jika jawaban SUDAH DITEMUKAN: kembalikan JSON { "status": "FOUND", "answer": "jawaban detail" }
3. Jika menemukan informasi penting LAINNYA (yang bukan jawaban pertanyaan saat ini tapi mungkin berguna), masukkan ke "extra_insights".
4. Jika kalimat terpotong atau jawaban belum ketemu: kembalikan JSON { "status": "NOT_FOUND", "extra_insights": "..." }

Konteks bacaan sebelumnya: ${contextHistory || 'Belum ada'}

Bagian dokumen saat ini:
"""
${chunks[i]}
"""`;

    const response = await executeFastJsonAI(tenantId, systemPrompt, 'Lakukan pencarian sesuai instruksi.', [], 'deep_rag');

    if (response?.extra_insights) {
      contextHistory += ` [Insight: ${response.extra_insights}]`;
    }

    if (response?.status === 'FOUND' && response.answer) {
      const finalAnswer = response.answer + (contextHistory ? `\n(Info Tambahan: ${contextHistory})` : '');
      console.log(`[DeepRAG] ✅ Fallback found answer in chunk ${i + 1}`);
      return { found: true, answer: finalAnswer };
    }
  }

  return { found: false };
};

// ============================================================
// MAIN ORCHESTRATOR
// ============================================================

/**
 * Main search function: keyword search → vector search → sequential fallback.
 * 
 * @param {number} tenantId
 * @param {string} question - Customer's question
 * @param {string} fullText - Full document text to search
 * @param {{ title?: string, summary?: string, sourceType?: string, sourceId?: number }} context
 * @returns {Promise<{ found: boolean, answer: string | null }>}
 */
const search = async (tenantId, question, fullText, context = {}) => {
  const {
    title = '', summary = '', sourceType = '', sourceId = 0,
    skipKeywordDrill = false,
    vectorOnly = false,  // Stop after Step 1 regardless of result
    skipVector = false,  // Skip Step 1, jump straight to keyword drill
  } = context;

  const modeTag = vectorOnly ? ' [vectorOnly]' : skipVector ? ' [skipVector]' : skipKeywordDrill ? ' [skipKeywordDrill]' : '';
  console.log(`[DeepRAG] Starting search: "${question.substring(0, 80)}" in "${title || 'untitled'}" (${fullText.length} chars)${modeTag}`);

  // ============================================================
  // STEP 1: VECTOR EMBEDDING SEARCH (fastest — multi-query)
  // ============================================================
  if (!skipVector && sourceType && sourceId) {
    console.log(`[DeepRAG] Step 1: Vector embedding search for ${sourceType}:${sourceId}...`);
    try {
      const vectorResult = await embeddingService.searchByEmbedding(tenantId, sourceType, sourceId, question, 7);
      if (vectorResult.found && vectorResult.chunks.length > 0) {
        const combinedChunkText = vectorResult.chunks.map(c => c.text).join('\n\n---\n\n');
        const topScore = vectorResult.chunks[0]?.score || 0;

        // High confidence path — trust the chunks directly
        if (topScore >= 0.80) {
          console.log(`[DeepRAG] ✅ Step 1 HIGH CONFIDENCE (${topScore.toFixed(3)}) — using chunks directly`);
          const directResult = await executeFastJsonAI(tenantId,
            `Potongan dokumen berikut SANGAT RELEVAN dengan pertanyaan pelanggan (skor kemiripan tinggi). Rangkum jawaban dari teks ini secara lengkap dan natural. Kembalikan JSON { "found": true, "answer": "jawaban detail" }. Jika benar-benar tidak ada info yang relevan, kembalikan { "found": false }.`,
            `Pertanyaan: "${question}"\n\nPotongan dokumen relevan:\n\n${combinedChunkText}`,
            [], 'deep_rag'
          );
          if (directResult?.found && directResult.answer) {
            console.log(`[DeepRAG] ✅ Step 1 SUCCESS (high-conf)`);
            return { found: true, answer: directResult.answer };
          }
        }

        // Normal confidence path
        const analysisResult = await executeFastJsonAI(tenantId,
          `Baca potongan-potongan dokumen di bawah ini dan jawab pertanyaan pelanggan.\n\nPETUNJUK PENTING:\n- Potongan ini dipilih karena secara semantik PALING RELEVAN dengan pertanyaan.\n- Jika ada informasi yang dibutuhkan (sebagian ATAU penuh), WAJIB gunakan itu untuk menjawab.\n- Jika potongan berisi TABEL HARGA, DAFTAR TARIF, atau DATA ANGKA yang relevan — SALIN DATA tersebut ke jawaban, jangan hanya mengatakan "ada tabel harga".\n- Jawab "found: true" jika ada informasi yang BISA MEMBANTU menjawab pertanyaan, walau tidak 100% lengkap.\n- Jawab "found: false" HANYA jika potongan benar-benar tentang topik yang SANGAT BERBEDA (contoh: tanya harga, isi dokumen tentang resep masakan).\n- Kembalikan JSON { "found": true, "answer": "jawaban detail termasuk angka/data" } atau { "found": false }.`,
          `Pertanyaan: "${question}"\n\nPotongan dokumen:\n\n${combinedChunkText}`,
          [], 'deep_rag'
        );

        if (analysisResult?.found && analysisResult.answer) {
          console.log(`[DeepRAG] ✅ Step 1 SUCCESS — Vector found answer (top: ${topScore.toFixed(3)})`);
          return { found: true, answer: analysisResult.answer };
        }
        console.log(`[DeepRAG] Step 1 MISS — AI says not relevant (top: ${topScore.toFixed(3)})`);
      } else {
        console.log(`[DeepRAG] Step 1 MISS — No matching chunks above threshold`);
      }
    } catch (vecErr) {
      console.error(`[DeepRAG] Step 1 ERROR:`, vecErr.message);
    }
  } else if (skipVector) {
    console.log(`[DeepRAG] Step 1 SKIP — skipVector=true, jumping to keyword drill`);
  } else {
    console.log(`[DeepRAG] Step 1 SKIP — No sourceType/sourceId provided`);
  }

  // If vectorOnly mode: stop here, don't run keyword drill
  if (vectorOnly) {
    console.log(`[DeepRAG] vectorOnly — stopping after Step 1`);
    return { found: false };
  }

  // ============================================================
  // STEP 2: DEEP RAG KEYWORD DRILL — DISABLED (pure vector only)
  // ============================================================
  console.log(`[DeepRAG] Step 2 DISABLED — keyword drill off, pure vector mode`);

  // ============================================================
  // STEP 3: SEQUENTIAL FALLBACK — DISABLED (pure vector only)
  // ============================================================
  console.log(`[DeepRAG] Step 3 DISABLED — sequential fallback off, pure vector mode`);
  return { found: false };
};

/**
 * Analyze an image using Vision AI to answer a customer question.
 * 
 * @param {number} tenantId
 * @param {string} question - Customer's question
 * @param {string} imagePath - Path to the image (relative to server root, e.g. '/uploads/...')
 * @param {string} contextHint - Optional context about what the image is
 * @returns {Promise<{ found: boolean, answer: string | null }>}
 */
const analyzeImage = async (tenantId, question, imagePath, contextHint = '') => {
  try {
    const prompt = `${contextHint ? contextHint + '\n' : ''}Tolong analisis gambar ini dan carikan jawaban untuk pertanyaan: "${question}".\nJika ada informasi ekstra yang mungkin berguna untuk pelanggan ini nanti, sertakan juga.`;

    const result = await executeLangChain({
      tenantId,
      personaText: 'Kamu adalah pembaca dokumen yang teliti. Jawab HANYA berdasarkan gambar yang diberikan. Jika tidak ada jawaban di gambar, katakan "TIDAK_DITEMUKAN".',
      kbContext: '',
      bankInfo: '',
      userMessage: prompt,
      mediaUrl: imagePath,
      customerContext: null,
      selectedModuleIds: [] // Deep read doesn't need sales prompt modules — core only
    });

    if (!result.includes('TIDAK_DITEMUKAN')) {
      return { found: true, answer: result };
    }

    return { found: false, answer: null };
  } catch (err) {
    console.error(`[DeepRAG] Vision analysis error:`, err.message);
    return { found: false, answer: null };
  }
};

// ============================================================
// PUBLIC EXPORT
// ============================================================

export const deepRagEngine = {
  /**
   * Search for an answer in a text document.
   * Uses: AI keyword generation → instant find → targeted expansion → sequential fallback.
   */
  search,

  /**
   * Analyze an image using Vision AI.
   */
  analyzeImage,

  // Expose internals for advanced usage / testing
  _internals: {
    generateSearchKeywords,
    batchFindKeywords,
    expandFromPosition,
    analyzeExpandedText,
    drillKeywordMatch,
    sequentialFallback,
    chunkTextWithBoundary,
  }
};

export default deepRagEngine;
