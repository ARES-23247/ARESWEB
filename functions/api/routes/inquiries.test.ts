 
declare const global: typeof globalThis;
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    getDbSettings: vi.fn().mockResolvedValue({}),
    ensureAdmin: async (_c: unknown, next: any) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "1", role: "admin", email: "admin@test.com" }),
    logAuditAction: vi.fn().mockResolvedValue(true),
    rateLimitMiddleware: () => async (_c: unknown, next: any) => next(),
    checkRateLimit: vi.fn().mockReturnValue(true),
  };
});

vi.mock("../../utils/zulipSync", () => ({
  sendZulipAlert: vi.fn().mockResolvedValue(true),
}));

import inquiriesRouter from "./inquiries";

describe("Hono Backend - /inquiries Router", () => {
  
  let mockDb: any;
  let testApp: Hono<any>;
  let env: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Polyfill crypto for Node.js test environment if needed
    if (typeof (global as any).crypto === "undefined") {
      (global as any).crypto = {
        randomUUID: () => "test-uuid-" + Math.random().toString(36).substring(7)
      };
    } else if (typeof (global as any).crypto.randomUUID === "undefined") {
      (global as any).crypto.randomUUID = () => "test-uuid-" + Math.random().toString(36).substring(7);
    }

    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      deleteFrom: vi.fn().mockReturnThis(),
    };

    mockDb.transaction = vi.fn().mockReturnValue({
      execute: vi.fn().mockImplementation(async (cb: any) => {
        return await cb(mockDb);
      }),
    });

    env = {
      DB: {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      },
      DEV_BYPASS: "true",
      TURNSTILE_SECRET: "test-secret",
    };

    testApp = new Hono<any>();
    testApp.onError((err, c: any) => {
      console.error("Test App Error:", err);
      return c.json({ error: err.message }, 500);
    });
    testApp.use("*", async (c: any, next: any) => {
      c.set("db", mockDb);
      // getSessionUser checks for "sessionUser" in context
      c.set("sessionUser", { id: "1", role: "admin", email: "admin@test.com" });
      await next();
    });
    testApp.route("/", inquiriesRouter);
  });

  it("GET /admin/list - list all", async () => {
    const res = await testApp.request("/admin/list?page=1&limit=50", {
      headers: { "DEV_BYPASS": "true" }
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.selectFrom).toHaveBeenCalledWith("inquiries");
  });

  it("POST / - submit new inquiry", async () => {
    // Mock fetch for turnstile
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });

    const res = await testApp.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "support",
        name: "Test",
        email: "test@test.com",
        metadata: { msg: "hello" }
      })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.insertInto).toHaveBeenCalledWith("inquiries");
  });

  it("PATCH /admin/:id/status - update status", async () => {
    const res = await testApp.request("/admin/1/status", {
      method: "PATCH",
      headers: { 
        "Content-Type": "application/json",
        "DEV_BYPASS": "true"
      },
      body: JSON.stringify({ status: "resolved" })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.updateTable).toHaveBeenCalledWith("inquiries");
  });

  it("DELETE /admin/:id - delete", async () => {
    const res = await testApp.request("/admin/1", {
      method: "DELETE",
      headers: { 
        "Content-Type": "application/json",
        "DEV_BYPASS": "true"
      },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.deleteFrom).toHaveBeenCalled();
  });

  it("GET /admin/list - masks PII for students", async () => {
    // Setup a new app instance to override sessionUser for this test
    const studentApp = new Hono<any>();
    studentApp.use("*", async (c: any, next: any) => {
      c.set("db", mockDb);
      c.set("sessionUser", { id: "2", role: "user", member_type: "student", email: "student@test.com" });
      await next();
    });
    studentApp.route("/", inquiriesRouter);

    mockDb.execute.mockResolvedValue([
      {
        id: "1",
        type: "support",
        name: "John Doe",
        email: "john.doe@example.com",
        status: "pending",
        created_at: "2023-01-01T00:00:00Z",
        metadata: JSON.stringify({ level: "Gold", secret: "private" })
      }
    ]);

    const res = await studentApp.request("/admin/list", {
      headers: { "DEV_BYPASS": "true" }
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    const inquiry = body.inquiries[0];

    // name: J******* (1 + length-1 stars)
    expect(inquiry.name).toBe("J" + "*".repeat("John Doe".length - 1));
    // email: jo******@example.com
    expect(inquiry.email).toBe("jo" + "*".repeat("hn.doe".length) + "@example.com");
    // metadata: only whitelisted keys
    const meta = JSON.parse(inquiry.metadata);
    expect(meta.level).toBe("Gold");
    expect(meta.secret).toBeUndefined();
  });
});
