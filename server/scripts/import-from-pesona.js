/**
 * Import script — copy knowledge_base & travel_packages dari Pesona Indonesia Travel (id=16)
 * ke tenant dev Nusantara Travel Dev (id=21)
 *
 * Run: node scripts/import-from-pesona.js
 */

import prisma from '../config/database.js';

const SOURCE_ID = 16; // Pesona Indonesia Travel
const TARGET_ID = 21; // Nusantara Travel Dev

async function main() {
  console.log(`\n📦 Import data dari tenant ${SOURCE_ID} → ${TARGET_ID}`);
  console.log('═══════════════════════════════════════════\n');

  let totalImported = 0;

  // ─────────────────────────────────────────────────────────────
  // 1. Knowledge Base
  // ─────────────────────────────────────────────────────────────
  const kbItems = await prisma.knowledgeBase.findMany({
    where: { tenant_id: SOURCE_ID },
  });
  console.log(`📚 Knowledge Base: ${kbItems.length} item ditemukan`);

  // Hapus KB lama di target dulu (bawaan seed) agar tidak duplikat
  const deleted = await prisma.knowledgeBase.deleteMany({ where: { tenant_id: TARGET_ID } });
  console.log(`   🗑  Hapus ${deleted.count} KB lama di dev tenant`);

  for (const kb of kbItems) {
    const { id, tenant_id, created_at, updated_at, ...rest } = kb;
    await prisma.knowledgeBase.create({
      data: { ...rest, tenant_id: TARGET_ID },
    });
    console.log(`   ✅ KB: [${kb.type}] ${kb.title || '(no title)'}`);
    totalImported++;
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Travel Packages
  // ─────────────────────────────────────────────────────────────
  const travelPackages = await prisma.travelPackage.findMany({
    where: { tenant_id: SOURCE_ID },
  });
  console.log(`\n✈️  Travel Packages: ${travelPackages.length} paket ditemukan`);

  for (const pkg of travelPackages) {
    const { id, tenant_id, created_at, updated_at, ...rest } = pkg;

    // Cek apakah sudah ada (berdasarkan nama)
    const exists = await prisma.travelPackage.findFirst({
      where: { tenant_id: TARGET_ID, package_name: pkg.package_name },
    });
    if (exists) {
      console.log(`   ⏭  Skip (sudah ada): ${pkg.package_name}`);
      continue;
    }

    await prisma.travelPackage.create({
      data: { ...rest, tenant_id: TARGET_ID },
    });
    console.log(`   ✅ Paket: ${pkg.package_name} (${pkg.destination})`);
    totalImported++;
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Advanced Travel Packages (jika ada)
  // ─────────────────────────────────────────────────────────────
  const advPackages = await prisma.advancedTravelPackage.findMany({
    where: { tenant_id: SOURCE_ID },
    include: {
      addons:    true,
      sub_items: true,
    },
  });
  console.log(`\n🗂  Advanced Packages: ${advPackages.length} paket ditemukan`);

  for (const adv of advPackages) {
    const { id: advId, tenant_id, created_at, updated_at, addons, sub_items, ...advRest } = adv;

    const exists = await prisma.advancedTravelPackage.findFirst({
      where: { tenant_id: TARGET_ID, package_name: adv.package_name },
    });
    if (exists) {
      console.log(`   ⏭  Skip (sudah ada): ${adv.package_name}`);
      continue;
    }

    const newAdv = await prisma.advancedTravelPackage.create({
      data: { ...advRest, tenant_id: TARGET_ID },
    });
    console.log(`   ✅ Adv Paket: ${adv.package_name}`);
    totalImported++;

    // Sub-items
    for (const sub of sub_items) {
      const { id, tenant_id, created_at, updated_at, adv_package_id, ...subRest } = sub;
      await prisma.advancedPackageSubItem.create({
        data: { ...subRest, tenant_id: TARGET_ID, adv_package_id: newAdv.id },
      });
    }

    // Addons
    for (const addon of addons) {
      const { id, tenant_id, created_at, updated_at, adv_package_id, ...addonRest } = addon;
      await prisma.advancedPackageAddon.create({
        data: { ...addonRest, tenant_id: TARGET_ID, adv_package_id: newAdv.id },
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. Bank Accounts (opsional — skip jika sudah ada)
  // ─────────────────────────────────────────────────────────────
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { tenant_id: SOURCE_ID },
  });
  console.log(`\n🏦 Bank Accounts: ${bankAccounts.length} rekening ditemukan`);

  const existingBanks = await prisma.bankAccount.findMany({ where: { tenant_id: TARGET_ID } });
  const existingNos = new Set(existingBanks.map(b => b.account_number));

  for (const bank of bankAccounts) {
    if (existingNos.has(bank.account_number)) {
      console.log(`   ⏭  Skip (sudah ada): ${bank.bank_name} ${bank.account_number}`);
      continue;
    }
    const { id, tenant_id, created_at, ...bankRest } = bank;
    await prisma.bankAccount.create({
      data: { ...bankRest, tenant_id: TARGET_ID },
    });
    console.log(`   ✅ Bank: ${bank.bank_name} ${bank.account_number} a/n ${bank.account_holder}`);
    totalImported++;
  }

  // ─────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════');
  console.log(`🎉 Import selesai! Total: ${totalImported} item di-import`);
  console.log(`   Dari: Pesona Indonesia Travel (id=${SOURCE_ID})`);
  console.log(`   Ke  : Nusantara Travel Dev    (id=${TARGET_ID})`);
}

main()
  .catch(e => { console.error('❌ Error:', e.message); console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
