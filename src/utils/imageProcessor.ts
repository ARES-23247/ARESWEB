/**
 * Centralized image processing utility for ARESWEB.
 *
 * Strategy for HEIC/HEIF files:
 *  1. Detect HEIC by file extension (MIME types are unreliable across OS).
 *  2. For HEIC: attempt native canvas decode first (works on Safari/macOS/iOS).
 *  3. Validate the canvas output — check dimensions > 0 and blob size > 1KB.
 *     Some browsers "succeed" with a 0×0 transparent image instead of erroring.
 *  4. If native decode fails OR produces garbage, lazy-load heic2any (2.7MB WASM)
 *     and software-decode the file. This avoids bloating the initial bundle.
 *  5. For standard formats (JPEG/PNG/WebP/GIF): normal canvas resize to WebP.
 */

const isHeicFile = (file: File): boolean => {
  const ext = file.name.toLowerCase();
  return (
    ext.endsWith(".heic") ||
    ext.endsWith(".heif") ||
    file.type === "image/heic" ||
    file.type === "image/heif"
  );
};

/**
 * Draw a Blob onto a <canvas>, resize to max 1920px wide, and export as WebP.
 * Rejects with a descriptive error if the browser can't decode the source.
 */
const canvasConvert = (sourceBlob: Blob): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(sourceBlob);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Validation: some browsers fire onload for HEIC but produce a 0×0 image
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        return reject(new Error("DECODED_ZERO_SIZE"));
      }

      try {
        const canvas = document.createElement("canvas");
        const MAX_W = 1920;
        let w = img.naturalWidth;
        let h = img.naturalHeight;

        if (w > MAX_W) {
          h = Math.round((h * MAX_W) / w);
          w = MAX_W;
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");

        if (!ctx) return reject(new Error("Canvas 2D context unavailable"));
        ctx.drawImage(img, 0, 0, w, h);

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size < 1024) {
              // A sub-1KB "image" is almost certainly a transparent/empty frame
              return reject(new Error("CANVAS_OUTPUT_TOO_SMALL"));
            }
            resolve(blob);
          },
          "image/webp",
          0.82
        );
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

/**
 * Lazy-load heic2any and software-decode a HEIC blob to JPEG.
 * This is the fallback path for browsers without native HEIC support.
 */
const softwareDecodeHeic = async (file: File): Promise<Blob> => {
  // Dynamic import keeps the 2.7MB WASM out of the main bundle
  const { default: heic2any } = await import("heic2any");
  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.82,
  });
  return Array.isArray(converted) ? converted[0] : converted;
};

/**
 * Compress and optimize any image file for upload to R2.
 * Returns the processed blob and the appropriate file extension.
 */
export const compressImage = async (
  file: File
): Promise<{ blob: Blob; ext: string }> => {
  const heic = isHeicFile(file);

  // ─── Fast path: non-HEIC files go straight to canvas ───────────
  if (!heic) {
    const webpBlob = await canvasConvert(file);
    return { blob: webpBlob, ext: ".webp" };
  }

  // ─── HEIC path: try native first, validate, then fallback ──────
  console.info("[imageProcessor] HEIC detected:", file.name);

  // Step 1: Attempt native decode (works on Safari + macOS/iOS)
  try {
    const webpBlob = await canvasConvert(file);
    console.info("[imageProcessor] Native HEIC decode succeeded:", file.name);
    return { blob: webpBlob, ext: ".webp" };
  } catch (nativeErr) {
    console.warn(
      "[imageProcessor] Native HEIC decode failed, invoking software fallback:",
      nativeErr instanceof Error ? nativeErr.message : nativeErr
    );
  }

  // Step 2: Software decode via heic2any (lazy-loaded)
  try {
    const jpegBlob = await softwareDecodeHeic(file);

    // Now run the JPEG through canvas to resize + convert to WebP
    try {
      const webpBlob = await canvasConvert(jpegBlob);
      return { blob: webpBlob, ext: ".webp" };
    } catch {
      // If canvas fails on the JPEG too, just ship the JPEG directly
      console.warn("[imageProcessor] Canvas re-encode failed, shipping raw JPEG");
      return { blob: jpegBlob, ext: ".jpeg" };
    }
  } catch (swErr) {
    console.error("[imageProcessor] heic2any software decode failed:", swErr);
    throw new Error(
      "Cannot process this HEIC file. Neither the browser nor the software decoder could read it. The file may be corrupted or use an unsupported HEIC variant."
    );
  }
};
