"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const imageImport_1 = require("../imageImport");
(0, vitest_1.describe)("Image Import Pipeline Utilities", () => {
    (0, vitest_1.describe)("validateImageMagicBytes", () => {
        (0, vitest_1.it)("should accept valid JPEG files", () => {
            const buffer = new Uint8Array([0xFF, 0xD8, 0xFF, 0x00, 0x01, 0x02]).buffer;
            const result = (0, imageImport_1.validateImageMagicBytes)(buffer);
            (0, vitest_1.expect)(result.valid).toBe(true);
            (0, vitest_1.expect)(result.format).toBe("jpg");
        });
        (0, vitest_1.it)("should accept valid PNG files", () => {
            const buffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).buffer;
            const result = (0, imageImport_1.validateImageMagicBytes)(buffer);
            (0, vitest_1.expect)(result.valid).toBe(true);
            (0, vitest_1.expect)(result.format).toBe("png");
        });
        (0, vitest_1.it)("should accept valid WEBP files", () => {
            const buffer = new Uint8Array([
                0x52, 0x49, 0x46, 0x46, // RIFF
                0x00, 0x00, 0x00, 0x00,
                0x57, 0x45, 0x42, 0x50, // WEBP
            ]).buffer;
            const result = (0, imageImport_1.validateImageMagicBytes)(buffer);
            (0, vitest_1.expect)(result.valid).toBe(true);
            (0, vitest_1.expect)(result.format).toBe("webp");
        });
        (0, vitest_1.it)("should reject files with invalid magic bytes", () => {
            const buffer = new Uint8Array([0x00, 0x00, 0x00, 0x00]).buffer;
            const result = (0, imageImport_1.validateImageMagicBytes)(buffer);
            (0, vitest_1.expect)(result.valid).toBe(false);
            (0, vitest_1.expect)(result.format).toBe("unknown");
            (0, vitest_1.expect)(result.error).toBe("Invalid image format (must be JPG, PNG, or WEBP)");
        });
        (0, vitest_1.it)("should reject files exceeding the maximum size limit", () => {
            const buffer = new Uint8Array(100).buffer;
            const result = (0, imageImport_1.validateImageMagicBytes)(buffer, 50); // limit 50 bytes
            (0, vitest_1.expect)(result.valid).toBe(false);
            (0, vitest_1.expect)(result.error).toBe("File size exceeds 0MB limit");
        });
    });
    (0, vitest_1.describe)("sanitizeAlbumName", () => {
        (0, vitest_1.it)("should sanitize names to lowercase kebab-case", () => {
            (0, vitest_1.expect)((0, imageImport_1.sanitizeAlbumName)("Robot Specs")).toBe("robot-specs");
            (0, vitest_1.expect)((0, imageImport_1.sanitizeAlbumName)("Outreach_Competition 2026")).toBe("outreach-competition-2026");
            (0, vitest_1.expect)((0, imageImport_1.sanitizeAlbumName)("CAD Design!!!")).toBe("cad-design");
            (0, vitest_1.expect)((0, imageImport_1.sanitizeAlbumName)("  --ARES--  ")).toBe("ares");
        });
    });
});
//# sourceMappingURL=imageImport.test.js.map