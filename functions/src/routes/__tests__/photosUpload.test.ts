import { describe, it, expect, vi, beforeEach } from "vitest";
import router from "../photosUpload";
import { adminDb } from "../../lib/firebase-admin";

vi.mock("../../lib/firebase-admin", () => {
  const mockGet = vi.fn();
  const mockLimit = vi.fn();
  const mockWhere = vi.fn();

  const queryMock: any = {
    get: mockGet,
    where: mockWhere,
    limit: mockLimit,
  };

  mockLimit.mockImplementation(() => queryMock);
  mockWhere.mockImplementation(() => queryMock);

  const mockDoc = vi.fn().mockReturnValue({
    get: mockGet,
    set: vi.fn(),
    update: vi.fn(),
  });

  const mockCollection = vi.fn().mockReturnValue({
    doc: mockDoc,
    where: mockWhere,
    limit: mockLimit,
    get: mockGet,
  });

  return {
    adminDb: {
      collection: mockCollection,
    },
    adminStorage: {
      bucket: vi.fn().mockReturnValue({
        name: "test-bucket",
        file: vi.fn().mockReturnValue({
          save: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    },
  };
});

vi.mock("../../lib/googleAuth", () => ({
  getGooglePhotosAccessToken: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("../../lib/imageImport", () => ({
  validateImageMagicBytes: vi.fn().mockReturnValue({ valid: true }),
}));

vi.mock("../../lib/vertex", () => ({
  generatePhotoCaptionAndLabels: vi.fn().mockResolvedValue({
    caption: "AI generated caption",
    labels: ["tag1", "tag2"],
  }),
}));

describe("Photos Upload Router Backend Endpoints", () => {
  let req: any;
  let res: any;
  let mockGet: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    mockGet = vi.mocked(adminDb.collection("").get);
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
      (layer) => layer.route && layer.route.path === "/upload-unified" && (layer.route as any).methods.post
    );
    expect(routeLayer).toBeDefined();
    const middlewareNames = routeLayer!.route!.stack.map((layer) => layer.name);
    expect(middlewareNames).toContain("ensureTeamMember");
  });

  it("should throw error if required body fields are missing", async () => {
    const handler = getHandler("/upload-unified", "post");
    req = { body: {} };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };

    await expect(handler(req, res)).rejects.toThrow("Missing required fields");
  });

  it("should successfully upload a new photo and run AI labeling", async () => {
    const handler = getHandler("/upload-unified", "post");
    
    mockGet.mockResolvedValueOnce({ empty: true });

    req = {
      body: {
        fileBase64: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]).toString("base64"),
        filename: "robot.jpg",
        mimeType: "image/jpeg",
        runAiLabeling: true,
      }
    };
    res = {
      json: vi.fn(),
    };

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      photo: expect.objectContaining({
        originalFilename: "robot.jpg",
        caption: "AI generated caption",
        labels: ["tag1", "tag2"],
      })
    }));
  });

  it("should return cached photo if SHA-256 hash matches", async () => {
    const handler = getHandler("/upload-unified", "post");
    
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{
        id: "existing-photo-id",
        data: () => ({
          originalFilename: "cached-robot.jpg",
          publicUrl: "https://cached-url",
          sha256: "some-hash",
        }),
        ref: {
          id: "existing-photo-id"
        }
      }]
    });

    req = {
      body: {
        fileBase64: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]).toString("base64"),
        filename: "robot.jpg",
        mimeType: "image/jpeg",
      }
    };
    res = {
      json: vi.fn(),
    };

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      cached: true,
      photo: expect.objectContaining({
        id: "existing-photo-id",
        originalFilename: "cached-robot.jpg",
      })
    }));
  });
});