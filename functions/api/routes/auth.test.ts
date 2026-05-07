/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext, createMockDrizzle, createDrizzleProxy } from "../../../src/test/utils";
import type { TestEnv, MockDrizzle } from "../../../src/test/types";
import type { DrizzleProxy } from "../../../src/test/mocks";
import authRouter from "./auth";
import * as shared from "../middleware";
import * as authUtils from "../../utils/auth";

vi.mock("../middleware", async () => {
  const actual = await vi.importActual<typeof shared>("../middleware");
  return {
    ...actual,
    getSessionUser: vi.fn(),
  };
});

vi.mock("../../utils/auth", () => ({
  getAuth: vi.fn(),
}));

describe("Auth Router", () => {
  let app: Hono<TestEnv>;
  let mockDb: MockDrizzle;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = createMockDrizzle();

    app = new Hono<TestEnv>();
    app.use("*", async (c, next) => {
      c.set("db", createDrizzleProxy(mockDb) as DrizzleProxy);
      await next();
    });
    app.route("/", authRouter);
  });

  describe("GET /auth-check", () => {
    it("should return 200 and user data when authenticated", async () => {
      const mockUser = {
        id: "u1",
        email: "test@example.com",
        name: "Test User",
        image: null,
        role: "admin"
      };
      vi.mocked(shared.getSessionUser).mockResolvedValue({
        ...mockUser,
        nickname: "Test",
        member_type: "mentor"
      } as TestEnv["Variables"]["sessionUser"]);

      const res = await app.request("/auth-check", {
        headers: { "ENVIRONMENT": "development" }
      }, { DB: {} as unknown as D1Database, DEV_BYPASS: "true" }, mockExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as { authenticated: boolean; user: typeof mockUser };
      expect(body.authenticated).toBe(true);
      expect(body.user).toEqual(mockUser);
    });

    it("should return 401 when not authenticated", async () => {
      vi.mocked(shared.getSessionUser).mockResolvedValue(null);

      const res = await app.request("/auth-check", {
        headers: { "ENVIRONMENT": "development" }
      }, { DB: {} as unknown as D1Database, DEV_BYPASS: "true" }, mockExecutionContext);

      expect(res.status).toBe(401);
      const body = await res.json() as { authenticated: boolean };
      expect(body.authenticated).toBe(false);
    });
  });

  describe("/* handler", () => {
    it("should proxy requests to better-auth handler", async () => {
      const mockHandler = vi.fn().mockResolvedValue(new Response("auth response", { status: 200 as const }));
      vi.mocked(authUtils.getAuth).mockReturnValue({
        handler: mockHandler,
      } as any);

      const res = await app.request("/signin", {
        method: "POST",
        headers: { "BETTER_AUTH_SECRET": "test" }
      }, { DB: {} as unknown as D1Database }, mockExecutionContext);

      expect(res.status).toBe(200);
      expect(await res.text()).toBe("auth response");
      expect(mockHandler).toHaveBeenCalled();
    });

    it("should return 500 when better-auth handler throws", async () => {
      const error = new Error("Auth failed");
      vi.mocked(authUtils.getAuth).mockReturnValue({
        handler: vi.fn().mockRejectedValue(error),
      } as any);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const res = await app.request("/error", {
        headers: {
          "Host": "localhost:8080",
          "ENVIRONMENT": "development"
        }
      }, { DB: {} as unknown as D1Database, DEV_BYPASS: "true" }, mockExecutionContext);

      expect(res.status).toBe(500);
      const body = await res.json() as { message: string; stack?: string };
      expect(body.message).toBe("Auth failed");
      expect(body.stack).toBeDefined();

      consoleSpy.mockRestore();
    });

    it("should return 500 without stack in production", async () => {
        const error = new Error("Auth failed");
        vi.mocked(authUtils.getAuth).mockReturnValue({
          handler: vi.fn().mockRejectedValue(error),
        } as any);

        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const res = await app.request("/error", {
          headers: { "ENVIRONMENT": "production" }
        }, { DB: {} as unknown as D1Database }, mockExecutionContext);

        expect(res.status).toBe(500);
        const body = await res.json() as { message: string; stack?: string };
        expect(body.stack).toBeUndefined();

        consoleSpy.mockRestore();
      });

    it("should return 500 with default message when err.message is empty", async () => {
      const error = new Error("");
      vi.mocked(authUtils.getAuth).mockReturnValue({
        handler: vi.fn().mockRejectedValue(error),
      } as any);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const res = await app.request("/error", {
        headers: {
          "ENVIRONMENT": "development"
        }
      }, { DB: {} as unknown as D1Database, DEV_BYPASS: "true" }, mockExecutionContext);

      expect(res.status).toBe(500);
      const body = await res.json() as { message: string };
      expect(body.message).toBe("Internal Server Error during Authentication");

      consoleSpy.mockRestore();
    });
  });
});
