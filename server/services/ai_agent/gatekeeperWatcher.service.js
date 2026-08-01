/**
 * ================================================================
 * GATEKEEPER WATCHER — Background polling for pending messages
 * ================================================================
 *
 * Runs alongside Agent 1 (main pipeline) and monitors for pending
 * messages arriving during processing. When detected, calls the
 * Gatekeeper Agent to evaluate and execute the decision.
 *
 * Polling interval: 2 seconds
 * Uses Redis pending queue (from interruptState.js) as the source.
 *
 * Decision execution:
 *   HOLD      → Generate AI holding message + send to customer via messaging service
 *   ABORT_AT  → Set abort signal in Redis (pipeline.engine.js picks it up)
 *   CONTINUE  → Do nothing, let Agent 1 finish
 *   QUEUE_AFTER → Do nothing, pending stays for post-pipeline handling
 */

import * as interruptState from '../shared/interruptState.js';
import { evaluateGatekeeperDecision, generateHoldingResponse } from './gatekeeper.service.js';
import { getPipelineProgress, setAbortSignal } from './pipelineProgress.service.js';
import { sendText } from '../shared/messaging.service.js';
import { broadcast } from '../shared/sse.service.js';
import { saveMessage } from '../shared/chat.service.js';
import prisma from '../../config/database.js';
import redisClient, { REDIS_PREFIX } from '../../config/redis.js';

const POLL_INTERVAL_MS = 2000;
const HANDLED_PREFIX = `gatekeeper:${REDIS_PREFIX}:handled`;
const LOCK_PREFIX = `gatekeeper:${REDIS_PREFIX}:lock`;
const TTL = 3600; // 1 hour

/** Active watchers — Map<key, { timer, stopped }> */
const activeWatchers = new Map();

/**
 * Acquire an atomic lock via Redis SETNX to prevent concurrent evaluations.
 * Returns true if lock acquired, false if already locked by another trigger.
 */
const acquireLock = async (key) => {
  const result = await redisClient.set(`${LOCK_PREFIX}:${key}`, '1', 'EX', 60, 'NX');
  return result === 'OK';
};

const releaseLock = async (key) => {
  await redisClient.del(`${LOCK_PREFIX}:${key}`);
};

/**
 * Start the gatekeeper watcher for a specific phone.
 * Called at pipeline start (Stage 1).
 *
 * @param {number} tenantId
 * @param {string} phone
 * @param {string} provider - Messaging provider (meta/telegram/instagram)
 */
