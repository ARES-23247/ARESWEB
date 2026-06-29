import { describe, it, expect, vi, beforeEach } from "vitest";
import robotsRouter, {
  createRobotSchema,
  updateRobotSchema,
  ensureAdminOrCoach
} from "../robots";
import { adminDb } from "../../lib/firebase-admin";
import { ApiError } from "../../middleware/errorHandler";

// Mock Firebase Admin
vi.mock("../../lib/firebase-admin", () => {
  const mockGet = vi.fn();
  const mockSet = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();

  const mockDoc = vi.fn().mockImplementation((id) => {
    return {
      get: mockGet,
      set: mockSet,
      update: mockUpdate,
      delete: mockDelete,
    };
  });

  const queryMock: any = {
    get: mockGet,
    where: vi.fn().mockImplementation(() => queryMock),
    limit: vi.fn().mockImplementation(() => queryMock),
    orderBy: vi.fn().mockImplementation(() => queryMock),
    startAfter: vi.fn().mockImplementation(() => queryMock),
  };

  const mockCollection = vi.fn().mockImplementation(() => {
    return {
      doc: mockDoc,
      where: vi.fn().mockImplementation(() => queryMock),
      get: mockGet,
      limit: vi.fn().mockImplementation(() => queryMock),
      orderBy: vi.fn().mockImplementation(() => queryMock),
    };
  });

  return {
    adminDb: {
      collection: mockCollection,
    },
  };
});

