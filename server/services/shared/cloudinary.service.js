/**
 * ================================================================
 * Cloudinary Service — Centralized Cloud Storage
 * ================================================================
 * Mengelola semua operasi upload, delete, dan URL generation
 * untuk file media yang disimpan di Cloudinary.
 *
 * Folder structure di Cloudinary:
 *   luevora/{tenantId}/package-media/   — gambar/dokumen paket wisata
 *   luevora/{tenantId}/addon-media/     — gambar/dokumen addon
 *   luevora/{tenantId}/wa-media/        — media dari pelanggan (gambar, VN)
 *   luevora/{tenantId}/invoices/        — PDF invoice
 *   luevora/{tenantId}/receipts/        — PDF receipt
 *   luevora/{tenantId}/invoice-images/  — gambar template invoice
 *   luevora/{tenantId}/kb-media/        — media knowledge base
 * ================================================================
 */

import { v2 as cloudinary } from 'cloudinary';

// Configure from .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file buffer to Cloudinary.
 *
 * @param {Buffer} buffer - File data as Buffer
 * @param {object} options
 * @param {number} options.tenantId - Tenant ID for folder organization
 * @param {string} options.folder - Sub-folder name (e.g. 'package-media', 'wa-media')
 * @param {string} [options.publicId] - Custom public ID (filename without extension)
 * @param {string} [options.resourceType='auto'] - Cloudinary resource type ('image', 'raw', 'video', 'auto')
 * @returns {Promise<{url: string, publicId: string, format: string}>}
 */
export const uploadFromBuffer = async (buffer, options = {}) => {
  const { tenantId, folder = 'general', publicId, resourceType = 'auto' } = options;

  const folderPath = tenantId ? `luevora/${tenantId}/${folder}` : `luevora/${folder}`;
  const uploadId = publicId || `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderPath,
        public_id: uploadId,
        resource_type: resourceType,
        overwrite: true,
      },
      (error, result) => {
        if (error) {
          console.error(`[Cloudinary] Upload failed:`, error.message);
          return reject(error);
        }
        console.log(`[Cloudinary] ✅ Uploaded: ${result.secure_url} (${(result.bytes / 1024).toFixed(1)}KB)`);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );

    // Write buffer to the upload stream
    uploadStream.end(buffer);
  });
};

/**
 * Upload a local file to Cloudinary.
 *
 * @param {string} filePath - Absolute path to local file
 * @param {object} options - Same as uploadFromBuffer options
 * @returns {Promise<{url: string, publicId: string, format: string}>}
 */
export const uploadFromPath = async (filePath, options = {}) => {
  const { tenantId, folder = 'general', publicId, resourceType = 'auto' } = options;

  const folderPath = tenantId ? `luevora/${tenantId}/${folder}` : `luevora/${folder}`;
  const uploadId = publicId || `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folderPath,
      public_id: uploadId,
      resource_type: resourceType,
      overwrite: true,
    });

    console.log(`[Cloudinary] ✅ Uploaded from path: ${result.secure_url} (${(result.bytes / 1024).toFixed(1)}KB)`);
    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes,
    };
  } catch (error) {
    console.error(`[Cloudinary] Upload from path failed:`, error.message);
    throw error;
  }
};

/**
 * Delete a file from Cloudinary by public ID.
 *
 * @param {string} publicId - Cloudinary public ID (e.g. 'luevora/11/package-media/file_xxx')
 * @param {string} [resourceType='image'] - Resource type
 * @returns {Promise<boolean>} true if deleted successfully
 */
export const deleteByPublicId = async (publicId, resourceType = 'image') => {
  if (!publicId) return false;

  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    const success = result.result === 'ok';
    if (success) {
      console.log(`[Cloudinary] 🗑️ Deleted: ${publicId}`);
    } else {
      console.warn(`[Cloudinary] Delete response for ${publicId}:`, result.result);
    }
    return success;
  } catch (error) {
    console.error(`[Cloudinary] Delete failed for ${publicId}:`, error.message);
    return false;
  }
};

/**
 * Extract public ID from a full Cloudinary URL.
 * E.g. "https://res.cloudinary.com/xxx/image/upload/v123/luevora/11/package-media/file_abc.png"
 *   → "luevora/11/package-media/file_abc"
 *
 * @param {string} url - Full Cloudinary URL
 * @returns {string|null} Public ID or null
 */
export const extractPublicId = (url) => {
  if (!url || !url.includes('cloudinary.com')) return null;

  try {
    // Pattern: /upload/v{version}/{public_id}.{ext}
    const match = url.match(/\/upload\/(?:v\d+\/)?(.*?)(?:\.\w+)?$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

/**
 * Check if a URL is a Cloudinary URL.
 *
 * @param {string} url
 * @returns {boolean}
 */
export const isCloudinaryUrl = (url) => {
  return url && typeof url === 'string' && url.includes('res.cloudinary.com');
};

export default {
  uploadFromBuffer,
  uploadFromPath,
  deleteByPublicId,
  extractPublicId,
  isCloudinaryUrl,
};
