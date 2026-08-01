/**
 * SmartGrouping Central Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Service terpusat untuk smart upload (analyze → GroupingModal → commit)
 * yang mendukung semua scope:
 *   'package'   → basic travel package  (PackageMediaContext / PackageMediaFile)
 *   'adv-main'  → advanced pkg main     (MainPackageMediaFile) [flat, no context]
 *   'adv-sub'   → advanced sub-item     (SubItemMediaFile)     [flat, no context]
 *   'adv-addon' → addon                 (AddonMediaFile)       [flat, no context]
 *   'kb'        → knowledge base        (KbMediaContext / KbMediaFile)
 *
 * Untuk scope adv-* yang tidak memiliki "context" tabel tersendiri, sistem
 * menggunakan grouping virtual: setiap grup dari proposal di-commit sebagai
 * kumpulan file biasa — judul & summary grup disimpan ke ai_title dan
 * ai_description kolektif.
 */

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

// ─── Text extraction helper ───────────────────────────────────────────────────
const extractTextFromBuffer = async (buffer, originalname) => {
  try {
    const ext = path.extname(originalname).toLowerCase();
    if (ext === '.pdf') {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      return result.text;
    } else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      let fullText = '';
      workbook.SheetNames.forEach(sn => {
        fullText += xlsx.utils.sheet_to_csv(workbook.Sheets[sn]) + '\n\n';
      });
      return fullText;
    }
  } catch (err) {
    console.error(`[SmartGrouping] Text extract error (${originalname}):`, err.message);
  }
  return null;
};

// ─── Topic-aware sampler (reduces tokens while covering entire doc) ───────────
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
    chunk = cutAt > charsPerSegment * 0.5 ? chunk.substring(0, cutAt) : chunk.substring(0, charsPerSegment);
    parts.push(`[Bagian ${i + 1}/${numSegments}]\n${chunk.trim()}`);
  }
  return parts.join('\n\n--- ✂ ---\n\n');
};

// ─── Scope config ─────────────────────────────────────────────────────────────
// Describes how each scope maps to Prisma models and embedding types.
const SCOPE_CONFIG = {
  'package': {
    hasContext: true,
    contextModel: 'packageMediaContext',
    fileModel: 'packageMediaFile',
    contextForeignKey: 'travel_package_id',
    embeddingType: 'package_media',
    cloudinaryFolder: 'package-media',
    getExistingContexts: async (tenantId, entityId) =>
      prisma.packageMediaContext.findMany({
        where: { tenant_id: tenantId, travel_package_id: entityId },
        select: { id: true, context_label: true, ai_summary: true },
      }),
    createContext: async (tenantId, entityId, label, summary) =>
      prisma.packageMediaContext.create({
        data: { tenant_id: tenantId, travel_package_id: entityId, context_label: label, ai_summary: summary },
      }),
    createFile: async (tenantId, contextId, fileData, fileItem) =>
      prisma.packageMediaFile.create({
        data: {
          tenant_id: tenantId,
          context_id: contextId,
          file_name: fileData.originalName,
          file_path: fileData.cloudinaryUrl,
          file_type: fileData.fileType,
          extracted_text: fileData.extractedText,
          ai_title: fileItem.subTitle,
          ai_description: fileItem.subSummary,
        },
      }),
  },
  'kb': {
    hasContext: true,
    contextModel: 'kbMediaContext',
    fileModel: 'kbMediaFile',
    contextForeignKey: 'knowledge_base_id',
    embeddingType: 'kb_media',
    cloudinaryFolder: 'kb-media',
    getExistingContexts: async (tenantId, entityId) =>
      prisma.kbMediaContext.findMany({
        where: { tenant_id: tenantId, knowledge_base_id: entityId },
        select: { id: true, context_label: true, ai_summary: true },
      }),
    createContext: async (tenantId, entityId, label, summary) =>
      prisma.kbMediaContext.create({
        data: { tenant_id: tenantId, knowledge_base_id: entityId, context_label: label, ai_summary: summary },
      }),
    createFile: async (tenantId, contextId, fileData, fileItem) =>
      prisma.kbMediaFile.create({
        data: {
          tenant_id: tenantId,
          context_id: contextId,
          file_name: fileData.originalName,
          file_path: fileData.cloudinaryUrl,
          file_type: fileData.fileType,
          extracted_text: fileData.extractedText,
          ai_title: fileItem.subTitle,
          ai_description: fileItem.subSummary,
        },
      }),
  },
  'adv-main': {
    hasContext: false, // flat files, group label stored in ai_title prefix
    embeddingType: 'advanced_main',
    cloudinaryFolder: 'package-media',
    createFile: async (tenantId, entityId, fileData, fileItem, groupLabel) =>
      prisma.mainPackageMediaFile.create({
        data: {
          tenant_id: tenantId,
          package_id: entityId,
          file_name: fileData.originalName,
          file_path: fileData.cloudinaryUrl,
          file_type: fileData.fileType,
          extracted_text: fileData.extractedText,
          ai_title: fileItem.subTitle,
          ai_description: fileItem.subSummary,
          context_label: groupLabel || null,
        },
      }),
  },
  'adv-sub': {
    hasContext: false,
    embeddingType: 'sub_item',
    cloudinaryFolder: 'package-media',
    createFile: async (tenantId, entityId, fileData, fileItem, groupLabel) =>
      prisma.subItemMediaFile.create({
        data: {
          tenant_id: tenantId,
          sub_item_id: entityId,
          file_name: fileData.originalName,
          file_path: fileData.cloudinaryUrl,
          file_type: fileData.fileType,
          extracted_text: fileData.extractedText,
          ai_title: fileItem.subTitle,
          ai_description: fileItem.subSummary,
          context_label: groupLabel || null,
        },
      }),
  },

  'adv-addon': {
    hasContext: false,
    embeddingType: 'addon',
    cloudinaryFolder: 'package-media',
    createFile: async (tenantId, entityId, fileData, fileItem, groupLabel) =>
      prisma.addonMediaFile.create({
        data: {
          tenant_id: tenantId,
          addon_id: entityId,
          file_name: fileData.originalName,
          file_path: fileData.cloudinaryUrl,
          file_type: fileData.fileType,
          extracted_text: fileData.extractedText,
          ai_title: fileItem.subTitle,
          context_label: groupLabel || null,
        },
      }),
  },
};

