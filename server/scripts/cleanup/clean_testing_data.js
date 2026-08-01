import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Clearing ONLY testing data (Leads, CRM, Chat, Transactions) for fresh system testing...\n');

  // --- Flush Redis first ---
  console.log('🔴 Flushing Redis...');
  try {
    const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
    await redis.flushall();
    console.log('  ✅ Redis flushed.\n');
    await redis.quit();
  } catch (e) {
    console.log('  ⚠️  Redis flush skipped:', e.message, '\n');
  }

  // --- Child/dependent tables first (respect FK constraints) ---
  const deleted = {};

  // CRM & interaction logs
  deleted.customerInteractionLog = await prisma.customerInteractionLog.deleteMany().then(r => r.count);
  deleted.customerCrmHistory     = await prisma.customerCrmHistory.deleteMany().then(r => r.count);
  deleted.centralInfoRequest     = await prisma.centralInfoRequest.deleteMany().then(r => r.count);

  // Transaction dependents
  deleted.refundRequest   = await prisma.refundRequest.deleteMany().then(r => r.count);
  deleted.customerRequest = await prisma.customerRequest.deleteMany().then(r => r.count);
  deleted.invoice         = await prisma.invoice.deleteMany().then(r => r.count);

  // Rental dependents
  deleted.activeRental  = await prisma.activeRental.deleteMany().then(r => r.count);
  deleted.rentalRequest = await prisma.rentalRequest.deleteMany().then(r => r.count);

  // Schedule dependents
  deleted.rescheduleRequest    = await prisma.rescheduleRequest.deleteMany().then(r => r.count);
  deleted.scheduleFollowupQueue = await prisma.scheduleFollowupQueue.deleteMany().then(r => r.count);
  deleted.scheduleContact      = await prisma.scheduleContact.deleteMany().then(r => r.count);

  // Travel
  deleted.travelBooking = await prisma.travelBooking.deleteMany().then(r => r.count);

  // Schedule
  deleted.schedule = await prisma.schedule.deleteMany().then(r => r.count);
  deleted.customerSchedule = await prisma.customerSchedule.deleteMany().then(r => r.count);
  deleted.dateRequest      = await prisma.dateRequest.deleteMany().then(r => r.count);

  // Core domain tables
  deleted.offer              = await prisma.offer.deleteMany().then(r => r.count);
  deleted.transaction        = await prisma.transaction.deleteMany().then(r => r.count);
  deleted.orderForm          = await prisma.orderForm.deleteMany().then(r => r.count);
  deleted.customerManagement = await prisma.customerManagement.deleteMany().then(r => r.count);
  deleted.statusInformation  = await prisma.statusInformation.deleteMany().then(r => r.count);
  deleted.customerStat       = await prisma.customerStat.deleteMany().then(r => r.count);
  deleted.customerServiceLabel = await prisma.customerServiceLabel.deleteMany().then(r => r.count);

  // Auxiliary tables
  deleted.messageQueue   = await prisma.messageQueue.deleteMany().then(r => r.count);
  deleted.modeChangeLog  = await prisma.modeChangeLog.deleteMany().then(r => r.count);
  deleted.trafficSource  = await prisma.trafficSource.deleteMany().then(r => r.count);
  deleted.ragContextCache = await prisma.ragContextCache.deleteMany().then(r => r.count);

  // Chat & leads (parent tables)
  deleted.chatHistory = await prisma.chatHistory.deleteMany().then(r => r.count);
  deleted.lead        = await prisma.lead.deleteMany().then(r => r.count);

  // --- Print summary ---
  console.log('📊 Deletion summary:');
  let totalDeleted = 0;
  for (const [table, count] of Object.entries(deleted)) {
    if (count > 0) console.log(`  ✅ ${table}: ${count} rows deleted`);
    totalDeleted += count;
  }
  if (totalDeleted === 0) console.log('  (all tables were already empty)');
  console.log(`\n🎯 Total: ${totalDeleted} rows deleted`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
