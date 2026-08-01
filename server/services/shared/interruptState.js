import redisClient, { REDIS_PREFIX } from '../../config/redis.js';

const PROCESSING_PREFIX = `interrupt:${REDIS_PREFIX}:processing:`;
const PENDING_PREFIX = `interrupt:${REDIS_PREFIX}:pending:`;
const EXPIRE_SECONDS = 3600; // 1 jam auto-expire untuk mencegah memory leak

/**
 * Tandai phone sedang dalam proses AI
 */
export const setProcessing = async (key, value) => {
  if (value) {
    await redisClient.set(`${PROCESSING_PREFIX}${key}`, 'true', 'EX', EXPIRE_SECONDS);
  } else {
    await redisClient.del(`${PROCESSING_PREFIX}${key}`);
  }
};

/**
 * Cek apakah phone sedang dalam proses AI
 */
export const isProcessing = async (key) => {
  const val = await redisClient.get(`${PROCESSING_PREFIX}${key}`);
  return val === 'true';
};

/**
 * Tambah pesan ke pending (pesan yang masuk saat AI sedang processing)
 */
export const pushPending = async (key, msg) => {
  await redisClient.rpush(`${PENDING_PREFIX}${key}`, JSON.stringify(msg));
  await redisClient.expire(`${PENDING_PREFIX}${key}`, EXPIRE_SECONDS);
};

/**
 * Cek apakah ada pending messages
 */
export const hasPending = async (key) => {
  const len = await redisClient.llen(`${PENDING_PREFIX}${key}`);
  return len > 0;
};

/**
 * Ambil semua pending messages dan kosongkan
 */
export const drainPending = async (key) => {
  const listKey = `${PENDING_PREFIX}${key}`;
  const items = await redisClient.lrange(listKey, 0, -1);
  await redisClient.del(listKey);
  return items.map(i => JSON.parse(i));
};

/**
 * Bersihkan state untuk key tertentu
 */
export const clearState = async (key) => {
  await redisClient.del(`${PROCESSING_PREFIX}${key}`);
  await redisClient.del(`${PENDING_PREFIX}${key}`);
};

export default {
  setProcessing,
  isProcessing,
  pushPending,
  hasPending,
  drainPending,
  clearState,
};
