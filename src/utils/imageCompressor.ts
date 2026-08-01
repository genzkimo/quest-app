import heic2any from 'heic2any';

/**
 * Professional, high-performance offline image compression pipeline.
 * Converts HEIC/HEIF (iPhone) images automatically to JPEG/PNG,
 * resizes any loaded image to max dimensions of 1080x1080 while conserving ratio,
 * and encodes as a high-quality JPEG at imageQuality: 70 (0.7).
 */
export async function compressImage(inputFile: File): Promise<string> {
  let fileToProcess = inputFile;

  // Check if the file is HEIC/HEIF (common on iPhone/iOS devices)
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
        quality: 0.8
      });
      const singleBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      fileToProcess = new File([singleBlob], inputFile.name.replace(/\.(heic|heif)$/i, '.jpg'), {
        type: 'image/jpeg'
      });
    } catch (heicErr) {
      console.warn("Failed to convert HEIC image with heic2any, attempting direct processing:", heicErr);
    }
  }

  return new Promise((resolve, reject) => {
    // If file type is not image or not recognized, try reading anyway or check extension
    const file = fileToProcess;

    const reader = new FileReader();

    const timeoutId = setTimeout(() => {
      console.warn("compressImage timeout reached. Using fallback FileReader progress.");
      try {
        if (reader.result) {
          resolve(reader.result as string);
        } else {
          const fallbackReader = new FileReader();
          fallbackReader.onload = (ev) => resolve(ev.target?.result as string || '');
          fallbackReader.onerror = () => resolve('');
          fallbackReader.readAsDataURL(file);
        }
      } catch (err) {
        resolve('');
      }
    }, 6000);

    const cleanup = () => clearTimeout(timeoutId);

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxSize = 1080;

        // Calculate responsive resizing dimensions keeping strict aspect ratio
        if (width > height) {
          if (width > maxSize) {
            height = Math.round(height * (maxSize / width));
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round(width * (maxSize / height));
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          resolve(event.target?.result as string || '');
          return;
        }

        // Draw white background under solid canvas (important for transparent PNGs converted to JPEG quality 70)
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);

        // Draw source image onto normalized 1080 bounds
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas image as compressed JPEG output
        try {
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          cleanup();
          resolve(compressedDataUrl);
        } catch (err) {
          cleanup();
          resolve(event.target?.result as string || '');
        }
      };
      
      img.onerror = () => {
        cleanup();
        // If image loading fails, resolve with data URL as fallback instead of hard reject
        if (event.target?.result) {
          resolve(event.target.result as string);
        } else {
          reject(new Error("Failed to load source image file"));
        }
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      cleanup();
      reject(new Error("File reader reading exception"));
    };

    reader.readAsDataURL(file);
  });
}

