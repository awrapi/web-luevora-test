/**
 * fix_file_extensions.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Migration script: Tambahkan ekstensi yang hilang pada kolom `file_path`
 * untuk semua tabel media file yang menyimpan URL Cloudinary raw files.
 *
 * Tabel yang diproses:
 *   - PackageMediaFile  (scope: package)
 *   - KbMediaFile       (scope: kb)
 *   - MainPackageMediaFile (scope: adv-main)
 *   - SubItemMediaFile  (scope: adv-sub)
 *   - AddonMediaFile    (scope: adv-addon)
 *
 * Cara kerja:
 *   1. Ambil semua record non-image yang file_path-nya tidak diakhiri ekstensi
 *   2. Inferensi ekstensi dari `file_type` (pdf → .pdf, docx → .docx, excel → .xlsx)
 *   3. Update file_path dengan menambahkan ekstensi yang benar
 *
 * Jalankan dengan:
 *   node server/scripts/seeder/fix_file_extensions.mjs
 * atau dari folder server/:
 *   node scripts/seeder/fix_file_extensions.mjs
 */

import { PrismaClient } from '@prisma/client';
import path from 'path';

const prisma = new PrismaClient();

// Map file_type → ekstensi yang benar
const FILE_TYPE_EXT_MAP = {
  pdf:   '.pdf',
  docx:  '.docx',
  excel: '.xlsx',
  other: null,   // tidak bisa diinferensikan
};

// Daftar tabel yang perlu diproses
const MODELS = [
  { name: 'PackageMediaFile',     model: prisma.packageMediaFile },
  { name: 'KbMediaFile',          model: prisma.kbMediaFile },
  { name: 'MainPackageMediaFile', model: prisma.mainPackageMediaFile },
  { name: 'SubItemMediaFile',     model: prisma.subItemMediaFile },
  { name: 'AddonMediaFile',       model: prisma.addonMediaFile },
];

/**
 * Cek apakah URL sudah punya ekstensi yang dikenal di akhirnya.
 */
const hasKnownExtension = (url) => {
  if (!url) return true;
  const lower = url.toLowerCase().split('?')[0]; // hapus query params
  return ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.jpg', '.jpeg', '.png', '.webp', '.gif'].some(ext => lower.endsWith(ext));
};

/**
 * Inferensi ekstensi dari file_type atau file_name sebagai fallback.
 */
const inferExtension = (fileType, fileName) => {
  // Coba dari file_type dulu
  const fromType = FILE_TYPE_EXT_MAP[fileType];
  if (fromType) return fromType;

  // Fallback: coba dari file_name
  if (fileName) {
    const ext = path.extname(fileName).toLowerCase();
    if (ext) return ext;
  }

  return null;
};

async function fixFileExtensions() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  fix_file_extensions.mjs — Memperbaiki ekstensi file  ');
  console.log('═══════════════════════════════════════════════════════\n');

  let totalFixed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const { name, model } of MODELS) {
    console.log(`\n📁 Tabel: ${name}`);
    console.log('─'.repeat(50));

    // Ambil semua file non-image
    const files = await model.findMany({
      where: {
        file_type: { notIn: ['image'] },
      },
      select: { id: true, file_name: true, file_path: true, file_type: true },
    });

    console.log(`   Ditemukan ${files.length} record non-image`);

    let tableFixed = 0;
    let tableSkipped = 0;
    let tableErrors = 0;

    for (const file of files) {
      // Skip jika sudah punya ekstensi
      if (hasKnownExtension(file.file_path)) {
        tableSkipped++;
        continue;
      }

      const ext = inferExtension(file.file_type, file.file_name);
      if (!ext) {
        console.warn(`   ⚠️  ID ${file.id}: tidak bisa inferensi ekstensi (type=${file.file_type}, name=${file.file_name})`);
        tableSkipped++;
        continue;
      }

      const newPath = `${file.file_path}${ext}`;

      try {
        await model.update({
          where: { id: file.id },
          data: { file_path: newPath },
        });
        console.log(`   ✓ ID ${file.id}: ...${file.file_path.slice(-30)} → ${ext}`);
        tableFixed++;
      } catch (err) {
        console.error(`   ✗ ID ${file.id}: Gagal update — ${err.message}`);
        tableErrors++;
      }
    }

    console.log(`   Hasil: ${tableFixed} diperbaiki, ${tableSkipped} sudah benar/skip, ${tableErrors} error`);
    totalFixed    += tableFixed;
    totalSkipped  += tableSkipped;
    totalErrors   += tableErrors;
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  SELESAI');
  console.log(`  ✓ Total diperbaiki : ${totalFixed}`);
  console.log(`  ○ Total skip       : ${totalSkipped}`);
  console.log(`  ✗ Total error      : ${totalErrors}`);
  console.log('═══════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
}

fixFileExtensions().catch(async (err) => {
  console.error('Fatal error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
