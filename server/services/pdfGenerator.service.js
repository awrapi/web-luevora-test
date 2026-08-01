import puppeteer from 'puppeteer';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { callAI } from './ai_agent/logic.service.js';
import { uploadFromPath } from './shared/cloudinary.service.js';

const prisma = new PrismaClient();

const generateHTML = async (templateData, context) => {
  let html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <style>
        body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background: ${templateData.canvasColor || '#ffffff'}; width: 794px; height: 1123px; position: relative; }
        .element { position: absolute; display: flex; flex-direction: column; justify-content: flex-start; box-sizing: border-box; overflow: hidden; }
        .element img { pointer-events: none; }
      </style>
    </head>
    <body>
  `;

  const items = templateData.items || [];
  
  for (const el of items) {
    // Replace placeholders with context data
    let text = el.text || '';
    if (el.type === 'dynamic') {
      text = text.replace('{{NOMOR_INVOICE}}', context.invoiceNumber || '-');
      text = text.replace('{{NAMA_PEMBELI}}', context.customerName || '-');
      text = text.replace('{{NO_HP_PEMBELI}}', context.customerPhone || '-');
      text = text.replace('{{TANGGAL_TERBIT}}', new Date().toLocaleDateString('id-ID'));
      text = text.replace('{{RINCIAN_PAKET}}', context.packageDetails || '-');
      text = text.replace('{{TOTAL_BIAYA}}', `Rp ${parseFloat(context.amount || 0).toLocaleString('id-ID')}`);
      text = text.replace('{{INFO_PEMBAYARAN}}', context.paymentInfo || '-');
    }

    // Convert newlines to <br>
    text = text.replace(/\n/g, '<br/>');

    const isShape = el.type === 'shape_rect' || el.type === 'shape_circle';
    const isImage = el.type === 'image';

    let content = '';
    if (isImage && el.imageUrl) {
      // Convert image to base64 data URI for Puppeteer
      let imgSrc = '';
      try {
        if (el.imageUrl.startsWith('http')) {
          // Cloudinary or external URL — download and convert to base64
          const resp = await fetch(el.imageUrl);
          if (resp.ok) {
            const buf = Buffer.from(await resp.arrayBuffer());
            const contentType = resp.headers.get('content-type') || 'image/png';
            imgSrc = `data:${contentType};base64,${buf.toString('base64')}`;
          }
        } else {
          // Legacy: local file path
          const localPath = path.join(process.cwd(), el.imageUrl);
          if (fs.existsSync(localPath)) {
            const ext = path.extname(localPath).toLowerCase().replace('.', '');
            const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };
            const mime = mimeMap[ext] || 'image/png';
            const base64 = fs.readFileSync(localPath).toString('base64');
            imgSrc = `data:${mime};base64,${base64}`;
          }
        }
      } catch (err) {
        console.error('[PDF Generator] Failed to read image:', err.message);
      }
      
      if (imgSrc) {
        content = `<img src="${imgSrc}" style="width:100%;height:100%;object-fit:${el.objectFit || 'cover'};border-radius:${el.borderRadius || 0}px;" />`;
      }
    } else if (!isShape) {
      content = text;
    }

    html += `
      <div class="element" style="
        left: ${el.x}px; 
        top: ${el.y}px; 
        width: ${el.width}px; 
        height: ${el.height}px;
        color: ${el.color || 'transparent'};
        background-color: ${isImage ? 'transparent' : (el.backgroundColor || 'transparent')};
        font-size: ${el.fontSize || 14}px;
        font-weight: ${el.fontWeight || 'normal'};
        text-align: ${el.align || 'left'};
        transform: rotate(${el.rotation || 0}deg);
        border-radius: ${el.type === 'shape_circle' ? '50%' : (isImage ? `${el.borderRadius || 0}px` : '0')};
        z-index: ${el.zIndex || 1};
        opacity: ${(el.opacity ?? 100) / 100};
        ${isImage ? 'padding: 0;' : ''}
      ">
        ${content}
      </div>
    `;
  }

  html += `
    </body>
    </html>
  `;
  
  return html;
};

export const pdfGeneratorService = {
  generateInvoice: async (tenantId, bookingId, context) => {
    try {
      // 1. Get Template
      const template = await prisma.invoiceTemplate.findFirst({
        where: { tenant_id: tenantId, type: 'invoice', is_active: 1 }
      });

      if (!template || !template.design_data) {
        throw new Error('Model Invoice belum diatur. Silakan buat model di dashboard terlebih dahulu.');
      }

      const designData = JSON.parse(template.design_data);

      // 2. Prepare Upload Dir
      const uploadDir = path.join(process.cwd(), 'uploads', 'invoices');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // 2b. Process AI Spaces
      const aiSpaces = (designData.items || []).filter(el => el.type === 'ai_space' && el.aiPrompt);
      if (aiSpaces.length > 0) {
        let combinedPrompt = `Konteks Booking:\nNama: ${context.customerName}\nPaket: ${context.packageDetails}\nTotal: ${context.amount}\n\nTolong hasilkan teks kreatif untuk masing-masing instruksi berikut. Jawab HANYA dengan format JSON object yang valid, dimana key adalah ID dan value adalah teks buatanmu. TANPA FORMAT MARKDOWN, TANPA PENJELASAN LAIN.\n\nContoh Response:\n{"ai_space_123": "Halo Budi, terima kasih ya..."}\n\nInstruksi:\n`;
        
        aiSpaces.forEach(el => {
          const maxChars = Math.floor((el.width * el.height) / (el.fontSize * el.fontSize * 0.5));
          combinedPrompt += `- "${el.id}": ${el.aiPrompt} (PASTIKAN MAKSIMAL ${maxChars} karakter agar muat di kotak)\n`;
        });

        try {
          console.log('[PDF Generator] Executing AI Spaces Batch...');
          const aiResponse = await callAI(combinedPrompt, 'Kamu adalah copywriter profesional. Output harus berformat JSON murni.', tenantId);
          
          // Bersihkan jika ada markdown
          const cleanJsonStr = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJsonStr);
          
          designData.items = designData.items.map(el => {
            if (el.type === 'ai_space' && parsed[el.id]) {
              return { ...el, text: parsed[el.id] };
            }
            return el;
          });
          console.log('[PDF Generator] AI Spaces successfully generated.');
        } catch (err) {
          console.error('[PDF Generator] Error processing AI Spaces:', err);
          designData.items = designData.items.map(el => {
            if (el.type === 'ai_space') {
              return { ...el, text: '[Gagal memproses teks AI]' };
            }
            return el;
          });
        }
      }

      // 3. Generate HTML
      const htmlContent = await generateHTML(designData, context);

      // 4. Generate PDF using Puppeteer
      const browser = await puppeteer.launch({ 
        headless: 'new', 
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
      });
      const page = await browser.newPage();
      
      const tempHtmlPath = path.join(uploadDir, `temp-${Date.now()}-${uuidv4().substring(0, 8)}.html`);
      fs.writeFileSync(tempHtmlPath, htmlContent);
      
      await page.goto(`file:///${tempHtmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' });
      
      const fileName = `INV-${Date.now()}-${uuidv4().substring(0, 8)}.pdf`;
      const filePath = path.join(uploadDir, fileName);

      await page.pdf({
        path: filePath,
        width: '794px',
        height: '1123px',
        printBackground: true,
      });

      await browser.close();
      if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath);

      // Upload PDF to Cloudinary
      let cloudinaryUrl = null;
      try {
        const cloudResult = await uploadFromPath(filePath, {
          tenantId,
          folder: 'invoices',
          resourceType: 'raw',
          publicId: fileName.replace('.pdf', ''),
        });
        cloudinaryUrl = cloudResult.url;
        console.log(`[PDF Generator] ✅ Uploaded invoice PDF to Cloudinary: ${cloudinaryUrl}`);
        // Clean up local file after successful upload
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (cloudErr) {
        console.warn(`[PDF Generator] Cloudinary upload failed, using local path:`, cloudErr.message);
        cloudinaryUrl = `/uploads/invoices/${fileName}`;
      }

      // 5. Save to DB
      const invoice = await prisma.invoice.create({
        data: {
          tenant_id: tenantId,
          travel_booking_id: bookingId,
          invoice_number: context.invoiceNumber,
          pdf_url: cloudinaryUrl,
          amount: context.amount || 0,
          status: 'generated'
        }
      });

      return {
        success: true,
        filePath: cloudinaryUrl,
        fileUrl: cloudinaryUrl,
        invoice
      };

    } catch (error) {
      console.error('Error generating PDF:', error);
      return { success: false, error: error.message };
    }
  },

  generateReceipt: async (tenantId, bookingId, context) => {
    try {
      // 1. Get Template
      const template = await prisma.invoiceTemplate.findFirst({
        where: { tenant_id: tenantId, type: 'receipt', is_active: 1 }
      });

      if (!template || !template.design_data) {
        throw new Error('Model Receipt belum diatur. Silakan buat model di dashboard terlebih dahulu.');
      }

      const designData = JSON.parse(template.design_data);

      // 2. Prepare Upload Dir
      const uploadDir = path.join(process.cwd(), 'uploads', 'receipts');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // 2b. Process AI Spaces
      const aiSpaces = (designData.items || []).filter(el => el.type === 'ai_space' && el.aiPrompt);
      if (aiSpaces.length > 0) {
        let combinedPrompt = `Konteks Booking:\nNama: ${context.customerName}\nPaket: ${context.packageDetails}\nTotal: ${context.amount}\n\nTolong hasilkan teks kreatif untuk masing-masing instruksi berikut. Jawab HANYA dengan format JSON object yang valid, dimana key adalah ID dan value adalah teks buatanmu. TANPA FORMAT MARKDOWN, TANPA PENJELASAN LAIN.\n\nContoh Response:\n{"ai_space_123": "Halo Budi, terima kasih ya..."}\n\nInstruksi:\n`;
        
        aiSpaces.forEach(el => {
          const maxChars = Math.floor((el.width * el.height) / (el.fontSize * el.fontSize * 0.5));
          combinedPrompt += `- "${el.id}": ${el.aiPrompt} (PASTIKAN MAKSIMAL ${maxChars} karakter agar muat di kotak)\n`;
        });

        try {
          console.log('[PDF Generator] Executing AI Spaces Batch for Receipt...');
          const aiResponse = await callAI(combinedPrompt, 'Kamu adalah copywriter profesional. Output harus berformat JSON murni.', tenantId);
          
          const cleanJsonStr = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJsonStr);
          
          designData.items = designData.items.map(el => {
            if (el.type === 'ai_space' && parsed[el.id]) {
              return { ...el, text: parsed[el.id] };
            }
            return el;
          });
          console.log('[PDF Generator] AI Spaces successfully generated for Receipt.');
        } catch (err) {
          console.error('[PDF Generator] Error processing AI Spaces for Receipt:', err);
          designData.items = designData.items.map(el => {
            if (el.type === 'ai_space') {
              return { ...el, text: '[Gagal memproses teks AI]' };
            }
            return el;
          });
        }
      }

      // 3. Generate HTML
      const htmlContent = await generateHTML(designData, context);

      // 4. Generate PDF using Puppeteer
      const browser = await puppeteer.launch({ 
        headless: 'new', 
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
      });
      const page = await browser.newPage();
      
      const tempHtmlPath = path.join(uploadDir, `temp-${Date.now()}-${uuidv4().substring(0, 8)}.html`);
      fs.writeFileSync(tempHtmlPath, htmlContent);
      
      await page.goto(`file:///${tempHtmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' });
      
      const fileName = `REC-${Date.now()}-${uuidv4().substring(0, 8)}.pdf`;
      const filePath = path.join(uploadDir, fileName);

      await page.pdf({
        path: filePath,
        width: '794px',
        height: '1123px',
        printBackground: true,
      });

      await browser.close();
      if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath);

      // Upload receipt PDF to Cloudinary
      let cloudinaryUrl = null;
      try {
        const cloudResult = await uploadFromPath(filePath, {
          tenantId,
          folder: 'receipts',
          resourceType: 'raw',
          publicId: fileName.replace('.pdf', ''),
        });
        cloudinaryUrl = cloudResult.url;
        console.log(`[PDF Generator] ✅ Uploaded receipt PDF to Cloudinary: ${cloudinaryUrl}`);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (cloudErr) {
        console.warn(`[PDF Generator] Cloudinary upload failed, using local path:`, cloudErr.message);
        cloudinaryUrl = `/uploads/receipts/${fileName}`;
      }

      return {
        success: true,
        filePath: cloudinaryUrl,
        fileUrl: cloudinaryUrl
      };

    } catch (error) {
      console.error('Error generating PDF Receipt:', error);
      return { success: false, error: error.message };
    }
  }
};
