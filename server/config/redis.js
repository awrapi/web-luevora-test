import Redis from 'ioredis';
import 'dotenv/config';

// Mengambil URL Redis dari .env (bisa dari Upstash atau Redis lokal)
// Contoh URL Upstash: rediss://default:password@endpoint.upstash.io:6379
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Buat instance ioredis
const redisClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // Wajib untuk BullMQ
  enableReadyCheck: false,
});

export const REDIS_PREFIX = process.env.PORT || '3001';

redisClient.on('connect', async () => {
  console.log('[Redis] Connected successfully to Redis.');
  // Ensure Redis allows writes (fixes READONLY error on slave-read-only=yes even when role=master)
  try {
    await redisClient.config('SET', 'slave-read-only', 'no');
    console.log('[Redis] slave-read-only set to no.');
  } catch (err) {
    // Silently ignore if CONFIG SET is not allowed (e.g. managed Redis like Upstash)
    if (!err.message.includes('unknown command') && !err.message.includes('not allowed')) {
      console.warn('[Redis] Could not set slave-read-only:', err.message);
    }
  }
});

redisClient.on('error', (err) => {
  console.error('[Redis] Connection Error:', err.message);
});

export const createRedisClient = () => new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export default redisClient;
