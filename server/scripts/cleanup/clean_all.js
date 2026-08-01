/**
 * ═══════════════════════════════════════════════════════════════════════
 *  LUEVORA DEV — Full Data Cleanup Script (Inventory & PDF Safe)
 *  Clears ALL customer/transactional data for clean testing.
 *  ═══════════════════════════════════════════════════════════════════
 *
 *  🛡️  NEVER DELETED (inventory + PDF + config):
 *    - tenants, users
 *    - travelPackages, advancedTravelPackage (+ sub-items, addons, media, availability, pricing)
 *    - rentalUnits (inventory)
 *    - invoiceTemplates (PDF templates)
 *    - knowledgeBases (+ kb media)
 *    - bankAccounts, globalSettings, serviceLabels
 *    - tenantAiCredits, tenantPhoneNumbers
 *    - emailAccounts, telegramAccounts
 *    - orderFormConfigs
 *    - document_chunks (KB embeddings — NOT chat_memory)
 *    - Redis vectors (doc:*) — preserved via selective flush
 *
 *  ✅ CLEANED:
 *    - Redis: selective flush (buffers, locks, intents, progress, gatekeeper state)
 *    - Redis: chat_memory document_chunks only
 *    - Leads & Chat History
 *    - CRM: CustomerManagement, CmChat, CmRequestItem
 *    - CustomerCrmHistory, CustomerInteractionLog
 *    - CentralInfoRequest, SystemGuiderChat, SystemGuiderTodo
 *    - Offers, Transactions, Invoices (generated PDFs), RefundRequests
 *    - OrderForms, CustomerRequests
 *    - TravelBookings, DateRequests, RescheduleRequests
 *    - Schedules, CustomerSchedules, ScheduleContacts, ScheduleFollowupQueues
 *    - ActiveRentals, RentalRequests
 *    - CustomerStats, CustomerServiceLabels, StatusInformation
 *    - MessageQueues, ModeChangeLogs, TrafficSources
 *    - RagContextCaches, EmailMessages, SessionManagers
 *    - AiCreditUsageLogs
 *    - PackageMediaContexts, PackageMediaFiles (runtime cache, not inventory)
 *
 *  Usage:  cd server && node scripts/cleanup/clean_all.js
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

// ─────────────────────────────────────────────
// Table deletion order (respecting FK constraints)
// Grouped by dependency depth — deepest children first
// ─────────────────────────────────────────────

const TABLES_TO_CLEAR = [
  // ── Depth 4: deepest children ──
  'systemGuiderChat',         // FK → centralInfoRequest
  'systemGuiderTodo',         // FK → centralInfoRequest
  'cmChat',                   // FK → customerManagement
  'cmRequestItem',            // FK → customerManagement

  // ── Depth 3: interaction & CRM logs ──
  'customerInteractionLog',
  'customerCrmHistory',
  'centralInfoRequest',

  // ── Depth 3: transaction dependents ──
  'refundRequest',            // FK → transaction
  'customerRequest',          // FK → transaction
  'invoice',                  // generated PDF invoices (FK → travelBooking)

  // ── Depth 3: rental dependents ──
  'activeRental',
  'rentalRequest',

  // ── Depth 3: schedule dependents ──
  'rescheduleRequest',
  'scheduleFollowupQueue',
  'scheduleContact',

  // ── Depth 3: travel ──
  'travelBooking',

  // ── Depth 2: schedules ──
  'schedule',
  'customerSchedule',
  'dateRequest',

  // ── Depth 2: core domain ──
  'offer',
  'transaction',
  'orderForm',
  'customerManagement',
  'statusInformation',
  'customerStat',
  'customerServiceLabel',

  // ── Depth 2: auxiliary ──
  'messageQueue',
  'modeChangeLog',
  'trafficSource',
  'ragContextCache',
  'emailMessage',
  'sessionManager',

  // ── Depth 2: AI credit usage logs ──
  'aiCreditUsageLog',

  // ── Depth 2: runtime media caches (NOT inventory) ──
  'packageMediaContext',
  'packageMediaFile',

  // ── Depth 1: parent tables (last) ──
  'chatHistory',
  'lead',
];

// ─────────────────────────────────────────────
// 🛡️  NEVER DELETE — these tables are EXCLUDED
// ─────────────────────────────────────────────
const NEVER_DELETE = [
  // Config / structural
  'tenant',
  'user',
  'bankAccount',
  'globalSetting',
  'serviceLabel',
  'tenantAiCredit',
  'tenantPhoneNumber',
  'emailAccount',
  'telegramAccount',
  'orderFormConfig',
  'invoiceTemplate',          // 🛡️ PDF templates

  // Inventory (packages + units)
  'travelPackage',            // 🛡️ inventory
  'advancedTravelPackage',    // 🛡️ inventory
  'mainPackageMediaFile',     // 🛡️ inventory media
  'advancedPackageSubItem',   // 🛡️ inventory sub-items
  'subItemMediaFile',         // 🛡️ inventory media
  'packageAvailabilityRule',  // 🛡️ inventory rules
  'packageSlotOverride',      // 🛡️ inventory overrides
  'packagePriceOverride',     // 🛡️ inventory pricing
  'advancedPackageAddon',     // 🛡️ inventory addons
  'addonMediaFile',           // 🛡️ inventory media
  'rentalUnit',               // 🛡️ inventory units

  // Knowledge base + embeddings
  'knowledgeBase',            // 🛡️ KB data
  'kbMediaContext',           // 🛡️ KB media
  'kbMediaFile',              // 🛡️ KB media files
  'document_chunks',          // 🛡️ KB embeddings (only chat_memory deleted selectively)
];

// ─────────────────────────────────────────────
// Redis: selective key deletion
// Preserves: doc:* (vector embeddings for inventory/KB)
// Deletes: buffer:*, processing:*, pending:*, gatekeeper:*,
//          pipeline:*, deferred_intent:*, lock:*
// ─────────────────────────────────────────────
const REDIS_KEY_PATTERNS_TO_DELETE = [
  'buffer:*',
  'processing:*',
  'pending:*',
  'gatekeeper:*',
  'pipeline:*',
  'pipeline_abort:*',
  'deferred_intent:*',
  'lock:*',
];

async function selectiveRedisFlush() {
  let totalKeys = 0;

  // 1. Delete by known patterns
  for (const pattern of REDIS_KEY_PATTERNS_TO_DELETE) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        const deleted = await redis.del(...keys);
        totalKeys += deleted;
        console.log(`  🗑️  ${pattern}: ${deleted} keys deleted`);
      }
    } catch (e) {
      console.log(`  ⚠️  Pattern ${pattern}: ${e.message}`);
    }
  }

  // 2. Delete chat_memory document_chunks from DB (not KB embeddings)
  try {
    const chatMemoryResult = await prisma.document_chunks.deleteMany({
      where: { source_type: 'chat_memory' }
    });
    if (chatMemoryResult.count > 0) {
      console.log(`  🗑️  chat_memory embeddings: ${chatMemoryResult.count} chunks deleted`);
    }
  } catch (e) {
    // table might not have source_type field, ignore
  }

  // 3. Scan for any remaining non-doc: keys (catch-all for runtime state)
  try {
    let cursor = '0';
    let scanCount = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'COUNT', 100);
      cursor = nextCursor;
      const nonDocKeys = keys.filter(k => !k.startsWith('doc:'));
      if (nonDocKeys.length > 0) {
        const del = await redis.del(...nonDocKeys);
        totalKeys += del;
        scanCount += del;
      }
    } while (cursor !== '0');
    if (scanCount > 0) {
      console.log(`  🗑️  misc runtime keys: ${scanCount} keys deleted`);
    }
  } catch (e) {
    console.log(`  ⚠️  SCAN cleanup: ${e.message}`);
  }

  return totalKeys;
}

async function main() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log(' 🧹 LUEVORA DEV — Full Data Cleanup (Inventory & PDF Safe)');
  console.log('══════════════════════════════════════════════════════════════\n');

  // ── Step 1: Selective Redis flush (preserve doc:* vectors) ──
  console.log('🔴 [1/4] Selective Redis flush (preserving doc:* vectors)...');
  try {
    const redisKeysDeleted = await selectiveRedisFlush();
    console.log(`  ✅ Redis: ${redisKeysDeleted} keys deleted (doc:* vectors preserved)`);
  } catch (e) {
    console.log(`  ⚠️  Redis flush failed: ${e.message}`);
  }

  // ── Step 2: Delete chat_memory embeddings only ──
  console.log('\n🧠 [2/4] Cleaning chat_memory embeddings...');
  try {
    const chatMemoryResult = await prisma.document_chunks.deleteMany({
      where: { source_type: 'chat_memory' }
    });
    console.log(`  ✅ chat_memory chunks: ${chatMemoryResult.count} deleted (KB embeddings preserved)`);
  } catch (e) {
    console.log(`  ⚠️  chat_memory cleanup: ${e.message}`);
  }

  // ── Step 3: Delete all transactional data ──
  console.log('\n🗑️  [3/4] Clearing database tables...\n');

  const deleted = {};
  let totalDeleted = 0;

  for (const table of TABLES_TO_CLEAR) {
    try {
      if (!prisma[table]) {
        console.log(`  ⚠️  ${table}: Prisma model not found, skipping`);
        continue;
      }
      const result = await prisma[table].deleteMany({});
      deleted[table] = result.count;
      totalDeleted += result.count;
      if (result.count > 0) {
        console.log(`  ✅ ${table}: ${result.count} rows deleted`);
      }
    } catch (error) {
      console.log(`  ❌ ${table}: ${error.message}`);
      deleted[table] = -1;
    }
  }

  // ── Step 4: Verify zero counts ──
  console.log('\n🔍 [4/4] Verifying clean state...\n');

  const verifyTables = [
    ['leads',           () => prisma.lead.count()],
    ['chatHistory',     () => prisma.chatHistory.count()],
    ['offers',          () => prisma.offer.count()],
    ['transactions',    () => prisma.transaction.count()],
    ['customerRequests',() => prisma.customerRequest.count()],
    ['customerMgmt',   () => prisma.customerManagement.count()],
    ['cmChats',         () => prisma.cmChat.count()],
    ['cmRequestItems',  () => prisma.cmRequestItem.count()],
    ['crmHistory',      () => prisma.customerCrmHistory.count()],
    ['centralInfoReqs', () => prisma.centralInfoRequest.count()],
    ['guiderChats',     () => prisma.systemGuiderChat.count()],
    ['guiderTodos',     () => prisma.systemGuiderTodo.count()],
    ['schedules',       () => prisma.schedule.count()],
    ['bookings',        () => prisma.travelBooking.count()],
    ['invoices',        () => prisma.invoice.count()],
    ['orderForms',      () => prisma.orderForm.count()],
    ['interactions',    () => prisma.customerInteractionLog.count()],
    ['messageQueue',    () => prisma.messageQueue.count()],
  ];

  let allClean = true;
  for (const [label, countFn] of verifyTables) {
    try {
      const count = await countFn();
      const icon = count === 0 ? '✅' : '❌';
      console.log(`  ${icon} ${label}: ${count}`);
      if (count > 0) allClean = false;
    } catch (e) {
      console.log(`  ⚠️  ${label}: could not verify`);
    }
  }

  // ── Summary ──
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(` 🎯 Total deleted: ${totalDeleted} rows across ${Object.keys(deleted).length} tables`);
  console.log(allClean ? ' ✅ ALL TRANSACTIONAL TABLES CLEAN — ready for testing!' : ' ⚠️  Some tables still have data!');
  console.log('══════════════════════════════════════════════════════════════\n');

  // ── Show preserved tables ──
  console.log('🛡️  PRESERVED (inventory, PDF, config — NEVER deleted):');
  const preserved = [
    ['tenants',        () => prisma.tenant.count()],
    ['users',          () => prisma.user.count()],
    ['knowledgeBases', () => prisma.knowledgeBase.count()],
    ['travelPackages', () => prisma.travelPackage.count()],
    ['advPackages',    () => prisma.advancedTravelPackage.count()],
    ['rentalUnits',    () => prisma.rentalUnit.count()],
    ['bankAccounts',   () => prisma.bankAccount.count()],
    ['globalSettings', () => prisma.globalSetting.count()],
    ['serviceLabels',  () => prisma.serviceLabel.count()],
    ['aiCredits',      () => prisma.tenantAiCredit.count()],
    ['phoneNumbers',   () => prisma.tenantPhoneNumber.count()],
    ['emailAccounts',  () => prisma.emailAccount.count()],
    ['telegramAccts',  () => prisma.telegramAccount.count()],
    ['orderFormCfgs',  () => prisma.orderFormConfig.count()],
    ['invoiceTpls',    () => prisma.invoiceTemplate.count()],
    ['kbMediaCtx',     () => prisma.kbMediaContext.count()],
    ['kbMediaFiles',   () => prisma.kbMediaFile.count()],
    ['docChunks(KB)',  () => prisma.document_chunks.count()],
  ];

  for (const [label, countFn] of preserved) {
    try {
      const count = await countFn();
      console.log(`  🛡️  ${label}: ${count} rows`);
    } catch (e) {
      console.log(`  🛡️  ${label}: (could not count)`);
    }
  }

  console.log('');
}

main()
  .catch((err) => {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    try { await redis.quit(); } catch (_) {}
  });
