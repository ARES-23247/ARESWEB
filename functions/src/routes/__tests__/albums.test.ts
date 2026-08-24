import { beforeEach, describe, expect, it, vi } from "vitest";

const queryGet = vi.fn();
const docGet = vi.fn();
const docSet = vi.fn();
const getAll = vi.fn();
const batchUpdate = vi.fn();
const batchSet = vi.fn();
const batchDelete = vi.fn();
const batchCommit = vi.fn();
const subDoc = vi.fn((id: string) => ({ id, kind: "album-photo" }));
const subCollection = vi.fn(() => ({ doc: subDoc }));
const albumDoc = vi.fn((id: string) => ({ id, get: docGet, set: docSet, collection: subCollection }));
const photoDoc = vi.fn((id: string) => ({ id, get: docGet, kind: "photo-ref" }));
const albumQuery: any = {
  orderBy: vi.fn(() => albumQuery),
  limit: vi.fn(() => albumQuery),
  startAfter: vi.fn(() => albumQuery),
  get: queryGet,
  doc: albumDoc,
};
const photoCollection = { doc: photoDoc };

vi.mock("../../lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn((name: string) => name === "albums" ? albumQuery : photoCollection),
    getAll: (...refs: unknown[]) => getAll(...refs),
    batch: vi.fn(() => ({
      update: batchUpdate,
      set: batchSet,
      delete: batchDelete,
      commit: batchCommit,
    })),
  },
  adminFieldValue: { increment: vi.fn((value) => value) },
  adminStorage: { bucket: vi.fn(() => ({ name: "ares-test.firebasestorage.app" })) },
}));

