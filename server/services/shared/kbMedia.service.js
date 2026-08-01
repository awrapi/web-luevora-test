import { PrismaClient } from '@prisma/client';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

import mammoth from 'mammoth';
import xlsx from 'xlsx';
import { executeFastJsonAI } from '../ai_agent/logic.service.js';
import { embeddingService } from '../deep_rag_engine/embedding.service.js';
import { uploadFromBuffer, deleteByPublicId, extractPublicId, isCloudinaryUrl } from './cloudinary.service.js';

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
    console.error(`[KbMedia] Failed to extract text from ${originalname}:`, err);
  }
  return null;
};

/**
 * Topic-Aware Multi-Segment Sampler
 * 
 * Alih-alih ambil awal+akhir saja, kita bagi dokumen menjadi N segmen merata
 * lalu ambil cuplikan dari SETIAP segmen. Hasilnya: AI mendapat gambaran
 * SELURUH topik dari halaman 1 sampai halaman terakhir, hemat token.
 * 
 * Contoh: PDF 60.000 chars, 5 segmen → ambil ~600 char per segmen = 3000 total
 */
const buildTopicAwareSample = (text, maxTotalChars = 3000, numSegments = 5) => {
  if (!text) return '';
  if (text.length <= maxTotalChars) return text;

  const charsPerSegment = Math.floor(maxTotalChars / numSegments);
  const segmentSize = Math.floor(text.length / numSegments);
  const parts = [];

  for (let i = 0; i < numSegments; i++) {
    const start = i * segmentSize;
    let chunk = text.substring(start, start + charsPerSegment * 2); // ambil lebih, lalu trim ke batas paragraf

    // Potong di akhir kalimat/baris agar tidak terpotong di tengah
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

// Backwards-compat alias (masih dipakai di beberapa tempat untuk prompt grouping)
const smartShortenForSummary = buildTopicAwareSample;

export const kbMediaService = {
  getContextsByKb: async (tenantId, kbId) => {
    return await prisma.kbMediaContext.findMany({
      where: { tenant_id: tenantId, knowledge_base_id: kbId },
      include: { files: true },
      orderBy: { created_at: 'asc' }
    });
  },

  createContext: async (tenantId, kbId, label) => {
    return await prisma.kbMediaContext.create({
      data: {
        tenant_id: tenantId,
        knowledge_base_id: kbId,
        context_label: label
      }
    });
  },

  updateContextLabel: async (tenantId, contextId, label) => {
    return await prisma.kbMediaContext.update({
      where: { id: contextId, tenant_id: tenantId },
      data: { context_label: label }
    });
  },

  deleteContext: async (tenantId, contextId) => {
    const context = await prisma.kbMediaContext.findUnique({
      where: { id: contextId, tenant_id: tenantId },
      include: { files: true }
    });
    
    if (context) {
      for (const f of context.files) {
        const publicId = extractPublicId(f.file_path);
        if (publicId) await deleteByPublicId(publicId, 'auto');
      }
      
      await prisma.kbMediaContext.delete({
        where: { id: contextId }
      });
    }
    return { status: true };
  },

  deleteFile: async (tenantId, fileId) => {
    const file = await prisma.kbMediaFile.findUnique({
      where: { id: fileId, tenant_id: tenantId },
      include: { context: true }
    });
    
    if (file) {
      const publicId = extractPublicId(file.file_path);
      if (publicId) await deleteByPublicId(publicId, 'auto');
      
      await prisma.kbMediaFile.delete({
        where: { id: fileId }
      });
      
      // Always delete vector chunks for the deleted file
      await embeddingService.deleteChunks(tenantId, 'kb_media', fileId).catch(e => console.error('[KbMedia] Chunk delete error:', e.message));

      // Check if any files remain in this context
      const remainingFiles = await prisma.kbMediaFile.count({
        where: { context_id: file.context_id }
      });

      if (remainingFiles === 0) {
        // Delete the context itself if empty
        await prisma.kbMediaContext.delete({
          where: { id: file.context_id }
        });
      } else {
        // Only regenerate summary if there are still files
        await kbMediaService.regenerateContextSummary(tenantId, file.context_id);
      }
    }
    return { status: true };
  },

  uploadFilesToContext: async (tenantId, contextId, files) => {
    const context = await prisma.kbMediaContext.findUnique({
      where: { id: contextId, tenant_id: tenantId },
      include: { knowledge_base: true }
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
        folder: 'kb-media',
        resourceType: fileType === 'image' ? 'image' : 'raw',
      });

      let fileUrl = cloudResult.url;
      
      let extractedText = null;
      if (['pdf', 'docx', 'excel'].includes(fileType)) {
        extractedText = await extractTextFromBuffer(file.buffer, file.originalname);
      }

      const newFile = await prisma.kbMediaFile.create({
        data: {
          tenant_id: tenantId,
          context_id: contextId,
          file_name: file.originalname,
          file_path: fileUrl,
          file_type: fileType,
          extracted_text: extractedText
        }
      });
      addedFiles.push(newFile);
    }
    
    // Summary + vector embedding (parallel)
    const embeddingTasks = addedFiles
      .filter(f => f.extracted_text && f.extracted_text.trim().length > 50)
      .map(f => embeddingService.chunkAndEmbed(tenantId, 'kb_media', f.id, f.extracted_text)
        .catch(e => console.error(`[KbMedia] Embedding error for file ${f.id}:`, e.message)));

    await Promise.all([
      kbMediaService.regenerateContextSummary(tenantId, contextId),
      ...embeddingTasks
    ]);
    
    return addedFiles;
  },

  regenerateContextSummary: async (tenantId, contextId) => {
    const context = await prisma.kbMediaContext.findUnique({
      where: { id: contextId, tenant_id: tenantId },
      include: { 
        knowledge_base: true,
        files: true 
      }
    });

    if (!context || context.files.length === 0) {
      return await prisma.kbMediaContext.update({
        where: { id: contextId },
        data: { ai_summary: null }
      });
    }

    let promptText = `Anda harus merangkum secara singkat apa isi dari konteks file ini.\n\n`;
    promptText += `Nama Knowledge Base: ${context.knowledge_base.title}\n`;
    promptText += `Label Konteks dari Admin: ${context.context_label}\n\n`;
    promptText += `Daftar File:\n`;
    let imagesForVision = [];

    for (const f of context.files) {
      if (f.file_type === 'image') {
        promptText += `- File [${f.file_name}]: Adalah file GAMBAR. (Tolong analisis gambar ini).\n`;
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
            console.warn(`[KbMedia] Failed to fetch image for vision: ${e.message}`);
          }
        }
      } else if (f.extracted_text) {
        promptText += `- File [${f.file_name}]: Adalah dokumen teks. Isi sebagian dokumen:\n"""\n${smartShortenForSummary(f.extracted_text)}\n"""\n`;
      } else {
        promptText += `- File [${f.file_name}]: Format tidak bisa dibaca teksnya.\n`;
      }
    }

    const systemPrompt = `Kamu adalah asisten analisis CRM.
Tugasmu adalah menganalisis lampiran konteks media yang diupload admin untuk referensi basis pengetahuan perusahaan.
Baca 'Label Konteks dari Admin' dan sebagian isi teks dokumen (jika ada).
Keluarkan format JSON dengan key 'summary'. Isi 'summary' dengan ringkasan padat (maksimal 3-4 kalimat) mengenai apa isi dari kumpulan file ini dan kapan file ini relevan untuk dikirim ke pelanggan.
Contoh: "Konteks ini berisi detail SOP Garansi dan dokumen panduan klaim. Sangat relevan untuk dikirim ketika pelanggan bertanya tentang syarat mengklaim garansi."
Output HARUS murni JSON valid { "summary": "..." } tanpa markup tambahan.`;

    try {
      const response = await executeFastJsonAI(tenantId, systemPrompt, promptText, imagesForVision);
      const summary = response?.summary || 'Terdapat beberapa file dalam konteks ini.';
      
      await prisma.kbMediaContext.update({
        where: { id: contextId },
        data: { ai_summary: summary }
      });
      return summary;
    } catch (err) {
      console.error('[KbMedia] Failed to regenerate summary:', err);
      return null;
    }
  }
};