describe("Robots Router Backend Endpoints", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: {},
      query: {},
      body: {},
      user: {
        uid: "user_123",
        email: "test@example.com",
      },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  const getHandler = (path: string, method: string) => {
    const routeLayer = robotsRouter.stack.find(
      (layer) => layer.route && layer.route.path === path && (layer.route as any).methods[method]
    );
    expect(routeLayer).toBeDefined();
    const stack = routeLayer!.route!.stack;
    return stack[stack.length - 1].handle;
  };

  describe("ensureAdminOrCoach Middleware", () => {
    it("should call next() if user has role 'admin'", async () => {
      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "authorized_users") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ role: "admin" }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      await ensureAdminOrCoach(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it("should call next() if user has role 'coach'", async () => {
      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "authorized_users") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ role: "coach" }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      await ensureAdminOrCoach(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it("should call next(ApiError 401) if user is not authenticated (req.user missing)", async () => {
      req.user = undefined;
      await ensureAdminOrCoach(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(401);
    });

    it("should call next(ApiError 403) if user is not found in authorized_users", async () => {
      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "authorized_users") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: false,
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      await ensureAdminOrCoach(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(403);
    });

    it("should call next(ApiError 403) if user has insufficient role (e.g. member)", async () => {
      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "authorized_users") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ role: "member" }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      await ensureAdminOrCoach(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(403);
    });
  });

  describe("GET /api/robots - Fetch active robots", () => {
    it("should fetch all active robots with isDeleted == 0 successfully", async () => {
      const mockDocs = [
        {
          id: "bot1",
          data: () => ({
            name: "Ares Prime",
            seasonName: "Centerstage",
            challengeName: "FIRST Tech Challenge",
            drivetrainType: "Mecanum",
            cadViewerUrl: "https://cad.com/bot1",
            versions: [{ versionNumber: "v1.0", notes: "Initial build", cadViewerUrl: "https://cad.com/bot1-v1" }],
            isDeleted: 0,
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          }),
        },
      ];

      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "robots") {
          const queryMock: any = {
            get: vi.fn().mockResolvedValue({ docs: mockDocs }),
            where: vi.fn().mockImplementation(() => queryMock),
            limit: vi.fn().mockImplementation(() => queryMock),
            orderBy: vi.fn().mockImplementation(() => queryMock),
          };
          return queryMock;
        }
        return {} as any;
      });

      const handler = getHandler("/", "get");
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          robots: [
            expect.objectContaining({ id: "bot1", name: "Ares Prime", drivetrainType: "Mecanum" }),
          ],
        })
      );
    });

    it("should handle startAfter cursor correctly if provided", async () => {
      const mockDocs = [
        {
          id: "bot2",
          data: () => ({
            name: "Ares Beta",
            seasonName: "Centerstage",
            challengeName: "FIRST Tech Challenge",
            drivetrainType: "Tank",
            isDeleted: 0,
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          }),
        },
      ];

      req.query.startAfter = "bot1";

      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "robots") {
          const queryMock: any = {
            get: vi.fn().mockResolvedValue({ docs: mockDocs }),
            where: vi.fn().mockImplementation(() => queryMock),
            limit: vi.fn().mockImplementation(() => queryMock),
            orderBy: vi.fn().mockImplementation(() => queryMock),
            startAfter: vi.fn().mockImplementation(() => queryMock),
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ exists: true }),
            }),
          };
          return queryMock;
        }
        return {} as any;
      });

      const handler = getHandler("/", "get");
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          robots: [
            expect.objectContaining({ id: "bot2", name: "Ares Beta" }),
          ],
        })
      );
    });
  });

  describe("GET /api/robots/:id - Fetch robot details", () => {
    it("should return robot data if it exists and isDeleted is 0", async () => {
      req.params.id = "bot1";

      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "robots") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: "bot1",
                data: () => ({
                  name: "Ares Prime",
                  seasonName: "Centerstage",
                  challengeName: "FIRST Tech Challenge",
                  drivetrainType: "Mecanum",
                  isDeleted: 0,
                }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const handler = getHandler("/:id", "get");
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        robot: expect.objectContaining({ id: "bot1", name: "Ares Prime" }),
      });
    });

    it("should throw a 404 ApiError if robot does not exist", async () => {
      req.params.id = "missing";

      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "robots") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: false,
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const handler = getHandler("/:id", "get");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(404);
      expect(err.message).toBe("Robot not found");
    });

    it("should throw a 404 ApiError if robot is soft-deleted (isDeleted === 1)", async () => {
      req.params.id = "bot_del";

      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "robots") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({
                  name: "Deleted Robot",
                  isDeleted: 1,
                }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const handler = getHandler("/:id", "get");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(404);
      expect(err.message).toBe("Robot not found");
    });
  });

  describe("POST /api/robots - Create robot", () => {
    it("should successfully create robot document", async () => {
      req.body = {
        name: "Ares Alpha",
        seasonName: "Into The Deep",
        challengeName: "FIRST Tech Challenge",
        drivetrainType: "Swerve",
        cadViewerUrl: "https://cad.com/alpha",
        versions: [
          { versionNumber: "1.0", notes: "First CAD prototype", cadViewerUrl: "https://cad.com/alpha-v1" }
        ],
      };

      const mockSet = vi.fn().mockResolvedValue(undefined);
      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "robots") {
          return {
            doc: vi.fn().mockReturnValue({
              id: "new_bot_id",
              set: mockSet,
            }),
          } as any;
        }
        return {} as any;
      });

      const handler = getHandler("/", "post");
      await handler(req, res, next);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "new_bot_id",
          name: "Ares Alpha",
          drivetrainType: "Swerve",
          isDeleted: 0,
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        robot: expect.objectContaining({
          id: "new_bot_id",
          name: "Ares Alpha",
        }),
      });
    });
  });

  describe("PUT /api/robots/:id - Update robot", () => {
    it("should successfully update robot document if active", async () => {
      req.params.id = "bot_exist";
      req.body = {
        name: "Updated Robot Name",
        versions: [
          { versionNumber: "2.0", notes: "Updated intake system" }
        ]
      };

      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "robots") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({
                  id: "bot_exist",
                  name: "Original Bot",
                  isDeleted: 0,
                }),
              }),
              update: mockUpdate,
            }),
          } as any;
        }
        return {} as any;
      });

      const handler = getHandler("/:id", "put");
      await handler(req, res, next);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated Robot Name",
          versions: expect.arrayContaining([
            expect.objectContaining({ versionNumber: "2.0" })
          ]),
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Robot updated successfully",
        })
      );
    });

    it("should throw 404 if robot to update does not exist or isDeleted is 1", async () => {
      req.params.id = "bot_missing";
      req.body = {
        name: "Some Name",
      };

      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "robots") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: false,
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const handler = getHandler("/:id", "put");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(404);
    });
  });

  describe("DELETE /api/robots/:id - Delete robot (soft-delete)", () => {
    it("should soft delete robot by setting isDeleted to 1", async () => {
      req.params.id = "bot_del";

      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "robots") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({
                  id: "bot_del",
                  name: "To Delete",
                  isDeleted: 0,
                }),
              }),
              update: mockUpdate,
            }),
          } as any;
        }
        return {} as any;
      });

      const handler = getHandler("/:id", "delete");
      await handler(req, res, next);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          isDeleted: 1,
        })
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Robot deleted successfully",
      });
    });

    it("should throw 404 if robot to delete is not found", async () => {
      req.params.id = "bot_missing";

      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "robots") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: false,
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const handler = getHandler("/:id", "delete");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(404);
    });
  });

  describe("Schema Validation", () => {
    it("should validate valid robot body", () => {
      const validBody = {
        name: "Ares Swerve",
        seasonName: "Into The Deep",
        challengeName: "FTC",
        drivetrainType: "Swerve",
        cadViewerUrl: "https://cad.com/swerve",
        versions: [
          { versionNumber: "v1.0", notes: "Base chassis", cadViewerUrl: "https://cad.com/swerve-v1" }
        ],
      };
      const result = createRobotSchema.safeParse(validBody);
      expect(result.success).toBe(true);
    });

    it("should fail validation if drivetrainType is missing", () => {
      const invalidBody = {
        name: "Robot",
        seasonName: "Into The Deep",
        challengeName: "FTC",
      };
      const result = createRobotSchema.safeParse(invalidBody);
      expect(result.success).toBe(false);
    });

    it("should allow partial updates in updateRobotSchema", () => {
      const partialBody = {
        name: "New Swerve Name",
      };
      const result = updateRobotSchema.safeParse(partialBody);
      expect(result.success).toBe(true);
    });
  });
});
