import { describe, it, expect, vi, beforeEach } from "vitest";
import profilesRouter from "../profiles";
import { adminDb } from "../../lib/firebase-admin";

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

  const queryMock: any = {
    get: mockGet,
    where: vi.fn().mockImplementation(() => queryMock),
    limit: vi.fn().mockImplementation(() => queryMock),
  };

  const mockWhere = vi.fn().mockReturnValue(queryMock);

  const mockCollection = vi.fn().mockReturnValue({
    doc: mockDoc,
    where: mockWhere,
    get: mockGet,
    limit: vi.fn().mockImplementation(() => queryMock),
  });

  return {
    adminDb: {
      collection: mockCollection,
    },
    adminAuth: {
      setCustomUserClaims: vi.fn().mockResolvedValue(undefined),
    }
  };
});

// Mock Zulip API Helpers
vi.mock("../../lib/zulip", () => ({
  getZulipUsers: vi.fn().mockResolvedValue([]),
  createZulipUser: vi.fn().mockResolvedValue({ success: true, userId: 123 }),
}));

describe("Profiles Router Backend Endpoints", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();

    process.env.ENCRYPTION_SECRET = "dummy-secret-key-32-chars-long-!";

    req = {
      params: {},
      body: {},
      query: {},
      headers: { "x-sync-secret": "dummy-secret-key-32-chars-long-!" },
      user: { uid: "test_uid", email: "test@aresfirst.org" },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  const getHandler = (path: string, method: string) => {
    const routeLayer = profilesRouter.stack.find(
      (layer) => layer.route && layer.route.path === path && (layer.route as any).methods[method]
    );
    expect(routeLayer).toBeDefined();
    const stack = routeLayer!.route!.stack;
    return stack[stack.length - 1].handle;
  };

  describe("GET /api/profiles/about-roster - Public facing roster", () => {
    it("should fetch public-facing roster and sanitize PII", async () => {
      const mockDocs = [
        {
          id: "m1",
          data: () => ({
            nickname: "RobotBuilder",
            memberType: "student",
            isDeleted: 0,
            contactEmail: "student@aresfirst.org",
            firstName: "John",
            lastName: "Doe"
          }),
        },
      ];

      const mockCollection = adminDb.collection as any;
      const mockWhere = mockCollection().where;
      const queryMock = {
        get: vi.fn().mockResolvedValue({ docs: mockDocs }),
        limit: vi.fn().mockReturnThis(),
      };
      mockWhere.mockReturnValue(queryMock);

      const handler = getHandler("/about-roster", "get");
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          members: [
            expect.objectContaining({
              nickname: "RobotBuilder",
              memberType: "student",
            })
          ]
        })
      );
      const members = res.json.mock.calls[0][0].members;
      expect(members[0].firstName).toBeUndefined();
      expect(members[0].lastName).toBeUndefined();
    });
  });

  describe("GET /api/profiles/team-roster - Roster for team members", () => {
    it("should return the full roster including emails and details", async () => {
      const mockDocs = [
        {
          id: "m1",
          data: () => ({
            nickname: "CoachDave",
            firstName: "David",
            email: "coach.david@gmail.com",
            avatar: "avatar_url"
          }),
        },
      ];

      const mockCollection = adminDb.collection as any;
      mockCollection().get.mockResolvedValue({ docs: mockDocs });

      const handler = getHandler("/team-roster", "get");
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          members: [
            expect.objectContaining({
              nickname: "CoachDave",
              avatar: "avatar_url"
            })
          ]
        })
      );
    });
  });

  describe("POST /api/profiles/sync - Synchronize profile details", () => {
    it("should sync profile details for matching uid", async () => {
      req.body = {
        userId: "test_sync_uid",
        profile: {
          nickname: "NewNickname",
          firstName: "TestName",
          subteams: ["Software"]
        }
      };

      const mockDocRef = adminDb.collection("").doc("");
      vi.mocked(mockDocRef.get).mockResolvedValue({ exists: true, data: () => ({ role: "student" }) } as any);

      const handler = getHandler("/sync", "post");
      await handler(req, res, next);

      expect(mockDocRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          nickname: "NewNickname",
          firstName: "TestName",
          subteams: ["Software"],
        }),
        expect.objectContaining({ merge: true })
      );
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe("POST /api/profiles/session - User claims confirmation", () => {
    it("should return the verified claims and registration status", async () => {
      const mockDocRef = adminDb.collection("").doc("");
      vi.mocked(mockDocRef.get).mockResolvedValue({ exists: true, data: () => ({ role: "coach" }) } as any);

      const handler = getHandler("/session", "post");
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        authorizedUser: expect.objectContaining({ role: "coach" })
      });
    });
  });

  describe("GET /api/profiles/zulip/users - Fetch users from Zulip integration", () => {
    it("should fetch users successfully", async () => {
      const handler = getHandler("/zulip/users", "get");
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        users: []
      });
    });
  });

  describe("POST /api/profiles/sync - Synchronize validation", () => {
        const runStack = async (path: string, method: string, req: any, res: any) => {
      const routeLayer = profilesRouter.stack.find(
        (layer) => layer.route && layer.route.path === path && (layer.route as any).methods[method]
      );
      expect(routeLayer).toBeDefined();
      const stack = routeLayer!.route!.stack;
      let errorThrown: any = null;

      await new Promise<void>((resolve, reject) => {
        const originalJson = res.json;
        const originalSend = res.send;
        
        const finish = (err?: any) => {
          res.json = originalJson;
          res.send = originalSend;
          if (err) reject(err);
          else resolve();
        };

        res.json = vi.fn().mockImplementation((val) => {
          originalJson(val);
          finish();
          return res;
        });

        res.send = vi.fn().mockImplementation((val) => {
          originalSend(val);
          finish();
          return res;
        });

        let index = 0;
        const next = (err?: any) => {
          if (err) {
            finish(err);
            return;
          }
          if (index >= stack.length) {
            finish();
            return;
          }
          const layer = stack[index++];
          try {
            layer.handle(req, res, next);
          } catch (e) {
            finish(e);
          }
        };

        next();
      }).catch((err) => {
        errorThrown = err;
      });

      return errorThrown;
    };

    it("should pass validation with valid payload", async () => {
      req.body = {
        userId: "test_sync_uid",
        profile: {
          nickname: "NewNickname",
          firstName: "TestName",
          subteams: ["Software"]
        }
      };

      const mockDocRef = adminDb.collection("").doc("");
      vi.mocked(mockDocRef.get).mockResolvedValue({ exists: true, data: () => ({ role: "student" }) } as any);

      const err = await runStack("/sync", "post", req, res);
      expect(err).toBeNull();
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it("should fail validation with invalid userId", async () => {
      req.body = {
        userId: "invalid uid with spaces",
        profile: {
          nickname: "NewNickname"
        }
      };

      const err = await runStack("/sync", "post", req, res);
      expect(err).toBeDefined();
      expect(err.status).toBe(400);
      expect(err.message).toContain("Validation failed");
    });

    it("should fail validation with missing profile", async () => {
      req.body = {
        userId: "valid_uid"
      };

      const err = await runStack("/sync", "post", req, res);
      expect(err).toBeDefined();
      expect(err.status).toBe(400);
      expect(err.message).toContain("Validation failed");
    });
  });
});
