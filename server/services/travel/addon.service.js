import { PrismaClient } from '@prisma/client';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

import mammoth from 'mammoth';
import xlsx from 'xlsx';
import { executeFastJsonAI } from '../ai_agent/logic.service.js';
import { embeddingService } from '../deep_rag_engine/embedding.service.js';
import { advancedPackageUploadService } from './advancedPackageUpload.service.js';
import { uploadFromBuffer, deleteByPublicId, extractPublicId } from '../shared/cloudinary.service.js';

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
    console.error(`[AddonMedia] Failed to extract text from ${originalname}:`, err);
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

export const addonService = {
  getAddonsByPackage: async (tenantId, packageId) => {
    return await prisma.advancedPackageAddon.findMany({
      where: { tenant_id: tenantId, package_id: packageId },
      include: { files: true },
      orderBy: { sort_order: 'asc' }
    });
  },

  createAddon: async (tenantId, packageId, data) => {
    return await prisma.advancedPackageAddon.create({
      data: {
        tenant_id: tenantId,
        package_id: packageId,
        title: data.title,
        description: data.description || null,
        price: data.price ? parseFloat(data.price) : 0,
        is_free: data.is_free ? 1 : 0,
        context_description: data.context_description || null,
        sort_order: data.sort_order || 0
      }
    });
  },

  updateAddon: async (tenantId, addonId, data) => {
    // Regenerate summary if context_description changes
    const addon = await prisma.advancedPackageAddon.findUnique({
      where: { id: addonId, tenant_id: tenantId }
    });

    const updated = await prisma.advancedPackageAddon.update({
      where: { id: addonId, tenant_id: tenantId },
      data: {
        title: data.title !== undefined ? data.title : undefined,
        description: data.description !== undefined ? data.description : undefined,
        price: data.price !== undefined ? parseFloat(data.price) : undefined,
        is_free: data.is_free !== undefined ? (data.is_free ? 1 : 0) : undefined,
        context_description: data.context_description !== undefined ? data.context_description : undefined,
        sort_order: data.sort_order !== undefined ? data.sort_order : undefined,
      }
    });

    if (data.context_description !== undefined && addon && data.context_description !== addon.context_description) {
      await addonService.regenerateAddonSummary(tenantId, addonId);
    }

    return updated;
  },

  deleteAddon: async (tenantId, addonId) => {
    const addon = await prisma.advancedPackageAddon.findUnique({
      where: { id: addonId, tenant_id: tenantId },
      include: { files: true }
    });
    
    if (addon) {
      for (const f of addon.files) {
        const publicId = extractPublicId(f.file_path);
        if (publicId) await deleteByPublicId(publicId, 'auto');
      }
      
      await prisma.advancedPackageAddon.delete({
        where: { id: addonId }
      });
    }
    return { status: true };
  },

  deleteFile: async (tenantId, fileId) => {
    const file = await prisma.addonMediaFile.findUnique({
      where: { id: fileId, tenant_id: tenantId }
    });
    
    if (file) {
      const publicId = extractPublicId(file.file_path);
      if (publicId) await deleteByPublicId(publicId, 'auto');
      
      await prisma.addonMediaFile.delete({
        where: { id: fileId }
      });
      
      // Cleanup: delete vector chunks
      await embeddingService.deleteChunks(tenantId, 'addon', fileId).catch(e => console.error('[Addon] Chunk delete error:', e.message));

      if (file.context_id) {
        const remainingFiles = await prisma.addonMediaFile.count({
          where: { context_id: file.context_id }
        });
        if (remainingFiles === 0) {
          await prisma.addonMediaContext.delete({
            where: { id: file.context_id }
          });
        }
      }
    }
    return { status: true };
  },

  uploadFilesToAddon: async (tenantId, addonId, files, aiMetadataStr) => {
    const addon = await prisma.advancedPackageAddon.findUnique({
      where: { id: addonId, tenant_id: tenantId }
    });
    if (!addon) throw new Error('Addon not found');

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
        folder: 'addon-media',
        resourceType: fileType === 'image' ? 'image' : 'raw',
      });

      let base64 = null;
      let mime = null;
      if (fileType === 'image') {
        mime = `image/${ext === '.jpg' ? 'jpeg' : ext.substring(1)}`;
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
         contextLabel: addon.title || 'Media Pendukung',
         aiSummary: '',
         files: filesData.map(f => ({ tempId: f.tempId, originalName: f.originalName, subTitle: f.originalName, subSummary: '' }))
       }];
    }

    const addedFiles = [];
    const embeddingTasks = [];

    for (const ctx of frontendAiMetadata.contexts) {
       if (!ctx.files || ctx.files.length === 0) continue;

       const mediaContext = await prisma.addonMediaContext.create({
         data: {
           tenant_id: tenantId,
           addon_id: addonId,
           context_label: ctx.contextLabel || 'Media Pendukung',
           ai_summary: ctx.aiSummary || null,
         }
       });

       for (const fMeta of ctx.files) {
          const fData = filesData.find(f => f.tempId === fMeta.tempId || f.originalName === fMeta.originalName);
          if (!fData) continue;

          const newFile = await prisma.addonMediaFile.create({
            data: {
              tenant_id: tenantId,
              context_id: mediaContext.id,
              file_name: fData.originalName,
              file_path: fData.cloudinaryUrl,
              file_type: fData.fileType,
              extracted_text: fData.extractedText,
              ai_title: fMeta.subTitle || fData.originalName
            }
          });
          addedFiles.push({ ...newFile, ai_description: fMeta.subSummary || '' });

          if (newFile.extracted_text && newFile.extracted_text.trim().length > 50) {
            const textToEmbed = `[${newFile.ai_title}]\nRingkasan: ${fMeta.subSummary || ''}\n\nIsi: ${newFile.extracted_text}`;
            embeddingTasks.push(
              embeddingService.chunkAndEmbed(tenantId, 'addon', newFile.id, textToEmbed)
                .catch(e => console.error(`[Addon] Embedding error for file ${newFile.id}:`, e.message))
            );
          }
       }
    }

    await Promise.all(embeddingTasks);
    return addedFiles;
  },


};
