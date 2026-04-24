 
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    getDbSettings: vi.fn().mockResolvedValue({}),
    ensureAdmin: async (c: any, next: any) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "1", role: "admin", email: "admin@test.com" }),
    logAuditAction: vi.fn().mockResolvedValue(true),
    rateLimitMiddleware: () => async (c: any, next: any) => next(),
    checkRateLimit: vi.fn().mockReturnValue(true),
  };
});

vi.mock("../../utils/crypto", () => ({
  decrypt: vi.fn((val) => Promise.resolve("decrypted_" + val)),
  encrypt: vi.fn((val) => Promise.resolve("encrypted_" + val)),
}));

import usersRouter from "./users";

describe("Hono Backend - /users Router", () => {
  let mockDb: any;
  let testApp: Hono<any>;
  let env: any;

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
      DEV_BYPASS: "true",
      ENCRYPTION_SECRET: "test-secret",
    };

    testApp = new Hono<any>();
    testApp.use("*", async (c: any, next: any) => {
      c.set("db", mockDb);
      await next();
    });
    testApp.route("/", usersRouter);
  });

  it("GET /admin/list - list users", async () => {
    const res = await testApp.request("/admin/list", {}, env, mockExecutionContext);
    if (res.status !== 200) {
      console.log(res.status, await res.text());
    }
    expect(res.status).toBe(200);
    expect(mockDb.selectFrom).toHaveBeenCalledWith("user as u");
  });

  it("GET /admin/:id - detail view", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({
      id: "1",
      email: "test@test.com",
    });

    const res = await testApp.request("/admin/1", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, any>;
    expect(body.user.id).toBe("1");
    expect(body.user.email).toBe("test@test.com");
  });

  it("PATCH /admin/:id - update role", async () => {
    const res = await testApp.request("/admin/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin" })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.updateTable).toHaveBeenCalledWith("user");
  });

  it("DELETE /admin/:id - delete user", async () => {
    const res = await testApp.request("/admin/1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.deleteFrom).toHaveBeenCalledWith("user");
  });
});
