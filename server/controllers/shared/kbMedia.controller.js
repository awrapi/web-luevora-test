import multer from 'multer';
import path from 'path';
import { kbMediaService } from '../../services/shared/kbMedia.service.js';
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

export const kbMediaController = {
  getContexts: async (req, res) => {
    try {
      const { kbId } = req.params;
      const contexts = await kbMediaService.getContextsByKb(req.tenant.id, parseInt(kbId));
      return res.status(200).json({ status: true, data: contexts });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal memuat konteks media KB' });
    }
  },

  createContext: async (req, res) => {
    try {
      const { kbId } = req.params;
      const { context_label } = req.body;
      if (!context_label) return res.status(400).json({ status: false, message: 'Label konteks wajib diisi' });

      const ctx = await kbMediaService.createContext(req.tenant.id, parseInt(kbId), context_label);
      return res.status(200).json({ status: true, data: ctx });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal membuat konteks media KB' });
    }
  },

  updateContext: async (req, res) => {
    try {
      const { contextId } = req.params;
      const { context_label } = req.body;
      const ctx = await kbMediaService.updateContextLabel(req.tenant.id, parseInt(contextId), context_label);
      return res.status(200).json({ status: true, data: ctx });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal update konteks media KB' });
    }
  },

  deleteContext: async (req, res) => {
    try {
      const { contextId } = req.params;
      await kbMediaService.deleteContext(req.tenant.id, parseInt(contextId));
      return res.status(200).json({ status: true, message: 'Konteks dihapus' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal menghapus konteks media KB' });
    }
  },

  uploadFiles: async (req, res) => {
    try {
      const { contextId } = req.params;
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ status: false, message: 'Tidak ada file diunggah' });
      }

      const files = await kbMediaService.uploadFilesToContext(req.tenant.id, parseInt(contextId), req.files);
      return res.status(200).json({ status: true, data: files, message: 'File berhasil diunggah dan sedang dianalisis' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal unggah file' });
    }
  },

  deleteFile: async (req, res) => {
    try {
      const { fileId } = req.params;
      await kbMediaService.deleteFile(req.tenant.id, parseInt(fileId));
      return res.status(200).json({ status: true, message: 'File dihapus' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal menghapus file' });
    }
  },

  smartAnalyze: async (req, res) => {
    try {
      const { kbId } = req.params;
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ status: false, message: 'Tidak ada file diunggah' });
      }
      const { proposal, internalFiles } = await smartUploadService.analyzeFilesForKb(req.tenant.id, parseInt(kbId), req.files);
      return res.status(200).json({ status: true, data: { proposal, internalFiles }, message: 'Analisis AI selesai. Menunggu konfirmasi.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal melakukan analisis file KB' });
    }
  },

  smartCommit: async (req, res) => {
    try {
      const { kbId } = req.params;
      const { proposal, internalFiles } = req.body;
      if (!proposal || !internalFiles) {
        return res.status(400).json({ status: false, message: 'Data proposal tidak lengkap' });
      }
      const results = await smartUploadService.commitFilesForKb(req.tenant.id, parseInt(kbId), proposal, internalFiles);
      return res.status(200).json({ status: true, data: results, message: 'File KB berhasil dikelompokkan dan disimpan.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal menyimpan hasil kelompok file KB' });
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
      return res.status(500).json({ status: false, message: 'Gagal regenerate judul grup KB' });
    }
  }
};

