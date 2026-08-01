import { Queue } from 'bullmq';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisClient = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

const queue = new Queue('aiChatQueue', { connection: redisClient });

async function check() {
  const delayed = await queue.getDelayedCount();
  const active = await queue.getActiveCount();
  const waiting = await queue.getWaitingCount();
  const completed = await queue.getCompletedCount();
  const failed = await queue.getFailedCount();
  console.log(`Delayed: ${delayed}, Active: ${active}, Waiting: ${waiting}, Completed: ${completed}, Failed: ${failed}`);
  process.exit(0);
}
check();
