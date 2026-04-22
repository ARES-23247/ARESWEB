import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockExecutionContext } from "@/test/utils";
import authRouter from "./auth";
import * as shared from "./_shared";
import * as authUtils from "../../utils/auth";

vi.mock("./_shared", async () => {
  const actual = await vi.importActual<typeof shared>("./_shared");
  return {
    ...actual,
    getSessionUser: vi.fn(),
  };
});

vi.mock("../../utils/auth", () => ({
  getAuth: vi.fn(),
}));

describe("Auth Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /auth-check", () => {
    it("should return 200 and user data when authenticated", async () => {
      const mockUser = { id: "u1", email: "test@example.com", name: "Test User", role: "admin", member_type: "mentor" };
      vi.mocked(shared.getSessionUser).mockResolvedValue(mockUser as any);

      const req = new Request("http://localhost/auth-check");
      const res = await authRouter.request(req, {}, { DB: {} } as any);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.authenticated).toBe(true);
      expect(body.user).toEqual(mockUser);
    });

    it("should return 401 when not authenticated", async () => {
      vi.mocked(shared.getSessionUser).mockResolvedValue(null);

      const req = new Request("http://localhost/auth-check");
      const res = await authRouter.request(req, {}, { DB: {} } as any);

      expect(res.status).toBe(401);
      const body = await res.json() as any;
      expect(body.authenticated).toBe(false);
    });
  });

  describe("/* handler", () => {
    it("should proxy requests to better-auth handler", async () => {
      const mockHandler = vi.fn().mockResolvedValue(new Response("auth response", { status: 200 }));
      vi.mocked(authUtils.getAuth).mockReturnValue({
        handler: mockHandler,
      } as any);

      const req = new Request("http://localhost/signin", { method: "POST" });
      const res = await authRouter.request(req, {}, { DB: {}, BETTER_AUTH_SECRET: "test" } as any);

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
      const req = new Request("http://localhost/error");
      const res = await authRouter.request(req, {}, { DB: {}, ENVIRONMENT: "development" } as any);

      expect(res.status).toBe(500);
      const body = await res.json() as any;
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
        const req = new Request("http://localhost/error");
        const res = await authRouter.request(req, {}, { DB: {}, ENVIRONMENT: "production" } as any);
  
        expect(res.status).toBe(500);
        const body = await res.json() as any;
        expect(body.stack).toBeUndefined();
        
        consoleSpy.mockRestore();
      });

    it("should return 500 with default message when err.message is empty", async () => {
      const error = new Error("");
      vi.mocked(authUtils.getAuth).mockReturnValue({
        handler: vi.fn().mockRejectedValue(error),
      } as any);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const req = new Request("http://localhost/error");
      const res = await authRouter.request(req, {}, { DB: {}, ENVIRONMENT: "development" } as any);

      expect(res.status).toBe(500);
      const body = await res.json() as any;
      expect(body.message).toBe("Internal Server Error during Authentication");
      
      consoleSpy.mockRestore();
    });
  });
});
