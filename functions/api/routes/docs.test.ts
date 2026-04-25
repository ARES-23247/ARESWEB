 

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";

const mockUser = { id: "1", email: "admin@test.com", role: "admin" };
let authBypass = true;

// Mock middleware
vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (c: any, next: () => Promise<void>) => {
      if (authBypass) return next();
      return c.json({ error: "Forbidden" }, 403);
    },
    ensureAuth: async (c: any, next: () => Promise<void>) => {
      if (authBypass) return next();
      return c.json({ error: "Unauthorized" }, 401);
    },
    getSessionUser: vi.fn().mockImplementation(() => Promise.resolve(mockUser)),
    checkRateLimit: vi.fn().mockReturnValue(true),
    verifyTurnstile: vi.fn().mockResolvedValue(true),
    logAuditAction: vi.fn().mockResolvedValue(true),
    notifyByRole: vi.fn().mockResolvedValue(true),
    emitNotification: vi.fn().mockResolvedValue(true),
  };
});

vi.mock("../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn().mockResolvedValue(true),
}));

import docsRouter from "./docs";

describe("Hono Backend - /docs Router", () => {
  
  
   
  let mockDb: any;
  let testApp: Hono<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      distinct: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      column: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      deleteFrom: vi.fn().mockReturnThis(),
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
    testApp.route("/", docsRouter);
  });

  it("GET / - list public docs", async () => {
    mockDb.execute.mockResolvedValueOnce([{ slug: "test", title: "Test Doc", category: "General" }]);
    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /:slug - get single doc", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ slug: "test", title: "Test Doc", content: "..." });
    mockDb.execute.mockResolvedValueOnce([]); // contributors
    const res = await testApp.request("/test", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - save doc", async () => {
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({
        slug: "new-doc",
        title: "New Doc",
        category: "Manuals",
        content: "Content here",
        isDraft: false
      }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /admin/save - block unauthorized user", async () => {
    authBypass = false;
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ slug: "fail" }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "false" }, mockExecutionContext);

    expect(res.status).toBe(401);
    authBypass = true; // reset for other tests
  });
});
