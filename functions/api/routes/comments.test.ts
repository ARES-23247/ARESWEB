 

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";


// Mock Zulip and Notifications
vi.mock("../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn(() => Promise.resolve(123)),
  updateZulipMessage: vi.fn(() => Promise.resolve()),
  deleteZulipMessage: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../utils/notifications", () => ({
  emitNotification: vi.fn(() => Promise.resolve()),
}));

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    getSessionUser: vi.fn().mockResolvedValue({ id: "local-dev", email: "test@test.com", role: "admin", nickname: "Local Dev" }),
    getSocialConfig: vi.fn().mockResolvedValue({ ZULIP_COMMENT_STREAM: "test-stream" }),
    turnstileMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
    rateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
  };
});

import commentsRouter from "./comments";

describe("Hono Backend - /comments Router", () => {
  
  
   
  let mockDb: any;
  let testApp: Hono<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue({ numInsertedOrUpdatedRows: 1n, insertId: 1n }),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      getExecutor: vi.fn().mockReturnValue({
        compileQuery: vi.fn().mockReturnValue({ sql: "", parameters: [], query: { kind: "RawNode" } }),
        executeQuery: vi.fn().mockResolvedValue({ rows: [] }),
        transformQuery: vi.fn((q) => q),
      }),
    };

    testApp = new Hono<any>();
    testApp.use("*", async (c: any, next: any) => {
      c.set("db", mockDb);
      await next();
    });
    testApp.route("/", commentsRouter);
  });

  it("should list comments for a target", async () => {
    const mockComments = [
      { id: "1", content: "Great post!", created_at: "2024-01-01", nickname: "User1", avatar: "img1", user_id: "u1" },
    ];
    mockDb.execute.mockResolvedValueOnce(mockComments);

    const res = await testApp.request("/post/my-post", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.comments).toHaveLength(1);
  });

  it("should create a new comment", async () => {
    const res = await testApp.request("/post/my-post", {
      method: "POST",
      body: JSON.stringify({ content: "New comment content" }),
      headers: { "Content-Type": "application/json" },
    }, { DEV_BYPASS: "true" }, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expect.objectContaining({ success: true }));
  });

  it("should return 400 for empty comment content", async () => {
    const res = await testApp.request("/post/my-post", {
      method: "POST",
      body: JSON.stringify({ content: "" }),
      headers: { "Content-Type": "application/json" },
    }, { DEV_BYPASS: "true" }, mockExecutionContext);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(expect.objectContaining({ error: "Comment content is required" }));
  });

  it("should edit an existing comment", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ user_id: "local-dev", zulip_message_id: 123 });

    const res = await testApp.request("/1", {
      method: "PATCH",
      body: JSON.stringify({ content: "Updated content" }),
      headers: { "Content-Type": "application/json" },
    }, { DEV_BYPASS: "true" }, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("should soft-delete a comment", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ user_id: "local-dev", zulip_message_id: 123 });

    const res = await testApp.request("/1", { 
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  // Error paths and edge cases
  it("GET list - handles db error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("Fail"));
    const res = await testApp.request("/post/my-post", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST submit - handles unverified user", async () => {
    const { getSessionUser } = await import("../middleware");
    (getSessionUser as any).mockResolvedValueOnce({ id: "1", role: "unverified" });
    const res = await testApp.request("/post/my-post", { method: "POST", body: JSON.stringify({ content: "test" }), headers: { "Content-Type": "application/json" } }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(403);
  });

  it("POST submit - handles long content", async () => {
    const res = await testApp.request("/post/my-post", { method: "POST", body: JSON.stringify({ content: "A".repeat(15000) }), headers: { "Content-Type": "application/json" } }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(400);
  });

  it("POST submit - handles internal error", async () => {
    mockDb.insertInto.mockReturnValue({ values: vi.fn().mockReturnValue({ execute: vi.fn().mockRejectedValueOnce(new Error("Fail")) }) });
    const res = await testApp.request("/post/my-post", { method: "POST", body: JSON.stringify({ content: "test" }), headers: { "Content-Type": "application/json" } }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST submit - handles Zulip and Notification failures", async () => {
    const { sendZulipMessage } = await import("../../utils/zulipSync");
    const { emitNotification } = await import("../../utils/notifications");
    vi.mocked(sendZulipMessage).mockRejectedValueOnce(new Error("Zulip fail"));
    vi.mocked(emitNotification).mockRejectedValueOnce(new Error("Notif fail"));
    
    mockDb.executeTakeFirst = vi.fn()
      .mockResolvedValueOnce({ cf_email: "other@test.com" })
      .mockResolvedValueOnce({ id: "author-id" });
    
    const res = await testApp.request("/post/my-post", {
      method: "POST",
      body: JSON.stringify({ content: "test" }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    
    expect(res.status).toBe(200);
    await Promise.all(vi.mocked(mockExecutionContext.waitUntil).mock.results.map((r: any) => r.value));
  });

  it("PATCH edit - handles not found", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    const res = await testApp.request("/1", { method: "PATCH", body: JSON.stringify({ content: "test" }), headers: { "Content-Type": "application/json" } }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("PATCH edit - handles unauthorized user (not owner)", async () => {
    const { getSessionUser } = await import("../middleware");
    (getSessionUser as any).mockResolvedValueOnce({ id: "user", role: "member" }); // not admin
    mockDb.executeTakeFirst.mockResolvedValueOnce({ user_id: "other-user" });
    const res = await testApp.request("/1", { method: "PATCH", body: JSON.stringify({ content: "test" }), headers: { "Content-Type": "application/json" } }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(403);
  });

  it("PATCH edit - handles db error", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ user_id: "local-dev" });
    mockDb.updateTable.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ execute: vi.fn().mockRejectedValueOnce(new Error("Fail")) }) }) });
    const res = await testApp.request("/1", { method: "PATCH", body: JSON.stringify({ content: "test" }), headers: { "Content-Type": "application/json" } }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("PATCH edit - handles Zulip Update failure", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ user_id: "local-dev", zulip_message_id: 123 });
    const { updateZulipMessage } = await import("../../utils/zulipSync");
    vi.mocked(updateZulipMessage).mockRejectedValueOnce(new Error("Zulip fail"));
    
    const res = await testApp.request("/1", {
      method: "PATCH",
      body: JSON.stringify({ content: "Updated content" }),
      headers: { "Content-Type": "application/json" },
    }, { DEV_BYPASS: "true" }, mockExecutionContext);

    expect(res.status).toBe(200);
    await Promise.all(vi.mocked(mockExecutionContext.waitUntil).mock.results.map((r: any) => r.value));
  });

  it("DELETE - handles not found", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    const res = await testApp.request("/1", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("DELETE - handles unauthorized user (not owner/admin)", async () => {
    const { getSessionUser } = await import("../middleware");
    (getSessionUser as any).mockResolvedValueOnce({ id: "user", role: "member" }); // not admin, not owner
    mockDb.executeTakeFirst.mockResolvedValueOnce({ user_id: "other-user" });
    const res = await testApp.request("/1", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(403);
  });

  it("DELETE - handles internal error", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ user_id: "local-dev" });
    mockDb.updateTable.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ execute: vi.fn().mockRejectedValueOnce(new Error("Fail")) }) }) });
    const res = await testApp.request("/1", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE - handles Zulip Delete failure", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ user_id: "local-dev", zulip_message_id: 123 });
    const { deleteZulipMessage } = await import("../../utils/zulipSync");
    vi.mocked(deleteZulipMessage).mockRejectedValueOnce(new Error("Zulip fail"));

    const res = await testApp.request("/1", { 
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
    await Promise.all(vi.mocked(mockExecutionContext.waitUntil).mock.results.map((r: any) => r.value));
  });
});
