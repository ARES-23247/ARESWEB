 

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";
import postsRouter from "./posts";
import { createMockPost } from "../../../src/test/factories/contentFactory";

// Mock global dependencies
vi.stubGlobal("crypto", {
  randomUUID: () => "test-uuid",
});

// Mock external utilities
vi.mock("../../../functions/utils/socialSync", () => ({
  dispatchSocials: vi.fn().mockResolvedValue(true),
}));
vi.mock("../../../functions/utils/zulipSync", () => ({
  sendZulipMessage: vi.fn().mockResolvedValue(true),
}));
vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
    ensureAuth: async (_c: unknown, next: () => Promise<void>) => next(),
    logAuditAction: vi.fn().mockResolvedValue(true),
    getSessionUser: vi.fn().mockResolvedValue({ id: "1", email: "admin@test.com", role: "admin" }),
    emitNotification: vi.fn().mockResolvedValue(true),
    notifyByRole: vi.fn().mockResolvedValue(true),
  };
});
vi.mock("../../../functions/utils/postHistory", () => ({
  createShadowRevision: vi.fn().mockResolvedValue("new-slug"),
  approvePost: vi.fn().mockResolvedValue({ success: true, warnings: [] }),
  getPostHistory: vi.fn().mockResolvedValue([]),
  restorePostFromHistory: vi.fn().mockResolvedValue({ success: true }),
}));

describe("Hono Backend - /posts Router", () => {
  
   
  let mockDb: any;
  let testApp: Hono<any>;
  const env = { 
    DB: {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn(),
      first: vi.fn(),
      run: vi.fn(),
    } as unknown,
    ENVIRONMENT: "test", 
    DEV_BYPASS: "true" 
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      deleteFrom: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      transaction: vi.fn().mockImplementation(() => ({
        execute: vi.fn().mockImplementation((callback) => callback(mockDb)),
      })),
      getExecutor: vi.fn().mockReturnValue({
        compileQuery: vi.fn().mockReturnValue({ sql: "", parameters: [], query: { kind: "RawNode" } }),
        executeQuery: vi.fn().mockResolvedValue({ rows: [] }),
        transformQuery: vi.fn((q) => q),
      }),
    };

    testApp = new Hono<any>();
    testApp.use("*", async (c: any, next: any) => {
      c.set("db", mockDb);
      c.set("user", { id: "1", email: "admin@test.com", role: "admin" });
      await next();
    });
    testApp.route("/", postsRouter);
  });

  it("GET / - list published posts", async () => {
    const mockPosts = [createMockPost(), createMockPost()];
    mockDb.execute.mockResolvedValue(mockPosts);

    const res = await testApp.request("/", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.posts).toHaveLength(2);
  });

  it("GET /:slug - get single published post", async () => {
    const mockPost = createMockPost({ slug: "test-post" });
    mockDb.executeTakeFirst.mockResolvedValue(mockPost);

    const res = await testApp.request("/test-post", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.post).toBeDefined();
    expect((body.post as { slug: string }).slug).toBe("test-post");
  });

  it("GET /admin/list - admin list", async () => {
    const res = await testApp.request("/admin/list", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.selectFrom).toHaveBeenCalledWith("posts");
  });

  it("POST /admin/save - create new post", async () => {
    const postData = {
      title: "New Post",
      ast: { type: "doc", content: [] },
      isDraft: false,
    };
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify(postData),
      headers: { "Content-Type": "application/json" },
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.insertInto).toHaveBeenCalledWith("posts");
  });

  it("DELETE /admin/:slug - soft delete", async () => {
    const res = await testApp.request("/admin/test-post", { 
      method: "DELETE",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.updateTable).toHaveBeenCalledWith("posts");
  });

  it("POST /admin/:slug/undelete - restore", async () => {
    const res = await testApp.request("/admin/test-post/undelete", { 
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.updateTable).toHaveBeenCalledWith("posts");
  });

  it("DELETE /admin/:slug/purge - permanent delete", async () => {
    const res = await testApp.request("/admin/test-post/purge", { 
      method: "DELETE",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.deleteFrom).toHaveBeenCalledWith("posts");
  });

  it("GET /admin/:slug - get post details", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ slug: "test" });
    const res = await testApp.request("/admin/test", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /admin/:slug/history - get post history", async () => {
    const res = await testApp.request("/admin/test/history", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/approve - success", async () => {
    const res = await testApp.request("/admin/test/approve", { 
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/reject - success with reason", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ title: "Test", cf_email: "author@test.com" });
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "123" });
    
    const res = await testApp.request("/admin/test/reject", {
      method: "POST",
      body: JSON.stringify({ reason: "Needs work" }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });
});
