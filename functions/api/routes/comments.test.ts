import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import commentsRouter from "./comments";
import { AppEnv } from "../middleware";

const mockExecutionContext = {
  waitUntil: vi.fn((promise: Promise<unknown>) => promise),
  passThroughOnException: vi.fn(),
  props: {},
};

// Mock Zulip and Notifications
vi.mock("../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn().mockResolvedValue(123),
  updateZulipMessage: vi.fn().mockResolvedValue(undefined),
  deleteZulipMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../utils/notifications", () => ({
  emitNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    getSessionUser: vi.fn().mockResolvedValue({
      id: "local-dev",
      email: "test@test.com",
      role: "admin",
      nickname: "Local Dev"
    }),
    getSocialConfig: vi.fn().mockResolvedValue({ ZULIP_COMMENT_STREAM: "test-stream" }),
    turnstileMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
    rateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
  };
});

const createMockDb = () => {
      const allFn = vi.fn().mockResolvedValue([]);
      const getFn = vi.fn().mockResolvedValue(null);
      const runFn = vi.fn().mockResolvedValue({ success: true });

      const fns: Record<string, any> = {
        all: allFn,
        get: getFn,
        run: runFn,
        execute: allFn,
        executeTakeFirst: getFn,
        first: getFn
      };

      const chainable: any = new Proxy(fns, {
        get: (target, prop) => {
          if (prop === 'then') {
            return (resolve: any, reject: any) => Promise.resolve(fns.all()).then(resolve).catch(reject);
          }
          if (prop === 'catch') {
            return (reject: any) => Promise.resolve(fns.all()).catch(reject);
          }
          if (prop === 'finally') {
            return (cb: any) => Promise.resolve(fns.all()).finally(cb);
          }
          if (prop === 'query') {
             return new Proxy({}, {
                get: () => new Proxy({}, {
                   get: (tTarget, tProp) => {
                      if (tProp === 'findFirst') return fns.get;
                      if (tProp === 'findMany') return fns.all;
                      return vi.fn().mockReturnValue(chainable);
                   }
                })
             });
          }
          if (prop in target) return target[prop];
          if (prop === 'transaction') return vi.fn(async (cb: any) => cb(chainable));
          if (typeof prop === 'symbol') return chainable;
          target[prop as string] = vi.fn().mockReturnValue(chainable);
          return target[prop as string];
        }
      });
      return chainable;
    };;

