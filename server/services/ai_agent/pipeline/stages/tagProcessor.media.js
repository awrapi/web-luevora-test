/**
 * ================================================================
 * TAG PROCESSOR: Media Tags
 * ================================================================
 * Handles all media-related tags from AI response:
 *   [SEND_MEDIA_CTX:TYPE:ID]    — proactive media from package/KB context
 *   [SEND_MEDIA_DIRECT:url]     — direct KB file media
 *   [SEND_PKG_MEDIA:pkgId:fileId] — advanced package specific media
 *   [SEND_BROCHURE:packageName] — AI-requested brochure
 *
 * Extracted from stage7.postProcessor.js for maintainability.
 */

import prisma from '../../../../config/database.js';
import { checkMediaAllowed } from '../../../shared/mediaDedup.service.js';

/**
 * Process all media tags in the AI response.
 * Populates ctx.docMediaUrls and ctx.docMediaMeta.
 *
 * @param {string} finalReply - Current AI reply text
 * @param {Array} bubbles - Split bubble array
 * @param {Object} ctx - Pipeline context
 * @param {Function} stripTag - Helper to strip tags from reply + bubbles
 * @returns {{ finalReply: string, bubbles: string[] }} Updated reply and bubbles
 */
export const processMediaTags = async (finalReply, bubbles, ctx, stripTag) => {
  const { tenantId, mediaSendHistory, availableBrochures } = ctx;

  // ── [SEND_MEDIA_CTX:TYPE:ID] ────────────────────────────────
  const mediaTagRegex = /\[SEND_MEDIA_CTX:\s*(PACKAGE|KB)\s*:\s*(\d+)\s*\]/gi;
  const mediaCtxMatches = [...finalReply.matchAll(mediaTagRegex)];
  for (const foundMediaCtx of mediaCtxMatches) {
    const type  = foundMediaCtx[1].toUpperCase();
    const ctxId = parseInt(foundMediaCtx[2]);
    try {
      let files = [], fileDesc = '';
      if (type === 'PACKAGE') {
        // Ambil SEMUA file dalam context ini (bukan hanya take:1)
        files = await prisma.packageMediaFile.findMany({ where: { context_id: ctxId } });
        if (files.length > 0) {
          const pkgCtx = await prisma.packageMediaContext.findUnique({ where: { id: ctxId }, include: { travel_package: true } });
          fileDesc = `Produk: ${pkgCtx?.travel_package?.package_name || ctxId}`;
        }
      } else if (type === 'KB') {
        // Ambil SEMUA file dalam context ini
        files = await prisma.kbMediaFile.findMany({ where: { context_id: ctxId }, include: { context: { include: { knowledge_base: true } } } });
        if (files.length > 0) {
          fileDesc = `Knowledge Base: ${files[0]?.context?.knowledge_base?.title || ctxId}`;
        }
      }
      // Kirim SEMUA file yang relevan dan lolos dedup — AI yang menentukan context mana yang dikirim
      for (const file of files) {
        const docMediaUrl = file.file_path.startsWith('http') ? file.file_path : `/uploads/${file.file_path.replace('uploads/', '')}`;
        const mediaKey = `ctx:${type.toLowerCase()}:${ctxId}:file:${file.id}`;
        const dedupCheck = checkMediaAllowed(mediaSendHistory, mediaKey, ctx.intent?.isMediaReRequest, file.updated_at);
        if (dedupCheck.allowed) {
          const originalFilename = file.file_name || null;
          console.log(`[Stage7:Media] Mengirim file: ${originalFilename || '(tanpa nama)'} | URL: ${docMediaUrl.substring(0, 60)}`);
          ctx.docMediaUrls.push(docMediaUrl);
          ctx.docMediaMeta.push({
            mediaKey,
            description: `Media brosur/dokumen untuk ${fileDesc}`,
            filename: originalFilename,
            fileUpdatedAt: file.updated_at,
            mediaUrl: docMediaUrl,
            mediaSummary: file.ai_summary || `Brosur / dokumen pendukung untuk ${fileDesc}`
          });
        } else {
          console.log(`[Stage7:Media] File ${file.file_name} sudah dikirim sebelumnya, skip (dedup).`);
        }
      }
    } catch (e) { console.error('[Stage7:Media] Proactive media error:', e); }
  }
  finalReply = finalReply.replace(mediaTagRegex, (match, p1, p2) => `\n[SISTEM: Lampiran dokumen/gambar terkait ID: ${p2} berhasil dikirim]`);
  bubbles = bubbles.map(b => b.replace(mediaTagRegex, (match, p1, p2) => `\n[SISTEM: Lampiran dokumen/gambar terkait ID: ${p2} berhasil dikirim]`));

  // ── [SEND_MEDIA_DIRECT:url] ─────────────────────────────────
  const directMediaTagRegex = /\[SEND_MEDIA_DIRECT:([^\]]+)\]/gi;
  for (const match of [...finalReply.matchAll(directMediaTagRegex)]) {
    const rawUrl   = match[1].trim();
    const mediaUrl = rawUrl.startsWith('http') ? rawUrl : `/uploads/${rawUrl.replace('uploads/', '')}`;
    const mediaKey = `direct:${rawUrl}`;
    const dedupCheck = checkMediaAllowed(mediaSendHistory, mediaKey, ctx.intent?.isMediaReRequest);
    if (dedupCheck.allowed) {
      // Cari file_name asli dari KB record berdasarkan media_path
      let originalFilename = null;
      try {
        const kbRecord = await prisma.knowledgeBase.findFirst({ where: { media_path: rawUrl } });
        if (kbRecord?.media_path) {
          // Ambil bagian nama file dari path (misal: uploads/dokumen-visa.pdf → dokumen-visa.pdf)
          originalFilename = rawUrl.split('/').pop() || null;
        }
      } catch (e) { /* ignore */ }

      ctx.docMediaUrls.push(mediaUrl);
      ctx.docMediaMeta.push({
        mediaKey,
        description: 'Lampiran file dari Knowledge Base',
        filename: originalFilename,    // ← nama asli dari path upload
        fileUpdatedAt: null,
        mediaUrl,
        mediaSummary: 'File lampiran dari topik Knowledge Base.'
      });
    }
  }
  stripTag(directMediaTagRegex);

  // ── [SEND_PKG_MEDIA:pkgId:fileId] ──────────────────────────
  const pkgMediaTagRegex = /\[SEND_PKG_MEDIA\s*:\s*(\d+)\s*:\s*(\d+)\s*\]/gi;
  for (const match of [...finalReply.matchAll(pkgMediaTagRegex)]) {
    const pkgId = parseInt(match[1]), mediaId = parseInt(match[2]);
    try {
      const mediaFile = await prisma.mainPackageMediaFile.findFirst({ where: { id: mediaId, tenant_id: tenantId, package_id: pkgId } });
      if (mediaFile) {
        const mediaUrl = mediaFile.file_path.startsWith('http') ? mediaFile.file_path : `/uploads/${mediaFile.file_path.replace('uploads/', '')}`;
        const mediaKey = `pkg:${pkgId}:file:${mediaFile.id}`;
        const dedupCheck = checkMediaAllowed(mediaSendHistory, mediaKey, ctx.intent?.isMediaReRequest, mediaFile.updated_at);
        if (dedupCheck.allowed) {
          ctx.docMediaUrls.push(mediaUrl);
          const pkg = await prisma.travelPackage.findUnique({ where: { id: pkgId } }).catch(() => null);
          ctx.docMediaMeta.push({
            mediaKey,
            description: `Media spesifik Paket: ${pkg?.package_name || pkgId}`,
            filename: mediaFile.file_name || null,  // ← nama asli file
            fileUpdatedAt: mediaFile.updated_at,
            mediaUrl,
            mediaSummary: mediaFile.ai_description || `Media spesifik produk/layanan`
          });
        }
      }
    } catch (e) { console.error('[Stage7:Media] Pkg media error:', e); }
  }
  finalReply = finalReply.replace(pkgMediaTagRegex, (_, p1) => `\n[SISTEM: Lampiran media paket ID ${p1} telah dikirim]`);
  bubbles = bubbles.map(b => b.replace(pkgMediaTagRegex, (_, p1) => `\n[SISTEM: Lampiran media paket ID ${p1} telah dikirim]`));

  // ── [SEND_BROCHURE:packageName] ─────────────────────────────
  const brochureTagRegex = /\[SEND_BROCHURE:\s*([^\]]+)\]/gi;
  for (const match of [...finalReply.matchAll(brochureTagRegex)]) {
    const packageName = match[1].trim();
    const brochureData = availableBrochures[packageName];
    if (brochureData) {
      const { mediaUrl, meta } = brochureData;
      const dedupCheck = checkMediaAllowed(mediaSendHistory, meta.mediaKey, ctx.intent?.isMediaReRequest, meta.fileUpdatedAt);
      if (dedupCheck.allowed) {
        ctx.docMediaUrls.push(mediaUrl);
        ctx.docMediaMeta.push(meta);
        console.log(`[Stage7:Media] SEND_BROCHURE: Queued brochure for "${packageName}" → ${mediaUrl}`);
      } else {
        console.log(`[Stage7:Media] SEND_BROCHURE: BLOCKED for "${packageName}": ${dedupCheck.reason}`);
      }
    } else {
      console.warn(`[Stage7:Media] SEND_BROCHURE: No brochure found for "${packageName}"`);
    }
  }
  stripTag(brochureTagRegex);

  return { finalReply, bubbles };
};
