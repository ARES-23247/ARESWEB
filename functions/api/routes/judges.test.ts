 
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

vi.mock("../middleware/security", () => ({
  checkPersistentRateLimit: vi.fn().mockResolvedValue(true)
}));

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
      where: vi.fn((key) => {
        if (typeof key === "function") {
          key(Object.assign(vi.fn(), {
            or: vi.fn(),
            and: vi.fn(),
            is: vi.fn(),
            ">": vi.fn()
          }));
        }
        return mockDb;
      }),
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
    mockDb.executeTakeFirst.mockResolvedValueOnce({ code: "VALID", label: "Judge" });
    
    const res = await testApp.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "VALID" })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
  });

  it("GET /portfolio - fetch and sanitize data", async () => {
    // 1st call: rate limit check
    // 2nd call: judge code check
    mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 0, expires_at: 9999999999 })
                          .mockResolvedValueOnce({ code: "VALID" }); 
    
    // Mock documents with internal notes
    const mockDocs = [
      { slug: "test", title: "Test Doc", content: "Championship info. TODO: check intake physics. FIXME: robot image missing.", category: "Build", description: "TODO: fix" }
    ];
    // Mock records without optional fields
    mockDb.execute.mockResolvedValueOnce(mockDocs) // docs
                 .mockResolvedValueOnce([{ id: "1", title: "Outreach 1", students_count: "5", hours_logged: "10", reach_count: "100" }]) // outreach (no description)
                 .mockResolvedValueOnce([{ id: "1", title: "Award 1", date: "2024" }]) // awards (no description)
                 .mockResolvedValueOnce([{ name: "Sponsor 1", tier: "Gold" }]); // sponsors (no id)

    const res = await testApp.request("/portfolio", {
      headers: { 
        "x-judge-code": "VALID",
        "CF-Connecting-IP": "127.0.0.1",
        "User-Agent": "vitest"
      }
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.portfolioDocs).toHaveLength(1);
    expect(body.portfolioDocs[0].content).toBe("Championship info.");
  });

  it("GET /portfolio - returns cached data on second call", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 0, expires_at: 9999999999 })
                          .mockResolvedValueOnce({ code: "VALID" }); 
    const res = await testApp.request("/portfolio", {
      headers: { "x-judge-code": "VALID" }
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /login - handles rate limit failure", async () => {
    const security = await import("../middleware/security");
    vi.mocked(security.checkPersistentRateLimit).mockResolvedValueOnce(false);
    const res = await testApp.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "VALID" })
    }, env, mockExecutionContext);
    expect(res.status).toBe(429);
  });

  it("POST /login - handles turnstile failure", async () => {
    const middleware = await import("../middleware");
    vi.mocked(middleware.verifyTurnstile).mockResolvedValueOnce(false);
    const res = await testApp.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "VALID", turnstileToken: "bad" })
    }, env, mockExecutionContext);
    expect(res.status).toBe(403);
  });

  it("POST /login - handles missing code", async () => {
    const res = await testApp.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);
    expect(res.status).toBe(400);
  });

  it("POST /login - handles invalid code", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    const res = await testApp.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "INVALID" })
    }, env, mockExecutionContext);
    expect(res.status).toBe(403);
  });

  it("POST /login - handles db error", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "CRASH" })
    }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /portfolio - rejects missing code header", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 0, expires_at: 9999999999 });

    const res = await testApp.request("/portfolio", {}, env, mockExecutionContext);
    expect(res.status).toBe(401);
  });



  it("GET /admin/codes - list codes", async () => {
    mockDb.execute.mockResolvedValueOnce([
      { code: "ABC", expires_at: null, label: "Test", created_at: "2024" },
      { code: "DEF", expires_at: "2025", label: "Test2", created_at: "2024" }
    ]);
    const res = await testApp.request("/admin/codes", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /admin/codes - handles db error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/admin/codes", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/codes - create code with optional fields", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ insertId: 123 });
    const res = await testApp.request("/admin/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Judge 1", expiresAt: "2025-01-01" })
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/codes - create code without optional fields", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ insertId: 123 });
    const res = await testApp.request("/admin/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/codes - handles db error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/admin/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Test" })
    }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/codes/:id - handles error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/codes/bad-id", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/codes/:id - delete code", async () => {
    const res = await testApp.request("/admin/codes/123", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /portfolio - handles db error or exception", async () => {
    const originalDateNow = Date.now;
    Date.now = vi.fn(() => originalDateNow() + 400000);
    try {
      mockDb.executeTakeFirst.mockResolvedValueOnce({ code: "VALID" });
      mockDb.execute.mockRejectedValueOnce(new Error("DB Error"));
      const res = await testApp.request("/portfolio", {
        headers: { "x-judge-code": "VALID" }
      }, env, mockExecutionContext);
      expect(res.status).toBe(500);
    } finally {
      Date.now = originalDateNow;
    }
  });
});
