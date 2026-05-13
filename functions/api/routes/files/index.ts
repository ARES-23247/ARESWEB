/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Phase 77-02: File Manager - API Router
 *
 * File management endpoints for document uploads, downloads, and Drive imports.
 * Per FILES-01: Manual file upload with validation
 * Per FILES-02: Google Drive import
 * Per FILES-04: D1 metadata tracking with R2 storage
 * Per FILES-06: Authenticated download URLs
 * Per FILES-08: Usage tracking in blog posts
 */

import { OpenAPIHono } from "@hono/zod-openapi";
import { ApiError } from "../../middleware/errorHandler";
import {
	uploadFileRoute,
	listFilesRoute,
	downloadFileRoute,
	deleteFileRoute,
	importFromDriveRoute,
	scanUsageRoute,
} from "../../../../shared/routes/files";
import { AppEnv, ensureAdmin, getDb, logAuditAction } from "../../middleware";
import { getSessionUser } from "../../middleware/auth";
import { and, eq, desc, count } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import { randomUUID } from "crypto";
import {
	validateDocumentFile,
	validateDocumentMagicBytes,
	sanitizeFilename,
	generateR2Key,
} from "../../../utils/fileValidation";
import { requireAuth } from "../../middleware/auth";

export const filesRouter = new OpenAPIHono<AppEnv>();

// Protections
filesRouter.use("/*", ensureAdmin);
// Download endpoint requires auth but not admin
filesRouter.get("/download/*", async (c, next) => {
	await requireAuth(c);
	await next();
});

// Maximum file size: 25MB per D-03
const MAX_FILE_SIZE = 25 * 1024 * 1024;

/**
 * POST /upload - Upload document file
 * Validates file type and size, uploads to R2, creates D1 record
 */
const app1 = filesRouter.openapi(uploadFileRoute, async (c) => {
	const db = getDb(c);
	const formData = await c.req.parseBody();
	const file = formData["file"] as File | undefined;
	const title = formData["title"] as string | undefined;
	const description = formData["description"] as string | undefined;

	// Validate file exists
	if (!file || !(file instanceof File)) {
		throw new ApiError("No valid file uploaded", 400, "VALIDATION_ERROR");
	}

	// Validate file type and size
	const validation = validateDocumentFile(file, MAX_FILE_SIZE);
	if (!validation.valid) {
		throw new ApiError(validation.error || "Invalid file", 400, "VALIDATION_ERROR");
	}

	// Read file and validate magic bytes
	const buffer = await file.arrayBuffer();
	const magicByteValidation = validateDocumentMagicBytes(buffer, file.type);
	if (!magicByteValidation.valid) {
		throw new ApiError(magicByteValidation.error || "Invalid file format", 400, "VALIDATION_ERROR");
	}

	// Sanitize filename and generate R2 key
	const sanitizedFilename = sanitizeFilename(file.name);
	const r2Key = generateR2Key(sanitizedFilename);

	// Upload to R2
	if (c.env.ARES_STORAGE) {
		await c.env.ARES_STORAGE.put(r2Key, buffer, {
			httpMetadata: {
				contentType: file.type,
			},
		});
	}

	// Get authenticated user email
	const user = await getSessionUser(c);
	const cfEmail = user?.id || "unknown@example.com";

	// Create D1 record
	const fileId = randomUUID();
	const uploadedAt = new Date().toISOString();

	await db.insert(schema.uploadedFiles)
		.values({
			id: fileId,
			r2Key,
			filename: file.name,
			mimeType: file.type,
			size: file.size,
			title: title || null,
			description: description || null,
			uploadedBy: cfEmail,
			uploadedAt,
			source: "manual",
		} as any)
		.run();

	// Log audit action
	if (c.executionCtx) {
		c.executionCtx.waitUntil(logAuditAction(c, "file_upload", "file", fileId, `Uploaded ${file.name}`));
	}

	// Return uploaded file record
	const uploadedFile = {
		id: fileId,
		r2Key,
		filename: file.name,
		mimeType: file.type,
		size: file.size,
		title: title || null,
		description: description || null,
		uploadedBy: cfEmail,
		uploadedAt,
		source: "manual" as const,
		downloadUrl: `/api/files/download/${fileId}`,
		usageCount: 0,
	};

	return c.json(uploadedFile, 200);
});

/**
 * GET / - List uploaded files
 * Returns files with usage counts from file_usage table
 */
