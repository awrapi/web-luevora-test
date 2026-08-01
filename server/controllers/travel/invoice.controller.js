import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import { uploadFromBuffer, deleteByPublicId, extractPublicId } from '../../services/shared/cloudinary.service.js';

// Multer config — memoryStorage (buffer → Cloudinary)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Tipe file tidak didukung. Gunakan JPG, PNG, WEBP, GIF, atau SVG.'), false);
  }
};

export const invoiceUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const prisma = new PrismaClient();

export const invoiceController = {
  getTemplate: async (req, res) => {
    try {
      const tenantId = req.tenant.id;
      const { type } = req.params; // 'invoice' or 'receipt'

      const templates = await prisma.invoiceTemplate.findMany({
        where: { tenant_id: tenantId, type: type },
        orderBy: { updated_at: 'desc' }
      });

      return res.status(200).json({
        status: true,
        data: templates
      });
    } catch (error) {
      console.error('Error getTemplate:', error);
      return res.status(500).json({
        status: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  saveTemplate: async (req, res) => {
    try {
      const tenantId = req.tenant.id;
      const { type } = req.params;
      const { id, name, design_data } = req.body;

      let template;
      if (id) {
        template = await prisma.invoiceTemplate.update({
          where: { id: parseInt(id) },
          data: { 
            name: name || undefined,
            design_data: JSON.stringify(design_data) 
          }
        });
      } else {
        // If creating new, check if it's the first one, if so make it active
        const existingCount = await prisma.invoiceTemplate.count({
          where: { tenant_id: tenantId, type: type }
        });

        template = await prisma.invoiceTemplate.create({
          data: {
            tenant_id: tenantId,
            type: type,
            name: name || `Template ${existingCount + 1}`,
            design_data: JSON.stringify(design_data),
            is_active: existingCount === 0 ? 1 : 0
          }
        });
      }

      return res.status(200).json({
        status: true,
        message: 'Template saved successfully',
        data: template
      });
    } catch (error) {
      console.error('Error saveTemplate:', error);
      return res.status(500).json({
        status: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  setActiveTemplate: async (req, res) => {
    try {
      const tenantId = req.tenant.id;
      const { type, id } = req.params;

      // Reset all to inactive
      await prisma.invoiceTemplate.updateMany({
        where: { tenant_id: tenantId, type: type },
        data: { is_active: 0 }
      });

      // Set chosen to active
      await prisma.invoiceTemplate.update({
        where: { id: parseInt(id) },
        data: { is_active: 1 }
      });

      return res.status(200).json({
        status: true,
        message: 'Active template updated successfully'
      });
    } catch (error) {
      console.error('Error setActiveTemplate:', error);
      return res.status(500).json({
        status: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  generatePreview: async (req, res) => {
    try {
      const tenantId = req.tenant.id;
      const { items, canvasColor } = req.body;

      if (!items) {
        return res.status(400).json({ status: false, message: 'Items required' });
      }

      // Find AI spaces
      const aiSpaces = items.filter(el => el.type === 'ai_space' && el.aiPrompt);

      let contextData = {
        invoiceNumber: "INV-DUMMY-12345",
        customerName: "Bapak/Ibu Pelanggan",
        customerPhone: "081234567890",
        packageDetails: "Paket Wisata Bali 3 Hari 2 Malam",
        amount: "5500000",
        paymentInfo: "BCA 123456789 a.n Luevora Travel"
      };

      // Let AI generate the context AND the ai_space text (if any)
      let prompt = `Kamu adalah pembuat data mock (dummy) dinamis untuk preview sistem invoice Travel Agent.
Tolong buat profil fiktif pemesanan travel yang SANGAT KREATIF, realistis dan unik (jangan gunakan nama John Doe, gunakan nama dan destinasi yang bervariasi). Keluarkan HANYA dalam bentuk JSON valid TANPA MARKDOWN dengan struktur berikut:

{
  "context": {
    "invoiceNumber": "string",
    "customerName": "string",
    "customerPhone": "string",
    "packageDetails": "string",
    "amount": "string (angka bulat tanpa titik, misal 7500000)",
    "paymentInfo": "string"
  }`;

      if (aiSpaces.length > 0) {
        prompt += `,\n  "ai_spaces": {\n`;
        aiSpaces.forEach(el => {
          const maxChars = Math.floor((el.width * el.height) / (el.fontSize * el.fontSize * 0.5));
          prompt += `    "${el.id}": "jawaban untuk instruksi '${el.aiPrompt}' (maksimal ${maxChars} karakter)",\n`;
        });
        // hapus koma terakhir
        prompt = prompt.slice(0, -2) + `\n  }`;
      }
      
      prompt += `\n}`;

      console.log('[Invoice Preview] Generating dynamic mock data and AI text...');
      const { callAI } = await import('../../services/ai_agent/logic.service.js');
      const aiResponse = await callAI(prompt, 'Kamu adalah data generator. Output HANYA JSON murni tanpa diformat.', tenantId);
      
      try {
        const cleanJsonStr = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJsonStr);

        if (parsed.context) {
          contextData = { ...contextData, ...parsed.context };
        }

        // Replace ai spaces text
        if (parsed.ai_spaces) {
          items.forEach(el => {
            if (el.type === 'ai_space' && parsed.ai_spaces[el.id]) {
              el.text = parsed.ai_spaces[el.id];
            }
          });
        }
      } catch (parseError) {
        console.error('Failed to parse AI mock data', parseError);
      }

      // Replace dynamic text placeholders with contextData
      items.forEach(el => {
        if (el.type === 'dynamic' && el.text) {
          let text = el.text;
          text = text.replace('{{NOMOR_INVOICE}}', contextData.invoiceNumber || '-');
          text = text.replace('{{NAMA_PEMBELI}}', contextData.customerName || '-');
          text = text.replace('{{NO_HP_PEMBELI}}', contextData.customerPhone || '-');
          text = text.replace('{{TANGGAL_TERBIT}}', new Date().toLocaleDateString('id-ID'));
          text = text.replace('{{RINCIAN_PAKET}}', contextData.packageDetails || '-');
          text = text.replace('{{TOTAL_BIAYA}}', `Rp ${parseFloat(contextData.amount || 0).toLocaleString('id-ID')}`);
          text = text.replace('{{INFO_PEMBAYARAN}}', contextData.paymentInfo || '-');
          el.text = text;
        }
      });

      return res.status(200).json({
        status: true,
        data: items,
        context: contextData
      });

    } catch (error) {
      console.error('Error generatePreview:', error);
      return res.status(500).json({
        status: false,
        message: 'Gagal membuat preview',
        error: error.message
      });
    }
  },

  // === IMAGE UPLOAD HANDLERS ===

  uploadImage: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ status: false, message: 'Tidak ada file yang di-upload' });
      }

      const tenantId = req.tenant.id;
      
      // Upload buffer to Cloudinary
      const result = await uploadFromBuffer(req.file.buffer, {
        tenantId,
        folder: 'invoice-images',
        resourceType: 'image',
      });

      return res.status(200).json({
        status: true,
        message: 'Gambar berhasil di-upload',
        data: {
          filename: result.publicId,
          url: result.url,
          originalName: req.file.originalname,
          size: req.file.size
        }
      });
    } catch (error) {
      console.error('Error uploadImage:', error);
      return res.status(500).json({
        status: false,
        message: 'Gagal meng-upload gambar',
        error: error.message
      });
    }
  },

  getImages: async (req, res) => {
    try {
      const tenantId = req.tenant.id;

      // List images from Cloudinary via search API
      const { v2: cloudinaryV2 } = await import('cloudinary');
      const searchResult = await cloudinaryV2.search
        .expression(`folder:luevora/${tenantId}/invoice-images`)
        .sort_by('created_at', 'desc')
        .max_results(100)
        .execute();

      const images = (searchResult.resources || []).map(r => ({
        filename: r.public_id,
        url: r.secure_url,
        size: r.bytes,
        uploadedAt: r.created_at
      }));

      return res.status(200).json({ status: true, data: images });
    } catch (error) {
      console.error('Error getImages:', error);
      return res.status(500).json({
        status: false,
        message: 'Gagal memuat daftar gambar',
        error: error.message
      });
    }
  },

  deleteImage: async (req, res) => {
    try {
      const { filename } = req.params;

      // Try extracting publicId — if it's a full URL, extract it; otherwise use as-is
      const publicId = extractPublicId(filename) || filename;
      await deleteByPublicId(publicId);

      return res.status(200).json({
        status: true,
        message: 'Gambar berhasil dihapus'
      });
    } catch (error) {
      console.error('Error deleteImage:', error);
      return res.status(500).json({
        status: false,
        message: 'Gagal menghapus gambar',
        error: error.message
      });
    }
  }
};
