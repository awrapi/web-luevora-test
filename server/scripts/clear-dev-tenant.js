/**
 * Script untuk membersihkan data percakapan, CRM, history, transaksi, dan Redis
 * pada akun development (Tenant ID = 21 / Nusantara Travel Dev),
 * Sembari MEMPERTAHANKAN inventory (Knowledge Base, Travel Packages, Bank Accounts, Persona).
 *
 * Run: node scripts/clear-dev-tenant.js
 */

import prisma from '../config/database.js';
import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const TENANT_ID = 21;
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

async function main() {
  console.log(`\n🧹 Membersihkan data percakapan & CRM untuk Tenant ID ${TENANT_ID} (Development)...`);
  console.log('══════════════════════════════════════════════════════════════════\n');

  // ─────────────────────────────────────────────────────────────
  // 1. Bersihkan tabel-tabel percakapan, CRM, transaksi, & log
  // ─────────────────────────────────────────────────────────────
  const tablesToClear = [
    'CustomerInteractionLog',
    'CentralInfoRequest',
    'OrderForm',
    'CustomerCrmHistory',
    'Offer',
    'EmailMessage',
    'Invoice',
    'RefundRequest',
    'CmChat',
    'CmRequestItem',
    'CustomerManagement',
    'CustomerRequest',
    'TravelBooking',
    'ActiveRental',
    'RentalRequest',
    'CustomerServiceLabel',
    'CustomerStat',
    'RescheduleRequest',
    'DateRequest',
    'CustomerSchedule',
    'ScheduleFollowupQueue',
    'ScheduleContact',
    'ModeChangeLog',
    'MessageQueue',
    'ChatHistory',
    'StatusInformation',
    'Transaction',
    'SystemGuiderChat',
    'SystemGuiderTodo',
    'RagContextCache',
    'AiCreditUsageLog',
    'Lead'
  ];

  let totalRecordsDeleted = 0;

  for (const table of tablesToClear) {
    if (prisma[table]) {
      try {
        const res = await prisma[table].deleteMany({ where: { tenant_id: TENANT_ID } });
        if (res.count > 0) {
          console.log(`   🗑️  ${table}: ${res.count} baris dihapus`);
          totalRecordsDeleted += res.count;
        }
      } catch (err) {
        console.warn(`   ⚠️ Gagal menghapus ${table}: ${err.message}`);
      }
    }
  }

  // Hapus khusus document_chunks untuk chat memory
  if (prisma.document_chunks) {
    try {
      const res = await prisma.document_chunks.deleteMany({
        where: { tenant_id: TENANT_ID, source_type: 'chat_memory' }
      });
      if (res.count > 0) {
        console.log(`   🗑️  document_chunks (chat_memory): ${res.count} baris dihapus`);
        totalRecordsDeleted += res.count;
      }
    } catch (err) {
      console.warn(`   ⚠️ Gagal menghapus document_chunks: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Reset AI Credit Usage ke 0 (limit tetap 15.000)
  // ─────────────────────────────────────────────────────────────
  try {
    await prisma.tenantAiCredit.update({
      where: { tenant_id: TENANT_ID },
      data: {
        credits_used: 0,
        is_active: 1
      }
    });
    console.log(`\n   💎 AI Credits untuk Tenant ${TENANT_ID} berhasil direset (0 / 15.000 terpakai).`);
  } catch (err) {
    console.warn(`   ⚠️ Gagal reset kredit: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Bersihkan cache & vektor di Redis terkait Tenant 21
  // ─────────────────────────────────────────────────────────────
  console.log(`\n   🔍 Memindai keys Redis terkait Tenant ${TENANT_ID}...`);
  let deletedKeysCount = 0;

  try {
    const stream = redis.scanStream({ match: `*${TENANT_ID}*`, count: 100 });
    const keysToDelete = new Set();

    stream.on('data', (resultKeys) => {
      for (const k of resultKeys) {
        // Jangan hapus vector embedding inventory (doc:*)
        if (k.startsWith('doc:')) continue;
        // Hapus key yang mengandung :21: atau _21_ atau di akhir string :21 atau _21
        if (k.includes(`:${TENANT_ID}:`) || k.includes(`_${TENANT_ID}_`) || k.endsWith(`:${TENANT_ID}`) || k.endsWith(`_${TENANT_ID}`) || k.includes(`tenant:${TENANT_ID}`)) {
          keysToDelete.add(k);
        }
      }
    });

    await new Promise((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    if (keysToDelete.size > 0) {
      const keysArray = Array.from(keysToDelete);
      await redis.del(...keysArray);
      deletedKeysCount = keysArray.length;
      console.log(`   🗑️  Redis: ${deletedKeysCount} keys dihapus (${keysArray.slice(0, 5).join(', ')}${keysArray.length > 5 ? '...' : ''})`);
    } else {
      console.log(`   ✨ Redis: Tidak ada key sisa untuk Tenant ${TENANT_ID}.`);
    }
  } catch (err) {
    console.warn(`   ⚠️ Gagal membersihkan Redis: ${err.message}`);
  }

  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(`✅ Pembersihan selesai! Total ${totalRecordsDeleted} data percakapan/CRM dan ${deletedKeysCount} key Redis dihapus.`);
  console.log(`📦 Data Inventory (Knowledge Base, Travel Packages, Bank Accounts) dan Persona TETAP UTUH dan siap untuk testing.`);
}

main()
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1); })
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });
