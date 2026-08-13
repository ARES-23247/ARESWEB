import { beforeEach, describe, expect, it, vi } from "vitest";

const queryGet = vi.fn();
const docGet = vi.fn();
const batchSet = vi.fn();
const batchUpdate = vi.fn();
const batchDelete = vi.fn();
const batchCommit = vi.fn();
const subDoc = vi.fn((id: string) => ({ id, kind: "sub-photo" }));
const subCollection = vi.fn(() => ({ doc: subDoc }));
const doc = vi.fn((id: string) => ({ id, get: docGet, collection: subCollection }));
const query: any = {
  where: vi.fn(() => query),
  orderBy: vi.fn(() => query),
  limit: vi.fn(() => query),
  startAfter: vi.fn(() => query),
  get: queryGet,
  doc,
};

vi.mock("../../lib/firebase-admin", () => ({
  adminFieldValue: { increment: vi.fn((value) => value) },
  adminDb: {
    collection: vi.fn(() => query),
    batch: vi.fn(() => ({
      set: batchSet,
      update: batchUpdate,
      delete: batchDelete,
      commit: batchCommit,
    })),
  },
  adminStorage: { bucket: vi.fn() },
  adminAuth: {},
}));
vi.mock("../../middleware/auth", () => ({
  ensureAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  ensureTeamMember: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../../lib/googleAuth", () => ({ getGooglePhotosAccessToken: vi.fn() }));

import photosRouter from "../photos";

function handler(path: string, method: string) {
  const layer = photosRouter.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  expect(layer).toBeDefined();
  return layer!.route!.stack.at(-1)!.handle;
}

function photo(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

describe("photos routes", () => {
  const res = { json: vi.fn().mockReturnThis(), status: vi.fn().mockReturnThis() };
  const next = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryGet.mockResolvedValue({ docs: [] });
    docGet.mockResolvedValue({ exists: true, data: () => ({}) });
    batchCommit.mockResolvedValue(undefined);
  });

  async function expectApiError(path: string, method: string, req: Record<string, unknown>, status: number, message: string) {
    await handler(path, method)(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status, message }));
  }

  describe("GET /", () => {
    it("returns an explicit paginated team DTO and strips provider data", async () => {
      queryGet.mockResolvedValue({ docs: [
        photo("photo-1", {
          publicUrl: "https://storage.googleapis.com/photo.jpg",
          thumbnailUrl: "https://storage.googleapis.com/photo-thumb.webp",
          thumbnailWidth: 480,
          thumbnailHeight: 270,
          mediumUrl: "https://storage.googleapis.com/photo-medium.webp",
          mediumWidth: 1280,
          mediumHeight: 720,
          width: 1600,
          height: 900,
          caption: " Robot ",
          altText: " Match photo ",
          labels: ["robot", 23, "x".repeat(50)],
          albumId: "album-1",
          mimeType: "image/png",
          fileSize: 42,
          importedAt: "2026-01-01",
          capturedAt: "2025-12-31",
          googleMediaItemId: "provider-id",
          storagePath: "private/path",
        }),
        photo("photo-2", { isDeleted: 1, publicUrl: "https://example.com/old.jpg" }),
        photo("photo-3", { publicUrl: "javascript:alert(1)", mimeType: "text/html", fileSize: -1 }),
      ] });

      await handler("/", "get")({ query: { albumId: "album-1", limit: "1" } }, res, next);

      const payload = res.json.mock.calls[0][0];
      expect(query.where).toHaveBeenCalledWith("albumId", "==", "album-1");
      expect(query.limit).toHaveBeenCalledWith(2);
      expect(payload).toMatchObject({ hasMore: true, nextCursor: "photo-1" });
      expect(payload.photos[0]).toMatchObject({
        id: "photo-1",
        publicUrl: "https://storage.googleapis.com/photo.jpg",
        caption: "Robot",
        labels: ["robot", "x".repeat(40)],
        isSynced: true,
        thumbnailUrl: "https://storage.googleapis.com/photo-thumb.webp",
        mediumUrl: "https://storage.googleapis.com/photo-medium.webp",
        width: 1600,
        height: 900,
      });
      expect(JSON.stringify(payload)).not.toContain("private/path");
      expect(JSON.stringify(payload)).not.toContain("provider-id");
    });

    it("supports archived records, cursor lookup, and safe DTO fallbacks", async () => {
      const cursorSnapshot = { exists: true, id: "cursor-1" };
      docGet.mockResolvedValueOnce(cursorSnapshot);
      queryGet.mockResolvedValueOnce({ docs: [photo("archived", {
        publicUrl: 12,
        caption: null,
        altText: null,
        labels: null,
        albumId: 7,
        mimeType: "text/plain",
        fileSize: -5,
        importedAt: null,
        googleMediaItemId: "",
        isDeleted: 1,
        archivedAt: "2026-01-02",
      })] });

      await handler("/", "get")({ query: { cursor: "cursor-1", includeArchived: "true", limit: "999" } }, res, next);

      expect(query.startAfter).toHaveBeenCalledWith(cursorSnapshot);
      expect(query.limit).toHaveBeenCalledWith(51);
      expect(res.json).toHaveBeenCalledWith({
        photos: [expect.objectContaining({
          publicUrl: "",
          labels: [],
          albumId: null,
          mimeType: "image/jpeg",
          fileSize: 0,
          importedAt: "",
          isSynced: false,
          isArchived: true,
          archivedAt: "2026-01-02",
        })],
        hasMore: false,
        nextCursor: null,
      });
    });

    it("uses the default limit for malformed input", async () => {
      await handler("/", "get")({ query: { limit: ["20"] } }, res, next);
      expect(query.limit).toHaveBeenCalledWith(31);
    });

    it("rejects invalid filters and missing cursors", async () => {
      await expectApiError("/", "get", { query: { albumId: "../private" } }, 400, "Invalid album ID.");
      next.mockClear();
      docGet.mockResolvedValueOnce({ exists: false });
      await expectApiError("/", "get", { query: { cursor: "missing" } }, 400, "Photo cursor was not found.");
      next.mockClear();
      await expectApiError("/", "get", { query: { cursor: "bad cursor" } }, 400, "Invalid photo cursor.");
    });
  });

  describe("GET /public", () => {
    it("returns an empty public DTO when no active public albums exist", async () => {
      queryGet.mockResolvedValueOnce({ docs: [photo("archived-album", { isPublic: true, isDeleted: 1 })] });
      await handler("/public", "get")({ query: {} }, res, next);
      expect(res.json).toHaveBeenCalledWith({ photos: [], hasMore: false, nextCursor: null });
    });

    it("filters private, archived, and unsafe photos while returning bounded public fields", async () => {
      queryGet
        .mockResolvedValueOnce({ docs: [
          photo("album", { category: "Competition", isDeleted: 0 }),
          photo("album-no-category", { category: 42, isDeleted: 0 }),
          photo("gone", { category: "Practice", isDeleted: 1 }),
        ] })
        .mockResolvedValueOnce({ docs: [
          photo("active", {
            albumId: "album",
            publicUrl: "https://storage.googleapis.com/active.jpg",
            thumbnailUrl: "https://storage.googleapis.com/active-thumb.webp",
            thumbnailWidth: 480,
            thumbnailHeight: 270,
            caption: " Robot ",
            altText: " Drive team ",
            capturedAt: "2026-01-01",
            location: " Arena ",
            description: "Finals",
            storagePath: "hidden",
          }),
          photo("unsafe", { albumId: "album", publicUrl: "http://example.com/no.jpg" }),
          photo("archived", { albumId: "album", publicUrl: "https://example.com/old.jpg", isDeleted: 1 }),
        ] });

      await handler("/public", "get")({ query: { limit: "1" } }, res, next);

      const payload = res.json.mock.calls[0][0];
      expect(payload).toEqual({
        photos: [{
          id: "active",
          publicUrl: "https://storage.googleapis.com/active.jpg",
          caption: "Robot",
          altText: "Drive team",
          category: "Competition",
          capturedAt: "2026-01-01",
          location: "Arena",
            description: "Finals",
            thumbnailUrl: "https://storage.googleapis.com/active-thumb.webp",
            thumbnailWidth: 480,
            thumbnailHeight: 270,
            mediumUrl: null,
            mediumWidth: null,
            mediumHeight: null,
            width: null,
            height: null,
          }],
        hasMore: true,
        nextCursor: "active",
      });
      expect(query.where).toHaveBeenCalledWith("albumId", "in", ["album", "album-no-category"]);
      expect(query.limit).toHaveBeenCalledWith(2);
      expect(JSON.stringify(payload)).not.toContain("hidden");
    });

    it("handles cursor paging, malformed optional text, and bounded candidate reads", async () => {
      const cursorSnapshot = { exists: true, id: "cursor" };
      docGet.mockResolvedValueOnce(cursorSnapshot);
      queryGet
        .mockResolvedValueOnce({ docs: [photo("album", { category: "", isDeleted: 0 })] })
        .mockResolvedValueOnce({ docs: Array.from({ length: 25 }, (_, index) => photo(`p-${index}`, {
          albumId: "album",
          publicUrl: `https://example.com/photo-${index}.jpg`,
          importedAt: `2026-01-${String(25 - index).padStart(2, "0")}`,
          caption: 12,
          altText: null,
          capturedAt: 5,
          location: null,
          description: undefined,
        })) });

      await handler("/public", "get")({ query: { cursor: "cursor", limit: "not-a-number" } }, res, next);

      expect(query.startAfter).toHaveBeenCalledWith(cursorSnapshot);
      expect(query.limit).toHaveBeenCalledWith(25);
      expect(res.json).toHaveBeenCalledWith({
        photos: expect.arrayContaining([expect.objectContaining({ id: "p-0", category: undefined })]),
        hasMore: true,
        nextCursor: "p-23",
      });
    });
  });

  describe("PATCH /:photoId", () => {
    it("updates metadata and moves a photo between album mirrors atomically", async () => {
      docGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ albumId: "old-album", labels: ["old"], caption: "Old", publicUrl: "https://example.com/a.jpg" }) })
        .mockResolvedValueOnce({ exists: true, data: () => ({ isDeleted: 0 }) });

      await handler("/:photoId", "patch")({
        params: { photoId: "photo-1" },
        body: { albumId: "new-album", caption: " Updated ", altText: " Robot ", labels: ["match", 4, ""] },
      }, res, next);

      expect(batchSet).toHaveBeenCalledWith(expect.objectContaining({ id: "photo-1" }), expect.objectContaining({
        caption: "Updated",
        altText: "Robot",
        labels: ["match"],
        albumId: "new-album",
      }), { merge: true });
      expect(batchUpdate).toHaveBeenCalledTimes(2);
      expect(batchDelete).toHaveBeenCalledOnce();
      expect(batchCommit).toHaveBeenCalledOnce();
      expect(res.json).toHaveBeenCalledWith({ success: true, photo: expect.objectContaining({ id: "photo-1", albumId: "new-album" }) });
    });

    it("preserves existing values and mirrors edits within the same album", async () => {
      docGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ albumId: "album", labels: ["old"], caption: "Keep", altText: "Keep alt" }) })
        .mockResolvedValueOnce({ exists: true, data: () => ({}) });
      await handler("/:photoId", "patch")({ params: { photoId: "photo-1" }, body: {} }, res, next);
      expect(batchUpdate).not.toHaveBeenCalled();
      expect(batchSet).toHaveBeenCalledTimes(2);
      expect(res.json).toHaveBeenCalledWith({ success: true, photo: expect.objectContaining({ caption: "Keep", labels: ["old"] }) });
    });

    it("allows removing a photo from an album", async () => {
      docGet.mockResolvedValueOnce({ exists: true, data: () => ({ albumId: "old", labels: [] }) });
      await handler("/:photoId", "patch")({ params: { photoId: "photo" }, body: { albumId: null } }, res, next);
      expect(batchUpdate).toHaveBeenCalledOnce();
      expect(batchDelete).toHaveBeenCalledOnce();
      expect(res.json).toHaveBeenCalledWith({ success: true, photo: expect.objectContaining({ albumId: null }) });
    });

    it("rejects invalid IDs, missing or archived photos, invalid labels, and inactive albums", async () => {
      await expectApiError("/:photoId", "patch", { params: { photoId: "../bad" }, body: {} }, 400, "Invalid photo ID.");
      next.mockClear();
      docGet.mockResolvedValueOnce({ exists: false });
      await expectApiError("/:photoId", "patch", { params: { photoId: "missing" }, body: {} }, 404, "Photo not found.");
      next.mockClear();
      docGet.mockResolvedValueOnce({ exists: true, data: () => ({ isDeleted: 1 }) });
      await expectApiError("/:photoId", "patch", { params: { photoId: "archived" }, body: {} }, 409, "Restore the photo before editing it.");
      next.mockClear();
      docGet.mockResolvedValueOnce({ exists: true, data: () => ({}) });
      await expectApiError("/:photoId", "patch", { params: { photoId: "photo" }, body: { labels: "robot" } }, 400, "Labels must be a list of text values.");
      next.mockClear();
      docGet
        .mockResolvedValueOnce({ exists: true, data: () => ({}) })
        .mockResolvedValueOnce({ exists: false });
      await expectApiError("/:photoId", "patch", { params: { photoId: "photo" }, body: { albumId: "missing" } }, 400, "Choose an active album.");
      next.mockClear();
      docGet
        .mockResolvedValueOnce({ exists: true, data: () => ({}) })
        .mockResolvedValueOnce({ exists: true, data: () => ({ isDeleted: 1 }) });
      await expectApiError("/:photoId", "patch", { params: { photoId: "photo" }, body: { albumId: "archived" } }, 400, "Choose an active album.");
    });
  });

  describe("archive and restore", () => {
    it("archives an album photo and updates its mirror without deleting storage", async () => {
      docGet.mockResolvedValueOnce({ exists: true, data: () => ({ albumId: "album", publicUrl: "https://example.com/photo.jpg" }) });
      await handler("/:photoId", "delete")({ params: { photoId: "photo-1" } }, res, next);
      expect(batchSet).toHaveBeenCalledTimes(2);
      expect(batchUpdate).toHaveBeenCalledOnce();
      expect(batchDelete).not.toHaveBeenCalled();
      expect(batchCommit).toHaveBeenCalledOnce();
      expect(res.json).toHaveBeenCalledWith({ success: true, archived: true });
    });

    it("treats repeat archive and restore operations as idempotent", async () => {
      docGet.mockResolvedValueOnce({ exists: true, data: () => ({ isDeleted: 1 }) });
      await handler("/:photoId", "delete")({ params: { photoId: "photo" } }, res, next);
      expect(res.json).toHaveBeenCalledWith({ success: true, archived: true, alreadyArchived: true });
      expect(batchCommit).not.toHaveBeenCalled();

      res.json.mockClear();
      docGet.mockResolvedValueOnce({ exists: true, data: () => ({ isDeleted: 0, publicUrl: "https://example.com/photo.jpg" }) });
      await handler("/:photoId/restore", "post")({ params: { photoId: "photo" } }, res, next);
      expect(res.json).toHaveBeenCalledWith({ success: true, restored: true, photo: expect.objectContaining({ id: "photo" }) });
      expect(batchCommit).not.toHaveBeenCalled();
    });

    it("restores an album photo and its mirror", async () => {
      docGet.mockResolvedValueOnce({ exists: true, data: () => ({ albumId: "album", isDeleted: 1, publicUrl: "https://example.com/photo.jpg" }) });
      await handler("/:photoId/restore", "post")({ params: { photoId: "photo-1" } }, res, next);
      expect(batchSet).toHaveBeenCalledTimes(2);
      expect(batchUpdate).toHaveBeenCalledOnce();
      expect(batchCommit).toHaveBeenCalledOnce();
      expect(res.json).toHaveBeenCalledWith({ success: true, restored: true, photo: expect.objectContaining({ isArchived: false }) });
    });

    it("rejects invalid or missing archive targets", async () => {
      await expectApiError("/:photoId", "delete", { params: { photoId: "bad id" } }, 400, "Invalid photo ID.");
      next.mockClear();
      docGet.mockResolvedValueOnce({ exists: false });
      await expectApiError("/:photoId", "delete", { params: { photoId: "missing" } }, 404, "Photo not found.");
      next.mockClear();
      docGet.mockResolvedValueOnce({ exists: false });
      await expectApiError("/:photoId/restore", "post", { params: { photoId: "missing" } }, 404, "Photo not found.");
    });
  });
});
