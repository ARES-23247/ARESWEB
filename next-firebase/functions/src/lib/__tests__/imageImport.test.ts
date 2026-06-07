import { describe, it, expect } from "vitest";
import { validateImageMagicBytes, sanitizeAlbumName } from "../imageImport";

describe("Image Import Pipeline Utilities", () => {
  describe("validateImageMagicBytes", () => {
    it("should accept valid JPEG files", () => {
      const buffer = new Uint8Array([0xFF, 0xD8, 0xFF, 0x00, 0x01, 0x02]).buffer;
      const result = validateImageMagicBytes(buffer);
      expect(result.valid).toBe(true);
      expect(result.format).toBe("jpg");
    });

    it("should accept valid PNG files", () => {
      const buffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).buffer;
      const result = validateImageMagicBytes(buffer);
      expect(result.valid).toBe(true);
      expect(result.format).toBe("png");
    });

    it("should accept valid WEBP files", () => {
      const buffer = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50, // WEBP
      ]).buffer;
      const result = validateImageMagicBytes(buffer);
      expect(result.valid).toBe(true);
      expect(result.format).toBe("webp");
    });

    it("should reject files with invalid magic bytes", () => {
      const buffer = new Uint8Array([0x00, 0x00, 0x00, 0x00]).buffer;
      const result = validateImageMagicBytes(buffer);
      expect(result.valid).toBe(false);
      expect(result.format).toBe("unknown");
      expect(result.error).toBe("Invalid image format (must be JPG, PNG, or WEBP)");
    });

    it("should reject files exceeding the maximum size limit", () => {
      const buffer = new Uint8Array(100).buffer;
      const result = validateImageMagicBytes(buffer, 50); // limit 50 bytes
      expect(result.valid).toBe(false);
      expect(result.error).toBe("File size exceeds 0MB limit");
    });
  });

  describe("sanitizeAlbumName", () => {
    it("should sanitize names to lowercase kebab-case", () => {
      expect(sanitizeAlbumName("Robot Specs")).toBe("robot-specs");
      expect(sanitizeAlbumName("Outreach_Competition 2026")).toBe("outreach-competition-2026");
      expect(sanitizeAlbumName("CAD Design!!!")).toBe("cad-design");
      expect(sanitizeAlbumName("  --ARES--  ")).toBe("ares");
    });
  });
});
