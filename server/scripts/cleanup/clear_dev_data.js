import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Clearing DEV database for fresh system testing...\n');

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
  deleted.emailMessage   = await prisma.emailMessage.deleteMany().then(r => r.count);

  // AI credit usage logs
  deleted.aiCreditUsageLog = await prisma.aiCreditUsageLog.deleteMany().then(r => r.count);

  // Media / context caches
  deleted.packageMediaContext = await prisma.packageMediaContext.deleteMany().then(r => r.count);
  deleted.packageMediaFile    = await prisma.packageMediaFile.deleteMany().then(r => r.count);
  deleted.kbMediaContext      = await prisma.kbMediaContext.deleteMany().then(r => r.count);
  deleted.kbMediaFile         = await prisma.kbMediaFile.deleteMany().then(r => r.count);
  deleted.document_chunks     = await prisma.document_chunks.deleteMany().then(r => r.count);

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
  console.log(`\n🎯 Total: ${totalDeleted} rows deleted across ${Object.keys(deleted).length} tables`);

  // --- Verify zero counts on key tables ---
  console.log('\n🔍 Verifying zero counts...');
  const checks = {
    leads:        await prisma.lead.count(),
    chatHistory:  await prisma.chatHistory.count(),
    offers:       await prisma.offer.count(),
    transactions: await prisma.transaction.count(),
    requests:     await prisma.customerRequest.count(),
    management:   await prisma.customerManagement.count(),
    schedules:    await prisma.schedule.count(),
    bookings:     await prisma.travelBooking.count(),
  };
  const allZero = Object.values(checks).every(c => c === 0);
  for (const [k, v] of Object.entries(checks)) {
    console.log(`  ${v === 0 ? '✅' : '❌'} ${k}: ${v}`);
  }
  console.log(allZero ? '\n✅ All key tables are clean!' : '\n❌ Some tables still have data!');

  // --- Preserved tables ---
  console.log('\n📦 Preserved (config/structural data):');
  const preserved = {
    tenants:         await prisma.tenant.count(),
    users:           await prisma.user.count(),
    knowledgeBases:  await prisma.knowledgeBase.count(),
    travelPackages:  await prisma.travelPackage.count(),
    advPackages:     await prisma.advancedTravelPackage.count(),
    rentalUnits:     await prisma.rentalUnit.count(),
    bankAccounts:    await prisma.bankAccount.count(),
    globalSettings:  await prisma.globalSetting.count(),
    sessionManagers: await prisma.sessionManager.count(),
    serviceLabels:   await prisma.serviceLabel.count(),
    aiCredits:       await prisma.tenantAiCredit.count(),
  };
  for (const [k, v] of Object.entries(preserved)) {
    console.log(`  📁 ${k}: ${v} rows`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
