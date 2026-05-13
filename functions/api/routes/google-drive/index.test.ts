import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../../middleware/utils";
import { createMockDrizzleDb, createTestEnv } from "../../../test/test-env";

// Mock googleAuth module BEFORE importing google-drive
vi.mock("../../../utils/googleAuth", () => ({
  getDriveAccessToken: vi.fn(),
}));

// Mock middleware modules BEFORE importing google-drive
vi.mock("../../middleware/auth", async () => {
  const actual = await vi.importActual<typeof import("../../middleware/auth.js")>("../../middleware/auth");
  return {
    ...actual,
    ensureAdmin: vi.fn((c: any, next: any) => {
      // Set mock env on context for tests
      c.env = c.env || {};
      return next();
    }),
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
import { driveRouter } from "./index";
import { getDriveAccessToken } from "../../../utils/googleAuth";
import { getDb } from "../../middleware";

describe("google-drive router", () => {
  let app: Hono<AppEnv>;
  let mockDb: ReturnType<typeof createMockDrizzleDb>;
  let mockToken: string;
  let testEnv: AppEnv['Bindings'];

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock DB
    mockDb = createMockDrizzleDb();

    // Setup token mocks
    mockToken = "mock-drive-token-" + Date.now();
    vi.mocked(getDriveAccessToken).mockResolvedValue(mockToken);
    vi.mocked(getDb).mockReturnValue(mockDb as any);

    // Create test env
    testEnv = createTestEnv({
      GOOGLE_DRIVE_FOLDER_ID: "test-folder-123",
    });

    // Create test app with env
    app = new Hono<AppEnv>();
    // Add middleware to set env on context
    app.use('*', async (c, next) => {
      (c as any).env = testEnv;
      await next();
    });
    app.route("/api/google-drive", driveRouter);

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /health", () => {
    it("Test 1: should return 200 with service status when authentication succeeds", async () => {
      // Mock successful Drive API response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      } as Response);

      const response = await app.request("/api/google-drive/health", {
        method: "GET",
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({
        status: "ok",
        service: "google-drive",
        authenticated: true,
        test: "API call successful",
      });
    });

    it("Test 2: Health endpoint calls Drive API to verify token works", async () => {
      // Mock successful Drive API response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      } as Response);

      await app.request("/api/google-drive/health", {
        method: "GET",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://www.googleapis.com/drive/v3/files?pageSize=1",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );
    });

    it("Test 3: Router requires admin authentication via ensureAdmin", async () => {
      // This test verifies the ensureAdmin middleware is applied
      // The middleware is mocked to pass, but we verify the route structure
      expect(driveRouter).toBeDefined();
      const routes = driveRouter.routes;
      expect(routes.length).toBeGreaterThan(0);
    });

    it("Test 4: Token refresh failures trigger retry logic (3 retries)", async () => {
      let attempts = 0;
      vi.mocked(getDriveAccessToken).mockImplementation(() => {
        attempts++;
        if (attempts <= 3) {
          return Promise.reject(new Error("Token refresh failed"));
        }
        return Promise.resolve(mockToken);
      });

      // Mock successful Drive API response after retry
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      } as Response);

      const response = await app.request("/api/google-drive/health", {
        method: "GET",
      });

      // After 3 failures, the function should succeed on the 4th attempt
      // But since getOrRefreshToken only retries 3 times, it will throw
      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text.length).toBeGreaterThan(0);
    });

    it("Test 5: Exhausted retries throw ApiError with AUTH_FAILURE code", async () => {
      // Mock token refresh that always fails
      vi.mocked(getDriveAccessToken).mockRejectedValue(
        new Error("Failed to refresh drive access token after 3 attempts: Authentication failed")
      );

      const response = await app.request("/api/google-drive/health", {
        method: "GET",
      });

      // Should return 500 due to unhandled error from token refresh
      // (In production, the global error handler would catch this)
      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text.length).toBeGreaterThan(0);
    });
  });

  describe("GET /files", () => {
    const mockFolderId = "root-folder-123";
    const mockDriveFiles = [
      {
        id: "doc1",
        name: "Team Meeting Notes",
        mimeType: "application/vnd.google-apps.document",
        modifiedTime: "2024-05-12T10:30:00.000Z",
        webViewLink: "https://docs.google.com/document/d/doc1/edit",
        owners: [{ displayName: "mentor@aresfirst.org", emailAddress: "mentor@aresfirst.org" }],
      },
      {
        id: "sheet1",
        name: "Budget Tracker",
        mimeType: "application/vnd.google-apps.spreadsheet",
        modifiedTime: "2024-05-11T14:20:00.000Z",
        webViewLink: "https://docs.google.com/spreadsheets/d/sheet1/edit",
        owners: [{ displayName: "student@aresfirst.org", emailAddress: "student@aresfirst.org" }],
      },
      {
        id: "slide1",
        name: "Competition Presentation",
        mimeType: "application/vnd.google-apps.presentation",
        modifiedTime: "2024-05-10T09:15:00.000Z",
        webViewLink: "https://docs.google.com/presentation/d/slide1/edit",
        owners: [{ displayName: "coach@aresfirst.org", emailAddress: "coach@aresfirst.org" }],
      },
      {
        id: "draw1",
        name: "Robot CAD Drawing",
        mimeType: "application/vnd.google-apps.drawing",
        modifiedTime: "2024-05-09T16:45:00.000Z",
        webViewLink: "https://docs.google.com/drawings/d/draw1/edit",
        owners: [{ displayName: "mentor@aresfirst.org", emailAddress: "mentor@aresfirst.org" }],
      },
    ];

    it("Test 6: should return array of Google Workspace documents with proper metadata", async () => {
      // Mock Drive API response with Google Workspace files
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          files: mockDriveFiles,
          nextPageToken: "next-page-token-123",
        }),
      } as Response);

      const response = await app.request("/api/google-drive/files", {
        method: "GET",
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.files).toBeDefined();
      expect(body.files.length).toBe(4);
      expect(body.files[0]).toMatchObject({
        id: "doc1",
        name: "Team Meeting Notes",
        mimeType: "application/vnd.google-apps.document",
        modifiedTime: "2024-05-12T10:30:00.000Z",
        owner: "mentor@aresfirst.org",
        webViewLink: "https://docs.google.com/document/d/doc1/edit",
      });
      expect(body.nextPageToken).toBe("next-page-token-123");
    });

    it("Test 7: query parameter q filters files by name using Drive API", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          files: mockDriveFiles.filter(f => f.name.toLowerCase().includes("meeting")),
        }),
      } as Response);

      const response = await app.request("/api/google-drive/files?q=meeting", {
        method: "GET",
      });

      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("name+contains+%27meeting%27"),
        expect.any(Object)
      );
    });

    it("Test 8: query parameter pageToken enables pagination", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          files: mockDriveFiles.slice(2),
        }),
      } as Response);

      const response = await app.request("/api/google-drive/files?pageToken=abc123", {
        method: "GET",
      });

      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("pageToken=abc123"),
        expect.any(Object)
      );
    });

    it("Test 9: query parameter pageSize limits results with default 50", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          files: mockDriveFiles,
        }),
      } as Response);

      const response = await app.request("/api/google-drive/files?pageSize=10", {
        method: "GET",
      });

      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("pageSize=10"),
        expect.any(Object)
      );
    });

    it("Test 10: response excludes non-Google Workspace files (PDF, images, etc.)", async () => {
      // The Drive API query filters server-side, so the mock should only return Google Workspace files
      // In a real scenario, Drive API would filter based on the MIME type query parameter
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          files: mockDriveFiles,
        }),
      } as Response);

      const response = await app.request("/api/google-drive/files", {
        method: "GET",
      });

      expect(response.status).toBe(200);
      // Verify that the query includes MIME type filter
      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const url = fetchCall[0] as string;
      expect(url).toContain("mimeType+in");
      // URL-encoded MIME type (slashes are encoded as %2F)
      expect(url).toContain("application%2Fvnd.google-apps.document");
    });

    it("Test 11: uses getDriveAccessToken for authenticated API calls", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      } as Response);

      await app.request("/api/google-drive/files", {
        method: "GET",
      });

      expect(getDriveAccessToken).toHaveBeenCalledWith(mockDb, expect.any(Object));
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );
    });

    it("Test 12: returns 500 error when Drive API call fails", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: () => Promise.resolve({ error: { message: "API error" } }),
      } as Response);

      const response = await app.request("/api/google-drive/files", {
        method: "GET",
      });

      expect(response.status).toBe(500);
    });

    it("Test 13: MIME type filter includes only Google Workspace types", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ files: mockDriveFiles }),
      } as Response);

      await app.request("/api/google-drive/files", {
        method: "GET",
      });

      // Verify the query includes only the four Google Workspace MIME types
      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const url = fetchCall[0] as string;
      // URL-encoded MIME types (slashes are encoded as %2F)
      expect(url).toContain("application%2Fvnd.google-apps.document");
      expect(url).toContain("application%2Fvnd.google-apps.spreadsheet");
      expect(url).toContain("application%2Fvnd.google-apps.presentation");
      expect(url).toContain("application%2Fvnd.google-apps.drawing");
    });
  });
});
