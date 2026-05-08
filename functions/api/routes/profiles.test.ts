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
      if (prop === 'then') {
        return (resolve, reject) => Promise.resolve(fns.all()).then(resolve).catch(reject);
      }
      if (prop === 'catch') {
        return (reject) => Promise.resolve(fns.all()).catch(reject);
      }
      if (prop === 'finally') {
        return (cb) => Promise.resolve(fns.all()).finally(cb);
      }
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
      if (typeof prop === 'symbol') return chainable;
      target[prop] = vi.fn().mockReturnValue(chainable);
      return target[prop];
    }
  });
  return chainable;
};

const mockDb = createMockDb();

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
    getDb: () => mockDb
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
      
      (mockDb.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        nickname: "Local Dev",
        userId: "local-dev"
      });
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
      
      (mockDb.all as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { nickname: "Member 1", userId: "1", role: "student" },
        { nickname: "Member 2", userId: "2", role: "student" }
      ]);
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
      
      (mockDb.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        nickname: "Public User",
        userId: "user-123",
        showOnAbout: 1
      });
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
      
      (mockDb.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
      const res = await app.request("/ghost", {}, {
        env: { DB: {} as unknown as D1Database, DEV_BYPASS: "true", ENCRYPTION_SECRET: "test-secret" } as any,
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn()
      });
      expect(res.status).toBe(404);
    });

    it("should return 403 for private profile", async () => {
      
      (mockDb.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        nickname: "Private User",
        userId: "user-456",
        showOnAbout: 0
      });
      const res = await app.request("/user-456", {}, {
        env: { DB: {} as unknown as D1Database, DEV_BYPASS: "true", ENCRYPTION_SECRET: "test-secret" } as any,
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn()
      });
      expect(res.status).toBe(403);
    });
  });
});
