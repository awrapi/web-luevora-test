/**
 * ================================================================
 * DOCUMENT READER SERVICE — Product & KB Adapter
 * ================================================================
 * 
 * Thin adapter that connects the domain-agnostic Deep RAG Engine
 * to the Product & Knowledge Base database models.
 * 
 * Responsibilities:
 * - Fetch files from Prisma (PackageMediaFile, KbMediaFile, Advanced files)
 * - Evaluate which documents need deep reading (AI routing)
 * - Delegate actual text search to deepRagEngine.search()
 * - Delegate image analysis to deepRagEngine.analyzeImage()
 * - Manage RagContextCache (read/write/cleanup)
 * 
 * The core search logic lives in: services/deep_rag_engine/index.js
 * ================================================================
 */

import { PrismaClient } from '@prisma/client';
import { executeFastJsonAI } from './logic.service.js';
import { deepRagEngine } from '../deep_rag_engine/index.js';
import { embeddingService } from '../deep_rag_engine/embedding.service.js';
import crypto from 'crypto';

const prisma = new PrismaClient();

// ============================================================
// HELPERS
// ============================================================

/**
 * Compute title-based relevance score for a file based on user's question.
 * This helps correct embedding ranking when semantic similarity is misleading.
 * For example: "anak usia 15 tahun" is semantically closer to "itinerary" but
 * actually needs the "harga/pricelist" file for child policy info.
 *
 * @param {Object} file - File object with ai_title, file_name, context
 * @param {string} userMessage - Customer's question
 * @returns {number} Boost score (0 = no boost, 1 = strong match)
 */
const computeTitleRelevance = (file, userMessage) => {
  const msgLower = userMessage.toLowerCase();
  const titleLower = (file.ai_title || file.file_name || '').toLowerCase();
  const contextLabel = (file.context?.context_label || '').toLowerCase();
  const combined = `${titleLower} ${contextLabel}`;

  let boost = 0;

  // Price/cost keywords in message → boost price/harga files
  const isPriceQuery = /harga|tarif|biaya|price|cost|berapa|bayar|fee|murah|mahal|diskon|per\s*orang|per\s*pax|pax/.test(msgLower);
  const isPriceFile = /harga|price|pricelist|tarif|biaya|cost/.test(combined);
  if (isPriceQuery && isPriceFile) boost += 1.0;

  // Child/family keywords → also boost price files (child policy is usually in price docs)
  const isChildQuery = /anak|child|kid|baby|bayi|balita|keluarga|family|usia|umur|tahun/.test(msgLower);
  if (isChildQuery && isPriceFile) boost += 0.8;

  // Schedule/date keywords → boost itinerary/jadwal files
  const isScheduleQuery = /jadwal|tanggal|kapan|berangkat|schedule|date|itinerary|hari ke/.test(msgLower);
  const isScheduleFile = /jadwal|itinerary|schedule|keberangkatan|hari/.test(combined);
  if (isScheduleQuery && isScheduleFile) boost += 1.0;

  // Facilities/inclusion keywords → boost fasilitas files
  const isFacilityQuery = /fasilitas|include|termasuk|dapat apa|facility|inclusi|exclusi|tidak termasuk/.test(msgLower);
  const isFacilityFile = /fasilitas|include|exclusi|termasuk|inclusi/.test(combined);
  if (isFacilityQuery && isFacilityFile) boost += 1.0;

  // Participant/group size → boost price file (price depends on pax count)
  const isParticipantQuery = /orang|peserta|rombongan|group|berapa orang|istri|suami|keluarga/.test(msgLower);
  if (isParticipantQuery && isPriceFile) boost += 0.5;

  return boost;
};

/**
 * ================================================================
 * HYBRID QUERY DECOMPOSITION — Deterministic + LLM
 * ================================================================
 * 
 * Phase 1 (DETERMINISTIC): Scan the ENTIRE conversation (current msg + chat 
 * history) for information topic keywords. Each detected topic auto-generates 
 * a mandatory search query. This is RELIABLE and never misses.
 *
 * Phase 2 (LLM): Call a fast LLM to add context-specific queries that
 * keywords alone can't catch (e.g., "hitungkan totalnya" → need pricing).
 *
 * Results are merged and deduplicated.
 *
 * Example:
 *   Chat history: "ber4, aku, istri, anak 7 tahun, anak 15 tahun"
 *   Current msg: "bintang 3 aja deh kak"
 *   
 *   Phase 1 (keywords): detects "anak", "7 tahun", "15 tahun", "bintang 3"
 *     → ["kebijakan tarif anak child policy CWB CNB", "tabel harga per orang pax"]
 *   
 *   Phase 2 (LLM): adds context-aware query
 *     → ["harga per orang bintang 3 untuk 4 peserta medium group"]
 *   
 *   Final merged: 3 unique sub-queries
 */

