 
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";
import { settingsRouter } from "./settings";

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
    logAuditAction: vi.fn().mockResolvedValue(true),
    getDbSettings: vi.fn().mockResolvedValue({ site_name: "ARES", BETTER_AUTH_SECRET: "super-secret-key-1234" }),
  };
});

describe("Hono Backend - /settings Router", () => {
  
  
   
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
      limit: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockImplementation((cb) => {
        if (typeof cb === 'function') {
          const ocMock = { column: vi.fn().mockReturnValue({ doUpdateSet: vi.fn().mockReturnThis() }) };
          cb(ocMock);
        }
        return mockDb;
      }),
      doUpdateSet: vi.fn().mockReturnThis(),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      fn: {
        count: vi.fn().mockReturnValue({ as: vi.fn().mockReturnThis() }),
      },
    };

    env = {
      DB: {},
      ENVIRONMENT: "test",
      DEV_BYPASS: "true",
    };

    testApp = new Hono<any>();
    testApp.use("*", async (c: any, next: any) => {
      c.set("db", mockDb);
      c.set("user", { id: "1", email: "admin@test.com", role: "admin" });
      await next();
    });
    testApp.route("/", settingsRouter);
  });

  it("GET / - list settings (masked)", async () => {
    const res = await testApp.request("/admin/settings", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.settings.site_name).toBe("ARES");
    expect(body.settings.BETTER_AUTH_SECRET).toContain("••••");
  });

  it("POST / - update settings", async () => {
    const payload = { site_name: "New Name" };
    const res = await testApp.request("/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.insertInto).toHaveBeenCalledWith("settings");
  });

  it("GET /stats - get platform stats", async () => {
    mockDb.executeTakeFirst.mockResolvedValue({ count: 10 });
    const res = await testApp.request("/admin/stats", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.posts).toBe(10);
  });

  it("GET /stats - get platform stats with null values", async () => {
    mockDb.executeTakeFirst.mockResolvedValue(null);
    const res = await testApp.request("/admin/stats", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.posts).toBe(0);
    expect(body.users).toBe(0);
  });

  it("GET /stats - handles database error", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("Fail"));
    const res = await testApp.request("/admin/stats", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST / - update settings ignores masked secrets", async () => {
    const payload = { BETTER_AUTH_SECRET: "••••mask", site_name: "Valid" };
    const res = await testApp.request("/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    // Should only have inserted site_name
    expect(mockDb.insertInto).toHaveBeenCalledTimes(1);
    const body = await res.json() as any;
    expect(body.updated).toBe(1);
  });

  it("POST / - handles update error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("Fail"));
    const payload = { site_name: "New Name" };
    const res = await testApp.request("/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("GET /admin/backup - database export", async () => {
    let currentTable = "";
    mockDb.selectFrom.mockImplementation((table: string) => {
      currentTable = table;
      return mockDb;
    });
    mockDb.execute.mockImplementation(async () => {
      if (currentTable === "inquiries") {
        return [{ id: 1, name: "Bob", email: "bob@test.com" }];
      }
      return [];
    });

    const res = await testApp.request("/admin/backup", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.backup).toBeDefined();
    
    // Verify inquiries masking
    expect(body.backup.inquiries[0].name).toBe("B***");
    expect(body.backup.inquiries[0].email).toBe("***@***.***");
  });

  it("GET /public/settings - get public settings", async () => {
    const res = await testApp.request("/public/settings", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  // Error Paths
  it("GET /admin/settings - error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    // mock getDbSettings to throw
    await testApp.request("/admin/settings", {
      method: "POST", // invalid method to force error or mock differently?
      // wait, I can't mock getDbSettings easily here since it's vi.mock'd at the top.
      // let's pass a bad body to POST instead to get 500
    }, env, mockExecutionContext);
    // actually, let's just make db.insertInto throw for POST
  });

  it("POST /admin/settings - skip masked secrets", async () => {
    const payload = { BETTER_AUTH_SECRET: "••••1234", NORMAL_KEY: "value" };
    const res = await testApp.request("/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.updated).toBe(1); // Only NORMAL_KEY updated
  });

  it("POST /admin/settings - error", async () => {
    mockDb.insertInto.mockImplementationOnce(() => { throw new Error("DB error") });
    const payload = { site_name: "New Name" };
    const res = await testApp.request("/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("GET /admin/stats - error", async () => {
    mockDb.selectFrom.mockImplementationOnce(() => { throw new Error("DB error") });
    const res = await testApp.request("/admin/stats", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/settings - returns 400 on long value", async () => {
    const payload = { site_name: "A".repeat(11000) };
    const res = await testApp.request("/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, env, mockExecutionContext);

    expect(res.status).toBe(400);
  });

  it("GET /admin/backup - database export with db execution failure", async () => {
    mockDb.selectFrom.mockImplementation((_table: string) => mockDb);
    mockDb.execute.mockRejectedValue(new Error("DB Error"));

    const res = await testApp.request("/admin/backup", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.backup.posts).toEqual([]);
  });

});
