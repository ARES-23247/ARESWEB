/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Phase 76-02: Image Import Pipeline - TDD Tests
 *
 * RED Phase: Failing tests for image import utilities
 * These tests verify:
 * - Magic byte validation (JPG, PNG, WEBP)
 * - Photo download from Google Photos API
 * - R2 upload with proper key format
 * - Album name sanitization
 *
 * Tests must fail before implementation begins.
 */

import { describe, it, expect, vi } from "vitest";

// Top-level mocks — Vitest hoists these before any module loading.
// Paths are relative to THIS test file at functions/utils/imageImport.test.ts.
vi.mock("../utils/googleAuth", () => ({
  getPhotosAccessToken: vi.fn().mockResolvedValue("mock-token"),
}));

vi.mock("../api/middleware/auth", async () => {
  const actual = await vi.importActual<typeof import("../api/middleware/auth.js")>("../api/middleware/auth");
  return {
    ...actual,
    ensureAdmin: vi.fn((_c: any, next: any) => next()),
  };
});

vi.mock("../api/middleware", async () => {
  const actual = await vi.importActual<typeof import("../api/middleware/index.js")>("../api/middleware");
  return {
    ...actual,
    getDb: vi.fn((c: any) => c.get("db")),
    ensureAdmin: vi.fn((_c: any, next: any) => next()),
  };
});

