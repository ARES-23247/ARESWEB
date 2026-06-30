/**
 * Next.js Image Import Pipeline Utilities
 * Handles magic bytes verification and album name path sanitization.
 */



/**
 * Validate image magic bytes and file size
 * Checks for JPG, PNG, WEBP, GIF, BMP, ICO, and SVG signatures. Size limit 50MB.
 */
export function validateImageMagicBytes(
  buffer: ArrayBuffer,
  maxSizeBytes: number = 50 * 1024 * 1024
): { valid: boolean; format: string; error?: string } {
  if (buffer.byteLength > maxSizeBytes) {
    return {
      valid: false,
      format: "unknown",
      error: `File size exceeds ${Math.round(maxSizeBytes / 1024 / 1024)}MB limit`,
    };
  }

  const bytes = new Uint8Array(buffer);

  // JPG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return { valid: true, format: "jpg" };
  }

  // PNG: 89 50 4E 47
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4E &&
    bytes[3] === 0x47
  ) {
    return { valid: true, format: "png" };
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
    return { valid: true, format: "webp" };
  }

  // GIF: 'G' 'I' 'F' (47 49 46)
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { valid: true, format: "gif" };
  }

  // BMP: 'B' 'M' (42 4D)
  if (bytes[0] === 0x42 && bytes[1] === 0x4D) {
    return { valid: true, format: "bmp" };
  }

  // ICO: 00 00 01 00
  if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
    return { valid: true, format: "ico" };
  }

  // SVG detection: check for XML/SVG tag signatures
  try {
    const textSample = new TextDecoder("utf-8").decode(bytes.slice(0, 1000)).trim().toLowerCase();
    if (
      textSample.includes("<svg") || 
      textSample.includes("xmlns=\"http://www.w3.org/2000/svg\"") || 
      textSample.includes("xmlns='http://www.w3.org/2000/svg'")
    ) {
      return { valid: true, format: "svg" };
    }
  } catch (e) {
    // Decoding failed, not a text SVG
  }

  return { valid: false, format: "unknown", error: "Invalid image format (must be JPG, PNG, WEBP, GIF, SVG, BMP, or ICO)" };
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
