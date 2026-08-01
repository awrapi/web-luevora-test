import multer from 'multer';
import path from 'path';
import { smartGroupingService } from '../../services/shared/smartGrouping.service.js';

// Multer setup
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.docx', '.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();
  allowed.includes(ext) ? cb(null, true) : cb(new Error('Tipe file tidak didukung'), false);
};

export const smartGroupingUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 },
});

export const smartGroupingController = {

  /**
   * POST /smart-grouping/:scope/:entityId/analyze
   * Multer processes files, uploads to Cloudinary, AI proposes grouping.
   */
  analyze: async (req, res) => {
    try {
      const { scope, entityId } = req.params;
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ status: false, message: 'Tidak ada file diunggah' });
      }
      const { proposal, internalFiles } = await smartGroupingService.analyze(
        req.tenant.id, scope, parseInt(entityId), req.files
      );
      return res.status(200).json({
        status: true,
        data: { proposal, internalFiles },
        message: 'Analisis AI selesai. Menunggu konfirmasi pengelompokan.',
      });
    } catch (err) {
      console.error('[SmartGrouping] analyze error:', err);
      return res.status(500).json({ status: false, message: `Gagal menganalisis file: ${err.message}` });
    }
  },

  /**
   * POST /smart-grouping/:scope/:entityId/commit
   * Saves the (possibly edited) proposal to the database.
   */
  commit: async (req, res) => {
    try {
      const { scope, entityId } = req.params;
      const { proposal, internalFiles } = req.body;
      if (!proposal || !internalFiles) {
        return res.status(400).json({ status: false, message: 'Data proposal tidak lengkap' });
      }
      const results = await smartGroupingService.commit(
        req.tenant.id, scope, parseInt(entityId), proposal, internalFiles
      );
      return res.status(200).json({
        status: true,
        data: results,
        message: 'File berhasil dikelompokkan dan disimpan.',
      });
    } catch (err) {
      console.error('[SmartGrouping] commit error:', err);
      return res.status(500).json({ status: false, message: `Gagal menyimpan: ${err.message}` });
    }
  },

  /**
   * POST /smart-grouping/regenerate-title
   * AI regenerates title+summary for a group after user rearranges files in modal.
   */
  regenerateTitle: async (req, res) => {
    try {
      const { files, internalFiles, existingContextLabel } = req.body;
      if (!files || !internalFiles) {
        return res.status(400).json({ status: false, message: 'Data file tidak lengkap' });
      }
      const result = await smartGroupingService.regenerateTitle(
        req.tenant.id, files, internalFiles, existingContextLabel || null
      );
      return res.status(200).json({ status: true, data: result });
    } catch (err) {
      console.error('[SmartGrouping] regenerateTitle error:', err);
      return res.status(500).json({ status: false, message: 'Gagal regenerate judul grup' });
    }
  },

  /**
   * POST /smart-grouping/:scope/:entityId/rearrange
   * Rearranges existing files between contexts (no new uploads needed).
   */
  rearrange: async (req, res) => {
    try {
      const { scope, entityId } = req.params;
      const { groups } = req.body;
      if (!groups || !Array.isArray(groups)) {
        return res.status(400).json({ status: false, message: 'Data groups tidak valid' });
      }
      const result = await smartGroupingService.rearrange(
        req.tenant.id, scope, parseInt(entityId), groups
      );
      return res.status(200).json({
        status: true,
        data: result,
        message: 'Pengelompokan berhasil disimpan.',
      });
    } catch (err) {
      console.error('[SmartGrouping] rearrange error:', err);
      return res.status(500).json({ status: false, message: `Gagal menyimpan: ${err.message}` });
    }
  },
};
