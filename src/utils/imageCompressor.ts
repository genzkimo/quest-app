import heic2any from 'heic2any';

/**
 * Professional, high-performance offline image compression pipeline.
 * Handles camera photos (JPEG, PNG, WEBP, HEIC/HEIF, HDR, Display P3).
 * Prefers native browser decoding (via Object URL / Image element)
 * to prevent WASM color-overflow posterization bugs on camera photos,
 * while maintaining HEIC fallback and direct Data URL recovery.
 */
export async function compressImage(inputFile: File): Promise<string> {
  if (!inputFile) return '';

  const maxDimension = 1200;

  // Helper to process an HTMLImageElement onto canvas with white background & quality scaling
  const processDrawable = (
    img: HTMLImageElement,
    origWidth: number,
    origHeight: number
  ): string => {
    let width = origWidth || 800;
    let height = origHeight || 600;

    if (width > height) {
      if (width > maxDimension) {
        height = Math.round(height * (maxDimension / width));
        width = maxDimension;
      }
    } else {
      if (height > maxDimension) {
        width = Math.round(width * (maxDimension / height));
        height = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');

    // Fill clean white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.82);
  };

  // Step 1: Try native browser decoding via Object URL (fastest, accurate color profile)
  try {
    const objectUrl = URL.createObjectURL(inputFile);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const result = processDrawable(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (err) => reject(err);
      img.src = objectUrl;
    });

    URL.revokeObjectURL(objectUrl);
    if (dataUrl && dataUrl.startsWith('data:image/')) {
      return dataUrl;
    }
  } catch {
    // Native load failed or unsupported format (e.g. HEIC on desktop Chrome)
  }

  // Step 2: Fallback for HEIC/HEIF files if native load failed
  const fileNameLower = inputFile.name.toLowerCase();
  const isHeic =
    inputFile.type === 'image/heic' ||
    inputFile.type === 'image/heif' ||
    fileNameLower.endsWith('.heic') ||
    fileNameLower.endsWith('.heif');

  if (isHeic) {
    try {
      const convertedBlob = await heic2any({
        blob: inputFile,
        toType: 'image/jpeg',
        quality: 0.85,
      });
      const singleBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      const convertedFile = new File([singleBlob], 'converted.jpg', { type: 'image/jpeg' });

      const objectUrl = URL.createObjectURL(convertedFile);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            const result = processDrawable(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
            resolve(result);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = (err) => reject(err);
        img.src = objectUrl;
      });

      URL.revokeObjectURL(objectUrl);
      if (dataUrl && dataUrl.startsWith('data:image/')) {
        return dataUrl;
      }
    } catch (heicErr) {
      console.warn('heic2any conversion fallback failed:', heicErr);
    }
  }

  // Step 3: Ultimate safe fallback - read directly as Data URL
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(inputFile);
  });
}


