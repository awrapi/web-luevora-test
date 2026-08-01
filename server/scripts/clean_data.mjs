/**
 * clean_data.mjs
 * ───────────────────────────────────────────────────
 * Membersihkan data operasional tanpa menghapus
 * data master (tenant, user, knowledge_base, packages, dll).
 *
 * Kategori yang dibersihkan:
 *   1. Leads        – Semua data lead / kontak masuk
 *   2. Chat         – Riwayat chat & antrian pesan
 *   3. Request      – Customer request, date request, reschedule, rental request
 *   4. CRM          – Offers, stats, labels customer, traffic source, mode log
 *   5. History      – Transaksi, booking, invoice, active rental, RAG cache
 *
 * Cara pakai:
 *   node scripts/clean_data.mjs           → clean semua kategori
 *   node scripts/clean_data.mjs leads     → clean leads saja
 *   node scripts/clean_data.mjs chat crm  → clean chat & crm saja
 * ───────────────────────────────────────────────────
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Warna console ──────────────────────────────────
const C = {
  reset:   '\x1b[0m',
  bright:  '\x1b[1m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  cyan:    '\x1b[36m',
  magenta: '\x1b[35m',
  dim:     '\x1b[2m',
};

// ─── Definisi tabel per kategori ────────────────────
const CATEGORIES = {
  leads: {
    label: '👤 Leads',
    tables: ['leads'],
  },
  chat: {
    label: '💬 Chat & Message Queue',
    tables: ['chat_history', 'message_queue'],
  },
  request: {
    label: '📋 Request',
    tables: [
      'customer_requests',
      'date_requests',
      'reschedule_requests',
      'rental_requests',
      'schedule_followup_queue',
      'schedule_contacts',
      'customer_schedules',
    ],
  },
  crm: {
    label: '📊 CRM & Analytics',
    tables: [
      'offers',
      'customer_stats',
      'customer_service_labels',
      'traffic_sources',
      'mode_change_log',
    ],
  },
  history: {
    label: '📜 History (Transaksi, Booking, Invoice, RAG Cache)',
    tables: [
      'invoices',
      'active_rentals',
      'travel_bookings',
      'transactions',
      'rag_context_caches',
    ],
  },
  email: {
    label: '✉️ Email Messages',
    tables: [
      'email_messages',
    ],
  },
  // Catatan: Notifikasi tidak punya tabel sendiri.
  // Data notifikasi diambil dari: transactions, customer_requests,
  // status_informations, dan offers — sudah ter-cover oleh kategori lain.
};

// ─── Helper: truncate satu tabel ────────────────────
async function truncateTable(tableName) {
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM \`${tableName}\``);
    await prisma.$executeRawUnsafe(`ALTER TABLE \`${tableName}\` AUTO_INCREMENT = 1`);
    return { table: tableName, ok: true };
  } catch (err) {
    return { table: tableName, ok: false, error: err.message };
  }
}

// ─── Main ───────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2).map(a => a.toLowerCase());

  // Tentukan kategori yang akan di-clean
  let selectedKeys;
  if (args.length === 0 || args.includes('all')) {
    selectedKeys = Object.keys(CATEGORIES);
  } else {
    selectedKeys = args.filter(a => CATEGORIES[a]);
    const unknown = args.filter(a => !CATEGORIES[a] && a !== 'all');
    if (unknown.length) {
      console.log(`${C.yellow}⚠  Kategori tidak dikenal: ${unknown.join(', ')}${C.reset}`);
      console.log(`   Pilihan: ${Object.keys(CATEGORIES).join(', ')}, all\n`);
    }
    if (selectedKeys.length === 0) {
      console.log(`${C.red}✖  Tidak ada kategori valid. Batal.${C.reset}`);
      process.exit(1);
    }
  }

  console.log();
  console.log(`${C.bright}${C.cyan}╔════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bright}${C.cyan}║     🧹  LUEVORA — CLEAN DATA TOOL             ║${C.reset}`);
  console.log(`${C.bright}${C.cyan}╚════════════════════════════════════════════════╝${C.reset}`);
  console.log();

  // Disable foreign key checks
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');

  let totalSuccess = 0;
  let totalFailed = 0;

  for (const key of selectedKeys) {
    const cat = CATEGORIES[key];
    console.log(`${C.bright}${C.magenta}── ${cat.label} ──${C.reset}`);

    for (const table of cat.tables) {
      const result = await truncateTable(table);
      if (result.ok) {
        console.log(`   ${C.green}✔${C.reset} ${table}`);
        totalSuccess++;
      } else {
        console.log(`   ${C.red}✖${C.reset} ${table} ${C.dim}— ${result.error}${C.reset}`);
        totalFailed++;
      }
    }
    console.log();
  }

  // Re-enable foreign key checks
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');

  // Summary
  console.log(`${C.bright}${C.cyan}─────────────────────────────────────────────────${C.reset}`);
  console.log(`${C.bright}   Hasil:${C.reset}  ${C.green}${totalSuccess} berhasil${C.reset}  |  ${totalFailed > 0 ? C.red : C.dim}${totalFailed} gagal${C.reset}`);
  console.log(`${C.bright}${C.cyan}─────────────────────────────────────────────────${C.reset}`);
  console.log();
}

main()
  .catch((e) => {
    console.error(`${C.red}Error:${C.reset}`, e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
