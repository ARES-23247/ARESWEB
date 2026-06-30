import { describe, it, expect, vi, beforeEach } from "vitest";
import router from "../photosImport";

vi.mock("../../lib/firebase-admin", () => {
  const mockDoc = vi.fn().mockImplementation(() => {
    const docRef: any = {
      set: vi.fn(),
      update: vi.fn(),
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
        set: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
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
    default: {
      firestore: {
        FieldValue: {
          increment: vi.fn().mockReturnValue("increment"),
        },
      },
    },
  };
});

vi.mock("../../lib/googleAuth", () => ({
  getGooglePhotosAccessToken: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("../../lib/imageImport", () => ({
  validateImageMagicBytes: vi.fn().mockReturnValue({ valid: true }),
  sanitizeAlbumName: vi.fn().mockReturnValue("sanitized-album"),
}));

describe("Photos Import Router Backend Endpoints", () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(middlewareNames).toContain("ensureAdmin");
  });

  it("should throw error if items parameter is missing or empty", async () => {
    const handler = getHandler("/import", "post");
    req = { body: { items: [] } };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };

    await expect(handler(req, res)).rejects.toThrow("No items provided for import");
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

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      imported: 1,
      failed: 0,
    }));
  });
});