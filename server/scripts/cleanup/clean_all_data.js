import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis();

async function main() {
  console.log('=== DEV DATA CLEANUP ===\n');

  // 1. Flush Redis (chat buffers, queue data, state)
  console.log('[1/5] Flushing Redis...');
  await redis.flushall();
  console.log('  Redis flushed.\n');

  // 2. Delete child/dependent tables FIRST (foreign key order)
  console.log('[2/5] Cleaning dependent tables...');
  await prisma.refundRequest.deleteMany({});        // FK → transactions
  await prisma.customerRequest.deleteMany({});       // FK → transactions
  await prisma.centralInfoRequest.deleteMany({});    // FK → tenant
  await prisma.invoice.deleteMany({});               // FK → travel_bookings
  await prisma.orderForm.deleteMany({});             // FK → tenant
  console.log('  refund_requests, customer_requests, central_info_requests, invoices, order_forms cleared.\n');

  // 3. Core tables the user requested
  console.log('[3/5] Cleaning core tables (leads, chat, offers, transactions, CRM)...');
  await prisma.chatHistory.deleteMany({});
  await prisma.offer.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.travelBooking.deleteMany({});
  console.log('  chat_history, offers, transactions, leads, travel_bookings cleared.\n');

  // 4. CRM & customer-related tables
  console.log('[4/5] Cleaning CRM & customer tables...');
  await prisma.customerCrmHistory.deleteMany({});
  await prisma.customerManagement.deleteMany({});
  await prisma.customerStat.deleteMany({});
  await prisma.customerServiceLabel.deleteMany({});
  await prisma.customerSchedule.deleteMany({});
  await prisma.statusInformation.deleteMany({});
  await prisma.trafficSource.deleteMany({});
  await prisma.modeChangeLog.deleteMany({});
  await prisma.dateRequest.deleteMany({});
  await prisma.rescheduleRequest.deleteMany({});
  await prisma.messageQueue.deleteMany({});
  await prisma.ragContextCache.deleteMany({});
  await prisma.customerInteractionLog.deleteMany({});
  console.log('  All CRM & customer tables cleared.\n');

  // 5. Summary
  const counts = {
    leads: await prisma.lead.count(),
    chat_history: await prisma.chatHistory.count(),
    offers: await prisma.offer.count(),
    transactions: await prisma.transaction.count(),
    customer_requests: await prisma.customerRequest.count(),
    central_info_requests: await prisma.centralInfoRequest.count(),
    crm_history: await prisma.customerCrmHistory.count(),
  };
  console.log('[5/5] Verification (all should be 0):');
  console.table(counts);

  console.log('\n=== ALL CLEANUP COMPLETE! ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