// Topic detection rules: keyword patterns → mandatory search queries
const TOPIC_RULES = [
  {
    name: 'child_policy',
    patterns: [/anak/i, /child/i, /balita/i, /bayi/i, /baby/i, /\busia\b.*\d/i, /\bumur\b.*\d/i, /\b\d+\s*tahun/i, /\bth\b/i, /cwb/i, /cnb/i, /infant/i, /kid/i, /toddler/i],
    queries: ['kebijakan tarif anak child policy CWB CNB usia 3-11 tahun perhitungan biaya anak'],
  },
  {
    name: 'pricing',
    patterns: [/harga/i, /biaya/i, /tarif/i, /price/i, /cost/i, /berapa/i, /bayar/i, /total/i, /hitun/i, /murah/i, /mahal/i, /diskon/i, /promo/i, /budget/i, /tabungan/i, /per\s*orang/i, /per\s*pax/i],
    queries: ['tabel harga per orang pax berdasarkan kategori hotel dan jumlah peserta'],
  },
  {
    name: 'schedule',
    patterns: [/jadwal/i, /tanggal/i, /kapan/i, /berangkat/i, /keberangkatan/i, /departure/i, /schedule/i, /\bdate\b/i, /bulan\b/i],
    queries: ['jadwal keberangkatan tanggal tersedia'],
  },
  {
    name: 'facilities',
    patterns: [/fasilitas/i, /include/i, /termasuk/i, /itinerar/i, /dapat\s*apa/i, /exclude/i, /tidak\s*termasuk/i, /nginap/i, /hotel/i, /penginapan/i, /pesawat/i, /tiket/i, /makan/i, /breakfast/i],
    queries: ['fasilitas termasuk tidak termasuk include exclude itinerary'],
  },
  {
    name: 'cancellation',
    patterns: [/batal/i, /cancel/i, /refund/i, /reschedule/i, /pindah\s*tanggal/i, /ganti\s*tanggal/i, /kebijakan\s*pembatalan/i],
    queries: ['kebijakan pembatalan refund reschedule syarat dan ketentuan'],
  },
  {
    name: 'participants',
    patterns: [/peserta/i, /orang/i, /\bpax\b/i, /rombongan/i, /grup/i, /group/i, /minimum/i, /minimal/i, /\bber\s*\d/i, /keluarga/i, /family/i],
    queries: ['syarat minimum peserta pax kategori grup group'],
  },
  {
    name: 'hotel_category',
    patterns: [/bintang\s*\d/i, /\bstar\b/i, /hotel/i, /standard/i, /deluxe/i, /luxury/i, /kamar/i, /room/i, /twin/i, /single/i],
    queries: ['pilihan kategori hotel bintang 3 4 5 tipe kamar'],
  },
];

/**
 * Phase 1: Deterministic keyword scan on full conversation text
 */
const detectTopicsFromConversation = (userMessage, chatHistorySnippet) => {
  const fullText = `${chatHistorySnippet || ''} ${userMessage}`;
  const detectedTopics = [];
  const mandatoryQueries = [];

  for (const rule of TOPIC_RULES) {
    const matched = rule.patterns.some(p => p.test(fullText));
    if (matched) {
      detectedTopics.push(rule.name);
      mandatoryQueries.push(...rule.queries);
    }
  }

  return { detectedTopics, mandatoryQueries };
};

/**
 * Phase 2: LLM context-aware decomposition (simplified prompt, no keyword rules)
 */
const llmDecompose = async (tenantId, userMessage, chatHistorySnippet) => {
  try {
    const systemPrompt = `Kamu adalah AI analis. Berdasarkan pertanyaan pelanggan DAN konteks percakapan sebelumnya, buat LIST frasa pencarian spesifik untuk mencari informasi di dokumen.

ATURAN:
1. Setiap item = frasa pencarian SPESIFIK (bukan umum).
2. Pertimbangkan konteks SELURUH percakapan, bukan hanya pesan terakhir.
3. Fokus pada informasi KUANTITATIF dan FAKTUAL (angka harga, persentase, tanggal, nama hotel, dll).
4. Maksimal 3 item. Jika pesan hanya sapaan/konfirmasi singkat tanpa kebutuhan data, kembalikan 1 item saja.

Output HANYA JSON valid:
{ "queries": ["frasa pencarian 1", ...] }`;

    const prompt = `Percakapan:\n${chatHistorySnippet || '-'}\n\nPesan terbaru: "${userMessage}"`;
    const result = await executeFastJsonAI(tenantId, systemPrompt, prompt, [], 'document_reader');
    if (result?.queries && Array.isArray(result.queries)) {
      return result.queries.slice(0, 3);
    }
  } catch (err) {
    console.warn('[DocReader] LLM decompose failed:', err.message);
  }
  return [userMessage];
};

/**
 * MAIN: Hybrid query decomposition
 * Combines deterministic keyword detection + LLM context analysis
 */
