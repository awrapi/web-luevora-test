/**
 * ================================================================
 * PIPELINE ENGINE — Main orchestrator for AI conversation flow
 * ================================================================
 *
 * Entry point: handler.service.js → runPipeline()
 *
 * The engine runs each stage in sequence. Each stage mutates the shared
 * context and sets ctx.decision to control flow:
 *
 *   'continue'  → proceed to next stage (normal)
 *   'hold'      → stop, return ctx.holdResponse to customer
 *   'rollback'  → re-run from ctx.rollbackToStage (max 2 times)
 *   'abort'     → stop, throw ctx.abortError
 */

import { createPipelineContext, STAGE_INDEX } from './pipeline.context.js';
import { runStage1PreValidation }  from './stages/stage1.preValidation.js';
import { runStage2ContextLoader }  from './stages/stage2.contextLoader.js';
import { runStage3StateResolver }  from './stages/stage3.stateResolver.js';
import { runStage4RagPipeline }    from './stages/stage4.ragPipeline.js';
import { runStage5PromptAssembler }from './stages/stage5.promptAssembler.js';
import { runStage6AIExecution }    from './stages/stage6.aiExecution.js';
import { runStage7PostProcessor }  from './stages/stage7.postProcessor.js';
import { runStage8ResponseEmitter }from './stages/stage8.responseEmitter.js';
import { broadcast } from '../../shared/sse.service.js';
import { setPipelineProgress, clearPipelineProgress, checkAbortSignal, clearAbortSignal } from '../pipelineProgress.service.js';
import { stopWatching } from '../gatekeeperWatcher.service.js';

/** Ordered list of [stageIndex, stageFn, stageName] */
const STAGES = [
  [STAGE_INDEX.PRE_VALIDATION,   runStage1PreValidation,   'PreValidation'],
  [STAGE_INDEX.CONTEXT_LOADER,   runStage2ContextLoader,   'ContextLoader'],
  [STAGE_INDEX.STATE_RESOLVER,   runStage3StateResolver,   'StateResolver'],
  [STAGE_INDEX.RAG_PIPELINE,     runStage4RagPipeline,     'RagPipeline'],
  [STAGE_INDEX.PROMPT_ASSEMBLER, runStage5PromptAssembler, 'PromptAssembler'],
  [STAGE_INDEX.AI_EXECUTION,     runStage6AIExecution,     'AIExecution'],
  [STAGE_INDEX.POST_PROCESSOR,   runStage7PostProcessor,   'PostProcessor'],
  [STAGE_INDEX.RESPONSE_EMITTER, runStage8ResponseEmitter, 'ResponseEmitter'],
];

const MAX_ROLLBACKS = 2;

/**
 * Run the full pipeline for an incoming chat message.
 *
 * @param {Object} params - { tenantId, userPhone, userMessage, mediaUrl, chatType }
 * @returns {Promise<Object>} - { success, data: { reply, bubbles, metadata } }
 */
