/**
 * Image import pipeline utilities.
 * Handles magic-byte verification and album-name path sanitization.
 */



/**
 * Validate image magic bytes and file size. Callers must provide the narrowest
 * format allowlist appropriate to the upload destination.
 */
export function validateImageMagicBytes(
  buffer: ArrayBuffer,
  maxSizeBytes: number = 8 * 1024 * 1024,
  allowedFormats: readonly string[] = ["jpg", "png", "webp"],
): { valid: boolean; format: string; error?: string } {
  if (buffer.byteLength > maxSizeBytes) {
    return {
      valid: false,
      format: "unknown",
      error: `File size exceeds ${Math.round(maxSizeBytes / 1024 / 1024)}MB limit`,
    };
  }

  const bytes = new Uint8Array(buffer);

  const accepts = (format: string) => allowedFormats.includes(format);

  // JPG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return accepts("jpg") ? { valid: true, format: "jpg" } : { valid: false, format: "jpg", error: "Image format is not allowed" };
  }

  // PNG: 89 50 4E 47
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4E &&
    bytes[3] === 0x47
  ) {
    return accepts("png") ? { valid: true, format: "png" } : { valid: false, format: "png", error: "Image format is not allowed" };
  }

  // WEBP: RIFF...WEBP
  if (
    bytes[0] === 0x52 && // 'R'
    bytes[1] === 0x49 && // 'I'
    bytes[2] === 0x46 && // 'F'
    bytes[3] === 0x46 && // 'F'
    bytes[8] === 0x57 && // 'W'
    bytes[9] === 0x45 && // 'E'
    bytes[10] === 0x42 && // 'B'
    bytes[11] === 0x50 // 'P'
  ) {
    return accepts("webp") ? { valid: true, format: "webp" } : { valid: false, format: "webp", error: "Image format is not allowed" };
  }

  return { valid: false, format: "unknown", error: "Invalid image format (must be JPG, PNG, or WEBP)" };
}

/**
 * Sanitize album name for folder storage path
 */
export function sanitizeAlbumName(name: string): string {
  let clean = "";
  let lastWasDash = false;
  const chars = name.toLowerCase().split("");
  for (const char of chars) {
    if ((char >= "a" && char <= "z") || (char >= "0" && char <= "9")) {
      clean += char;
      lastWasDash = false;
    } else if (char === " " || char === "_" || char === "-") {
      if (!lastWasDash && clean.length > 0) {
        clean += "-";
        lastWasDash = true;
      }
    }
  }
  if (clean.endsWith("-")) {
    clean = clean.slice(0, -1);
  }
  return clean;
}