const decomposeQuery = async (tenantId, userMessage, chatHistorySnippet, fileDescriptions = '') => {
  // Phase 1: Deterministic keyword scan
  const { detectedTopics, mandatoryQueries } = detectTopicsFromConversation(userMessage, chatHistorySnippet);
  console.log(`[DocReader] 🔑 Phase 1 (keywords): detected topics: [${detectedTopics.join(', ')}] → ${mandatoryQueries.length} mandatory queries`);

  // Phase 2: LLM context-aware decomposition
  const llmQueries = await llmDecompose(tenantId, userMessage, chatHistorySnippet);
  console.log(`[DocReader] 🧠 Phase 2 (LLM): ${llmQueries.length} context queries:`, llmQueries);

  // Phase 3: Merge + deduplicate
  const allQueries = [...llmQueries]; // LLM queries first (more specific)
  const seenKeys = new Set(llmQueries.map(q => q.substring(0, 30).toLowerCase()));
  
  for (const mq of mandatoryQueries) {
    const key = mq.substring(0, 30).toLowerCase();
    // Check if LLM already covered this topic
    const alreadyCovered = llmQueries.some(lq => {
      const lqLower = lq.toLowerCase();
      // Check if any significant word from mandatory query appears in LLM query
      const sigWords = mq.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      return sigWords.filter(w => lqLower.includes(w)).length >= 2;
    });
    
    if (!alreadyCovered && !seenKeys.has(key)) {
      allQueries.push(mq);
      seenKeys.add(key);
    }
  }

  // Cap at 5 queries max
  const finalQueries = allQueries.slice(0, 5);
  console.log(`[DocReader] ✅ Final decomposition: ${finalQueries.length} queries (${detectedTopics.length} topics detected)`);
  
  return finalQueries;
};

const hashQuery = (sourceId, query) => {
  return crypto.createHash('sha256').update(`${sourceId}-${query.toLowerCase().trim()}`).digest('hex');
};

/**
 * Execute a deep read on a single file using the engine, with cache support.
 * This is the shared logic for all file types (Package, KB, Advanced).
 */
const cachedDeepRead = async (tenantId, customerPhone, sourceId, question, fullText, fileId, fileIdField, docTitle, summary, options = {}) => {
  const { skipKeywordDrill = false, vectorOnly = false, skipVector = false } = options;
  const queryHash = hashQuery(sourceId, question);

  // 1. Check cache (skip in vectorOnly pass — no point writing partial results)
  if (!vectorOnly) {
    const cached = await prisma.ragContextCache.findUnique({
      where: { uk_tenant_phone_hash: { tenant_id: tenantId, customer_phone: customerPhone, query_hash: queryHash } }
    });
    if (cached) {
      console.log(`[DocReader] Cache hit for "${question.substring(0, 60)}"`);
      return { found: true, answer: cached.answer_text, fromCache: true };
    }
  }

  // Derive sourceType for vector embedding lookup
  const sourceTypeMap = {
    'kb_media_file_id': 'kb_media',
    'package_media_file_id': 'package_media',
    'main_package': 'main_package',
    'sub_item': 'sub_item',
    'addon': 'addon',
  };
  const sourceType = sourceTypeMap[fileIdField] || 'package_media';

  // 2. Delegate to Deep RAG Engine
  const result = await deepRagEngine.search(tenantId, question, fullText, {
    title: docTitle, summary, sourceType, sourceId: fileId,
    skipKeywordDrill, vectorOnly, skipVector
  });

  // 3. Cache only if truly found (not in vectorOnly pass)
  if (result.found && result.answer && !vectorOnly) {
    try {
      const cacheData = {
        tenant_id: tenantId,
        customer_phone: customerPhone,
        query_hash: queryHash,
        answer_text: result.answer,
      };
      if (fileIdField === 'package_media_file_id') cacheData.package_media_file_id = fileId;
      if (fileIdField === 'kb_media_file_id') cacheData.kb_media_file_id = fileId;

      await prisma.ragContextCache.upsert({
        where: { uk_tenant_phone_hash: { tenant_id: tenantId, customer_phone: customerPhone, query_hash: queryHash } },
        update: {
          answer_text: result.answer,
          ...(fileIdField === 'package_media_file_id' ? { package_media_file_id: fileId } : {}),
          ...(fileIdField === 'kb_media_file_id' ? { kb_media_file_id: fileId } : {}),
          created_at: new Date()
        },
        create: cacheData
      });

      // Manage cache volume (max 50 per customer)
      const cacheCount = await prisma.ragContextCache.count({ where: { tenant_id: tenantId, customer_phone: customerPhone } });
      if (cacheCount > 50) {
        const oldest = await prisma.ragContextCache.findMany({
          where: { tenant_id: tenantId, customer_phone: customerPhone },
          orderBy: { created_at: 'asc' },
          take: 10
        });
        if (oldest.length > 0) {
          await prisma.ragContextCache.deleteMany({ where: { id: { in: oldest.map(o => o.id) } } });
        }
      }
    } catch (cacheErr) {
      console.error('[DocReader] Cache save error:', cacheErr.message);
    }
  }

  return { found: result.found, answer: result.answer || null, fromCache: false };
};

/**
 * Process a single file: image → vision, text → deep search.
 * options: { skipKeywordDrill, vectorOnly, skipVector }
 */
