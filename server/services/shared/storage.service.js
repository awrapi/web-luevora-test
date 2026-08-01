/**
 * storage.service.js
 * Simple wrapper to upload a file buffer to cloud storage (Cloudinary).
 * Returns a public URL that can be passed to WhatsApp/Telegram/Instagram APIs.
 */

import path from 'path';
import { uploadFromBuffer } from './cloudinary.service.js';

/**
 * Upload a buffer to the chat-media folder and return a public URL.
 *
 * @param {Buffer} buffer
 * @param {string} originalname
 * @param {string} mimetype
 * @param {number} tenantId
 * @returns {Promise<string>} Publicly accessible URL
 */
export const uploadBufferToStorage = async (buffer, originalname, mimetype, tenantId) => {
  // Sanitize filename as public_id (no extension, no special chars)
  const safeId = `${Date.now()}_${originalname.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/\.[^.]+$/, '')}`;
  const ext = path.extname(originalname).toLowerCase();
  const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif', '.heic'].includes(ext);
  const isVideo = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.m4v', '.ogv'].includes(ext);

  // Also detect from mimetype if extension is missing or ambiguous
  const effectiveIsImage = isImage || (mimetype && mimetype.startsWith('image/'));
  const effectiveIsVideo = isVideo || (mimetype && mimetype.startsWith('video/'));

  const result = await uploadFromBuffer(buffer, {
    tenantId,
    folder: 'chat-media',
    publicId: safeId,
    resourceType: 'auto', // lets Cloudinary detect image/video/raw
  });

  // Cloudinary raw files (PDF, DOCX, XLSX, dll) tidak otomatis menyertakan
  // ekstensi di URL-nya. Tambahkan ekstensi asli agar browser bisa mengenali
  // format file yang benar saat download.
  let fileUrl = result.url;
  if (!effectiveIsImage && !effectiveIsVideo && ext && !fileUrl.toLowerCase().endsWith(ext)) {
    fileUrl = `${fileUrl}${ext}`;
  }

  return fileUrl;
};

export default { uploadBufferToStorage };
