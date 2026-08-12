import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const docGet = vi.fn();
const docSet = vi.fn();
const queryGet = vi.fn();
const batchSet = vi.fn();
const batchCommit = vi.fn();
const doc = vi.fn(() => ({ get: docGet, set: docSet }));
const query: any = {
  where: vi.fn(() => query),
  orderBy: vi.fn(() => query),
  startAfter: vi.fn(() => query),
  limit: vi.fn(() => query),
  get: queryGet,
};

vi.mock("../../lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn(() => ({ ...query, doc })),
    batch: vi.fn(() => ({ set: batchSet, commit: batchCommit })),
  },
}));
vi.mock("../../middleware/auth", () => ({
  ensureAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  ensureTeamMember: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import videosRouter, { videosLimiter } from "../videos";

function handler(path: string, method: string) {
  const layer = videosRouter.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  expect(layer).toBeDefined();
  return layer!.route!.stack.at(-1)!.handle;
}

describe("videos routes", () => {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryGet.mockResolvedValue({ docs: [] });
    batchCommit.mockResolvedValue(undefined);
    delete process.env.YOUTUBE_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.YOUTUBE_API_KEY;
  });

  it("registers its rate limiter", () => {
    expect(videosRouter.stack[0].handle).toBe(videosLimiter);
  });

  it("authorizes and applies the shared quota before YouTube sync", () => {
    const layer = videosRouter.stack.find((entry) => entry.route?.path === "/sync");
    expect(layer?.route?.stack.map((entry) => entry.name)).toEqual([
      "ensureAdmin",
      "enforceDistributedQuota",
      expect.any(String),
    ]);
  });

  it("returns a bounded public DTO without sync metadata", async () => {
    queryGet.mockResolvedValue({ docs: [{ id: "video_abcdefghijk", data: () => ({ title: "Robot reveal", videoId: "abcdefghijk", thumbnailUrl: "https://img.youtube.com/vi/abcdefghijk/0.jpg", status: "published", isDeleted: 0, syncSource: "private" }) }] });
    await handler("/public", "get")({ query: {} }, res, next);
    const payload = res.json.mock.calls[0][0];
    expect(query.where).toHaveBeenNthCalledWith(1, "status", "==", "published");
    expect(query.where).toHaveBeenNthCalledWith(2, "isDeleted", "==", 0);
    expect(payload.videos[0]).toMatchObject({ title: "Robot reveal", watchUrl: "https://www.youtube.com/watch?v=abcdefghijk" });
    expect(JSON.stringify(payload)).not.toContain("syncSource");
  });

  it("applies a valid cursor and safely normalizes malformed legacy public records", async () => {
    docGet.mockResolvedValueOnce({ exists: true });
    queryGet.mockResolvedValueOnce({
      docs: [
        { id: "legacy", data: () => ({ title: 42, videoId: "bad", thumbnailUrl: "http://evil.test/image.jpg", type: "other", status: "other", isDeleted: 0 }) },
        { id: "archived", data: () => ({ videoId: "abcdefghijk", status: "published", isDeleted: 1 }) },
      ],
    });

    await handler("/public", "get")({ query: { cursor: "video_cursor", limit: "1" } }, res, next);

    expect(query.startAfter).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      videos: [expect.objectContaining({ title: "Untitled video", videoId: "", thumbnailUrl: "", type: "video", status: "draft" })],
      hasMore: true,
    }));
  });

  it("rejects invalid or missing public cursors", async () => {
    await handler("/public", "get")({ query: { cursor: "bad/cursor" } }, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 400 });

    vi.clearAllMocks();
    docGet.mockResolvedValueOnce({ exists: false });
    await handler("/public", "get")({ query: { cursor: "missing_cursor" } }, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 400 });
  });

  it("returns an authenticated archive-aware page with bounded limits", async () => {
    queryGet.mockResolvedValueOnce({
      docs: [
        { id: "active", data: () => ({ videoId: "abcdefghijk", isDeleted: 0 }) },
        { id: "archived", data: () => ({ videoId: "lmnopqrst", isDeleted: 1, archivedAt: "2026-01-01" }) },
      ],
    });
    await handler("/", "get")({ query: { includeArchived: "true", limit: "999" } }, res, next);
    expect(query.limit).toHaveBeenCalledWith(51);
    expect(res.json.mock.calls[0][0].videos).toHaveLength(2);
  });

  it("rejects an invalid YouTube link on create", async () => {
    await handler("/", "post")({ body: { title: "Bad", videoId: "bad" } }, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 400 });
  });

  it("creates a validated video", async () => {
    docGet.mockResolvedValue({ exists: false, data: () => undefined });
    await handler("/", "post")({ body: { title: "Robot reveal", videoId: "abcdefghijk", status: "published" } }, res, next);
    expect(docSet).toHaveBeenCalledWith(expect.objectContaining({ videoId: "abcdefghijk", isDeleted: 0 }), { merge: true });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it.each([
    ["https://youtu.be/abcdefghijk", "short", "published"],
    ["https://www.youtube.com/watch?v=abcdefghijk", "video", "draft"],
    ["https://m.youtube.com/shorts/abcdefghijk", "short", "published"],
    ["https://youtube.com/embed/abcdefghijk", "video", "draft"],
    ["https://youtube.com/live/abcdefghijk", "video", "published"],
  ])("accepts supported YouTube URL shape %s", async (videoId, type, status) => {
    docGet.mockResolvedValueOnce({ exists: false, data: () => undefined });
    await handler("/", "post")({ body: { title: "Video", videoId, type, status, thumbnailUrl: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg" } }, res, next);
    expect(docSet).toHaveBeenCalledWith(expect.objectContaining({ videoId: "abcdefghijk", type, status }), { merge: true });
  });

  it.each([
    [{ title: 42, videoId: "abcdefghijk" }, "Title must be text"],
    [{ title: "", videoId: "abcdefghijk" }, "Title is required"],
    [{ title: "x".repeat(181), videoId: "abcdefghijk" }, "180 characters"],
    [{ title: "Video", videoId: "abcdefghijk", type: "clip" }, "Video type"],
    [{ title: "Video", videoId: "abcdefghijk", status: "ready" }, "Video status"],
    [{ title: "Video", videoId: "abcdefghijk", thumbnailUrl: "not a URL" }, "valid HTTPS"],
    [{ title: "Video", videoId: "abcdefghijk", thumbnailUrl: "https://evil.test/thumb.jpg" }, "approved YouTube"],
  ])("rejects invalid create input %#", async (body, message) => {
    await handler("/", "post")({ body }, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 400, message: expect.stringContaining(message) });
  });

  it("rejects a duplicate active video and permits recreating an archived one", async () => {
    docGet.mockResolvedValueOnce({ exists: true, data: () => ({ isDeleted: 0 }) });
    await handler("/", "post")({ body: { title: "Video", videoId: "abcdefghijk" } }, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 409 });

    vi.clearAllMocks();
    docGet.mockResolvedValueOnce({ exists: true, data: () => ({ isDeleted: 1, createdAt: "2025-01-01" }) });
    await handler("/", "post")({ body: { title: "Video", videoId: "abcdefghijk" } }, res, next);
    expect(docSet).toHaveBeenCalledWith(expect.objectContaining({ createdAt: "2025-01-01", isDeleted: 0 }), { merge: true });
  });

  it("updates an active video and rejects invalid, missing, or archived targets", async () => {
    docGet.mockResolvedValueOnce({ exists: true, data: () => ({ videoId: "abcdefghijk", isDeleted: 0, thumbnailUrl: "https://evil.test/thumb" }) });
    await handler("/:videoId", "patch")({ params: { videoId: "video_abcdefghijk" }, body: { title: "Updated", videoId: "https://youtu.be/abcdefghijk" } }, res, next);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, video: expect.objectContaining({ title: "Updated" }) }));

    vi.clearAllMocks();
    await handler("/:videoId", "patch")({ params: { videoId: "bad" }, body: {} }, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 400 });

    vi.clearAllMocks();
    docGet.mockResolvedValueOnce({ exists: false });
    await handler("/:videoId", "patch")({ params: { videoId: "video_missing" }, body: {} }, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 404 });

    vi.clearAllMocks();
    docGet.mockResolvedValueOnce({ exists: true, data: () => ({ isDeleted: 1 }) });
    await handler("/:videoId", "patch")({ params: { videoId: "video_archived" }, body: {} }, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 409 });
  });

  it("archives instead of deleting a video", async () => {
    docGet.mockResolvedValue({ exists: true, data: () => ({ videoId: "abcdefghijk" }) });
    await handler("/:videoId", "delete")({ params: { videoId: "video_abcdefghijk" } }, res, next);
    expect(docSet).toHaveBeenCalledWith(expect.objectContaining({ isDeleted: 1, archivedAt: expect.any(String) }), { merge: true });
  });

  it("rejects invalid or missing archive targets", async () => {
    await handler("/:videoId", "delete")({ params: { videoId: "bad" } }, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 400 });
    vi.clearAllMocks();
    docGet.mockResolvedValueOnce({ exists: false });
    await handler("/:videoId", "delete")({ params: { videoId: "video_missing" } }, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 404 });
  });

  it("restores an archived video", async () => {
    docGet.mockResolvedValue({ exists: true, data: () => ({ videoId: "abcdefghijk", isDeleted: 1 }) });
    await handler("/:videoId/restore", "post")({ params: { videoId: "video_abcdefghijk" } }, res, next);
    expect(docSet).toHaveBeenCalledWith(expect.objectContaining({ isDeleted: 0, archivedAt: null }), { merge: true });
  });

  it("rejects invalid or missing restore targets", async () => {
    await handler("/:videoId/restore", "post")({ params: { videoId: "bad" } }, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 400 });
    vi.clearAllMocks();
    docGet.mockResolvedValueOnce({ exists: false });
    await handler("/:videoId/restore", "post")({ params: { videoId: "video_missing" } }, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 404 });
  });

  it("requires the Secret Manager YouTube key", async () => {
    await handler("/sync", "post")({ user: { uid: "admin" } }, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 503 });
  });

  it("preserves existing videos when YouTube returns no usable items", async () => {
    process.env.YOUTUBE_API_KEY = "secret-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) }));
    await handler("/sync", "post")({ user: { uid: "admin" } }, res, next);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ archivalSkipped: true, archivedCount: 0 }));
    expect(queryGet).not.toHaveBeenCalled();
  });

  it("syncs multiple YouTube pages, skips invalid items, and archives missing synced records", async () => {
    process.env.YOUTUBE_API_KEY = "secret-key";
    const validItem = (id: string, title: string, nextPageToken?: string) => ({
      snippet: {
        title,
        description: `${title} #shorts`,
        publishedAt: "2026-01-01T00:00:00.000Z",
        resourceId: { videoId: id },
        thumbnails: { high: { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` } },
      },
      nextPageToken,
    });
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [validItem("abcdefghijk", "One"), { snippet: { resourceId: { videoId: "bad" } } }], nextPageToken: "page-2" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [validItem("lmnopqrstuv", "Two")] }) }));
    queryGet.mockResolvedValueOnce({
      docs: [
        { id: "video_oldrecord1", ref: { path: "videos/video_oldrecord1" }, data: () => ({ sourcePlaylistId: "UUre4FN7UThyVd-biFk0n-Ig", isDeleted: 0 }) },
        { id: "video_archived1", ref: { path: "videos/video_archived1" }, data: () => ({ sourcePlaylistId: "UUre4FN7UThyVd-biFk0n-Ig", isDeleted: 1 }) },
        { id: "video_otherlist", ref: { path: "videos/video_otherlist" }, data: () => ({ sourcePlaylistId: "other", isDeleted: 0 }) },
      ],
    });

    await handler("/sync", "post")({ user: { uid: "admin" } }, res, next);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(batchSet).toHaveBeenCalledTimes(3);
    expect(batchCommit).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ pagesFetched: 2, addedUpdatedCount: 2, archivedCount: 1, archivalSkipped: false }));
  });

  it("surfaces YouTube network and HTTP failures without changing records", async () => {
    process.env.YOUTUBE_API_KEY = "secret-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("offline")));
    await handler("/sync", "post")({ user: { uid: "admin" } }, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 502 });
    expect(batchCommit).not.toHaveBeenCalled();

    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false, status: 429, statusText: "Rate limited" }));
    await handler("/sync", "post")({ user: { uid: "admin" } }, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 502, message: expect.stringContaining("HTTP 429") });
  });
});
