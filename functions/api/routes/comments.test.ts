/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAPI handler input validated by Zod schemas */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Context } from "hono";
import { mockExecutionContext, createDrizzleProxy, createMockDrizzle } from "../../../src/test/utils";
import type { TestEnv, MockDrizzle } from "../../../src/test/types";


// Mock Zulip and Notifications
vi.mock("../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn(),
  updateZulipMessage: vi.fn(),
  deleteZulipMessage: vi.fn(),
}));

vi.mock("../../utils/notifications", () => ({
  emitNotification: vi.fn(),
}));

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    getSessionUser: vi.fn().mockResolvedValue({ id: "local-dev", email: "test@test.com", role: "admin", nickname: "Local Dev" }),
    getSocialConfig: vi.fn().mockResolvedValue({ ZULIP_COMMENT_STREAM: "test-stream" }),
    turnstileMiddleware: () => async (_c: Context<TestEnv>, next: () => Promise<void>) => next(),
    rateLimitMiddleware: () => async (_c: Context<TestEnv>, next: () => Promise<void>) => next(),
  };
});

import commentsRouter from "./comments";

describe("Hono Backend - /comments Router", () => {



  let mockDb: MockDrizzle;
  let testApp: Hono<TestEnv>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDb = createMockDrizzle();

    // Set default behavior for mocks
    const { sendZulipMessage, updateZulipMessage, deleteZulipMessage } = await import("../../utils/zulipSync");
    vi.mocked(sendZulipMessage).mockResolvedValue(123 as never);
    vi.mocked(updateZulipMessage).mockResolvedValue(undefined as never);
    vi.mocked(deleteZulipMessage).mockResolvedValue(undefined as never);

    const { emitNotification } = await import("../../utils/notifications");
    vi.mocked(emitNotification).mockResolvedValue(undefined as never);

    testApp = new Hono<TestEnv>();
    testApp.use("*", async (c: Context<TestEnv>, next: () => Promise<void>) => {
      c.set("db", createDrizzleProxy(mockDb) as any);
      await next();
    });
    testApp.route("/", commentsRouter);
  });

  it("should list comments for a target", async () => {
    const mockComments = [
      { id: "1", content: "Great post!", created_at: "2024-01-01", nickname: "User1", avatar: "img1", user_id: "u1" },
    ];
    mockDb.all.mockResolvedValueOnce(mockComments);

    const res = await testApp.request("/post/my-post", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { comments: typeof mockComments };
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
    // Use whitespace to bypass ts-rest schema validation (min(1)) and test handler-level validation
    const res = await testApp.request("/post/my-post", {
      method: "POST",
      body: JSON.stringify({ content: "   " }),
      headers: { "Content-Type": "application/json" },
    }, { DEV_BYPASS: "true" }, mockExecutionContext);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(expect.objectContaining({ error: "Comment content is required" }));
  });

  it("should edit an existing comment", async () => {
    mockDb.get.mockResolvedValueOnce({ user_id: "local-dev", zulip_message_id: 123 });

    const res = await testApp.request("/1", {
      method: "PATCH",
      body: JSON.stringify({ content: "Updated content" }),
      headers: { "Content-Type": "application/json" },
    }, { DEV_BYPASS: "true" }, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("should soft-delete a comment", async () => {
    mockDb.get.mockResolvedValueOnce({ user_id: "local-dev", zulip_message_id: 123 });

    const res = await testApp.request("/1", { 
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  // Error paths and edge cases
  it("GET list - handles db error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("Fail"));
    const res = await testApp.request("/post/my-post", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST submit - handles unverified user", async () => {
    const { getSessionUser } = await import("../middleware");
    vi.mocked(getSessionUser).mockResolvedValueOnce({
      id: "1",
      email: "unverified@test.com",
      name: "Unverified",
      nickname: "Unv",
      image: null,
      role: "unverified",
      member_type: "student",
    });
    const res = await testApp.request("/post/my-post", { method: "POST", body: JSON.stringify({ content: "test" }), headers: { "Content-Type": "application/json" } }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(403);
  });

  it("POST submit - handles long content", async () => {
    const res = await testApp.request("/post/my-post", { method: "POST", body: JSON.stringify({ content: "A".repeat(15000) }), headers: { "Content-Type": "application/json" } }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(400);
  });

  it("POST submit - handles internal error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("Fail"));
    const res = await testApp.request("/post/my-post", { method: "POST", body: JSON.stringify({ content: "test" }), headers: { "Content-Type": "application/json" } }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST submit - handles Zulip and Notification failures", async () => {
    const { sendZulipMessage } = await import("../../utils/zulipSync");
    const { emitNotification } = await import("../../utils/notifications");
    vi.mocked(sendZulipMessage).mockRejectedValueOnce(new Error("Zulip fail"));
    vi.mocked(emitNotification).mockRejectedValueOnce(new Error("Notif fail"));
    
    mockDb.get
      .mockResolvedValueOnce({ cf_email: "other@test.com" })
      .mockResolvedValueOnce({ id: "author-id" });
    
    const res = await testApp.request("/post/my-post", {
      method: "POST",
      body: JSON.stringify({ content: "test" }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);

    expect(res.status).toBe(200);
    await Promise.all(vi.mocked(mockExecutionContext.waitUntil).mock.results.map((r: any) => (r.type === 'return' ? r.value : Promise.resolve())));
  });

  it("PATCH edit - handles not found", async () => {
    mockDb.get.mockResolvedValueOnce(null);
    const res = await testApp.request("/1", { method: "PATCH", body: JSON.stringify({ content: "test" }), headers: { "Content-Type": "application/json" } }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("PATCH edit - handles unauthorized user (not owner)", async () => {
    const { getSessionUser } = await import("../middleware");
    vi.mocked(getSessionUser).mockResolvedValueOnce({
      id: "user",
      email: "member@test.com",
      name: "Member",
      nickname: "Mem",
      image: null,
      role: "member",
      member_type: "student",
    });
    mockDb.get.mockResolvedValueOnce({ user_id: "other-user" });
    const res = await testApp.request("/1", { method: "PATCH", body: JSON.stringify({ content: "test" }), headers: { "Content-Type": "application/json" } }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(403);
  });

  it("PATCH edit - handles db error", async () => {
    mockDb.get.mockResolvedValueOnce({ user_id: "local-dev" });
    mockDb.run.mockRejectedValueOnce(new Error("Fail"));
    const res = await testApp.request("/1", { method: "PATCH", body: JSON.stringify({ content: "test" }), headers: { "Content-Type": "application/json" } }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("PATCH edit - handles Zulip Update failure", async () => {
    mockDb.get.mockResolvedValueOnce({ user_id: "local-dev", zulip_message_id: 123 });
    const { updateZulipMessage } = await import("../../utils/zulipSync");
    vi.mocked(updateZulipMessage).mockRejectedValueOnce(new Error("Zulip fail"));
    
    const res = await testApp.request("/1", {
      method: "PATCH",
      body: JSON.stringify({ content: "Updated content" }),
      headers: { "Content-Type": "application/json" },
    }, { DEV_BYPASS: "true" }, mockExecutionContext);

    expect(res.status).toBe(200);
    await Promise.all(vi.mocked(mockExecutionContext.waitUntil).mock.results.map((r: any) => (r.type === 'return' ? r.value : Promise.resolve())));
  });

  it("DELETE - handles not found", async () => {
    mockDb.get.mockResolvedValueOnce(null);
    const res = await testApp.request("/1", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("DELETE - handles unauthorized user (not owner/admin)", async () => {
    const { getSessionUser } = await import("../middleware");
    vi.mocked(getSessionUser).mockResolvedValueOnce({
      id: "user",
      email: "member@test.com",
      name: "Member",
      nickname: "Mem",
      image: null,
      role: "member",
      member_type: "student",
    });
    mockDb.get.mockResolvedValueOnce({ user_id: "other-user" });
    const res = await testApp.request("/1", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(403);
  });

  it("DELETE - handles internal error", async () => {
    mockDb.get.mockResolvedValueOnce({ user_id: "local-dev" });
    mockDb.run.mockRejectedValueOnce(new Error("Fail"));
    const res = await testApp.request("/1", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE - handles Zulip Delete failure", async () => {
    mockDb.get.mockResolvedValueOnce({ user_id: "local-dev", zulip_message_id: 123 });
    const { deleteZulipMessage } = await import("../../utils/zulipSync");
    vi.mocked(deleteZulipMessage).mockRejectedValueOnce(new Error("Zulip fail"));

    const res = await testApp.request("/1", { 
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
    await Promise.all(vi.mocked(mockExecutionContext.waitUntil).mock.results.map((r: any) => (r.type === 'return' ? r.value : Promise.resolve())));
  });
});