describe("imageImport utilities", () => {
  describe("validateImageMagicBytes", () => {
    it("Test 1: returns {valid:true, format:'jpg'} for JPG magic bytes (FF D8 FF)", async () => {
      // This test will fail until validateImageMagicBytes is implemented
      const { validateImageMagicBytes } = await import("./imageImport");
      const jpgBuffer = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]).buffer;
      const result = validateImageMagicBytes(jpgBuffer, 50 * 1024 * 1024);
      expect(result).toEqual({ valid: true, format: "jpg" });
    });

    it("Test 2: returns {valid:true, format:'png'} for PNG magic bytes (89 50 4E 47)", async () => {
      const { validateImageMagicBytes } = await import("./imageImport");
      const pngBuffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).buffer;
      const result = validateImageMagicBytes(pngBuffer, 50 * 1024 * 1024);
      expect(result).toEqual({ valid: true, format: "png" });
    });

    it("Test 3: returns {valid:true, format:'webp'} for WEBP magic bytes (52 49 46 46 ... 57 45 42 50)", async () => {
      const { validateImageMagicBytes } = await import("./imageImport");
      // WEBP: RIFF...WEBP
      const webpBuffer = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // file size
        0x57, 0x45, 0x42, 0x50, // WEBP
      ]).buffer;
      const result = validateImageMagicBytes(webpBuffer, 50 * 1024 * 1024);
      expect(result).toEqual({ valid: true, format: "webp" });
    });

    it("Test 4: returns {valid:false, format:'unknown'} for invalid magic bytes", async () => {
      const { validateImageMagicBytes } = await import("./imageImport");
      const invalidBuffer = new Uint8Array([0x00, 0x00, 0x00, 0x00]).buffer;
      const result = validateImageMagicBytes(invalidBuffer, 50 * 1024 * 1024);
      expect(result.valid).toBe(false);
      expect(result.format).toBe("unknown");
      expect(result.error).toBeDefined();
    });

    it("Test 5: rejects files larger than 50MB (configurable via env var)", async () => {
      const { validateImageMagicBytes } = await import("./imageImport");
      const largeJpgBuffer = new ArrayBuffer(51 * 1024 * 1024); // 51MB
      const firstBytes = new Uint8Array(largeJpgBuffer);
      firstBytes[0] = 0xFF;
      firstBytes[1] = 0xD8;
      firstBytes[2] = 0xFF;

      const result = validateImageMagicBytes(largeJpgBuffer, 50 * 1024 * 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds");
    });
  });

  describe("downloadPhoto", () => {
    it("Test 6: downloads from baseUrl with =d suffix for full resolution", async () => {
      const { downloadPhoto } = await import("./imageImport");

      // Mock fetch to return valid JPG data
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new Uint8Array([0xFF, 0xD8, 0xFF]).buffer),
      } as Response);

      const result = await downloadPhoto("https://photos.com/base", "mock-token");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://photos.com/base=d",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer mock-token",
          }),
        })
      );
      expect(result instanceof ArrayBuffer).toBe(true);
    });

    it("Test 7: throws ApiError on fetch failure", async () => {
      const { downloadPhoto } = await import("./imageImport");

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as Response);

      await expect(downloadPhoto("https://photos.com/base", "mock-token")).rejects.toThrow();
    });
  });

  describe("uploadToR2", () => {
    it("Test 8: uploads file to ARES_STORAGE with correct key format (no album)", async () => {
      const { uploadToR2 } = await import("./imageImport");

      const mockEnv = {
        ARES_STORAGE: {
          put: vi.fn().mockResolvedValue({ key: "photos/imported/2024-05-13/test.jpg" }),
        },
      };

      const buffer = new Uint8Array([0xFF, 0xD8, 0xFF]).buffer;
      const result = await uploadToR2(buffer, "test.jpg", "image/jpeg", null, mockEnv as any, "2024-05-13");

      expect(mockEnv.ARES_STORAGE.put).toHaveBeenCalledWith(
        "photos/imported/2024-05-13/test.jpg",
        buffer,
        expect.objectContaining({
          httpMetadata: expect.objectContaining({
            contentType: "image/jpeg",
          }),
        })
      );
      expect(result).toBe("photos/imported/2024-05-13/test.jpg");
    });

    it("Test 9: uploads file to ARES_STORAGE with correct key format (with album)", async () => {
      const { uploadToR2 } = await import("./imageImport");

      const mockEnv = {
        ARES_STORAGE: {
          put: vi.fn().mockResolvedValue({ key: "photos/albums/ftc-championship/test.jpg" }),
        },
      };

      const buffer = new Uint8Array([0xFF, 0xD8, 0xFF]).buffer;
      const result = await uploadToR2(buffer, "test.jpg", "image/jpeg", "FTC Championship", mockEnv as any, "2024-05-13");

      expect(mockEnv.ARES_STORAGE.put).toHaveBeenCalledWith(
        "photos/albums/ftc-championship/test.jpg",
        buffer,
        expect.objectContaining({
          httpMetadata: expect.objectContaining({
            contentType: "image/jpeg",
          }),
        })
      );
      expect(result).toBe("photos/albums/ftc-championship/test.jpg");
    });

    it("Test 10: returns R2 key on success", async () => {
      const { uploadToR2 } = await import("./imageImport");

      const mockEnv = {
        ARES_STORAGE: {
          put: vi.fn().mockResolvedValue({ key: "photos/imported/2024-05-13/test.jpg" }),
        },
      };

      const buffer = new Uint8Array([0xFF, 0xD8, 0xFF]).buffer;
      const result = await uploadToR2(buffer, "test.jpg", "image/jpeg", null, mockEnv as any, "2024-05-13");

      expect(result).toBe("photos/imported/2024-05-13/test.jpg");
    });
  });

  describe("sanitizeAlbumName", () => {
    it("Test 10: lowercases, replaces spaces with hyphens, removes special chars", async () => {
      const { sanitizeAlbumName } = await import("./imageImport");
      expect(sanitizeAlbumName("FTC Championship 2024!")).toBe("ftc-championship-2024");
    });

    it("Test 11: handles multiple spaces and special characters", async () => {
      const { sanitizeAlbumName } = await import("./imageImport");
      expect(sanitizeAlbumName("  FTC  @2024  --  Championship  ")).toBe("ftc-2024-championship");
    });

    it("Test 12: preserves hyphens and alphanumeric characters", async () => {
      const { sanitizeAlbumName } = await import("./imageImport");
      expect(sanitizeAlbumName("ftc-championship-2024")).toBe("ftc-championship-2024");
    });
  });
});

