/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Context } from "hono";
import { mockExecutionContext, createMockDrizzle } from "../../../src/test/utils";
import type { TestEnv, MockDrizzle } from "../../../src/test/types";

// Mock cache middleware before importing router
vi.mock("../middleware/cache", () => ({
  edgeCacheMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAuth: (c: Context<TestEnv>, next: () => Promise<void>) => next(),
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

import profilesRouter from "./profiles";

describe("Hono Backend - /profiles Router", () => {
  let mockDb: MockDrizzle;
  let testApp: Hono<TestEnv>;
  let env: TestEnv["Bindings"];

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDrizzle();

    env = {
      DB: {} as unknown as D1Database,
      DEV_BYPASS: "true",
      ENCRYPTION_SECRET: "test-secret",
    };

    testApp = new Hono<TestEnv>();
    testApp.use("*", async (c: Context<TestEnv>, next: () => Promise<void>) => {
      c.set("db", mockDb as any);
      c.set("sessionUser", { id: "local-dev", email: "admin@test.com", role: "admin", name: "Local Dev", member_type: "mentor" });
      await next();
    });
    testApp.route("/", profilesRouter);
  });

  describe("GET /me", () => {
    it("should return profile for authenticated user", async () => {
      // Handler uses db.select({...}).from(table).innerJoin().where().get()
      mockDb.get.mockResolvedValueOnce({ userId: "local-dev", nickname: "Local Dev", memberType: "mentor" });
      const res = await testApp.request("/me", {}, env, mockExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as { nickname: string; auth: { id: string } };
      expect(body.nickname).toBe("Local Dev");
      expect(body.auth.id).toBe("local-dev");
    });
  });

  describe("PUT /me", () => {
    it("should update profile", async () => {
      const res = await testApp.request("/me", {
        method: "PUT",
        body: JSON.stringify({ nickname: "New Nick" }),
        headers: { "Content-Type": "application/json" },
      }, env, mockExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean };
      expect(body.success).toBe(true);
    });
  });

  describe("PUT /avatar", () => {
    it("should return error when auth is unavailable", async () => {
      const res = await testApp.request("/avatar", {
        method: "PUT",
        body: JSON.stringify({ image: "https://example.com/avatar.png" }),
        headers: { "Content-Type": "application/json" },
      }, env, mockExecutionContext);

      // Avatar update requires Better Auth, which won't be properly mocked in tests
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Avatar update failed" });
    });
  });

  describe("GET /team-roster", () => {
    it("should return team roster", async () => {
      // Handler uses db.select({...}).from(table).innerJoin().where().all()
      const mockRoster = [
        { userId: "1", nickname: "Member 1", memberType: "student", showOnAbout: 1 },
        { userId: "2", nickname: "Member 2", memberType: "mentor", showOnAbout: 1, contactEmail: "decrypted@test.com" },
      ];
      mockDb.all.mockResolvedValueOnce(mockRoster);

      const res = await testApp.request("/team-roster", {}, env, mockExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as { members: Array<{ nickname: string }> };
      expect(body.members).toHaveLength(2);
      expect(body.members[0].nickname).toBe("Member 1");
    });
  });

  describe("GET /:userId", () => {
    it("should return public profile by userId", async () => {
      const mockProfile = {
        userId: "user-123",
        nickname: "Public User",
        showOnAbout: 1,
        memberType: "student"
      };
      // First .get() for profile lookup
      mockDb.get.mockResolvedValueOnce(mockProfile);
      // Second .get() for sensitive data (admin/self check)
      mockDb.get.mockResolvedValueOnce(null);
      // .all() for badges
      mockDb.all.mockResolvedValueOnce([]);

      const res = await testApp.request("/user-123", {}, env, mockExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as { profile: { nickname: string } };
      expect(body.profile.nickname).toBe("Public User");
    });

    it("should return 404 for non-existent profile", async () => {
      mockDb.get.mockResolvedValueOnce(null);
      const res = await testApp.request("/ghost", {}, env, mockExecutionContext);
      expect(res.status).toBe(404);
    });

    it("should return 403 for private profile", async () => {
      const mockProfile = {
        userId: "user-456",
        nickname: "Private User",
        showOnAbout: 0,
        memberType: "student"
      };
      mockDb.get.mockResolvedValueOnce(mockProfile);

      const res = await testApp.request("/user-456", {}, env, mockExecutionContext);
      expect(res.status).toBe(403);
    });
  });
});