export const runPipeline = async (params) => {
  const ctx = createPipelineContext(params);

  console.log(`\n[Pipeline] ═══════════════════════════════════════`);
  console.log(`[Pipeline] 🚀 START — tenant=${ctx.tenantId} phone=${ctx.userPhone}`);
  console.log(`[Pipeline] 📨 Message: "${(ctx.userMessage || '').substring(0, 80)}"`);
  console.log(`[Pipeline] ═══════════════════════════════════════\n`);

  // ── Broadcast pipeline start to dashboard ─────────────────────
  broadcast(ctx.tenantId, 'pipeline_event', {
    type: 'pipeline_start',
    phone: ctx.userPhone,
  });

  // ── Safety net: clear any stale abort signals from previous cycle ──
  await clearAbortSignal(ctx.tenantId, ctx.userPhone);

  let startStageIndex = STAGE_INDEX.PRE_VALIDATION;

  while (true) {
    // Find stages to run starting from startStageIndex
    const stagesToRun = STAGES.filter(([idx]) => idx >= startStageIndex);

    for (const [stageIndex, stageFn, stageName] of stagesToRun) {
      ctx.currentStageIndex = stageIndex;
      const stageStart = Date.now();

      // ── Check for Gatekeeper abort signal before each stage ──
      const abortSignal = await checkAbortSignal(ctx.tenantId, ctx.userPhone, stageIndex);
      if (abortSignal) {
        console.log(`[Pipeline] 🛑 Gatekeeper ABORT signal at stage ${stageIndex}: ${abortSignal.reason}`);
        ctx.decision = 'abort';
        ctx.abortError = new Error(`Gatekeeper abort at stage ${stageIndex}: ${abortSignal.reason}`);
        ctx.gatekeeperAbort = true;
        ctx.gatekeeperAbortReason = abortSignal.reason;
        await clearAbortSignal(ctx.tenantId, ctx.userPhone);
        break;
      }

      try {
        console.log(`[Pipeline] ▶ Stage ${stageIndex}: ${stageName} [state=${ctx.conversationState}]`);
        await stageFn(ctx);
      } catch (err) {
        console.error(`[Pipeline] ❌ Stage ${stageIndex} (${stageName}) threw an error:`, err.message);
        ctx.decision = 'abort';
        ctx.abortError = err;
      }

      const elapsed = Date.now() - stageStart;
      console.log(`[Pipeline] ◀ Stage ${stageIndex}: ${stageName} → decision=${ctx.decision} (${elapsed}ms)`);

      // ── POST-STAGE abort check: catch abort signals that arrived DURING the stage ──
      // This is critical for slow stages (Stage 6 can take 60+ seconds).
      // Without this, an abort signal set during Stage 6 won't be detected until before Stage 7.
      if (ctx.decision === 'continue') {
        const postAbortSignal = await checkAbortSignal(ctx.tenantId, ctx.userPhone, stageIndex);
        if (postAbortSignal) {
          console.log(`[Pipeline] 🛑 POST-STAGE abort detected after stage ${stageIndex}: ${postAbortSignal.reason}`);
          ctx.decision = 'abort';
          ctx.abortError = new Error(`Gatekeeper abort (post-stage ${stageIndex}): ${postAbortSignal.reason}`);
          ctx.gatekeeperAbort = true;
          ctx.gatekeeperAbortReason = postAbortSignal.reason;
          await clearAbortSignal(ctx.tenantId, ctx.userPhone);
        }
      }

      // ── FINAL GATE: Before Stage 8 (ResponseEmitter), check for pending messages ──
      // Even if Gatekeeper didn't fire, if new messages arrived during processing,
      // we should NOT send an incomplete reply. Abort and let the re-process handle it.
      if (ctx.decision === 'continue' && stageIndex === STAGE_INDEX.POST_PROCESSOR) {
        try {
          const { hasPending } = await import('../../shared/interruptState.js');
          const interruptKey = `${ctx.tenantId}:${ctx.userPhone}`;
          if (await hasPending(interruptKey)) {
            console.log(`[Pipeline] 🛑 FINAL GATE: Pending messages detected before ResponseEmitter — aborting to reprocess with full context`);
            ctx.decision = 'abort';
            ctx.abortError = new Error('Final gate: pending messages detected before response');
            ctx.gatekeeperAbort = true;
            ctx.gatekeeperAbortReason = 'Pending messages detected before sending reply';
            await clearAbortSignal(ctx.tenantId, ctx.userPhone);
          }
        } catch (e) {
          console.warn('[Pipeline] Final gate check failed:', e.message);
        }

        // ── PATH B: Merge queued guider todos into pipeline response ──
        // If admin proceeded while pipeline was active, todos are 'queued'.
        // Merge them with the pipeline's draft reply BEFORE sending.
        if (ctx.decision === 'continue') {
          try {
            const { default: db } = await import('../../../config/database.js');
            const queuedTodos = await db.systemGuiderTodo.findMany({
              where: { tenant_id: ctx.tenantId, phone: ctx.userPhone, status: 'queued' },
              orderBy: { created_at: 'asc' }
            });

            if (queuedTodos.length > 0 && ctx.finalReply) {
              console.log(`[Pipeline] 📋 PATH B: ${queuedTodos.length} queued guider todo(s) — merging with pipeline response`);

              // Fetch fact sheets from requests
              const requestIds = [...new Set(queuedTodos.map(t => t.request_id))];
              const requests = await db.centralInfoRequest.findMany({
                where: { id: { in: requestIds } },
                select: { id: true, required_info: true }
              });
              const reqMap = Object.fromEntries(requests.map(r => [r.id, r.required_info]));

              const todoBlock = queuedTodos.map(t => {
                const fields = Array.isArray(reqMap[t.request_id])
                  ? reqMap[t.request_id].filter(f => f.answered && f.value)
                  : [];
                const factStr = fields.length > 0
                  ? '\n  Data faktual: ' + fields.map(f => `${f.label}: ${f.value}`).join(', ')
                  : '';
                return `- ${t.instruction}${factStr}`;
              }).join('\n');

              const mergePrompt = `Kamu adalah customer service dari bisnis travel.
Kamu sudah menyiapkan balasan berikut untuk customer:
---DRAFT BALASAN---
${ctx.finalReply}
---SELESAI DRAFT---

Admin juga memberikan instruksi berikut yang HARUS disampaikan:
${todoBlock}

TUGAS: Gabungkan DRAFT BALASAN dan instruksi admin menjadi SATU pesan yang:
1. Natural dan mengalir — bukan dua bagian terpisah
2. Menggunakan angka/harga PERSIS dari instruksi admin — tidak boleh diubah
3. Menjawab pesan customer sekaligus menyampaikan info dari admin
4. Tetap ramah dan sopan

Tulis HANYA teks pesan final. Tanpa penjelasan atau prefix.`;

              const { executePlainAI } = await import('../logic.service.js');
              const merged = await executePlainAI(ctx.tenantId, mergePrompt, 'merge', [], 'system_guider');

              if (merged && merged.trim()) {
                ctx.finalReply = merged.trim();
                ctx.bubbles = merged.trim().split(/\[NEXT\]/gi).map(b => b.trim()).filter(Boolean);
                if (ctx.bubbles.length === 0) ctx.bubbles = [merged.trim()];
                ctx.pendingGuiderTodos = queuedTodos;
                console.log(`[Pipeline] ✅ PATH B merge complete — reply updated`);
              }

              // Mark as pipeline_injected
              await db.systemGuiderTodo.updateMany({
                where: { id: { in: queuedTodos.map(t => t.id) } },
                data: { status: 'pipeline_injected' }
              });
            }
          } catch (mergeErr) {
            console.error('[Pipeline] Path B merge error:', mergeErr.message);
          }
        }
      }

      // ── Update pipeline progress in Redis for Gatekeeper ──
      await setPipelineProgress(ctx.tenantId, ctx.userPhone, {
        stage: stageIndex,
        stageName,
        startedAt: ctx.startTime,
        conversationState: ctx.conversationState,
        originalMessage: (ctx.userMessage || '').substring(0, 200),
        elapsedMs: Date.now() - ctx.startTime,
        gatekeeperModel: ctx.models?.gatekeeperModel || null,
      });

      // ── Broadcast stage progress ──────────────────────────────
      broadcast(ctx.tenantId, 'pipeline_event', {
        type: 'pipeline_stage',
        phone: ctx.userPhone,
        stage: { id: stageIndex, name: stageName, elapsed, decision: ctx.decision },
      });

      // ── After StateResolver: broadcast conversation state ─────
      if (stageIndex === STAGE_INDEX.STATE_RESOLVER && ctx.conversationState) {
        broadcast(ctx.tenantId, 'pipeline_event', {
          type: 'pipeline_state',
          phone: ctx.userPhone,
          conversationState: ctx.conversationState,
          pendingItems: ctx.pendingItems || [],
        });
      }

      // ── Handle decision ──────────────────────────────────────────
      if (ctx.decision === 'abort') {
        console.error(`[Pipeline] 🔴 ABORT at stage ${stageIndex}`);
        // Clean up progress tracking and gatekeeper watcher
        await clearPipelineProgress(ctx.tenantId, ctx.userPhone);
        await clearAbortSignal(ctx.tenantId, ctx.userPhone);
        await stopWatching(ctx.tenantId, ctx.userPhone);
        // If gatekeeper triggered the abort, return a reprocess-needed response
        if (ctx.gatekeeperAbort) {
          // Broadcast pipeline_done (not error) — Gatekeeper intentionally stopped the pipeline
          const totalElapsed = Date.now() - ctx.startTime;
          broadcast(ctx.tenantId, 'pipeline_event', {
            type: 'pipeline_done',
            phone: ctx.userPhone,
            totalMs: totalElapsed,
            decision: 'gatekeeper_abort',
            conversationState: ctx.conversationState,
            gatekeeperReason: ctx.gatekeeperAbortReason,
          });
          console.log(`[Pipeline] 🛑 Gatekeeper abort complete — ${totalElapsed}ms | reason: ${ctx.gatekeeperAbortReason}`);
          return _buildAbortReprocessResponse(ctx);
        }
        throw ctx.abortError || new Error(`Pipeline aborted at stage ${stageIndex}`);
      }

      if (ctx.decision === 'hold') {
        console.log(`[Pipeline] ⏸  HOLD at stage ${stageIndex}: "${(ctx.holdResponse || '').substring(0, 80)}"`);
        return _buildHoldResponse(ctx);
      }

      if (ctx.decision === 'rollback') {
        ctx.rollbackCount++;
        if (ctx.rollbackCount > MAX_ROLLBACKS) {
          console.warn(`[Pipeline] ⚠️  Max rollbacks (${MAX_ROLLBACKS}) reached. Forcing continue.`);
          ctx.decision = 'continue';
        } else {
          const targetStage = ctx.rollbackToStage || STAGE_INDEX.STATE_RESOLVER;
          console.log(`[Pipeline] 🔄 ROLLBACK to stage ${targetStage} (rollback #${ctx.rollbackCount})`);
          startStageIndex = targetStage;
          ctx.decision = 'continue';
          ctx.rollbackToStage = null;
          break; // Break inner for-loop to restart from targetStage
        }
      }

      // decision === 'continue' → fall through to next stage
      ctx.decision = 'continue'; // reset
    }

    // If we've completed all stages (no rollback broke the loop), we're done
    // Check if we actually finished (ran all stages up to emitter)
    if (ctx.currentStageIndex === STAGE_INDEX.RESPONSE_EMITTER && ctx.decision === 'continue') {
      break;
    }

    // If last decision was not a rollback-induced break, we're done
    if (ctx.rollbackToStage === null && ctx.decision !== 'rollback') {
      break;
    }
  }

  const totalElapsed = Date.now() - ctx.startTime;
  console.log(`\n[Pipeline] ═══════════════════════════════════════`);
  console.log(`[Pipeline] ✅ DONE — ${totalElapsed}ms | state=${ctx.conversationState}`);
  console.log(`[Pipeline] 💬 Reply: "${(ctx.finalReply || '').substring(0, 120)}"`);
  console.log(`[Pipeline] ═══════════════════════════════════════\n`);

  // ── Clean up progress tracking ──
  await clearPipelineProgress(ctx.tenantId, ctx.userPhone);

  // ── Mark pipeline_injected guider todos as done ──
  if (ctx.pendingGuiderTodos?.length > 0) {
    try {
      const { default: db } = await import('../../../config/database.js');
      const ids = ctx.pendingGuiderTodos.map(t => t.id);
      await db.systemGuiderTodo.updateMany({
        where: { id: { in: ids }, status: 'pipeline_injected' },
        data: { status: 'done', result: 'Delivered via pipeline merge', executed_at: new Date() }
      });
      console.log(`[Pipeline] ✅ Marked ${ids.length} injected guider todo(s) as done`);
    } catch (e) {
      console.error('[Pipeline] Failed to mark injected todos as done:', e.message);
    }
  }

  // ── Broadcast pipeline complete ───────────────────────────────
  broadcast(ctx.tenantId, 'pipeline_event', {
    type: 'pipeline_done',
    phone: ctx.userPhone,
    totalMs: totalElapsed,
    decision: ctx.decision,
    conversationState: ctx.conversationState,
  });

  return {
    success: true,
    data: {
      reply:   ctx.finalReply,
      bubbles: ctx.bubbles,
      metadata: {
        tenant:            ctx.tenant?.business_name,
        chat_type:         ctx.chatType,
        conversationState: ctx.conversationState,
        pendingItems:      ctx.pendingItems,
        docMediaUrls:      ctx.docMediaUrls,
        docMediaMeta:      ctx.docMediaMeta,
        availableBrochures:ctx.availableBrochures,
        leadId:            ctx.lead?.id || null,
      }
    }
  };
};

