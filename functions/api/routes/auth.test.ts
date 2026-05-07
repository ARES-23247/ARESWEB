import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import authRouter from "./auth";
import { AppEnv } from "../middleware";
import * as authUtils from "../../utils/auth";

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    getSessionUser: vi.fn(),
  };
});

vi.mock("../../utils/auth", () => ({
  getAuth: vi.fn(),
}));

describe("Auth Router", () => {
  let app: Hono<AppEnv>;

  beforeEach(() => {
    app = new Hono<AppEnv>();
    app.route("/", authRouter);
    vi.clearAllMocks();
  });

  describe("GET /auth-check", () => {
    it("should return 200 and user data when authenticated", async () => {
      const { getSessionUser } = await import("../middleware");
      const mockUser = {
        id: "u1",
        email: "test@example.com",
        name: "Test User",
        image: null,
        role: "admin"
      };
      vi.mocked(getSessionUser).mockResolvedValue({
        ...mockUser,
        nickname: "Test",
        member_type: "mentor"
      });

      const res = await app.request("/auth-check", {}, {
        env: { ENVIRONMENT: "development", DB: {} as unknown as D1Database, DEV_BYPASS: "true" } as any,
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn()
      });

      expect(res.status).toBe(200);
      const body = await res.json() as { authenticated: boolean; user: typeof mockUser };
      expect(body.authenticated).toBe(true);
      expect(body.user).toEqual(mockUser);
    });

    it("should return 401 when not authenticated", async () => {
      const { getSessionUser } = await import("../middleware");
      vi.mocked(getSessionUser).mockResolvedValue(null);

      const res = await app.request("/auth-check", {}, {
        env: { ENVIRONMENT: "development", DB: {} as unknown as D1Database, DEV_BYPASS: "true" } as any,
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn()
      });

      expect(res.status).toBe(401);
      const body = await res.json() as { authenticated: boolean };
      expect(body.authenticated).toBe(false);
    });
  });

  describe("/* handler", () => {
    it("should proxy requests to better-auth handler", async () => {
      const { getAuth } = await import("../../utils/auth");
      const mockHandler = vi.fn().mockResolvedValue(new Response("auth response", { status: 200 as const }));
      vi.mocked(getAuth).mockReturnValue({
        handler: mockHandler,
      } as any);

      const res = await app.request("/signin", {
        method: "POST",
        headers: { "BETTER_AUTH_SECRET": "test" }
      }, {
        env: { DB: {} as unknown as D1Database } as any,
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn()
      });

      expect(res.status).toBe(200);
      expect(await res.text()).toBe("auth response");
      expect(mockHandler).toHaveBeenCalled();
    });

    it("should return 500 when better-auth handler throws", async () => {
      const { getAuth } = await import("../../utils/auth");
      const error = new Error("Auth failed");
      vi.mocked(getAuth).mockReturnValue({
        handler: vi.fn().mockRejectedValue(error),
      } as any);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const res = await app.request("/error", {
        headers: {
          "Host": "localhost:8080",
          "ENVIRONMENT": "development"
        }
      }, {
        env: { DB: {} as unknown as D1Database, DEV_BYPASS: "true" } as any,
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn()
      });

      expect(res.status).toBe(500);
      const body = await res.json() as { message: string; stack?: string };
      expect(body.message).toBe("Auth failed");
      expect(body.stack).toBeDefined();

      consoleSpy.mockRestore();
    });

    it("should return 500 without stack in production", async () => {
      const { getAuth } = await import("../../utils/auth");
      const error = new Error("Auth failed");
      vi.mocked(getAuth).mockReturnValue({
        handler: vi.fn().mockRejectedValue(error),
      } as any);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const res = await app.request("/error", {
        headers: { "ENVIRONMENT": "production" }
      }, {
        env: { DB: {} as unknown as D1Database } as any,
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn()
      });

      expect(res.status).toBe(500);
      const body = await res.json() as { message: string; stack?: string };
      expect(body.stack).toBeUndefined();

      consoleSpy.mockRestore();
    });

    it("should return 500 with default message when err.message is empty", async () => {
      const { getAuth } = await import("../../utils/auth");
      const error = new Error("");
      vi.mocked(getAuth).mockReturnValue({
        handler: vi.fn().mockRejectedValue(error),
      } as any);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const res = await app.request("/error", {
        headers: {
          "ENVIRONMENT": "development"
        }
      }, {
        env: { DB: {} as unknown as D1Database, DEV_BYPASS: "true" } as any,
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn()
      });

      expect(res.status).toBe(500);
      const body = await res.json() as { message: string };
      expect(body.message).toBe("Internal Server Error during Authentication");

      consoleSpy.mockRestore();
    });
  });
});
