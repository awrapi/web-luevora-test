import { PrismaClient } from '@prisma/client';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

import mammoth from 'mammoth';
import xlsx from 'xlsx';
import { executeFastJsonAI } from '../ai_agent/logic.service.js';
import { embeddingService } from '../deep_rag_engine/embedding.service.js';
import { uploadFromBuffer } from '../shared/cloudinary.service.js';

const prisma = new PrismaClient();

// Helper to extract text from buffer
const extractTextFromBuffer = async (buffer, originalname) => {
  try {
    const ext = path.extname(originalname).toLowerCase();
    
    if (ext === '.pdf') {
      // pdf-parse v2: pass buffer via 'data' option
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      return result.text;
    } else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      let fullText = '';
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        fullText += xlsx.utils.sheet_to_csv(sheet) + '\n\n';
      });
      return fullText;
    }
  } catch (err) {
    console.error(`[SmartUpload] Failed to extract text from ${originalname}:`, err);
  }
  return null;
};

/**
 * Topic-Aware Multi-Segment Sampler
 * Bagi dokumen menjadi N segmen merata → ambil cuplikan dari setiap segmen.
 * AI mendapat gambaran SELURUH topik dari halaman 1 s/d terakhir, hemat token.
 */
const buildTopicAwareSample = (text, maxTotalChars = 3000, numSegments = 5) => {
  if (!text) return '';
  if (text.length <= maxTotalChars) return text;

  const charsPerSegment = Math.floor(maxTotalChars / numSegments);
  const segmentSize = Math.floor(text.length / numSegments);
  const parts = [];

  for (let i = 0; i < numSegments; i++) {
    const start = i * segmentSize;
    let chunk = text.substring(start, start + charsPerSegment * 2);
    const cutAt = chunk.lastIndexOf('\n', charsPerSegment);
    if (cutAt > charsPerSegment * 0.5) {
      chunk = chunk.substring(0, cutAt);
    } else {
      chunk = chunk.substring(0, charsPerSegment);
    }
    parts.push(`[Bagian ${i + 1}/${numSegments}]\n${chunk.trim()}`);
  }

  return parts.join('\n\n--- ✂ ---\n\n');
};

const smartShortenForSummary = buildTopicAwareSample;

