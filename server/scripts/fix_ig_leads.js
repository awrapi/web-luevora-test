/**
 * ================================================================
 * Migration: Fix Instagram leads yang tersimpan dengan prefix "ig_"
 * ================================================================
 *
 * Masalah lama:
 *  - Username Instagram disimpan di kolom `phone` dengan prefix "ig_"
 *    (mis. "ig_johndoe") agar tidak tabrakan dengan nomor WA.
 *  - Lead Instagram salah tercatat punya `whatsapp_phone` (diisi username
 *    IG) padahal user tidak pernah memberikan nomor WhatsApp.
 *  - Kolom `channel` kadang kosong / tidak konsisten.
 *
 * Yang dilakukan script ini:
 *  1. Memastikan kolom `instagram_username` ada di tabel `leads`.
 *  2. Untuk setiap lead dengan phone LIKE 'ig_%':
 *     - set `instagram_username` = username murni (tanpa "ig_")
 *     - set `channel` = 'instagram' jika kosong
 *     - kosongkan `whatsapp_phone` jika nilainya sama dengan phone ber-prefix
 *       (karena itu bukan nomor WA yang valid, melainkan username IG)
 *  3. Rename `phone` dari "ig_xxx" menjadi "xxx" (pure username).
 *     Jika pure username sudah dipakai oleh lead lain (collision), lead
 *     lama di-merge / di-skip agar tidak melanggar unique constraint.
 *
 * Jalankan:  node server/scripts/fix_ig_leads.js
 * ================================================================
 */

import prisma from '../config/database.js';

async function ensureColumn() {
  // Cek apakah kolom instagram_username sudah ada di tabel leads.
  // (Sebaiknya jalankan `npx prisma db push` terlebih dahulu agar skema
  //  dan Prisma Client sinkron, lalu jalankan script ini untuk data.)
  const cols = await prisma.$queryRawUnsafe(`SHOW COLUMNS FROM leads LIKE 'instagram_username'`);
  if (!cols || cols.length === 0) {
    await prisma.$executeRawUnsafe(`ALTER TABLE leads ADD COLUMN instagram_username VARCHAR(255) NULL`);
    console.log('[fix_ig_leads] Kolom instagram_username ditambahkan');
  } else {
    console.log('[fix_ig_leads] Kolom instagram_username sudah ada');
  }
}

async function main() {
  console.log('[fix_ig_leads] Mulai migrasi data Instagram leads...');

  await ensureColumn();

  // Ambil semua lead dengan phone ber-prefix "ig_"
  const igLeads = await prisma.lead.findMany({
    where: { phone: { startsWith: 'ig_' } }
  });

  console.log(`[fix_ig_leads] Ditemukan ${igLeads.length} lead dengan prefix "ig_"`);

  let fixed = 0;
  let skipped = 0;

  for (const lead of igLeads) {
    const pureUsername = lead.phone.replace(/^ig_/, '');

    // Cek collision: apakah sudah ada lead lain dengan phone = pureUsername?
    const existing = await prisma.lead.findUnique({
      where: { uk_tenant_phone: { tenant_id: lead.tenant_id, phone: pureUsername } }
    });

    if (existing && existing.id !== lead.id) {
      // Collision — skip rename, tapi tetap isi instagram_username & bersihkan whatsapp_phone
      console.warn(`[fix_ig_leads] SKIP rename ${lead.phone} → ${pureUsername} (sudah dipakai lead id=${existing.id}). Hanya perbaiki platform identity.`);
      try {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            instagram_username: lead.instagram_username || pureUsername,
            channel: lead.channel || 'instagram',
            whatsapp_phone: (lead.whatsapp_phone === lead.phone || lead.whatsapp_phone === `ig_${pureUsername}`) ? null : lead.whatsapp_phone
          }
        });
      } catch (e) {
        console.error(`[fix_ig_leads] Gagal update lead id=${lead.id}:`, e.message);
      }
      skipped++;
      continue;
    }

    // Tidak ada collision — rename phone ke pure username + perbaiki platform identity
    try {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          phone: pureUsername,
          instagram_username: lead.instagram_username || pureUsername,
          channel: lead.channel || 'instagram',
          // Hapus whatsapp_phone jika nilainya adalah username IG (bukan nomor WA valid)
          whatsapp_phone: (lead.whatsapp_phone === lead.phone || lead.whatsapp_phone === `ig_${pureUsername}`) ? null : lead.whatsapp_phone
        }
      });
      console.log(`[fix_ig_leads] ✓ ${lead.phone} → ${pureUsername}`);
      fixed++;
    } catch (e) {
      console.error(`[fix_ig_leads] Gagal rename lead id=${lead.id} (${lead.phone}):`, e.message);
      skipped++;
    }
  }

  console.log(`\n[fix_ig_leads] Selesai. Fixed: ${fixed}, Skipped: ${skipped}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('[fix_ig_leads] FATAL:', err);
  await prisma.$disconnect();
  process.exit(1);
});
