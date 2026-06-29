import { describe, it, expect, vi, beforeEach } from "vitest";
import inquiriesRouter from "../inquiries";
import { adminDb, adminAuth } from "../../lib/firebase-admin";

// Set encryption secret for tests (avoiding blacklisted keys)
process.env.ENCRYPTION_SECRET = "a_very_strong_secret_that_is_at_least_32_characters_long_for_testing_purposes";

// Mock crypto module
vi.mock("../../lib/crypto", () => ({
  encrypt: vi.fn().mockImplementation(async (val) => `encrypted:${val}`),
  decrypt: vi.fn().mockImplementation(async (val) => val.replace("encrypted:", "")),
  getEncryptionSecret: vi.fn().mockReturnValue("a_very_strong_secret_that_is_at_least_32_characters_long_for_testing_purposes"),
}));

// Mock Firebase Admin
vi.mock("../../lib/firebase-admin", () => {
  const mockGet = vi.fn();
  const mockSet = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  
  const mockDoc = vi.fn().mockReturnValue({
    get: mockGet,
    set: mockSet,
    update: mockUpdate,
    delete: mockDelete,
  });

  const mockCollection = vi.fn().mockReturnValue({
    doc: mockDoc,
    get: mockGet,
    orderBy: vi.fn().mockReturnThis(),
  });

  const mockBatchSet = vi.fn();
  const mockBatchUpdate = vi.fn();
  const mockBatchCommit = vi.fn().mockResolvedValue(true);
  const mockBatch = vi.fn().mockReturnValue({
    set: mockBatchSet,
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  });

  const mockGetUserByEmail = vi.fn();

  return {
    adminDb: {
      collection: mockCollection,
      batch: mockBatch,
    },
    adminAuth: {
      getUserByEmail: mockGetUserByEmail,
    },
  };
});

describe("Inquiries Router Backend Endpoints", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: {},
      body: {},
      headers: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  const getHandler = (path: string, method: string) => {
    const routeLayer = inquiriesRouter.stack.find(
      (layer) => layer.route && layer.route.path === path && (layer.route as any).methods[method]
    );
    expect(routeLayer).toBeDefined();
    const stack = routeLayer!.route!.stack;
    return stack[stack.length - 1].handle;
  };

  describe("POST /api/inquiries/:id/approve-account", () => {
    it("should reject account creation for sponsor inquiry types", async () => {
      const handler = getHandler("/:id/approve-account", "post");
      req.params.id = "inq_123";

      // Mock database response for inquiries doc
      const mockInquirySnap = {
        exists: true,
        data: () => ({
          name: "encrypted:John Sponsor",
          email: "encrypted:john@sponsor.com",
          type: "sponsor",
          status: "pending",
        }),
      };
      const mockDoc = adminDb.collection("inquiries").doc as any;
      mockDoc().get.mockResolvedValue(mockInquirySnap);

      await handler(req, res, next);

      // Should call next(err) with status 400
      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0] ? next.mock.calls[0][0] : undefined;
      if (!err || err.status !== 400) {
        console.log("ACTUAL ERROR THROWN:", err);
      }
      expect(err.status).toBe(400);
      expect(err.message).toContain("only supported for student and mentor inquiries");
    });

    it("should authorize a new student account successfully by email if not found in Firebase Auth", async () => {
      const handler = getHandler("/:id/approve-account", "post");
      req.params.id = "inq_456";

      // Mock database response for student inquiries doc
      const mockInquirySnap = {
        exists: true,
        data: () => ({
          name: "encrypted:Alice Student",
          email: "encrypted:alice@student.com",
          type: "student",
          status: "pending",
        }),
      };
      const mockDoc = adminDb.collection("inquiries").doc as any;
      mockDoc().get.mockResolvedValue(mockInquirySnap);

      // Mock Firebase Auth getUserByEmail to throw user-not-found
      const mockAuthUserLookup = adminAuth.getUserByEmail as any;
      mockAuthUserLookup.mockRejectedValue({ code: "auth/user-not-found" });

      await handler(req, res, next);

      // Verify batch commits
      const mockBatch = adminDb.batch as any;
      const batchInstance = mockBatch();
      expect(batchInstance.set).toHaveBeenCalledTimes(2); // authorized_users + user_profiles
      expect(batchInstance.update).toHaveBeenCalledTimes(1); // inquiries status update
      expect(batchInstance.commit).toHaveBeenCalled();

      // Verify correct doc ID is a generated UUID instead of the raw email
      const mockCollection = adminDb.collection as any;
      const targetId = mockCollection().doc.mock.calls[2][0];
      expect(targetId).not.toBe("alice@student.com");
      expect(targetId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(mockCollection().doc.mock.calls[3][0]).toBe(targetId);

      // Check authorized_users content
      const firstSetCall = batchInstance.set.mock.calls[0];
      expect(firstSetCall[1]).toEqual({
        email: "alice@student.com",
        role: "student",
        name: "Alice Student",
      });

      // Check response
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Pre-authorized student account for Alice Student.",
      });
    });

    it("should authorize account using uid if user already exists in Firebase Auth", async () => {
      const handler = getHandler("/:id/approve-account", "post");
      req.params.id = "inq_789";

      // Mock database response
      const mockInquirySnap = {
        exists: true,
        data: () => ({
          name: "encrypted:Bob Mentor",
          email: "encrypted:bob@mentor.com",
          type: "mentor",
          status: "pending",
        }),
      };
      const mockDoc = adminDb.collection("inquiries").doc as any;
      mockDoc().get.mockResolvedValue(mockInquirySnap);

      // Mock Firebase Auth getUserByEmail to succeed
      const mockAuthUserLookup = adminAuth.getUserByEmail as any;
      mockAuthUserLookup.mockResolvedValue({
        uid: "firebase-uid-for-bob",
        email: "bob@mentor.com",
      });

      await handler(req, res, next);

      // Verify correct doc ID is used (Firebase UID instead of email)
      const mockCollection = adminDb.collection as any;
      expect(mockCollection).toHaveBeenCalledWith("authorized_users");
      expect(mockCollection().doc).toHaveBeenCalledWith("firebase-uid-for-bob");

      // Verify response
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Pre-authorized mentor account for Bob Mentor.",
      });
    });
  });
});
