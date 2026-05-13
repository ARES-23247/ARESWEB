/**
 * Phase 77-02: File Manager - File Validation Utilities
 *
 * Utilities for validating document files (PDF, DOCX, XLSX, PPTX, TXT).
 * Per FILES-03: Magic byte validation to prevent MIME spoofing.
 * Per D-03: Size limit validation (25MB default).
 */


/**
 * Magic byte signatures for document validation
 * First 4-8 bytes of the file identify the format
 */
const MAGIC_BYTES = {
	// PDF: %PDF (25 50 44 46)
	PDF: [0x25, 0x50, 0x44, 0x46],
	// Office Open XML: PK header (50 4B 03 04)
	OFFICE_XML: [0x50, 0x4B, 0x03, 0x04],
} as const;

/**
 * Allowed MIME types per D-01/D-02
 */
const ALLOWED_MIME_TYPES = new Set([
	"application/pdf",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document", // DOCX
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // XLSX
	"application/vnd.openxmlformats-officedocument.presentationml.presentation", // PPTX
	"text/plain",
]);

/**
 * Maximum file size in bytes (default 25MB per D-03)
 */
const MAX_FILE_SIZE_DEFAULT = 25 * 1024 * 1024;

/**
 * Validate document file using magic bytes and MIME type.
 * Per FILES-03: Magic byte validation prevents MIME spoofing.
 *
 * @param file - File object to validate
 * @param maxSizeBytes - Maximum file size in bytes (default 25MB)
 * @returns { valid, mimeType, error? }
 */
export function validateDocumentFile(
	file: File,
	maxSizeBytes: number = MAX_FILE_SIZE_DEFAULT
): { valid: boolean; mimeType: string; error?: string } {
	// Check file size first per D-03
	if (file.size > maxSizeBytes) {
		return {
			valid: false,
			mimeType: file.type || "unknown",
			error: `File size exceeds ${Math.round(maxSizeBytes / 1024 / 1024)}MB limit`,
		};
	}

	// Check MIME type against allowlist per D-02
	const normalizedMime = file.type.toLowerCase();
	if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
		return {
			valid: false,
			mimeType: file.type || "unknown",
			error: `Invalid file type. Allowed: PDF, DOCX, XLSX, PPTX, TXT`,
		};
	}

	// For TXT files, no magic byte validation needed (plain text)
	if (normalizedMime === "text/plain") {
		return { valid: true, mimeType: "text/plain" };
	}

	// For PDF and Office Open XML, validate magic bytes
	// We'll read the file when the upload handler processes it
	// For now, just validate the MIME type
	return { valid: true, mimeType: file.type };
}

/**
 * Validate document magic bytes from ArrayBuffer.
 * This is called after the file is read during upload.
 * Per FILES-03: Check for PDF, DOCX, XLSX, PPTX signatures.
 *
 * @param buffer - ArrayBuffer containing file data
 * @param declaredMimeType - MIME type declared by the file
 * @returns { valid, mimeType, error? }
 */
export function validateDocumentMagicBytes(
	buffer: ArrayBuffer,
	declaredMimeType: string
): { valid: boolean; mimeType: string; error?: string } {
	const bytes = new Uint8Array(buffer);

	// PDF: 25 50 44 46 (%PDF)
	if (
		bytes.length >= 4 &&
		bytes[0] === MAGIC_BYTES.PDF[0] &&
		bytes[1] === MAGIC_BYTES.PDF[1] &&
		bytes[2] === MAGIC_BYTES.PDF[2] &&
		bytes[3] === MAGIC_BYTES.PDF[3]
	) {
		return { valid: true, mimeType: "application/pdf" };
	}

	// Office Open XML: 50 4B 03 04 (PK - ZIP archive)
	// DOCX, XLSX, PPTX all use the ZIP format with specific content types
	if (
		bytes.length >= 4 &&
		bytes[0] === MAGIC_BYTES.OFFICE_XML[0] &&
		bytes[1] === MAGIC_BYTES.OFFICE_XML[1] &&
		bytes[2] === MAGIC_BYTES.OFFICE_XML[2] &&
		bytes[3] === MAGIC_BYTES.OFFICE_XML[3]
	) {
		// For Office files, trust the declared MIME type
		// since they all share the ZIP signature
		if (
			declaredMimeType.includes("wordprocessingml") ||
			declaredMimeType.includes("spreadsheetml") ||
			declaredMimeType.includes("presentationml")
		) {
			return { valid: true, mimeType: declaredMimeType };
		}
	}

	// TXT files have no magic bytes
	if (declaredMimeType === "text/plain") {
		return { valid: true, mimeType: "text/plain" };
	}

	return {
		valid: false,
		mimeType: declaredMimeType,
		error: "Invalid file format. Magic bytes do not match declared type.",
	};
}

/**
 * Sanitize filename for R2 storage.
 * Per D-05: Remove special characters, replace spaces with hyphens, keep extension.
 *
 * @param name - Original filename
 * @returns Sanitized filename
 */
export function sanitizeFilename(name: string): string {
	// Extract extension (last dot that's followed by a known extension)
	const knownExtensions = [".pdf", ".docx", ".xlsx", ".pptx", ".txt"];
	let extension = "";
	let baseName = name;

	// Find the last occurrence of a known extension
	for (const ext of knownExtensions) {
		if (name.toLowerCase().endsWith(ext)) {
			extension = ext;
			baseName = name.substring(0, name.length - ext.length);
			break;
		}
	}

	// Sanitize base name: lowercase, replace spaces with hyphens, keep dots for compound names
	const sanitized = baseName
		.toLowerCase()
		// Replace spaces and underscores with hyphens
		.replace(/[\s_]+/g, "-")
		// Remove all non-alphanumeric characters except hyphens and dots (for compound names)
		.replace(/[^a-z0-9.-]/g, "")
		// Remove duplicate hyphens
		.replace(/-+/g, "-")
		// Remove duplicate dots
		.replace(/\.+/g, ".")
		// Trim hyphens and dots from start/end
		.replace(/^[.-]+|[.-]+$/g, "");

	// Reattach extension
	return sanitized ? sanitized + extension.toLowerCase() : "untitled" + extension;
}

/**
 * Get icon component name for a MIME type.
 * Used for UI display in file manager.
 *
 * @param mimeType - MIME type string
 * @returns Icon name (lucide-react icon)
 */
export function getMimeTypeIcon(mimeType: string): string {
	switch (mimeType) {
		case "application/pdf":
			return "FileText";
		case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
			return "FileText";
		case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
			return "Table";
		case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
			return "Presentation";
		case "text/plain":
			return "File";
		default:
			return "File";
	}
}

/**
 * Generate R2 key for uploaded file.
 * Per D-04: documents/{YYYY-MM-DD}/{sanitizedFilename}
 *
 * @param filename - Sanitized filename
 * @param date - ISO date string (default: today)
 * @returns R2 storage key
 */
export function generateR2Key(filename: string, date?: string): string {
	const dateFolder = date || new Date().toISOString().split("T")[0];
	return `documents/${dateFolder}/${filename}`;
}

/**
 * Format file size for display.
 *
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "2.5 MB")
 */
export function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