const processFile = async (tenantId, customerPhone, sourceId, userMessage, file, fileIdField, docTitle, docSummary, options = {}) => {
  // Image → Vision AI (images are always fully processed, no drill concept)
  if (file.file_type === 'image') {
    if (options.vectorOnly || options.skipVector) return { found: false }; // Skip images in drill-only pass
    // Use Cloudinary URL directly if available, otherwise legacy local path
    const filePath = file.file_path.startsWith('http') ? file.file_path : `/uploads/${file.file_path.replace('uploads/', '')}`;
    const contextHint = `Ini adalah gambar dari lampiran "${docTitle}".`;
    const result = await deepRagEngine.analyzeImage(tenantId, userMessage, filePath, contextHint);

    if (result.found) {
      return { found: true, answer: result.answer, mediaUrl: filePath, fromCache: false };
    }
    return { found: false };
  }

  // Text document → Deep RAG Engine with cache
  if (file.extracted_text && file.extracted_text.trim().length > 0) {
    const readResult = await cachedDeepRead(
      tenantId, customerPhone, sourceId, userMessage,
      file.extracted_text, file.id, fileIdField,
      docTitle, docSummary, options
    );

    if (readResult.found) {
      return {
        found: true,
        answer: readResult.answer,
        mediaUrl: file.file_path.startsWith('http') ? file.file_path : `/uploads/${file.file_path.replace('uploads/', '')}`,
        fromCache: readResult.fromCache
      };
    }
  }

  return { found: false };
};


// ============================================================
// PUBLIC API
// ============================================================

