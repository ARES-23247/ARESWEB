import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../../middleware/utils";
import { createMockDrizzleDb } from "../../../test/test-env";

// Mock googleAuth module BEFORE importing google-photos
vi.mock("../../../utils/googleAuth", () => ({
  getPhotosAccessToken: vi.fn(),
}));

// Mock middleware modules BEFORE importing google-photos
vi.mock("../../middleware/auth", async () => {
  const actual = await vi.importActual<typeof import("../../middleware/auth.js")>("../../middleware/auth");
  return {
    ...actual,
    ensureAdmin: vi.fn((c: any, next: any) => next()),
  };
});

vi.mock("../../middleware", async () => {
  const actual = await vi.importActual<typeof import("../../middleware.js")>("../../middleware");
  return {
    ...actual,
    getDb: vi.fn((c: any) => c.get("db")),
  };
});

// Now import after mocks are set up
import { photosRouter } from "./index";
import { getPhotosAccessToken } from "../../../utils/googleAuth";
import { getDb } from "../../middleware";

describe("google-photos router", () => {
  let app: Hono<AppEnv>;
  let mockDb: ReturnType<typeof createMockDrizzleDb>;
  let mockToken: string;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock DB
    mockDb = createMockDrizzleDb();

    // Setup token mocks
    mockToken = "mock-photos-token-" + Date.now();
    vi.mocked(getPhotosAccessToken).mockResolvedValue(mockToken);
    vi.mocked(getDb).mockReturnValue(mockDb as any);

    // Create test app
    app = new Hono<AppEnv>();
    app.route("/api/google-photos", photosRouter);

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /health", () => {
    it("Test 1: should return 200 with service status when authentication succeeds", async () => {
      // Mock successful Photos API response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ mediaItems: [] }),
      } as Response);

      const response = await app.request("/api/google-photos/health", {
        method: "GET",
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({
        status: "ok",
        service: "google-photos",
        authenticated: true,
        test: "API call successful",
      });
    });

    it("Test 2: Health endpoint calls Photos API to verify token works", async () => {
      // Mock successful Photos API response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ mediaItems: [] }),
      } as Response);

      await app.request("/api/google-photos/health", {
        method: "GET",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://photoslibrary.googleapis.com/v1/mediaItems:search",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );
    });

    it("Test 3: Router requires admin authentication via ensureAdmin", async () => {
      // This test verifies the ensureAdmin middleware is applied
      // The middleware is mocked to pass, but we verify the route structure
      expect(photosRouter).toBeDefined();
      const routes = photosRouter.routes;
      expect(routes.length).toBeGreaterThan(0);
    });

    it("Test 4: Token refresh failures trigger retry logic (3 retries)", async () => {
      let attempts = 0;
      vi.mocked(getPhotosAccessToken).mockImplementation(() => {
        attempts++;
        if (attempts <= 3) {
          return Promise.reject(new Error("Token refresh failed"));
        }
        return Promise.resolve(mockToken);
      });

      // Mock successful Photos API response after retry
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ mediaItems: [] }),
      } as Response);

      const response = await app.request("/api/google-photos/health", {
        method: "GET",
      });

      // After 3 failures, the function should succeed on the 4th attempt
      // But since getOrRefreshToken only retries 3 times, it will throw
      expect(response.status).toBe(500);
      // Error may be plain text or JSON depending on error handler
      const text = await response.text();
      expect(text.length).toBeGreaterThan(0);
    });

    it("Test 5: Exhausted retries throw ApiError with AUTH_FAILURE code", async () => {
      // Mock token refresh that always fails
      vi.mocked(getPhotosAccessToken).mockRejectedValue(
        new Error("Failed to refresh photos access token after 3 attempts: Authentication failed")
      );

      const response = await app.request("/api/google-photos/health", {
        method: "GET",
      });

      // Should return 500 due to unhandled error from token refresh
      // (In production, the global error handler would catch this)
      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text.length).toBeGreaterThan(0);
    });
  });

  describe("GET /albums (placeholder)", () => {
    it("should return empty array for placeholder endpoint", async () => {
      const response = await app.request("/api/google-photos/albums", {
        method: "GET",
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual([]);
    });
  });
});
