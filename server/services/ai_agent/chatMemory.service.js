/**
 * ================================================================
 * CHAT MEMORY SERVICE — Embedding-Based Chat Recall
 * ================================================================
 * 
 * Lapisan memori ke-3 yang melengkapi:
 *   1. Sliding Window (15 chat terakhir — raw)
 *   2. Summarization (ringkasan percakapan tengah)
 *   3. ★ Embedding Recall (vector search chat lama yang relevan)
 * 
 * Cara kerja:
 *   - Setiap pasangan user+assistant chat di-embed sebagai 1 chunk
 *   - Saat pesan baru masuk, embed query → cari chat lama relevan
 *   - Hasilnya dimasukkan ke ctx.longTermMemory
 * 
 * Menggunakan infrastruktur yang sudah ada:
 *   - Tabel: document_chunks (source_type = 'chat_memory')
 *   - Embedding API: embedding.service.js (embedText, cosineSimilarity)
 * ================================================================
 */

import prisma from '../../config/database.js';

// Lazy-load embedding internals to avoid circular deps
let _embedText = null;
let _cosineSimilarity = null;

const getEmbeddingFns = async () => {
  if (!_embedText) {
    const { embeddingService } = await import('../deep_rag_engine/embedding.service.js');
    _embedText = embeddingService._internals.embedText;
    _cosineSimilarity = embeddingService._internals.cosineSimilarity;
  }
  return { embedText: _embedText, cosineSimilarity: _cosineSimilarity };
};

// ============================================================
// EMBED CHAT PAIR (Background, Non-blocking)
// ============================================================

/**
 * Embed a user+assistant chat pair as a single chunk.
 * Called AFTER both messages are saved to ChatHistory.
 * Runs in background — errors are logged but don't affect main flow.
 * 
 * @param {number} tenantId
 * @param {number} leadId - Lead ID (used as source_id)
 * @param {string} userMsg - Customer's message
 * @param {string} assistantMsg - AI's combined reply
 */
export const embedChatPair = async (tenantId, leadId, userMsg, assistantMsg) => {
  try {
    if (!userMsg || !assistantMsg) return;

    // Skip very short exchanges (greetings, "ok", etc.) — not worth embedding
    const combinedLen = (userMsg.length || 0) + (assistantMsg.length || 0);
    if (combinedLen < 50) {
      return;
    }

    const { embedText } = await getEmbeddingFns();

    // Combine user + assistant as a single contextual chunk
    // This captures the full conversational exchange as a retrievable unit
    const chunkText = `Pelanggan: ${userMsg}\nCS: ${assistantMsg}`;

    // Truncate very long messages to keep embedding focused
    const truncated = chunkText.substring(0, 2000);

    const embedding = await embedText(truncated);

    if (!embedding || embedding.length === 0) {
      console.warn('[ChatMemory] Empty embedding returned, skipping.');
      return;
    }

    // Count existing chunks to set chunk_index
    const existingCount = await prisma.document_chunks.count({
      where: { tenant_id: tenantId, source_type: 'chat_memory', source_id: leadId }
    });

    await prisma.document_chunks.create({
      data: {
        tenant_id: tenantId,
        source_type: 'chat_memory',
        source_id: leadId,
        chunk_index: existingCount,
        chunk_text: truncated,
        embedding: JSON.stringify(embedding),
      }
    });

    console.log(`[ChatMemory] ✅ Embedded chat pair #${existingCount} for lead ${leadId} (${truncated.length} chars)`);
  } catch (err) {
    // Non-critical — log and continue
    console.error(`[ChatMemory] Embed error:`, err.message);
  }
};

// ============================================================
// RECALL RELEVANT CHATS (Vector Search)
// ============================================================

/**
 * Search embedded chat history for exchanges relevant to the current query.
 * Uses cosine similarity to find the most semantically related past conversations.
 * 
 * @param {number} tenantId
 * @param {number} leadId
 * @param {string} query - Current customer message
 * @param {number} topK - Max results to return (default 3)
 * @returns {Promise<{ found: boolean, chunks: Array<{text: string, score: number}> }>}
 */
export const recallRelevantChats = async (tenantId, leadId, query, topK = 3) => {
  try {
    const { embedText, cosineSimilarity } = await getEmbeddingFns();

    // Get all chat memory chunks for this lead
    const chunks = await prisma.document_chunks.findMany({
      where: { tenant_id: tenantId, source_type: 'chat_memory', source_id: leadId },
      orderBy: { chunk_index: 'asc' }
    });

    if (chunks.length === 0) {
      return { found: false, chunks: [] };
    }

    // Embed the current query
    const queryEmbedding = await embedText(query);
    if (!queryEmbedding || queryEmbedding.length === 0) {
      return { found: false, chunks: [] };
    }

    // Score each chunk by cosine similarity
    const THRESHOLD = 0.45; // Lower than doc RAG since chat is informal
    const scored = chunks.map(chunk => {
      const chunkEmb = typeof chunk.embedding === 'string'
        ? JSON.parse(chunk.embedding)
        : chunk.embedding;
      return {
        text: chunk.chunk_text,
        score: cosineSimilarity(queryEmbedding, chunkEmb),
        chunkIndex: chunk.chunk_index,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const relevant = scored.filter(c => c.score >= THRESHOLD).slice(0, topK);

    if (relevant.length > 0) {
      console.log(`[ChatMemory] 🔍 Recall for "${query.substring(0, 50)}...": ${relevant.length} relevant (top: ${relevant[0].score.toFixed(3)})`);
    }

    return {
      found: relevant.length > 0,
      chunks: relevant,
    };
  } catch (err) {
    console.error(`[ChatMemory] Recall error:`, err.message);
    return { found: false, chunks: [] };
  }
};

// ============================================================
// CLEANUP
// ============================================================

/**
 * Delete all chat memory embeddings for a specific lead.
 * @param {number} tenantId
 * @param {number} leadId
 */
export const deleteAllChatMemory = async (tenantId, leadId) => {
  try {
    const result = await prisma.document_chunks.deleteMany({
      where: { tenant_id: tenantId, source_type: 'chat_memory', source_id: leadId }
    });
    if (result.count > 0) {
      console.log(`[ChatMemory] Deleted ${result.count} chunks for lead ${leadId}`);
    }
    return result.count;
  } catch (err) {
    console.error(`[ChatMemory] Delete error:`, err.message);
    return 0;
  }
};

/**
 * Delete ALL chat memory embeddings across all leads for a tenant.
 * Used by clear_data.js
 */
export const deleteAllChatMemoryForTenant = async (tenantId) => {
  try {
    const result = await prisma.document_chunks.deleteMany({
      where: { source_type: 'chat_memory', ...(tenantId ? { tenant_id: tenantId } : {}) }
    });
    console.log(`[ChatMemory] Cleared ${result.count} chat memory chunks`);
    return result.count;
  } catch (err) {
    console.error(`[ChatMemory] Tenant cleanup error:`, err.message);
    return 0;
  }
};

export default { embedChatPair, recallRelevantChats, deleteAllChatMemory, deleteAllChatMemoryForTenant };