export const startWatching = (tenantId, phone, provider = 'meta') => {
  const key = `${tenantId}:${phone}`;

  // Don't start if already watching
  if (activeWatchers.has(key)) {
    return;
  }

  const state = { stopped: false };

  const poll = async () => {
    if (state.stopped) return;

    try {
      // Check if there are pending messages
      const hasPending = await interruptState.hasPending(key);
      if (!hasPending) {
        // No pending, schedule next poll
        if (!state.stopped) {
          state.timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
        return;
      }

      // Check if gatekeeper already handled this batch
      // But allow re-evaluation after HOLD (so new pending messages get acknowledged)
      const alreadyHandled = await redisClient.get(`${HANDLED_PREFIX}:${key}`);
      const holdCount = parseInt(await redisClient.get(`${HANDLED_PREFIX}:${key}:holdcount`) || '0', 10);
      if (alreadyHandled === 'true' && alreadyHandled !== 'hold') {
        // Fully handled (ABORT_AT, CONTINUE, QUEUE_AFTER) — skip
        if (!state.stopped) {
          state.timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
        return;
      }
      if (alreadyHandled === 'hold' && holdCount >= 2) {
        // Already sent 2 HOLD messages — don't spam more
        if (!state.stopped) {
          state.timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
        return;
      }

      // Drain pending messages to evaluate
      const pendingMsgs = await interruptState.drainPending(key);
      if (!pendingMsgs || pendingMsgs.length === 0) {
        if (!state.stopped) {
          state.timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
        return;
      }

      // Acquire lock to prevent concurrent evaluation (polling + immediate trigger)
      const locked = await acquireLock(key);
      if (!locked) {
        // Another trigger is already evaluating — put messages back and skip
        for (const msg of pendingMsgs) {
          await interruptState.pushPending(key, msg);
        }
        if (!state.stopped) {
          state.timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
        return;
      }

      console.log(`[GatekeeperWatcher] ${pendingMsgs.length} pending message(s) detected for ${phone}, evaluating...`);

      // Get Agent 1's current progress
      const progress = await getPipelineProgress(tenantId, phone);

      // Evaluate decision — pass per-tier gatekeeperModel from progress if available
      const decision = await evaluateGatekeeperDecision(tenantId, phone, pendingMsgs, progress, progress?.gatekeeperModel || null);

      // Execute decision
      await executeDecision(tenantId, phone, provider, pendingMsgs, decision);

      // Mark as handled + release lock
      // For HOLD: mark as 'hold' so re-evaluation is allowed for new messages
      // For others: mark as 'true' to block re-evaluation
      const handledValue = decision.decision === 'HOLD' ? 'hold' : 'true';
      await redisClient.set(`${HANDLED_PREFIX}:${key}`, handledValue, 'EX', TTL);
      if (decision.decision === 'HOLD') {
        await redisClient.incr(`${HANDLED_PREFIX}:${key}:holdcount`);
        await redisClient.expire(`${HANDLED_PREFIX}:${key}:holdcount`, TTL);
      }
      await releaseLock(key);

    } catch (err) {
      console.error('[GatekeeperWatcher] Poll error:', err.message);
    }

    // Schedule next poll
    if (!state.stopped) {
      state.timer = setTimeout(poll, POLL_INTERVAL_MS);
    }
  };

  // Start first poll after a short delay (let Agent 1 get to Stage 2+)
  state.timer = setTimeout(poll, POLL_INTERVAL_MS);
  activeWatchers.set(key, state);
  console.log(`[GatekeeperWatcher] Started watching for ${phone}`);
};

/**
 * Stop the gatekeeper watcher for a specific phone.
 * Called at pipeline completion (Stage 7).
 *
 * @param {number} tenantId
 * @param {string} phone
 */
export const stopWatching = async (tenantId, phone) => {
  const key = `${tenantId}:${phone}`;
  const state = activeWatchers.get(key);

  if (state) {
    state.stopped = true;
    if (state.timer) clearTimeout(state.timer);
    activeWatchers.delete(key);
    console.log(`[GatekeeperWatcher] Stopped watching for ${phone}`);
  }

  // Clean up handled flag + lock + holdcount
  try {
    await redisClient.del(`${HANDLED_PREFIX}:${key}`);
    await redisClient.del(`${LOCK_PREFIX}:${key}`);
    await redisClient.del(`${HANDLED_PREFIX}:${key}:holdcount`);
  } catch (e) { /* ignore */ }
};

/**
 * Execute the gatekeeper's decision.
 *
 * @param {number} tenantId
 * @param {string} phone
 * @param {string} provider
 * @param {Array} pendingMsgs
 * @param {Object} decision
 */
const executeDecision = async (tenantId, phone, provider, pendingMsgs, decision) => {
  switch (decision.decision) {
    case 'HOLD': {
      console.log(`[GatekeeperWatcher] HOLD — sending quick response to ${phone}`);

      // Use AI-generated message or fallback
      let holdMessage = decision.holdMessage;
      if (!holdMessage) {
        const progress = await getPipelineProgress(tenantId, phone);
        holdMessage = await generateHoldingResponse(
          tenantId, phone, pendingMsgs, progress?.conversationState || 'EXPLORATION'
        );
      }

      // Send the holding message to customer
      try {
        await sendText(prisma, phone, holdMessage, { tenantId });
        console.log(`[GatekeeperWatcher] HOLD message sent: "${holdMessage}"`);
      } catch (sendErr) {
        console.error('[GatekeeperWatcher] Failed to send hold message:', sendErr.message);
      }

      // Save to chat history
      try {
        await saveMessage(prisma, phone, 'assistant', holdMessage, tenantId, null, null, null);
      } catch (e) { /* non-critical */ }

      // Broadcast to dashboard
      broadcast(tenantId, 'new_message', {
        phone,
        message: holdMessage,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        is_gatekeeper_hold: true,
      });

      // Put pending messages BACK for Agent 1 to handle later
      // (they were drained but HOLD means Agent 1 should continue normally)
      for (const msg of pendingMsgs) {
        await interruptState.pushPending(`${tenantId}:${phone}`, msg);
      }
      break;
    }

    case 'ABORT_AT': {
      const abortStage = decision.abortAtStage || 4;
      console.log(`[GatekeeperWatcher] ABORT_AT stage ${abortStage} — ${decision.reason}`);

      // Set abort signal in Redis — pipeline.engine.js will pick this up
      await setAbortSignal(tenantId, phone, abortStage, decision.reason);

      // Put pending messages BACK so the re-process can use them
      for (const msg of pendingMsgs) {
        await interruptState.pushPending(`${tenantId}:${phone}`, msg);
      }
      break;
    }

    case 'QUEUE_AFTER': {
      console.log(`[GatekeeperWatcher] QUEUE_AFTER — Agent 1 finishes, pending re-processed next`);
      // Put pending messages BACK for post-pipeline handling
      for (const msg of pendingMsgs) {
        await interruptState.pushPending(`${tenantId}:${phone}`, msg);
      }
      break;
    }

    case 'CONTINUE':
    default: {
      console.log(`[GatekeeperWatcher] CONTINUE — filler/acknowledgment, discarded (${pendingMsgs.length} msgs)`);
      // JANGAN push balik — pesan filler ("oke", "baik", "siap") tidak perlu diproses
      // Agent 1 tetap lanjut, pesan ini cukup diabaikan
      break;
    }
  }
};

/**
 * Trigger immediate gatekeeper evaluation (called when a new pending arrives).
 * This is an alternative to polling — evaluates right when message arrives.
 *
 * @param {number} tenantId
 * @param {string} phone
 * @param {string} provider
 * @param {Array<{text: string}>} pendingMsgs
 */
export const triggerImmediateEvaluation = async (tenantId, phone, provider, pendingMsgs) => {
  const key = `${tenantId}:${phone}`;

  // Check if already handled (but allow re-evaluation after HOLD)
  const alreadyHandled = await redisClient.get(`${HANDLED_PREFIX}:${key}`);
  if (alreadyHandled === 'true') return;
  const holdCount = parseInt(await redisClient.get(`${HANDLED_PREFIX}:${key}:holdcount`) || '0', 10);
  if (alreadyHandled === 'hold' && holdCount >= 2) return;

  // Acquire lock to prevent concurrent evaluation (polling + immediate trigger)
  const locked = await acquireLock(key);
  if (!locked) {
    console.log(`[GatekeeperWatcher] Immediate evaluation skipped for ${phone} — another trigger is already evaluating`);
    return;
  }

  try {
    const progress = await getPipelineProgress(tenantId, phone);
    // Pass per-tier gatekeeperModel from progress if available
    const decision = await evaluateGatekeeperDecision(tenantId, phone, pendingMsgs, progress, progress?.gatekeeperModel || null);
    await executeDecision(tenantId, phone, provider, pendingMsgs, decision);
    const handledValue = decision.decision === 'HOLD' ? 'hold' : 'true';
    await redisClient.set(`${HANDLED_PREFIX}:${key}`, handledValue, 'EX', TTL);
    if (decision.decision === 'HOLD') {
      await redisClient.incr(`${HANDLED_PREFIX}:${key}:holdcount`);
      await redisClient.expire(`${HANDLED_PREFIX}:${key}:holdcount`, TTL);
    }
  } catch (err) {
    console.error('[GatekeeperWatcher] Immediate evaluation failed:', err.message);
  } finally {
    await releaseLock(key);
  }
};

export default {
  startWatching,
  stopWatching,
  triggerImmediateEvaluation,
};
