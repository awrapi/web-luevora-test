import Redis from 'ioredis';
const redis = new Redis();
async function run() {
  const keys = await redis.keys('buffer:*');
  console.log('Buffer keys:', keys);
  for (const key of keys) {
    console.log(key, await redis.lrange(key, 0, -1));
  }
  process.exit(0);
}
run();