export const documentReaderService = {

  /**
   * Decompose a user question into specific information needs.
   * Returns array of sub-queries for independent searching.
   */
  decomposeQuery,

  /**
   * Evaluate if we need to open any media context for Packages (basic mode).
   */
  evaluateContextNeed: async (tenantId, userMessage, packages, chatHistorySnippet = '') => {
    try {
      const packageIds = packages.map(p => p.id);
      const contexts = await prisma.packageMediaContext.findMany({
        where: { tenant_id: tenantId, travel_package_id: { in: packageIds } },
        include: { files: true }
      });
      if (contexts.length === 0) return [];

      let prompt = `Konteks Percakapan Sebelumnya:\n${chatHistorySnippet || '-'}\n\n`;
      prompt += `Pertanyaan Pelanggan Saat Ini: "${userMessage}"\n\n`;
      prompt += `Berikut adalah daftar dokumen/gambar pendukung (beserta isinya) yang tersedia:\n`;
      contexts.forEach(ctx => {
        prompt += `[KONTEKS: ${ctx.context_label}]\n`;
        ctx.files.forEach(f => {
          prompt += `- File ID ${f.id}: [${f.ai_title || f.file_name}] - Ringkasan: ${f.ai_description || 'Tidak ada ringkasan'}\n`;
        });
      });

      const systemPrompt = `Kamu adalah AI Router untuk CRM assistant. Tugasmu adalah membaca pertanyaan pelanggan dan daftar file dokumen/gambar pendukung yang tersedia.

ATURAN:
- Pilih file yang MUNGKIN mengandung informasi yang dibutuhkan pelanggan untuk menjawab pertanyaannya.
- Pilih file berdasarkan kecocokan antara pertanyaan dengan judul dan ringkasan file.
- JANGAN hanya pilih file jika pelanggan secara eksplisit minta brosur/foto. Pilih juga jika pertanyaan membutuhkan detail yang mungkin ada di dokumen.
- WAJIB pilih file jika pertanyaan tentang: HARGA per orang/pax, TARIF ANAK/child policy, BIAYA detail, syarat minimum peserta, jadwal keberangkatan, apa saja yang termasuk, rute, kebijakan pembatalan, dll.
- Jika pertanyaan tentang ANAK, KELUARGA, atau USIA → WAJIB pilih file harga (child policy biasanya di dokumen harga).
- Hanya kembalikan array kosong jika pertanyaan sangat generik (seperti "ada paket apa saja?") yang tidak membutuhkan detail dokumen.
- Jika ragu, PILIH file — lebih baik membaca dan tidak menemukan jawaban daripada tidak membaca sama sekali.
- Maksimal 3 file ID.

Output HANYA JSON valid: { "selectedFileIds": [1, 2] } atau { "selectedFileIds": [] }`;

      const response = await executeFastJsonAI(tenantId, systemPrompt, prompt, [], 'document_reader');
      return response?.selectedFileIds || [];
    } catch (err) {
      console.error('[DocReader] Error in evaluateContextNeed:', err);
      return [];
    }
  },

  /**
   * Evaluate if we need to open any media context for Knowledge Base.
   */
  evaluateKbContextNeed: async (tenantId, userMessage, kbs, chatHistorySnippet = '') => {
    try {
      const kbIds = kbs.map(k => k.id);
      const contexts = await prisma.kbMediaContext.findMany({
        where: { tenant_id: tenantId, knowledge_base_id: { in: kbIds } },
        include: { files: true }
      });
      if (contexts.length === 0) return [];

      let prompt = `Konteks Percakapan Sebelumnya:\n${chatHistorySnippet || '-'}\n\n`;
      prompt += `Pertanyaan Pelanggan Saat Ini: "${userMessage}"\n\n`;
      prompt += `Berikut adalah daftar dokumen Basis Pengetahuan (beserta isinya) yang tersedia:\n`;
      contexts.forEach(ctx => {
        prompt += `[KONTEKS: ${ctx.context_label}]\n`;
        ctx.files.forEach(f => {
          prompt += `- File ID ${f.id}: [${f.ai_title || f.file_name}] - Ringkasan: ${f.ai_description || 'Tidak ada ringkasan'}\n`;
        });
      });

      const systemPrompt = `Kamu adalah AI Router untuk CRM assistant. Tugasmu adalah membaca pertanyaan pelanggan dan daftar file dokumen basis pengetahuan (SOP, pedoman, syarat & ketentuan).

ATURAN:
- Pilih file yang MUNGKIN mengandung informasi untuk menjawab pertanyaan pelanggan.
- Pilih berdasarkan kecocokan antara pertanyaan dengan judul dan ringkasan file.
- Boleh pilih lebih dari 1 file jika beberapa terlihat relevan (maksimal 3).
- Jika pertanyaan umum yang bisa dijawab dari teks KB saja, kembalikan array kosong.
- Jika ragu, pilih file yang terlihat paling relevan — lebih baik membaca dan tidak menemukan jawaban daripada tidak membaca sama sekali.

Output HANYA JSON valid: { "selectedFileIds": [1, 2] } atau { "selectedFileIds": [] }`;

      const response = await executeFastJsonAI(tenantId, systemPrompt, prompt, [], 'document_reader');
      return response?.selectedFileIds || [];
    } catch (err) {
      console.error('[DocReader] Error in evaluateKbContextNeed:', err);
      return [];
    }
  },

  /**
   * Deep read multiple Package files — TWO-PASS architecture:
   *   Pass 1: Vector-only on ALL ranked files (cheapest path).
   *   Pass 2: Keyword drill on files above threshold ONLY if Pass 1 finds nothing.
   */
  deepReadDocumentFiles: async (tenantId, customerPhone, packageId, fileIds, userMessage) => {
    try {
      const files = await prisma.packageMediaFile.findMany({
        where: { tenant_id: tenantId, id: { in: fileIds } },
        include: { context: true }
      });
      if (files.length === 0) return { found: false };

      console.log(`[DocReader] Deep read Package files (${files.length} file(s)):`, fileIds);

      // === PRE-RANK BY VECTOR SCORE (1 embedding call for all files) ===
      let rankedFiles = [...files];
      const fileScores = {};

      if (files.length > 1) {
        const textFileIds = files.filter(f => f.extracted_text).map(f => f.id);
        if (textFileIds.length > 0) {
          const scores = await embeddingService.preRankFiles(tenantId, 'package_media', textFileIds, userMessage);
          Object.assign(fileScores, scores);
          rankedFiles = [...files].sort((a, b) => (fileScores[b.id] || 0) - (fileScores[a.id] || 0));
          console.log(`[DocReader] Ranked:`, rankedFiles.map(f => `"${f.ai_title || f.file_name}"(${(fileScores[f.id] || 0).toFixed(3)})`).join(' → '));
        }
      }

      const DRILL_THRESHOLD = 0.48;
      const buildResult = (file, result) => ({
        found: true,
        answer: `[Dari File: ${file.ai_title || file.file_name}]: ${result.answer}`,
        mediaUrls: result.mediaUrl ? [result.mediaUrl] : []
      });

      // ─── PASS 1: VECTOR-ONLY across all ranked files (multi-file collect) ──
      // Instead of returning on first hit, collect ALL hits and pick the best
      // based on title relevance to avoid returning wrong file (e.g. itinerary
      // when user asked about pricing/children).
      console.log(`[DocReader] 🔍 Pass 1 — Vector-only scan across ${rankedFiles.length} file(s)`);
      const pass1Candidates = [];
      for (let i = 0; i < rankedFiles.length; i++) {
        const file = rankedFiles[i];
        const score = fileScores[file.id] || 0;
        console.log(`[DocReader] [P1] File ${i + 1}/${rankedFiles.length}: "${file.ai_title || file.file_name}" (${score.toFixed(3)})`);

        const result = await processFile(
          tenantId, customerPhone, packageId, userMessage,
          file, 'package_media_file_id',
          file.context.context_label, file.context.ai_summary,
          { vectorOnly: true }
        );
        if (result.found) {
          const titleBoost = computeTitleRelevance(file, userMessage);
          console.log(`[DocReader] 🎯 [P1] Vector hit on file ${i + 1}, titleBoost=${titleBoost.toFixed(2)}`);
          pass1Candidates.push({ file, result, titleBoost, vectorScore: score });
        }
      }

      if (pass1Candidates.length > 0) {
        // Sort by title relevance first, then vector score as tiebreaker
        pass1Candidates.sort((a, b) => {
          if (b.titleBoost !== a.titleBoost) return b.titleBoost - a.titleBoost;
          return b.vectorScore - a.vectorScore;
        });

        // Collect answers from ALL relevant documents (not just the best one)
        // This ensures child policy from price doc + terms from T&C doc are both included
        const MAX_COLLECT = 3;
        const collected = pass1Candidates.slice(0, MAX_COLLECT);
        const combinedAnswers = collected.map(c => 
          `[Dari File: ${c.file.ai_title || c.file.file_name}]: ${c.result.answer}`
        ).join('\n\n');
        
        // Return full file metadata for correct attachment naming and deduplication
        const combinedMediaFiles = collected.filter(c => c.result.mediaUrl).map(c => ({
          mediaUrl: c.result.mediaUrl,
          filename: c.file.file_name || null,
          updated_at: c.file.updated_at || null,
          id: c.file.id,
          context_id: c.file.context_id || null, // Include context_id for dedup
          ai_summary: c.file.ai_summary || c.file.ai_title || ''
        }));

        console.log(`[DocReader] ✅ [P1] Collected answers from ${collected.length} file(s): ${collected.map(c => `"${c.file.ai_title || c.file.file_name}"`).join(', ')}`);
        return { found: true, answer: combinedAnswers, mediaFiles: combinedMediaFiles };
      }

      // ─── PASS 2: KEYWORD DRILL — DISABLED (pure vector only) ──────────
      console.log(`[DocReader] ❌ Pass 1 miss — keyword drill disabled, returning not found`);
      return { found: false, answer: '', mediaUrls: [] };
    } catch (err) {
      console.error('[DocReader] Error in deepReadDocumentFiles:', err);
      return { found: false };
    }
  },

  /**
   * Deep read Knowledge Base files — same two-pass architecture.
   */
  deepReadKbDocumentFiles: async (tenantId, customerPhone, kbId, fileIds, userMessage) => {
    try {
      const files = await prisma.kbMediaFile.findMany({
        where: { tenant_id: tenantId, id: { in: fileIds } },
        include: { context: true }
      });
      if (files.length === 0) return { found: false };

      console.log(`[DocReader] Deep read KB files (${files.length} file(s)):`, fileIds);

      let rankedFiles = [...files];
      const fileScores = {};

      if (files.length > 1) {
        const textFileIds = files.filter(f => f.extracted_text).map(f => f.id);
        if (textFileIds.length > 0) {
          const scores = await embeddingService.preRankFiles(tenantId, 'kb_media', textFileIds, userMessage);
          Object.assign(fileScores, scores);
          rankedFiles = [...files].sort((a, b) => (fileScores[b.id] || 0) - (fileScores[a.id] || 0));
          console.log(`[DocReader] KB ranked:`, rankedFiles.map(f => `"${f.ai_title || f.file_name}"(${(fileScores[f.id] || 0).toFixed(3)})`).join(' → '));
        }
      }

      const DRILL_THRESHOLD = 0.48;
      const buildResult = (file, result) => ({
        found: true,
        answer: `[Dari File: ${file.ai_title || file.file_name}]: ${result.answer}`,
        mediaUrls: result.mediaUrl ? [result.mediaUrl] : []
      });

      // PASS 1: Vector-only (multi-file collect, same as package deep read)
      console.log(`[DocReader] 🔍 KB Pass 1 — Vector-only across ${rankedFiles.length} file(s)`);
      const pass1Candidates = [];
      for (let i = 0; i < rankedFiles.length; i++) {
        const file = rankedFiles[i];
        const score = fileScores[file.id] || 0;
        console.log(`[DocReader] [P1-KB] File ${i + 1}/${rankedFiles.length}: "${file.ai_title || file.file_name}" (${score.toFixed(3)})`);

        const result = await processFile(
          tenantId, customerPhone, kbId, userMessage,
          file, 'kb_media_file_id',
          file.context.context_label, file.context.ai_summary,
          { vectorOnly: true }
        );
        if (result.found) {
          const titleBoost = computeTitleRelevance(file, userMessage);
          console.log(`[DocReader] 🎯 [P1-KB] Vector hit on file ${i + 1}, titleBoost=${titleBoost.toFixed(2)}`);
          pass1Candidates.push({ file, result, titleBoost, vectorScore: score });
        }
      }

      if (pass1Candidates.length > 0) {
        pass1Candidates.sort((a, b) => {
          if (b.titleBoost !== a.titleBoost) return b.titleBoost - a.titleBoost;
          return b.vectorScore - a.vectorScore;
        });

        // Collect answers from ALL relevant KB documents (not just the best one)
        const MAX_COLLECT = 3;
        const collected = pass1Candidates.slice(0, MAX_COLLECT);
        const combinedAnswers = collected.map(c => 
          `[Dari File: ${c.file.ai_title || c.file.file_name}]: ${c.result.answer}`
        ).join('\n\n');
        
        // Return full file metadata
        const combinedMediaFiles = collected.filter(c => c.result.mediaUrl).map(c => ({
          mediaUrl: c.result.mediaUrl,
          filename: c.file.file_name || null,
          updated_at: c.file.updated_at || null,
          id: c.file.id,
          context_id: c.file.context_id || null, // Include context_id for dedup
          ai_summary: c.file.ai_summary || c.file.ai_title || ''
        }));

        console.log(`[DocReader] ✅ [P1-KB] Collected answers from ${collected.length} file(s): ${collected.map(c => `"${c.file.ai_title || c.file.file_name}"`).join(', ')}`);
        return { found: true, answer: combinedAnswers, mediaFiles: combinedMediaFiles };
      }

      // PASS 2: Keyword drill — DISABLED (pure vector only)
      console.log(`[DocReader] ❌ KB Pass 1 miss — keyword drill disabled, returning not found`);
      return { found: false, answer: '', mediaUrls: [] };
    } catch (err) {
      console.error('[DocReader] Error in KB deep read files:', err);
      return { found: false };
    }
  },

  /**
   * Deep read KB "direct" file (uploaded via media_path in the KB form).
   * Searches document_chunks with source_type='kb_direct' and source_id=kbId.
   * Used when a KB topic has a media_path attachment with extracted text.
   */
  deepReadKbDirectFile: async (tenantId, customerPhone, kbId, kbTitle, mediaPath, userMessage) => {
    try {
      console.log(`[DocReader] Deep read KB direct file for topic ${kbId}: "${userMessage}"`);

      // 1. Try vector embedding search first (fastest)
      const vectorResult = await embeddingService.searchByEmbedding(tenantId, 'kb_direct', kbId, userMessage, 3);
      if (vectorResult.found && vectorResult.chunks.length > 0) {
        const combinedText = vectorResult.chunks.map(c => c.text).join('\n\n---\n\n');
        const analysisResult = await executeFastJsonAI(
          tenantId,
          `Baca potongan dokumen ini dan jawab pertanyaan pelanggan. Jika jawaban DITEMUKAN, kembalikan JSON { "found": true, "answer": "jawaban detail" }. Jika tidak relevan, kembalikan { "found": false }.`,
          `Pertanyaan: "${userMessage}"\n\nPotongan dokumen:\n${combinedText}`
        );
        if (analysisResult?.found && analysisResult.answer) {
          console.log(`[DocReader] ✅ KB direct vector search found answer for topic ${kbId}`);
          const mediaUrl = mediaPath?.startsWith('http') ? mediaPath : `/uploads/${(mediaPath || '').replace('uploads/', '')}`;
          return { found: true, answer: analysisResult.answer, mediaUrl };
        }
        console.log(`[DocReader] KB direct vector search: chunks found but not relevant`);
      } else {
        console.log(`[DocReader] KB direct vector search: no chunks found for kb_direct:${kbId}`);
      }

      return { found: false };
    } catch (err) {
      console.error('[DocReader] Error in deepReadKbDirectFile:', err);
      return { found: false };
    }
  },

  // ============================================================
  // ADVANCED PACKAGES
  // ============================================================

  /**
   * Evaluate if we need to deep-read any advanced package files.
   * Scans MainPackageMediaFile, SubItemMediaFile, and AddonMediaFile.
   */
  evaluateAdvancedContextNeed: async (tenantId, userMessage, chatHistorySnippet = '') => {
    try {
      const mainFiles = await prisma.mainPackageMediaFile.findMany({
        where: { tenant_id: tenantId },
        include: { package: { select: { id: true, title: true, status: true, ai_summary: true, context_description: true } } }
      });

      const subFiles = await prisma.subItemMediaFile.findMany({
        where: { tenant_id: tenantId },
        include: { sub_item: { select: { id: true, title: true, status: true, ai_summary: true, context_description: true, package: { select: { title: true, status: true } } } } }
      });

      const addonFiles = await prisma.addonMediaFile.findMany({
        where: { tenant_id: tenantId },
        include: { addon: { select: { id: true, title: true, status: true, ai_summary: true, context_description: true, package: { select: { title: true, status: true } } } } }
      });

      const fileIndex = [];

      for (const f of mainFiles) {
        const pkg = f.package;
        if (pkg?.status !== 'active') continue;
        if (!f.extracted_text && f.file_type !== 'image') continue;
        fileIndex.push({
          id: `MAIN_${f.id}`,
          label: `[Paket Utama: ${pkg.title}] File: ${f.file_name}`,
          summary: pkg.ai_summary || pkg.context_description || 'Tidak ada ringkasan',
          _ref: { fileId: f.id, table: 'main', packageTitle: pkg.title, packageSummary: pkg.ai_summary || pkg.context_description, filePath: f.file_path, fileType: f.file_type, extractedText: f.extracted_text, parentId: pkg.id }
        });
      }

      for (const f of subFiles) {
        const sub = f.sub_item;
        if (sub?.status !== 'active' || sub?.package?.status !== 'active') continue;
        if (!f.extracted_text && f.file_type !== 'image') continue;
        fileIndex.push({
          id: `SUB_${f.id}`,
          label: `[Paket: ${sub.package.title} → Sub Item: ${sub.title}] File: ${f.file_name}`,
          summary: sub.ai_summary || sub.context_description || 'Tidak ada ringkasan',
          _ref: { fileId: f.id, table: 'sub', packageTitle: `${sub.package.title} - ${sub.title}`, packageSummary: sub.ai_summary || sub.context_description, filePath: f.file_path, fileType: f.file_type, extractedText: f.extracted_text, parentId: sub.id }
        });
      }

      for (const f of addonFiles) {
        const addon = f.addon;
        if (addon?.status !== 'active' || addon?.package?.status !== 'active') continue;
        if (!f.extracted_text && f.file_type !== 'image') continue;
        fileIndex.push({
          id: `ADDON_${f.id}`,
          label: `[Paket: ${addon.package.title} → Addon: ${addon.title}] File: ${f.file_name}`,
          summary: addon.ai_summary || addon.context_description || 'Tidak ada ringkasan',
          _ref: { fileId: f.id, table: 'addon', packageTitle: `${addon.package.title} - ${addon.title}`, packageSummary: addon.ai_summary || addon.context_description, filePath: f.file_path, fileType: f.file_type, extractedText: f.extracted_text, parentId: addon.id }
        });
      }

      if (fileIndex.length === 0) return [];

      let prompt = `Konteks Percakapan Sebelumnya:\n${chatHistorySnippet || '-'}\n\n`;
      prompt += `Pertanyaan Pelanggan Saat Ini: "${userMessage}"\n\n`;
      prompt += `Berikut adalah daftar file dokumen pendukung produk/layanan advance:\n`;
      fileIndex.forEach(f => {
        prompt += `- ID ${f.id}: ${f.label} - Ringkasan: ${f.summary}\n`;
      });

      const systemPrompt = `Kamu adalah AI Router. Tugasmu adalah membaca pertanyaan pelanggan dan daftar file dokumen pendukung produk/layanan advance.

ATURAN:
- Pilih file yang MUNGKIN mengandung informasi yang dibutuhkan untuk MENJAWAB pertanyaan pelanggan.
- Pilih berdasarkan kecocokan antara pertanyaan dengan judul dan ringkasan file.
- WAJIB pilih file jika pertanyaan membutuhkan detail yang mungkin ada di dokumen (harga, tarif anak/child policy, syarat & ketentuan, jadwal, fasilitas, apa yang termasuk, dll).
- Jika pertanyaan tentang HARGA, TARIF, atau BIAYA → pilih file yang berkaitan dengan harga/pricelist.
- Jika pertanyaan tentang ANAK, KELUARGA, atau PESERTA → pilih file harga (child policy biasanya di dokumen harga) DAN file syarat ketentuan.
- Jika pertanyaan sangat umum seperti "ada paket apa?" yang bisa dijawab dari teks saja, kembalikan array kosong.
- Jika ragu, PILIH file — lebih baik membaca dan tidak menemukan jawaban daripada tidak membaca sama sekali.

Jika memang diperlukan, kembalikan ID file yang paling relevan (maksimal 3 ID).
Output HANYA JSON valid: { "selectedFileIds": ["MAIN_1", "SUB_3"] } atau { "selectedFileIds": [] }`;

      const response = await executeFastJsonAI(tenantId, systemPrompt, prompt, [], 'document_reader');
      const selectedIds = response?.selectedFileIds || [];

      return selectedIds
        .map(id => fileIndex.find(f => f.id === id)?._ref)
        .filter(Boolean);

    } catch (err) {
      console.error('[DocReader] Error evaluating advanced context:', err);
      return [];
    }
  },

  /**
   * Deep read an Advanced Package file.
   */
  deepReadAdvancedDocument: async (tenantId, customerPhone, fileRef, userMessage) => {
    try {
      console.log(`[DocReader] Deep read Advanced ${fileRef.table} file ${fileRef.fileId} (${fileRef.packageTitle})`);

      // Construct a file-like object for processFile
      const fileObj = {
        id: fileRef.fileId,
        file_type: fileRef.fileType,
        file_path: fileRef.filePath,
        extracted_text: fileRef.extractedText,
      };

      // Map table name to source_type for vector embedding
      const advSourceTypeMap = { 'main': 'main_package', 'sub': 'sub_item', 'addon': 'addon' };
      const advFileIdField = advSourceTypeMap[fileRef.table] || 'package_media_file_id';

      return await processFile(
        tenantId, customerPhone,
        `adv_${fileRef.table}_${fileRef.parentId}`,
        userMessage, fileObj,
        advFileIdField,
        fileRef.packageTitle, fileRef.packageSummary
      );

    } catch (err) {
      console.error('[DocReader] Error in advanced deep read:', err);
      return { found: false };
    }
  }
};
