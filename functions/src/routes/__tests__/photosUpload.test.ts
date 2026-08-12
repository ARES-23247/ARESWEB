import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGet, mockSet, mockUpdate, mockSubSet, mockSubDelete,
  mockBatchUpdate, mockBatchSet, mockBatchCommit, mockSave, mockCollection,
} = vi.hoisted(() => {
  const mockGet = vi.fn();
  const mockSet = vi.fn();
  const mockUpdate = vi.fn();
  const mockSubSet = vi.fn();
  const mockSubDelete = vi.fn();
  const mockBatchUpdate = vi.fn();
  const mockBatchSet = vi.fn();
  const mockBatchCommit = vi.fn();
  const mockSave = vi.fn();
  const mockDoc = vi.fn((id: string) => ({
    id,
    get: mockGet,
    set: mockSet,
    update: mockUpdate,
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({ set: mockSubSet, delete: mockSubDelete })),
    })),
  }));
  const mockQuery: Record<string, ReturnType<typeof vi.fn>> = {};
  mockQuery.where = vi.fn(() => mockQuery);
  mockQuery.limit = vi.fn(() => mockQuery);
  mockQuery.get = mockGet;
  const mockCollection = vi.fn(() => ({ ...mockQuery, doc: mockDoc }));
  return {
    mockGet, mockSet, mockUpdate, mockSubSet, mockSubDelete,
    mockBatchUpdate, mockBatchSet, mockBatchCommit, mockSave, mockCollection,
  };
});

vi.mock("../../lib/firebase-admin", () => ({
  default: { firestore: { FieldValue: { increment: (value: number) => ({ increment: value }) } } },
  adminDb: {
    collection: mockCollection,
    batch: vi.fn(() => ({ update: mockBatchUpdate, set: mockBatchSet, commit: mockBatchCommit })),
  },
  adminStorage: {
    bucket: vi.fn(() => ({
      name: "test-bucket",
      file: vi.fn(() => ({ save: mockSave })),
    })),
  },
}));

