/**
 * ================================================================
 * EMBEDDING SERVICE — Vector Embedding for Deep RAG Engine
 * ================================================================
 * 
 * Handles:
 * - Text chunking with sentence boundary awareness
 * - Embedding generation via ANY OpenAI-compatible API
 * - Storage of chunks + embeddings in MySQL (JSON column)
 * - Cosine similarity search for semantic matching
 * - CRUD operations for document chunks
 * 
 * ENV Configuration (semua bisa diganti ke provider apapun):
 *   EMBEDDING_API_URL  = endpoint API (format OpenAI-compatible)
 *   EMBEDDING_API_KEY  = API key (fallback ke EDENAI_API_KEY / OPENAI_API_KEY)
 *   EMBEDDING_MODEL    = nama model embedding
 * 
 * Contoh Konfigurasi:
 *   EdenAI:    URL=https://api.edenai.run/v3/embeddings    MODEL=google/textembedding-gecko@003
 *   OpenAI:    URL=https://api.openai.com/v1/embeddings    MODEL=text-embedding-3-small
 *   OpenRouter: URL=https://openrouter.ai/api/v1/embeddings MODEL=openai/text-embedding-3-small
 *   Together:  URL=https://api.together.xyz/v1/embeddings   MODEL=togethercomputer/m2-bert-80M-8k-retrieval
 *   Local:     URL=http://localhost:11434/v1/embeddings      MODEL=nomic-embed-text
 * ================================================================
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================
// TEXT CHUNKING
// ============================================================

/**
 * Split text into chunks with sentence boundary awareness.
 * @param {string} text - Full document text
 * @param {number} maxWords - Max words per chunk (default 500)
 * @returns {string[]} Array of text chunks
 */
const chunkText = (text, maxWords = 500, overlapWords = 50) => {
  if (!text || text.trim().length === 0) return [];

  const words = text.split(/\s+/);
  const chunks = [];
  let i = 0;

  while (i < words.length) {
    let end = Math.min(i + maxWords, words.length);
    let chunk = words.slice(i, end).join(' ');

    // Extend to sentence boundary if cut mid-sentence
    if (end < words.length) {
      const lastChar = chunk.trim().slice(-1);
      if (!['.', '!', '?', '\n'].includes(lastChar)) {
        let extended = 0;
        while (end + extended < words.length && extended < 80) {
          extended++;
          const nextWord = words[end + extended - 1];
          chunk += ' ' + nextWord;
          const endChar = nextWord.trim().slice(-1);
          if (['.', '!', '?'].includes(endChar)) break;
        }
        end += extended;
      }
    }

    chunks.push(chunk.trim());
    
    // Move forward, but step back by overlapWords to create a sliding window
    // Ensure we don't get stuck in an infinite loop if overlap >= chunk size
    if (end >= words.length) break;
    i = end - overlapWords;
    if (i <= 0) i = end; // Fallback to avoid infinite loop on first iteration
  }

  return chunks;
};

// ============================================================
// EMBEDDING API — Universal OpenAI-Compatible
// ============================================================

/**
 * Generate embedding vector for a single text.
 * Works with ANY provider that supports OpenAI-compatible /embeddings endpoint.
 * 
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} Embedding vector (array of floats)
 */
