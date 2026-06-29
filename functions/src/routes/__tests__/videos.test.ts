import { describe, it, expect, vi, beforeEach } from "vitest";
import videosRouter, { videosLimiter } from "../videos";
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
  };
});

describe("Videos Router Backend Endpoints", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: {},
      body: {},
      query: {},
      user: { uid: "test_user_id", email: "admin@aresfirst.org" },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    delete process.env.YOUTUBE_API_KEY;
  });

  const getHandler = (path: string, method: string) => {
    const routeLayer = videosRouter.stack.find(
      (layer) => layer.route && layer.route.path === path && (layer.route as any).methods[method]
    );
    expect(routeLayer).toBeDefined();
    const stack = routeLayer!.route!.stack;
    return stack[stack.length - 1].handle;
  };

  describe("Rate Limiter Presence", () => {
    it("should have rate limiter middleware registered", () => {
      const firstLayer = videosRouter.stack[0];
      expect(firstLayer).toBeDefined();
      expect(firstLayer.handle).toBe(videosLimiter);
    });
  });

  describe("POST /api/videos/sync", () => {
    it("should fail with 401 if req.user is missing", async () => {
      req.user = undefined;
      const handler = getHandler("/sync", "post");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(401);
      expect(err.message).toBe("Unauthorized");
    });

    it("should fail with 403 if user doc does not exist", async () => {
      const mockCollection = adminDb.collection as any;
      mockCollection().doc().get.mockResolvedValue({ exists: false });

      const handler = getHandler("/sync", "post");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(403);
      expect(err.message).toBe("Forbidden: User not authorized");
    });

    it("should fail with 403 if user role is not admin, coach, or mentor", async () => {
      const mockCollection = adminDb.collection as any;
      mockCollection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({ role: "student" }),
      });

      const handler = getHandler("/sync", "post");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(403);
      expect(err.message).toBe("Forbidden: Insufficient privileges");
    });

    it("should fail with 400 if YouTube API key is not configured anywhere", async () => {
      const mockCollection = adminDb.collection as any;
      
      mockCollection().doc.mockImplementation((path: string) => {
        if (path === "test_user_id") {
          return {
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({ role: "admin" }),
            }),
          };
        }
        if (path === "YOUTUBE_API_KEY") {
          return {
            get: vi.fn().mockResolvedValue({
              exists: false,
            }),
          };
        }
        return {
          get: vi.fn().mockResolvedValue({ exists: false }),
        };
      });

      const handler = getHandler("/sync", "post");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(400);
      expect(err.message).toBe("YouTube API key is not configured in settings");
    });

    it("should successfully sync videos, add new ones, and prune deleted ones", async () => {
      const mockCollection = adminDb.collection as any;
      
      // Mock user role
      const mockUserDoc = {
        exists: true,
        data: () => ({ role: "coach" }),
      };
      // Mock settings API key
      const mockSettingsDoc = {
        exists: true,
        data: () => ({ value: "test-db-api-key" }),
      };

      // Existing videos in DB: video_1 and video_3 (video_3 is no longer in playlist and should be deleted)
      const mockExistingVideoDocs = [
        {
          id: "video_1",
          data: () => ({
            videoId: "1",
            platform: "youtube",
          }),
        },
        {
          id: "video_3",
          data: () => ({
            videoId: "3",
            platform: "youtube",
          }),
        },
      ];

      const mockDocGet = vi.fn().mockImplementation(async () => {
        return { exists: false };
      });

      const mockDocSet = vi.fn().mockResolvedValue(undefined);
      const mockDocDelete = vi.fn().mockResolvedValue(undefined);

      mockCollection().doc.mockImplementation((path: string) => {
        if (path === "test_user_id") {
          return { get: vi.fn().mockResolvedValue(mockUserDoc) };
        }
        if (path === "YOUTUBE_API_KEY") {
          return { get: vi.fn().mockResolvedValue(mockSettingsDoc) };
        }
        return {
          get: mockDocGet,
          set: mockDocSet,
          delete: mockDocDelete,
        };
      });

      // Mock where query for existing videos
      const queryMock = {
        get: vi.fn().mockResolvedValue({ docs: mockExistingVideoDocs }),
      };
      mockCollection().where.mockReturnValue(queryMock);

      // Mock YouTube API response with video_1 and video_2 (video_2 is a short)
      const mockYoutubeResponse = {
        items: [
          {
            snippet: {
              title: "Regular Video 1",
              description: "Cool robot run",
              publishedAt: "2026-01-01T00:00:00Z",
              resourceId: { videoId: "1" },
              thumbnails: {
                high: { url: "https://yt.com/1.jpg" },
              },
            },
          },
          {
            snippet: {
              title: "Shorts Video 2 #shorts",
              description: "Fast calibration",
              publishedAt: "2026-02-01T00:00:00Z",
              resourceId: { videoId: "2" },
              thumbnails: {
                default: { url: "https://yt.com/2.jpg" },
              },
            },
          },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockYoutubeResponse),
      } as any);

      const handler = getHandler("/sync", "post");
      await handler(req, res, next);

      // Verify YouTube API fetch call
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("key=test-db-api-key")
      );

      // Verify video 1 write
      expect(mockCollection().doc).toHaveBeenCalledWith("video_1");
      expect(mockDocSet).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Regular Video 1",
          videoId: "1",
          platform: "youtube",
          thumbnailUrl: "https://yt.com/1.jpg",
          embedUrl: "https://www.youtube.com/embed/1",
          type: "video",
          createdAt: "2026-01-01T00:00:00Z",
        }),
        { merge: true }
      );

      // Verify video 2 write
      expect(mockCollection().doc).toHaveBeenCalledWith("video_2");
      expect(mockDocSet).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Shorts Video 2 #shorts",
          videoId: "2",
          platform: "youtube",
          thumbnailUrl: "https://yt.com/2.jpg",
          embedUrl: "https://www.youtube.com/embed/2",
          type: "short",
          createdAt: "2026-02-01T00:00:00Z",
        }),
        { merge: true }
      );

      // Verify video 3 delete
      expect(mockCollection().doc).toHaveBeenCalledWith("video_3");
      expect(mockDocDelete).toHaveBeenCalled();

      // Verify JSON response
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        addedUpdatedCount: 2,
        deletedCount: 1,
      });
    });

    it("should fall back to process.env.YOUTUBE_API_KEY if settings collection is empty", async () => {
      process.env.YOUTUBE_API_KEY = "test-env-api-key";

      const mockCollection = adminDb.collection as any;
      mockCollection().doc.mockImplementation((path: string) => {
        if (path === "test_user_id") {
          return {
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({ role: "mentor" }),
            }),
          };
        }
        if (path === "YOUTUBE_API_KEY") {
          return {
            get: vi.fn().mockResolvedValue({ exists: false }),
          };
        }
        return {
          get: vi.fn().mockResolvedValue({ exists: false }),
          set: vi.fn().mockResolvedValue(undefined),
        };
      });

      const queryMock = {
        get: vi.fn().mockResolvedValue({ docs: [] }),
      };
      mockCollection().where.mockReturnValue(queryMock);

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ items: [] }),
      } as any);

      const handler = getHandler("/sync", "post");
      await handler(req, res, next);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("key=test-env-api-key")
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        addedUpdatedCount: 0,
        deletedCount: 0,
      });
    });

    it("should bubble API response failure correctly", async () => {
      const mockCollection = adminDb.collection as any;
      mockCollection().doc.mockImplementation((path: string) => {
        if (path === "test_user_id") {
          return {
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({ role: "admin" }),
            }),
          };
        }
        if (path === "YOUTUBE_API_KEY") {
          return {
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({ value: "valid-key" }),
            }),
          };
        }
        return { get: vi.fn().mockResolvedValue({ exists: false }) };
      });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: vi.fn().mockResolvedValue("API key expired or invalid"),
      } as any);

      const handler = getHandler("/sync", "post");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(400);
      expect(err.message).toContain("YouTube API error: Forbidden");
    });
  });
});
