"use strict";
/**
 * Next.js Image Import Pipeline Utilities
 * Handles magic bytes verification and album name path sanitization.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateImageMagicBytes = validateImageMagicBytes;
exports.sanitizeAlbumName = sanitizeAlbumName;
const MAGIC_BYTES = {
    JPG: [0xFF, 0xD8, 0xFF],
    PNG: [0x89, 0x50, 0x4E, 0x47],
    WEBP: [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
};
/**
 * Validate image magic bytes and file size
 * Checks for JPG, PNG, WEBP signatures. Size limit 50MB.
 */
function validateImageMagicBytes(buffer, maxSizeBytes = 50 * 1024 * 1024) {
    if (buffer.byteLength > maxSizeBytes) {
        return {
            valid: false,
            format: "unknown",
            error: `File size exceeds ${Math.round(maxSizeBytes / 1024 / 1024)}MB limit`,
        };
    }
    const bytes = new Uint8Array(buffer);
    // JPG: FF D8 FF
    if (bytes[0] === MAGIC_BYTES.JPG[0] && bytes[1] === MAGIC_BYTES.JPG[1] && bytes[2] === MAGIC_BYTES.JPG[2]) {
        return { valid: true, format: "jpg" };
    }
    // PNG: 89 50 4E 47
    if (bytes[0] === MAGIC_BYTES.PNG[0] &&
        bytes[1] === MAGIC_BYTES.PNG[1] &&
        bytes[2] === MAGIC_BYTES.PNG[2] &&
        bytes[3] === MAGIC_BYTES.PNG[3]) {
        return { valid: true, format: "png" };
    }
    // WEBP: RIFF...WEBP
    if (bytes[0] === MAGIC_BYTES.WEBP[0] &&
        bytes[1] === MAGIC_BYTES.WEBP[1] &&
        bytes[2] === MAGIC_BYTES.WEBP[2] &&
        bytes[3] === MAGIC_BYTES.WEBP[3] &&
        bytes[8] === MAGIC_BYTES.WEBP[8] &&
        bytes[9] === MAGIC_BYTES.WEBP[9] &&
        bytes[10] === MAGIC_BYTES.WEBP[10] &&
        bytes[11] === MAGIC_BYTES.WEBP[11]) {
        return { valid: true, format: "webp" };
    }
    return { valid: false, format: "unknown", error: "Invalid image format (must be JPG, PNG, or WEBP)" };
}
/**
 * Sanitize album name for folder storage path
 */
function sanitizeAlbumName(name) {
    return name
        .toLowerCase()
        .replace(/[\s_]+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
}
//# sourceMappingURL=imageImport.js.map