describe("Hono Backend - /comments Router", () => {
  let app: Hono<AppEnv>;
  let mockDb: ReturnType<typeof createMockDb>;
  let env: { DEV_BYPASS: string };

  beforeEach(() => {
    mockDb = createMockDb();
    env = { DEV_BYPASS: "true" };
    vi.clearAllMocks();

    app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("db", mockDb as any);
      await next();
    });
    app.route("/", commentsRouter);
  });

  it("should list comments for a target", async () => {
    const mockComments = [
      { id: "1", content: "Great post!", created_at: "2024-01-01", nickname: "User1", avatar: "img1", user_id: "u1" },
    ];
    mockDb.all.mockResolvedValueOnce(mockComments);

    const res = await app.request("/post/my-post", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { comments: typeof mockComments };
    expect(body.comments).toHaveLength(1);
  });

  it("should create a new comment", async () => {
    const res = await app.request("/post/my-post", {
      method: "POST",
      body: JSON.stringify({ content: "New comment content" }),
      headers: { "Content-Type": "application/json" },
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expect.objectContaining({ success: true }));
  });

  it("should return 400 for empty comment content", async () => {
    // Use whitespace to bypass ts-rest schema validation (min(1)) and test handler-level validation
    const res = await app.request("/post/my-post", {
      method: "POST",
      body: JSON.stringify({ content: "   " }),
      headers: { "Content-Type": "application/json" },
    }, env, mockExecutionContext);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(expect.objectContaining({ error: "Comment content is required" }));
  });

  it("should edit an existing comment", async () => {
    mockDb.get.mockResolvedValueOnce({ user_id: "local-dev", zulip_message_id: 123 });

    const res = await app.request("/1", {
      method: "PATCH",
      body: JSON.stringify({ content: "Updated content" }),
      headers: { "Content-Type": "application/json" },
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("should soft-delete a comment", async () => {
    mockDb.get.mockResolvedValueOnce({ user_id: "local-dev", zulip_message_id: 123 });

    const res = await app.request("/1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  // Error paths and edge cases
  it("GET list - handles db error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("Fail"));
    mockDb.get.mockRejectedValueOnce(new Error("Fail"));
    mockDb.run.mockRejectedValueOnce(new Error("Fail"));
    mockDb.first.mockRejectedValueOnce(new Error("Fail"));

    const res = await app.request("/post/my-post", {}, env, mockExecutionContext);
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
    } as any);

    const res = await app.request("/post/my-post", {
      method: "POST",
      body: JSON.stringify({ content: "test" }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);

    expect(res.status).toBe(403);
  });

  it("POST submit - handles long content", async () => {
    const res = await app.request("/post/my-post", {
      method: "POST",
      body: JSON.stringify({ content: "A".repeat(15000) }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);

    expect(res.status).toBe(400);
  });

  it("POST submit - handles internal error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("Fail"));
    mockDb.get.mockRejectedValueOnce(new Error("Fail"));
    mockDb.run.mockRejectedValueOnce(new Error("Fail"));
    mockDb.first.mockRejectedValueOnce(new Error("Fail"));

    const res = await app.request("/post/my-post", {
      method: "POST",
      body: JSON.stringify({ content: "test" }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);

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

    const res = await app.request("/post/my-post", {
      method: "POST",
      body: JSON.stringify({ content: "test" }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);

    // Wait for waitUntil promises
    const waitUntils = mockExecutionContext.waitUntil.mock.calls.map((call: any) => call[0]);
    await Promise.all(waitUntils.map((p: Promise<unknown>) => p.catch(() => {})));
  });

  it("PATCH edit - handles not found", async () => {
    mockDb.get.mockResolvedValueOnce(null);

    const res = await app.request("/1", {
      method: "PATCH",
      body: JSON.stringify({ content: "test" }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);

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
    } as any);

    mockDb.get.mockResolvedValueOnce({ user_id: "other-user" });

    const res = await app.request("/1", {
      method: "PATCH",
      body: JSON.stringify({ content: "test" }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);

    expect(res.status).toBe(403);
  });

  it("PATCH edit - handles db error", async () => {
    mockDb.get.mockResolvedValueOnce({ user_id: "local-dev" });
    mockDb.all.mockRejectedValueOnce(new Error("Fail"));
    mockDb.get.mockRejectedValueOnce(new Error("Fail"));
    mockDb.run.mockRejectedValueOnce(new Error("Fail"));
    mockDb.first.mockRejectedValueOnce(new Error("Fail"));

    const res = await app.request("/1", {
      method: "PATCH",
      body: JSON.stringify({ content: "test" }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("PATCH edit - handles Zulip Update failure", async () => {
    mockDb.get.mockResolvedValueOnce({ user_id: "local-dev", zulip_message_id: 123 });

    const { updateZulipMessage } = await import("../../utils/zulipSync");
    vi.mocked(updateZulipMessage).mockRejectedValueOnce(new Error("Zulip fail"));

    const res = await app.request("/1", {
      method: "PATCH",
      body: JSON.stringify({ content: "Updated content" }),
      headers: { "Content-Type": "application/json" },
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);

    // Wait for waitUntil promises
    const waitUntils = mockExecutionContext.waitUntil.mock.calls.map((call: any) => call[0]);
    await Promise.all(waitUntils.map((p: Promise<unknown>) => p.catch(() => {})));
  });

  it("DELETE - handles not found", async () => {
    mockDb.get.mockResolvedValueOnce(null);

    const res = await app.request("/1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

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
    } as any);

    mockDb.get.mockResolvedValueOnce({ user_id: "other-user" });

    const res = await app.request("/1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(403);
  });

  it("DELETE - handles internal error", async () => {
    mockDb.get.mockResolvedValueOnce({ user_id: "local-dev" });
    mockDb.all.mockRejectedValueOnce(new Error("Fail"));
    mockDb.get.mockRejectedValueOnce(new Error("Fail"));
    mockDb.run.mockRejectedValueOnce(new Error("Fail"));
    mockDb.first.mockRejectedValueOnce(new Error("Fail"));

    const res = await app.request("/1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("DELETE - handles Zulip Delete failure", async () => {
    mockDb.get.mockResolvedValueOnce({ user_id: "local-dev", zulip_message_id: 123 });

    const { deleteZulipMessage } = await import("../../utils/zulipSync");
    vi.mocked(deleteZulipMessage).mockRejectedValueOnce(new Error("Zulip fail"));

    const res = await app.request("/1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);

    // Wait for waitUntil promises
    const waitUntils = mockExecutionContext.waitUntil.mock.calls.map((call: any) => call[0]);
    await Promise.all(waitUntils.map((p: Promise<unknown>) => p.catch(() => {})));
  });
});
