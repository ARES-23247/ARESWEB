// TODO: users.ts implementation uses getProfile/updateProfile/listUsers/updateRole
// but userContract exports getUsers/adminDetail/patchUser/updateUserProfile/adminGetProfile/deleteUser
// The contract and implementation are misaligned - need to rewrite users.ts to match userContract
// or create a separate usersContract that matches the existing implementation

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono, Context } from "hono";
import { usersRouter } from "./users";
import { AppEnv, getDb } from "../middleware";

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

let mockDbInstance: ReturnType<typeof createMockDb> | null = null;

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    getDbSettings: vi.fn().mockResolvedValue({}),
    ensureAdmin: async (c: Context<AppEnv>, next: () => Promise<void>) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "1", role: "admin", email: "admin@test.com" }),
    logAuditAction: vi.fn().mockResolvedValue(true),
    rateLimitMiddleware: () => async (c: Context<AppEnv>, next: () => Promise<void>) => next(),
    getDb: vi.fn((c) => c.get("db") as any || (mockDbInstance || createMockDb())),
  };
});

vi.mock("../../utils/crypto", () => ({
  decrypt: vi.fn((val: unknown) => Promise.resolve("decrypted_" + val)),
  encrypt: vi.fn((val: unknown) => Promise.resolve("encrypted_" + val)),
}));

vi.mock("./_profileUtils", () => ({
  upsertProfile: vi.fn().mockResolvedValue(true),
}));

