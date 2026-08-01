import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();

async function clearData() {
  console.log("Starting data cleanup...\n");

  // --- MySQL (Prisma) ---
  try {
    const tables = [
      ['transaction',          'Transaction'],
      ['offer',                'Offer'],
      ['customerRequest',      'Customer Request'],
      ['rentalRequest',        'Rental Request'],
      ['centralInfoRequest',   'Central Info Request'],
      ['dateRequest',          'Date Request'],
      ['rescheduleRequest',    'Reschedule Request'],
      ['refundRequest',        'Refund Request'],
      ['customerManagement',   'CRM (Customer Management)'],
      ['customerCrmHistory',   'CRM History'],
      ['chatHistory',          'Chat History'],
      ['lead',                 'Leads'],
      ['customerSchedule',     'Customer Schedule'],
      ['messageQueue',         'Message Queue'],
      ['customerInteractionLog','Customer Interaction Log'],
      ['statusInformation',    'Status Information'],
      ['ragContextCache',      'RAG Context Cache'],
    ];

    for (const [model, label] of tables) {
      if (prisma[model]) {
        const result = await prisma[model].deleteMany({});
        console.log(`  [MySQL] Deleted ${result.count} rows from ${label}`);
      }
    }

    console.log("\n  MySQL cleanup done!");
  } catch (error) {
    console.error("  MySQL error:", error.message);
  }

  // --- Redis ---
  try {
    const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
    const flushed = await redis.flushdb();
    console.log(`  [Redis] FLUSHDB result: ${flushed}`);
    await redis.quit();
  } catch (error) {
    console.error("  Redis error:", error.message);
  }

  console.log("\nAll data cleaned successfully!");
  await prisma.$disconnect();
}

clearData();
