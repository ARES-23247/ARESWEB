import { describe, it, expect, vi, beforeEach } from "vitest";
import { ensureTeamMember, AuthenticatedRequest } from "../../middleware/auth";
import uploadRouter from "../upload";
import { Response, NextFunction } from "express";
import { adminAuth, adminDb, adminStorage } from "../../lib/firebase-admin";

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
    adminStorage: {
      bucket: vi.fn().mockReturnValue({
        file: vi.fn().mockReturnValue({
          save: vi.fn(),
        }),
      }),
    },
  };
});



describe("ensureTeamMember Middleware", () => {
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

  it("should return 401 if authorization header is missing", async () => {
    await ensureTeamMember(req as AuthenticatedRequest, res as Response, next);
    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({ error: "Unauthorized: Missing or invalid token format" });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 if authorization header does not start with Bearer", async () => {
    req.headers!.authorization = "Basic 12345";
    await ensureTeamMember(req as AuthenticatedRequest, res as Response, next);
    expect(statusMock).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 if token verification throws an error", async () => {
    req.headers!.authorization = "Bearer invalid-token";
    vi.mocked(adminAuth.verifyIdToken).mockRejectedValue(new Error("Firebase verification failed"));

    await ensureTeamMember(req as AuthenticatedRequest, res as Response, next);
    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({ error: "Unauthorized: Invalid token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 403 if user is not in authorized_users Firestore collection", async () => {
    req.headers!.authorization = "Bearer valid-token";
    vi.mocked(adminAuth.verifyIdToken).mockResolvedValue({ uid: "user123", email: "student@team.org" } as any);
    
    const mockGet = adminDb.collection("").doc("").get;
    vi.mocked(mockGet).mockResolvedValue({ exists: false } as any);

    await ensureTeamMember(req as AuthenticatedRequest, res as Response, next);
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith({ error: "Forbidden: User not authorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("should attach user and call next() if user is authorized", async () => {
    req.headers!.authorization = "Bearer valid-token";
    vi.mocked(adminAuth.verifyIdToken).mockResolvedValue({ uid: "user123", email: "student@team.org" } as any);
    
    const mockGet = adminDb.collection("").doc("").get;
    vi.mocked(mockGet).mockResolvedValue({
      exists: true,
      data: () => ({ role: "member" })
    } as any);

    await ensureTeamMember(req as AuthenticatedRequest, res as Response, next);
    expect(req.user).toBeDefined();
    expect(req.user!.uid).toBe("user123");
    expect(next).toHaveBeenCalled();
  });
});

describe("POST /api/upload Route Handler", () => {
  let req: any;
  let res: any;
  let next: any;
  let statusMock: any;
  let jsonMock: any;
  let handler: any;

  beforeEach(() => {
    vi.clearAllMocks();

    const mockGet = adminDb.collection("").doc("").get;
    vi.mocked(mockGet).mockResolvedValue({ exists: false } as any);

    const mockSet = adminDb.collection("").doc("").set;
    vi.mocked(mockSet).mockResolvedValue({} as any);

    const mockSave = adminStorage.bucket().file("").save;
    vi.mocked(mockSave).mockResolvedValue({} as any);

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    req = {
      headers: {
        "content-type": "text/csv",
        "x-opmode": "TeleOpField",
      },
      body: Buffer.from("timestamp_ms,battery_voltage,ekf_drift_x,ekf_drift_y,loop_time_ms\n100,12.5,0.1,0.2,8\n200,12.4,0.1,0.2,9"),
    };
    res = {
      status: statusMock,
    };
    next = vi.fn();

    // Find the final POST handler in uploadRouter stack
    const postRoute = uploadRouter.stack.find(
      (layer) => layer.route && layer.route.path === "/"
    )?.route;
    
    // The stack contains: [uploadLimiter, ensureTeamMember, async (req, res) => ...]
    handler = postRoute?.stack?.[postRoute.stack.length - 1]?.handle;
  });

  it("should reject empty CSV payload with 400", async () => {
    req.body = Buffer.from("");
    await handler(req, res, next);
    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(400);
    expect(err.message).toBe("Empty CSV data uploaded.");
  });

  it("should reject invalid CSV format (no data rows) with 400", async () => {
    req.body = Buffer.from("header_only\n");
    await handler(req, res, next);
    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(400);
    expect(err.message).toBe("Invalid CSV format: requires header and data.");
  });

  it("should process and upload CSV successfully", async () => {
    const mockGet = adminDb.collection("").doc("").get;
    vi.mocked(mockGet).mockResolvedValue({ exists: false } as any); // No existing run

    await handler(req, res);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalled();
    const responseData = jsonMock.mock.calls[0][0];
    expect(responseData.success).toBe(true);
    expect(responseData.runId).toBeDefined();
    expect(responseData.summary.opModeName).toBe("TeleOpField");
    expect(responseData.summary.durationSeconds).toBe(0.1);
    expect(responseData.summary.minBatteryVoltage).toBe(12.4);

    const mockSet = adminDb.collection("").doc("").set;
    expect(mockSet).toHaveBeenCalled();
    const mockSave = adminStorage.bucket().file("").save;
    expect(mockSave).toHaveBeenCalled();
  });

  it("should return early with existing run data if CSV already uploaded (deduplication)", async () => {
    const cachedSummary = {
      runId: "run_cached",
      opModeName: "TeleOpField",
      durationSeconds: 0.1,
      minBatteryVoltage: 12.4,
    };
    const mockGet = adminDb.collection("").doc("").get;
    vi.mocked(mockGet).mockResolvedValue({
      exists: true,
      data: () => cachedSummary,
    } as any);

    await handler(req, res);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      success: true,
      runId: expect.any(String),
      summary: cachedSummary,
      message: "Telemetry log already uploaded and analyzed.",
    });

    const mockSet = adminDb.collection("").doc("").set;
    expect(mockSet).not.toHaveBeenCalled();
    const mockSave = adminStorage.bucket().file("").save;
    expect(mockSave).not.toHaveBeenCalled();
  });
});
