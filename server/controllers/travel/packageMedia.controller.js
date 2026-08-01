import multer from 'multer';
import path from 'path';
import { packageMediaService } from '../../services/travel/packageMedia.service.js';
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

export const mediaUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

export const packageMediaController = {
  getContexts: async (req, res) => {
    try {
      const { packageId } = req.params;
      const contexts = await packageMediaService.getContextsByPackage(req.tenant.id, parseInt(packageId));
      return res.status(200).json({ status: true, data: contexts });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal memuat konteks media' });
    }
  },

  createContext: async (req, res) => {
    try {
      const { packageId } = req.params;
      const { context_label } = req.body;
      if (!context_label) return res.status(400).json({ status: false, message: 'Label konteks wajib diisi' });

      const ctx = await packageMediaService.createContext(req.tenant.id, parseInt(packageId), context_label);
      return res.status(200).json({ status: true, data: ctx });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal membuat konteks media' });
    }
  },

  updateContext: async (req, res) => {
    try {
      const { contextId } = req.params;
      const { context_label } = req.body;
      const ctx = await packageMediaService.updateContextLabel(req.tenant.id, parseInt(contextId), context_label);
      return res.status(200).json({ status: true, data: ctx });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal update konteks media' });
    }
  },

  deleteContext: async (req, res) => {
    try {
      const { contextId } = req.params;
      await packageMediaService.deleteContext(req.tenant.id, parseInt(contextId));
      return res.status(200).json({ status: true, message: 'Konteks dihapus' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal menghapus konteks media' });
    }
  },

  uploadFiles: async (req, res) => {
    try {
      const { contextId } = req.params;
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ status: false, message: 'Tidak ada file diunggah' });
      }

      const files = await packageMediaService.uploadFilesToContext(req.tenant.id, parseInt(contextId), req.files);
      return res.status(200).json({ status: true, data: files, message: 'File berhasil diunggah dan sedang dianalisis' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal unggah file' });
    }
  },

  deleteFile: async (req, res) => {
    try {
      const { fileId } = req.params;
      await packageMediaService.deleteFile(req.tenant.id, parseInt(fileId));
      return res.status(200).json({ status: true, message: 'File dihapus' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal menghapus file' });
    }
  },

  smartAnalyze: async (req, res) => {
    try {
      const { packageId } = req.params;
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ status: false, message: 'Tidak ada file diunggah' });
      }

      const parsedPackageId = Number.isFinite(Number(packageId)) ? parseInt(packageId) : null;
      const { proposal, internalFiles } = await smartUploadService.analyzeFiles(req.tenant.id, parsedPackageId, req.files);
      return res.status(200).json({ status: true, data: { proposal, internalFiles }, message: 'Analisis AI selesai. Menunggu konfirmasi.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal melakukan analisis file' });
    }
  },

  smartCommit: async (req, res) => {
    try {
      const { packageId } = req.params;
      const { proposal, internalFiles } = req.body;
      if (!proposal || !internalFiles) {
        return res.status(400).json({ status: false, message: 'Data proposal tidak lengkap' });
      }

      const results = await smartUploadService.commitFiles(req.tenant.id, parseInt(packageId), proposal, internalFiles);
      return res.status(200).json({ status: true, data: results, message: 'File berhasil dikelompokkan dan disimpan.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal menyimpan hasil kelompok file' });
    }
  },

  smartRegenerateTitle: async (req, res) => {
    try {
      const { files, internalFiles, existingContextLabel } = req.body;
      if (!files || !internalFiles) {
        return res.status(400).json({ status: false, message: 'Data file tidak lengkap' });
      }
      const result = await smartUploadService.regenerateGroupTitle(req.tenant.id, files, internalFiles, existingContextLabel || null);
      return res.status(200).json({ status: true, data: result });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal regenerate judul grup' });
    }
  }
};

