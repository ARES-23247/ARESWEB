import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => {
  const documents = new Map<string, { exists: boolean; data: () => Record<string, unknown> }>();
  const configGet = vi.fn();
  const configSet = vi.fn();
  const batchSet = vi.fn();
  const batchCommit = vi.fn();
  return { documents, configGet, configSet, batchSet, batchCommit };
});

const driveMocks = vi.hoisted(() => ({
  exportGoogleDocumentText: vi.fn(),
  getGoogleDriveFile: vi.fn(),
  getGoogleDriveStartPageToken: vi.fn(),
  isDriveItemWithinRoot: vi.fn(),
  listGoogleDriveChanges: vi.fn(),
  listGoogleDriveFolder: vi.fn(),
}));

vi.mock("../firebase-admin", () => ({
  adminDb: {
    doc: () => ({ get: dbMocks.configGet, set: dbMocks.configSet }),
    collection: () => ({
      doc: (id: string) => ({
        id,
        get: vi.fn(async () => dbMocks.documents.get(id) ?? { exists: false, data: () => ({}) }),
      }),
    }),
    batch: () => ({ set: dbMocks.batchSet, commit: dbMocks.batchCommit }),
  },
}));

vi.mock("../googleDrive", () => ({
  ...driveMocks,
  GOOGLE_DOCUMENT_MIME_TYPE: "application/vnd.google-apps.document",
  GOOGLE_DRIVE_FOLDER_MIME_TYPE: "application/vnd.google-apps.folder",
}));

import {
  browseDriveFolder,
  configureDriveRoot,
  getDriveConfiguration,
  importDriveDrafts,
  inferDriveDocumentCategory,
  syncImportedDriveChanges,
} from "../googleDriveLibrary";

const ROOT = "1ROOT_FOLDER_123456789";
const FILE = "1DRIVE_FILE_123456789";
const CONFIG = {
  rootFolderId: ROOT,
  rootFolderName: "Team files",
  changePageToken: "change_123",
  updatedAt: "2026-08-13T00:00:00.000Z",
};

function snapshot(data: Record<string, unknown>) {
  return { exists: true, data: () => data };
}

function file(overrides: Record<string, unknown> = {}) {
  return {
    id: FILE,
    name: "Robot Guide",
    mimeType: "application/vnd.google-apps.document",
    webViewLink: `https://drive.google.com/file/d/${FILE}/view`,
    createdTime: "2026-01-02T00:00:00.000Z",
    modifiedTime: "2026-08-13T00:00:00.000Z",
    description: "Robot documentation",
    parents: [ROOT],
    trashed: false,
    md5Checksum: null,
    size: null,
    ...overrides,
  };
}

