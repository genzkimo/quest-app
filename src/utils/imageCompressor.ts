/**
 * Checks file header magic bytes to detect HEIC/HEIF container format
 * including 10-bit / 12-bit variants (heix, hevx, mif1, etc.) even if
 * the filename extension was stripped or MIME type is generic.
 */
async function checkIsHeicByHeader(file: File): Promise<boolean> {
  try {
    if (!file || file.size < 12) return false;
    const slice = file.slice(0, 64);
    const buffer = await slice.arrayBuffer();
    const view = new DataView(buffer);
    
    // Check for 'ftyp' box
    const ftyp = String.fromCharCode(view.getUint8(4), view.getUint8(5), view.getUint8(6), view.getUint8(7));
    if (ftyp === 'ftyp') {
      const headerStr = String.fromCharCode(...new Uint8Array(buffer)).toLowerCase();
      // heix: 10-bit/12-bit HEIC; hevx: 10-bit HEVC; mif1/msf1/heic: standard HEIF
      const heicBrands = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'msc1', 'avif'];
      for (const brand of heicBrands) {
        if (headerStr.includes(brand)) {
          return true;
        }
      }
    }
  } catch {
    // Ignore header inspection errors
  }
  return false;
}

/**
 * Scales a source Canvas to target dimensions and returns compressed JPEG data URL
 */
function scaleCanvasToDataUrl(sourceCanvas: HTMLCanvasElement, maxDimension = 1200): string {
  let width = sourceCanvas.width || 800;
  let height = sourceCanvas.height || 600;

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

  const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
  if (!ctx) throw new Error('Could not get 2D context');

  // Fill clean white background in case of transparent regions
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  ctx.drawImage(sourceCanvas, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Processes an ImageBitmap into a compressed JPEG Data URL
 */
function processBitmapToDataUrl(bitmap: ImageBitmap, maxDimension = 1200): string {
  let width = bitmap.width;
  let height = bitmap.height;

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

  const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
  if (!ctx) throw new Error('Could not get 2D context');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);

  // Close bitmap to release hardware memory
  try {
    bitmap.close();
  } catch {}

  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Helper to process an HTMLImageElement onto canvas with white background & quality scaling
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

  const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
  if (!ctx) throw new Error('Could not get 2D context');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.85);
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
 * Dedicated 10-bit / 12-bit / HDR HEIC decoder using libheif-js WASM engine.
 * Solves the solarization / rainbow color inversion bug caused by 8-bit modulo wrapping in old decoders.
 */
async function decodeHeicWithLibHeif(file: File, maxDimension = 1200): Promise<string> {
  const libheifModule = await import('libheif-js/wasm-bundle');
  const libheif = (libheifModule as any).default || libheifModule;
  if (!libheif || !libheif.HeifDecoder) {
    throw new Error('libheif HeifDecoder not available');
  }

  const decoder = new libheif.HeifDecoder();
  const buffer = await file.arrayBuffer();
  const data = decoder.decode(new Uint8Array(buffer));
  if (!data || data.length === 0) {
    throw new Error('No image streams found in HEIF container');
  }

  const image = data[0];
  const width = image.get_width();
  const height = image.get_height();

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;

  const ctx = tempCanvas.getContext('2d', { colorSpace: 'srgb', willReadFrequently: true });
  if (!ctx) throw new Error('Could not get 2D canvas context');

  const imageData = ctx.createImageData(width, height);
  await new Promise<void>((resolve, reject) => {
    image.display(imageData, (displayData: any) => {
      if (!displayData) {
        reject(new Error('libheif image display failed'));
      } else {
        resolve();
      }
    });
  });

  ctx.putImageData(imageData, 0, 0);

  // Free memory
  try {
    if (typeof image.free === 'function') image.free();
  } catch {}

  return scaleCanvasToDataUrl(tempCanvas, maxDimension);
}

/**
 * Professional, high-performance universal offline image compression pipeline.
 * Fully supports:
 * - 10-bit / 12-bit HEIC/HEIF photos (Modern iPhones, Samsung Galaxy, Xiaomi HDR photos).
 * - Standard JPEG, PNG, WEBP, AVIF.
 * - Hardware color-managed decoding with fallback to libheif 10-bit WASM engine.
 * - Prevents color corruption, solarization, and rainbow posterization.
 */
export async function compressImage(inputFile: File): Promise<string> {
  if (!inputFile) return '';

  const maxDimension = 1200;

  // Step 1: Detect HEIC/HEIF format by extension, MIME type, or container header
  const fileNameLower = (inputFile.name || '').toLowerCase();
  const typeLower = (inputFile.type || '').toLowerCase();

  const isHeicByExtOrType =
    typeLower.includes('heic') ||
    typeLower.includes('heif') ||
    fileNameLower.endsWith('.heic') ||
    fileNameLower.endsWith('.heif') ||
    fileNameLower.endsWith('.heics') ||
    fileNameLower.endsWith('.heifs') ||
    fileNameLower.endsWith('.hif');

  const isHeic = isHeicByExtOrType || (await checkIsHeicByHeader(inputFile));

  // Step 2: Try Native Browser Hardware Decoding first!
  // Modern Safari (iOS 17+) and Chrome on Android (Chrome 116+) natively decode
  // 10-bit HEIC images with the OS hardware color pipeline, yielding perfect colors.
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(inputFile, { colorSpaceConversion: 'default' });
      if (bitmap && bitmap.width > 0 && bitmap.height > 0) {
        const result = processBitmapToDataUrl(bitmap, maxDimension);
        if (result && result.startsWith('data:image/')) {
          return result;
        }
      }
    } catch {
      // Browser does not support native HEIC via createImageBitmap, proceed to decoders
    }
  }

  // Also try native <img> element (works on Safari iOS/macOS)
  try {
    const nativeResult = await processFileToDataUrl(inputFile, maxDimension);
    if (nativeResult && nativeResult.startsWith('data:image/')) {
      return nativeResult;
    }
  } catch {
    // Native load failed, proceed to dedicated decoders
  }

  // Step 3: If HEIC/HEIF, use libheif-js WASM engine (fully supports 10-bit HDR without solarization)
  if (isHeic) {
    try {
      const result = await decodeHeicWithLibHeif(inputFile, maxDimension);
      if (result && result.startsWith('data:image/')) {
        return result;
      }
    } catch (libheifErr) {
      console.warn('libheif 10-bit decoding fallback:', libheifErr);
    }

    // Step 4: Fallback to heic2any only if libheif wasn't able to decode
    try {
      const heic2anyModule = await import('heic2any');
      const heic2any = (heic2anyModule as any).default || heic2anyModule;
      const convertedBlob = await heic2any({
        blob: inputFile,
        toType: 'image/jpeg',
        quality: 0.88,
      });
      const singleBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      const convertedFile = new File([singleBlob], 'converted.jpg', { type: 'image/jpeg' });

      const result = await processFileToDataUrl(convertedFile, maxDimension);
      if (result && result.startsWith('data:image/')) {
        return result;
      }
    } catch (heicErr) {
      console.warn('heic2any fallback attempted:', heicErr);
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