const app2 = app1.openapi(listFilesRoute, async (c) => {
	const db = getDb(c);
	const query = c.req.valid("query");

	// Build query with usage count
	const filesQuery = db
		.select({
			id: schema.uploadedFiles.id,
			r2Key: schema.uploadedFiles.r2Key,
			filename: schema.uploadedFiles.filename,
			mimeType: schema.uploadedFiles.mimeType,
			size: schema.uploadedFiles.size,
			title: schema.uploadedFiles.title,
			description: schema.uploadedFiles.description,
			uploadedBy: schema.uploadedFiles.uploadedBy,
			uploadedAt: schema.uploadedFiles.uploadedAt,
			source: schema.uploadedFiles.source,
			usageCount: count(schema.fileUsage.id),
		})
		.from(schema.uploadedFiles)
		.leftJoin(schema.fileUsage, eq(schema.uploadedFiles.id, schema.fileUsage.fileId))
		.groupBy(schema.uploadedFiles.id)
		.orderBy(desc(schema.uploadedFiles.uploadedAt));

	const rows = await filesQuery.execute();

	// Client-side filter for Phase 77 per D-18
	const filteredRows = query.search
		? rows.filter((row: any) => row.filename?.toLowerCase().includes(query.search!.toLowerCase()))
		: rows;

	// Transform rows to response format
	const files = filteredRows.map((row: any) => ({
		...row,
		downloadUrl: `/api/files/download/${row.id}`,
	}));

	// Client-side search filter per D-18
	let filteredFiles = files;
	if (query.search) {
		const searchLower = query.search.toLowerCase();
		filteredFiles = files.filter((f: any) => f.filename.toLowerCase().includes(searchLower));
	}

	return c.json({ files: filteredFiles } as any, 200);
});

/**
 * GET /download/:id - Download file
 * Requires authentication per D-24
 */
const app3 = app2.openapi(downloadFileRoute, async (c) => {
	const db = getDb(c);
	const { id } = c.req.valid("param");

	// Query file record
	const fileRecord = await db
		.select()
		.from(schema.uploadedFiles)
		.where(eq(schema.uploadedFiles.id, id))
		.get();

	if (!fileRecord) {
		throw new ApiError("File not found", 404, "NOT_FOUND");
	}

	// Fetch from R2
	if (!c.env.ARES_STORAGE) {
		throw new ApiError("Storage not available", 500, "INTERNAL_SERVER_ERROR");
	}

	const object = await c.env.ARES_STORAGE.get(fileRecord.r2Key);
	if (!object || !object.body) {
		throw new ApiError("File not found in storage", 404, "NOT_FOUND");
	}

	// Set headers for download
	const headers = new Headers();
	headers.set("Content-Type", fileRecord.mimeType);
	headers.set("Content-Disposition", `inline; filename="${fileRecord.filename}"`);
	headers.set("Cache-Control", "no-store, no-cache, must-revalidate");

	return new Response(object.body as unknown as BodyInit, { headers });
});

/**
 * DELETE /:id - Delete file
 * Deletes from R2 and D1
 */
const app4 = app3.openapi(deleteFileRoute, async (c) => {
	const db = getDb(c);
	const { id } = c.req.valid("param");

	// Query file record
	const fileRecord = await db
		.select()
		.from(schema.uploadedFiles)
		.where(eq(schema.uploadedFiles.id, id))
		.get();

	if (!fileRecord) {
		throw new ApiError("File not found", 404, "NOT_FOUND");
	}

	// Delete from R2
	if (c.env.ARES_STORAGE) {
		await c.env.ARES_STORAGE.delete(fileRecord.r2Key);
	}

	// Delete from D1 (cascade will delete file_usage records)
	await db.delete(schema.uploadedFiles).where(eq(schema.uploadedFiles.id, id)).run();

	// Log audit action
	if (c.executionCtx) {
		c.executionCtx.waitUntil(logAuditAction(c, "file_delete", "file", id, `Deleted ${fileRecord.filename}`));
	}

	return c.json({ success: true }, 200);
});

/**
 * POST /import-from-drive - Import file from Google Drive
 * Downloads from Drive API, validates, uploads to R2
 */
