import { Queue } from 'bullmq';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisClient = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

const queue = new Queue('aiChatQueue', { connection: redisClient });

async function check() {
  const isPaused = await queue.isPaused();
  console.log(`Is Paused: ${isPaused}`);
  const jobs = await queue.getJobs(['waiting', 'active', 'delayed', 'completed', 'failed']);
  console.log(`Jobs: ${jobs.length}`);
  for (const job of jobs) {
    console.log(`Job ID: ${job.id}, Status: ${await job.getState()}, Data: ${JSON.stringify(job.data)}`);
  }
  process.exit(0);
}
check();