// ─── Main service ─────────────────────────────────────────────────────────────
export const smartGroupingService = {

  /**
   * Phase 1: Upload files to Cloudinary, extract text, call AI for grouping proposal.
   * Returns { proposal, internalFiles } — no DB writes yet.
   */
  analyze: async (tenantId, scope, entityId, files) => {
    const config = SCOPE_CONFIG[scope];
    if (!config) throw new Error(`Unknown scope: ${scope}`);

    // Fetch existing contexts (only for context-based scopes)
    const existingContexts = config.hasContext && config.getExistingContexts
      ? await config.getExistingContexts(tenantId, entityId)
      : [];

    const fileDetails = [];
    const imagesForVision = [];

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

      const cloudResult = await uploadFromBuffer(file.buffer, {
        tenantId,
        folder: config.cloudinaryFolder || 'package-media',
        resourceType: fileType === 'image' ? 'image' : 'raw',
      });

      const tempId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      fileDetails.push({ tempId, originalName: file.originalname, fileType, extractedText, cloudinaryUrl: cloudResult.url });

      if (fileType === 'image') {
        const mime = file.mimetype?.startsWith('image/')
          ? file.mimetype
          : `image/${ext === '.jpg' ? 'jpeg' : ext.substring(1)}`;
        imagesForVision.push({ mimeType: mime, base64: file.buffer.toString('base64') });
      }
    }

    // Build AI prompt
    let promptText = `Saya baru saja mengunggah ${files.length} file baru. Tugasmu adalah mengelompokkannya (grouping) dan memberikan judul.\n\n`;

    if (existingContexts.length > 0) {
      promptText += `[KONTEKS YANG SUDAH ADA (BISA DIGABUNGKAN JIKA COCOK)]\n`;
      existingContexts.forEach(c => {
        promptText += `- ID: ${c.id} | Judul: ${c.context_label} | Summary: ${c.ai_summary}\n`;
      });
      promptText += '\n';
    }

    promptText += `[FILE YANG BARU DIUNGGAH]\n`;
    fileDetails.forEach(f => {
      if (f.fileType === 'image') {
        promptText += `- File ID: ${f.tempId} | Nama: ${f.originalName} | Tipe: GAMBAR (Analisis pakai vision capability-mu).\n`;
      } else if (f.extractedText) {
        promptText += `- File ID: ${f.tempId} | Nama: ${f.originalName} | Tipe: DOKUMEN.\nCuplikan Isi:\n"""\n${buildTopicAwareSample(f.extractedText)}\n"""\n`;
      } else {
        promptText += `- File ID: ${f.tempId} | Nama: ${f.originalName} | Tipe: LAINNYA (Isi tidak dapat dibaca).\n`;
      }
    });

    const systemPrompt = `Kamu adalah Kurator Data AI yang cerdas. Tugasmu adalah menganalisis file-file yang baru diunggah dan mengelompokkannya secara logis.
    
ATURAN PENGELOMPOKAN:
1. Jika beberapa file membahas hal yang sama/saling melengkapi, kelompokkan menjadi satu "Konteks Baru" (berikan Judul Utama dan Summary Utama).
2. Jika ada file yang tidak relevan dengan yang lain, pisahkan menjadi "Konteks Baru" tersendiri.
3. Jika file baru SANGAT COCOK dengan "Konteks Yang Sudah Ada", sarankan untuk digabung ke sana (Existing Context).
4. UNTUK SETIAP FILE (apapun aksinya), kamu WAJIB membuatkan Subjudul (subTitle) dan Summary spesifik per-file (subSummary).

OUTPUT HARUS MURNI JSON (HANYA JSON, TANPA MARKDOWN \`\`\`json ... \`\`\`):
{
  "groups": [
    {
      "action": "create_new",
      "mainTitle": "Fasilitas & Akomodasi Hotel",
      "mainSummary": "Kumpulan informasi terkait fasilitas dan foto hotel.",
      "files": [
        { "tempId": "...", "subTitle": "Brosur Depan Hotel", "subSummary": "Foto bagian depan hotel dengan fasilitas kolam renang." }
      ]
    },
    {
      "action": "move_to_existing",
      "existingContextId": 12,
      "reason": "File ini berisi Itinerary yang cocok dengan konteks ID 12.",
      "files": [
        { "tempId": "...", "subTitle": "Revisi Itinerary", "subSummary": "Dokumen perubahan jadwal hari ke-3." }
      ]
    }
  ]
}
Pastikan "tempId" sama persis dengan yang ada di Prompt.`;

    const response = await executeFastJsonAI(tenantId, systemPrompt, promptText, imagesForVision);
    return { proposal: response, internalFiles: fileDetails };
  },

  /**
   * Phase 2: Commit the (possibly user-edited) proposal to DB.
   */
  commit: async (tenantId, scope, entityId, proposal, internalFiles) => {
    const config = SCOPE_CONFIG[scope];
    if (!config) throw new Error(`Unknown scope: ${scope}`);

    const results = [];

    for (const group of proposal.groups) {
      let contextId = null;

      // Only context-based scopes have a context table
      if (config.hasContext) {
        if (group.action === 'create_new') {
          const newCtx = await config.createContext(
            tenantId, entityId,
            group.mainTitle || 'Konteks Baru',
            group.mainSummary || ''
          );
          contextId = newCtx.id;
        } else if (group.action === 'move_to_existing') {
          contextId = group.existingContextId;
        }
        if (!contextId) continue;
      }

      for (const fileItem of group.files) {
        const fileDetail = internalFiles.find(f => f.tempId === fileItem.tempId);
        if (!fileDetail) continue;

        let newFile;
        if (config.hasContext) {
          newFile = await config.createFile(tenantId, contextId, fileDetail, fileItem);
        } else {
          // Flat scope: pass group label as context_label
          newFile = await config.createFile(tenantId, entityId, fileDetail, fileItem, group.mainTitle || '');
        }
        results.push(newFile);

        // Trigger embedding asynchronously
        if (fileDetail.extractedText && fileDetail.extractedText.trim().length > 50) {
          const textToEmbed = `[${fileItem.subTitle}]\nRingkasan: ${fileItem.subSummary}\n\nIsi: ${fileDetail.extractedText}`;
          embeddingService.chunkAndEmbed(tenantId, config.embeddingType, newFile.id, textToEmbed)
            .catch(e => console.error(`[SmartGrouping] Embedding error (${scope}/${newFile.id}):`, e.message));
        }
      }
    }

    return results;
  },

  /**
   * Regenerate AI title + summary for a group after user rearranges files in modal.
   */
  regenerateTitle: async (tenantId, fileItems, internalFiles, existingContextLabel = null) => {
    if (!fileItems || fileItems.length === 0) return { mainTitle: 'Grup Kosong', mainSummary: '' };

    let promptText = `Saya memiliki grup file berikut yang sudah disusun ulang oleh pengguna.\n`;
    promptText += `Buatkan JUDUL GRUP yang ringkas dan SUMMARY yang menjelaskan isi gabungan file-file ini.\n\n`;
    if (existingContextLabel) promptText += `Judul grup sebelumnya: "${existingContextLabel}" (bisa dipertahankan jika masih sesuai).\n\n`;

    promptText += `[FILE DALAM GRUP INI]\n`;
    for (const fileItem of fileItems) {
      const fileDetail = internalFiles.find(f => f.tempId === fileItem.tempId);
      if (!fileDetail) {
        promptText += `- File: ${fileItem.subTitle || fileItem.tempId} | Summary: ${fileItem.subSummary || '-'}\n`;
        continue;
      }
      if (fileDetail.extractedText) {
        promptText += `- File: ${fileDetail.originalName} | Tipe: DOKUMEN\n`;
        promptText += `  Cuplikan: "${buildTopicAwareSample(fileDetail.extractedText, 800, 3)}"\n`;
      } else {
        promptText += `- File: ${fileDetail.originalName} | Tipe: ${(fileDetail.fileType || 'lainnya').toUpperCase()}\n`;
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
        mainSummary: response?.mainSummary || '',
      };
    } catch (err) {
      console.error('[SmartGrouping] Regenerate title error:', err.message);
      return { mainTitle: 'Grup File', mainSummary: '' };
    }
  },

  /**
   * Rearrange existing files between contexts (no new uploads).
   * Called from the "Manage Grouping" modal on existing media.
   * Supports context-based scopes: 'package' | 'kb'
   *
   * @param {number} tenantId
   * @param {string} scope
   * @param {number} entityId
   * @param {Array} groups - Final grouping state from modal
   */
  rearrange: async (tenantId, scope, entityId, groups) => {
    const config = SCOPE_CONFIG[scope];
    if (!config || !config.hasContext) throw new Error(`Scope "${scope}" does not support context rearrangement`);

    const fileModel = config.fileModel;
    const contextModel = config.contextModel;

    for (const group of groups) {
      let targetContextId = null;

      if (group.action === 'create_new') {
        // Create a brand-new context
        const newCtx = await config.createContext(
          tenantId, entityId,
          group.mainTitle || 'Konteks Baru',
          group.mainSummary || ''
        );
        targetContextId = newCtx.id;
        console.log(`[SmartGrouping Rearrange] Created new context "${group.mainTitle}" (id=${targetContextId})`);
      } else {
        targetContextId = group.existingContextId;
        // Optionally update the context label/summary if admin renamed it
        if (group.mainTitle && group.existingContextId) {
          await prisma[contextModel].update({
            where: { id: group.existingContextId },
            data: {
              context_label: group.mainTitle,
              ...(group.mainSummary ? { ai_summary: group.mainSummary } : {}),
            },
          }).catch(() => {});
        }
      }

      if (!targetContextId) continue;

      // Move existing files whose context changed
      const existingFiles = (group.files || []).filter(f => f.kind === 'existing');
      for (const ef of existingFiles) {
        if (!ef.existingFileId) continue;
        if (ef.existingContextId !== targetContextId) {
          await prisma[fileModel].update({
            where: { id: ef.existingFileId },
            data: { context_id: targetContextId },
          }).catch(e => console.error(`[SmartGrouping Rearrange] Move file ${ef.existingFileId} error:`, e.message));
          console.log(`[SmartGrouping Rearrange] Moved file ${ef.existingFileId} → context ${targetContextId}`);
        }
      }
    }

    return { success: true };
  },
};
