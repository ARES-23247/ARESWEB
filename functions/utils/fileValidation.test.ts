/**
 * Phase 77-02: File Manager - TDD Tests
 *
 * RED Phase: Failing tests for file validation utilities
 * These tests verify:
 * - Magic byte validation for PDF, DOCX, XLSX, PPTX, TXT
 * - File size limit validation
 * - Filename sanitization
 * - MIME type icon mapping
 */

import { describe, it, expect } from "vitest";

describe("fileValidation utilities", () => {
	describe("validateDocumentFile", () => {
		it("Test 1: returns {valid:true, mimeType:'application/pdf'} for PDF MIME type", async () => {
			const { validateDocumentFile } = await import("./fileValidation");
			const file = new File(["%PDF-"], "test.pdf", { type: "application/pdf" });
			const result = validateDocumentFile(file, 25 * 1024 * 1024);
			expect(result.valid).toBe(true);
			expect(result.mimeType).toBe("application/pdf");
		});

		it("Test 2: returns {valid:true, mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'} for DOCX", async () => {
			const { validateDocumentFile } = await import("./fileValidation");
			const file = new File(["PK"], "test.docx", {
				type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			});
			const result = validateDocumentFile(file, 25 * 1024 * 1024);
			expect(result.valid).toBe(true);
			expect(result.mimeType).toContain("wordprocessingml");
		});

		it("Test 3: returns {valid:true, mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'} for XLSX", async () => {
			const { validateDocumentFile } = await import("./fileValidation");
			const file = new File(["PK"], "test.xlsx", {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			});
			const result = validateDocumentFile(file, 25 * 1024 * 1024);
			expect(result.valid).toBe(true);
			expect(result.mimeType).toContain("spreadsheetml");
		});

		it("Test 4: returns {valid:true, mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation'} for PPTX", async () => {
			const { validateDocumentFile } = await import("./fileValidation");
			const file = new File(["PK"], "test.pptx", {
				type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
			});
			const result = validateDocumentFile(file, 25 * 1024 * 1024);
			expect(result.valid).toBe(true);
			expect(result.mimeType).toContain("presentationml");
		});

		it("Test 5: returns {valid:true, mimeType:'text/plain'} for TXT files", async () => {
			const { validateDocumentFile } = await import("./fileValidation");
			const file = new File(["plain text"], "test.txt", { type: "text/plain" });
			const result = validateDocumentFile(file, 25 * 1024 * 1024);
			expect(result.valid).toBe(true);
			expect(result.mimeType).toBe("text/plain");
		});

		it("Test 6: returns {valid:false, error:'invalid_type'} for disallowed MIME types", async () => {
			const { validateDocumentFile } = await import("./fileValidation");
			const file = new File(["xyz"], "test.jpg", { type: "image/jpeg" });
			const result = validateDocumentFile(file, 25 * 1024 * 1024);
			expect(result.valid).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error).toContain("Invalid file type");
		});

		it("Test 7: returns {valid:false, error:'file_too_large'} when size exceeds MAX_FILE_SIZE_MB", async () => {
			const { validateDocumentFile } = await import("./fileValidation");
			const largeContent = new Array(26 * 1024 * 1024).fill("x").join("");
			const file = new File([largeContent], "large.pdf", { type: "application/pdf" });
			const result = validateDocumentFile(file, 25 * 1024 * 1024);
			expect(result.valid).toBe(false);
			expect(result.error).toContain("exceeds");
		});

		it("Test 8: accepts file at exactly the size limit", async () => {
			const { validateDocumentFile } = await import("./fileValidation");
			const limitContent = new Array(25 * 1024 * 1024).fill("x").join("");
			const file = new File([limitContent], "limit.pdf", { type: "application/pdf" });
			const result = validateDocumentFile(file, 25 * 1024 * 1024);
			expect(result.valid).toBe(true);
		});
	});

	describe("validateDocumentMagicBytes", () => {
		it("Test 9: returns {valid:true, mimeType:'application/pdf'} for PDF magic bytes (25 50 44 46)", async () => {
			const { validateDocumentMagicBytes } = await import("./fileValidation");
			const pdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]).buffer;
			const result = validateDocumentMagicBytes(pdfBuffer, "application/pdf");
			expect(result.valid).toBe(true);
			expect(result.mimeType).toBe("application/pdf");
		});

		it("Test 10: returns {valid:true} for DOCX magic bytes (50 4B 03 04) with wordprocessingml MIME", async () => {
			const { validateDocumentMagicBytes } = await import("./fileValidation");
			const docxBuffer = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]).buffer;
			const result = validateDocumentMagicBytes(
				docxBuffer,
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
			);
			expect(result.valid).toBe(true);
			expect(result.mimeType).toContain("wordprocessingml");
		});

		it("Test 11: returns {valid:true} for XLSX magic bytes (50 4B 03 04) with spreadsheetml MIME", async () => {
			const { validateDocumentMagicBytes } = await import("./fileValidation");
			const xlsxBuffer = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]).buffer;
			const result = validateDocumentMagicBytes(
				xlsxBuffer,
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
			);
			expect(result.valid).toBe(true);
			expect(result.mimeType).toContain("spreadsheetml");
		});

		it("Test 12: returns {valid:true} for PPTX magic bytes (50 4B 03 04) with presentationml MIME", async () => {
			const { validateDocumentMagicBytes } = await import("./fileValidation");
			const pptxBuffer = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]).buffer;
			const result = validateDocumentMagicBytes(
				pptxBuffer,
				"application/vnd.openxmlformats-officedocument.presentationml.presentation"
			);
			expect(result.valid).toBe(true);
			expect(result.mimeType).toContain("presentationml");
		});

		it("Test 13: returns {valid:true} for text/plain with no magic bytes", async () => {
			const { validateDocumentMagicBytes } = await import("./fileValidation");
			const txtBuffer = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]).buffer; // "Hello"
			const result = validateDocumentMagicBytes(txtBuffer, "text/plain");
			expect(result.valid).toBe(true);
			expect(result.mimeType).toBe("text/plain");
		});

		it("Test 14: returns {valid:false} for invalid magic bytes", async () => {
			const { validateDocumentMagicBytes } = await import("./fileValidation");
			const invalidBuffer = new Uint8Array([0x00, 0x00, 0x00, 0x00]).buffer;
			const result = validateDocumentMagicBytes(invalidBuffer, "application/pdf");
			expect(result.valid).toBe(false);
			expect(result.error).toBeDefined();
		});
	});

	describe("sanitizeFilename", () => {
		it("Test 15: removes special characters, keeps extension", async () => {
			const { sanitizeFilename } = await import("./fileValidation");
			expect(sanitizeFilename("Test_File@2024!.pdf")).toBe("test-file2024.pdf");
		});

		it("Test 16: lowercases, replaces spaces with hyphens", async () => {
			const { sanitizeFilename } = await import("./fileValidation");
			expect(sanitizeFilename("Team Handbook 2026.docx")).toBe("team-handbook-2026.docx");
		});

		it("Test 17: handles multiple spaces and special characters", async () => {
			const { sanitizeFilename } = await import("./fileValidation");
			expect(sanitizeFilename("  FTC  @2024  --  Championship  .pdf")).toBe("ftc-2024-championship.pdf");
		});

		it("Test 18: preserves file extension", async () => {
			const { sanitizeFilename } = await import("./fileValidation");
			expect(sanitizeFilename("Test.PDF")).toBe("test.pdf");
		});

		it("Test 19: handles filenames without extension", async () => {
			const { sanitizeFilename } = await import("./fileValidation");
			expect(sanitizeFilename("README")).toBe("readme");
		});

		it("Test 20: handles filenames with multiple dots", async () => {
			const { sanitizeFilename } = await import("./fileValidation");
			expect(sanitizeFilename("file.name.with.dots.pdf")).toBe("file.name.with.dots.pdf");
		});
	});

	describe("getMimeTypeIcon", () => {
		it("Test 21: returns 'FileText' for PDF", async () => {
			const { getMimeTypeIcon } = await import("./fileValidation");
			expect(getMimeTypeIcon("application/pdf")).toBe("FileText");
		});

		it("Test 22: returns 'FileText' for DOCX", async () => {
			const { getMimeTypeIcon } = await import("./fileValidation");
			expect(getMimeTypeIcon("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("FileText");
		});

		it("Test 23: returns 'Table' for XLSX", async () => {
			const { getMimeTypeIcon } = await import("./fileValidation");
			expect(getMimeTypeIcon("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("Table");
		});

		it("Test 24: returns 'Presentation' for PPTX", async () => {
			const { getMimeTypeIcon } = await import("./fileValidation");
			expect(getMimeTypeIcon("application/vnd.openxmlformats-officedocument.presentationml.presentation")).toBe(
				"Presentation"
			);
		});

		it("Test 25: returns 'File' for TXT", async () => {
			const { getMimeTypeIcon } = await import("./fileValidation");
			expect(getMimeTypeIcon("text/plain")).toBe("File");
		});

		it("Test 26: returns 'File' for unknown types", async () => {
			const { getMimeTypeIcon } = await import("./fileValidation");
			expect(getMimeTypeIcon("unknown/type")).toBe("File");
		});
	});

	describe("generateR2Key", () => {
		it("Test 27: generates R2 key with format documents/{YYYY-MM-DD}/{filename}", async () => {
			const { generateR2Key } = await import("./fileValidation");
			const key = generateR2Key("test.pdf", "2024-05-13");
			expect(key).toBe("documents/2024-05-13/test.pdf");
		});

		it("Test 28: uses current date when no date provided", async () => {
			const { generateR2Key } = await import("./fileValidation");
			const today = new Date().toISOString().split("T")[0];
			const key = generateR2Key("test.pdf");
			expect(key).toBe(`documents/${today}/test.pdf`);
		});
	});

	describe("formatFileSize", () => {
		it("Test 29: formats bytes as 'B'", async () => {
			const { formatFileSize } = await import("./fileValidation");
			expect(formatFileSize(0)).toBe("0 B");
			expect(formatFileSize(512)).toBe("512 B");
		});

		it("Test 30: formats kilobytes as 'KB'", async () => {
			const { formatFileSize } = await import("./fileValidation");
			expect(formatFileSize(1024)).toBe("1 KB");
			expect(formatFileSize(5120)).toBe("5 KB");
		});

		it("Test 31: formats megabytes as 'MB'", async () => {
			const { formatFileSize } = await import("./fileValidation");
			expect(formatFileSize(1024 * 1024)).toBe("1 MB");
			expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
		});

		it("Test 32: formats gigabytes as 'GB'", async () => {
			const { formatFileSize } = await import("./fileValidation");
			expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB");
		});
	});
});
