// Media Handler Utilities
/**
 * Media Handler Utilities
 *
 * This file exports utility functions used by media route handlers.
 * The main route handlers are defined inline in index.ts using createTypedHandler
 * for proper TypeScript type inference with zod schemas.
 */

import type { R2Object, R2ListOptions } from "@cloudflare/workers-types";
import type { R2Bucket } from "@cloudflare/workers-types";

// Maximum file size: 10MB
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
// Maximum file size for AI processing: 2.5MB
export const MAX_FILE_SIZE_FOR_AI = 2.5 * 1024 * 1024;

// IN-11: File extension mapping for validation and normalization
// Maps MIME types to their canonical file extensions
export const MIME_TO_EXTENSION: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

/**
 * Get the canonical file extension for a given MIME type.
 * Returns null if the MIME type is not supported.
 */
export function getExtensionForMimeType(mimeType: string): string | null {
  return MIME_TO_EXTENSION[mimeType.toLowerCase()] || null;
}

/**
 * Normalize a filename by ensuring it has the correct extension for its MIME type.
 * If the filename already ends with the correct extension (case-insensitive), it's returned as-is.
 * Otherwise, the correct extension is appended.
 */
export function normalizeFileNameExtension(fileName: string, mimeType: string): string {
  const correctExt = getExtensionForMimeType(mimeType);
  if (!correctExt) return fileName;

  // Check if filename already ends with the correct extension (case-insensitive)
  if (fileName.toLowerCase().endsWith(correctExt.toLowerCase())) {
    return fileName;
  }

  // Remove any existing extension and add the correct one
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex > 0) {
    return fileName.substring(0, lastDotIndex) + correctExt;
  }

  return fileName + correctExt;
}

/**
 * Validates whether the given buffer contains a valid image file.
 * Checks magic bytes for PNG, JPEG, GIF, WEBP, SVG, and HEIC formats.
 * @param buffer - ArrayBuffer containing the file data
 * @returns true if the buffer starts with valid image magic bytes
 */
export function isValidImage(buffer: ArrayBuffer): boolean {
  const arr = new Uint8Array(buffer);

  if (arr.length >= 8) {
    const header8 = Array.from(arr.subarray(0, 8)).map((b: number) => b.toString(16).padStart(2, '0')).join('').toLowerCase();
    if (header8 === '89504e470d0a1a0a') return true; // PNG
  }

  if (arr.length >= 4) {
    const header4 = Array.from(arr.subarray(0, 4)).map((b: number) => b.toString(16).padStart(2, '0')).join('').toLowerCase();
    if (header4.startsWith('ffd8ff') || header4 === 'ffd8ffe0' || header4 === 'ffd8ffe1') return true; // JPEG
    if (header4.startsWith('47494638')) return true; // GIF
    if (header4 === '52494646') return true; // WEBP
    if (header4 === '3c3f786d' || header4 === '3c737667') return true; // SVG (<?xm or <svg)
  }

  // HEIC/HEIF usually have 'ftyp' at offset 4, but let's check first 16 bytes for 'ftypheic' or similar
  const checkLen = Math.min(arr.length, 16);
  if (checkLen >= 8) {
    const longerHeader = Array.from(arr.subarray(0, checkLen)).map((b: number) => b.toString(16).padStart(2, '0')).join('').toLowerCase();
    if (longerHeader.includes('66747970')) return true; // 'ftyp'
  }

  // Fallback for SVGs that might have leading whitespace or comments
  const text = new TextDecoder("utf-8").decode(arr.subarray(0, 100));
  if (text.includes("<svg") || text.includes("<?xml")) return true;

  return false;
}

// ── Type Definitions ───────────────────────────────────────────────────────

export interface MediaTagRow {
  key: string;
  folder: string | null;
  tags: string | null;
}

export interface ListAllObjectsResult {
  objects: R2Object[];
}

/**
 * Lists all objects from an R2 bucket, handling pagination automatically.
 * @param bucket - The R2 bucket to list objects from
 * @param options - Optional R2 list options
 * @returns A promise resolving to an array of R2 objects
 */
export async function listAllObjects(bucket: R2Bucket | undefined, options?: R2ListOptions): Promise<ListAllObjectsResult> {
  if (!bucket) {
    console.warn("[media/handlers.ts] R2Bucket not bound! Returning empty list.");
    return { objects: [] };
  }
  let result = await bucket.list({ ...options, limit: 100 });
  const objects = [...result.objects];
  while (result.truncated) {
    result = await bucket.list({ ...options, cursor: result.cursor, limit: 100 });
    objects.push(...result.objects);
  }
  return { objects };
}




