/**
 * Unified image handling utility library for client-side uploads.
 * Handles reading files as base64 strings and canvas-based resizing/compression.
 */

/**
 * Converts a raw File object into a base64-encoded data string (without header prefix).
 */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64String = result.split(",")[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Resizes and compresses an image file to a maximum bounding box width/height.
 * Preserves vector SVGs and animated GIFs in their native formats.
 * Outputs a web-optimized JPEG base64 string.
 */
export function resizeAndCompressImage(
  file: File,
  maxWidth = 2048,
  maxHeight = 2048,
  quality = 0.85
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    // Keep animated GIFs and vector SVGs as-is to preserve native behaviors
    if (file.type === "image/gif" || file.type === "image/svg+xml") {
      readFileAsBase64(file)
        .then((base64) => resolve({ base64, mimeType: file.type }))
        .catch(() => resolve({ base64: "", mimeType: file.type }));
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let width = img.naturalWidth;
      let height = img.naturalHeight;

      // Scale proportionally if image dimensions exceed maximum bounds
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        // Fallback to original file
        readFileAsBase64(file).then((base64) => {
          resolve({ base64, mimeType: file.type });
        });
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Export as web-friendly high-quality JPEG
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const base64 = dataUrl.split(",")[1];
      resolve({ base64, mimeType: "image/jpeg" });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // Fallback to original file
      readFileAsBase64(file).then((base64) => {
        resolve({ base64, mimeType: file.type });
      });
    };
  });
}
