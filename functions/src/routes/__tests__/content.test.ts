import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  get: vi.fn(),
  docGet: vi.fn(),
}));

vi.mock("../../lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn(() => ({
      where: mocks.where,
      orderBy: mocks.orderBy,
      limit: mocks.limit,
      get: mocks.get,
      doc: vi.fn(() => ({ get: mocks.docGet })),
    })),
  },
}));

import contentRouter from "../content";

function handler(path: string) {
  const layer = contentRouter.stack.find(
    (entry) => entry.route?.path === path && entry.route.methods.get,
  );
  if (!layer) throw new Error(`GET ${path} not found`);
  return layer.route!.stack.at(-1)!.handle;
}

function document(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

describe("public content DTO API", () => {
  let req: { params: Record<string, string>; query: Record<string, string> };
  let res: { json: ReturnType<typeof vi.fn> };
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({ docs: [] });
    mocks.docGet.mockResolvedValue({ exists: false, data: () => undefined });
    req = { params: {}, query: {} };
    res = { json: vi.fn() };
    next = vi.fn();
  });

  it("lists only approved published blog DTO fields", async () => {
    mocks.get.mockResolvedValue({
      docs: [
        document("build-log", {
          title: "Build Log",
          date: "2026-08-24",
          content: "Robot progress",
          author: "ARES Member",
          status: "published",
          isDeleted: 0,
          approvalStatus: "approved",
          approvedByUid: "internal-uid",
        }),
        document("pending", {
          title: "Pending",
          status: "published",
          isDeleted: 0,
          approvalStatus: "pending_approval",
        }),
        document("deleted", { status: "published", isDeleted: 1 }),
      ],
    });

    await handler("/posts")(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      posts: [expect.objectContaining({ slug: "build-log", snippet: "Robot progress" })],
    });
    const payload = res.json.mock.calls[0][0];
    expect(payload.posts[0]).not.toHaveProperty("content");
    expect(payload.posts[0]).not.toHaveProperty("approvedByUid");
    expect(mocks.limit).toHaveBeenCalledWith(100);
  });

  it("returns a bounded blog detail and rejects unsafe or unpublished slugs", async () => {
    req.params.slug = "build-log";
    mocks.docGet.mockResolvedValue({
      exists: true,
      data: () => ({
        title: 123,
        snippet: "Summary",
        content: "Full article",
        status: "published",
        isDeleted: 0,
      }),
    });

    await handler("/posts/:slug")(req, res, next);
    expect(res.json).toHaveBeenCalledWith({
      post: expect.objectContaining({
        slug: "build-log",
        title: "Untitled Post",
        content: "Full article",
      }),
    });

    req.params.slug = "../secret";
    await handler("/posts/:slug")(req, res, next);
    expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ status: 400 }));

    req.params.slug = "pending";
    mocks.docGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: "published", isDeleted: 0, approvalStatus: "pending_approval" }),
    });
    await handler("/posts/:slug")(req, res, next);
    expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ status: 404 }));
  });

  it("lists only documents in the requested public library and omits operational fields", async () => {
    req.query.library = "academy";
    mocks.get.mockResolvedValue({
      docs: [
        document("lesson-b", {
          title: "Lesson B",
          category: "AI 101",
          sortOrder: 2.8,
          content: "B",
          status: "published",
          isDeleted: 0,
          displayInMathCorner: 1,
          original_authorNickname: "Student Author",
          driveFileId: "internal-drive-id",
        }),
        document("lesson-a", {
          title: "Lesson A",
          category: "AI 101",
          sortOrder: 1,
          content: "A",
          status: "published",
          isDeleted: 0,
          displayInScienceCorner: 1,
          isPortfolio: 1,
        }),
        document("areslib-only", {
          title: "Library",
          status: "published",
          isDeleted: 0,
          displayInAreslib: 1,
        }),
      ],
    });

    await handler("/docs")(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.documents.map((item: { slug: string }) => item.slug)).toEqual([
      "lesson-a",
      "lesson-b",
    ]);
    expect(payload.documents[1]).toMatchObject({
      sortOrder: 2,
      original_authorNickname: "Student Author",
    });
    expect(payload.documents[1]).not.toHaveProperty("driveFileId");
  });

  it("serves ARESLib document details and rejects wrong-library or invalid requests", async () => {
    req.params.slug = "control-loops";
    req.query.library = "areslib";
    mocks.docGet.mockResolvedValue({
      exists: true,
      data: () => ({
        title: "Control Loops",
        category: "Controls",
        sortOrder: "not-a-number",
        status: "published",
        isDeleted: 0,
        displayInAreslib: 1,
      }),
    });

    await handler("/docs/:slug")(req, res, next);
    expect(res.json).toHaveBeenCalledWith({
      document: expect.objectContaining({
        slug: "control-loops",
        sortOrder: 0,
        displayInAreslib: 1,
      }),
    });

    req.query.library = "academy";
    await handler("/docs/:slug")(req, res, next);
    expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ status: 404 }));

    req.query.library = "unknown";
    await handler("/docs")(req, res, next);
    expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ status: 400 }));
  });
});
