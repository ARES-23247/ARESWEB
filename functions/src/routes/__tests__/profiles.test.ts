import { describe, it, expect, vi, beforeEach } from "vitest";
import profilesRouter from "../profiles";
import { adminDb, adminAuth } from "../../lib/firebase-admin";
import { getZulipUsers } from "../../lib/zulip";
import { isEncryptedValue } from "../profileSelf";

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
    orderBy: vi.fn().mockImplementation(() => queryMock),
    startAfter: vi.fn().mockImplementation(() => queryMock),
  };

  const mockWhere = vi.fn().mockReturnValue(queryMock);

  const mockCollection = vi.fn().mockReturnValue({
    doc: mockDoc,
    where: mockWhere,
    get: mockGet,
    limit: vi.fn().mockImplementation(() => queryMock),
    orderBy: vi.fn().mockImplementation(() => queryMock),
  });

  const mockBatch = vi.fn().mockImplementation(() => ({
    set: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  }));

  return {
    adminDb: {
      collection: mockCollection,
      batch: mockBatch,
    },
    adminAuth: {
      setCustomUserClaims: vi.fn().mockResolvedValue(undefined),
      getUserByEmail: vi.fn(),
      listUsers: vi.fn(),
    },
  };
});

// Mock Zulip API Helpers
vi.mock("../../lib/zulip", () => ({
  getZulipUsers: vi.fn().mockResolvedValue([]),
}));