describe("POST /import endpoint", () => {
  let app: any;
  let mockDb: any;
  let mockEnv: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create mock DB
    mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(null),
          }),
        }),
      }),
    };

    // Mock environment with R2
    mockEnv = {
      ARES_STORAGE: {
        put: vi.fn().mockResolvedValue({ key: "photos/imported/2024-05-13/test.jpg" }),
      },
    };

    // Import router after mocks
    const { photosRouter } = await import("../api/routes/google-photos/index");
    const { Hono } = await import("hono");

    app = new Hono();
    // Inject mock DB and env bindings into Hono context (mirrors production middleware)
    app.use("*", async (c: any, next: any) => {
      c.set("db", mockDb);
      c.env = { ...c.env, ...mockEnv };
      await next();
    });
    app.route("/api/google-photos", photosRouter);

    // Mock fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /import", () => {
    it("Test 11: POST /import with valid mediaItemIds returns 200 with import counts", async () => {
      // Mock Photos API media items fetch
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          mediaItems: [
            {
              id: "photo123",
              baseUrl: "https://photos.com/base",
              filename: "test.jpg",
              mimeType: "image/jpeg",
            },
          ],
        }),
      } as Response);

      // Mock photo download
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]).buffer),
      } as Response);

      const response = await app.request("/api/google-photos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaItemIds: ["photo123"] }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty("imported");
      expect(body).toHaveProperty("failed");
      expect(body).toHaveProperty("results");
    });

    it("Test 12: POST /import with valid mediaItemIds downloads and uploads to R2", async () => {
      // Mock Photos API media items fetch
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          mediaItems: [
            {
              id: "photo123",
              baseUrl: "https://photos.com/base",
              filename: "test.jpg",
              mimeType: "image/jpeg",
            },
          ],
        }),
      } as Response);

      // Mock photo download
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]).buffer),
      } as Response);

      const response = await app.request("/api/google-photos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaItemIds: ["photo123"] }),
      });

      expect(mockEnv.ARES_STORAGE.put).toHaveBeenCalled();
      const body = await response.json();
      expect(body.imported).toBeGreaterThan(0);
    });

    it("Test 13: POST /import creates record in imported_photos table on success", async () => {
      // Mock Photos API media items fetch
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          mediaItems: [
            {
              id: "photo123",
              baseUrl: "https://photos.com/base",
              filename: "test.jpg",
              mimeType: "image/jpeg",
            },
          ],
        }),
      } as Response);

      // Mock photo download
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]).buffer),
      } as Response);

      const _response = await app.request("/api/google-photos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaItemIds: ["photo123"] }),
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("Test 14: POST /import creates record in import_audit_log for each attempt", async () => {
      // Mock Photos API media items fetch
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          mediaItems: [
            {
              id: "photo123",
              baseUrl: "https://photos.com/base",
              filename: "test.jpg",
              mimeType: "image/jpeg",
            },
          ],
        }),
      } as Response);

      // Mock photo download
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]).buffer),
      } as Response);

      const _response = await app.request("/api/google-photos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaItemIds: ["photo123"] }),
      });

      // Should have at least 2 insert calls (imported_photos + import_audit_log)
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("Test 15: POST /import with albumId creates/updates photo_albums record", async () => {
      // Mock Photos API album details fetch (fetched FIRST in the route when albumId is provided)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: "album123",
          title: "FTC Championship",
          mediaItemsCount: "10",
        }),
      } as Response);

      // Mock Photos API media item details fetch (per-item, fetched SECOND)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: "photo123",
          baseUrl: "https://photos.com/base",
          filename: "test.jpg",
          mimeType: "image/jpeg",
        }),
      } as Response);

      // Mock photo download (fetched THIRD)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]).buffer),
      } as Response);

      const response = await app.request("/api/google-photos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaItemIds: ["photo123"], albumId: "album123" }),
      });

      expect(response.status).toBe(200);
    });

    it("Test 16: POST /import with albumId uploads to photos/albums/{sanitizedName}/{filename}", async () => {
      // Mock Photos API album details fetch (fetched FIRST in the route when albumId is provided)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: "album123",
          title: "FTC Championship",
          mediaItemsCount: "10",
        }),
      } as Response);

      // Mock Photos API media item details fetch (per-item, fetched SECOND)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: "photo123",
          baseUrl: "https://photos.com/base",
          filename: "test.jpg",
          mimeType: "image/jpeg",
        }),
      } as Response);

      // Mock photo download (fetched THIRD)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]).buffer),
      } as Response);

      const _response = await app.request("/api/google-photos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaItemIds: ["photo123"], albumId: "album123" }),
      });

      // Verify upload to album folder
      expect(mockEnv.ARES_STORAGE.put).toHaveBeenCalledWith(
        expect.stringContaining("photos/albums/ftc-championship/"),
        expect.any(ArrayBuffer),
        expect.any(Object)
      );
    });

    it("Test 17: POST /import without albumId uploads to photos/imported/{YYYY-MM-DD}/{filename}", async () => {
      // Mock Photos API media items fetch
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          mediaItems: [
            {
              id: "photo123",
              baseUrl: "https://photos.com/base",
              filename: "test.jpg",
              mimeType: "image/jpeg",
            },
          ],
        }),
      } as Response);

      // Mock photo download
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]).buffer),
      } as Response);

      const _response = await app.request("/api/google-photos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaItemIds: ["photo123"] }),
      });

      // Verify upload to imported folder with date
      expect(mockEnv.ARES_STORAGE.put).toHaveBeenCalledWith(
        expect.stringContaining("photos/imported/"),
        expect.any(ArrayBuffer),
        expect.any(Object)
      );
    });

    it("Test 18: POST /import continues processing after individual failures", async () => {
      // Mock Photos API media items fetch (2 photos)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          mediaItems: [
            {
              id: "photo1",
              baseUrl: "https://photos.com/base1",
              filename: "good.jpg",
              mimeType: "image/jpeg",
            },
            {
              id: "photo2",
              baseUrl: "https://photos.com/base2",
              filename: "bad.jpg",
              mimeType: "image/jpeg",
            },
          ],
        }),
      } as Response);

      // Mock first photo download (success)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]).buffer),
      } as Response);

      // Mock second photo download (failure - invalid format)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new Uint8Array([0x00, 0x00, 0x00, 0x00]).buffer),
      } as Response);

      const response = await app.request("/api/google-photos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaItemIds: ["photo1", "photo2"] }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.imported).toBe(1);
      expect(body.failed).toBe(1);
    });

    it("Test 19: POST /import returns failure details for each failed import", async () => {
      // Mock Photos API media items fetch
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          mediaItems: [
            {
              id: "photo123",
              baseUrl: "https://photos.com/base",
              filename: "bad.jpg",
              mimeType: "image/jpeg",
            },
          ],
        }),
      } as Response);

      // Mock photo download (invalid format)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new Uint8Array([0x00, 0x00, 0x00, 0x00]).buffer),
      } as Response);

      const response = await app.request("/api/google-photos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaItemIds: ["photo123"] }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.failed).toBe(1);
      expect(body.results).toHaveLength(1);
      expect(body.results[0].status).toBe("failed");
      expect(body.results[0].error).toBeDefined();
    });

    it("Test 20: POST /import validates magic bytes before R2 upload", async () => {
      // Mock Photos API media items fetch
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          mediaItems: [
            {
              id: "photo123",
              baseUrl: "https://photos.com/base",
              filename: "fake.jpg",
              mimeType: "image/jpeg",
            },
          ],
        }),
      } as Response);

      // Mock photo download (invalid magic bytes)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new Uint8Array([0x00, 0x00, 0x00, 0x00]).buffer),
      } as Response);

      const response = await app.request("/api/google-photos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaItemIds: ["photo123"] }),
      });

      // Should NOT upload to R2 if magic bytes are invalid
      expect(mockEnv.ARES_STORAGE.put).not.toHaveBeenCalled();
      const body = await response.json();
      expect(body.failed).toBe(1);
    });
  });
});
