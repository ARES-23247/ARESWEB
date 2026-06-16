/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../../middleware/utils";
import { createMockDrizzleDb, createTestEnv } from "../../../test/test-env";

// Mock googleAuth module BEFORE importing google-photos
vi.mock("../../../utils/googleAuth", () => ({
  getUnifiedOAuthToken: vi.fn(),
  clearCachedOAuthToken: vi.fn(),
}));

// Mock middleware modules BEFORE importing google-photos
vi.mock("../../middleware/auth", async () => {
  const actual = await vi.importActual<typeof import("../../middleware/auth.js")>("../../middleware/auth");
  return {
    ...actual,
    ensureAdmin: vi.fn((c: any, next: any) => {
      c.env = c.env || {};
      return next();
    }),
    getSessionUser: vi.fn(() => Promise.resolve({ id: "test-user@aresfirst.org" })),
  };
});

vi.mock("../../middleware", async () => {
  const actual = await vi.importActual<typeof import("../../middleware")>("../../middleware");
  return {
    ...actual,
    getDb: vi.fn((c: any) => c.get("db")),
  };
});

// Mock imageImport utilities
vi.mock("../../../utils/imageImport", () => ({
  validateImageMagicBytes: vi.fn(() => ({ valid: true })),
  downloadPhoto: vi.fn(() => Promise.resolve(new ArrayBuffer(1024))),
  uploadToR2: vi.fn(() => Promise.resolve("photos/imported/test.jpg")),
  sanitizeAlbumName: vi.fn((name: string) => name.toLowerCase().replace(/\s+/g, "-")),
}));

// Now import after mocks are set up
import { photosRouter } from "./index";
import { getUnifiedOAuthToken, clearCachedOAuthToken } from "../../../utils/googleAuth";
import { getDb } from "../../middleware";

const PICKER_API_BASE = "https://photospicker.googleapis.com/v1";

