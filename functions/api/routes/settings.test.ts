import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { settingsRouter } from "./settings";
import { AppEnv } from "../middleware";

// Simple inline mock execution context
function createMockExecutionContext(): any {
  return {
    waitUntil: vi.fn((promise: Promise<unknown>) => promise),
    passThroughOnException: vi.fn(),
    props: {},
  };
}

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
    logAuditAction: vi.fn().mockResolvedValue(true),
    getDbSettings: vi.fn().mockResolvedValue({ site_name: "ARES", BETTER_AUTH_SECRET: "super-secret-key-1234" }),
  };
});

// Simple inline mock database
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
          if (prop === 'then') return undefined;
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
          if (prop === 'transaction') return vi.fn(async (cb) => cb(chainable));
          target[prop as string] = vi.fn().mockReturnValue(chainable);
          return target[prop as string];
        }
      });
      return chainable;
    };

describe("Hono Backend - /settings Router", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let testApp: Hono<AppEnv>;
  let env: AppEnv["Bindings"];
  const mockExecutionContext = createMockExecutionContext();

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = createMockDb();

    env = {
      DB: {} as unknown as D1Database,
      ENVIRONMENT: "test",
      DEV_BYPASS: "true",
    } as AppEnv["Bindings"];

    testApp = new Hono<AppEnv>();
    testApp.use("*", async (c, next) => {
      c.set("db", mockDb as any);
      c.set("sessionUser", {
        id: "1",
        email: "admin@test.com",
        name: "Admin User",
        role: "admin",
        member_type: "mentor"
      } as any);
      await next();
    });
    testApp.route("/", settingsRouter);
  });

  it("GET / - list settings (masked)", async () => {
    const res = await testApp.request("/admin/settings", {}, env, mockExecutionContext);
    if (res.status === 500) console.log(await res.json());
    expect(res.status).toBe(200);
    const body = await res.json() as { settings: Record<string, string>; success: boolean };
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
    expect(mockDb.insert).toHaveBeenCalledWith(expect.anything());
  });

  it("GET /stats - get platform stats", async () => {
    mockDb.first.mockResolvedValue({ count: 10 });
    const res = await testApp.request("/admin/stats", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { posts: number; users: number; events: number; docs: number };
    expect(body.posts).toBe(10);
  });

  it("GET /stats - get platform stats with null values", async () => {
    mockDb.first.mockResolvedValue(null);
    const res = await testApp.request("/admin/stats", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { posts: number; users: number; events: number; docs: number };
    expect(body.posts).toBe(0);
    expect(body.users).toBe(0);
  });

  it("GET /stats - handles database error", async () => {
    mockDb.first.mockRejectedValueOnce(new Error("Fail"));
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
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    const body = await res.json() as { updated: number; success: boolean };
    expect(body.updated).toBe(1);
  });

  it("POST / - handles update error", async () => {
    // Handler uses insert().values().onConflictDoUpdate().run()
    mockDb.run.mockRejectedValueOnce(new Error("Fail"));
    const payload = { site_name: "New Name" };
    const res = await testApp.request("/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("GET /admin/backup - database export", async () => {
    mockDb.all.mockResolvedValue([{ id: 1, name: "Bob", email: "bob@test.com" }]);

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

  it("POST /admin/settings - skip masked secrets", async () => {
    const payload = { BETTER_AUTH_SECRET: "••••1234", NORMAL_KEY: "value" };
    const res = await testApp.request("/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as { updated: number; success: boolean };
    expect(body.updated).toBe(1); // Only NORMAL_KEY updated
  });

  it("POST /admin/settings - error", async () => {
    mockDb.insert.mockImplementationOnce(() => { throw new Error("DB error") });
    const payload = { site_name: "New Name" };
    const res = await testApp.request("/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("GET /admin/stats - error", async () => {
    mockDb.first.mockRejectedValueOnce(new Error("DB error"));
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
    mockDb.all.mockRejectedValue(new Error("DB Error"));

    const res = await testApp.request("/admin/backup", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.backup.posts).toEqual([]);
  });
});
