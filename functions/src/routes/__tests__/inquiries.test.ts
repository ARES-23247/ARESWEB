import { describe, it, expect, vi, beforeEach } from "vitest";
import { adminDb, adminAuth } from "../../lib/firebase-admin";
import { decrypt } from "../../lib/crypto";

// Mock express-rate-limit
vi.mock("express-rate-limit", () => {
  return {
    default: vi.fn().mockImplementation(() => (req: any, res: any, next: any) => next()),
  };
});

import inquiriesRouter from "../inquiries";

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
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    startAfter: vi.fn().mockReturnThis(),
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
      ip: "127.0.0.1",
      app: {
        get: vi.fn().mockReturnValue(true)
      }
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
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

  describe("GET /api/inquiries/pending-exists", () => {
    it("returns only a bounded boolean existence result", async () => {
      const collection = adminDb.collection("inquiries") as any;
      collection.get.mockResolvedValue({ empty: false });

      await getHandler("/pending-exists", "get")(req, res, next);

      expect(collection.where).toHaveBeenNthCalledWith(1, "status", "==", "pending");
      expect(collection.where).toHaveBeenNthCalledWith(2, "isDeleted", "==", 0);
      expect(collection.limit).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith({ success: true, hasPending: true });
      expect(JSON.stringify(res.json.mock.calls[0][0])).not.toMatch(/name|email|metadata/);
    });

    it("returns false for an empty bounded query", async () => {
      const collection = adminDb.collection("inquiries") as any;
      collection.get.mockResolvedValue({ empty: true });

      await getHandler("/pending-exists", "get")(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, hasPending: false });
    });
  });

  describe("GET /api/inquiries", () => {
    it("returns a bounded decrypted DTO and opaque pagination cursor", async () => {
      req.query = { limit: "1" };
      const collection = adminDb.collection("inquiries") as any;
      collection.get.mockResolvedValue({
        docs: [
          {
            id: "inquiry-1",
            data: () => ({
              type: "student",
              name: "encrypted:Alice Applicant",
              email: "encrypted:alice@example.com",
              status: "pending",
              metadata: 'encrypted:{"message":"Hello"}',
              createdAt: "2026-08-01T00:00:00.000Z",
              isDeleted: 0,
              internalFlag: "must-not-leak",
            }),
          },
          {
            id: "inquiry-2",
            data: () => ({ name: "encrypted:Hidden", email: "encrypted:hidden@example.com" }),
          },
        ],
      });

      await getHandler("/", "get")(req, res, next);

      expect(collection.orderBy).toHaveBeenCalledWith("createdAt", "desc");
      expect(collection.limit).toHaveBeenCalledWith(2);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        inquiries: [{
          id: "inquiry-1",
          type: "student",
          name: "Alice Applicant",
          email: "alice@example.com",
          status: "pending",
          metadata: { message: "Hello" },
          createdAt: "2026-08-01T00:00:00.000Z",
          isDeleted: false,
          archivedAt: null,
        }],
        hasMore: true,
        nextCursor: "inquiry-1",
      });
      expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain("internalFlag");
    });

    it("starts after an existing cursor and marks decryption failures", async () => {
      req.query = { limit: "500", cursor: "cursor-id" };
      const collection = adminDb.collection("inquiries") as any;
      const cursorSnapshot = { exists: true, id: "cursor-id" };
      collection.get
        .mockResolvedValueOnce(cursorSnapshot)
        .mockResolvedValueOnce({
        docs: [{
          id: "inquiry-broken",
          data: () => ({
            type: "mentor",
            name: "encrypted:Broken Name",
            email: "encrypted:broken@example.com",
            status: "pending",
            metadata: "encrypted:not-json",
            createdAt: "2026-08-02T00:00:00.000Z",
            isDeleted: 1,
            archivedAt: "2026-08-03T00:00:00.000Z",
          }),
        }],
      });
      vi.mocked(decrypt)
        .mockRejectedValueOnce(new Error("name decrypt failed"))
        .mockRejectedValueOnce(new Error("email decrypt failed"));

      await getHandler("/", "get")(req, res, next);

      expect(collection.limit).toHaveBeenCalledWith(101);
      expect(collection.startAfter).toHaveBeenCalledWith(cursorSnapshot);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        inquiries: [expect.objectContaining({
          name: "[Decryption Failed]",
          email: "[Decryption Failed]",
          metadata: {},
          isDeleted: true,
        })],
        hasMore: false,
        nextCursor: null,
      }));
    });
  });

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
        role: "member",
        name: "Alice Student",
      });

      // Legal application names and emails must never become public profile
      // identity or third-party avatar seeds.
      const profileSetCall = batchInstance.set.mock.calls[1];
      expect(profileSetCall[1]).toEqual(expect.objectContaining({
        nickname: "ARES Member",
        firstName: "encrypted:Alice",
        lastName: "encrypted:Student",
        contactEmail: "encrypted:alice@student.com",
        sensitiveFieldsVersion: 1,
        showOnAbout: false,
      }));
      expect(profileSetCall[1].avatar).toMatch(
        /^https:\/\/api\.dicebear\.com\/9\.x\/bottts\/svg\?seed=[0-9a-f]{48}$/
      );
      expect(profileSetCall[1].avatar).not.toContain("alice@student.com");
      expect(profileSetCall[1].avatar).not.toContain(targetId);

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

    it("should fail visibly when Firebase Auth lookup fails unexpectedly", async () => {
      const handler = getHandler("/:id/approve-account", "post");
      req.params.id = "inq_auth_failure";

      const mockDoc = adminDb.collection("inquiries").doc as any;
      mockDoc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          name: "encrypted:Alice Student",
          email: "encrypted:alice@student.com",
          type: "student",
        }),
      });
      vi.mocked(adminAuth.getUserByEmail).mockRejectedValue({ code: "auth/internal-error" });

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 502,
        message: "Could not verify the applicant's account status. Please try again.",
      }));
      expect(adminDb.batch).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("Inquiry archive lifecycle", () => {
    it("archives an inquiry without deleting encrypted history", async () => {
      req.params = { id: "inquiry-1" };
      req.user = { uid: "admin-uid" };
      const mockDocRef = adminDb.collection("inquiries").doc("inquiry-1") as any;
      mockDocRef.get.mockResolvedValue({ exists: true, data: () => ({ isDeleted: 0 }) });

      await getHandler("/:id", "delete")(req, res, next);

      expect(mockDocRef.delete).not.toHaveBeenCalled();
      expect(mockDocRef.update).toHaveBeenCalledWith(expect.objectContaining({
        isDeleted: 1,
        archivedBy: "admin-uid",
      }));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, archived: true }));
    });

    it("restores an archived inquiry", async () => {
      req.params = { id: "inquiry-1" };
      req.user = { uid: "admin-uid" };
      const mockDocRef = adminDb.collection("inquiries").doc("inquiry-1") as any;
      mockDocRef.get.mockResolvedValue({ exists: true, data: () => ({ isDeleted: 1 }) });

      await getHandler("/:id/restore", "patch")(req, res, next);

      expect(mockDocRef.update).toHaveBeenCalledWith(expect.objectContaining({
        isDeleted: 0,
        restoredBy: "admin-uid",
      }));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, restored: true }));
    });

    it("rejects status updates for archived inquiries", async () => {
      req.params = { id: "inquiry-1" };
      req.body = { status: "approved" };
      const mockDocRef = adminDb.collection("inquiries").doc("inquiry-1") as any;
      mockDocRef.get.mockResolvedValue({ exists: true, data: () => ({ isDeleted: 1 }) });

      await getHandler("/:id/status", "patch")(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 409 }));
      expect(mockDocRef.update).not.toHaveBeenCalled();
    });

    it("rejects invalid statuses and missing inquiry records", async () => {
      req.params = { id: "missing" };
      req.body = { status: "invalid" };

      await getHandler("/:id/status", "patch")(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));

      next.mockClear();
      req.body = { status: "resolved" };
      const mockDocRef = adminDb.collection("inquiries").doc("missing") as any;
      mockDocRef.get.mockResolvedValue({ exists: false });
      await getHandler("/:id/status", "patch")(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
    });
  });

  describe("POST /api/inquiries - Inquiry submission validation", () => {
    const runStack = async (path: string, method: string, req: any, res: any) => {
      const routeLayer = inquiriesRouter.stack.find(
        (layer) => layer.route && layer.route.path === path && (layer.route as any).methods[method]
      );
      expect(routeLayer).toBeDefined();
      const stack = routeLayer!.route!.stack;
      let errorThrown: any = null;
      
      // Run middlewares (all except the last handler)
      for (let i = 0; i < stack.length - 1; i++) {
        const middleware = stack[i];
        try {
          await new Promise<void>((resolve, reject) => {
            middleware.handle(req, res, (err?: any) => {
              if (err) reject(err);
              else resolve();
            });
          });
        } catch (err) {
          errorThrown = err;
          break;
        }
      }

      // If no middleware failed, run the final route handler
      if (!errorThrown) {
        const handler = stack[stack.length - 1];
        const nextMock = (err?: any) => {
          if (err) errorThrown = err;
        };
        await handler.handle(req, res, nextMock);
      }
      
      return errorThrown;
    };

    it("should pass validation with valid payload", async () => {
      const originalEmulator = process.env.FUNCTIONS_EMULATOR;
      process.env.FUNCTIONS_EMULATOR = "true";
      req.body = {
        type: "student",
        name: "Security Test",
        email: "security.test@example.com",
        metadata: { message: "Hello ARES" },
        recaptchaToken: "test-bypass-token"
      };

      const err = await runStack("/", "post", req, res);
      if (originalEmulator === undefined) delete process.env.FUNCTIONS_EMULATOR;
      else process.env.FUNCTIONS_EMULATOR = originalEmulator;
      expect(err).toBeNull();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
      const mockDoc = adminDb.collection("inquiries").doc as any;
      expect(mockDoc().set).toHaveBeenCalledWith(expect.objectContaining({
        name: "encrypted:Security Test",
        email: "encrypted:security.test@example.com",
        metadata: 'encrypted:{"message":"Hello ARES"}',
        isDeleted: 0,
      }));
    });

    it("should persist attacker-controlled names and emails that resemble test data", async () => {
      const originalEmulator = process.env.FUNCTIONS_EMULATOR;
      process.env.FUNCTIONS_EMULATOR = "true";
      req.body = {
        type: "student",
        name: "Playwright E2E Test",
        email: "playwright.test@aresfirst.org",
        metadata: { message: "This must not bypass persistence." },
        recaptchaToken: "test-bypass-token",
      };

      const err = await runStack("/", "post", req, res);
      if (originalEmulator === undefined) delete process.env.FUNCTIONS_EMULATOR;
      else process.env.FUNCTIONS_EMULATOR = originalEmulator;

      expect(err).toBeNull();
      const mockDoc = adminDb.collection("inquiries").doc as any;
      expect(mockDoc().set).toHaveBeenCalledWith(expect.objectContaining({
        name: "encrypted:Playwright E2E Test",
        email: "encrypted:playwright.test@aresfirst.org",
      }));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        id: expect.stringMatching(/^inq_[0-9a-f-]{36}$/),
      }));
    });

    it("should fail validation with missing or invalid fields", async () => {
      req.body = {
        type: "",
        name: "Test",
        email: "not-an-email",
        recaptchaToken: ""
      };

      const err = await runStack("/", "post", req, res);
      expect(err).toBeDefined();
      expect(err.status).toBe(400);
      expect(err.message).toContain("Validation failed");
    });

    it("should preserve rejection of an explicitly invalid App Check token", async () => {
      req.body = {
        type: "student",
        name: "Security Test",
        email: "security.test@example.com",
        metadata: {},
        recaptchaToken: "recaptcha-token",
      };
      req.appCheckObservation = {
        status: "invalid",
        reason: "verification_failed",
      };

      const err = await runStack("/", "post", req, res);

      expect(err).toBeDefined();
      expect(err.status).toBe(400);
      expect(err.message).toBe("App integrity check failed. Please refresh and try again.");
    });

    it("rejects low-score reCAPTCHA results before storing PII", async () => {
      const originalEmulator = process.env.FUNCTIONS_EMULATOR;
      const originalSecret = process.env.RECAPTCHA_SECRET_KEY;
      delete process.env.FUNCTIONS_EMULATOR;
      process.env.RECAPTCHA_SECRET_KEY = "recaptcha-test-secret";
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          success: true,
          score: 0.2,
          action: "submit",
          hostname: "aresfirst.org",
        }),
      }));
      req.body = {
        type: "student",
        name: "Protected Student",
        email: "student@example.com",
        metadata: {},
        recaptchaToken: "recaptcha-token",
      };

      const err = await runStack("/", "post", req, res);

      vi.unstubAllGlobals();
      if (originalEmulator === undefined) delete process.env.FUNCTIONS_EMULATOR;
      else process.env.FUNCTIONS_EMULATOR = originalEmulator;
      if (originalSecret === undefined) delete process.env.RECAPTCHA_SECRET_KEY;
      else process.env.RECAPTCHA_SECRET_KEY = originalSecret;
      expect(err).toEqual(expect.objectContaining({ status: 400 }));
      expect(adminDb.collection("inquiries").doc().set).not.toHaveBeenCalled();
    });
  });
});
