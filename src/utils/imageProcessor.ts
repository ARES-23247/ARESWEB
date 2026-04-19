import heic2any from "heic2any";

/**
 * Optimizes an image file for upload.
 * It first attempts to use native hardware decoding / Canvas resize to generate a WebP (which works natively for HEIC on iOS/macOS Safari).
 * If native parsing fails, it assumes it's an unsupported format on a generic browser (e.g. Windows/Chrome parsing HEIC),
 * and triggers heic2any to safely software-decode it to JPEG.
 */
export const compressImage = async (file: File): Promise<{ blob: Blob; ext: string }> => {
  const convertWithCanvas = (sourceBlob: Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(sourceBlob);
      const img = new Image();
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        try {
          const canvas = document.createElement("canvas");
          const MAX_W = 1920;
          let w = img.width;
          let h = img.height;

          if (w > MAX_W) { 
            h = Math.round((h * MAX_W) / w); 
            w = MAX_W; 
          }
          
          canvas.width = w; 
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          
          if (!ctx) return reject(new Error("Canvas context error"));
          ctx.drawImage(img, 0, 0, w, h);
          
          canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error("Failed to generate WebP Blob"));
          }, "image/webp", 0.8);
        } catch (e) {
          reject(e);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("NATIVE_DECODE_FAILED"));
      };

      img.src = url;
    });
  };

  try {
    // Attempt native hardware decoding and resize
    const webpBlob = await convertWithCanvas(file);
    return { blob: webpBlob, ext: ".webp" };
  } catch (err) {
    const isHeic = file.type === "image/heic" || file.type === "image/heif" || file.name.toLowerCase().endsWith(".heic");
    const errMsg = err instanceof Error ? err.message : String(err);
    
    if (errMsg === "NATIVE_DECODE_FAILED" && isHeic) {
      console.warn("Native HEIC decoding failed, falling back to software heic2any decoder...");
      try {
        const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 });
        const jpegBlob = Array.isArray(converted) ? converted[0] : converted;
        // Avoid bouncing through canvas again to save memory, return the generated JPEG natively
        return { blob: jpegBlob, ext: ".jpeg" };
      } catch (fallbackErr) {
        console.error("heic2any software decoding fatally failed:", fallbackErr);
        throw new Error("Cannot decode HEIC natively or via software fallback. The image might be corrupted or unsupported.");
      }
    }
    
    // If it failed and wasn't HEIC, or failed midway through canvas
    throw new Error(`Image compression failed: ${errMsg}`);
  }
};
