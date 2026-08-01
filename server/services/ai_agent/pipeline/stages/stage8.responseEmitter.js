/**
 * ================================================================
 * STAGE 8 — Response Emitter
 * ================================================================
 * Final stage: logs completion metrics.
 * The pipeline engine reads ctx.finalReply & ctx.bubbles for the return value.
 *
 * NOTE: Background summarization is already triggered in Stage 2
 * (contextLoader) based on msg_count_since_summary, so we don't
 * duplicate it here.
 */

export const runStage8ResponseEmitter = async (ctx) => {
  const { tenantId, userPhone, docMediaUrls, conversationState, bubbles } = ctx;

  const elapsed = Date.now() - ctx.startTime;
  console.log(`[Stage8] ✅ Response ready — ${elapsed}ms | state=${conversationState} | bubbles=${bubbles.length} | media=${(docMediaUrls || []).length}`);
};

