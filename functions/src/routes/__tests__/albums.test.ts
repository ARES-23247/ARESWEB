import { describe, it, expect, vi, beforeEach } from "vitest";
import albumsRouter from "../albums";
import { adminDb } from "../../lib/firebase-admin";

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("../../lib/firebase-admin", () => {
  const mockAlbumsCollection = {
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({
      docs: [
        { id: "album-1", data: () => ({ title: "Album 1", category: "Competition" }) }
      ]
    }),
    doc: vi.fn(() => ({
      get: mockGet,
      set: mockSet,
      update: mockUpdate,
      delete: mockDelete,
      collection: vi.fn(() => ({
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] })
      }))
    }))
  };

  const mockPhotosCollection = {
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
    doc: vi.fn(() => ({
      get: mockGet,
    }))
  };

  return {
    adminDb: {
      collection: vi.fn((name) => {
        if (name === "albums") return mockAlbumsCollection;
        return mockPhotosCollection;
      }),
      batch: vi.fn(() => ({
        update: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(true)
      }))
    },
    default: {
      firestore: {
        FieldValue: {
          increment: vi.fn((val) => val)
        }
      }
    }
  };
});

vi.mock("../../middleware/auth", () => ({
  ensureAdmin: (req: any, res: any, next: any) => next(),
  ensureTeamMember: (req: any, res: any, next: any) => next(),
}));

describe("Albums Router Backend Endpoints", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      params: {},
      body: {},
      query: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  const getHandler = (path: string, method: string) => {
    const routeLayer = albumsRouter.stack.find(
      (layer) => layer.route && layer.route.path === path && (layer.route as any).methods[method]
    );
    expect(routeLayer).toBeDefined();
    const stack = routeLayer!.route!.stack;
    return stack[stack.length - 1].handle;
  };

  describe("GET /api/photos/albums", () => {
    it("should fetch albums successfully", async () => {
      const handler = getHandler("/", "get");
      await handler(req, res, next);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          albums: expect.any(Array)
        })
      );
    });
  });

  describe("POST /api/photos/albums", () => {
    it("should fail if title or category is missing", async () => {
      req.body = { description: "Cool album" };
      const handler = getHandler("/", "post");
      await handler(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(400);
      expect(err.message).toContain("Missing required fields");
    });

    it("should create new album if arguments are valid", async () => {
      mockGet.mockResolvedValue({ exists: false });
      req.body = {
        title: "WV State 2026",
        category: "Competition",
        description: "Matches and pit photos"
      };
      const handler = getHandler("/", "post");
      await handler(req, res, next);
      expect(mockSet).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          album: expect.objectContaining({
            id: "wv-state-2026",
            title: "WV State 2026"
          })
        })
      );
    });
  });

  describe("PATCH /api/photos/albums/:albumId", () => {
    it("should update album details successfully", async () => {
      req.params = { albumId: "wv-state-2026" };
      req.body = { description: "Updated description" };
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({ title: "WV State 2026", category: "Competition", description: "old description" })
      });
      const handler = getHandler("/:albumId", "patch");
      await handler(req, res, next);
      expect(mockSet).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          album: expect.objectContaining({
            description: "Updated description"
          })
        })
      );
    });
  });

  describe("DELETE /api/photos/albums/:albumId", () => {
    it("should delete album successfully", async () => {
      req.params = { albumId: "wv-state-2026" };
      mockGet.mockResolvedValue({ exists: true });
      const handler = getHandler("/:albumId", "delete");
      await handler(req, res, next);
      expect(mockDelete).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true
        })
      );
    });
  });
});
