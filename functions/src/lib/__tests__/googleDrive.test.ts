import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../googleAuth", () => ({ getGoogleDriveAccessToken: vi.fn().mockResolvedValue("drive-token") }));

import {
  exportGoogleDocumentText,
  getGoogleDriveFile,
  getGoogleDriveStartPageToken,
  isDriveItemWithinRoot,
  isGoogleDriveId,
  listGoogleDriveChanges,
  listGoogleDriveFolder,
} from "../googleDrive";

const ROOT = "1ROOT_FOLDER_123456789";
const CHILD = "1CHILD_FILE_123456789";

function driveFile(overrides: Record<string, unknown> = {}) {
  return {
    id: CHILD,
    name: "Robot manual.pdf",
    mimeType: "application/pdf",
    webViewLink: `https://drive.google.com/file/d/${CHILD}/view`,
    createdTime: "2026-01-01T00:00:00.000Z",
    modifiedTime: "2026-08-13T00:00:00.000Z",
    description: "Reference",
    parents: [ROOT],
    trashed: false,
    md5Checksum: "abc123",
    size: "2048",
    ...overrides,
  };
}

describe("Google Drive API client", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("recognizes only bounded Drive identifiers", () => {
    expect(isGoogleDriveId(CHILD)).toBe(true);
    expect(isGoogleDriveId("short")).toBe(false);
    expect(isGoogleDriveId("../credential")).toBe(false);
  });

  it("fetches and minimizes a Drive file record", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(driveFile()), { status: 200 }));
    await expect(getGoogleDriveFile(CHILD)).resolves.toMatchObject({
      id: CHILD,
      name: "Robot manual.pdf",
      parents: [ROOT],
      size: "2048",
    });
    const [url, request] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain(`/drive/v3/files/${CHILD}`);
    expect((request?.headers as Record<string, string>).Authorization).toBe("Bearer drive-token");
    expect(request).toMatchObject({ redirect: "error" });
  });

  it("replaces an untrusted web link with the canonical Drive URL", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(driveFile({ webViewLink: "https://evil.example/file" })), { status: 200 }));
    const file = await getGoogleDriveFile(CHILD);
    expect(file.webViewLink).toBe(`https://drive.google.com/open?id=${CHILD}`);
  });

  it("maps missing, authorization, and upstream failures to safe API errors", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(getGoogleDriveFile(CHILD)).rejects.toMatchObject({ status: 404 });
    await expect(getGoogleDriveFile(CHILD)).rejects.toMatchObject({ status: 503 });
    await expect(getGoogleDriveFile(CHILD)).rejects.toMatchObject({ status: 502 });
  });

  it("lists a bounded, paginated folder with shared-drive compatibility", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      files: [driveFile()],
      nextPageToken: "next-page_123",
    }), { status: 200 }));
    const page = await listGoogleDriveFolder({ folderId: ROOT, pageSize: 25 });
    expect(page.files).toHaveLength(1);
    expect(page.nextPageToken).toBe("next-page_123");
    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    expect(url.searchParams.get("q")).toBe(`'${ROOT}' in parents and trashed = false`);
    expect(url.searchParams.get("includeItemsFromAllDrives")).toBe("true");
    expect(url.searchParams.get("pageSize")).toBe("25");
  });

  it("rejects malformed cursors before making a Drive request", async () => {
    await expect(listGoogleDriveFolder({ folderId: ROOT, pageSize: 25, pageToken: "bad\ntoken" })).rejects.toMatchObject({ status: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("verifies ancestry without trusting a client-provided folder", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(driveFile()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(driveFile({ id: ROOT, parents: [] })), { status: 200 }));
    await expect(isDriveItemWithinRoot(CHILD, ROOT)).resolves.toBe(true);
    await expect(isDriveItemWithinRoot("1OUTSIDE_FILE_123456", ROOT)).resolves.toBe(false);
  });

  it("exports bounded Google Doc text and declines oversized content", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("Drive document text", { status: 200 }))
      .mockResolvedValueOnce(new Response("x", { status: 200, headers: { "content-length": String(300 * 1024) } }));
    await expect(exportGoogleDocumentText(CHILD)).resolves.toBe("Drive document text");
    await expect(exportGoogleDocumentText(CHILD)).resolves.toBeNull();
  });

  it("reads start cursors and explicit, minimized change records", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ startPageToken: "start_123" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        changes: [
          { fileId: CHILD, removed: false, file: driveFile() },
          { fileId: "invalid", removed: true },
        ],
        newStartPageToken: "start_456",
      }), { status: 200 }));
    await expect(getGoogleDriveStartPageToken()).resolves.toBe("start_123");
    await expect(listGoogleDriveChanges("start_123")).resolves.toMatchObject({
      changes: [{ fileId: CHILD, removed: false }],
      nextPageToken: null,
      newStartPageToken: "start_456",
    });
  });
});
