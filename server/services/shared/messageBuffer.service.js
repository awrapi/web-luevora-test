import { Queue } from 'bullmq';
import redisClient, { createRedisClient, REDIS_PREFIX } from '../../config/redis.js';
import * as interruptState from './interruptState.js';
import { triggerImmediateEvaluation } from '../ai_agent/gatekeeperWatcher.service.js';

export const DEBOUNCE_MS = 10000; // 10 detik
export const bufferQueue = new Queue(`aiChatQueue_${REDIS_PREFIX}`, { connection: createRedisClient() });

/**
 * Push pesan baru ke buffer (Redis List). Reset timer debounce di BullMQ.
 * Jika AI sedang processing, pesan masuk ke interruptState pending.
 */
export const bufferMessage = async ({ tenantId, userPhone, userMessage, profileName, provider, mediaUrl, audioUrl, isVoiceNote, timestamp }) => {
  const key = `${tenantId}:${userPhone}`;
  const msgEntry = {
    text: userMessage,
    mediaUrl: mediaUrl || null,
    audioUrl: audioUrl || null,
    isVoiceNote: isVoiceNote || false,
    timestamp: timestamp ? new Date(timestamp) : new Date(),
  };

  // Cek apakah AI sedang processing untuk phone ini
  if (await interruptState.isProcessing(key)) {
    console.log(`[Buffer] AI sedang processing untuk ${userPhone} — pesan masuk ke pending (interrupt-aware)${isVoiceNote ? ' [VN]' : ''}`);
    await interruptState.pushPending(key, msgEntry);

    // Trigger Gatekeeper Agent (Agent 2) to evaluate immediately
    // Fire & forget — don't block the webhook response
    triggerImmediateEvaluation(tenantId, userPhone, provider, [msgEntry]).catch(err => {
      console.warn('[Buffer] Gatekeeper evaluation failed:', err.message);
    });

    return;
  }

  // Simpan ke Redis list untuk buffer
  const listKey = `buffer:${REDIS_PREFIX}:${key}`;
  await redisClient.rpush(listKey, JSON.stringify(msgEntry));
  await redisClient.expire(listKey, 3600); // Expire 1 jam

  const jobId = `job-${tenantId}-${userPhone}`;
  
  // Hapus delayed job lama agar timer ter-reset (Debounce)
  const existingJob = await bufferQueue.getJob(jobId);
  if (existingJob) {
    await existingJob.remove();
  }

  // Jadwalkan ulang pemrosesan setelah 10 detik
  await bufferQueue.add(
    'processChat',
    { tenantId, userPhone, profileName, provider },
    { delay: DEBOUNCE_MS, jobId }
  );

  console.log(`[Buffer] Message buffered for ${userPhone}. Timer (re)set 10s.`);
};

export default { bufferMessage, bufferQueue };
