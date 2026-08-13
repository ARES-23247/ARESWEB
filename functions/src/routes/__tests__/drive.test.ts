import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  browseDriveFolder: vi.fn(),
  configureDriveRoot: vi.fn(),
  getDriveConfiguration: vi.fn(),
  importDriveDrafts: vi.fn(),
  syncImportedDriveChanges: vi.fn(),
  getGoogleDriveFile: vi.fn(),
  isDriveItemWithinRoot: vi.fn(),
}));

vi.mock("../../lib/googleDriveLibrary", () => ({
  ...mocks,
  inferDriveDocumentCategory: (name: string, mimeType = "") => {
    const combined = `${name} ${mimeType}`.toLowerCase();
    if (/spreadsheet|presentation|business|portfolio|finance|budget|sponsor/u.test(combined)) return "business";
    if (/guide|manual|tutorial|checklist|rule|handbook/u.test(combined)) return "guide";
    return "spec";
  },
}));

vi.mock("../../lib/googleDrive", () => ({
  getGoogleDriveFile: mocks.getGoogleDriveFile,
  isDriveItemWithinRoot: mocks.isDriveItemWithinRoot,
  GOOGLE_DRIVE_FOLDER_MIME_TYPE: "application/vnd.google-apps.folder",
}));
vi.mock("../../middleware/auth", () => ({
  ensureAdmin: (req: { user?: { uid: string } }, _res: unknown, next: (error?: unknown) => void) => {
    req.user = { uid: "admin-1" };
    next();
  },
}));
vi.mock("../../middleware/distributedQuota", () => ({
  distributedQuota: () => function enforceDistributedQuota(_req: unknown, _res: unknown, next: (error?: unknown) => void) {
    next();
  },
}));

import driveRouter, { extractDriveFileId, inferDocCategory } from "../drive";

interface TestRequest {
  body: Record<string, unknown>;
  user?: { uid: string };
}

function responseRecorder() {
  return {
    statusCode: 200,
    payload: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.payload = payload;
      return this;
    },
  };
}

function routeLayer(path: string, method: "get" | "post") {
  const layer = driveRouter.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  if (!layer?.route) throw new Error(`Route ${method.toUpperCase()} ${path} was not registered.`);
  return layer.route;
}

async function invoke(path: string, method: "get" | "post", body: Record<string, unknown> = {}) {
  const route = routeLayer(path, method);
  const req: TestRequest = { body };
  const res = responseRecorder();
  const dispatch = async (index: number): Promise<void> => {
    const handler = route.stack[index]?.handle;
    if (!handler) return;
    let nextPromise: Promise<void> | null = null;
    const next = (error?: unknown) => {
      nextPromise = error ? Promise.reject(error) : dispatch(index + 1);
    };
    await handler(req, res, next);
    if (nextPromise) await nextPromise;
  };
  await dispatch(0);
  return { req, res };
}

