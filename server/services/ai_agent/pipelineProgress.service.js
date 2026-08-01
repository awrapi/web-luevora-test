/**
 * ================================================================
 * PIPELINE PROGRESS SERVICE — Redis-based pipeline state tracker
 * ================================================================
 *
 * Tracks Agent 1 (main pipeline) progress in Redis so that
 * Agent 2 (Gatekeeper) can read how far the pipeline has progressed
 * and make intelligent decisions about pending messages.
 *
 * Redis key pattern: pipeline_progress:{prefix}:{tenantId}:{phone}
 * TTL: 300 seconds (auto-expire to prevent memory leaks)
 */

import redisClient, { REDIS_PREFIX } from '../../config/redis.js';

const PROGRESS_PREFIX = `pipeline_progress:${REDIS_PREFIX}`;
const ABORT_PREFIX = `gatekeeper:${REDIS_PREFIX}:abort_signal`;
const TTL = 300; // 5 minutes

/**
 * Write pipeline progress to Redis.
 * Called by pipeline.engine.js after each stage completes.
 *
 * @param {number} tenantId
 * @param {string} phone
 * @param {Object} progress
 * @param {number} progress.stage - Current stage index
 * @param {string} progress.stageName - Human-readable stage name
 * @param {number} progress.startedAt - Pipeline start timestamp
 * @param {string} [progress.conversationState] - Current conversation state
 * @param {string} [progress.originalMessage] - The message Agent 1 is processing
 * @param {number} [progress.elapsedMs] - Time elapsed since pipeline start
 */
export const setPipelineProgress = async (tenantId, phone, progress) => {
  const key = `${PROGRESS_PREFIX}:${tenantId}:${phone}`;
  try {
    await redisClient.set(key, JSON.stringify({
      ...progress,
      updatedAt: Date.now(),
    }), 'EX', TTL);
  } catch (err) {
    console.warn(`[PipelineProgress] Failed to set progress for ${phone}:`, err.message);
  }
};

/**
 * Read current pipeline progress from Redis.
 * Called by Gatekeeper to understand how far Agent 1 has progressed.
 *
 * @param {number} tenantId
 * @param {string} phone
 * @returns {Promise<Object|null>} Progress object or null if not found
 */
export const getPipelineProgress = async (tenantId, phone) => {
  const key = `${PROGRESS_PREFIX}:${tenantId}:${phone}`;
  try {
    const raw = await redisClient.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn(`[PipelineProgress] Failed to get progress for ${phone}:`, err.message);
    return null;
  }
};

/**
 * Clear pipeline progress from Redis.
 * Called when pipeline completes or aborts.
 *
 * @param {number} tenantId
 * @param {string} phone
 */
export const clearPipelineProgress = async (tenantId, phone) => {
  const key = `${PROGRESS_PREFIX}:${tenantId}:${phone}`;
  try {
    await redisClient.del(key);
  } catch (err) {
    console.warn(`[PipelineProgress] Failed to clear progress for ${phone}:`, err.message);
  }
};

/**
 * Set an abort signal in Redis.
 * Called by Gatekeeper when it decides Agent 1 should stop at a specific stage.
 * Pipeline engine checks this before each stage.
 *
 * @param {number} tenantId
 * @param {string} phone
 * @param {number} abortAtStage - Stage index where pipeline should stop
 * @param {string} reason - Why the abort was triggered
 */
export const setAbortSignal = async (tenantId, phone, abortAtStage, reason) => {
  const key = `${ABORT_PREFIX}:${tenantId}:${phone}`;
  try {
    await redisClient.set(key, JSON.stringify({
      abortAtStage,
      reason,
      timestamp: Date.now(),
    }), 'EX', TTL);
    console.log(`[PipelineProgress] Abort signal set for ${phone} at stage ${abortAtStage}: ${reason}`);
  } catch (err) {
    console.warn(`[PipelineProgress] Failed to set abort signal for ${phone}:`, err.message);
  }
};

/**
 * Check if there's an abort signal for a given phone.
 * Called by pipeline.engine.js before each stage.
 *
 * @param {number} tenantId
 * @param {string} phone
 * @param {number} currentStage - The stage about to run
 * @returns {Promise<Object|null>} Abort signal if stage <= abortAtStage, else null
 */
export const checkAbortSignal = async (tenantId, phone, currentStage) => {
  const key = `${ABORT_PREFIX}:${tenantId}:${phone}`;
  try {
    const raw = await redisClient.get(key);
    if (!raw) return null;

    const signal = JSON.parse(raw);
    // Only abort if the current stage is at or past the abort target
    if (currentStage >= signal.abortAtStage) {
      return signal;
    }
    return null; // Not yet at abort stage, let pipeline continue
  } catch (err) {
    console.warn(`[PipelineProgress] Failed to check abort signal for ${phone}:`, err.message);
    return null;
  }
};

/**
 * Clear the abort signal from Redis.
 * Called after pipeline has handled the abort.
 *
 * @param {number} tenantId
 * @param {string} phone
 */
export const clearAbortSignal = async (tenantId, phone) => {
  const key = `${ABORT_PREFIX}:${tenantId}:${phone}`;
  try {
    await redisClient.del(key);
  } catch (err) {
    console.warn(`[PipelineProgress] Failed to clear abort signal for ${phone}:`, err.message);
  }
};

export default {
  setPipelineProgress,
  getPipelineProgress,
  clearPipelineProgress,
  setAbortSignal,
  checkAbortSignal,
  clearAbortSignal,
};
