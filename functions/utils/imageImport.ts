/**
 * Phase 76-02: Image Import Pipeline - Import Utilities
 *
 * Utilities for importing photos from Google Photos to R2 storage.
 * Per IMG-03/IMG-04: Validates magic bytes, downloads from Photos API, uploads to R2.
 * Per D-06: Sequential processing to avoid memory overflow.
 */

import { ApiError } from "../api/middleware/errorHandler";

/**
 * Magic byte signatures for image validation per IMG-04
 * First 4-12 bytes of the file identify the format
 */
const MAGIC_BYTES = {
  JPG: [0xFF, 0xD8, 0xFF],
  PNG: [0x89, 0x50, 0x4E, 0x47],
  WEBP: [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
} as const;

/**
 * Validate image magic bytes and file size
 * Per IMG-04: Check for JPG, PNG, WEBP signatures
 * Per D-08: Size limit 50MB (configurable via env var)
 *
 * @param buffer - ArrayBuffer containing image data
 * @param maxSizeBytes - Maximum file size in bytes (default 50MB)
 * @returns { valid, format, error? }
 */
export function validateImageMagicBytes(
  buffer: ArrayBuffer,
  maxSizeBytes: number = 50 * 1024 * 1024
): { valid: boolean; format: string; error?: string } {
  // Check file size first per D-08
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
  if (
    bytes[0] === MAGIC_BYTES.PNG[0] &&
    bytes[1] === MAGIC_BYTES.PNG[1] &&
    bytes[2] === MAGIC_BYTES.PNG[2] &&
    bytes[3] === MAGIC_BYTES.PNG[3]
  ) {
    return { valid: true, format: "png" };
  }

  // WEBP: RIFF...WEBP
  if (
    bytes[0] === MAGIC_BYTES.WEBP[0] &&
    bytes[1] === MAGIC_BYTES.WEBP[1] &&
    bytes[2] === MAGIC_BYTES.WEBP[2] &&
    bytes[3] === MAGIC_BYTES.WEBP[3] &&
    bytes[8] === MAGIC_BYTES.WEBP[8] &&
    bytes[9] === MAGIC_BYTES.WEBP[9] &&
    bytes[10] === MAGIC_BYTES.WEBP[10] &&
    bytes[11] === MAGIC_BYTES.WEBP[11]
  ) {
    return { valid: true, format: "webp" };
  }

  return { valid: false, format: "unknown", error: "Invalid image format (not JPG, PNG, or WEBP)" };
}

/**
 * Download photo from Google Photos API
 * Per D-04: Use =d suffix for full resolution download
 * Per D-05: Server-side download to avoid CORS and bandwidth issues
 *
 * @param baseUrl - Base URL from Google Photos media item
 * @param token - OAuth access token
 * @returns ArrayBuffer containing image data
 * @throws ApiError if download fails
 */
export async function downloadPhoto(baseUrl: string, token: string): Promise<ArrayBuffer> {
  // Per D-04: Append =d for full resolution download
  const downloadUrl = `${baseUrl}=d`;

  const response = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new ApiError(
      `Failed to download photo: ${response.status} ${response.statusText}`,
      response.status,
      "DOWNLOAD_FAILED"
    );
  }

  return response.arrayBuffer();
}

/**
 * Upload photo to R2 storage
 * Per D-10: Import without album -> photos/imported/{YYYY-MM-DD}/{filename}
 * Per D-11: Import with album -> photos/albums/{sanitizedName}/{filename}
 *
 * @param buffer - Image data buffer
 * @param filename - Original filename
 * @param mimeType - MIME type for content header
 * @param albumName - Optional album name for folder structure
 * @param env - Cloudflare environment with ARES_STORAGE binding
 * @param date - ISO date string for folder naming (default: today)
 * @returns R2 storage key
 */
export async function uploadToR2(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string,
  albumName: string | null,
  env: { ARES_STORAGE: R2Bucket },
  date: string = new Date().toISOString().split("T")[0]
): Promise<string> {
  let r2Key: string;

  if (albumName) {
    // Per D-11: Album folder structure
    const sanitizedFolder = sanitizeAlbumName(albumName);
    r2Key = `photos/albums/${sanitizedFolder}/${filename}`;
  } else {
    // Per D-10: Date-based folder structure
    r2Key = `photos/imported/${date}/${filename}`;
  }

  await env.ARES_STORAGE.put(r2Key, buffer, {
    httpMetadata: {
      contentType: mimeType,
    },
  });

  return r2Key;
}

/**
 * Sanitize album name for R2 folder path
 * Per D-12: Lowercase, hyphens for spaces, remove special chars
 *
 * @param name - Original album name
 * @returns Sanitized folder name
 */
export function sanitizeAlbumName(name: string): string {
  return name
    .toLowerCase()
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, "-")
    // Remove all non-alphanumeric characters except hyphens
    .replace(/[^a-z0-9-]/g, "")
    // Remove duplicate hyphens
    .replace(/-+/g, "-")
    // Trim hyphens from start/end
    .replace(/^-+|-+$/g, "");
}
