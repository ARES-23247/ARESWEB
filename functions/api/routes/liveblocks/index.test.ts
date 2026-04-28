import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext } from "../../../../src/test/utils";

// Hoist mocks
const mockAuthorize = vi.fn().mockResolvedValue({ status: 200, body: '{"token":"mock-token"}' });
const mockAllow = vi.fn();
const mockPrepareSession = vi.fn().mockReturnValue({
  FULL_ACCESS: ["room:write"],
  allow: mockAllow,
  authorize: mockAuthorize
});

// Mock middleware
vi.mock("../../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
    persistentRateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
  };
});

// Mock Liveblocks
vi.mock("@liveblocks/node", () => {
  return {
    Liveblocks: class {
      constructor() {}
      prepareSession = mockPrepareSession;
    }
  };
});

import liveblocksRouter from "./index";

describe("Hono Backend - /liveblocks Router", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testApp: Hono<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthorize.mockResolvedValue({ status: 200, body: '{"token":"mock-token"}' });
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    testApp = new Hono<any>();
    
    // Inject sessionUser and env for test
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    testApp.use("*", async (c: any, next: any) => {
      c.set("sessionUser", {
        id: "user-123",
        email: "test@example.com",
        nickname: "Tester",
        image: "avatar.png",
        role: "author",
        member_type: "student"
      });
      c.env = { LIVEBLOCKS_SECRET_KEY: "test-secret" };
      await next();
    });
    testApp.route("/", liveblocksRouter);
  });

  it("POST /auth - mints a token for a valid room", async () => {
    const res = await testApp.request("/auth", {
      method: "POST",
      body: JSON.stringify({ room: "doc-123" }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as { token: string };
    expect(body.token).toBe("mock-token");

    // Verify Liveblocks was called correctly
    expect(mockPrepareSession).toHaveBeenCalledWith("user-123", {
      userInfo: { name: "Tester", avatar: "avatar.png" }
    });
    expect(mockAllow).toHaveBeenCalledWith("doc-123", ["room:write"]);
  });

  it("POST /auth - returns 400 if room is missing", async () => {
    const res = await testApp.request("/auth", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);

    expect(res.status).toBe(400);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await res.json() as any;
    expect(body.error).toBe("Room ID is required");
  });

  it("POST /auth - returns 401 if sessionUser is missing", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const noUserApp = new Hono<any>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    noUserApp.use("*", async (c: any, next: any) => {
      c.env = { LIVEBLOCKS_SECRET_KEY: "test-secret" };
      await next();
    });
    noUserApp.route("/", liveblocksRouter);

    const res = await noUserApp.request("/auth", {
      method: "POST",
      body: JSON.stringify({ room: "doc-123" }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);

    expect(res.status).toBe(401);
  });

  it("POST /auth - falls back to default name/avatar if missing", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const defaultUserApp = new Hono<any>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defaultUserApp.use("*", async (c: any, next: any) => {
      c.set("sessionUser", {
        id: "user-456",
        email: "test2@example.com",
        nickname: null,
        name: null,
        image: null,
        role: "author",
        member_type: "student"
      });
      c.env = { LIVEBLOCKS_SECRET_KEY: "test-secret" };
      await next();
    });
    defaultUserApp.route("/", liveblocksRouter);

    const res = await defaultUserApp.request("/auth", {
      method: "POST",
      body: JSON.stringify({ room: "doc-123" }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockPrepareSession).toHaveBeenCalledWith("user-456", {
      userInfo: { name: "Anonymous", avatar: "" }
    });
  });

  it("POST /auth - returns 500 if Liveblocks throws an error", async () => {
    // Force prepareSession to throw
    mockPrepareSession.mockImplementationOnce(() => {
      throw new Error("Liveblocks API Error");
    });

    const res = await testApp.request("/auth", {
      method: "POST",
      body: JSON.stringify({ room: "doc-123" }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);

    expect(res.status).toBe(500);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await res.json() as any;
    expect(body.error).toBe("Failed to authenticate with Liveblocks");
  });
});