const app5 = app4.openapi(importFromDriveRoute, async (c) => {
	const db = getDb(c);
	const { fileId, fileName, mimeType } = c.req.valid("json");

	// Get Drive access token
	const { getUnifiedOAuthToken } = await import("../../../utils/googleAuth");
	const token = await getUnifiedOAuthToken(c.env, db);

	// Validate MIME type is allowed
	const allowedTypes = [
		"application/pdf",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		"application/vnd.openxmlformats-officedocument.presentationml.presentation",
		"text/plain",
	];

	// Map Google MIME types to standard MIME types
	const mimeTypeMap: Record<string, string> = {
		"application/vnd.google-apps.document": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"application/vnd.google-apps.spreadsheet": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		"application/vnd.google-apps.presentation": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	};

	const standardMimeType = mimeTypeMap[mimeType] || mimeType;
	if (!allowedTypes.includes(standardMimeType)) {
		throw new ApiError(`Invalid file type: ${mimeType}`, 400, "VALIDATION_ERROR");
	}

	// Download file from Drive API
	const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
	const response = await fetch(driveUrl, {
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});

	if (!response.ok) {
		throw new ApiError(`Failed to download from Drive: ${response.status}`, 500, "DRIVE_API_ERROR");
	}

	const buffer = await response.arrayBuffer();

	// Validate file size
	if (buffer.byteLength > MAX_FILE_SIZE) {
		throw new ApiError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`, 400, "VALIDATION_ERROR");
	}

	// For Google Workspace docs, we don't have magic bytes validation since Drive exports them
	// Skip magic byte validation for Google Workspace imports

	// Sanitize filename and generate R2 key
	const sanitizedFilename = sanitizeFilename(fileName);
	const r2Key = generateR2Key(sanitizedFilename);

	// Upload to R2
	if (c.env.ARES_STORAGE) {
		await c.env.ARES_STORAGE.put(r2Key, buffer, {
			httpMetadata: {
				contentType: standardMimeType,
			},
		});
	}

	// Get authenticated user email
	const user = await getSessionUser(c);
	const cfEmail = user?.id || "unknown@example.com";

	// Create D1 record
	const newFileId = randomUUID();
	const uploadedAt = new Date().toISOString();

	await db.insert(schema.uploadedFiles)
		.values({
			id: newFileId,
			r2Key,
			filename: fileName,
			mimeType: standardMimeType,
			size: buffer.byteLength,
			uploadedBy: cfEmail,
			uploadedAt,
			source: "google-drive",
		} as any)
		.run();

	// Log audit action
	if (c.executionCtx) {
		c.executionCtx.waitUntil(logAuditAction(c, "file_import_drive", "file", newFileId, `Imported ${fileName} from Drive`));
	}

	// Return uploaded file record
	const uploadedFile = {
		id: newFileId,
		r2Key,
		filename: fileName,
		mimeType: standardMimeType,
		size: buffer.byteLength,
		title: null,
		description: null,
		uploadedBy: cfEmail,
		uploadedAt,
		source: "google-drive" as const,
		downloadUrl: `/api/files/download/${newFileId}`,
		usageCount: 0,
	};

	return c.json(uploadedFile, 200);
});

/**
 * POST /scan-usage - Scan blog posts for file references
 * Finds /api/files/download/{id} patterns in post content
 */
const app6 = app5.openapi(scanUsageRoute, async (c) => {
	const db = getDb(c);

	// Query all published posts
	const posts = await db
		.select({
			slug: schema.posts.slug,
			title: schema.posts.title,
			contentDraft: schema.posts.contentDraft,
			ast: schema.posts.ast,
		})
		.from(schema.posts)
		.where(eq(schema.posts.isDeleted, 0))
		.execute();

	// Regex pattern to find file download URLs
	const fileUrlPattern = /\/api\/files\/download\/([a-f0-9-]{36})/gi;
	const updatedRecords: Array<{ fileId: string; postId: string; postTitle: string }> = [];

	// Scan each post
	for (const post of posts) {
		const content = post.contentDraft || post.ast || "";
		const matches = new Set<string>();

		// Find all file IDs in content
		let match;
		while ((match = fileUrlPattern.exec(content)) !== null) {
			matches.add(match[1]);
		}

		// Create/update file_usage records for each found file
		for (const fileId of matches) {
			updatedRecords.push({
				fileId,
				postId: post.slug,
				postTitle: post.title,
			});
		}
	}

	// Batch insert/update file_usage records
	let updatedCount = 0;
	for (const record of updatedRecords) {
		// Check if record exists
		const existing = await db
			.select()
			.from(schema.fileUsage)
			.where(and(eq(schema.fileUsage.fileId, record.fileId), eq(schema.fileUsage.postId, record.postId)))
			.get();

		if (!existing) {
			await db
				.insert(schema.fileUsage)
				.values({
					id: randomUUID(),
					fileId: record.fileId,
					postId: record.postId,
					postTitle: record.postTitle,
					linkedAt: new Date().toISOString(),
				} as any)
				.run();
			updatedCount++;
		}
	}

	return c.json({ scanned: posts.length, updated: updatedCount }, 200);
});

export default app6;