describe("google-photos router (Picker API)", () => {
  let app: Hono<AppEnv>;
  let mockDb: ReturnType<typeof createMockDrizzleDb>;
  let mockToken: string;
  let testEnv: AppEnv['Bindings'];

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = createMockDrizzleDb();
    mockToken = "mock-photos-token-" + Date.now();
    vi.mocked(getUnifiedOAuthToken).mockResolvedValue(mockToken);
    vi.mocked(getDb).mockReturnValue(mockDb as any);

    testEnv = createTestEnv({} as any);

    app = new Hono<AppEnv>();
    app.use('*', async (c, next) => {
      (c as any).env = testEnv;
      await next();
    });
    // Register onError handler to convert ApiError to proper status codes
    app.onError((err, c) => {
      if (err && typeof (err as any).status === "number" && typeof (err as any).code === "string") {
        const apiErr = err as any;
        return c.json({ error: apiErr.message, code: apiErr.code }, apiErr.status);
      }
      return c.json({ error: err.message }, 500);
    });
    app.route("/api/google-photos", photosRouter);

    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // HEALTH CHECK
  // ─────────────────────────────────────────────────────────────────────────

  describe("GET /health", () => {
    it("Test 1: should return 200 when Picker API session creation succeeds", async () => {
      vi.mocked(global.fetch).mockImplementation(async (url, opts) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("/sessions") && (opts as any)?.method === "POST") {
          return { ok: true, json: () => Promise.resolve({ id: "test-session-123" }) } as Response;
        }
        if (urlStr.includes("/sessions/test-session-123") && (opts as any)?.method === "DELETE") {
          return { ok: true } as Response;
        }
        return { ok: true } as Response;
      });

      const response = await app.request("/api/google-photos/health", { method: "GET" });
      expect(response.status).toBe(200);
      const body = await response.json() as any;
      expect(body.status).toBe("ok");
      expect(body.service).toBe("google-photos-picker");
      expect(body.authenticated).toBe(true);
    });

    it("Test 2: should retry with force refresh on 403", async () => {
      let callCount = 0;
      vi.mocked(global.fetch).mockImplementation(async (url, opts) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("/sessions") && (opts as any)?.method === "POST") {
          callCount++;
          if (callCount === 1) {
            return { ok: false, status: 403, text: () => Promise.resolve("Forbidden") } as Response;
          }
          return { ok: true, json: () => Promise.resolve({ id: "retry-session" }) } as Response;
        }
        return { ok: true } as Response;
      });

      const response = await app.request("/api/google-photos/health", { method: "GET" });
      expect(response.status).toBe(200);
      expect(clearCachedOAuthToken).toHaveBeenCalled();
    });

    it("Test 3: should return 500 with scope diagnostics on API failure", async () => {
      vi.mocked(global.fetch).mockImplementation(async (url, opts) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("/sessions") && (opts as any)?.method === "POST") {
          return { ok: false, status: 400, text: () => Promise.resolve("Bad Request") } as Response;
        }
        if (urlStr.includes("tokeninfo")) {
          return {
            ok: true,
            json: () => Promise.resolve({ scope: "photospicker.mediaitems.readonly" }),
          } as Response;
        }
        return { ok: true } as Response;
      });

      const response = await app.request("/api/google-photos/health", { method: "GET" });
      expect(response.status).toBe(500);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PICKER SESSION LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────

  describe("POST /picker/session", () => {
    it("Test 4: should create a Picker session and return pickerUri", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: "session-abc",
          pickerUri: "https://photos.google.com/picker/session-abc",
          mediaItemsSet: false,
          pollingConfig: { pollInterval: "5s", timeoutIn: "3600s" },
        }),
      } as Response);

      const response = await app.request("/api/google-photos/picker/session", {
        method: "POST",
      });

      expect(response.status).toBe(200);
      const body = await response.json() as any;
      expect(body.id).toBe("session-abc");
      expect(body.pickerUri).toContain("photos.google.com/picker");
      expect(body.mediaItemsSet).toBe(false);
    });

    it("Test 5: should call Picker API with correct auth header", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "s1", pickerUri: "https://x", mediaItemsSet: false }),
      } as Response);

      await app.request("/api/google-photos/picker/session", { method: "POST" });

      expect(global.fetch).toHaveBeenCalledWith(
        `${PICKER_API_BASE}/sessions`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );
    });

    it("Test 6: should throw on Picker API error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve("API error"),
      } as Response);

      const response = await app.request("/api/google-photos/picker/session", { method: "POST" });
      expect(response.status).toBe(500);
    });
  });

  describe("GET /picker/session/:sessionId", () => {
    it("Test 7: should poll session status and return mediaItemsSet flag", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: "session-xyz",
          pickerUri: "https://photos.google.com/picker/session-xyz",
          mediaItemsSet: true,
          pollingConfig: { pollInterval: "5s" },
        }),
      } as Response);

      const response = await app.request("/api/google-photos/picker/session/session-xyz", {
        method: "GET",
      });

      expect(response.status).toBe(200);
      const body = await response.json() as any;
      expect(body.mediaItemsSet).toBe(true);
    });

    it("Test 8: should call correct Picker API endpoint with sessionId", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "s1", pickerUri: "https://x", mediaItemsSet: false }),
      } as Response);

      await app.request("/api/google-photos/picker/session/my-session-id", { method: "GET" });

      expect(global.fetch).toHaveBeenCalledWith(
        `${PICKER_API_BASE}/sessions/my-session-id`,
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  describe("GET /picker/session/:sessionId/items", () => {
    it("Test 9: should return selected media items from completed session", async () => {
      const mockItems = [
        {
          id: "item-1",
          mediaFile: {
            baseUrl: "https://lh3.googleusercontent.com/abc",
            mimeType: "image/jpeg",
            filename: "photo1.jpg",
            fileSize: "1024",
          },
        },
        {
          id: "item-2",
          mediaFile: {
            baseUrl: "https://lh3.googleusercontent.com/def",
            mimeType: "image/png",
            filename: "photo2.png",
          },
        },
      ];

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ mediaItems: mockItems }),
      } as Response);

      const response = await app.request("/api/google-photos/picker/session/session-done/items", {
        method: "GET",
      });

      expect(response.status).toBe(200);
      const body = await response.json() as any;
      expect(body.mediaItems).toHaveLength(2);
      expect(body.mediaItems[0].id).toBe("item-1");
      expect(body.mediaItems[0].mimeType).toBe("image/jpeg");
    });

    it("Test 10: should call mediaItems endpoint with sessionId query param", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ mediaItems: [] }),
      } as Response);

      await app.request("/api/google-photos/picker/session/abc123/items", { method: "GET" });

      expect(global.fetch).toHaveBeenCalledWith(
        `${PICKER_API_BASE}/mediaItems?sessionId=abc123`,
        expect.any(Object)
      );
    });
  });

  describe("DELETE /picker/session/:sessionId", () => {
    it("Test 11: should delete session and return success", async () => {
      vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

      const response = await app.request("/api/google-photos/picker/session/session-cleanup", {
        method: "DELETE",
      });

      expect(response.status).toBe(200);
      const body = await response.json() as any;
      expect(body.success).toBe(true);
    });

    it("Test 12: should return success even if session already expired (404)", async () => {
      vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 404 } as Response);

      const response = await app.request("/api/google-photos/picker/session/expired-session", {
        method: "DELETE",
      });

      expect(response.status).toBe(200);
      const body = await response.json() as any;
      expect(body.success).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // UPLOAD (unchanged — uses photoslibrary.appendonly)
  // ─────────────────────────────────────────────────────────────────────────

  describe("POST /upload", () => {
    it("Test 13: should reject requests with no files", async () => {
      const formData = new FormData();
      const response = await app.request("/api/google-photos/upload", {
        method: "POST",
        body: formData,
      });
      expect(response.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // IMPORT (updated for Picker items)
  // ─────────────────────────────────────────────────────────────────────────

  describe("POST /import", () => {
    it("Test 14: should import Picker items with baseUrls to R2", async () => {
      const response = await app.request("/api/google-photos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              id: "picker-item-1",
              baseUrl: "https://lh3.googleusercontent.com/abc",
              filename: "team-photo.jpg",
              mimeType: "image/jpeg",
            },
          ],
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json() as any;
      expect(body.imported).toBe(1);
      expect(body.failed).toBe(0);
      expect(body.results[0].status).toBe("success");
      expect(body.results[0].r2Key).toBeDefined();
    });

    it("Test 15: should handle import failures gracefully", async () => {
      const { downloadPhoto } = await import("../../../utils/imageImport");
      vi.mocked(downloadPhoto).mockRejectedValueOnce(new Error("Download timeout"));

      const response = await app.request("/api/google-photos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              id: "picker-item-fail",
              baseUrl: "https://lh3.googleusercontent.com/fail",
              filename: "broken.jpg",
              mimeType: "image/jpeg",
            },
          ],
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json() as any;
      expect(body.imported).toBe(0);
      expect(body.failed).toBe(1);
      expect(body.results[0].status).toBe("failed");
      expect(body.results[0].error).toContain("Download timeout");
    });

    it("Test 16: should default filename when not provided", async () => {
      const response = await app.request("/api/google-photos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              id: "no-name-item",
              baseUrl: "https://lh3.googleusercontent.com/xyz",
            },
          ],
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json() as any;
      expect(body.results[0].filename).toContain("photo-");
    });
  });
});