/** Build a hold response object (AI is paused, return a pre-built message) */
const _buildHoldResponse = (ctx) => ({
  success: true,
  data: {
    reply:   ctx.holdResponse || 'Mohon tunggu sebentar ya Kak.',
    bubbles: [ctx.holdResponse || 'Mohon tunggu sebentar ya Kak.'],
    metadata: {
      tenant:            ctx.tenant?.business_name,
      chat_type:         ctx.chatType,
      conversationState: ctx.conversationState,
      held:              true,
      docMediaUrls:      [],
      docMediaMeta:      [],
      availableBrochures:{},
    }
  }
});

/**
 * Build a response when Gatekeeper aborts the pipeline.
 * The worker will detect pending messages and re-buffer them for a new pipeline cycle.
 */
const _buildAbortReprocessResponse = (ctx) => ({
  success: true,
  data: {
    reply:   '',  // Empty reply — worker will detect and re-buffer pending messages
    bubbles: [],
    metadata: {
      tenant:            ctx.tenant?.business_name,
      chat_type:         ctx.chatType,
      conversationState: ctx.conversationState,
      gatekeeperAbort:   true,
      abortReason:       ctx.gatekeeperAbortReason || 'Topic changed',
      docMediaUrls:      [],
      docMediaMeta:      [],
      availableBrochures:{},
    }
  }
});
