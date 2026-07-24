/**
 * Professional, high-performance offline image compression pipeline.
 * Resizes any loaded image to max dimensions of 1080x1080 while conserving ratio,
 * and encodes as a high-quality JPEG at imageQuality: 70 (0.7).
 */
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // If the file is not an image, reject
    if (!file.type.startsWith('image/')) {
      reject(new Error("Chosen file is not a valid image"));
      return;
    }

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
    }, 4500);

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
        // Setting imageQuality to 70 (0.7 quality parameter)
        try {
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          cleanup();
          resolve(compressedDataUrl);
        } catch (err) {
          // Cross-origin fallback or standard failure
          cleanup();
          resolve(event.target?.result as string || '');
        }
      };
      
      img.onerror = () => {
        cleanup();
        reject(new Error("Failed to load source image file"));
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