describe("Google Drive document library", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.documents.clear();
    dbMocks.configGet.mockResolvedValue(snapshot(CONFIG));
    dbMocks.configSet.mockResolvedValue(undefined);
    dbMocks.batchCommit.mockResolvedValue(undefined);
    driveMocks.isDriveItemWithinRoot.mockResolvedValue(true);
    driveMocks.getGoogleDriveStartPageToken.mockResolvedValue("change_456");
    driveMocks.exportGoogleDocumentText.mockResolvedValue("Imported document text");
  });

  it("classifies likely business, guide, and specification files", () => {
    expect(inferDriveDocumentCategory("Budget", "application/vnd.google-apps.spreadsheet")).toBe("business");
    expect(inferDriveDocumentCategory("Safety handbook", "application/pdf")).toBe("guide");
    expect(inferDriveDocumentCategory("Chassis dimensions", "application/pdf")).toBe("spec");
  });

  it("returns an empty explicit configuration when setup is incomplete", async () => {
    dbMocks.configGet.mockResolvedValueOnce({ exists: false, data: () => ({}) });
    await expect(getDriveConfiguration()).resolves.toEqual({
      folderId: "",
      folderName: "",
      updatedAt: null,
      lastChangeCheckAt: null,
      lastChangeCount: 0,
    });
  });

  it("validates a folder and initializes its change cursor", async () => {
    driveMocks.getGoogleDriveFile.mockResolvedValue(file({
      id: ROOT,
      name: "Team files",
      mimeType: "application/vnd.google-apps.folder",
      parents: [],
    }));
    const config = await configureDriveRoot(ROOT);
    expect(config).toMatchObject({ folderId: ROOT, folderName: "Team files" });
    expect(dbMocks.configSet).toHaveBeenCalledWith(expect.objectContaining({
      rootFolderId: ROOT,
      changePageToken: "change_456",
    }));
  });

  it("rejects a non-folder configuration target", async () => {
    driveMocks.getGoogleDriveFile.mockResolvedValue(file());
    await expect(configureDriveRoot(FILE)).rejects.toMatchObject({ status: 400 });
    expect(dbMocks.configSet).not.toHaveBeenCalled();
  });

  it("browses a configured nested folder and reports import state", async () => {
    driveMocks.getGoogleDriveFile.mockResolvedValue(file({
      id: ROOT,
      name: "Team files",
      mimeType: "application/vnd.google-apps.folder",
      parents: [],
    }));
    driveMocks.listGoogleDriveFolder.mockResolvedValue({ files: [file()], nextPageToken: "page_2" });
    dbMocks.documents.set(`drive_${FILE}`, snapshot({
      source: "google_drive",
      driveFileId: FILE,
      status: "draft",
      driveSyncState: "changed",
    }));
    const result = await browseDriveFolder({ pageSize: 25 });
    expect(result.currentFolder).toEqual({ id: ROOT, name: "Team files" });
    expect(result.files[0]).toMatchObject({
      id: FILE,
      kind: "file",
      imported: { slug: `drive_${FILE}`, status: "draft", syncState: "changed" },
    });
    expect(result.nextPageToken).toBe("page_2");
  });

  it("rejects browsing outside the configured root", async () => {
    driveMocks.isDriveItemWithinRoot.mockResolvedValueOnce(false);
    await expect(browseDriveFolder({ folderId: "1OUTSIDE_FOLDER_12345", pageSize: 25 })).rejects.toMatchObject({ status: 403 });
    expect(driveMocks.listGoogleDriveFolder).not.toHaveBeenCalled();
  });

  it("creates only unpublished drafts and optionally imports bounded Google Doc text", async () => {
    driveMocks.getGoogleDriveFile.mockResolvedValue(file());
    const result = await importDriveDrafts({ folderId: ROOT, fileIds: [FILE], includeGoogleDocText: true });
    expect(result).toEqual([expect.objectContaining({ outcome: "created", textImported: true })]);
    expect(dbMocks.batchSet).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      source: "google_drive",
      status: "draft",
      approvalStatus: "draft",
      content: "Imported document text",
    }));
    const written = dbMocks.batchSet.mock.calls[0][1];
    expect(written.status).not.toBe("published");
  });

  it("refreshes source metadata without overwriting an existing document body or status", async () => {
    driveMocks.getGoogleDriveFile.mockResolvedValue(file());
    dbMocks.documents.set(`drive_${FILE}`, snapshot({ source: "google_drive", driveFileId: FILE, status: "published" }));
    const result = await importDriveDrafts({ folderId: ROOT, fileIds: [FILE], includeGoogleDocText: false });
    expect(result[0].outcome).toBe("updated");
    const update = dbMocks.batchSet.mock.calls[0][1];
    expect(update).not.toHaveProperty("status");
    expect(update).not.toHaveProperty("content");
    expect(dbMocks.batchSet.mock.calls[0][2]).toEqual({ merge: true });
  });

  it("rejects stale selections and reserved identifier collisions", async () => {
    driveMocks.getGoogleDriveFile.mockResolvedValueOnce(file({ parents: ["1OTHER_FOLDER_123456"] }));
    await expect(importDriveDrafts({ folderId: ROOT, fileIds: [FILE], includeGoogleDocText: false })).rejects.toMatchObject({ status: 400 });

    driveMocks.getGoogleDriveFile.mockResolvedValueOnce(file());
    dbMocks.documents.set(`drive_${FILE}`, snapshot({ source: "manual" }));
    await expect(importDriveDrafts({ folderId: ROOT, fileIds: [FILE], includeGoogleDocText: false })).rejects.toMatchObject({ status: 409 });
  });

  it("marks linked documents for review and advances the Drive change cursor", async () => {
    driveMocks.listGoogleDriveChanges.mockResolvedValue({
      changes: [{ fileId: FILE, removed: false, file: file({ name: "Renamed guide" }) }],
      nextPageToken: null,
      newStartPageToken: "change_789",
    });
    dbMocks.documents.set(`drive_${FILE}`, snapshot({ source: "google_drive", driveFileId: FILE }));
    const result = await syncImportedDriveChanges();
    expect(result).toEqual({ checkedChanges: 1, updatedDocuments: 1, hasMore: false });
    expect(dbMocks.batchSet).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      driveSyncState: "changed",
      driveName: "Renamed guide",
    }), { merge: true });
    expect(dbMocks.configSet).toHaveBeenCalledWith(expect.objectContaining({
      changePageToken: "change_789",
      lastChangeCount: 1,
    }), { merge: true });
  });

  it("marks removed files without deleting or archiving website records", async () => {
    driveMocks.listGoogleDriveChanges.mockResolvedValue({
      changes: [{ fileId: FILE, removed: true, file: null }],
      nextPageToken: null,
      newStartPageToken: "change_999",
    });
    dbMocks.documents.set(`drive_${FILE}`, snapshot({ source: "google_drive", driveFileId: FILE, status: "published" }));
    await syncImportedDriveChanges();
    const update = dbMocks.batchSet.mock.calls[0][1];
    expect(update.driveSyncState).toBe("removed");
    expect(update).not.toHaveProperty("status");
    expect(update).not.toHaveProperty("isDeleted");
  });

  it("fails clearly when no valid root configuration exists", async () => {
    dbMocks.configGet.mockResolvedValue({ exists: false, data: () => ({}) });
    await expect(browseDriveFolder({ pageSize: 25 })).rejects.toMatchObject({ status: 409 });
    await expect(syncImportedDriveChanges()).rejects.toMatchObject({ status: 409 });
  });
});