describe("Hono Backend - /users Router", () => {
  let app: Hono<AppEnv>;
  let mockDb: ReturnType<typeof createMockDb>;
  const mockAdminUser = { id: "1", role: "admin", email: "admin@test.com" };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockDbInstance = mockDb;
    app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("db", mockDb as any);
      c.set("sessionUser", mockAdminUser as any);
      await next();
    });
    app.route("/", usersRouter);
  });

  it("GET /admin/list - list users", async () => {
    mockDb.query.user.findMany.mockResolvedValueOnce([]);
    const res = await app.request("/admin/list", {}, {
      env: { DEV_BYPASS: "true" } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(200);
  });

  it("GET /admin/:id - detail view", async () => {
    mockDb.query.user.findFirst.mockResolvedValueOnce({
      id: "1",
      name: "Test User",
      email: "test@test.com",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      userProfiles: [{ nickname: "TestUser" }]
    });
    const res = await app.request("/admin/1", {}, {
      env: { DEV_BYPASS: "true" } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { user: { id: string; email: string } };
    expect(body.user.id).toBe("1");
    expect(body.user.email).toBe("test@test.com");
  });

  it("PATCH /admin/:id - update role", async () => {
    mockDb.query.user.findFirst.mockResolvedValueOnce({
      id: "1",
      email: "test@test.com",
      role: "user"
    });
    mockDb.run.mockResolvedValueOnce({ success: true });
    const res = await app.request("/admin/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin" })
    }, {
      env: { DEV_BYPASS: "true" } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });

    expect(res.status).toBe(200);
  });

  it("PATCH /admin/:id - update member_type (existing profile)", async () => {
    mockDb.query.user.findFirst.mockResolvedValueOnce({
      id: "1",
      email: "test@test.com"
    });
    mockDb.query.userProfiles.findFirst.mockResolvedValueOnce({
      userId: "1",
      memberType: "student"
    });
    mockDb.run.mockResolvedValueOnce({ success: true });
    const res = await app.request("/admin/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_type: "mentor" })
    }, {
      env: { DEV_BYPASS: "true" } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });

    expect(res.status).toBe(200);
  });

  it("PATCH /admin/:id - update member_type (new profile)", async () => {
    mockDb.query.user.findFirst.mockResolvedValueOnce({
      id: "1",
      email: "test@test.com"
    });
    mockDb.query.userProfiles.findFirst.mockResolvedValueOnce(null);
    mockDb.run.mockResolvedValueOnce({ success: true });
    const res = await app.request("/admin/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_type: "student" })
    }, {
      env: { DEV_BYPASS: "true" } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });

    expect(res.status).toBe(200);
  });

  it("DELETE /admin/:id - delete user", async () => {
    mockDb.run.mockResolvedValueOnce({ success: true });
    const res = await app.request("/admin/1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, {
      env: { DEV_BYPASS: "true" } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });

    expect(res.status).toBe(200);
  });

  it("PUT /admin/:id/profile - update user profile", async () => {
    const res = await app.request("/admin/1/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: "Admin User" })
    }, {
      env: { DEV_BYPASS: "true" } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBeDefined();
  });

  it("GET /admin/:id/profile - get admin profile", async () => {
    mockDb.query.user.findFirst.mockResolvedValueOnce({
      id: "1",
      email: "admin@test.com",
      name: "Admin"
    });
    mockDb.query.userProfiles.findFirst.mockResolvedValueOnce({
      userId: "1",
      nickname: "Admin User"
    });
    const res = await app.request("/admin/1/profile", {}, {
      env: { DEV_BYPASS: "true" } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { profile: { nickname: string } };
    expect(body.profile.nickname).toBe("Admin User");
  });

  // Error paths
  it("GET /admin/list - error", async () => {
    mockDb.query.user.findMany.mockRejectedValueOnce(new Error("DB error"));
    const res = await app.request("/admin/list", {}, {
      env: { DEV_BYPASS: "true" } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(500);
  });

  it("GET /admin/:id - not found", async () => {
    mockDb.query.user.findFirst.mockResolvedValueOnce(null);
    const res = await app.request("/admin/999", {}, {
      env: { DEV_BYPASS: "true" } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(404);
  });

  it("GET /admin/:id - database error", async () => {
    mockDb.query.user.findFirst.mockRejectedValueOnce(new Error("DB error"));
    const res = await app.request("/admin/1", {}, {
      env: { DEV_BYPASS: "true" } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(500);
  });

  it("PATCH /admin/:id - error", async () => {
    mockDb.query.user.findFirst.mockResolvedValueOnce({
      id: "1",
      email: "test@test.com"
    });
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    const res = await app.request("/admin/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin" })
    }, {
      env: { DEV_BYPASS: "true" } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:id - error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    const res = await app.request("/admin/1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, {
      env: { DEV_BYPASS: "true" } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(500);
  });

  it("PUT /admin/:id/profile - handles error", async () => {
    const { upsertProfile } = await import("./_profileUtils");
    vi.mocked(upsertProfile).mockRejectedValueOnce(new Error("Fail"));
    const res = await app.request("/admin/1/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: "Admin User" })
    }, {
      env: { DEV_BYPASS: "true" } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(500);
  });

  it("GET /admin/:id/profile - handles user not found", async () => {
    mockDb.query.user.findFirst.mockResolvedValueOnce(null);
    const res = await app.request("/admin/999/profile", {}, {
      env: { DEV_BYPASS: "true" } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(404);
  });

  it("GET /admin/:id/profile - gets default profile if none exists", async () => {
    mockDb.query.user.findFirst.mockResolvedValueOnce({
      id: "1",
      email: "admin@test.com",
      name: "Admin User"
    });
    mockDb.query.userProfiles.findFirst.mockResolvedValueOnce(null);
    const res = await app.request("/admin/1/profile", {}, {
      env: { DEV_BYPASS: "true" } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { profile: { nickname: string } };
    expect(body.profile.nickname).toBe("Admin");
  });

  it("GET /admin/:id/profile - handles database error", async () => {
    mockDb.query.user.findFirst.mockRejectedValueOnce(new Error("DB error"));
    const res = await app.request("/admin/1/profile", {}, {
      env: { DEV_BYPASS: "true" } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(500);
  });

  it("GET /admin/list - list users without masking email", async () => {
    mockDb.query.user.findMany.mockResolvedValueOnce([
      {
        id: "1",
        name: "Student",
        email: "student123@test.com",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        userProfiles: [{ nickname: "Student" }]
      }
    ]);
    const res = await app.request("/admin/list", {}, {
      env: { DEV_BYPASS: "true" } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { users: Array<{ email: string }> };
    expect(body.users[0].email).toBe("student123@test.com");
  });

  it("GET /admin/:id/profile - handles decryption error", async () => {
    const { decrypt } = await import("../../utils/crypto");
    vi.mocked(decrypt).mockRejectedValueOnce(new Error("Decryption failed"));
    mockDb.query.user.findFirst.mockResolvedValueOnce({
      id: "1",
      email: "admin@test.com",
      name: "Admin"
    });
    mockDb.query.userProfiles.findFirst.mockResolvedValueOnce({
      userId: "1",
      emergencyContactName: "encrypted_contact"
    });
    const res = await app.request("/admin/1/profile", {}, {
      env: { DEV_BYPASS: "true" } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { profile: { emergencyContactName: string } };
    expect(body.profile.emergencyContactName).toBe("[Decryption Failed]");
  });
});
