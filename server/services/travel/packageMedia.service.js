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
    console.error(`[PackageMedia] Failed to extract text from ${originalname}:`, err);
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

export const packageMediaService = {
  getContextsByPackage: async (tenantId, packageId) => {
    return await prisma.packageMediaContext.findMany({
      where: { tenant_id: tenantId, travel_package_id: packageId },
      include: { files: true },
      orderBy: { created_at: 'asc' }
    });
  },

  createContext: async (tenantId, packageId, label) => {
    return await prisma.packageMediaContext.create({
      data: {
        tenant_id: tenantId,
        travel_package_id: packageId,
        context_label: label
      }
    });
  },

  updateContextLabel: async (tenantId, contextId, label) => {
    return await prisma.packageMediaContext.update({
      where: { id: contextId, tenant_id: tenantId },
      data: { context_label: label }
    });
  },

  deleteContext: async (tenantId, contextId) => {
    // Delete files from Cloudinary
    const context = await prisma.packageMediaContext.findUnique({
      where: { id: contextId, tenant_id: tenantId },
      include: { files: true }
    });
    
    if (context) {
      for (const f of context.files) {
        const publicId = extractPublicId(f.file_path);
        if (publicId) await deleteByPublicId(publicId, 'auto');
      }
      
      await prisma.packageMediaContext.delete({
        where: { id: contextId }
      });
    }
    return { status: true };
  },

  deleteFile: async (tenantId, fileId) => {
    const file = await prisma.packageMediaFile.findUnique({
      where: { id: fileId, tenant_id: tenantId },
      include: { context: true }
    });
    
    if (file) {
      const publicId = extractPublicId(file.file_path);
      if (publicId) await deleteByPublicId(publicId, 'auto');
      
      await prisma.packageMediaFile.delete({
        where: { id: fileId }
      });
      
      // Always delete vector chunks for the deleted file
      await embeddingService.deleteChunks(tenantId, 'package_media', fileId).catch(e => console.error('[PackageMedia] Chunk delete error:', e.message));

      // Check if any files remain in this context
      const remainingFiles = await prisma.packageMediaFile.count({
        where: { context_id: file.context_id }
      });

      if (remainingFiles === 0) {
        // Delete the context itself if empty
        await prisma.packageMediaContext.delete({
          where: { id: file.context_id }
        });
      } else {
        // Only regenerate summary if there are still files
        await packageMediaService.regenerateContextSummary(tenantId, file.context_id);
      }
    }
    return { status: true };
  },

  uploadFilesToContext: async (tenantId, contextId, files) => {
    const context = await prisma.packageMediaContext.findUnique({
      where: { id: contextId, tenant_id: tenantId },
      include: { travel_package: true }
    });
    if (!context) throw new Error('Context not found');

    const addedFiles = [];
    
    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      let fileType = 'other';
      if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) fileType = 'image';
      else if (ext === '.pdf') fileType = 'pdf';
      else if (ext === '.docx') fileType = 'docx';
      else if (ext === '.xlsx' || ext === '.xls') fileType = 'excel';
      
      // Upload to Cloudinary
      const cloudResult = await uploadFromBuffer(file.buffer, {
        tenantId,
        folder: 'package-media',
        resourceType: fileType === 'image' ? 'image' : 'raw',
      });
      
      let extractedText = null;
      if (['pdf', 'docx', 'excel'].includes(fileType)) {
        extractedText = await extractTextFromBuffer(file.buffer, file.originalname);
      }

      const newFile = await prisma.packageMediaFile.create({
        data: {
          tenant_id: tenantId,
          context_id: contextId,
          file_name: file.originalname,
          file_path: cloudResult.url,
          file_type: fileType,
          extracted_text: extractedText
        }
      });
      addedFiles.push(newFile);
    }
    
    // Regenerate summary + chunk for vector embedding (parallel)
    const embeddingTasks = addedFiles
      .filter(f => f.extracted_text && f.extracted_text.trim().length > 50)
      .map(f => embeddingService.chunkAndEmbed(tenantId, 'package_media', f.id, f.extracted_text)
        .catch(e => console.error(`[PackageMedia] Embedding error for file ${f.id}:`, e.message)));

    await Promise.all([
      packageMediaService.regenerateContextSummary(tenantId, contextId),
      ...embeddingTasks
    ]);
    
    return addedFiles;
  },

  regenerateContextSummary: async (tenantId, contextId) => {
    const context = await prisma.packageMediaContext.findUnique({
      where: { id: contextId, tenant_id: tenantId },
      include: { 
        travel_package: true,
        files: true 
      }
    });

    if (!context || context.files.length === 0) {
      return await prisma.packageMediaContext.update({
        where: { id: contextId },
        data: { ai_summary: null }
      });
    }

    let promptText = `Anda harus merangkum secara singkat apa isi dari konteks file ini.\n\n`;
    promptText += `Nama Paket: ${context.travel_package.package_name}\n`;
    promptText += `Label Konteks dari Admin: ${context.context_label}\n\n`;
    let imagesForVision = [];
    if (context.files.length > 0) {
      promptText += `Daftar File:\n`;
      for (const f of context.files) {
        if (f.file_type === 'image') {
          promptText += `- File [${f.file_name}]: Adalah file GAMBAR. (Tolong analisis gambar ini untuk merangkum isinya).\n`;
          // Download from Cloudinary URL for vision analysis
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
              console.warn(`[PackageMedia] Failed to download image for vision: ${e.message}`);
            }
          }
        } else if (f.extracted_text && f.extracted_text.trim().length > 0) {
          promptText += `- File [${f.file_name}]: Adalah dokumen teks. Isi sebagian dokumen:\n"""\n${smartShortenForSummary(f.extracted_text)}\n"""\n`;
        } else {
          promptText += `- File [${f.file_name}]: Format tidak bisa dibaca teksnya.\n`;
        }
      }
    }

    const systemPrompt = `Kamu adalah asisten analisis CRM Travel.
Tugasmu adalah menganalisis lampiran konteks media yang diupload admin untuk sebuah paket wisata.
Baca 'Label Konteks', nama paket, dan analisis dokumen atau gambar yang dilampirkan.
Keluarkan format JSON dengan key 'summary'. Isi 'summary' dengan ringkasan padat (maksimal 3-4 kalimat) mengenai apa isi dari kumpulan file ini dan kapan file ini relevan untuk dikirim ke pelanggan.
Contoh: "Konteks ini berisi detail Itinerary Hari ke-2 dan gambar pemandangan pantai. Sangat relevan untuk dikirim ketika pelanggan bertanya tentang jadwal spesifik hari kedua."
Output HARUS murni JSON valid { "summary": "..." } tanpa markup tambahan.`;

    try {
      const response = await executeFastJsonAI(tenantId, systemPrompt, promptText, imagesForVision);
      const summary = response?.summary || 'Terdapat beberapa file dalam konteks ini.';
      
      await prisma.packageMediaContext.update({
        where: { id: contextId },
        data: { ai_summary: summary }
      });
      return summary;
    } catch (err) {
      console.error('[PackageMedia] Failed to regenerate summary:', err);
      return null;
    }
  }
};
