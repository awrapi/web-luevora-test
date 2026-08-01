/**
 * Script to clean all test/demo data for tenant_id = 11
 * Preserves: tenants, users, global_settings, knowledge_base, travel_packages, bank_accounts, etc.
 * Deletes: leads, chat_history, transactions, offers, crm, central_information, invoices, email_messages, rag_cache
 */
import prisma from '../config/database.js';

const TENANT_ID = 11;

async function cleanData() {
  console.log(`\n🗑️  Starting data cleanup for Tenant ID: ${TENANT_ID}...\n`);

  const steps = [
    // Hapus dulu child tables yang punya foreign key ke parent
    { label: 'rag_context_caches',           fn: () => prisma.ragContextCache.deleteMany({ where: { tenant_id: TENANT_ID } }) },
    { label: 'customer_crm_history',         fn: () => prisma.customerCrmHistory.deleteMany({ where: { tenant_id: TENANT_ID } }) },
    { label: 'customer_management',          fn: () => prisma.customerManagement.deleteMany({ where: { tenant_id: TENANT_ID } }) },
    { label: 'status_information',           fn: () => prisma.statusInformation.deleteMany({ where: { tenant_id: TENANT_ID } }) },
    { label: 'refund_requests',              fn: () => prisma.refundRequest.deleteMany({ where: { tenant_id: TENANT_ID } }) },
    { label: 'customer_requests',            fn: () => prisma.customerRequest.deleteMany({ where: { tenant_id: TENANT_ID } }) },
    { label: 'transactions',                 fn: () => prisma.transaction.deleteMany({ where: { tenant_id: TENANT_ID } }) },
    { label: 'offers',                       fn: () => prisma.offer.deleteMany({ where: { tenant_id: TENANT_ID } }) },
    { label: 'invoices',                     fn: () => prisma.invoice.deleteMany({ where: { tenant_id: TENANT_ID } }) },
    { label: 'chat_history',                 fn: () => prisma.chatHistory.deleteMany({ where: { tenant_id: TENANT_ID } }) },
    { label: 'email_messages',               fn: () => prisma.emailMessage.deleteMany({ where: { tenant_id: TENANT_ID } }) },
    { label: 'customer_service_labels',      fn: () => prisma.customerServiceLabel.deleteMany({ where: { tenant_id: TENANT_ID } }) },
    { label: 'leads (last)',                 fn: () => prisma.lead.deleteMany({ where: { tenant_id: TENANT_ID } }) },
    { label: 'session_manager',              fn: () => prisma.sessionManager.deleteMany({ where: { tenant_id: TENANT_ID } }) },
  ];

  let totalDeleted = 0;
  for (const step of steps) {
    try {
      const result = await step.fn();
      const count = result.count ?? 0;
      totalDeleted += count;
      if (count > 0) {
        console.log(`  ✅ ${step.label}: ${count} rows deleted`);
      } else {
        console.log(`  ⬜ ${step.label}: nothing to delete`);
      }
    } catch (err) {
      console.warn(`  ⚠️  ${step.label}: skipped — ${err.message.split('\n')[0]}`);
    }
  }

  console.log(`\n✨ Done! Total rows deleted: ${totalDeleted}\n`);
  await prisma.$disconnect();
}

cleanData().catch(async (e) => {
  console.error('❌ Error during cleanup:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