const embedText = async (text) => {
  const apiUrl = process.env.EMBEDDING_API_URL || 'https://api.edenai.run/v3/embeddings';
  const apiKey = process.env.EMBEDDING_API_KEY || process.env.EDENAI_API_KEY || process.env.OPENAI_API_KEY;
  const model = process.env.EMBEDDING_MODEL || 'google/textembedding-gecko@003';

  if (!apiKey) {
    throw new Error('[Embedding] No API key configured. Set EMBEDDING_API_KEY in .env');
  }

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      input: text.substring(0, 8000) // Safety truncate
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[Embedding] API error ${res.status} from ${apiUrl}: ${errText}`);
  }

  const data = await res.json();
  const embedding = data?.data?.[0]?.embedding || [];

  if (embedding.length === 0) {
    console.warn(`[Embedding] Empty embedding returned from ${apiUrl} (model: ${model})`);
  }

  return embedding;
};

// ============================================================
// COSINE SIMILARITY
// ============================================================

/**
 * Calculate cosine similarity between two vectors.
 * @param {number[]} a 
 * @param {number[]} b 
 * @returns {number} Similarity score (0-1, higher = more similar)
 */
const cosineSimilarity = (a, b) => {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
};

// ============================================================
// PUBLIC API
// ============================================================

export const embeddingService = {

  /**
   * Chunk a document and store embeddings in the database.
   * Called during document upload (runs in parallel with AI summary).
   * 
   * @param {number} tenantId
   * @param {string} sourceType - 'package_media' | 'kb_media' | 'main_package' | 'sub_item' | 'addon'
   * @param {number} sourceId - ID of the source record
   * @param {string} fullText - Full extracted text from the document
   */
  chunkAndEmbed: async (tenantId, sourceType, sourceId, fullText) => {
    if (!fullText || fullText.trim().length < 50) {
      console.log(`[Embedding] Skipping — text too short (${fullText?.length || 0} chars)`);
      return;
    }

    try {
      console.log(`[Embedding] Starting chunk & embed for ${sourceType}:${sourceId} (${fullText.length} chars)`);

      // Delete existing chunks for this source (re-upload scenario)
      await prisma.document_chunks.deleteMany({
        where: { tenant_id: tenantId, source_type: sourceType, source_id: sourceId }
      });

      // Chunk the text
      const chunks = chunkText(fullText, 500);
      console.log(`[Embedding] Created ${chunks.length} chunks`);

      // Embed each chunk and save to DB
      for (let i = 0; i < chunks.length; i++) {
        try {
          const embedding = await embedText(chunks[i]);

          await prisma.document_chunks.create({
            data: {
              tenant_id: tenantId,
              source_type: sourceType,
              source_id: sourceId,
              chunk_index: i,
              chunk_text: chunks[i],
              embedding: JSON.stringify(embedding),
            }
          });
        } catch (chunkErr) {
          console.error(`[Embedding] Failed to embed chunk ${i}:`, chunkErr.message);
          // Continue with remaining chunks
        }
      }

      console.log(`[Embedding] ✅ Completed ${chunks.length} chunks for ${sourceType}:${sourceId}`);
    } catch (err) {
      console.error(`[Embedding] Error in chunkAndEmbed:`, err.message);
    }
  },

  /**
   * Search for relevant chunks using vector similarity.
   * Returns the most similar chunks with their text for AI analysis.
   * 
   * @param {number} tenantId
   * @param {string} sourceType
   * @param {number} sourceId
   * @param {string} question - Customer's question
   * @param {number} topK - Number of top results to return (default 3)
   * @returns {Promise<{ found: boolean, chunks: Array<{text: string, score: number}> }>}
   */
  searchByEmbedding: async (tenantId, sourceType, sourceId, question, topK = 7) => {
    try {
      // Get all chunks for this source (include index for adjacent context)
      const chunks = await prisma.document_chunks.findMany({
        where: { tenant_id: tenantId, source_type: sourceType, source_id: sourceId },
        orderBy: { chunk_index: 'asc' }
      });

      if (chunks.length === 0) {
        console.log(`[Embedding] No chunks found for ${sourceType}:${sourceId}`);
        return { found: false, chunks: [] };
      }

      // Build a map for fast adjacent chunk lookup
      const chunkByIndex = {};
      chunks.forEach(c => { chunkByIndex[c.chunk_index] = c; });

      // === MULTI-QUERY EXPANSION ===
      // Generate 2 rewritten query variants to improve recall for
      // cases where user phrasing differs from document wording.
      let queryVariants = [question];
      try {
        const { executeFastJsonAI } = await import('../ai_agent/logic.service.js');
        const expansionResult = await executeFastJsonAI(
          tenantId,
          `Kamu adalah mesin pencari dokumen. Tugas kamu: tulis ulang pertanyaan pelanggan menjadi 2 variasi query pencarian yang berbeda phrasing-nya, agar bisa mencocokkan teks dokumen formal (SOP, pricelist, syarat & ketentuan, panduan, katalog).\n\nAturan:\n- Variasi 1: phrasing formal/teknis seperti yang tertulis di dokumen\n- Variasi 2: phrasing singkat berupa kata kunci/frasa inti\n- JANGAN tambahkan informasi baru di luar pertanyaan\n\nOutput HANYA JSON: { "variants": ["variasi1", "variasi2"] }`,
          `Pertanyaan pelanggan: "${question}"`,
          [], 'embedding_expansion'
        );
        if (expansionResult?.variants?.length >= 2) {
          queryVariants = [question, ...expansionResult.variants.slice(0, 2)];
          console.log(`[Embedding] Multi-query variants: ${queryVariants.length} queries`);
        }
      } catch (expansionErr) {
        console.warn(`[Embedding] Query expansion skipped:`, expansionErr.message);
      }

      // === EMBED ALL QUERIES ===
      const queryEmbeddings = await Promise.all(queryVariants.map(q => embedText(q).catch(() => null)));
      const validEmbeddings = queryEmbeddings.filter(Boolean);

      // === SCORE EACH CHUNK (max score across all query variants) ===
      const THRESHOLD = 0.45;
      const scoreMap = {}; // chunkIndex → best score

      for (const queryEmb of validEmbeddings) {
        for (const chunk of chunks) {
          const chunkEmb = typeof chunk.embedding === 'string'
            ? JSON.parse(chunk.embedding)
            : chunk.embedding;
          const score = cosineSimilarity(queryEmb, chunkEmb);
          if (!scoreMap[chunk.chunk_index] || score > scoreMap[chunk.chunk_index]) {
            scoreMap[chunk.chunk_index] = score;
          }
        }
      }

      // Build scored list
      const scored = chunks.map(chunk => ({
        text: chunk.chunk_text,
        score: scoreMap[chunk.chunk_index] || 0,
        chunkIndex: chunk.chunk_index,
      }));

      scored.sort((a, b) => b.score - a.score);
      const topChunks = scored.slice(0, topK);
      const relevantChunks = topChunks.filter(c => c.score >= THRESHOLD);

      console.log(`[Embedding] Search results for "${question.substring(0, 50)}...": ${relevantChunks.length}/${chunks.length} chunks above threshold (top: ${topChunks[0]?.score.toFixed(3)})`);

      if (relevantChunks.length === 0) {
        return { found: false, chunks: [] };
      }

      // === ADJACENT CONTEXT INJECTION ===
      // For each top chunk, also include immediate neighbors (prev/next)
      // so the AI has full context without mid-sentence cuts.
      const augmentedTexts = [];
      const seenIndexes = new Set();

      for (const chunk of relevantChunks) {
        const idxSet = [chunk.chunkIndex - 1, chunk.chunkIndex, chunk.chunkIndex + 1];
        const parts = [];
        for (const idx of idxSet) {
          if (idx >= 0 && chunkByIndex[idx] && !seenIndexes.has(idx)) {
            parts.push(chunkByIndex[idx].chunk_text);
            seenIndexes.add(idx);
          }
        }
        if (parts.length > 0) {
          augmentedTexts.push(parts.join(' '));
        }
      }

      return {
        found: true,
        chunks: augmentedTexts.map((text, i) => ({
          text,
          score: relevantChunks[i]?.score || 0,
        })),
      };
    } catch (err) {
      console.error(`[Embedding] Search error:`, err.message);
      return { found: false, chunks: [] };
    }
  },

  /**
   * Search across ALL documents of a tenant for a given source type.
   * Used when we don't know which specific document contains the answer.
   * 
   * @param {number} tenantId
   * @param {string} sourceType
   * @param {string} question
   * @param {number} topK
   */
  searchAcrossDocuments: async (tenantId, sourceType, question, topK = 3) => {
    try {
      const chunks = await prisma.document_chunks.findMany({
        where: { tenant_id: tenantId, source_type: sourceType },
        orderBy: { chunk_index: 'asc' }
      });

      if (chunks.length === 0) {
        return { found: false, chunks: [] };
      }

      const questionEmbedding = await embedText(question);

      const scored = chunks.map(chunk => {
        const chunkEmbedding = typeof chunk.embedding === 'string' 
          ? JSON.parse(chunk.embedding) 
          : chunk.embedding;
        return {
          text: chunk.chunk_text,
          score: cosineSimilarity(questionEmbedding, chunkEmbedding),
          sourceId: chunk.source_id,
          chunkIndex: chunk.chunk_index,
        };
      });

      scored.sort((a, b) => b.score - a.score);
      const topChunks = scored.slice(0, topK);
      const relevantChunks = topChunks.filter(c => c.score >= 0.65);

      console.log(`[Embedding] Cross-doc search: ${relevantChunks.length}/${chunks.length} chunks (top: ${topChunks[0]?.score.toFixed(3)})`);

      return {
        found: relevantChunks.length > 0,
        chunks: relevantChunks,
      };
    } catch (err) {
      console.error(`[Embedding] Cross-doc search error:`, err.message);
      return { found: false, chunks: [] };
    }
  },

  /**
   * Pre-rank multiple files by vector similarity using a SINGLE embedding call.
   * No multi-query expansion — optimized for speed.
   * Used to sort files before deep reading, so the most relevant file is searched first.
   *
   * @param {number} tenantId
   * @param {string} sourceType - e.g. 'package_media' | 'kb_media'
   * @param {number[]} fileIds - List of file IDs to rank
   * @param {string} question - Customer's question
   * @returns {Promise<Record<number, number>>} Map of fileId → best chunk score
   */
  preRankFiles: async (tenantId, sourceType, fileIds, question) => {
    if (!fileIds || fileIds.length === 0) return {};
    try {
      // Fetch all chunks from all candidate files in ONE query
      const allChunks = await prisma.document_chunks.findMany({
        where: { tenant_id: tenantId, source_type: sourceType, source_id: { in: fileIds } }
      });
      if (allChunks.length === 0) {
        console.log(`[Embedding] preRankFiles: no chunks found for fileIds [${fileIds.join(',')}]`);
        return {};
      }

      // Single embedding call for the question
      const questionEmbedding = await embedText(question);

      // Score each chunk, keep best score per file
      const fileScores = {};
      for (const chunk of allChunks) {
        const chunkEmb = typeof chunk.embedding === 'string'
          ? JSON.parse(chunk.embedding)
          : chunk.embedding;
        const score = cosineSimilarity(questionEmbedding, chunkEmb);
        if (!fileScores[chunk.source_id] || score > fileScores[chunk.source_id]) {
          fileScores[chunk.source_id] = score;
        }
      }

      console.log(`[Embedding] preRankFiles result:`, Object.entries(fileScores).map(([id, s]) => `file:${id}=${s.toFixed(3)}`).join(', '));
      return fileScores;
    } catch (err) {
      console.error('[Embedding] preRankFiles error:', err.message);
      return {};
    }
  },

  /**
   * Delete all chunks for a specific source.
   * Called when a document/file is deleted.
   */
  deleteChunks: async (tenantId, sourceType, sourceId) => {
    try {
      const result = await prisma.document_chunks.deleteMany({
        where: { tenant_id: tenantId, source_type: sourceType, source_id: sourceId }
      });
      console.log(`[Embedding] Deleted ${result.count} chunks for ${sourceType}:${sourceId}`);
      return result.count;
    } catch (err) {
      console.error(`[Embedding] Delete error:`, err.message);
      return 0;
    }
  },

  // Expose for testing
  _internals: { chunkText, embedText, cosineSimilarity }
};

export default embeddingService;
