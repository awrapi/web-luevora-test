/**
 * Script: Re-ekstrak teks dari PackageMediaFile & KbMediaFile
 * yang extracted_text-nya masih kosong karena bug PDFParse import.
 * 
 * Jalankan dengan:
 *   node reextract_pdfs.mjs
 */

import { PrismaClient } from '@prisma/client';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import https from 'https';
import http from 'http';
import path from 'path';

// pdf-parse exports a function directly (no destructuring)
let pdfParse;
try {
  pdfParse = require('pdf-parse');
  // Some versions wrap in a default key
  if (pdfParse && pdfParse.default) pdfParse = pdfParse.default;
} catch(e) {
  console.error('Failed to load pdf-parse:', e.message);
  process.exit(1);
}

const prisma = new PrismaClient();

const downloadBuffer = (url) => {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
};

const extractTextFromUrl = async (url, filename) => {
  try {
    const ext = path.extname(filename).toLowerCase();
    if (ext !== '.pdf') {
      console.log(`  SKIP (bukan PDF): ${filename}`);
      return null;
    }
    console.log(`  Downloading: ${url.substring(0, 80)}...`);
    const buffer = await downloadBuffer(url);
    // pdf-parse v2: PDFParse class, pass buffer via 'data' option
    const { PDFParse } = require('/home/ubuntu/luevora-dev/luevoracrew-2-staging/_new-system-client/server/node_modules/pdf-parse/dist/pdf-parse/cjs/index.cjs');
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = result?.text?.trim();
    console.log(`  Extracted: ${text?.length || 0} chars`);
    return text || null;
  } catch (err) {
    console.error(`  ERROR extracting ${filename}:`, err.message);
    return null;
  }
};

async function main() {
  console.log('=== RE-EXTRACTION SCRIPT ===\n');

  // 1. Proses PackageMediaFile (paket basic)
  console.log('--- PackageMediaFile (Basic Packages) ---');
  const pkgFiles = await prisma.packageMediaFile.findMany({
    where: {
      OR: [
        { extracted_text: null },
        { extracted_text: '' }
      ],
      file_type: { in: ['pdf', 'docx', 'excel'] }
    }
  });
  console.log(`Ditemukan ${pkgFiles.length} file kosong\n`);

  for (const file of pkgFiles) {
    console.log(`[PackageMediaFile ID:${file.id}] ${file.file_name}`);
    const text = await extractTextFromUrl(file.file_path, file.file_name);
    if (text) {
      await prisma.packageMediaFile.update({
        where: { id: file.id },
        data: { extracted_text: text }
      });
      console.log(`  ✅ Updated!\n`);
    } else {
      console.log(`  ⚠️  Tidak ada teks yang bisa diekstrak\n`);
    }
  }

  // 2. Proses KbMediaFile (Knowledge Base)
  console.log('\n--- KbMediaFile (Knowledge Base) ---');
  const kbFiles = await prisma.kbMediaFile.findMany({
    where: {
      OR: [
        { extracted_text: null },
        { extracted_text: '' }
      ],
      file_type: { in: ['pdf', 'docx', 'excel'] }
    }
  });
  console.log(`Ditemukan ${kbFiles.length} file kosong\n`);

  for (const file of kbFiles) {
    console.log(`[KbMediaFile ID:${file.id}] ${file.file_name}`);
    const text = await extractTextFromUrl(file.file_path, file.file_name);
    if (text) {
      await prisma.kbMediaFile.update({
        where: { id: file.id },
        data: { extracted_text: text }
      });
      console.log(`  ✅ Updated!\n`);
    } else {
      console.log(`  ⚠️  Tidak ada teks yang bisa diekstrak\n`);
    }
  }

  // 3. Proses MainPackageMediaFile (Advanced Package utama)
  console.log('\n--- MainPackageMediaFile (Advanced Package) ---');
  const mainFiles = await prisma.mainPackageMediaFile.findMany({
    where: {
      OR: [
        { extracted_text: null },
        { extracted_text: '' }
      ],
      file_type: { in: ['pdf', 'docx', 'excel'] }
    }
  });
  console.log(`Ditemukan ${mainFiles.length} file kosong\n`);

  for (const file of mainFiles) {
    console.log(`[MainPackageMediaFile ID:${file.id}] ${file.file_name}`);
    const text = await extractTextFromUrl(file.file_path, file.file_name);
    if (text) {
      await prisma.mainPackageMediaFile.update({
        where: { id: file.id },
        data: { extracted_text: text }
      });
      console.log(`  ✅ Updated!\n`);
    } else {
      console.log(`  ⚠️  Tidak ada teks yang bisa diekstrak\n`);
    }
  }

  // 4. Proses SubItemMediaFile (Advanced Package sub-items)
  console.log('\n--- SubItemMediaFile (Advanced Sub-Items) ---');
  const subFiles = await prisma.subItemMediaFile.findMany({
    where: {
      OR: [
        { extracted_text: null },
        { extracted_text: '' }
      ],
      file_type: { in: ['pdf', 'docx', 'excel'] }
    }
  });
  console.log(`Ditemukan ${subFiles.length} file kosong\n`);

  for (const file of subFiles) {
    console.log(`[SubItemMediaFile ID:${file.id}] ${file.file_name}`);
    const text = await extractTextFromUrl(file.file_path, file.file_name);
    if (text) {
      await prisma.subItemMediaFile.update({
        where: { id: file.id },
        data: { extracted_text: text }
      });
      console.log(`  ✅ Updated!\n`);
    } else {
      console.log(`  ⚠️  Tidak ada teks yang bisa diekstrak\n`);
    }
  }

  // 5. Proses AddonMediaFile (Advanced Package addons)
  console.log('\n--- AddonMediaFile (Advanced Package Addons) ---');
  const addonFiles = await prisma.addonMediaFile.findMany({
    where: {
      OR: [
        { extracted_text: null },
        { extracted_text: '' }
      ],
      file_type: { in: ['pdf', 'docx', 'excel'] }
    }
  });
  console.log(`Ditemukan ${addonFiles.length} file kosong\n`);

  for (const file of addonFiles) {
    console.log(`[AddonMediaFile ID:${file.id}] ${file.file_name}`);
    const text = await extractTextFromUrl(file.file_path, file.file_name);
    if (text) {
      await prisma.addonMediaFile.update({
        where: { id: file.id },
        data: { extracted_text: text }
      });
      console.log(`  ✅ Updated!\n`);
    } else {
      console.log(`  ⚠️  Tidak ada teks yang bisa diekstrak\n`);
    }
  }

  console.log('\n=== SELESAI ===');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Script error:', e);
  process.exit(1);
});