vi.mock("../../middleware/auth", () => ({
  ensureAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  ensureTeamMember: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import albumsRouter from "../albums";

function handler(path: string, method: string) {
  const routeLayer = albumsRouter.stack.find(
    (layer) => layer.route?.path === path && layer.route.methods[method],
  );
  expect(routeLayer).toBeDefined();
  return routeLayer!.route!.stack.at(-1)!.handle;
}

function album(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

describe("albums routes", () => {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryGet.mockResolvedValue({ docs: [] });
    docGet.mockResolvedValue({ exists: true, data: () => ({}) });
    docSet.mockResolvedValue(undefined);
    getAll.mockResolvedValue([]);
    batchCommit.mockResolvedValue(undefined);
  });

  async function expectApiError(path: string, method: string, req: Record<string, unknown>, status: number, message: string) {
    await handler(path, method)(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status, message }));
  }

  describe("GET /", () => {
    it("returns a paginated explicit DTO and filters archived records", async () => {
      queryGet.mockResolvedValueOnce({ docs: [
        album("album-1", {
          title: "Album 1",
          description: "Matches",
          category: "Competition",
          coverImageUrl: "https://example.com/cover.jpg",
          isPublic: true,
          mediaCount: 4,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-02",
          internalOwner: "private",
        }),
        album("archived", { title: "Old", isDeleted: 1 }),
        album("album-2", { title: "Album 2" }),
      ] });

      await handler("/", "get")({ query: { limit: "1" } }, res, next);

      const payload = res.json.mock.calls[0][0];
      expect(albumQuery.limit).toHaveBeenCalledWith(2);
      expect(payload).toEqual({
        albums: [expect.objectContaining({ id: "album-1", category: "Competition", coverImageUrl: "https://example.com/cover.jpg", isPublic: true })],
        hasMore: true,
        nextCursor: "album-1",
      });
      expect(JSON.stringify(payload)).not.toContain("internalOwner");
    });

    it("supports cursor paging, archived records, bounded limits, and DTO fallbacks", async () => {
      const cursorSnapshot = { exists: true, id: "cursor" };
      docGet.mockResolvedValueOnce(cursorSnapshot);
      queryGet.mockResolvedValueOnce({ docs: [album("legacy", {
        title: 42,
        description: null,
        category: "Unknown",
        coverImageUrl: "http://unsafe.example/cover.jpg",
        isPublic: true,
        mediaCount: -5,
        createdAt: null,
        updatedAt: 5,
        isDeleted: 1,
        archivedAt: "2026-02-01",
      })] });

      await handler("/", "get")({ query: { cursor: "cursor", includeArchived: "true", limit: "999" } }, res, next);

      expect(albumQuery.startAfter).toHaveBeenCalledWith(cursorSnapshot);
      expect(albumQuery.limit).toHaveBeenCalledWith(51);
      expect(res.json).toHaveBeenCalledWith({
        albums: [expect.objectContaining({
          title: "Untitled album",
          description: "",
          category: "Practice",
          coverImageUrl: "",
          isPublic: false,
          mediaCount: 0,
          createdAt: "",
          updatedAt: undefined,
          isArchived: true,
          archivedAt: "2026-02-01",
        })],
        hasMore: false,
        nextCursor: null,
      });
    });

    it("uses a default limit and rejects invalid or missing cursors", async () => {
      await handler("/", "get")({ query: { limit: ["20"] } }, res, next);
      expect(albumQuery.limit).toHaveBeenCalledWith(31);

      next.mockClear();
      await expectApiError("/", "get", { query: { cursor: "bad cursor" } }, 400, "Invalid album cursor.");
      next.mockClear();
      docGet.mockResolvedValueOnce({ exists: false });
      await expectApiError("/", "get", { query: { cursor: "missing" } }, 400, "Album cursor was not found.");
    });
  });

  describe("POST /", () => {
    it("stores an opaque managed cover and returns an authenticated preview gateway", async () => {
      docGet
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ storagePath: "gallery/cover.jpg", isDeleted: 0 }),
        })
        .mockResolvedValueOnce({ exists: false });

      await handler("/", "post")({ body: {
        title: "Managed Cover",
        category: "Practice",
        coverPhotoId: "photo-1",
      } }, res, next);

      expect(docSet).toHaveBeenCalledWith(expect.objectContaining({
        coverPhotoId: "photo-1",
      }));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        album: expect.objectContaining({
          coverPhotoId: "photo-1",
          coverImageUrl: "/api/photos/admin/media/photo-1/medium",
        }),
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects a new direct URL to the managed Storage bucket", async () => {
      await expectApiError("/", "post", { body: {
        title: "Direct Cover",
        category: "Practice",
        coverImageUrl: "https://storage.googleapis.com/ares-test.firebasestorage.app/gallery/cover.jpg",
      } }, 400, "Choose the image from managed photos instead of saving a direct Storage URL.");
    });

    it("creates a complete album with a stable slug", async () => {
      docGet.mockResolvedValueOnce({ exists: false });
      await handler("/", "post")({ body: {
        title: "WV State 2026",
        category: "Competition",
        description: "Matches and pit photos",
        coverImageUrl: "https://example.com/cover.png",
        isPublic: true,
      } }, res, next);

      expect(docSet).toHaveBeenCalledWith(expect.objectContaining({
        title: "WV State 2026",
        category: "Competition",
        coverImageUrl: "https://example.com/cover.png",
        isPublic: true,
        mediaCount: 0,
        isDeleted: 0,
      }));
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, album: expect.objectContaining({ id: "wv-state-2026" }) });
    });

    it("defaults optional fields and private visibility", async () => {
      docGet.mockResolvedValueOnce({ exists: false });
      await handler("/", "post")({ body: { title: "Practice", category: "Practice" } }, res, next);
      expect(docSet).toHaveBeenCalledWith(expect.objectContaining({ description: "", coverImageUrl: "", isPublic: false }));
    });

    it.each([
      [{ description: "Missing title", category: "Practice" }, "Title must be text."],
      [{ title: 42, category: "Practice" }, "Title must be text."],
      [{ title: "x".repeat(121), category: "Practice" }, "Title must be 120 characters or fewer."],
      [{ title: "Album", description: 2, category: "Practice" }, "Description must be text."],
      [{ title: "Album", category: "Unknown" }, "Choose a valid album category."],
      [{ title: "Album", category: "Practice", coverImageUrl: "http://example.com/a.jpg" }, "Cover image URL must use HTTPS."],
      [{ title: "Album", category: "Practice", coverImageUrl: 7 }, "Cover image URL must be text."],
      [{ title: "Album", category: "Practice", isPublic: "yes" }, "Public visibility must be true or false."],
      [{ title: "---", category: "Practice" }, "Album title must contain letters or numbers."],
    ])("rejects invalid create payload %#", async (body, message) => {
      await expectApiError("/", "post", { body }, 400, message);
    });

    it("rejects a duplicate slug even when the existing album is archived", async () => {
      docGet.mockResolvedValueOnce({ exists: true });
      await expectApiError("/", "post", { body: { title: "Existing", category: "Practice" } }, 409, "An album with this title already exists, including the archive.");
    });
  });

  describe("PATCH /:albumId", () => {
    it("updates every supported field and returns sanitized merged data", async () => {
      docGet.mockResolvedValueOnce({ exists: true, data: () => ({ title: "Original", category: "Practice", mediaCount: 2 }) });
      await handler("/:albumId", "patch")({
        params: { albumId: "album" },
        body: { title: "Updated", description: "New", category: "Outreach", coverImageUrl: "", isPublic: true },
      }, res, next);
      expect(docSet).toHaveBeenCalledWith(expect.objectContaining({
        title: "Updated", description: "New", category: "Outreach", coverImageUrl: "", isPublic: true,
      }), { merge: true });
      expect(res.json).toHaveBeenCalledWith({ success: true, album: expect.objectContaining({ title: "Updated", category: "Outreach" }) });
    });

    it("allows an empty partial update", async () => {
      docGet.mockResolvedValueOnce({ exists: true, data: () => ({ title: "Original", category: "Practice" }) });
      await handler("/:albumId", "patch")({ params: { albumId: "album" }, body: {} }, res, next);
      expect(docSet).toHaveBeenCalledWith({ updatedAt: expect.any(String) }, { merge: true });
    });

    it("rejects invalid IDs, missing records, archived records, and malformed partial fields", async () => {
      await expectApiError("/:albumId", "patch", { params: { albumId: "../bad" }, body: {} }, 400, "Invalid album ID.");
      next.mockClear();
      docGet.mockResolvedValueOnce({ exists: false });
      await expectApiError("/:albumId", "patch", { params: { albumId: "missing" }, body: {} }, 404, "Album not found.");
      next.mockClear();
      docGet.mockResolvedValueOnce({ exists: true, data: () => ({ isDeleted: 1 }) });
      await expectApiError("/:albumId", "patch", { params: { albumId: "archived" }, body: {} }, 409, "Restore the album before editing it.");
      next.mockClear();
      docGet.mockResolvedValueOnce({ exists: true, data: () => ({}) });
      await expectApiError("/:albumId", "patch", { params: { albumId: "album" }, body: { isPublic: "yes" } }, 400, "Public visibility must be true or false.");
    });
  });

  describe("archive and restore", () => {
    it("archives without a hard delete", async () => {
      docGet.mockResolvedValueOnce({ exists: true, data: () => ({}) });
      await handler("/:albumId", "delete")({ params: { albumId: "album" } }, res, next);
      expect(docSet).toHaveBeenCalledWith(expect.objectContaining({ isDeleted: 1, isPublic: false }), { merge: true });
      expect(res.json).toHaveBeenCalledWith({ success: true, archived: true });
    });

    it("restores privately and returns an active DTO", async () => {
      docGet.mockResolvedValueOnce({ exists: true, data: () => ({ title: "Old", category: "Competition", isDeleted: 1, isPublic: true }) });
      await handler("/:albumId/restore", "post")({ params: { albumId: "album" } }, res, next);
      expect(docSet).toHaveBeenCalledWith(expect.objectContaining({ isDeleted: 0, isPublic: false, archivedAt: null }), { merge: true });
      expect(res.json).toHaveBeenCalledWith({ success: true, restored: true, album: expect.objectContaining({ isArchived: false, isPublic: false }) });
    });

    it("rejects missing archive and restore targets", async () => {
      docGet.mockResolvedValueOnce({ exists: false });
      await expectApiError("/:albumId", "delete", { params: { albumId: "missing" } }, 404, "Album not found.");
      next.mockClear();
      docGet.mockResolvedValueOnce({ exists: false });
      await expectApiError("/:albumId/restore", "post", { params: { albumId: "missing" } }, 404, "Album not found.");
    });
  });

  describe("POST /:albumId/add-photos", () => {
    it("moves active photos in one batch, deduplicates IDs, and updates old album counts", async () => {
      docGet.mockResolvedValueOnce({ exists: true, data: () => ({ isDeleted: 0 }) });
      const newPhotoRef = { id: "new", kind: "snapshot-ref" };
      const movedPhotoRef = { id: "moved", kind: "snapshot-ref" };
      getAll.mockResolvedValueOnce([
        { exists: false, id: "missing", ref: { id: "missing" }, data: () => undefined },
        { exists: true, id: "archived", ref: { id: "archived" }, data: () => ({ isDeleted: 1 }) },
        { exists: true, id: "same", ref: { id: "same" }, data: () => ({ albumId: "target" }) },
        { exists: true, id: "new", ref: newPhotoRef, data: () => ({ caption: "New" }) },
        { exists: true, id: "moved", ref: movedPhotoRef, data: () => ({ albumId: "old", caption: "Moved" }) },
        { exists: true, id: "moved-two", ref: { id: "moved-two" }, data: () => ({ albumId: "old" }) },
      ]);

      await handler("/:albumId/add-photos", "post")({
        params: { albumId: "target" },
        body: { photoIds: ["missing", "archived", "same", "new", "moved", "moved-two", "new"] },
      }, res, next);

      expect(getAll).toHaveBeenCalledOnce();
      expect(getAll.mock.calls[0]).toHaveLength(6);
      expect(photoDoc).toHaveBeenCalledTimes(6);
      expect(batchSet).toHaveBeenCalledTimes(3);
      expect(batchDelete).toHaveBeenCalledTimes(2);
      expect(batchUpdate).toHaveBeenCalledTimes(5);
      expect(batchCommit).toHaveBeenCalledOnce();
      expect(res.json).toHaveBeenCalledWith({ success: true, addedCount: 3 });
    });

    it("commits a no-op batch when every photo already belongs to the album", async () => {
      docGet.mockResolvedValueOnce({ exists: true, data: () => ({}) });
      getAll.mockResolvedValueOnce([{ exists: true, id: "same", ref: { id: "same" }, data: () => ({ albumId: "target" }) }]);
      await handler("/:albumId/add-photos", "post")({ params: { albumId: "target" }, body: { photoIds: ["same"] } }, res, next);
      expect(batchUpdate).not.toHaveBeenCalled();
      expect(batchCommit).toHaveBeenCalledOnce();
      expect(res.json).toHaveBeenCalledWith({ success: true, addedCount: 0 });
    });

    it.each([
      [undefined, "Choose between 1 and 100 photos."],
      [[], "Choose between 1 and 100 photos."],
      [Array.from({ length: 101 }, (_, index) => `p-${index}`), "Choose between 1 and 100 photos."],
      [["bad id"], "Invalid photo ID."],
    ])("rejects malformed photo selections %#", async (photoIds, message) => {
      await expectApiError("/:albumId/add-photos", "post", { params: { albumId: "album" }, body: { photoIds } }, 400, message);
    });

    it("rejects invalid and inactive target albums", async () => {
      await expectApiError("/:albumId/add-photos", "post", { params: { albumId: "bad id" }, body: { photoIds: ["photo"] } }, 400, "Invalid album ID.");
      next.mockClear();
      docGet.mockResolvedValueOnce({ exists: false });
      await expectApiError("/:albumId/add-photos", "post", { params: { albumId: "missing" }, body: { photoIds: ["photo"] } }, 404, "Active album not found.");
      next.mockClear();
      docGet.mockResolvedValueOnce({ exists: true, data: () => ({ isDeleted: 1 }) });
      await expectApiError("/:albumId/add-photos", "post", { params: { albumId: "archived" }, body: { photoIds: ["photo"] } }, 404, "Active album not found.");
    });
  });
});
