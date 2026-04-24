import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";
import settingsRouter from "./settings";

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
  
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;
  let testApp: Hono;
  let env: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
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

    testApp = new Hono();
    testApp.use("*", async (c, next) => {
      c.set("db", mockDb);
      c.set("user", { id: "1", email: "admin@test.com", role: "admin" });
      await next();
    });
    testApp.route("/", settingsRouter);
  });

  it("GET / - list settings (masked)", async () => {
    const res = await testApp.request("/admin/settings", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
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
    const body = await res.json() as Record<string, unknown>;
    expect(body.posts).toBe(10);
  });

  it("GET /admin/backup - database export", async () => {
    const res = await testApp.request("/admin/backup", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.backup).toBeDefined();
  });
});
