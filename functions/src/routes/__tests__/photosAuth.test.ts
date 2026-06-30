import { describe, it, expect, vi, beforeEach } from "vitest";
import photosAuthRouter from "../photosAuth";
import { adminDb, adminAuth } from "../../lib/firebase-admin";

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDelete = vi.fn();

vi.mock("../../lib/firebase-admin", () => {
  return {
    adminDb: {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: mockGet,
          set: mockSet,
          delete: mockDelete,
        }))
      }))
    },
    adminAuth: {
      verifyIdToken: vi.fn().mockResolvedValue({ uid: "test-admin-uid" })
    }
  };
});

vi.mock("../../lib/googleAuth", () => ({
  getGooglePhotosAccessToken: vi.fn().mockResolvedValue("mock-access-token"),
}));

vi.mock("../../middleware/auth", () => ({
  ensureAdmin: (req: any, res: any, next: any) => next(),
}));

vi.mock("../../lib/crypto", () => ({
  encrypt: vi.fn().mockResolvedValue("encrypted-string"),
  getEncryptionSecret: vi.fn().mockReturnValue("encryption-secret-string-32-chars"),
}));

describe("PhotosAuth Router Backend Endpoints", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = "mock-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "mock-client-secret";

    req = {
      params: {},
      body: {},
      query: {},
      protocol: "https",
      get: vi.fn().mockReturnValue("localhost"),
      headers: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      redirect: vi.fn(),
      setHeader: vi.fn(),
      send: vi.fn(),
    };
    next = vi.fn();
  });

  const getHandler = (path: string, method: string) => {
    const routeLayer = photosAuthRouter.stack.find(
      (layer) => layer.route && layer.route.path === path && (layer.route as any).methods[method]
    );
    expect(routeLayer).toBeDefined();
    const stack = routeLayer!.route!.stack;
    return stack[stack.length - 1].handle;
  };

  describe("GET /auth/init redirect fallback", () => {
    it("should redirect to dashboard with error", async () => {
      const handler = getHandler("/auth/init", "get");
      await handler(req, res, next);
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining("Stale%20browser%20cache%20detected")
      );
    });
  });

  describe("POST /auth/init redirect URL generation", () => {
    it("should return a Google OAuth redirect URL", async () => {
      const handler = getHandler("/auth/init", "post");
      await handler(req, res, next);
      expect(mockSet).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          redirectUrl: expect.stringContaining("accounts.google.com")
        })
      );
    });
  });

  describe("GET /auth Callback", () => {
    it("should handle error params", async () => {
      req.query = { error: "access_denied" };
      const handler = getHandler("/auth", "get");
      await handler(req, res, next);
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining("error_msg=access_denied")
      );
    });

    it("should require state parameter", async () => {
      req.query = { code: "12345" };
      const handler = getHandler("/auth", "get");
      await handler(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(400);
      expect(err.message).toContain("State parameter missing");
    });
  });

  describe("POST /picker session creation", () => {
    it("should proxy session creation request to Google Picker API", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ id: "session-123", pickerUrl: "https://photos.google.com/picker" })
      } as any);

      const handler = getHandler("/picker", "post");
      await handler(req, res, next);

      expect(mockFetch).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "session-123"
        })
      );
    });
  });
});
