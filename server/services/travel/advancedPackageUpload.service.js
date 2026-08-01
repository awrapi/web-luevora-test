import { PrismaClient } from '@prisma/client';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

import mammoth from 'mammoth';
import xlsx from 'xlsx';
import { executeFastJsonAI } from '../ai_agent/logic.service.js';
import { embeddingService } from '../deep_rag_engine/embedding.service.js';
import { uploadFromBuffer, deleteByPublicId, extractPublicId, isCloudinaryUrl } from '../shared/cloudinary.service.js';

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
    console.error(`[AdvPkgMedia] Failed to extract text from ${originalname}:`, err);
  }
  return null;
};

// Helper to smart shorten text for summarization
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

const normalizeAiFilesResult = (aiResults) => {
  if (Array.isArray(aiResults)) return aiResults;
  if (Array.isArray(aiResults?.files)) return aiResults.files;
  return [];
};

export const advancedPackageUploadService = {
  // =========================================================================
  // HELPER: EXTRACT AI METADATA FOR FILES (BACKGROUND)
  // =========================================================================
  extractAiTitlesForFiles: async (tenantId, parentTitle, filesData, existingContextTitle = '') => {
    if (!filesData || filesData.length === 0) return { contextTitle: '', contextSummary: '', isRelevantToExisting: true, files: [] };
    
    let imagesForVision = [];
    let promptText = `Saya baru saja mengunggah ${filesData.length} file baru untuk paket/sub-paket/addon bernama "${parentTitle}".\n`;
    promptText += `Tugasmu adalah MENGELOMPOKKAN file-file ini ke dalam satu atau beberapa konteks berdasarkan kesamaan topiknya, lalu memberikan judul konteks (contextLabel), ringkasan konteks (aiSummary), serta judul (subTitle) dan ringkasan spesifik (subSummary) untuk MASING-MASING file dalam grup tersebut.\n\n`;
    
    promptText += `[DAFTAR FILE]\n`;
    filesData.forEach(f => {
      if (f.fileType === 'image') {
        promptText += `- File ID: ${f.tempId} | Nama: ${f.originalName} | Tipe: GAMBAR (Analisis pakai vision capability-mu).\n`;
        if (f.base64 && f.mime) {
          imagesForVision.push({ mimeType: f.mime, base64: f.base64 });
        }
      } else if (f.extractedText) {
        promptText += `- File ID: ${f.tempId} | Nama: ${f.originalName} | Tipe: DOKUMEN.\nCuplikan Isi:\n"""\n${smartShortenForSummary(f.extractedText)}\n"""\n`;
      } else {
        promptText += `- File ID: ${f.tempId} | Nama: ${f.originalName} | Tipe: LAINNYA (Isi tidak dapat dibaca).\n`;
      }
    });

    const systemPrompt = `Kamu adalah Kurator Data AI yang cerdas. Tugasmu adalah menganalisis kumpulan file yang baru diunggah untuk sebuah paket wisata.
    
ATURAN:
1. Kelompokkan file-file yang memiliki konteks atau topik yang sama ke dalam satu grup (Context). Jika ada file yang berbeda topik secara drastis, buatkan grup (Context) yang terpisah.
2. Untuk setiap grup, buat "contextLabel" (judul singkat grup) dan "aiSummary" (rangkuman isi grup maksimal 3-4 kalimat).
3. UNTUK SETIAP FILE dalam grup, kamu WAJIB membuatkan Subjudul (subTitle) dan Summary spesifik per-file (subSummary).

OUTPUT HARUS MURNI JSON (HANYA OBJECT JSON, TANPA MARKDOWN \`\`\`json ... \`\`\`):
{
  "contexts": [
    {
      "contextLabel": "Brosur dan Dokumen Pendukung",
      "aiSummary": "Kumpulan file ini berisi brosur promosi dan detail rute perjalanan.",
      "files": [
        { "tempId": "...", "subTitle": "Brosur Depan", "subSummary": "Foto bangunan depan." },
        { "tempId": "...", "subTitle": "Itinerary lengkap", "subSummary": "Detail jadwal perjalanan." }
      ]
    },
    {
      "contextLabel": "Kebijakan Akomodasi",
      "aiSummary": "File-file terkait aturan dan kebijakan menginap di hotel.",
      "files": [
        { "tempId": "...", "subTitle": "SOP Hotel", "subSummary": "Aturan dasar hotel." }
      ]
    }
  ]
}
Pastikan "tempId" sama persis dengan yang ada di Prompt.`;

    try {
      const response = await executeFastJsonAI(tenantId, systemPrompt, promptText, imagesForVision);
      return response && Array.isArray(response.contexts) ? response.contexts : [{ contextLabel: parentTitle || 'Media Pendukung', aiSummary: '', files: [] }];
    } catch (err) {
      console.error('[AdvPkgUpload] Failed to extract AI titles:', err);
      return [];
    }
  },

  previewFilesMetadata: async (tenantId, parentTitle, files, existingContextTitle = '') => {
    try {
      const filesData = [];
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
        
        let base64 = null;
        let mime = null;
        if (fileType === 'image') {
          mime = file.mimetype?.startsWith('image/')
            ? file.mimetype
            : `image/${ext === '.jpg' ? 'jpeg' : ext.substring(1)}`;
          base64 = file.buffer.toString('base64');
        }

        const tempId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        filesData.push({
          tempId,
          originalName: file.originalname,
          fileType,
          extractedText,
          base64,
          mime
        });
      }

      const aiContexts = await advancedPackageUploadService.extractAiTitlesForFiles(tenantId, parentTitle, filesData, existingContextTitle);
      
      const mappedContexts = aiContexts.map(ctx => {
        const filesArray = Array.isArray(ctx.files) ? ctx.files : [];
        const resultsByOriginalName = filesArray.map(res => {
          const fileRef = filesData.find(f => f.tempId === res.tempId);
          if (!fileRef) return null;
          return {
            originalName: fileRef.originalName,
            tempId: fileRef.tempId,
            subTitle: res.subTitle || fileRef.originalName,
            subSummary: res.subSummary || ctx.aiSummary || ''
          };
        }).filter(Boolean);
        
        return {
          contextLabel: ctx.contextLabel || parentTitle,
          aiSummary: ctx.aiSummary || '',
          files: resultsByOriginalName
        };
      });

      return {
        contexts: mappedContexts
      };
    } catch (err) {
      console.error('[AdvPkgUpload] Failed previewFilesMetadata:', err);
      return { contexts: [] };
    }
  },

  // =========================================================================
  // PREVIEW CONTEXT (LIVE AI SUMMARY)
  // =========================================================================
  previewContextSummary: async (tenantId, label, parentTitle, files) => {
    try {
      let promptText = `Anda harus merangkum isi dari dokumen/konteks ini.\n\n`;
      promptText += `Nama Paket/Sub-Paket/Addon: ${parentTitle || '-'}\n`;
      promptText += `Judul Konteks: ${label || '-'}\n\n`;
      
      let imagesForVision = [];
      
      if (files && files.length > 0) {
        promptText += `Daftar File:\n`;
        for (const file of files) {
          const ext = path.extname(file.originalname).toLowerCase();
          let fileType = 'other';
          if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) fileType = 'image';
          else if (ext === '.pdf') fileType = 'pdf';
          else if (ext === '.docx') fileType = 'docx';
          else if (ext === '.xlsx' || ext === '.xls') fileType = 'excel';
          
          if (fileType === 'image') {
            promptText += `- File [${file.originalname}]: Adalah file GAMBAR. (Tolong analisis gambar ini untuk merangkum isinya).\n`;
            const base64 = file.buffer.toString('base64');
            const mime = ext === '.jpg' ? 'jpeg' : ext.substring(1);
            imagesForVision.push({ mimeType: `image/${mime}`, base64 });
          } else if (['pdf', 'docx', 'excel'].includes(fileType)) {
            const extractedText = await extractTextFromBuffer(file.buffer, file.originalname);
            if (extractedText && extractedText.trim().length > 0) {
              promptText += `- File [${file.originalname}]: Adalah dokumen teks. Isi sebagian dokumen:\n"""\n${smartShortenForSummary(extractedText)}\n"""\n`;
            } else {
              promptText += `- File [${file.originalname}]: Format dokumen tidak bisa dibaca teksnya (mungkin berupa scan gambar atau kosong).\n`;
            }
          } else {
            promptText += `- File [${file.originalname}]: Format dokumen tidak bisa dibaca teksnya.\n`;
          }
        }
      }

      const systemPrompt = `Kamu adalah asisten analisis CRM Travel.
Tugasmu adalah menganalisis lampiran konteks media yang diupload admin untuk sebuah paket wisata.
Baca 'Judul Konteks', deskripsi, dan analisis isi dokumen atau gambar yang dilampirkan.
Keluarkan format JSON dengan key 'summary'. Isi 'summary' dengan ringkasan padat (maksimal 3-4 kalimat) mengenai apa isi dari kumpulan file ini dan kapan file ini relevan untuk dikirim ke pelanggan.
Contoh: "Konteks ini berisi detail Itinerary Hari ke-2 dan gambar pemandangan pantai. Sangat relevan untuk dikirim ketika pelanggan bertanya tentang jadwal spesifik hari kedua."
Output HARUS murni JSON valid { "summary": "..." } tanpa markup tambahan.`;

      const response = await executeFastJsonAI(tenantId, systemPrompt, promptText, imagesForVision);
      const summary = response?.summary || 'Berisi detail utama terkait konteks ini.';
      
      return summary;
    } catch (err) {
      console.error('[AdvPkgMedia] Failed to preview context summary:', err);
      return null;
    }
  },

  // =========================================================================
  // MAIN PACKAGE FILES
  // =========================================================================
  getMainPackageFiles: async (tenantId, packageId) => {
    return await prisma.mainPackageMediaFile.findMany({
      where: { tenant_id: tenantId, package_id: packageId }
    });
  },

  deleteMainPackageFile: async (tenantId, fileId) => {
    const file = await prisma.mainPackageMediaFile.findUnique({
      where: { id: fileId, tenant_id: tenantId }
    });
    if (file) {
      const publicId = extractPublicId(file.file_path);
      if (publicId) await deleteByPublicId(publicId, 'auto');
      await prisma.mainPackageMediaFile.delete({ where: { id: fileId } });
      await embeddingService.deleteChunks(tenantId, 'main_package', fileId).catch(e => console.error('[AdvPkg] Chunk delete error:', e.message));


    }
    return { status: true };
  },

  uploadFilesToMainPackage: async (tenantId, packageId, files, aiMetadataStr) => {
    const pkg = await prisma.advancedTravelPackage.findUnique({
      where: { id: packageId, tenant_id: tenantId }
    });
    if (!pkg) throw new Error('Package not found');

    let frontendAiMetadata = { contexts: [] };
    if (aiMetadataStr) {
      try { frontendAiMetadata = JSON.parse(aiMetadataStr); } catch (e) {}
    }

    // Process files: extract text, base64, upload to Cloudinary
    const filesData = [];
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

      let base64 = null;
      let mime = null;
      if (fileType === 'image') {
        mime = file.mimetype?.startsWith('image/')
          ? file.mimetype
          : `image/${ext === '.jpg' ? 'jpeg' : ext.substring(1)}`;
        base64 = file.buffer.toString('base64');
      }

      const tempId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      filesData.push({
        tempId,
        originalName: file.originalname,
        fileType,
        extractedText,
        base64,
        mime,
        cloudinaryUrl: cloudResult.url,
      });
    }

    if (!frontendAiMetadata.contexts || frontendAiMetadata.contexts.length === 0) {
       frontendAiMetadata.contexts = [{
         contextLabel: pkg.title || 'Media Pendukung',
         aiSummary: '',
         files: filesData.map(f => ({ tempId: f.tempId, originalName: f.originalName, subTitle: f.originalName, subSummary: '' }))
       }];
    }

    const addedFiles = [];
    const embeddingTasks = [];

    for (const ctx of frontendAiMetadata.contexts) {
       if (!ctx.files || ctx.files.length === 0) continue;

       for (const fMeta of ctx.files) {
          const fData = filesData.find(f => f.tempId === fMeta.tempId || f.originalName === fMeta.originalName);
          if (!fData) continue;

          const newFile = await prisma.mainPackageMediaFile.create({
            data: {
              tenant_id: tenantId,
              package_id: packageId,
              file_name: fData.originalName,
              file_path: fData.cloudinaryUrl,
              file_type: fData.fileType,
              extracted_text: fData.extractedText,
              ai_title: fMeta.subTitle || fData.originalName
            }
          });
          addedFiles.push({ ...newFile, ai_description: fMeta.subSummary || '' });

          if (newFile.extracted_text && newFile.extracted_text.trim().length > 50) {
            const textToEmbed = `[${newFile.ai_title}]\nKonteks: ${ctx.contextLabel || 'Media'}\nRingkasan Konteks: ${ctx.aiSummary || ''}\nRingkasan Spesifik: ${fMeta.subSummary || ''}\n\nIsi: ${newFile.extracted_text}`;
            embeddingTasks.push(
              embeddingService.chunkAndEmbed(tenantId, 'main_package', newFile.id, textToEmbed)
                .catch(e => console.error(`[AdvPkg] Embedding error for main file ${newFile.id}:`, e.message))
            );
          }
       }
    }

    await Promise.all(embeddingTasks);
    return addedFiles;
  },

  regenerateMainPackageSummary: async (tenantId, packageId) => {
    const pkg = await prisma.advancedTravelPackage.findUnique({
      where: { id: packageId, tenant_id: tenantId },
      include: { media_files: true }
    });
    if (!pkg) return null;

    if (pkg.media_files.length === 0 && !pkg.context_description) {
      return await prisma.advancedTravelPackage.update({
        where: { id: packageId },
        data: { ai_summary: null }
      });
    }

    let promptText = `Anda harus merangkum isi konteks utama paket wisata ini.\n\n`;
    promptText += `Nama Paket: ${pkg.title}\n`;
    promptText += `Deskripsi Paket: ${pkg.description || '-'}\n`;
    promptText += `Deskripsi Konteks (Manual dari Admin): ${pkg.context_description || '-'}\n\n`;
    
    let imagesForVision = [];
    if (pkg.media_files.length > 0) {
      promptText += `Daftar File Paket Utama:\n`;
      for (const f of pkg.media_files) {
        if (f.file_type === 'image') {
          promptText += `- File [${f.file_name}]: Adalah file GAMBAR. (Tolong analisis gambar ini untuk merangkum isinya).\n`;
          if (isCloudinaryUrl(f.file_path)) {
            try {
              const imgResp = await fetch(f.file_path);
              if (imgResp.ok) {
                const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
                const ext = path.extname(f.file_name).toLowerCase();
                const mime = ext === '.jpg' ? 'jpeg' : ext.substring(1);
                imagesForVision.push({ mimeType: `image/${mime}`, base64: imgBuffer.toString('base64') });
              }
            } catch (e) {
              console.warn(`[AdvPkg] Failed to fetch image for vision: ${e.message}`);
            }
          }
        } else if (f.extracted_text && f.extracted_text.trim().length > 0) {
          promptText += `- File [${f.file_name}]: Adalah dokumen teks. Isi sebagian dokumen:\n"""\n${smartShortenForSummary(f.extracted_text)}\n"""\n`;
        } else {
          promptText += `- File [${f.file_name}]: Format dokumen tidak bisa dibaca teksnya (mungkin berupa scan gambar atau kosong).\n`;
        }
      }
    }

    const systemPrompt = `Kamu adalah asisten analisis CRM Travel.
Tugasmu adalah menganalisis lampiran konteks media yang diupload admin untuk sebuah paket wisata.
Baca 'Deskripsi Konteks', deskripsi paket, dan analisis dokumen atau gambar yang dilampirkan.
Keluarkan format JSON dengan key 'summary'. Isi 'summary' dengan ringkasan padat (maksimal 3-4 kalimat) mengenai apa isi dari kumpulan file ini dan kapan file ini relevan untuk dikirim ke pelanggan.
Contoh: "Konteks ini berisi detail Itinerary Hari ke-2 dan gambar pemandangan pantai. Sangat relevan untuk dikirim ketika pelanggan bertanya tentang jadwal spesifik hari kedua."
Output HARUS murni JSON valid { "summary": "..." } tanpa markup tambahan.`;

    try {
      const response = await executeFastJsonAI(tenantId, systemPrompt, promptText, imagesForVision);
      const summary = response?.summary || 'Berisi detail utama terkait paket.';
      await prisma.advancedTravelPackage.update({ where: { id: packageId }, data: { ai_summary: summary } });
      return summary;
    } catch (err) {
      console.error('[AdvPkgMedia] Failed to regenerate main package summary:', err);
      return null;
    }
  },

  // =========================================================================
  // SUB-ITEM FILES
  // =========================================================================
  getSubItemFiles: async (tenantId, subItemId) => {
    return await prisma.subItemMediaFile.findMany({
      where: { tenant_id: tenantId, sub_item_id: subItemId }
    });
  },

  deleteSubItemFile: async (tenantId, fileId) => {
    const file = await prisma.subItemMediaFile.findUnique({
      where: { id: fileId, tenant_id: tenantId }
    });
    if (file) {
      const publicId = extractPublicId(file.file_path);
      if (publicId) await deleteByPublicId(publicId, 'auto');
      await prisma.subItemMediaFile.delete({ where: { id: fileId } });
      await embeddingService.deleteChunks(tenantId, 'sub_item', fileId).catch(e => console.error('[AdvPkg] Chunk delete error:', e.message));


    }
    return { status: true };
  },

  uploadFilesToSubItem: async (tenantId, subItemId, files, aiMetadataStr) => {
    const sub = await prisma.advancedPackageSubItem.findUnique({
      where: { id: subItemId, tenant_id: tenantId }
    });
    if (!sub) throw new Error('Sub-package not found');

    let frontendAiMetadata = { contexts: [] };
    if (aiMetadataStr) {
      try { frontendAiMetadata = JSON.parse(aiMetadataStr); } catch (e) {}
    }

    const filesData = [];
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

      let base64 = null;
      let mime = null;
      if (fileType === 'image') {
        mime = file.mimetype?.startsWith('image/')
          ? file.mimetype
          : `image/${ext === '.jpg' ? 'jpeg' : ext.substring(1)}`;
        base64 = file.buffer.toString('base64');
      }

      const tempId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      filesData.push({
        tempId,
        originalName: file.originalname,
        fileType,
        extractedText,
        base64,
        mime,
        cloudinaryUrl: cloudResult.url,
      });
    }

    if (!frontendAiMetadata.contexts || frontendAiMetadata.contexts.length === 0) {
       frontendAiMetadata.contexts = [{
         contextLabel: sub.title || 'Media Pendukung',
         aiSummary: '',
         files: filesData.map(f => ({ tempId: f.tempId, originalName: f.originalName, subTitle: f.originalName, subSummary: '' }))
       }];
    }

    const addedFiles = [];
    const embeddingTasks = [];

    for (const ctx of frontendAiMetadata.contexts) {
       if (!ctx.files || ctx.files.length === 0) continue;

       for (const fMeta of ctx.files) {
          const fData = filesData.find(f => f.tempId === fMeta.tempId || f.originalName === fMeta.originalName);
          if (!fData) continue;

          const newFile = await prisma.subItemMediaFile.create({
            data: {
              tenant_id: tenantId,
              sub_item_id: subItemId,
              file_name: fData.originalName,
              file_path: fData.cloudinaryUrl,
              file_type: fData.fileType,
              extracted_text: fData.extractedText,
              ai_title: fMeta.subTitle || fData.originalName
            }
          });
          addedFiles.push({ ...newFile, ai_description: fMeta.subSummary || '' });

          if (newFile.extracted_text && newFile.extracted_text.trim().length > 50) {
            const textToEmbed = `[${newFile.ai_title}]\nKonteks: ${ctx.contextLabel || 'Media'}\nRingkasan Konteks: ${ctx.aiSummary || ''}\nRingkasan Spesifik: ${fMeta.subSummary || ''}\n\nIsi: ${newFile.extracted_text}`;
            embeddingTasks.push(
              embeddingService.chunkAndEmbed(tenantId, 'sub_item', newFile.id, textToEmbed)
                .catch(e => console.error(`[AdvPkg] Embedding error for sub file ${newFile.id}:`, e.message))
            );
          }
       }
    }

    await Promise.all(embeddingTasks);
    return addedFiles;
  },

  // =========================================================================
  // MAIN PACKAGE FILES — get list
  // =========================================================================
  getMainPackageFiles: async (tenantId, packageId) => {
    return await prisma.mainPackageMediaFile.findMany({
      where: { tenant_id: tenantId, package_id: packageId },
      orderBy: { created_at: 'asc' },
    });
  },

  // =========================================================================
  // ADDON FILES — get, delete
  // =========================================================================
  getAddonFiles: async (tenantId, addonId) => {
    return await prisma.addonMediaFile.findMany({
      where: { tenant_id: tenantId, addon_id: addonId },
      orderBy: { created_at: 'asc' },
    });
  },

  deleteAddonFile: async (tenantId, fileId) => {
    const file = await prisma.addonMediaFile.findUnique({
      where: { id: fileId, tenant_id: tenantId },
    });
    if (file) {
      const { extractPublicId, deleteByPublicId } = await import('../shared/cloudinary.service.js');
      const publicId = extractPublicId(file.file_path);
      if (publicId) await deleteByPublicId(publicId, 'auto');
      await prisma.addonMediaFile.delete({ where: { id: fileId } });
      await embeddingService.deleteChunks(tenantId, 'addon', fileId).catch(e =>
        console.error('[AdvPkg] Addon chunk delete error:', e.message)
      );
    }
    return { status: true };
  },

};

