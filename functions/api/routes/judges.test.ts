 
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";
import judgesRouter from "./judges";

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
    verifyTurnstile: vi.fn().mockResolvedValue(true),
    rateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
    logAuditAction: vi.fn().mockResolvedValue(true),
  };
});

describe("Hono Backend - /judges Router", () => {
  
  
   
  let mockDb: any;
  let testApp: Hono<any>;
  let env: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();

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

    env = {
      DB: {
        // Need D1 for security middleware if called
        prepare: vi.fn().mockReturnThis(),
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({}),
      },
      ENVIRONMENT: "test",
      DEV_BYPASS: "true",
      TURNSTILE_SECRET_KEY: "secret",
    };

    testApp = new Hono<any>();
    testApp.use("*", async (c: any, next: any) => {
      c.set("db", mockDb);
      c.set("user", { id: "1", email: "admin@test.com", role: "admin" });
      await next();
    });
    testApp.route("/", judgesRouter);
  });

  it("POST /login - valid code", async () => {
    // 1st call: rate limit check (returns null or record)
    // 2nd call: judge code check
    mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 0, expires_at: 9999999999 }) 
                          .mockResolvedValueOnce({ code: "VALID", label: "Judge" });
    
    const res = await testApp.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "VALID" })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
  });

  it("GET /portfolio - fetch data", async () => {
    // 1st call: rate limit check
    // 2nd call: judge code check
    mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 0, expires_at: 9999999999 })
                          .mockResolvedValueOnce({ code: "VALID" }); 
    mockDb.execute.mockResolvedValue([]); // For the 4 queries

    const res = await testApp.request("/portfolio", {
      headers: { "X-Judge-Code": "VALID" }
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("GET /admin/codes - list codes", async () => {
    const res = await testApp.request("/admin/codes", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.selectFrom).toHaveBeenCalledWith("judge_access_codes");
  });

  it("POST /admin/codes - create code", async () => {
    const res = await testApp.request("/admin/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "New Judge" })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.insertInto).toHaveBeenCalled();
  });

  it("DELETE /admin/codes/:id - delete", async () => {
    const res = await testApp.request("/admin/codes/123", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.deleteFrom).toHaveBeenCalled();
  });
});
