import { describe, it, expect, vi, beforeEach } from "vitest";
import tournamentsRouter, {
  createTournamentSchema,
  createTournamentMatchSchema,
  updateTournamentSchema,
  updateTournamentMatchSchema,
  ensureAdminOrCoach
} from "../tournaments";
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

describe("Tournaments Router Backend Endpoints", () => {
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
    const routeLayer = tournamentsRouter.stack.find(
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

    it("should deny the mentor role", async () => {
      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "authorized_users") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ role: "mentor" }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      await ensureAdminOrCoach(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0]).toMatchObject({ status: 403 });
    });

    it("should call next(ApiError 401) if user is not authenticated (req.user missing)", async () => {
      req.user = undefined;
      await ensureAdminOrCoach(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(401);
      expect(err.message).toContain("Unauthorized");
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
      expect(err.message).toContain("Forbidden: User not authorized");
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
      expect(err.message).toContain("admin or coach access");
    });
  });

  describe("GET /api/tournaments - Fetch active tournaments", () => {
    it("should fetch all active tournaments with isDeleted == 0 successfully", async () => {
      const mockDocs = [
        {
          id: "tour1",
          data: () => ({
            name: "States",
            seasonName: "Centerstage",
            challengeName: "FIRST Tech Challenge",
            date: "2024-03-10",
            location: "Detroit",
            oprList: [
              { teamNumber: "23247", teamName: "ARES", opr: 123.4, internalNote: "do not expose" },
              { teamNumber: null, teamName: "Invalid", opr: 10 },
            ],
            scoutingDetails: {
              autoPathNotes: "Reliable path",
              driverFeedback: "Responsive",
              robotSpecs: "Mecanum",
              privateDraft: "do not expose",
            },
            isDeleted: 0,
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          }),
        },
        {
          id: "tour2",
          data: () => ({
            name: "Worlds",
            date: "2024-04-20",
            location: "Houston",
            isDeleted: 0,
          }),
        },
      ];

      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "tournaments") {
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
          tournaments: [
            expect.objectContaining({ id: "tour2", name: "Worlds" }),
            expect.objectContaining({ id: "tour1", name: "States" }),
          ],
        })
      );
      const payload = res.json.mock.calls[0][0];
      const states = payload.tournaments.find((item: { id: string }) => item.id === "tour1");
      expect(states.oprList).toEqual([{ teamNumber: "23247", teamName: "ARES", opr: 123.4 }]);
      expect(states.scoutingDetails).toEqual({
        autoPathNotes: "Reliable path",
        driverFeedback: "Responsive",
        robotSpecs: "Mecanum",
      });
    });

    it("should handle startAfter cursor correctly if provided", async () => {
      const mockDocs = [
        {
          id: "tour2",
          data: () => ({
            name: "Quals 1",
            seasonName: "Centerstage",
            challengeName: "FIRST Tech Challenge",
            isDeleted: 0,
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          }),
        },
      ];

      req.query.startAfter = "tour1";

      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "tournaments") {
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
          tournaments: [
            expect.objectContaining({ id: "tour2", name: "Quals 1" }),
          ],
        })
      );
    });
  });

  describe("GET /api/tournaments/:id - Fetch tournament details", () => {
    it("should return tournament data if it exists and isDeleted is 0", async () => {
      req.params.id = "tour1";

      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "tournaments") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: "tour1",
                data: () => ({
                  name: "States",
                  seasonName: "Centerstage",
                  challengeName: "FIRST Tech Challenge",
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
        tournament: expect.objectContaining({ id: "tour1", name: "States" }),
      });
    });

    it("should throw a 404 ApiError if tournament does not exist", async () => {
      req.params.id = "missing";

      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "tournaments") {
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
      expect(err.message).toBe("Tournament not found");
    });

    it("should throw a 404 ApiError if tournament is soft-deleted (isDeleted === 1)", async () => {
      req.params.id = "tour_del";

      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "tournaments") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({
                  name: "Deleted Tourney",
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
      expect(err.message).toBe("Tournament not found");
    });
  });

  describe("POST /api/tournaments - Create tournament", () => {
    it("should successfully create tournament document", async () => {
      req.body = {
        name: "World Championship",
        seasonName: "Centerstage",
        challengeName: "FIRST Tech Challenge",
        location: "Houston, TX",
        date: "2024-04-17",
      };

      const mockSet = vi.fn().mockResolvedValue(undefined);
      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "tournaments") {
          return {
            doc: vi.fn().mockReturnValue({
              id: "new_tour_id",
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
          name: "World Championship",
          isDeleted: 0,
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        tournament: expect.objectContaining({
          id: "new_tour_id",
          name: "World Championship",
        }),
      });
    });
  });

  describe("PUT /api/tournaments/:id - Update tournament", () => {
    it("should successfully update tournament document if active", async () => {
      req.params.id = "tour_exist";
      req.body = {
        name: "Updated Championship Name",
      };

      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "tournaments") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({
                  id: "tour_exist",
                  name: "Championship",
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
          name: "Updated Championship Name",
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Tournament updated successfully",
        })
      );
    });

    it("should throw 404 if tournament to update does not exist or isDeleted is 1", async () => {
      req.params.id = "tour_missing";
      req.body = {
        name: "Some Name",
      };

      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "tournaments") {
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

  describe("DELETE /api/tournaments/:id - Delete tournament (soft-delete)", () => {
    it("should soft delete tournament by setting isDeleted to 1", async () => {
      req.params.id = "tour_del";

      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "tournaments") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({
                  id: "tour_del",
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
        message: "Tournament archived successfully",
      });
    });

    it("should throw 404 if tournament to delete is not found", async () => {
      req.params.id = "tour_missing";

      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "tournaments") {
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
    it("should validate valid tournament body", () => {
      const validBody = {
        name: "Michigan Finals",
        seasonName: "Into The Deep",
        challengeName: "FTC",
        location: "Novi, MI",
        date: "2024-12-07",
      };
      const result = createTournamentSchema.safeParse(validBody);
      expect(result.success).toBe(true);
    });

    it("should fail validation if name is missing", () => {
      const invalidBody = {
        seasonName: "Into The Deep",
        challengeName: "FTC",
      };
      const result = createTournamentSchema.safeParse(invalidBody);
      expect(result.success).toBe(false);
    });

    it("should allow partial updates in updateTournamentSchema", () => {
      const partialBody = {
        name: "Only New Name",
      };
      const result = updateTournamentSchema.safeParse(partialBody);
      expect(result.success).toBe(true);
    });
  });

  describe("stale match protection", () => {
    it("returns 404 for a missing match completion update and never recreates it", async () => {
      req.params = { id: "tour1", matchId: "stale-match" };
      req.body = { completed: true };
      const set = vi.fn();
      const update = vi.fn();

      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "tournament_matches") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
              set,
              update,
            }),
          } as any;
        }
        return {} as any;
      });

      const handler = getHandler("/:id/matches/:matchId/completion", "put");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 404,
        code: "MATCH_NOT_FOUND",
      }));
      expect(set).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("match DTO and lifecycle endpoints", () => {
    it("returns a bounded, active, naturally sorted match DTO list", async () => {
      req.params = { id: "tour1" };
      req.query = { limit: "999" };
      const matchDocs = [
        {
          id: "qm10",
          data: () => ({
            tournamentId: "tour1",
            matchNumber: "QM10",
            alliance: "blue",
            partner: "100",
            opponents: ["200", 300, "400"],
            scoreSelf: 15,
            scoreOpponent: 20,
            result: "lost",
            completed: true,
            isDeleted: 0,
          }),
        },
        {
          id: "qm2",
          data: () => ({
            tournamentId: "tour1",
            matchNumber: "QM2",
            alliance: "red",
            partner: "101",
            opponents: ["201"],
            result: "upcoming",
            completed: false,
            isDeleted: 0,
          }),
        },
        { id: "archived", data: () => ({ tournamentId: "tour1", isDeleted: 1 }) },
      ];

      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "tournaments") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ exists: true, id: "tour1", data: () => ({ isDeleted: 0 }) }),
            }),
          } as any;
        }
        if (name === "tournament_matches") {
          const queryMock: any = {
            where: vi.fn().mockImplementation(() => queryMock),
            limit: vi.fn().mockImplementation(() => queryMock),
            get: vi.fn().mockResolvedValue({ docs: matchDocs }),
          };
          return queryMock;
        }
        return {} as any;
      });

      await getHandler("/:id/matches", "get")(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        matches: [
          expect.objectContaining({ id: "qm2", matchNumber: "QM2" }),
          expect.objectContaining({ id: "qm10", opponents: ["200", "400"] }),
        ],
      });
    });

    it("creates a match only after confirming its tournament is active", async () => {
      req.params = { id: "tour1" };
      req.body = {
        matchNumber: "QM1",
        alliance: "red",
        partner: "12345",
        opponents: ["54321"],
        result: "upcoming",
        completed: false,
      };
      const set = vi.fn().mockResolvedValue(undefined);

      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "tournaments") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ exists: true, id: "tour1", data: () => ({ isDeleted: 0 }) }),
            }),
          } as any;
        }
        if (name === "tournament_matches") {
          return { doc: vi.fn().mockReturnValue({ id: "new-match", set }) } as any;
        }
        return {} as any;
      });

      await getHandler("/:id/matches", "post")(req, res, next);

      expect(set).toHaveBeenCalledWith(expect.objectContaining({ tournamentId: "tour1", isDeleted: 0 }));
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        match: expect.objectContaining({ id: "new-match", matchNumber: "QM1" }),
      }));
    });

    it("updates an active match without replacing its identity", async () => {
      req.params = { id: "tour1", matchId: "qm1" };
      req.body = { result: "won", completed: true, scoreSelf: 42 };
      const update = vi.fn().mockResolvedValue(undefined);
      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "tournament_matches") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: "qm1",
                data: () => ({
                  tournamentId: "tour1",
                  matchNumber: "QM1",
                  alliance: "red",
                  partner: "12345",
                  opponents: ["54321"],
                  result: "upcoming",
                  completed: false,
                  isDeleted: 0,
                }),
              }),
              update,
            }),
          } as any;
        }
        return {} as any;
      });

      await getHandler("/:id/matches/:matchId", "put")(req, res, next);

      expect(update).toHaveBeenCalledWith(expect.objectContaining({ result: "won", completed: true }));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        match: expect.objectContaining({ id: "qm1", result: "won", completed: true }),
      }));
    });

    it("soft-archives an active match", async () => {
      req.params = { id: "tour1", matchId: "qm1" };
      const update = vi.fn().mockResolvedValue(undefined);
      vi.mocked(adminDb.collection).mockImplementation((name: string) => {
        if (name === "tournament_matches") {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: "qm1",
                data: () => ({ tournamentId: "tour1", isDeleted: 0 }),
              }),
              update,
            }),
          } as any;
        }
        return {} as any;
      });

      await getHandler("/:id/matches/:matchId", "delete")(req, res, next);

      expect(update).toHaveBeenCalledWith(expect.objectContaining({ isDeleted: 1 }));
      expect(res.json).toHaveBeenCalledWith({ success: true, message: "Match archived successfully" });
    });

    it("validates match create and update payloads", () => {
      expect(createTournamentMatchSchema.safeParse({
        matchNumber: "QM1",
        alliance: "blue",
        partner: "12345",
        opponents: ["54321"],
        result: "upcoming",
        completed: false,
      }).success).toBe(true);
      expect(updateTournamentMatchSchema.safeParse({ result: "won" }).success).toBe(true);
      expect(updateTournamentMatchSchema.safeParse({}).success).toBe(false);
    });
  });
});
