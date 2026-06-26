import { describe, it, expect, vi, beforeEach } from "vitest";
import { ensureAuth, ensureAdmin, ensureTeamMember, AuthenticatedRequest } from "../auth";
import { globalErrorHandler, ApiError } from "../errorHandler";
import { Response, NextFunction } from "express";
import { adminAuth, adminDb } from "../../lib/firebase-admin";

// Mock Firebase Admin
vi.mock("../../lib/firebase-admin", () => {
  const mockGet = vi.fn();
  const mockSet = vi.fn();
  return {
    adminAuth: {
      verifyIdToken: vi.fn(),
    },
    adminDb: {
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: mockGet,
          set: mockSet,
        }),
      }),
    },
  };
});

describe("Auth Middleware", () => {
  let req: Partial<AuthenticatedRequest>;
  let res: Partial<Response>;
  let next: NextFunction;
  let statusMock: any;
  let jsonMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminAuth.verifyIdToken).mockReset();
    const mockGet = adminDb.collection("").doc("").get;
    vi.mocked(mockGet).mockReset();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    req = {
      headers: {},
    };
    res = {
      status: statusMock,
    };
    next = vi.fn() as unknown as NextFunction;
  });

  describe("ensureAuth", () => {
    it("should return 401 if authorization header is missing", async () => {
      await ensureAuth(req as AuthenticatedRequest, res as Response, next);
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Unauthorized: Missing or invalid token format" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 if authorization header does not start with Bearer", async () => {
      req.headers!.authorization = "Basic 12345";
      await ensureAuth(req as AuthenticatedRequest, res as Response, next);
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Unauthorized: Missing or invalid token format" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 if verifyIdToken throws", async () => {
      req.headers!.authorization = "Bearer my-token";
      vi.mocked(adminAuth.verifyIdToken).mockRejectedValue(new Error("verify failed"));
      await ensureAuth(req as AuthenticatedRequest, res as Response, next);
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Unauthorized: Invalid token" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should attach user and call next() on success", async () => {
      req.headers!.authorization = "Bearer my-token";
      const mockDecoded = { uid: "123", email: "user@test.com" };
      vi.mocked(adminAuth.verifyIdToken).mockResolvedValue(mockDecoded as any);
      await ensureAuth(req as AuthenticatedRequest, res as Response, next);
      expect(req.user).toEqual(mockDecoded);
      expect(next).toHaveBeenCalled();
    });
  });

  describe("ensureAdmin", () => {
    it("should return 401 if authorization header is missing", async () => {
      await ensureAdmin(req as AuthenticatedRequest, res as Response, next);
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Unauthorized: Missing or invalid token format" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 if verifyIdToken throws", async () => {
      req.headers!.authorization = "Bearer admin-token";
      vi.mocked(adminAuth.verifyIdToken).mockRejectedValue(new Error("verify failed"));
      await ensureAdmin(req as AuthenticatedRequest, res as Response, next);
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Unauthorized: Invalid token" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 403 if user doc does not exist", async () => {
      req.headers!.authorization = "Bearer admin-token";
      vi.mocked(adminAuth.verifyIdToken).mockResolvedValue({ uid: "admin123" } as any);
      const mockGet = adminDb.collection("").doc("").get;
      vi.mocked(mockGet).mockResolvedValue({ exists: false } as any);

      await ensureAdmin(req as AuthenticatedRequest, res as Response, next);
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Forbidden: User not authorized" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 403 if user exists but has insufficient privileges", async () => {
      req.headers!.authorization = "Bearer admin-token";
      vi.mocked(adminAuth.verifyIdToken).mockResolvedValue({ uid: "admin123" } as any);
      const mockGet = adminDb.collection("").doc("").get;
      vi.mocked(mockGet).mockResolvedValue({
        exists: true,
        data: () => ({ role: "student" }),
      } as any);

      await ensureAdmin(req as AuthenticatedRequest, res as Response, next);
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: "Forbidden: Insufficient privileges" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should attach user and call next() on admin role success", async () => {
      req.headers!.authorization = "Bearer admin-token";
      const mockDecoded = { uid: "admin123" };
      vi.mocked(adminAuth.verifyIdToken).mockResolvedValue(mockDecoded as any);
      const mockGet = adminDb.collection("").doc("").get;
      vi.mocked(mockGet).mockResolvedValue({
        exists: true,
        data: () => ({ role: "admin" }),
      } as any);

      await ensureAdmin(req as AuthenticatedRequest, res as Response, next);
      expect(req.user).toEqual(mockDecoded);
      expect(next).toHaveBeenCalled();
    });

    it("should attach user and call next() on coach role success", async () => {
      req.headers!.authorization = "Bearer admin-token";
      const mockDecoded = { uid: "coach123" };
      vi.mocked(adminAuth.verifyIdToken).mockResolvedValue(mockDecoded as any);
      const mockGet = adminDb.collection("").doc("").get;
      vi.mocked(mockGet).mockResolvedValue({
        exists: true,
        data: () => ({ role: "coach" }),
      } as any);

      await ensureAdmin(req as AuthenticatedRequest, res as Response, next);
      expect(req.user).toEqual(mockDecoded);
      expect(next).toHaveBeenCalled();
    });

    it("should attach user and call next() on mentor role success", async () => {
      req.headers!.authorization = "Bearer admin-token";
      const mockDecoded = { uid: "mentor123" };
      vi.mocked(adminAuth.verifyIdToken).mockResolvedValue(mockDecoded as any);
      const mockGet = adminDb.collection("").doc("").get;
      vi.mocked(mockGet).mockResolvedValue({
        exists: true,
        data: () => ({ role: "mentor" }),
      } as any);

      await ensureAdmin(req as AuthenticatedRequest, res as Response, next);
      expect(req.user).toEqual(mockDecoded);
      expect(next).toHaveBeenCalled();
    });
  });

  describe("ensureTeamMember extra coverage", () => {
    it("should return 401 if authorization header is missing", async () => {
      await ensureTeamMember(req as AuthenticatedRequest, res as Response, next);
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});

describe("errorHandler", () => {
  let req: Partial<AuthenticatedRequest>;
  let res: Partial<Response>;
  let next: NextFunction;
  let statusMock: any;
  let jsonMock: any;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    req = {};
    res = {
      status: statusMock,
    };
    next = vi.fn() as unknown as NextFunction;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("ApiError holds status and message", () => {
    const err = new ApiError(400, "Bad Request");
    expect(err.status).toBe(400);
    expect(err.message).toBe("Bad Request");
    expect(err.name).toBe("ApiError");
  });

  it("globalErrorHandler format error with default status/message", () => {
    const err = new Error();
    globalErrorHandler(err, req as any, res as any, next);
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ error: "Internal server error." });
  });

  it("globalErrorHandler format error with custom status/message", () => {
    const err = new ApiError(404, "Not Found Custom");
    globalErrorHandler(err, req as any, res as any, next);
    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({ error: "Not Found Custom" });
  });
});
