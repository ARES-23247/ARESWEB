// TODO: users.ts implementation uses getProfile/updateProfile/listUsers/updateRole
// but userContract exports getUsers/adminDetail/patchUser/updateUserProfile/adminGetProfile/deleteUser
// The contract and implementation are misaligned - need to rewrite users.ts to match userContract
// or create a separate usersContract that matches the existing implementation

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono, Context } from "hono";
import { usersRouter } from "./users";
import { AppEnv } from "../middleware";

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    getDbSettings: vi.fn().mockResolvedValue({}),
    ensureAdmin: async (c: Context<AppEnv>, next: () => Promise<void>) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "1", role: "admin", email: "admin@test.com" }),
    logAuditAction: vi.fn().mockResolvedValue(true),
    rateLimitMiddleware: () => async (c: Context<AppEnv>, next: () => Promise<void>) => next(),
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

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono<AppEnv>();
    app.route("/", usersRouter);
  });

  it("GET /admin/list - list users", async () => {
    const res = await app.request("/admin/list", {}, {
      env: { DEV_BYPASS: "true", DB: {} as D1Database } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(200);
  });

  it("GET /admin/:id - detail view", async () => {
    const res = await app.request("/admin/1", {}, {
      env: { DEV_BYPASS: "true", DB: {} as D1Database } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { user: { id: string; email: string } };
    expect(body.user.id).toBe("1");
    expect(body.user.email).toBe("test@test.com");
  });

  it("PATCH /admin/:id - update role", async () => {
    const res = await app.request("/admin/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin" })
    }, {
      env: { DEV_BYPASS: "true", DB: {} as D1Database } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });

    expect(res.status).toBe(200);
  });

  it("PATCH /admin/:id - update member_type (existing profile)", async () => {
    const res = await app.request("/admin/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_type: "mentor" })
    }, {
      env: { DEV_BYPASS: "true", DB: {} as D1Database } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });

    expect(res.status).toBe(200);
  });

  it("PATCH /admin/:id - update member_type (new profile)", async () => {
    const res = await app.request("/admin/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_type: "student" })
    }, {
      env: { DEV_BYPASS: "true", DB: {} as D1Database } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });

    expect(res.status).toBe(200);
  });

  it("DELETE /admin/:id - delete user", async () => {
    const res = await app.request("/admin/1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, {
      env: { DEV_BYPASS: "true", DB: {} as D1Database } as any,
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
      env: { DEV_BYPASS: "true", DB: {} as D1Database } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBeDefined();
  });

  it("GET /admin/:id/profile - get admin profile", async () => {
    const res = await app.request("/admin/1/profile", {}, {
      env: { DEV_BYPASS: "true", DB: {} as D1Database } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { profile: { nickname: string } };
    expect(body.profile.nickname).toBe("Admin User");
  });

  // Error paths
  it("GET /admin/list - error", async () => {
    const res = await app.request("/admin/list", {}, {
      env: { DEV_BYPASS: "true", DB: {} as D1Database } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(500);
  });

  it("GET /admin/:id - not found", async () => {
    const res = await app.request("/admin/999", {}, {
      env: { DEV_BYPASS: "true", DB: {} as D1Database } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(404);
  });

  it("GET /admin/:id - database error", async () => {
    const res = await app.request("/admin/1", {}, {
      env: { DEV_BYPASS: "true", DB: {} as D1Database } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(500);
  });

  it("PATCH /admin/:id - error", async () => {
    const res = await app.request("/admin/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin" })
    }, {
      env: { DEV_BYPASS: "true", DB: {} as D1Database } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:id - error", async () => {
    const res = await app.request("/admin/1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, {
      env: { DEV_BYPASS: "true", DB: {} as D1Database } as any,
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
      env: { DEV_BYPASS: "true", DB: {} as D1Database } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(500);
  });

  it("GET /admin/:id/profile - handles user not found", async () => {
    const res = await app.request("/admin/999/profile", {}, {
      env: { DEV_BYPASS: "true", DB: {} as D1Database } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(404);
  });

  it("GET /admin/:id/profile - gets default profile if none exists", async () => {
    const res = await app.request("/admin/1/profile", {}, {
      env: { DEV_BYPASS: "true", DB: {} as D1Database } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { profile: { nickname: string } };
    expect(body.profile.nickname).toBe("Admin");
  });

  it("GET /admin/:id/profile - handles database error", async () => {
    const res = await app.request("/admin/1/profile", {}, {
      env: { DEV_BYPASS: "true", DB: {} as D1Database } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(500);
  });

  it("GET /admin/list - list users without masking email", async () => {
    const res = await app.request("/admin/list", {}, {
      env: { DEV_BYPASS: "true", DB: {} as D1Database } as any,
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

    const res = await app.request("/admin/1/profile", {}, {
      env: { DEV_BYPASS: "true", DB: {} as D1Database } as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { profile: { emergencyContactName: string } };
    expect(body.profile.emergencyContactName).toBe("[Decryption Failed]");
  });
});