export const smartUploadService = {
  /**
   * Tahap 1: Pre-flight Analysis.
   * Menerima files dari multer (memoryStorage / buffer), 
   * ekstrak teks/gambar, panggil AI untuk grouping & titling.
   */
  analyzeFiles: async (tenantId, packageId, files) => {
    const numericPackageId = Number.isFinite(Number(packageId)) ? Number(packageId) : null;
    const existingContexts = numericPackageId
      ? await prisma.packageMediaContext.findMany({
          where: { tenant_id: tenantId, travel_package_id: numericPackageId },
          select: { id: true, context_label: true, ai_summary: true }
        })
      : [];

    const fileDetails = [];
    let imagesForVision = [];

    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      let fileType = 'other';
      if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) fileType = 'image';
      else if (ext === '.pdf') fileType = 'pdf';
      else if (ext === '.docx') fileType = 'docx';
      else if (ext === '.xlsx' || ext === '.xls') fileType = 'excel';
      
      let extractedText = null;
      if (['pdf', 'docx', 'excel'].includes(fileType)) {
        extractedText = await extractTextFromBuffer(file.buffer, file.originalname);
      }

      // Upload to Cloudinary
      const cloudResult = await uploadFromBuffer(file.buffer, {
        tenantId,
        folder: 'package-media',
        resourceType: fileType === 'image' ? 'image' : 'raw',
      });

      const tempId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      fileDetails.push({
        tempId,
        originalName: file.originalname,
        fileType,
        extractedText,
        cloudinaryUrl: cloudResult.url,
      });

      if (fileType === 'image') {
        const mime = file.mimetype?.startsWith('image/')
          ? file.mimetype
          : `image/${ext === '.jpg' ? 'jpeg' : ext.substring(1)}`;
        const base64 = file.buffer.toString('base64');
        imagesForVision.push({ mimeType: mime, base64 });
      }
    }

    let promptText = `Saya baru saja mengunggah ${files.length} file baru. Tugasmu adalah mengelompokkannya (grouping) dan memberikan judul.\n\n`;
    
    if (existingContexts.length > 0) {
      promptText += `[KONTEKS YANG SUDAH ADA (BISA DIGABUNGKAN JIKA COCOK)]\n`;
      existingContexts.forEach(c => {
        promptText += `- ID: ${c.id} | Judul: ${c.context_label} | Summary: ${c.ai_summary}\n`;
      });
      promptText += `\n`;
    }

    promptText += `[FILE YANG BARU DIUNGGAH]\n`;
    fileDetails.forEach(f => {
      if (f.fileType === 'image') {
        promptText += `- File ID: ${f.tempId} | Nama: ${f.originalName} | Tipe: GAMBAR (Analisis pakai vision capability-mu).\n`;
      } else if (f.extractedText) {
        promptText += `- File ID: ${f.tempId} | Nama: ${f.originalName} | Tipe: DOKUMEN.\nCuplikan Isi:\n"""\n${smartShortenForSummary(f.extractedText)}\n"""\n`;
      } else {
        promptText += `- File ID: ${f.tempId} | Nama: ${f.originalName} | Tipe: LAINNYA (Isi tidak dapat dibaca).\n`;
      }
    });

    const systemPrompt = `Kamu adalah Kurator Data AI yang cerdas. Tugasmu adalah menganalisis file-file yang baru diunggah dan mengelompokkannya secara logis.
    
ATURAN PENGELOMPOKAN:
1. Jika beberapa file membahas hal yang sama/saling melengkapi, kelompokkan menjadi satu "Konteks Baru" (berikan Judul Utama dan Summary Utama).
2. Jika ada file yang tidak relevan dengan yang lain, pisahkan menjadi "Konteks Baru" tersendiri (berikan Judul Utama baru).
3. Jika file baru tersebut SANGAT COCOK dengan "Konteks Yang Sudah Ada", sarankan untuk digabung ke sana (Existing Context).
4. UNTUK SETIAP FILE (apapun aksinya), kamu WAJIB membuatkan Subjudul (subTitle) dan Summary spesifik per-file (subSummary).

OUTPUT HARUS MURNI JSON (HANYA JSON, TANPA MARKDOWN \`\`\`json ... \`\`\`):
{
  "groups": [
    {
      "action": "create_new",
      "mainTitle": "Fasilitas & Akomodasi Hotel",
      "mainSummary": "Kumpulan informasi terkait fasilitas dan foto hotel yang disediakan.",
      "files": [
        { "tempId": "...", "subTitle": "Brosur Depan Hotel", "subSummary": "Foto bagian depan hotel dengan fasilitas kolam renang." },
        { "tempId": "...", "subTitle": "Daftar Menu", "subSummary": "Teks daftar menu sarapan." }
      ]
    },
    {
      "action": "move_to_existing",
      "existingContextId": 12,
      "reason": "File ini berisi Itinerary yang cocok dengan konteks ID 12 yang sudah ada.",
      "files": [
        { "tempId": "...", "subTitle": "Revisi Itinerary", "subSummary": "Dokumen perubahan jadwal hari ke-3." }
      ]
    }
  ]
}
Pastikan "tempId" sama persis dengan yang ada di Prompt.`;

    try {
      const response = await executeFastJsonAI(tenantId, systemPrompt, promptText, imagesForVision);
      return { proposal: response, internalFiles: fileDetails };
    } catch (err) {
      console.error('[SmartUpload] Failed to analyze files:', err);
      throw err;
    }
  },

  /**
   * Tahap 2: Final Commit.
   * Dipanggil setelah user menekan [Ya/Setuju] di frontend.
   */
  commitFiles: async (tenantId, packageId, proposal, internalFiles) => {
    const results = [];

    for (const group of proposal.groups) {
      let contextId = null;

      if (group.action === 'create_new') {
        const newCtx = await prisma.packageMediaContext.create({
          data: {
            tenant_id: tenantId,
            travel_package_id: packageId,
            context_label: group.mainTitle || 'Konteks Baru',
            ai_summary: group.mainSummary || 'Tidak ada summary.'
          }
        });
        contextId = newCtx.id;
      } else if (group.action === 'move_to_existing') {
        contextId = group.existingContextId;
      }

      if (!contextId) continue;

      for (const fileItem of group.files) {
        const fileDetail = internalFiles.find(f => f.tempId === fileItem.tempId);
        if (!fileDetail) continue;

        const newFile = await prisma.packageMediaFile.create({
          data: {
            tenant_id: tenantId,
            context_id: contextId,
            file_name: fileDetail.originalName,
            file_path: fileDetail.cloudinaryUrl,
            file_type: fileDetail.fileType,
            extracted_text: fileDetail.extractedText,
            ai_title: fileItem.subTitle,
            ai_description: fileItem.subSummary
          }
        });

        results.push(newFile);

        if (fileDetail.extractedText && fileDetail.extractedText.trim().length > 50) {
          const textToEmbed = `[${fileItem.subTitle}]\nRingkasan: ${fileItem.subSummary}\n\nIsi: ${fileDetail.extractedText}`;
          embeddingService.chunkAndEmbed(tenantId, 'package_media', newFile.id, textToEmbed)
            .catch(e => console.error(`[SmartUpload] Embedding error for file ${newFile.id}:`, e.message));
        }
      }
    }

    return results;
  },

  /**
   * KB Media: Pre-flight Analysis
   */
  analyzeFilesForKb: async (tenantId, kbId, files) => {
    const existingContexts = await prisma.kbMediaContext.findMany({
      where: { tenant_id: tenantId, knowledge_base_id: kbId },
      select: { id: true, context_label: true, ai_summary: true }
    });

    const fileDetails = [];
    let imagesForVision = [];

    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      let fileType = 'other';
      if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) fileType = 'image';
      else if (ext === '.pdf') fileType = 'pdf';
      else if (ext === '.docx') fileType = 'docx';
      else if (ext === '.xlsx' || ext === '.xls') fileType = 'excel';
      
      let extractedText = null;
      if (['pdf', 'docx', 'excel'].includes(fileType)) {
        extractedText = await extractTextFromBuffer(file.buffer, file.originalname);
      }

      // Upload to Cloudinary
      const cloudResult = await uploadFromBuffer(file.buffer, {
        tenantId,
        folder: 'kb-media',
        resourceType: fileType === 'image' ? 'image' : 'raw',
      });

      const tempId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      fileDetails.push({
        tempId,
        originalName: file.originalname,
        fileType,
        extractedText,
        cloudinaryUrl: cloudResult.url,
      });

      if (fileType === 'image') {
        const mime = file.mimetype?.startsWith('image/')
          ? file.mimetype
          : `image/${ext === '.jpg' ? 'jpeg' : ext.substring(1)}`;
        const base64 = file.buffer.toString('base64');
        imagesForVision.push({ mimeType: mime, base64 });
      }
    }

    let promptText = `Saya baru saja mengunggah ${files.length} file baru. Tugasmu adalah mengelompokkannya (grouping) dan memberikan judul.\n\n`;
    
    if (existingContexts.length > 0) {
      promptText += `[KONTEKS YANG SUDAH ADA (BISA DIGABUNGKAN JIKA COCOK)]\n`;
      existingContexts.forEach(c => {
        promptText += `- ID: ${c.id} | Judul: ${c.context_label} | Summary: ${c.ai_summary}\n`;
      });
      promptText += `\n`;
    }

    promptText += `[FILE YANG BARU DIUNGGAH]\n`;
    fileDetails.forEach(f => {
      if (f.fileType === 'image') {
        promptText += `- File ID: ${f.tempId} | Nama: ${f.originalName} | Tipe: GAMBAR (Analisis pakai vision capability-mu).\n`;
      } else if (f.extractedText) {
        promptText += `- File ID: ${f.tempId} | Nama: ${f.originalName} | Tipe: DOKUMEN.\nCuplikan Isi:\n"""\n${smartShortenForSummary(f.extractedText)}\n"""\n`;
      } else {
        promptText += `- File ID: ${f.tempId} | Nama: ${f.originalName} | Tipe: LAINNYA (Isi tidak dapat dibaca).\n`;
      }
    });

    const systemPrompt = `Kamu adalah Kurator Data AI yang cerdas. Tugasmu adalah menganalisis file-file yang baru diunggah dan mengelompokkannya secara logis.
    
ATURAN PENGELOMPOKAN:
1. Jika beberapa file membahas hal yang sama/saling melengkapi, kelompokkan menjadi satu "Konteks Baru" (berikan Judul Utama dan Summary Utama).
2. Jika ada file yang tidak relevan dengan yang lain, pisahkan menjadi "Konteks Baru" tersendiri (berikan Judul Utama baru).
3. Jika file baru tersebut SANGAT COCOK dengan "Konteks Yang Sudah Ada", sarankan untuk digabung ke sana (Existing Context).
4. UNTUK SETIAP FILE (apapun aksinya), kamu WAJIB membuatkan Subjudul (subTitle) dan Summary spesifik per-file (subSummary).

OUTPUT HARUS MURNI JSON (HANYA JSON, TANPA MARKDOWN \`\`\`json ... \`\`\`):
{
  "groups": [
    {
      "action": "create_new",
      "mainTitle": "Fasilitas & Akomodasi",
      "mainSummary": "Kumpulan informasi terkait fasilitas dan foto yang disediakan.",
      "files": [
        { "tempId": "...", "subTitle": "Brosur", "subSummary": "Foto bagian depan bangunan." }
      ]
    },
    {
      "action": "move_to_existing",
      "existingContextId": 12,
      "reason": "File ini berisi SOP yang cocok dengan konteks ID 12 yang sudah ada.",
      "files": [
        { "tempId": "...", "subTitle": "Revisi SOP", "subSummary": "Dokumen perubahan SOP." }
      ]
    }
  ]
}
Pastikan "tempId" sama persis dengan yang ada di Prompt.`;

    try {
      const response = await executeFastJsonAI(tenantId, systemPrompt, promptText, imagesForVision);
      return { proposal: response, internalFiles: fileDetails };
    } catch (err) {
      console.error('[SmartUpload KB] Failed to analyze files:', err);
      throw err;
    }
  },

  /**
   * KB Media: Final Commit
   */
  commitFilesForKb: async (tenantId, kbId, proposal, internalFiles) => {
    const results = [];

    for (const group of proposal.groups) {
      let contextId = null;

      if (group.action === 'create_new') {
        const newCtx = await prisma.kbMediaContext.create({
          data: {
            tenant_id: tenantId,
            knowledge_base_id: kbId,
            context_label: group.mainTitle || 'Konteks Baru',
            ai_summary: group.mainSummary || 'Tidak ada summary.'
          }
        });
        contextId = newCtx.id;
      } else if (group.action === 'move_to_existing') {
        contextId = group.existingContextId;
      }

      if (!contextId) continue;

      for (const fileItem of group.files) {
        const fileDetail = internalFiles.find(f => f.tempId === fileItem.tempId);
        if (!fileDetail) continue;

        const newFile = await prisma.kbMediaFile.create({
          data: {
            tenant_id: tenantId,
            context_id: contextId,
            file_name: fileDetail.originalName,
            file_path: fileDetail.cloudinaryUrl,
            file_type: fileDetail.fileType,
            extracted_text: fileDetail.extractedText,
            ai_title: fileItem.subTitle,
            ai_description: fileItem.subSummary
          }
        });

        results.push(newFile);

        if (fileDetail.extractedText && fileDetail.extractedText.trim().length > 50) {
          const textToEmbed = `[${fileItem.subTitle}]\nRingkasan: ${fileItem.subSummary}\n\nIsi: ${fileDetail.extractedText}`;
          embeddingService.chunkAndEmbed(tenantId, 'kb_media', newFile.id, textToEmbed)
            .catch(e => console.error(`[SmartUpload KB] Embedding error for file ${newFile.id}:`, e.message));
        }
      }
    }

    return results;
  },

  /**
   * Regenerate AI title and summary for a group of files.
   * Called when user rearranges files between groups in the drag-and-drop UI.
   */
  regenerateGroupTitle: async (tenantId, fileItems, internalFiles, existingContextLabel = null) => {
    if (!fileItems || fileItems.length === 0) {
      return { mainTitle: 'Grup Kosong', mainSummary: '' };
    }

    let promptText = `Saya memiliki grup file berikut yang sudah disusun ulang oleh pengguna.\n`;
    promptText += `Buatkan JUDUL GRUP yang ringkas dan SUMMARY yang menjelaskan isi gabungan file-file ini.\n\n`;
    
    if (existingContextLabel) {
      promptText += `Judul grup sebelumnya: "${existingContextLabel}" (bisa dipertahankan jika masih sesuai).\n\n`;
    }

    promptText += `[FILE DALAM GRUP INI]\n`;
    for (const fileItem of fileItems) {
      const fileDetail = internalFiles.find(f => f.tempId === fileItem.tempId);
      if (!fileDetail) {
        promptText += `- File: ${fileItem.subTitle || fileItem.tempId} | Summary: ${fileItem.subSummary || '-'}\n`;
        continue;
      }
      
      if (fileDetail.extractedText) {
        promptText += `- File: ${fileDetail.originalName} | Tipe: DOKUMEN\n`;
        promptText += `  Cuplikan: "${smartShortenForSummary(fileDetail.extractedText, 800, 3)}"\n`;
      } else {
        promptText += `- File: ${fileDetail.originalName} | Tipe: ${fileDetail.fileType?.toUpperCase() || 'LAINNYA'}\n`;
        if (fileItem.subTitle) promptText += `  Judul File: ${fileItem.subTitle}\n`;
        if (fileItem.subSummary) promptText += `  Summary File: ${fileItem.subSummary}\n`;
      }
    }

    const systemPrompt = `Kamu adalah Kurator Data AI. Tugasmu adalah membuat JUDUL dan SUMMARY untuk sebuah grup file.
Berdasarkan file-file yang diberikan, buat:
- "mainTitle": Judul singkat (3-8 kata) yang menggambarkan isi keseluruhan grup.
- "mainSummary": Ringkasan (1-3 kalimat) tentang apa saja yang terkandung dalam grup ini.

Output HARUS murni JSON valid:
{ "mainTitle": "...", "mainSummary": "..." }
JANGAN menambahkan markdown atau formatting lainnya.`;

    try {
      const response = await executeFastJsonAI(tenantId, systemPrompt, promptText, []);
      return {
        mainTitle: response?.mainTitle || 'Grup File',
        mainSummary: response?.mainSummary || ''
      };
    } catch (err) {
      console.error('[SmartUpload] Failed to regenerate group title:', err);
      return { mainTitle: 'Grup File', mainSummary: '' };
    }
  }
};