vi.mock("../../middleware/auth", () => ({
  ensureTeamMember: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../lib/googleAuth", () => ({ getGooglePhotosAccessToken: vi.fn() }));
vi.mock("../../lib/imageImport", () => ({ validateImageMagicBytes: vi.fn() }));
vi.mock("../../lib/vertex", () => ({ generatePhotoCaptionAndLabels: vi.fn() }));
vi.mock("../../lib/photoDerivatives", () => ({
  generatePhotoDerivatives: vi.fn(),
  storePhotoAssets: vi.fn(),
  deleteStoredPhotoAssets: vi.fn(),
  photoDerivativeDtoFields: vi.fn((data: Record<string, unknown>) => ({
    thumbnailUrl: data.thumbnailUrl ?? null,
    thumbnailWidth: data.thumbnailWidth ?? null,
    thumbnailHeight: data.thumbnailHeight ?? null,
    mediumUrl: data.mediumUrl ?? null,
    mediumWidth: data.mediumWidth ?? null,
    mediumHeight: data.mediumHeight ?? null,
    width: data.width ?? null,
    height: data.height ?? null,
  })),
}));

import { getGooglePhotosAccessToken } from "../../lib/googleAuth";
import { validateImageMagicBytes } from "../../lib/imageImport";
import { generatePhotoCaptionAndLabels } from "../../lib/vertex";
import { deleteStoredPhotoAssets, generatePhotoDerivatives, storePhotoAssets } from "../../lib/photoDerivatives";
import router from "../photosUpload";

function handler() {
  const layer = router.stack.find((entry) => entry.route?.path === "/upload-unified" && entry.route.methods.post);
  expect(layer).toBeDefined();
  return layer!.route!.stack.at(-1)!.handle;
}

function imageBody(overrides: Record<string, unknown> = {}) {
  return {
    fileBase64: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]).toString("base64"),
    filename: "robot.jpg",
    mimeType: "image/jpeg",
    ...overrides,
  };
}

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

describe("Photos upload route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ empty: true });
    mockSet.mockResolvedValue(undefined);
    mockUpdate.mockResolvedValue(undefined);
    mockSubSet.mockResolvedValue(undefined);
    mockSubDelete.mockResolvedValue(undefined);
    mockBatchCommit.mockResolvedValue(undefined);
    mockSave.mockResolvedValue(undefined);
    vi.mocked(validateImageMagicBytes).mockReturnValue({ valid: true, format: "jpg" });
    vi.mocked(generatePhotoCaptionAndLabels).mockResolvedValue({ caption: "AI caption", labels: ["robot"] });
    vi.mocked(getGooglePhotosAccessToken).mockResolvedValue("team-token");
    vi.mocked(generatePhotoDerivatives).mockResolvedValue({
      width: 1600,
      height: 900,
      original: { buffer: Buffer.from("sanitized"), width: 1600, height: 900, fileSize: 7 },
      thumbnail: { buffer: Buffer.from("thumb"), width: 480, height: 270, fileSize: 5 },
      medium: { buffer: Buffer.from("medium"), width: 1280, height: 720, fileSize: 6 },
    });
    vi.mocked(storePhotoAssets).mockResolvedValue({
      storagePath: "gallery/original.jpg",
      publicUrl: "https://storage.test/original.jpg",
      thumbnailPath: "gallery/thumbnail.webp",
      thumbnailUrl: "https://storage.test/thumbnail.webp",
      thumbnailWidth: 480,
      thumbnailHeight: 270,
      thumbnailFileSize: 5,
      mediumPath: "gallery/medium.webp",
      mediumUrl: "https://storage.test/medium.webp",
      mediumWidth: 1280,
      mediumHeight: 720,
      mediumFileSize: 6,
      width: 1600,
      height: 900,
    });
    vi.mocked(deleteStoredPhotoAssets).mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

  it("registers authentication and upload throttling", () => {
    const layer = router.stack.find((entry) => entry.route?.path === "/upload-unified");
    expect(layer?.route?.stack).toHaveLength(3);
    expect(layer?.route?.stack.map((entry) => entry.name)).toContain("ensureTeamMember");
  });

  it.each([
    [{}, 400, "Missing required fields"],
    [imageBody({ filename: "x".repeat(181) }), 400, "filename under 180"],
    [imageBody({ mimeType: "image/gif" }), 400, "JPEG, PNG, or WebP"],
    [imageBody({ albumId: "bad/album" }), 400, "Invalid album ID"],
    [imageBody({ fileBase64: "" }), 400, "Missing required fields"],
  ])("rejects invalid upload %#", async (body, status, message) => {
    await expect(handler()({ body }, response())).rejects.toMatchObject({ status, message: expect.stringContaining(message) });
  });

  it("rejects missing or archived albums", async () => {
    mockGet.mockResolvedValueOnce({ exists: false });
    await expect(handler()({ body: imageBody({ albumId: "album-1" }) }, response())).rejects.toMatchObject({ status: 400 });

    vi.clearAllMocks();
    mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ isDeleted: 1 }) });
    await expect(handler()({ body: imageBody({ albumId: "album-1" }) }, response())).rejects.toMatchObject({ status: 400 });
  });

  it("rejects empty, oversized, and magic-byte-invalid images", async () => {
    await expect(handler()({ body: imageBody({ fileBase64: "=" }) }, response())).rejects.toMatchObject({ status: 413 });

    await expect(handler()({ body: imageBody({ fileBase64: Buffer.alloc(8 * 1024 * 1024 + 1).toString("base64") }) }, response())).rejects.toMatchObject({ status: 413 });

    vi.mocked(validateImageMagicBytes).mockReturnValueOnce({ valid: false, error: "Signature mismatch" });
    await expect(handler()({ body: imageBody() }, response())).rejects.toMatchObject({ status: 400, message: "Signature mismatch" });
  });

  it("rejects a declared MIME type that does not match the file signature", async () => {
    vi.mocked(validateImageMagicBytes).mockReturnValueOnce({ valid: true, format: "png" });
    await expect(handler()({ body: imageBody({ mimeType: "image/jpeg" }) }, response())).rejects.toMatchObject({
      status: 400,
      message: "The declared image type does not match the file contents.",
    });
  });

  it("returns an active cached photo without exposing storage metadata", async () => {
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{
        id: "existing-photo",
        ref: { id: "existing-photo" },
        data: () => ({ publicUrl: "https://storage.test/photo.jpg", labels: "legacy", googleMediaItemId: "internal", fileSize: 25 }),
      }],
    });
    const res = response();
    await handler()({ body: imageBody() }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      cached: true,
      photo: expect.objectContaining({ id: "existing-photo", labels: [], isSynced: true, isArchived: false }),
    }));
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain("googleMediaItemId");
  });

  it("rejects a duplicate archived image", async () => {
    mockGet.mockResolvedValueOnce({ empty: false, docs: [{ id: "archived", data: () => ({ isDeleted: 1 }) }] });
    await expect(handler()({ body: imageBody() }, response())).rejects.toMatchObject({ status: 409 });
  });

  it("moves a cached image between active albums with one atomic batch", async () => {
    mockGet
      .mockResolvedValueOnce({ exists: true, data: () => ({ isDeleted: 0 }) })
      .mockResolvedValueOnce({
        empty: false,
        docs: [{ id: "photo-1", ref: { path: "imported_photos/photo-1" }, data: () => ({ publicUrl: "https://storage.test/photo.jpg", albumId: "old-album" }) }],
      });
    const res = response();
    await handler()({ body: imageBody({ albumId: "new-album" }) }, res);
    expect(mockBatchUpdate).toHaveBeenCalled();
    expect(mockBatchSet).toHaveBeenCalled();
    expect(mockBatchCommit).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockSubDelete).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ cached: true, photo: expect.objectContaining({ albumId: "new-album" }) }));
  });

  it("uploads, labels, stores, and links a new image to an album", async () => {
    mockGet
      .mockResolvedValueOnce({ exists: true, data: () => ({ isDeleted: 0 }) })
      .mockResolvedValueOnce({ empty: true });
    const res = response();
    await handler()({ body: imageBody({ albumId: "album-1", runAiLabeling: true }) }, res);
    expect(storePhotoAssets).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ mimeType: "image/jpeg" }), expect.stringContaining("gallery/derivatives/"), expect.anything());
    expect(generatePhotoCaptionAndLabels).toHaveBeenCalledWith(Buffer.from("sanitized"), "image/jpeg");
    expect(mockBatchSet).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ caption: "AI caption", labels: ["robot"], isDeleted: 0, fileSize: 7, thumbnailUrl: "https://storage.test/thumbnail.webp" }));
    expect(mockBatchUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ mediaCount: expect.anything() }));
    expect(mockBatchCommit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      photo: expect.objectContaining({
        thumbnailUrl: "https://storage.test/thumbnail.webp",
        mediumUrl: "https://storage.test/medium.webp",
        width: 1600,
        height: 900,
      }),
    }));
  });

  it("rejects an image that cannot be decoded without writing Storage", async () => {
    vi.mocked(generatePhotoDerivatives).mockRejectedValueOnce(new Error("decode failed"));
    await expect(handler()({ body: imageBody() }, response())).rejects.toMatchObject({
      status: 400,
      message: "The image could not be decoded safely.",
    });
    expect(storePhotoAssets).not.toHaveBeenCalled();
  });

  it("cleans up all assets when Firestore metadata persistence fails", async () => {
    mockBatchCommit.mockRejectedValueOnce(new Error("Firestore unavailable"));
    await expect(handler()({ body: imageBody() }, response())).rejects.toThrow("Firestore unavailable");
    expect(deleteStoredPhotoAssets).toHaveBeenCalledOnce();
  });

  it("keeps a successful site upload when optional AI labeling fails", async () => {
    vi.mocked(generatePhotoCaptionAndLabels).mockRejectedValueOnce(new Error("AI unavailable"));
    const res = response();
    await handler()({ body: imageBody({ runAiLabeling: true }) }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ photo: expect.objectContaining({ caption: "", labels: [] }) }));
  });

  it("syncs an uploaded image to the team Google library", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => "upload-token" })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ newMediaItemResults: [{ status: { message: "Success" }, mediaItem: { id: "google-photo" } }] }) }));
    const res = response();
    await handler()({ body: imageBody({ uploadToGoogle: true, runAiLabeling: true }) }, res);
    expect(fetch).toHaveBeenCalledTimes(2);
    const uploadBody = vi.mocked(fetch).mock.calls[0]?.[1]?.body;
    expect(Buffer.from(uploadBody as Uint8Array)).toEqual(Buffer.from("sanitized"));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      photo: expect.objectContaining({ isSynced: true }),
      googleSync: { requested: true, succeeded: true, warning: null },
    }));
  });

  it.each([
    [
      [{ ok: false, status: 503, statusText: "Unavailable" }],
      "Google upload failed",
    ],
    [
      [{ ok: true, text: async () => "token" }, { ok: false, status: 400, statusText: "Bad Request" }],
      "Google batch create failed",
    ],
    [
      [{ ok: true, text: async () => "token" }, { ok: true, json: async () => ({ newMediaItemResults: [{ status: { message: "Rejected" } }] }) }],
      "Google creation status",
    ],
  ])("returns a non-secret warning when optional Google sync fails %#", async (responses, _expectedInternalError) => {
    const fetchMock = vi.fn();
    for (const item of responses) fetchMock.mockResolvedValueOnce(item);
    vi.stubGlobal("fetch", fetchMock);
    const res = response();
    await handler()({ body: imageBody({ uploadToGoogle: true }) }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      googleSync: { requested: true, succeeded: false, warning: "The image was saved to the team site, but Google Photos sync failed." },
    }));
  });
});