describe("Profiles Router Backend Endpoints", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // The Firebase mock intentionally shares query methods across collection
    // instances. Restore its default chain before each case so a roster query
    // fixture cannot leak into a later session or lifecycle test.
    const collectionRef = adminDb.collection("") as any;
    const queryRef = collectionRef.orderBy();
    vi.mocked(collectionRef.doc("").get).mockReset();
    collectionRef.where.mockReturnValue(queryRef);
    collectionRef.limit.mockReturnValue(queryRef);
    collectionRef.orderBy.mockReturnValue(queryRef);

    process.env.PROFILE_SYNC_SECRET = "dummy-secret-key-32-chars-long-!";
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;

    req = {
      params: {},
      body: {},
      query: {},
      headers: { "x-sync-secret": "dummy-secret-key-32-chars-long-!" },
      user: { uid: "test_uid", email: "test@aresfirst.org", email_verified: true, },
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
            pronouns: "they/them",
            subteams: ["Programming"],
            bio: "Private student biography",
            contactEmail: "student@aresfirst.org",
            firstName: "John",
            lastName: "Doe",
            funFact: "Private profile detail",
          }),
        },
      ];

      const mockCollection = adminDb.collection as any;
      const mockWhere = mockCollection().where;
      const queryMock = {
        get: vi.fn().mockResolvedValue({ docs: mockDocs }),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      };
      mockWhere.mockReturnValue(queryMock);

      const handler = getHandler("/about-roster", "get");
      await handler(req, res, next);

      expect(mockWhere).toHaveBeenCalledWith("showOnAbout", "in", [true, 1]);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          members: [
            expect.objectContaining({
              nickname: "RobotBuilder",
              memberType: "student",
            }),
          ],
        })
      );
      const members = res.json.mock.calls[0][0].members;
      expect(members[0].firstName).toBeUndefined();
      expect(members[0].lastName).toBeUndefined();
      expect(members[0].contactEmail).toBeUndefined();
      expect(members[0].userId).toBeUndefined();
      expect(members[0].uid).toBeUndefined();
      expect(members[0].funFact).toBeUndefined();
      expect(members[0].pronouns).toBeUndefined();
      expect(members[0].subteams).toBeUndefined();
      expect(members[0].bio).toBeUndefined();
    });

    it("should never fall back to a legal name or identifier-derived avatar", async () => {
      const mockCollection = adminDb.collection as any;
      const queryMock = {
        get: vi.fn().mockResolvedValue({
          docs: [{
            id: "private-firebase-uid",
            data: () => ({
              nickname: "",
              firstName: "Legal",
              lastName: "Student",
              contactEmail: "legal.student@example.org",
              memberType: "student",
              showOnAbout: true,
              avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=legal.student%40example.org",
            }),
          },],
        }),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      };
      mockCollection().where.mockReturnValue(queryMock);

      await getHandler("/about-roster", "get")(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        members: [expect.objectContaining({
          nickname: "ARES Member",
          avatar: "",
        }),],
      });
      const publicMember = res.json.mock.calls[0][0].members[0];
      expect(JSON.stringify(publicMember)).not.toContain("Legal");
      expect(JSON.stringify(publicMember)).not.toContain("private-firebase-uid");
    });

    it("deduplicates legacy roster records in favor of the strongest opaque identifier", async () => {
      const contactEmail = "same-member@example.org";
      const mockCollection = adminDb.collection as any;
      const queryMock = {
        get: vi.fn().mockResolvedValue({
          docs: [
            { id: contactEmail, data: () => ({ nickname: "Email record", contactEmail }), },
            { id: "a".repeat(32), data: () => ({ nickname: "Legacy UUID", contactEmail }), },
            { id: "b".repeat(28), data: () => ({ nickname: "Firebase UID", contactEmail }), },
            { id: "short-id", data: () => ({ nickname: "Weak record", contactEmail }), },
          ],
        }),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      };
      mockCollection().where.mockReturnValue(queryMock);

      await getHandler("/about-roster", "get")(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        members: [expect.objectContaining({ nickname: "Firebase UID" })],
      });
    });
  });

  describe("GET /api/profiles/team-roster - Roster for team members", () => {
    it("should return only the safe team-roster DTO", async () => {
      const mockDocs = [
        {
          id: "m1",
          data: () => ({
            nickname: "CoachDave",
            firstName: "David",
            email: "coach.david@gmail.com",
            avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=coachdave",
          }),
        },
      ];

      const mockCollection = adminDb.collection as any;
      mockCollection().get.mockResolvedValueOnce({ docs: mockDocs })
        .mockResolvedValueOnce({
          docs: [{ id: "m1", data: () => ({ role: "coach", isDeleted: 0 }) }],
        });

      const handler = getHandler("/team-roster", "get");
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          members: [
            expect.objectContaining({
              nickname: "CoachDave",
              avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=coachdave",
            }),
          ],
        })
      );
    });

    it("should not substitute a protected legal first name for a missing nickname", async () => {
      const mockDocs = [
        {
          id: "m2",
          data: () => ({
            nickname: "",
            firstName: "PrivateLegalName",
            contactEmail: "student@aresfirst.org",
            avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=m2",
          }),
        },
      ];

      const mockCollection = adminDb.collection as any;
      mockCollection().get.mockResolvedValueOnce({ docs: mockDocs })
        .mockResolvedValueOnce({
          docs: [{ id: "m2", data: () => ({ role: "member", isDeleted: 0 }) }],
        });

      await getHandler("/team-roster", "get")(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        members: [{
          uid: "m2",
          nickname: "ARES Member",
          avatar: "",
        },],
      });
      expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain("PrivateLegalName");
      expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain("student@aresfirst.org");
    });

    it("excludes archived profiles and deauthorized former members", async () => {
      const mockCollection = adminDb.collection as any;
      mockCollection()
        .get.mockResolvedValueOnce({
          docs: [
            { id: "active", data: () => ({ nickname: "Active Member"
  }) },
            {
              id: "archived-profile",
              data: () => ({ nickname: "Archived", isDeleted: 1 }),
            },
            { id: "former", data: () => ({ nickname: "Former Member" }) },
          ],
        })
        .mockResolvedValueOnce({
          docs: [
            { id: "active", data: () => ({ role: "member", isDeleted: 0 }) },
            {
              id: "archived-profile",
              data: () => ({ role: "member", isDeleted: 0 }),
            },
            { id: "former", data: () => ({ role: "member", isDeleted: 1 }) },
          ],
        });

      await getHandler("/team-roster", "get")(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        members: [{ uid: "active", nickname: "Active Member", avatar: "" }],
      });
    });
  });

  describe("POST /api/profiles/admin/users - Firebase Auth synchronization", () => {
    it("should read every Auth page and commit Firestore writes in sub-500 chunks", async () => {
      const makeAuthUser = (index: number) => ({
        uid: `new-user-${index}`,
        email: `member-${index}@example.org`,
        displayName: `Member ${index}`,
        metadata: { creationTime: "2026-01-01T00:00:00.000Z" },
      });
      vi.mocked(adminAuth.listUsers)
        .mockResolvedValueOnce({
          users: Array.from({ length: 300 }, (_, index) => makeAuthUser(index)),
          pageToken: "next-auth-page",
        } as any)
        .mockResolvedValueOnce({
          users: Array.from({ length: 101 }, (_, index) =>
            makeAuthUser(index + 300),
          ),
          pageToken: undefined,
        } as any);

      const existingDocs = Array.from({ length: 400 }, (_, index) => ({
        id: `existing-user-${index}`,
        data: () => ({ email: `existing-${index}@example.org` }),
      }));
      const collection = (adminDb.collection as any)();
      const query = collection.orderBy();
      query.get
        .mockResolvedValueOnce({ docs: existingDocs })
        .mockResolvedValueOnce({ docs: [] });

      await getHandler("/admin/users", "post")(req, res, next);

      expect(adminAuth.listUsers).toHaveBeenNthCalledWith(1, 1000, undefined);
      expect(adminAuth.listUsers).toHaveBeenNthCalledWith(
        2,
        1000,
        "next-auth-page",
      );
      expect(query.startAfter).toHaveBeenCalledWith(existingDocs[399]);
      expect(adminDb.batch).toHaveBeenCalledTimes(2);
      const firstBatch = vi.mocked(adminDb.batch).mock.results[0].value;
      const secondBatch = vi.mocked(adminDb.batch).mock.results[1].value;
      expect(firstBatch.set).toHaveBeenCalledTimes(400);
      expect(secondBatch.set).toHaveBeenCalledTimes(1);
      expect(firstBatch.commit).toHaveBeenCalledTimes(1);
      expect(secondBatch.commit).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        provisionedCount: 401,
      });
    });

    it("should return an error instead of fake success when Auth listing fails", async () => {
      vi.mocked(adminAuth.listUsers).mockRejectedValue(
        new Error("upstream unavailable"),
      );

      await getHandler("/admin/users", "post")(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 502,
          message:
            "Could not synchronize Firebase Auth users. Please try again.",
        }),
      );
      expect(res.json).not.toHaveBeenCalled();
      expect(adminDb.batch).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/profiles/admin/users/list - Paginated administrative directory", () => {
    it("returns a bounded explicit DTO, redacts raw records, and emits an opaque cursor", async () => {
      req.query = { limit: "1" };
      const firstAuthorizationDoc = {
        id: "student_uid_1",
        data: () => ({
          email: "student@example.org",
          name: "Private Legal Student Name",
          role: "student",
          createdAt: "2026-01-01T00:00:00.000Z",
          isDeleted: 0,
          archivedBy: "internal-admin-uid",
          internalNotes: "never expose",
        }),
      };
      const extraAuthorizationDoc = {
        id: "student_uid_2",
        data: () => ({ email: "second@example.org", role: "member" }),
      };
      const sharedGet = vi.mocked((adminDb.collection("") as any).doc("").get);
      sharedGet
        .mockResolvedValueOnce({
          docs: [firstAuthorizationDoc, extraAuthorizationDoc],
        } as any)
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            nickname: "CircuitFox",
            firstName: "Private",
            lastName: "Student",
            phone: "555-0100",
            contactEmail: "student@example.org",
            memberType: "student",
            subteams: ["Programming"],
            avatar:
              "https://api.dicebear.com/9.x/bottts/svg?seed=student_uid_1",
          }),
        } as any);
      vi.mocked(getZulipUsers).mockResolvedValueOnce([
        {
          email: "student@example.org",
          delivery_email: "private-delivery@example.org",
          full_name: "Private Zulip Name",
          user_id: 42,
        },
      ]);

      await getHandler("/admin/users/list", "get")(req, res, next);

      const query = (adminDb.collection as any)().orderBy();
      expect(query.limit).toHaveBeenCalledWith(2);
      expect(res.json).toHaveBeenCalledWith({
        users: [
          {
            id: "student_uid_1",
            email: "student@example.org",
            role: "member",
            name: "CircuitFox",
            isRegistered: true,
            avatar: "",
            subteams: ["Programming"],
            memberType: "student",
            profileExists: true,
            zulipLinked: true,
            createdAt: "2026-01-01T00:00:00.000Z",
            isDeleted: false,
          },
        ],
        nextCursor: Buffer.from("student_uid_1", "utf8").toString("base64url"),
        integrations: { zulip: { available: true, diagnostic: null } },
      });
      const serializedResponse = JSON.stringify(res.json.mock.calls[0][0]);
      expect(serializedResponse).not.toContain("Private Legal Student Name");
      expect(serializedResponse).not.toContain("555-0100");
      expect(serializedResponse).not.toContain("private-delivery");
      expect(serializedResponse).not.toContain("internalNotes");
      expect(serializedResponse).not.toContain("archivedBy");
      expect(serializedResponse).not.toContain("user_id");
    });

    it("continues after a validated cursor and reports optional Zulip unavailability honestly", async () => {
      req.query = {
        limit: "50",
        cursor: Buffer.from("prior_uid", "utf8").toString("base64url"),
      };
      const authorizationDoc = {
        id: "next_uid",
        data: () => ({
          email: "adult@example.org",
          name: "Mentor A",
          role: "mentor",
        }),
      };
      const sharedGet = vi.mocked((adminDb.collection("") as any).doc("").get);
      sharedGet
        .mockResolvedValueOnce({ docs: [authorizationDoc] } as any)
        .mockResolvedValueOnce({ exists: false, data: () => undefined } as any);
      vi.mocked(getZulipUsers).mockResolvedValueOnce(null);

      await getHandler("/admin/users/list", "get")(req, res, next);

      const query = (adminDb.collection as any)().orderBy();
      expect(query.startAfter).toHaveBeenCalledWith("prior_uid");
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          users: [
            expect.objectContaining({ id: "next_uid", zulipLinked: false }),
          ],
          nextCursor: null,
          integrations: {
            zulip: {
              available: false,
              diagnostic:
                "HTTP 503: Zulip integration is inactive or configured incorrectly.",
            },
          },
        }),
      );
    });

    it("surfaces database failures instead of returning an empty successful page", async () => {
      req.query = {};
      vi.mocked(
        (adminDb.collection("") as any).doc("").get,
      ).mockRejectedValueOnce(new Error("firestore unavailable"));

      await getHandler("/admin/users/list", "get")(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 500,
          message: "Could not load the user directory. Please try again.",
        }),
      );
      expect(res.json).not.toHaveBeenCalled();
    });

    it("rejects malformed cursors before querying Firestore", async () => {
      req.query = { cursor: "not/a/cursor" };

      await getHandler("/admin/users/list", "get")(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 400 }),
      );
      expect(res.json).not.toHaveBeenCalled();
    });

    it("rejects a syntactically valid cursor that decodes to an unsafe document path", async () => {
      req.query = {
        cursor: Buffer.from("unsafe/document", "utf8").toString("base64url"),
      };

      await getHandler("/admin/users/list", "get")(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 400,
          message: "Invalid pagination cursor.",
        }),
      );
      expect(res.json).not.toHaveBeenCalled();
    });

    it("normalizes legacy roles, member types, arrays, names, and Firestore timestamps", async () => {
      req.query = { limit: "10" };
      const roles = [
        "coach",
        "parent",
        "lead",
        "admin",
        "unverified",
        "unexpected",
      ];
      const authorizationDocs = roles.map((role, index) => ({
        id: `user_${index}`,
        data: () => ({
          email: index === 5 ? 42 : `USER${index}@EXAMPLE.ORG`,
          name: `Adult Name ${index}`,
          role,
          memberType: index === 4 ? "sponsor" : undefined,
          createdAt:
            index === 0
              ? { toDate: () => new Date("2026-02-01T00:00:00.000Z") }
              : { toDate: () => new Date("invalid") },
        }),
      }));
      const sharedGet = vi.mocked((adminDb.collection("") as any).doc("").get);
      sharedGet.mockResolvedValueOnce({ docs: authorizationDocs } as any);
      for (let index = 0; index < roles.length; index += 1) {
        sharedGet.mockResolvedValueOnce({
          exists: true,
          data: () => ({
            nickname: index === 2 ? "  Lead Nickname  " : "",
            memberType: index === 5 ? "invalid-type" : undefined,
            subteams:
              index === 1 ? [" Build ", 10, "", "Programming"] : "not-an-array",
            avatar:
              index === 3 ? "https://avatars.example.org/safe.png" : undefined,
          }),
        } as any);
      }
      vi.mocked(getZulipUsers).mockResolvedValueOnce([]);

      await getHandler("/admin/users/list", "get")(req, res, next);

      const payload = res.json.mock.calls[0][0];
      expect(
        payload.users.map((user: any) => [user.role, user.memberType]),
      ).toEqual([
        ["admin", "mentor"],
        ["member", "parent"],
        ["mentor", "mentor"],
        ["admin", "mentor"],
        ["unverified", "sponsor"],
        ["member", ""],
      ]);
      expect(payload.users[0].createdAt).toBe("2026-02-01T00:00:00.000Z");
      expect(payload.users[1].subteams).toEqual(["Build", "Programming"]);
      expect(payload.users[2].name).toBe("Lead Nickname");
      expect(payload.users[5].email).toBe("");
      expect(payload.users[5].name).toBe("ARES Member");
    });
  });

  describe("POST /api/profiles/sync - Synchronize profile details", () => {
    it("should sync profile details for matching uid", async () => {
      req.body = {
        userId: "test_sync_uid",
        profile: {
          nickname: "NewNickname",
          firstName: "TestName",
          subteams: ["Software"],
        },
      };

      const mockDocRef = adminDb.collection("").doc("");
      vi.mocked(mockDocRef.get).mockResolvedValue({
        exists: true,
        data: () => ({ role: "student" }),
      } as any);

      const handler = getHandler("/sync", "post");
      await handler(req, res, next);

      expect(mockDocRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          nickname: "NewNickname",
          subteams: ["Software"],
        }),
        expect.objectContaining({ merge: true }),
      );
      const storedProfile = vi.mocked(mockDocRef.set).mock.calls[0][0];
      expect(isEncryptedValue(storedProfile.firstName)).toBe(true);
      expect(JSON.stringify(storedProfile)).not.toContain("TestName");
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it("fails closed for missing or incorrect synchronization secrets", async () => {
      const handler = getHandler("/sync", "post");
      req.body = { userId: "sync_uid", profile: { nickname: "CircuitFox" } };

      delete process.env.PROFILE_SYNC_SECRET;
      await handler(req, res, next);
      expect(next).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 503 }),
      );

      process.env.PROFILE_SYNC_SECRET = "expected-secret";
      req.headers = {};
      await handler(req, res, next);
      expect(next).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: 401,
          message: expect.stringContaining("Missing"),
        }),
      );

      req.headers = { "x-sync-secret": "incorrect-secret" };
      await handler(req, res, next);
      expect(next).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: 401,
          message: expect.stringContaining("Invalid"),
        }),
      );
      expect(res.json).not.toHaveBeenCalled();
    });

    it("rejects profile fields that fail the private profile schema", async () => {
      req.body = {
        userId: "sync_uid",
        profile: { nickname: "x".repeat(81) },
      };

      await getHandler("/sync", "post")(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 400,
          message: expect.stringContaining("Invalid profile payload"),
        }),
      );
    });

    it("routes an email sync to Firebase Auth and cleans up legacy identifiers", async () => {
      req.body = {
        userId: "legacy_uid",
        email: "MEMBER@EXAMPLE.ORG",
        role: "mentor",
        name: "Mentor Member",
        profile: {
          nickname: "Mentor Member",
          memberType: "mentor",
          showEmail: true,
        },
      };
      vi.mocked(adminAuth.getUserByEmail).mockResolvedValueOnce({
        uid: "firebase_uid",
      } as any);
      const documentRef = adminDb.collection("").doc("");

      await getHandler("/sync", "post")(req, res, next);

      expect(adminAuth.getUserByEmail).toHaveBeenCalledWith(
        "member@example.org",
      );
      expect(documentRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "member@example.org",
          role: "mentor",
          name: "Mentor Member",
        }),
        { merge: true },
      );
      expect(documentRef.delete).toHaveBeenCalledTimes(4);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe("POST /api/profiles/session - User claims confirmation", () => {
    it("rejects unverified email claims before any legacy or bootstrap grant", async () => {
      req.user = {
        uid: "attacker_uid",
        email: "invited.member@example.org",
        email_verified: false,
      };
      await getHandler("/session", "post")(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
      expect(res.json).not.toHaveBeenCalled();
      const batch = vi.mocked(adminDb.batch).mock.results.at(-1)?.value;
      if (batch) expect(batch.set).not.toHaveBeenCalled();
    });

    it("should return the verified claims and registration status", async () => {
      const mockDocRef = adminDb.collection("").doc("");
      vi.mocked(mockDocRef.get).mockResolvedValue({
        exists: true,
        data: () => ({ role: "coach" }),
      } as any);

      const handler = getHandler("/session", "post");
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        authorizedUser: expect.objectContaining({
          role: "admin",
          memberType: "mentor",
        }),
      });
    });

    it("migrates a legacy email-matched authorization and profile atomically", async () => {
      const documentRef = adminDb.collection("").doc("");
      vi.mocked(documentRef.get)
        .mockResolvedValueOnce({ exists: false, data: () => undefined } as any)
        .mockResolvedValueOnce({
          empty: false,
          docs: [
            {
              id: "legacy_uid",
              ref: { id: "legacy_uid" },
              data: () => ({ email: "test@aresfirst.org", role: "student" }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            nickname: "CircuitFox",
            firstName: "encrypted-private-value",
          }),
        } as any);

      await getHandler("/session", "post")(req, res, next);

      const batch = vi.mocked(adminDb.batch).mock.results[0].value;
      expect(batch.set).toHaveBeenCalledTimes(2);
      expect(batch.delete).toHaveBeenCalledTimes(2);
      expect(batch.commit).toHaveBeenCalledOnce();
      expect(res.json).toHaveBeenCalledWith({
        authorizedUser: { email: "test@aresfirst.org", role: "student" },
      });
    });

    it("creates the explicitly configured bootstrap administrator", async () => {
      process.env.BOOTSTRAP_ADMIN_EMAIL = "TEST@ARESFIRST.ORG";
      const documentRef = adminDb.collection("").doc("");
      vi.mocked(documentRef.get)
        .mockResolvedValueOnce({ exists: false, data: () => undefined } as any)
        .mockResolvedValueOnce({ empty: true, docs: [] } as any);

      await getHandler("/session", "post")(req, res, next);

      expect(documentRef.set).toHaveBeenCalledWith({
        email: "test@aresfirst.org",
        role: "admin",
        name: "Bootstrap Administrator",
      });
      expect(res.json).toHaveBeenCalledWith({
        authorizedUser: expect.objectContaining({ role: "admin" }),
      });
    });

    it("creates a visible unverified record for a new sign-in without exposing it publicly", async () => {
      req.user = {
        uid: "new_uid",
        email: "new.member@example.org",
        name: "New Member",
        email_verified: true,
      };
      const documentRef = adminDb.collection("").doc("");
      vi.mocked(documentRef.get)
        .mockResolvedValueOnce({ exists: false, data: () => undefined } as any)
        .mockResolvedValueOnce({ empty: true, docs: [] } as any);

      await getHandler("/session", "post")(req, res, next);

      expect(documentRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "new.member@example.org",
          role: "unverified",
          name: "New Member",
        }),
      );
      expect(res.json).toHaveBeenCalledWith({
        authorizedUser: expect.objectContaining({ role: "unverified" }),
      });
    });
  });

  describe("Admin user lifecycle operations", () => {
    it("normalizes invitation email addresses in validation middleware", async () => {
      req.body = {
        email: "NEW.MEMBER@EXAMPLE.ORG",
        name: "New Member",
        role: "member",
        memberType: "student",
      };
      const routeLayer = profilesRouter.stack.find(
        (layer) =>
          layer.route?.path === "/admin/users/invite" &&
          layer.route.methods.post,
      );
      const validationMiddleware = routeLayer!.route!.stack.at(-2)!.handle;
      await new Promise<void>((resolve, reject) => {
        validationMiddleware(req, res, (error?: unknown) =>
          error ? reject(error) : resolve(),
        );
      });

      expect(req.body.email).toBe("new.member@example.org");
    });

    it("creates invitations through an audited batch", async () => {
      req.body = {
        email: "new.member@example.org",
        name: "New Member",
        role: "member",
        memberType: "student",
      };
      req.user = {
        uid: "admin_uid",
        email: "admin@aresfirst.org",
        email_verified: true,
      };
      const collectionRef = adminDb.collection("") as any;
      const queryRef = collectionRef.where();
      vi.mocked(queryRef.get).mockResolvedValue({ empty: true, docs: [] });

      await getHandler("/admin/users/invite", "post")(req, res, next);

      const batch = vi.mocked(adminDb.batch).mock.results[0].value;
      expect(batch.set).toHaveBeenCalledTimes(2);
      expect(batch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          email: "new.member@example.org",
          role: "member",
          memberType: "student",
          isDeleted: 0,
        }),
      );
      expect(batch.commit).toHaveBeenCalledOnce();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it("rejects a duplicate invitation", async () => {
      req.body = {
        email: "existing@example.org",
        name: "Existing Member",
        role: "member",
        memberType: "student",
      };
      req.user = {
        uid: "admin_uid",
        email: "admin@aresfirst.org",
        email_verified: true,
      };
      vi.mocked(
        (adminDb.collection("") as any).where().get,
      ).mockResolvedValueOnce({
        empty: false,
        docs: [{ id: "existing_uid" }],
      } as any);

      await getHandler("/admin/users/invite", "post")(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 409 }),
      );
      expect(adminDb.batch).not.toHaveBeenCalled();
    });

    it("updates authorization and profile membership in one audited batch", async () => {
      req.params = { userId: "member_uid" };
      req.body = { role: "mentor", memberType: "mentor" };
      req.user = {
        uid: "admin_uid",
        email: "admin@aresfirst.org",
        email_verified: true,
      };
      const mockDocRef = adminDb.collection("").doc("");
      vi.mocked(mockDocRef.get).mockResolvedValue({
        exists: true,
        data: () => ({ role: "member", memberType: "student" }),
      } as any);

      await getHandler("/admin/users/:userId/permissions", "patch")(
        req,
        res,
        next,
      );

      const batch = vi.mocked(adminDb.batch).mock.results[0].value;
      expect(batch.set).toHaveBeenCalledTimes(3);
      expect(batch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ role: "mentor", memberType: "mentor" }),
        { merge: true },
      );
      expect(batch.commit).toHaveBeenCalledOnce();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        user: { id: "member_uid", role: "mentor", memberType: "mentor" },
      });
    });

    it("prevents administrators from demoting themselves", async () => {
      req.params = { userId: "admin_uid" };
      req.body = { role: "member", memberType: "mentor" };
      req.user = {
        uid: "admin_uid",
        email: "admin@aresfirst.org",
        email_verified: true,
      };

      await getHandler("/admin/users/:userId/permissions", "patch")(
        req,
        res,
        next,
      );

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 400 }),
      );
      expect(adminDb.batch).not.toHaveBeenCalled();
    });

    it("rejects unsafe and missing authorization targets during permission updates", async () => {
      req.user = {
        uid: "admin_uid",
        email: "admin@aresfirst.org",
        email_verified: true,
      };
      req.body = { role: "member", memberType: "student" };

      req.params = { userId: "unsafe/id" };
      await getHandler("/admin/users/:userId/permissions", "patch")(
        req,
        res,
        next,
      );
      expect(next).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 400 }),
      );

      req.params = { userId: "missing_uid" };
      vi.mocked(adminDb.collection("").doc("").get).mockResolvedValue({
        exists: false,
        data: () => undefined,
      } as any);
      await getHandler("/admin/users/:userId/permissions", "patch")(
        req,
        res,
        next,
      );
      expect(next).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 404 }),
      );
      expect(adminDb.batch).not.toHaveBeenCalled();
    });

    it("archives authorization and profile data instead of deleting it", async () => {
      req.params = { userId: "member_uid" };
      req.user = {
        uid: "admin_uid",
        email: "admin@aresfirst.org",
        email_verified: true,
      };
      const mockDocRef = adminDb.collection("").doc("");
      vi.mocked(mockDocRef.get).mockResolvedValue({
        exists: true,
        data: () => ({ role: "member", isDeleted: 0 }),
      } as any);

      await getHandler("/admin/users/:userId", "delete")(req, res, next);

      const batch = vi.mocked(adminDb.batch).mock.results[0].value;
      expect(batch.delete).not.toHaveBeenCalled();
      expect(batch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          role: "unverified",
          isDeleted: 1,
          archivedRole: "member",
        }),
        { merge: true },
      );
      expect(batch.commit).toHaveBeenCalledOnce();
      expect(res.json).toHaveBeenCalledWith({ success: true, archived: true });
    });

    it("blocks self-revocation and rejects a missing revoke target", async () => {
      req.user = {
        uid: "admin_uid",
        email: "admin@aresfirst.org",
        email_verified: true,
      };
      req.params = { userId: "admin_uid" };
      await getHandler("/admin/users/:userId", "delete")(req, res, next);
      expect(next).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 400 }),
      );

      req.params = { userId: "missing_uid" };
      vi.mocked(adminDb.collection("").doc("").get).mockResolvedValue({
        exists: false,
        data: () => undefined,
      } as any);
      await getHandler("/admin/users/:userId", "delete")(req, res, next);
      expect(next).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 404 }),
      );
      expect(adminDb.batch).not.toHaveBeenCalled();
    });

    it("restores an archived user's prior role", async () => {
      req.params = { userId: "member_uid" };
      req.user = {
        uid: "admin_uid",
        email: "admin@aresfirst.org",
        email_verified: true,
      };
      const mockDocRef = adminDb.collection("").doc("");
      vi.mocked(mockDocRef.get).mockResolvedValue({
        exists: true,
        data: () => ({
          role: "unverified",
          archivedRole: "mentor",
          isDeleted: 1,
        }),
      } as any);

      await getHandler("/admin/users/:userId/restore", "patch")(req, res, next);

      const batch = vi.mocked(adminDb.batch).mock.results[0].value;
      expect(batch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ role: "mentor", isDeleted: 0 }),
        { merge: true },
      );
      expect(batch.commit).toHaveBeenCalledOnce();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        restored: true,
        role: "mentor",
      });
    });

    it("rejects missing and already-active restore targets", async () => {
      req.params = { userId: "member_uid" };
      req.user = {
        uid: "admin_uid",
        email: "admin@aresfirst.org",
        email_verified: true,
      };
      const get = vi.mocked(adminDb.collection("").doc("").get);

      get.mockResolvedValue({ exists: false, data: () => undefined } as any);
      await getHandler("/admin/users/:userId/restore", "patch")(req, res, next);
      expect(next).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 404 }),
      );

      get.mockResolvedValue({
        exists: true,
        data: () => ({ role: "member", isDeleted: 0 }),
      } as any);
      await getHandler("/admin/users/:userId/restore", "patch")(req, res, next);
      expect(next).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 409 }),
      );
      expect(adminDb.batch).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/profiles/zulip/users - Legacy subject status", () => {
    it("returns only whether the signed-in subject is linked", async () => {
      vi.mocked(getZulipUsers).mockResolvedValueOnce([
        {
          email: "test@aresfirst.org",
          delivery_email: "private-delivery@example.org",
          full_name: "Private Zulip Name",
        },
      ]);
      const handler = getHandler("/zulip/users", "get");
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        linked: true,
      });
      const serialized = JSON.stringify(res.json.mock.calls[0][0]);
      expect(serialized).not.toContain("test@aresfirst.org");
      expect(serialized).not.toContain("private-delivery");
      expect(serialized).not.toContain("Private Zulip Name");
    });

    it("reports inactive Zulip as an upstream service failure", async () => {
      vi.mocked(getZulipUsers).mockResolvedValueOnce(null);

      await getHandler("/zulip/users", "get")(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 503 }),
      );
      expect(res.json).not.toHaveBeenCalled();
    });

    it("returns an unlinked boolean without exposing candidate accounts", async () => {
      req.user = { uid: "member_uid" };
      vi.mocked(getZulipUsers).mockResolvedValueOnce([
        {
          email: "someone.else@example.org",
          delivery_email: "private@example.org",
        },
      ]);

      await getHandler("/zulip/users", "get")(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, linked: false });
    });
  });

  describe("POST /api/profiles/sync - Synchronize validation", () => {
    const runStack = async (
      path: string,
      method: string,
      req: any,
      res: any,
    ) => {
      const routeLayer = profilesRouter.stack.find(
        (layer) =>
          layer.route &&
          layer.route.path === path &&
          (layer.route as any).methods[method],
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
      req.body = {
        userId: "test_sync_uid",
        profile: {
          nickname: "NewNickname",
          firstName: "TestName",
          subteams: ["Software"],
        },
      };

      const mockDocRef = adminDb.collection("").doc("");
      vi.mocked(mockDocRef.get).mockResolvedValue({
        exists: true,
        data: () => ({ role: "student" }),
      } as any);

      const err = await runStack("/sync", "post", req, res);
      expect(err).toBeNull();
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it("should fail validation with invalid userId", async () => {
      req.body = {
        userId: "invalid uid with spaces",
        profile: {
          nickname: "NewNickname",
        },
      };

      const err = await runStack("/sync", "post", req, res);
      expect(err).toBeDefined();
      expect(err.status).toBe(400);
      expect(err.message).toContain("Validation failed");
    });

    it("should fail validation with missing profile", async () => {
      req.body = {
        userId: "valid_uid",
      };

      const err = await runStack("/sync", "post", req, res);
      expect(err).toBeDefined();
      expect(err.status).toBe(400);
      expect(err.message).toContain("Validation failed");
    });
  });
});
