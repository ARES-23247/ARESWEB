import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GOOGLE PHOTOS MEDIA SCHEMAS
 * ─────────────────────────────────────────────────────────────────────────────
 * Schemas for Google Photos Library API media items and albums.
 * Per PHOTO-02: Only image types (no video/* MIME types).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Individual Google Photos media item schema (photo only, per PHOTO-02)
 * Represents a photo from Google Photos Library API
 */
export const photoMediaItemSchema = z.object({
  id: z.string().openapi({
    description: "Google Photos media item ID",
    example: "AKcabcdefM123456789_-abcdef",
  }),
  filename: z.string().openapi({
    description: "Original filename",
    example: "IMG_20240115_103000.jpg",
  }),
  mimeType: z.string().openapi({
    description: "MIME type (images only, no videos per PHOTO-02)",
    example: "image/jpeg",
  }),
  baseUrl: z.string().url().openapi({
    description: "Base URL for photo access (use =w200-h200 for 200x200px thumbnails per D-04)",
    example: "https://lh3.googleusercontent.com/pw/AJFCJaUabc123=w200-h200",
  }),
  width: z.string().optional().openapi({
    description: "Image width in pixels",
    example: "3024",
  }),
  height: z.string().optional().openapi({
    description: "Image height in pixels",
    example: "4032",
  }),
  creationTime: z.string().datetime().optional().openapi({
    description: "Photo creation time (ISO 8601)",
    example: "2024-01-15T10:30:00Z",
  }),
  description: z.string().optional().openapi({
    description: "User-provided description",
    example: "Team photo from competition",
  }),
});

/**
 * Google Photos album schema
 * Represents an album from Google Photos Library API
 */
export const photoAlbumSchema = z.object({
  id: z.string().openapi({
    description: "Album ID",
    example: "AKcabcdefGhiJklmnoPqrsTuvWxYz",
  }),
  title: z.string().openapi({
    description: "Album title",
    example: "FTC Championship 2024",
  }),
  mediaItemsCount: z.string().optional().openapi({
    description: "Number of items in album",
    example: "42",
  }),
  coverPhotoBaseUrl: z.string().url().optional().openapi({
    description: "Cover photo URL (use =w200-h200 for 200x200px thumbnail)",
    example: "https://lh3.googleusercontent.com/pw/AJFCJaUxyz789=w200-h200",
  }),
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GOOGLE PHOTOS API QUERY PARAMETERS
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Query parameters for listing media items
 * Per D-06: Page size 25 with pageToken pagination
 * Per D-10: Album filtering via albumId
 */
export const listMediaQuerySchema = z.object({
  albumId: z.string().optional().openapi({
    description: "Filter by album ID per D-10",
    example: "AKcabcdefGhiJklmnoPqrsTuvWxYz",
  }),
  pageToken: z.string().optional().openapi({
    description: "Pagination token from Photos API",
    example: "eyJCaGFjazpEZXNjcmlwdGlvbiI6IjE3MTU1MjAwMDAwMDAifQ",
  }),
  pageSize: z.coerce.number().min(1).max(50).default(25).optional().openapi({
    description: "Items per page (1-50, default 25 per D-06)",
    example: 25,
  }),
});

/**
 * Query parameters for listing albums
 * Per D-06: Page size 25 with pageToken pagination
 */
export const listAlbumsQuerySchema = z.object({
  pageToken: z.string().optional().openapi({
    description: "Pagination token from Photos API",
    example: "eyJMb2NhdGlvbjpQbGFjZUlkIjoiMTIzNDU2Nzg5MCJ9",
  }),
  pageSize: z.coerce.number().min(1).max(50).default(25).optional().openapi({
    description: "Albums per page (1-50, default 25)",
    example: 25,
  }),
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GOOGLE PHOTOS API RESPONSE SCHEMAS
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Response schema for media items listing
 * Contains array of photo items and optional pagination token
 */
export const listMediaResponseSchema = z.object({
  mediaItems: z.array(photoMediaItemSchema).openapi({
    description: "Array of Google Photos media items (photos only per PHOTO-02)",
  }),
  nextPageToken: z.string().optional().openapi({
    description: "Token for next page of results, if more items exist",
    example: "eyJDb2xsZWN0aW9uSWQiOiIxMjM0NTY3ODkwIn0",
  }),
});

/**
 * Response schema for albums listing
 * Contains array of albums and optional pagination token
 */
export const listAlbumsResponseSchema = z.object({
  albums: z.array(photoAlbumSchema).openapi({
    description: "Array of Google Photos albums",
  }),
  nextPageToken: z.string().optional().openapi({
    description: "Token for next page of results, if more albums exist",
    example: "eyJQbGFjZUlkIjoiMTIzNDU2Nzg5MCJ9",
  }),
});

/**
 * Upload failure detail schema
 * Represents a single file upload failure per D-21/D-22
 */
export const uploadFailureSchema = z.object({
  filename: z.string().openapi({
    description: "Name of the file that failed to upload",
    example: "large-photo.jpg",
  }),
  error: z.string().openapi({
    description: "Error message describing why the upload failed",
    example: "File size exceeds 50MB limit",
  }),
});

/**
 * Response schema for photo upload
 * Per UPLOAD-01, UPLOAD-03: Returns success count and per-file failures
 */
export const uploadPhotosResponseSchema = z.object({
  uploadedCount: z.number().openapi({
    description: "Number of photos successfully uploaded",
    example: 3,
  }),
  failures: z.array(uploadFailureSchema).optional().openapi({
    description: "Upload failures per file (D-21/D-22)",
  }),
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GOOGLE PHOTOS API ROUTES
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * GET /media - List Google Photos media items
 * Returns photos only (no videos per PHOTO-02) from Google Photos Library API.
 * Supports album filtering, pagination, and server-side MIME type filtering.
 */
export const listMediaRoute = createRoute({
  method: "get",
  path: "/media",
  request: {
    query: listMediaQuerySchema,
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: listMediaResponseSchema,
        },
      },
      description: "List of Google Photos media items (photos only)",
    },
  },
  tags: ["google-photos", "admin"],
});

/**
 * GET /albums - List Google Photos albums
 * Returns albums from Google Photos Library API with cover photos and item counts.
 * Supports pagination for large album collections.
 */
export const listAlbumsRoute = createRoute({
  method: "get",
  path: "/albums",
  request: {
    query: listAlbumsQuerySchema,
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: listAlbumsResponseSchema,
        },
      },
      description: "List of Google Photos albums",
    },
  },
  tags: ["google-photos", "admin"],
});

/**
 * POST /upload - Upload photos to Google Photos
 * Accepts multiple image files with metadata and uploads to Google Photos.
 * Per UPLOAD-01, UPLOAD-03: Uses mediaItems:batchCreate endpoint.
 * Per D-11: Accepts JPG, PNG, WEBP, GIF, HEIC image files.
 * Per D-12: Includes title, description, albumId metadata.
 *
 * Note: This endpoint uses multipart/form-data for file uploads.
 * The request body schema is documented for reference but actual
 * parsing is handled by the multipart/form-data handler.
 */
export const uploadPhotosRoute = createRoute({
  method: "post",
  path: "/upload",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: uploadPhotosResponseSchema,
        },
      },
      description: "Upload completed with success count and per-file failures",
    },
  },
  tags: ["google-photos", "admin"],
});
