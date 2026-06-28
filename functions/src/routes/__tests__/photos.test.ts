import { describe, it, expect, vi, beforeEach } from "vitest";
import photosRouter from "../photos";
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

  const mockWhere = vi.fn().mockReturnValue({
    get: mockGet,
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    startAfter: vi.fn().mockReturnThis(),
  });

  const mockCollection = vi.fn().mockReturnValue({
    doc: mockDoc,
    where: mockWhere,
    get: mockGet,
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  });

  return {
    default: {
      firestore: {
        FieldValue: {
          increment: vi.fn(),
        }
      }
    },
    adminDb: {
      collection: mockCollection,
    },
    adminAuth: {}
  };
});

describe("Photos Router Backend Endpoints", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: {},
      body: {},
      query: {},
      user: { uid: "test_uid", email: "test@aresfirst.org" },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  const getHandler = (path: string, method: string) => {
    const routeLayer = photosRouter.stack.find(
      (layer) => layer.route && layer.route.path === path && (layer.route as any).methods[method]
    );
    expect(routeLayer).toBeDefined();
    const stack = routeLayer!.route!.stack;
    return stack[stack.length - 1].handle;
  };

  describe("GET /api/photos - Get imported photos", () => {
    it("should fetch imported photos for team members", async () => {
      const mockDocs = [
        {
          id: "photo1",
          data: () => ({
            albumId: "albumA",
            url: "https://photos.google.com/p1",
            importedAt: "2026-06-27T00:00:00Z"
          }),
        },
      ];

      const mockCollection = adminDb.collection as any;
      const mockQuery = mockCollection();
      mockQuery.orderBy.mockReturnThis();
      mockQuery.limit.mockReturnThis();
      mockQuery.get.mockResolvedValue({ docs: mockDocs });

      const handler = getHandler("/", "get");
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          photos: [
            expect.objectContaining({
              id: "photo1",
              albumId: "albumA"
            })
          ],
          hasMore: false
        })
      );
    });
  });

  describe("GET /api/photos/public - Get public photos", () => {
    it("should fetch public photos based on public albums", async () => {
      const mockAlbums = [
        {
          id: "albumPublic",
          data: () => ({ isPublic: true })
        }
      ];
      const mockPhotos = [
        {
          id: "photoPublic",
          data: () => ({
            albumId: "albumPublic",
            url: "https://photos.google.com/pPublic",
            importedAt: "2026-06-27T00:00:00Z"
          })
        }
      ];

      const mockCollection = adminDb.collection as any;
      const mockWhere = mockCollection().where;
      
      mockWhere.mockReturnValueOnce({
        get: vi.fn().mockResolvedValue({ docs: mockAlbums })
      }).mockReturnValueOnce({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ docs: mockPhotos })
          })
        })
      });

      const handler = getHandler("/public", "get");
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          photos: [
            expect.objectContaining({
              id: "photoPublic",
              albumId: "albumPublic"
            })
          ]
        })
      );
    });

    it("should return empty array if no public albums exist", async () => {
      const mockCollection = adminDb.collection as any;
      const mockWhere = mockCollection().where;
      mockWhere.mockReturnValueOnce({
        get: vi.fn().mockResolvedValue({ docs: [] })
      });

      const handler = getHandler("/public", "get");
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        photos: [],
        hasMore: false,
        nextCursor: null
      });
    });
  });
});
