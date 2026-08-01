import { Worker } from 'bullmq';
import redisClient, { createRedisClient, REDIS_PREFIX } from '../config/redis.js';
import { processBufferedMessages } from '../services/shared/webhook.service.js';
import * as interruptState from '../services/shared/interruptState.js';
import { bufferQueue, DEBOUNCE_MS } from '../services/shared/messageBuffer.service.js';

export const startAiChatWorker = () => {
  const worker = new Worker(`aiChatQueue_${REDIS_PREFIX}`, async (job) => {
    const { tenantId, userPhone, profileName, provider } = job.data;
    const key = `${tenantId}:${userPhone}`;
    const listKey = `buffer:${REDIS_PREFIX}:${key}`;

    // Get all buffered messages from Redis
    const rawMessages = await redisClient.lrange(listKey, 0, -1);
    if (!rawMessages || rawMessages.length === 0) return;

    // Hapus dari buffer agar cycle selanjutnya bersih
    await redisClient.del(listKey);

    const messagesToProcess = rawMessages
      .map(m => JSON.parse(m))
      .sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());

    // Tandai processing di state terpusat
    await interruptState.setProcessing(key, true);
    console.log(`[Worker] Memproses ${messagesToProcess.length} bubble dari ${userPhone} (Tenant: ${tenantId})`);

    try {
      await processBufferedMessages({
        tenantId,
        userPhone,
        bufferedMessages: messagesToProcess,
        profileName,
        provider,
      });
    } catch (err) {
      console.error(`[Worker] Error processing messages for ${userPhone}:`, err);
    }

    // Selesai processing
    await interruptState.setProcessing(key, false);

    // Cek apakah ada pesan pending yang belum ditangani Gatekeeper
    // (Gatekeeper sudah menangani HOLD/ABORT_AT, tapi QUEUE_AFTER dan CONTINUE
    //  meninggalkan pending untuk diproses ulang sebagai pipeline cycle baru)
    if (await interruptState.hasPending(key)) {
      const leftover = await interruptState.drainPending(key);
      console.log(`[Worker] ${leftover.length} leftover pending dari ${userPhone}, re-buffer sebagai pipeline cycle baru...`);
      
      // Kembalikan leftover ke buffer list
      for (const msg of leftover) {
         await redisClient.rpush(listKey, JSON.stringify(msg));
      }
      await redisClient.expire(listKey, 3600);

      // Re-add to queue dengan delay 10 detik (sama dengan debounce buffer)
      // agar customer punya waktu kirim pesan tambahan sebelum pipeline cycle baru
      // Pakai jobId unik (timestamp) agar tidak bentrok dengan job aktif
      const reJobId = `job-${tenantId}-${userPhone}-re-${Date.now()}`;

      // Pastikan tidak ada delayed job lama yang masih nongkrong untuk key ini
      const delayedJobs = await bufferQueue.getDelayed();
      for (const dj of delayedJobs) {
        if (dj.data?.userPhone === userPhone && dj.data?.tenantId === tenantId && dj.id?.startsWith(`job-${tenantId}-${userPhone}`)) {
          try { await dj.remove(); } catch (_) { /* ignore */ }
        }
      }

      const newJob = await bufferQueue.add(
        'processChat', 
        { tenantId, userPhone, profileName, provider }, 
        { delay: DEBOUNCE_MS, jobId: reJobId }
      );
      console.log(`[Worker] New cycle scheduled for ${userPhone} in ${DEBOUNCE_MS / 1000}s (jobId=${newJob?.id || 'FAILED'})`);
    } else {
      await interruptState.clearState(key);
    }
  }, { 
    connection: createRedisClient(),
    concurrency: parseInt(process.env.AI_CONCURRENCY_LIMIT) || 30, // Bisa diatur via .env (default: 30)
    lockDuration: 300000, // 5 menit — AI pipeline bisa 60-180 detik
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Redis connection error:', err.message);
  });

  console.log('[Worker] AI Chat Worker is running and ready for queue...');
};
