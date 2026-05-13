import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GOOGLE DRIVE FILE SCHEMAS
 * ─────────────────────────────────────────────────────────────────────────────
 * Schemas for Google Drive file listing API.
 * Per D-03: Supported MIME types are Google Workspace only (Docs, Sheets, Slides, Drawings).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Individual Google Drive file schema
 * Represents file metadata from Google Drive API v3
 */
export const driveFileSchema = z.object({
  id: z.string().openapi({
    description: "Google Drive file ID",
    example: "1AbcDefGhiJklmnoPqrsTuvWxYz",
  }),
  name: z.string().openapi({
    description: "File name",
    example: "Team Meeting Notes",
  }),
  mimeType: z.string().openapi({
    description: "Google MIME type indicating file format",
    example: "application/vnd.google-apps.document",
  }),
  modifiedTime: z.string().datetime().openapi({
    description: "Last modification time (RFC 3339)",
    example: "2024-05-12T10:30:00.000Z",
  }),
  owner: z.string().optional().openapi({
    description: "File owner display name",
    example: "mentor@aresfirst.org",
  }),
  webViewLink: z.string().url().optional().openapi({
    description: "Link to open file in Google web interface",
    example: "https://docs.google.com/document/d/1AbcDef/edit",
  }),
});

/**
 * Document type enum for Google Workspace files
 * Per D-03: Only these four MIME types are supported in Phase 74
 */
export const documentTypeSchema = z.enum([
  "document",    // Google Docs
  "spreadsheet", // Google Sheets
  "presentation", // Google Slides
  "drawing",     // Google Drawings
]);

/**
 * Query parameters for listing Drive files
 * Per D-04: Search filters by name only, not content
 * Per D-12: Pagination with pageToken and pageSize (default 50)
 */
export const listDriveFilesQuerySchema = z.object({
  q: z.string().optional().openapi({
    description: "Search query - filters by file name contains (case-insensitive)",
    example: "meeting",
  }),
  pageToken: z.string().optional().openapi({
    description: "Pagination token from previous response's nextPageToken",
    example: "eyJNb2RpZmllZVRpbWUiOjE3MTU1MjAwMDAwMDAsIklkIjoiMTIzNDU2Nzg5MCJ9",
  }),
  pageSize: z.coerce.number().min(1).max(100).default(50).optional().openapi({
    description: "Number of files to return per page (1-100, default 50)",
    example: 50,
  }),
});

/**
 * Response schema for Drive files listing
 * Contains array of files and optional pagination token
 */
export const listDriveFilesResponseSchema = z.object({
  files: z.array(driveFileSchema).openapi({
    description: "Array of Google Workspace documents matching the query",
  }),
  nextPageToken: z.string().optional().openapi({
    description: "Token for next page of results, if more files exist",
    example: "eyJNb2RpZmllZFRpbWUiOjE3MTU1MjAwMDAwMDAsIklkIjoiMTIzNDU2Nzg5MCJ9",
  }),
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GOOGLE DRIVE API ROUTES
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * GET /files - List Google Drive files
 * Returns Google Workspace documents from the configured folder.
 * Supports name search, pagination, and MIME type filtering (server-side).
 */
export const listDriveFilesRoute = createRoute({
  method: "get",
  path: "/files",
  request: {
    query: listDriveFilesQuerySchema,
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: listDriveFilesResponseSchema,
        },
      },
      description: "List of Google Workspace documents from the configured folder",
    },
  },
  tags: ["google-drive", "admin"],
});
