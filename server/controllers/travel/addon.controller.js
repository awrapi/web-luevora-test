import multer from 'multer';
import path from 'path';
import { addonService } from '../../services/travel/addon.service.js';

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

export const addonMediaUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

export const addonController = {
  getAddons: async (req, res) => {
    try {
      const { packageId } = req.params;
      const addons = await addonService.getAddonsByPackage(req.tenant.id, parseInt(packageId));
      return res.status(200).json({ status: true, data: addons });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal memuat addon' });
    }
  },

  createAddon: async (req, res) => {
    try {
      const { packageId } = req.params;
      const addon = await addonService.createAddon(req.tenant.id, parseInt(packageId), req.body);
      return res.status(200).json({ status: true, data: addon });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal membuat addon' });
    }
  },

  updateAddon: async (req, res) => {
    try {
      const { addonId } = req.params;
      const addon = await addonService.updateAddon(req.tenant.id, parseInt(addonId), req.body);
      return res.status(200).json({ status: true, data: addon });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal update addon' });
    }
  },

  deleteAddon: async (req, res) => {
    try {
      const { addonId } = req.params;
      await addonService.deleteAddon(req.tenant.id, parseInt(addonId));
      return res.status(200).json({ status: true, message: 'Addon dihapus' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal menghapus addon' });
    }
  },

  uploadFiles: async (req, res) => {
    try {
      const { addonId } = req.params;
      const { ai_metadata } = req.body;
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ status: false, message: 'Tidak ada file diunggah' });
      }

      const files = await addonService.uploadFilesToAddon(req.tenant.id, parseInt(addonId), req.files, ai_metadata);
      return res.status(200).json({ status: true, data: files, message: 'File berhasil diunggah' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal unggah file' });
    }
  },

  deleteFile: async (req, res) => {
    try {
      const { fileId } = req.params;
      await addonService.deleteFile(req.tenant.id, parseInt(fileId));
      return res.status(200).json({ status: true, message: 'File dihapus' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: false, message: 'Gagal menghapus file' });
    }
  }
};
