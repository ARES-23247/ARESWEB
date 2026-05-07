import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Context } from "hono";
import profilesRouter from "./profiles";
import { AppEnv } from "../middleware";

// Mock cache middleware before importing router
vi.mock("../middleware/cache", () => ({
  edgeCacheMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAuth: (c: Context<AppEnv>, next: () => Promise<void>) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "local-dev", email: "admin@test.com", role: "admin", name: "Local Dev", member_type: "mentor" }),
    sanitizeProfileForPublic: vi.fn((p) => p),
    persistentRateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
    rateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
  };
});

vi.mock("../../utils/crypto", () => ({
  decrypt: vi.fn((val) => Promise.resolve(val)),
  encrypt: vi.fn((val) => Promise.resolve(val)),
}));

// Mock _profileUtils at file level (vitest hoists vi.mock calls)
vi.mock("./_profileUtils", () => ({
  upsertProfile: vi.fn().mockResolvedValue(undefined),
}));

describe("Hono Backend - /profiles Router", () => {
  let app: Hono<AppEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono<AppEnv>();
    app.route("/", profilesRouter);
  });

  describe("GET /me", () => {
    it("should return profile for authenticated user", async () => {
      const res = await app.request("/me", {}, {
        env: { DB: {} as unknown as D1Database, DEV_BYPASS: "true", ENCRYPTION_SECRET: "test-secret" } as any,
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn()
      });

      expect(res.status).toBe(200);
      const body = await res.json() as { nickname: string; auth: { id: string } };
      expect(body.nickname).toBe("Local Dev");
      expect(body.auth.id).toBe("local-dev");
    });
  });

  describe("PUT /me", () => {
    it("should update profile", async () => {
      const res = await app.request("/me", {
        method: "PUT",
        body: JSON.stringify({ nickname: "New Nick" }),
        headers: { "Content-Type": "application/json" },
      }, {
        env: { DB: {} as unknown as D1Database, DEV_BYPASS: "true", ENCRYPTION_SECRET: "test-secret" } as any,
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn()
      });

      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean };
      expect(body.success).toBe(true);
    });
  });

  describe("PUT /avatar", () => {
    it("should return error when auth is unavailable", async () => {
      const res = await app.request("/avatar", {
        method: "PUT",
        body: JSON.stringify({ image: "https://example.com/avatar.png" }),
        headers: { "Content-Type": "application/json" },
      }, {
        env: { DB: {} as unknown as D1Database, DEV_BYPASS: "true", ENCRYPTION_SECRET: "test-secret" } as any,
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn()
      });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Avatar update failed" });
    });
  });

  describe("GET /team-roster", () => {
    it("should return team roster", async () => {
      const res = await app.request("/team-roster", {}, {
        env: { DB: {} as unknown as D1Database, DEV_BYPASS: "true", ENCRYPTION_SECRET: "test-secret" } as any,
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn()
      });

      expect(res.status).toBe(200);
      const body = await res.json() as { members: Array<{ nickname: string }> };
      expect(body.members).toHaveLength(2);
      expect(body.members[0].nickname).toBe("Member 1");
    });
  });

  describe("GET /:userId", () => {
    it("should return public profile by userId", async () => {
      const res = await app.request("/user-123", {}, {
        env: { DB: {} as unknown as D1Database, DEV_BYPASS: "true", ENCRYPTION_SECRET: "test-secret" } as any,
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn()
      });

      expect(res.status).toBe(200);
      const body = await res.json() as { profile: { nickname: string } };
      expect(body.profile.nickname).toBe("Public User");
    });

    it("should return 404 for non-existent profile", async () => {
      const res = await app.request("/ghost", {}, {
        env: { DB: {} as unknown as D1Database, DEV_BYPASS: "true", ENCRYPTION_SECRET: "test-secret" } as any,
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn()
      });
      expect(res.status).toBe(404);
    });

    it("should return 403 for private profile", async () => {
      const res = await app.request("/user-456", {}, {
        env: { DB: {} as unknown as D1Database, DEV_BYPASS: "true", ENCRYPTION_SECRET: "test-secret" } as any,
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn()
      });
      expect(res.status).toBe(403);
    });
  });
});
