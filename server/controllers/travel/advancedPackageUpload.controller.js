import multer from 'multer';
import path from 'path';
import { advancedPackageUploadService } from '../../services/travel/advancedPackageUpload.service.js';
import { smartUploadService } from '../../services/travel/smartUpload.service.js';

// Multer config — memoryStorage (buffer → Cloudinary)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.docx', '.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Tipe file tidak didukung. Gunakan Gambar, PDF, DOCX, atau Excel.'), false);
  }
};

export const packageMediaUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

export const advancedPackageUploadController = {
  // PREVIEW CONTEXT (LIVE AI SUMMARY) — kept for backward compat
  previewContext: async (req, res) => {
    try {
      const { context_description, parent_title } = req.body;
      const summary = await advancedPackageUploadService.previewContextSummary(req.tenant.id, context_description, parent_title, req.files);
      if (!summary) return res.status(500).json({ status: false, message: 'Gagal membuat preview AI' });
      return res.status(200).json({ status: true, data: { summary }, message: 'Preview AI berhasil dibuat' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal memproses preview context' });
    }
  },

  // PREVIEW FILES — kept for backward compat
  previewFiles: async (req, res) => {
    try {
      const { parent_title, existing_context_title } = req.body;
      if (!req.files || req.files.length === 0) return res.status(400).json({ status: false, message: 'Tidak ada file untuk dianalisis' });
      const aiResults = await advancedPackageUploadService.previewFilesMetadata(req.tenant.id, parent_title || 'File Dukungan', req.files, existing_context_title);
      return res.status(200).json({ status: true, data: aiResults, message: 'Analisis AI berhasil' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal memproses analisis AI' });
    }
  },

  // ── SMART UPLOAD: MAIN PACKAGE ──────────────────────────────────────────────

  smartAnalyzeMain: async (req, res) => {
    try {
      const { packageId } = req.params;
      if (!req.files || req.files.length === 0) return res.status(400).json({ status: false, message: 'Tidak ada file diunggah' });
      const { proposal, internalFiles } = await advancedPackageUploadService.smartAnalyzeMain(req.tenant.id, parseInt(packageId), req.files);
      return res.status(200).json({ status: true, data: { proposal, internalFiles }, message: 'Analisis AI selesai.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal menganalisis file paket utama' });
    }
  },

  smartCommitMain: async (req, res) => {
    try {
      const { packageId } = req.params;
      const { proposal, internalFiles } = req.body;
      if (!proposal || !internalFiles) return res.status(400).json({ status: false, message: 'Data proposal tidak lengkap' });
      const results = await advancedPackageUploadService.smartCommitMain(req.tenant.id, parseInt(packageId), proposal, internalFiles);
      return res.status(200).json({ status: true, data: results, message: 'File berhasil disimpan.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal menyimpan file paket utama' });
    }
  },

  // ── SMART UPLOAD: SUB-ITEM ──────────────────────────────────────────────────

  smartAnalyzeSubItem: async (req, res) => {
    try {
      const { subItemId } = req.params;
      if (!req.files || req.files.length === 0) return res.status(400).json({ status: false, message: 'Tidak ada file diunggah' });
      const { proposal, internalFiles } = await advancedPackageUploadService.smartAnalyzeSubItem(req.tenant.id, parseInt(subItemId), req.files);
      return res.status(200).json({ status: true, data: { proposal, internalFiles }, message: 'Analisis AI selesai.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal menganalisis file sub-paket' });
    }
  },

  smartCommitSubItem: async (req, res) => {
    try {
      const { subItemId } = req.params;
      const { proposal, internalFiles } = req.body;
      if (!proposal || !internalFiles) return res.status(400).json({ status: false, message: 'Data proposal tidak lengkap' });
      const results = await advancedPackageUploadService.smartCommitSubItem(req.tenant.id, parseInt(subItemId), proposal, internalFiles);
      return res.status(200).json({ status: true, data: results, message: 'File sub-paket berhasil disimpan.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal menyimpan file sub-paket' });
    }
  },

  // ── SMART UPLOAD: ADDON ─────────────────────────────────────────────────────

  smartAnalyzeAddon: async (req, res) => {
    try {
      const { addonId } = req.params;
      if (!req.files || req.files.length === 0) return res.status(400).json({ status: false, message: 'Tidak ada file diunggah' });
      const { proposal, internalFiles } = await advancedPackageUploadService.smartAnalyzeAddon(req.tenant.id, parseInt(addonId), req.files);
      return res.status(200).json({ status: true, data: { proposal, internalFiles }, message: 'Analisis AI selesai.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal menganalisis file addon' });
    }
  },

  smartCommitAddon: async (req, res) => {
    try {
      const { addonId } = req.params;
      const { proposal, internalFiles } = req.body;
      if (!proposal || !internalFiles) return res.status(400).json({ status: false, message: 'Data proposal tidak lengkap' });
      const results = await advancedPackageUploadService.smartCommitAddon(req.tenant.id, parseInt(addonId), proposal, internalFiles);
      return res.status(200).json({ status: true, data: results, message: 'File addon berhasil disimpan.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal menyimpan file addon' });
    }
  },

  // ── SMART REGENERATE TITLE ──────────────────────────────────────────────────

  smartRegenerateTitle: async (req, res) => {
    try {
      const { files, internalFiles, existingContextLabel } = req.body;
      if (!files || !internalFiles) return res.status(400).json({ status: false, message: 'Data file tidak lengkap' });
      const result = await smartUploadService.regenerateGroupTitle(req.tenant.id, files, internalFiles, existingContextLabel || null);
      return res.status(200).json({ status: true, data: result });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal regenerate judul grup' });
    }
  },

  // ── ORIGINAL ENDPOINTS (BACKWARD COMPAT) ────────────────────────────────────

  uploadFilesToMainPackage: async (req, res) => {
    try {
      const { packageId } = req.params;
      const { ai_metadata } = req.body;
      if (!req.files || req.files.length === 0) return res.status(400).json({ status: false, message: 'Tidak ada file diunggah' });
      const files = await advancedPackageUploadService.uploadFilesToMainPackage(req.tenant.id, parseInt(packageId), req.files, ai_metadata);
      return res.status(200).json({ status: true, data: files, message: 'File utama berhasil diunggah' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal unggah file paket utama' });
    }
  },

  deleteMainPackageFile: async (req, res) => {
    try {
      const { fileId } = req.params;
      await advancedPackageUploadService.deleteMainPackageFile(req.tenant.id, parseInt(fileId));
      return res.status(200).json({ status: true, message: 'File dihapus' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal menghapus file' });
    }
  },

  uploadFilesToSubItem: async (req, res) => {
    try {
      const { subItemId } = req.params;
      const { ai_metadata } = req.body;
      if (!req.files || req.files.length === 0) return res.status(400).json({ status: false, message: 'Tidak ada file diunggah' });
      const files = await advancedPackageUploadService.uploadFilesToSubItem(req.tenant.id, parseInt(subItemId), req.files, ai_metadata);
      return res.status(200).json({ status: true, data: files, message: 'File sub-paket berhasil diunggah' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal unggah file sub-paket' });
    }
  },

  deleteSubItemFile: async (req, res) => {
    try {
      const { fileId } = req.params;
      await advancedPackageUploadService.deleteSubItemFile(req.tenant.id, parseInt(fileId));
      return res.status(200).json({ status: true, message: 'File dihapus' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal menghapus file sub-paket' });
    }
  },

  getAddonFiles: async (req, res) => {
    try {
      const { addonId } = req.params;
      const files = await advancedPackageUploadService.getAddonFiles(req.tenant.id, parseInt(addonId));
      return res.status(200).json({ status: true, data: files });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal mengambil file addon' });
    }
  },

  deleteAddonFile: async (req, res) => {
    try {
      const { fileId } = req.params;
      await advancedPackageUploadService.deleteAddonFile(req.tenant.id, parseInt(fileId));
      return res.status(200).json({ status: true, message: 'File addon dihapus' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal menghapus file addon' });
    }
  },
};
