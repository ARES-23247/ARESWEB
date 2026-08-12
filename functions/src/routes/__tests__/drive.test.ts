import { describe, it, expect, vi, beforeEach } from "vitest";
import driveRouter, { extractDriveFileId, inferDocCategory } from "../drive";
import { adminDb } from "../../lib/firebase-admin";

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockBatchSet = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);

vi.mock("../../lib/firebase-admin", () => {
  return {
    adminDb: {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: mockGet,
          set: mockSet
        }))
      })),
      batch: vi.fn(() => ({
        set: mockBatchSet,
        commit: mockBatchCommit
      }))
    }
  };
});

vi.mock("../../lib/googleAuth", () => ({
  getGooglePhotosAccessToken: vi.fn().mockResolvedValue("mock-access-token")
}));

vi.mock("../../middleware/auth", () => ({
  ensureAuth: (req: any, _res: any, next: any) => {
    req.user = { uid: "test-user-id" };
    next();
  },
  ensureAdmin: (req: any, _res: any, next: any) => {
    req.user = { uid: "test-admin-id" };
    next();
  }
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Google Drive Utilities & Express Router", () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      params: {},
      query: {},
      body: {},
      headers: {},
      get: vi.fn()
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
  });

  describe("extractDriveFileId", () => {
    it("should extract file ID from standard Google Drive file URL", () => {
      const url = "https://drive.google.com/file/d/1ABC123xyz_456/view?usp=sharing";
      expect(extractDriveFileId(url)).toBe("1ABC123xyz_456");
    });

    it("should extract file ID from query parameter Google Drive URL", () => {
      const url = "https://drive.google.com/open?id=1XYZ987abc_321";
      expect(extractDriveFileId(url)).toBe("1XYZ987abc_321");
    });

    it("should extract folder ID from Google Drive folder URL", () => {
      const url = "https://drive.google.com/drive/folders/1FOLDER_ID_999";
      expect(extractDriveFileId(url)).toBe("1FOLDER_ID_999");
    });

    it("should accept raw alphanumeric file ID", () => {
      const rawId = "1RawDriveFileIdSequence123456";
      expect(extractDriveFileId(rawId)).toBe(rawId);
    });

    it("should return null for invalid URLs or short inputs", () => {
      expect(extractDriveFileId("invalid-url")).toBeNull();
      expect(extractDriveFileId("")).toBeNull();
    });

    it("rejects spoofed hosts, credentials, insecure URLs, ports, and injected IDs", () => {
      expect(extractDriveFileId("https://drive.google.com.evil.example/file/d/1SAFE_FILE_ID_123/view")).toBeNull();
      expect(extractDriveFileId("https://drive.google.com@evil.example/file/d/1SAFE_FILE_ID_123/view")).toBeNull();
      expect(extractDriveFileId("http://drive.google.com/file/d/1SAFE_FILE_ID_123/view")).toBeNull();
      expect(extractDriveFileId("https://drive.google.com:444/file/d/1SAFE_FILE_ID_123/view")).toBeNull();
      expect(extractDriveFileId("https://drive.google.com/file/d/../../metadata/view")).toBeNull();
    });
  });

  describe("inferDocCategory", () => {
    it("should classify spreadsheets, presentations, and portfolios as business", () => {
      expect(inferDocCategory("Q3 Budget", "application/vnd.google-apps.spreadsheet")).toBe("business");
      expect(inferDocCategory("Team Business Portfolio 2026.pdf")).toBe("business");
    });

    it("should classify manuals, guides, and handbooks as guide", () => {
      expect(inferDocCategory("Pit Operations Guide.pdf")).toBe("guide");
      expect(inferDocCategory("Driver Control Handbook")).toBe("guide");
    });

    it("should default to spec for technical documents", () => {
      expect(inferDocCategory("Robot Subsystem Specifications.pdf")).toBe("spec");
      expect(inferDocCategory("CAD Design Schematics")).toBe("spec");
    });
  });

  describe("GET /api/drive/config", () => {
    it("should return saved folder ID from Firestore", async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ folderId: "1SAVED_FOLDER_ID" })
      });

      // Invoke route handler logic
      const handler = (driveRouter as any).stack.find(
        (s: any) => s.route && s.route.path === "/config" && s.route.methods.get
      ).route.stack[1].handle;

      await handler(req, res);
      expect(res.json).toHaveBeenCalledWith({ folderId: "1SAVED_FOLDER_ID" });
    });
  });

  describe("POST /api/drive/import", () => {
    it("should return metadata for a valid Google Drive link", async () => {
      req.body = { url: "https://drive.google.com/file/d/1TEST_FILE_ID/view" };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "1TEST_FILE_ID",
          name: "FTC Autonomous Pathing Guide.pdf",
          mimeType: "application/pdf",
          webViewLink: "https://drive.google.com/file/d/1TEST_FILE_ID/view",
          createdTime: "2026-08-01T12:00:00.000Z",
          description: "Comprehensive guide to autonomous navigation."
        })
      });

      const handler = (driveRouter as any).stack.find(
        (s: any) => s.route && s.route.path === "/import" && s.route.methods.post
      ).route.stack[1].handle;

      await handler(req, res);

      const requestedUrl = mockFetch.mock.calls[0][0] as URL;
      expect(requestedUrl).toBeInstanceOf(URL);
      expect(requestedUrl.origin).toBe("https://www.googleapis.com");
      expect(requestedUrl.pathname).toBe("/drive/v3/files/1TEST_FILE_ID");
      expect(mockFetch.mock.calls[0][1]).toMatchObject({ redirect: "error" });

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        file: {
          id: "1TEST_FILE_ID",
          title: "FTC Autonomous Pathing Guide",
          category: "guide",
          fileUrl: "https://drive.google.com/file/d/1TEST_FILE_ID/view",
          description: "Comprehensive guide to autonomous navigation.",
          createdAt: "2026-08-01"
        }
      });
    });
  });

  describe("POST /api/drive/sync", () => {
    it("should scan Drive folder and batch upsert files into Firestore documents collection", async () => {
      req.body = { folderId: "1DRIVE_FOLDER_123456789" };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            {
              id: "FILE_001",
              name: "Chassis Technical Spec.pdf",
              mimeType: "application/pdf",
              webViewLink: "https://drive.google.com/file/d/FILE_001/view",
              createdTime: "2026-08-05T10:00:00.000Z",
              description: "Technical specifications for the drivetrain."
            }
          ]
        })
      });

      const handler = (driveRouter as any).stack.find(
        (s: any) => s.route && s.route.path === "/sync" && s.route.methods.post
      ).route.stack[1].handle;

      await handler(req, res);

      const requestedUrl = mockFetch.mock.calls[0][0] as URL;
      expect(requestedUrl).toBeInstanceOf(URL);
      expect(requestedUrl.origin).toBe("https://www.googleapis.com");
      expect(requestedUrl.pathname).toBe("/drive/v3/files");
      expect(requestedUrl.searchParams.get("q")).toBe("'1DRIVE_FOLDER_123456789' in parents and trashed = false");
      expect(mockFetch.mock.calls[0][1]).toMatchObject({ redirect: "error" });

      expect(mockBatchSet).toHaveBeenCalled();
      expect(mockBatchCommit).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        syncedCount: 1,
        folderId: "1DRIVE_FOLDER_123456789",
        syncedFiles: [{ id: "FILE_001", name: "Chassis Technical Spec" }]
      });
    });
  });
});
