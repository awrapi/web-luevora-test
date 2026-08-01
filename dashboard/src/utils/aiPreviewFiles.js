const DEFAULT_MAX_SIDE = 1280;
const DEFAULT_QUALITY = 0.78;

const canvasToBlob = (canvas, mimeType, quality) =>
  new Promise((resolve) => {
    canvas.toBlob(resolve, mimeType, quality);
  });

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gagal membaca gambar untuk preview AI'));
    };

    image.src = url;
  });

const shouldOptimizeImage = (file) =>
  file?.type?.startsWith('image/')
  && file.type !== 'image/svg+xml'
  && file.type !== 'image/gif';

export const prepareFilesForAiPreview = async (files, options = {}) => {
  const maxSide = options.maxSide || DEFAULT_MAX_SIDE;
  const quality = options.quality || DEFAULT_QUALITY;

  return Promise.all(
    Array.from(files || []).map(async (file) => {
      if (!shouldOptimizeImage(file)) return file;

      try {
        const image = await loadImage(file);
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        const scale = Math.min(1, maxSide / Math.max(width, height));
        const targetWidth = Math.max(1, Math.round(width * scale));
        const targetHeight = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

        const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
        if (!blob || blob.size >= file.size) return file;

        return new File([blob], file.name, {
          type: 'image/jpeg',
          lastModified: file.lastModified,
        });
      } catch (error) {
        console.warn('[AI Preview] Gagal mengoptimalkan gambar:', error.message);
        return file;
      }
    })
  );
};
