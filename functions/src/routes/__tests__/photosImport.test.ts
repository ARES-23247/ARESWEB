import { describe, it, expect, vi, beforeEach } from "vitest";
import router, { sanitizeImportFilename } from "../photosImport";

const { mockBatchSet, mockBatchUpdate, mockBatchCommit } = vi.hoisted(() => ({
  mockBatchSet: vi.fn(),
  mockBatchUpdate: vi.fn(),
  mockBatchCommit: vi.fn(),
}));

vi.mock("../../lib/firebase-admin", () => {
  const mockDoc = vi.fn().mockImplementation((id: string) => {
    const docRef: any = {
      id,
      set: vi.fn(),
      update: vi.fn(),
      get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ isDeleted: 0 }) }),
    };
    docRef.collection = vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue(docRef),
    });
    return docRef;
  });

  return {
    adminDb: {
      collection: vi.fn().mockReturnValue({
        doc: mockDoc,
      }),
      getAll: vi.fn().mockImplementation((...refs) => {
        return refs.map(ref => ({
          id: ref.id,
          exists: false,
          data: () => null,
        }));
      }),
      batch: vi.fn().mockReturnValue({
        set: mockBatchSet,
        update: mockBatchUpdate,
        commit: mockBatchCommit,
      }),
    },
    adminStorage: {
      bucket: vi.fn().mockReturnValue({
        name: "test-bucket",
        file: vi.fn().mockReturnValue({
          save: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    },
    adminFieldValue: { increment: vi.fn().mockReturnValue("increment") },
  };
});

vi.mock("../../lib/googleAuth", () => ({
  getGooglePhotosAccessToken: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("../../lib/imageImport", () => ({
  validateImageMagicBytes: vi.fn().mockReturnValue({ valid: true, format: "jpg" }),
  sanitizeAlbumName: vi.fn().mockReturnValue("sanitized-album"),
}));

vi.mock("../../lib/photoDerivatives", () => ({
  generatePhotoDerivatives: vi.fn().mockResolvedValue({
    width: 1600,
    height: 900,
    original: { buffer: Buffer.from("sanitized"), width: 1600, height: 900, fileSize: 7 },
    thumbnail: { buffer: Buffer.from("thumb"), width: 480, height: 270, fileSize: 5 },
    medium: { buffer: Buffer.from("medium"), width: 1280, height: 720, fileSize: 6 },
  }),
  storePhotoAssets: vi.fn().mockResolvedValue({
    storagePath: "gallery/original.jpg",
    thumbnailPath: "gallery/thumbnail.webp",
    thumbnailWidth: 480,
    thumbnailHeight: 270,
    thumbnailFileSize: 5,
    mediumPath: "gallery/medium.webp",
    mediumWidth: 1280,
    mediumHeight: 720,
    mediumFileSize: 6,
    width: 1600,
    height: 900,
  }),
  deleteStoredPhotoAssets: vi.fn().mockResolvedValue(undefined),
}));

import { deleteStoredPhotoAssets, storePhotoAssets } from "../../lib/photoDerivatives";

describe("Photos Import Router Backend Endpoints", () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn());
  });

  const getHandler = (path: string, method: string) => {
    const routeLayer = router.stack.find(
      (layer) => layer.route && layer.route.path === path && (layer.route as any).methods[method]
    );
    expect(routeLayer).toBeDefined();
    return routeLayer!.route!.stack[routeLayer!.route!.stack.length - 1].handle;
  };

  it("should have correct middleware validation stack", () => {
    const routeLayer = router.stack.find(
      (layer) => layer.route && layer.route.path === "/import" && (layer.route as any).methods.post
    );
    expect(routeLayer).toBeDefined();
    const middlewareNames = routeLayer!.route!.stack.map((layer) => layer.name);
    expect(middlewareNames).toEqual([
      "ensureAdmin",
      "enforceDistributedQuota",
      expect.any(String),
    ]);
  });

  it("should throw error if items parameter is missing or empty", async () => {
    const handler = getHandler("/import", "post");
    req = { body: { items: [] } };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };

    await expect(handler(req, res)).rejects.toThrow("Choose between 1 and 100 photos");
  });

  it("should successfully download and import photos", async () => {
    const handler = getHandler("/import", "post");
    req = {
      body: {
        items: [
          { id: "photo-1", baseUrl: "https://lh3.googleusercontent.com/abc", filename: "test.png" }
        ],
        albumId: "album-123",
        albumName: "Competition Photos"
      }
    };
    res = {
      json: vi.fn(),
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    } as any);

    await handler(req, res);

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    );

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      imported: 1,
      failed: 0,
    }));
    expect(storePhotoAssets).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ mimeType: "image/jpeg" }),
      expect.stringContaining("gallery/derivatives/"),
      expect.anything(),
    );
    expect(mockBatchSet).toHaveBeenCalledTimes(2);
    expect(mockBatchSet).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ fileSize: 7 }));
    expect(mockBatchUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ mediaCount: "increment" }));
    expect(mockBatchCommit).toHaveBeenCalledOnce();
  });

  it("removes newly stored assets when the atomic metadata batch fails", async () => {
    const handler = getHandler("/import", "post");
    req = {
      body: {
        items: [{ id: "photo-cleanup", baseUrl: "https://lh3.googleusercontent.com/cleanup" }],
      },
    };
    res = { json: vi.fn() };
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    } as Response);
    mockBatchCommit.mockRejectedValueOnce(new Error("Firestore unavailable"));

    await expect(handler(req, res)).rejects.toThrow("Firestore unavailable");
    expect(deleteStoredPhotoAssets).toHaveBeenCalledOnce();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("reports an upstream download failure even when Google returns no readable error body", async () => {
    const handler = getHandler("/import", "post");
    req = {
      body: {
        items: [{
          id: "photo-2",
          mediaFile: { baseUrl: "https://lh3.googleusercontent.com/def" },
        }],
      },
    };
    res = { json: vi.fn() };
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: vi.fn().mockRejectedValue(new Error("unreadable upstream response")),
    } as unknown as Response);

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      imported: 0,
      failed: 1,
      results: [{
        mediaItemId: "photo-2",
        status: "failed",
        filename: "photo-photo-2.jpg",
        error: "Google Photos download failed with status 503: ",
      }],
    });
  });

  it("sanitizes untrusted picker filenames against path traversal and control characters", async () => {
    expect(sanitizeImportFilename("../../evil/dir\\IMG_01\u0000.HEIC", "id-1")).toBe("IMG_01.jpg");
    expect(sanitizeImportFilename("...///...", "id-2")).toBe("photo-id-2.jpg");
    expect(sanitizeImportFilename("robot shot (finals)!.webp", "id-3")).toBe("robot-shot-finals-.jpg");
    expect(sanitizeImportFilename("raw-file-without-ext", "id-4")).toBe("raw-file-without-ext.jpg");
    expect(sanitizeImportFilename(undefined, "id-5")).toBe("photo-id-5.jpg");

    const handler = getHandler("/import", "post");
    req = {
      body: {
        items: [
          {
            id: "photo-safe",
            baseUrl: "https://lh3.googleusercontent.com/safe",
            filename: "../../escape/nested/match photo.HEIC",
          },
        ],
        albumName: "Competition",
      },
    };
    res = { json: vi.fn() };
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    } as Response);

    await handler(req, res);

    expect(storePhotoAssets).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        path: expect.stringMatching(/^gallery\/sanitized-album\/\d{4}-\d{2}-\d{2}\/photo-safe-match-photo\.jpg$/),
      }),
      expect.anything(),
      expect.anything(),
    );
  });
});
