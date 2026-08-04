import heic2any from 'heic2any';

/**
 * Checks file header magic bytes to detect HEIC/HEIF container format
 * even if the browser or OS stripped the filename extension or MIME type.
 */
async function checkIsHeicByHeader(file: File): Promise<boolean> {
  try {
    if (!file || file.size < 12) return false;
    const slice = file.slice(0, 16);
    const buffer = await slice.arrayBuffer();
    const view = new DataView(buffer);
    // ftyp box starts at byte 4
    const ftyp = String.fromCharCode(view.getUint8(4), view.getUint8(5), view.getUint8(6), view.getUint8(7));
    if (ftyp === 'ftyp') {
      const brand = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11)).toLowerCase();
      const heicBrands = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'msc1'];
      if (heicBrands.includes(brand)) {
        return true;
      }
    }
  } catch {
    // Ignore header inspection errors
  }
  return false;
}

/**
 * Helper to process a Blob/File onto canvas with white background & quality scaling
 */
function processDrawable(
  img: HTMLImageElement,
  origWidth: number,
  origHeight: number,
  maxDimension = 1200
): string {
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
}

/**
 * Helper to process a File or Blob into a compressed JPEG Data URL via HTMLImageElement
 */
async function processFileToDataUrl(file: Blob, maxDimension = 1200): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const result = processDrawable(img, img.naturalWidth || img.width, img.naturalHeight || img.height, maxDimension);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (err) => reject(err);
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Professional, high-performance universal offline image compression pipeline.
 * Fully supports HEIC/HEIF (iOS iPhone camera photos, iPad), JPEG, PNG, WEBP, HDR, Display P3.
 * Used across the whole app: Stories, AI KYC/NID card analysis, Portfolio Gallery, Profile Avatar, and Quest Proofs.
 */
export async function compressImage(inputFile: File): Promise<string> {
  if (!inputFile) return '';

  const maxDimension = 1200;

  // Step 1: Detect HEIC/HEIF format by extension, MIME type, or file header magic bytes
  const fileNameLower = (inputFile.name || '').toLowerCase();
  const typeLower = (inputFile.type || '').toLowerCase();

  const isHeicByExtOrType =
    typeLower.includes('heic') ||
    typeLower.includes('heif') ||
    fileNameLower.endsWith('.heic') ||
    fileNameLower.endsWith('.heif') ||
    fileNameLower.endsWith('.heics') ||
    fileNameLower.endsWith('.heifs');

  const isHeic = isHeicByExtOrType || (await checkIsHeicByHeader(inputFile));

  // Step 2: If HEIC/HEIF, convert with heic2any FIRST before canvas drawing
  if (isHeic) {
    try {
      const convertedBlob = await heic2any({
        blob: inputFile,
        toType: 'image/jpeg',
        quality: 0.85,
      });
      const singleBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      const convertedFile = new File([singleBlob], 'converted.jpg', { type: 'image/jpeg' });

      const result = await processFileToDataUrl(convertedFile, maxDimension);
      if (result && result.startsWith('data:image/')) {
        return result;
      }
    } catch (heicErr) {
      console.warn('heic2any conversion fallback attempted:', heicErr);
    }
  }

  // Step 3: Try native browser decoding via Object URL
  try {
    const result = await processFileToDataUrl(inputFile, maxDimension);
    if (result && result.startsWith('data:image/')) {
      return result;
    }
  } catch {
    // Native load failed
  }

  // Step 4: Secondary fallback to heic2any if not already tried
  if (!isHeic) {
    try {
      const convertedBlob = await heic2any({
        blob: inputFile,
        toType: 'image/jpeg',
        quality: 0.85,
      });
      const singleBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      const convertedFile = new File([singleBlob], 'converted.jpg', { type: 'image/jpeg' });

      const result = await processFileToDataUrl(convertedFile, maxDimension);
      if (result && result.startsWith('data:image/')) {
        return result;
      }
    } catch {
      // Ignore
    }
  }

  // Step 5: Ultimate safe fallback - read directly as Data URL
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(inputFile);
  });
}



