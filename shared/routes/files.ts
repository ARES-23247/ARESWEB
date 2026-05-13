/**
 * Phase 77: File Manager - OpenAPI Route Contracts
 *
 * Type-safe route contracts for document file management endpoints.
 * Per D-01/D-02: Supported formats are PDF, DOCX, XLSX, PPTX, TXT
 * Per D-03: Size limit 25MB (configurable via MAX_FILE_SIZE_MB)
 * Per D-04/D-05: R2 storage at documents/{YYYY-MM-DD}/{sanitizedFilename}
 */

import { z } from "@hono/zod-openapi";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

/**
 * Allowed MIME types for document uploads
 * Per D-01: PDF, DOCX, XLSX, PPTX, TXT
 */
export const ALLOWED_MIME_TYPES = [
	"application/pdf",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"text/plain",
] as const;

/**
 * Uploaded file schema
 * Represents a file record stored in D1 and R2
 */
export const uploadedFileSchema = z.object({
	id: z.string().uuid().openapi({
		description: "Unique file ID (UUID) for public URL generation",
		example: "550e8400-e29b-41d4-a716-446655440000",
	}),
	r2Key: z.string().openapi({
		description: "R2 storage key",
		example: "documents/2026-05-13/team-handbook.pdf",
	}),
	filename: z.string().openapi({
		description: "Original filename",
		example: "Team Handbook 2026.pdf",
	}),
	mimeType: z.string().openapi({
		description: "Validated MIME type",
		example: "application/pdf",
	}),
	size: z.number().openapi({
		description: "File size in bytes",
		example: 2458624,
	}),
	title: z.string().nullable().optional().openapi({
		description: "Optional title override",
		example: "Team Handbook",
	}),
	description: z.string().nullable().optional().openapi({
		description: "Optional file description",
		example: "Official team handbook for the 2026 season",
	}),
	uploadedBy: z.string().openapi({
		description: "Email of user who uploaded the file",
		example: "mentor@aresfirst.org",
	}),
	uploadedAt: z.string().datetime().openapi({
		description: "Upload timestamp",
		example: "2026-05-13T10:30:00.000Z",
	}),
	source: z.enum(["manual", "google-drive"]).openapi({
		description: "Upload source",
		example: "manual",
	}),
	downloadUrl: z.string().url().openapi({
		description: "Public download URL",
		example: "/api/files/download/550e8400-e29b-41d4-a716-446655440000",
	}),
	usageCount: z.number().openapi({
		description: "Number of blog posts using this file",
		example: 3,
	}),
});

/**
 * Upload file request schema
 */
export const uploadFileSchema = z.object({
	file: z.any().openapi({
		type: "string",
		format: "binary",
		description: "File to upload (PDF, DOCX, XLSX, PPTX, TXT, max 25MB)",
	}),
	title: z.string().optional().openapi({
		description: "Optional title override",
	}),
	description: z.string().optional().openapi({
		description: "Optional file description",
	}),
});

/**
 * List files query schema
 */
export const listFilesQuerySchema = z.object({
	search: z.string().optional().openapi({
		description: "Filter files by filename (contains)",
	}),
});

/**
 * Import from Drive request schema
 */
export const importFromDriveSchema = z.object({
	fileId: z.string().openapi({
		description: "Google Drive file ID",
		example: "1AbCdEfGhIjKlMnOpQrStUvWxYz",
	}),
	fileName: z.string().openapi({
		description: "Filename from Drive",
		example: "Technical Drawings.pdf",
	}),
	mimeType: z.string().openapi({
		description: "MIME type from Drive",
		example: "application/pdf",
	}),
});

/**
 * Scan usage response schema
 */
export const scanUsageResponseSchema = z.object({
	scanned: z.number().openapi({
		description: "Number of posts scanned",
		example: 42,
	}),
	updated: z.number().openapi({
		description: "Number of usage records created/updated",
		example: 15,
	}),
});

/**
 * Upload file route
 * POST /api/files/upload
 */
export const uploadFileRoute = createRoute({
	method: "post",
	path: "/upload",
	request: {
		body: {
			content: {
				"multipart/form-data": {
					schema: uploadFileSchema,
				},
			},
		},
	},
	responses: {
		...standardErrors,
		200: {
			content: {
				"application/json": {
					schema: uploadedFileSchema,
				},
			},
			description: "File uploaded successfully",
		},
	},
	tags: ["files", "admin"],
});

/**
 * List files route
 * GET /api/files
 */
export const listFilesRoute = createRoute({
	method: "get",
	path: "/",
	request: {
		query: listFilesQuerySchema,
	},
	responses: {
		...standardErrors,
		200: {
			content: {
				"application/json": {
					schema: z.object({
						files: z.array(uploadedFileSchema),
					}),
				},
			},
			description: "List of uploaded files",
		},
	},
	tags: ["files", "admin"],
});

/**
 * Download file route
 * GET /api/files/download/:id
 */
export const downloadFileRoute = createRoute({
	method: "get",
	path: "/download/{id}",
	request: {
		params: z.object({
			id: z.string().uuid().openapi({
				description: "File ID (UUID)",
				example: "550e8400-e29b-41d4-a716-446655440000",
			}),
		}),
	},
	responses: {
		...standardErrors,
		200: {
			content: {
				"application/octet-stream": {
					schema: z.any(),
				},
			},
			description: "File binary data",
		},
		404: standardErrors[404],
	},
	tags: ["files"],
});

/**
 * Delete file route
 * DELETE /api/files/:id
 */
export const deleteFileRoute = createRoute({
	method: "delete",
	path: "/{id}",
	request: {
		params: z.object({
			id: z.string().uuid().openapi({
				description: "File ID (UUID)",
				example: "550e8400-e29b-41d4-a716-446655440000",
			}),
		}),
	},
	responses: {
		...standardErrors,
		200: {
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
					}),
				},
			},
			description: "File deleted successfully",
		},
		404: standardErrors[404],
	},
	tags: ["files", "admin"],
});

/**
 * Import from Drive route
 * POST /api/files/import-from-drive
 */
export const importFromDriveRoute = createRoute({
	method: "post",
	path: "/import-from-drive",
	request: {
		body: {
			content: {
				"application/json": {
					schema: importFromDriveSchema,
				},
			},
		},
	},
	responses: {
		...standardErrors,
		200: {
			content: {
				"application/json": {
					schema: uploadedFileSchema,
				},
			},
			description: "File imported from Google Drive",
		},
	},
	tags: ["files", "admin"],
});

/**
 * Scan usage route
 * POST /api/files/scan-usage
 */
export const scanUsageRoute = createRoute({
	method: "post",
	path: "/scan-usage",
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({}),
				},
			},
		},
	},
	responses: {
		...standardErrors,
		200: {
			content: {
				"application/json": {
					schema: scanUsageResponseSchema,
				},
			},
			description: "Usage scan completed",
		},
	},
	tags: ["files", "admin"],
});

/**
 * Export all routes
 */
export const filesRoutes = {
	uploadFileRoute,
	listFilesRoute,
	downloadFileRoute,
	deleteFileRoute,
	importFromDriveRoute,
	scanUsageRoute,
} as const;