describe("Google Drive routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = "public-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN = "drive-refresh";
    mocks.getDriveConfiguration.mockResolvedValue({
      folderId: "1ROOT_FOLDER_123456789",
      folderName: "Team files",
      updatedAt: "2026-08-13T00:00:00.000Z",
      lastChangeCheckAt: null,
      lastChangeCount: 0,
    });
    mocks.isDriveItemWithinRoot.mockResolvedValue(true);
  });

  it("extracts only exact HTTPS Drive URLs or sufficiently long raw IDs", () => {
    expect(extractDriveFileId("https://drive.google.com/file/d/1SAFE_FILE_ID_123/view")).toBe("1SAFE_FILE_ID_123");
    expect(extractDriveFileId("https://drive.google.com/drive/folders/1SAFE_FOLDER_ID_123")).toBe("1SAFE_FOLDER_ID_123");
    expect(extractDriveFileId("1RawDriveFileIdSequence123456")).toBe("1RawDriveFileIdSequence123456");
    expect(extractDriveFileId("https://drive.google.com.evil.example/file/d/1SAFE_FILE_ID_123/view")).toBeNull();
    expect(extractDriveFileId("https://user@drive.google.com/file/d/1SAFE_FILE_ID_123/view")).toBeNull();
    expect(extractDriveFileId("http://drive.google.com/file/d/1SAFE_FILE_ID_123/view")).toBeNull();
    expect(extractDriveFileId("invalid")).toBeNull();
  });

  it("keeps deterministic document category inference", () => {
    expect(inferDocCategory("Team Budget", "application/vnd.google-apps.spreadsheet")).toBe("business");
    expect(inferDocCategory("Pit Manual", "application/pdf")).toBe("guide");
    expect(inferDocCategory("Chassis Spec", "application/pdf")).toBe("spec");
  });

  it("returns only safe connection state and public Picker identifiers", async () => {
    const { res } = await invoke("/status", "get");
    expect(res.payload).toMatchObject({
      provider: "google-drive",
      credentialConfigured: true,
      credentialStorage: "secret-manager",
      folderConfigured: true,
      oauthClientId: "public-client-id",
    });
    expect(JSON.stringify(res.payload)).not.toContain("drive-refresh");
    expect(JSON.stringify(res.payload)).not.toContain('"secret"');
  });

  it("returns the explicit configuration DTO", async () => {
    const { res } = await invoke("/config", "get");
    expect(res.payload).toEqual(await mocks.getDriveConfiguration.mock.results[0].value);
  });

  it("validates and saves a selected folder through the complete route chain", async () => {
    mocks.configureDriveRoot.mockResolvedValue({ folderId: "1SAFE_FOLDER_ID_123", folderName: "Team files" });
    const { req, res } = await invoke("/config", "post", {
      folderId: "https://drive.google.com/drive/folders/1SAFE_FOLDER_ID_123",
      ignored: "removed",
    }).catch((error) => ({ req: null, res: error }));
    // Strict validation rejects unknown properties before any Drive call.
    expect(req).toBeNull();
    expect(res).toMatchObject({ status: 400 });

    const valid = await invoke("/config", "post", { folderId: "1RawDriveFolderIdentifier123" });
    expect(mocks.configureDriveRoot).toHaveBeenCalledWith("1RawDriveFolderIdentifier123");
    expect(valid.res.payload).toMatchObject({ success: true });
  });

  it("browses a bounded page after authorization, quota, and schema validation", async () => {
    mocks.browseDriveFolder.mockResolvedValue({ files: [], nextPageToken: null });
    const { req, res } = await invoke("/browse", "post", { pageSize: 25 });
    expect(req.user).toEqual({ uid: "admin-1" });
    expect(mocks.browseDriveFolder).toHaveBeenCalledWith({ pageSize: 25 });
    expect(res.payload).toEqual({ files: [], nextPageToken: null });
    expect(routeLayer("/browse", "post").stack.map((entry) => entry.name)).toEqual([
      "ensureAdmin", "enforceDistributedQuota", expect.any(String), expect.any(String),
    ]);
  });

  it("imports selected files only through the draft endpoint", async () => {
    mocks.importDriveDrafts.mockResolvedValue([{ id: "1SAFE_FILE_ID_123", slug: "drive_1SAFE_FILE_ID_123", outcome: "created" }]);
    const { res } = await invoke("/import-drafts", "post", {
      folderId: "1SAFE_FOLDER_ID_123",
      fileIds: ["1SAFE_FILE_ID_123"],
      includeGoogleDocText: true,
    });
    expect(res.statusCode).toBe(201);
    expect(mocks.importDriveDrafts).toHaveBeenCalledWith({
      folderId: "1SAFE_FOLDER_ID_123",
      fileIds: ["1SAFE_FILE_ID_123"],
      includeGoogleDocText: true,
    });
  });

  it("checks incremental changes through a bounded administrative route", async () => {
    mocks.syncImportedDriveChanges.mockResolvedValue({ checkedChanges: 2, updatedDocuments: 1, hasMore: false });
    const { res } = await invoke("/changes/check", "post");
    expect(res.payload).toEqual({ success: true, checkedChanges: 2, updatedDocuments: 1, hasMore: false });
  });

  it("keeps single-file metadata import read-only and explicit", async () => {
    mocks.getGoogleDriveFile.mockResolvedValue({
      id: "1SAFE_FILE_ID_123",
      name: "Pit Manual.pdf",
      mimeType: "application/pdf",
      webViewLink: "https://drive.google.com/file/d/1SAFE_FILE_ID_123/view",
      createdTime: "2026-08-01T00:00:00.000Z",
      description: "Pit procedures",
    });
    const { res } = await invoke("/import", "post", { url: "https://drive.google.com/file/d/1SAFE_FILE_ID_123/view" });
    expect(mocks.isDriveItemWithinRoot).toHaveBeenCalledWith(
      "1SAFE_FILE_ID_123",
      "1ROOT_FOLDER_123456789",
    );
    expect(res.payload).toMatchObject({ success: true, file: { title: "Pit Manual", category: "guide" } });
  });

  it("rejects a manual file outside the configured Drive root", async () => {
    mocks.isDriveItemWithinRoot.mockResolvedValue(false);

    await expect(invoke("/import", "post", {
      fileId: "1OUTSIDE_FILE_ID_123456",
    })).rejects.toMatchObject({ status: 403 });
    expect(mocks.getGoogleDriveFile).not.toHaveBeenCalled();
  });

  it("fails closed when an old client calls the retired auto-publish route", async () => {
    await expect(invoke("/sync", "post")).rejects.toMatchObject({ status: 410 });
    expect(mocks.importDriveDrafts).not.toHaveBeenCalled();
  });
});
