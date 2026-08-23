import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  assetSet,
  createReadStream,
  docGet,
  fileDelete,
  fileGetMetadata,
  fileSave,
  firestoreDoc,
  storageFile,
  streamPipeline,
} = vi.hoisted(() => ({
  assetSet: vi.fn(),
  createReadStream: vi.fn(() => ({ kind: "sponsor-logo-stream" })),
  docGet: vi.fn(),
  fileDelete: vi.fn(),
  fileGetMetadata: vi.fn(),
  fileSave: vi.fn(),
  firestoreDoc: vi.fn(),
  storageFile: vi.fn(),
  streamPipeline: vi.fn(),
}));

vi.mock("../../lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: firestoreDoc,
    })),
  },
  adminStorage: {
    bucket: vi.fn(() => ({
      name: "ares-test.firebasestorage.app",
      file: storageFile,
    })),
  },
}));
vi.mock("node:stream/promises", () => ({ pipeline: streamPipeline }));
vi.mock("../../middleware/auth", () => ({
  ensureAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../../lib/imageImport", () => ({ validateImageMagicBytes: vi.fn() }));
vi.mock("../../lib/photoDerivatives", () => ({
  firebaseStoragePublicUrl: (bucket: string, path: string) =>
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`,
  generatePhotoDerivatives: vi.fn(),
}));

import { validateImageMagicBytes } from "../../lib/imageImport";
import { generatePhotoDerivatives } from "../../lib/photoDerivatives";
import router from "../sponsorLogoUpload";

function routeHandler(path = "/sponsor-logo", method = "post") {
  const layer = router.stack.find(
    (entry) => entry.route?.path === path && entry.route.methods[method],
  );
  expect(layer).toBeDefined();
  return layer!.route!.stack.at(-1)!.handle;
}

function request(body: Buffer, contentType = "image/png") {
  return {
    body,
    user: { uid: "admin-user" },
    get: (name: string) => (name === "Content-Type" ? contentType : undefined),
  };
}

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  };
}

describe("sponsor logo upload route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreDoc.mockReturnValue({ get: docGet, set: assetSet });
    storageFile.mockReturnValue({
      save: fileSave,
      delete: fileDelete,
      getMetadata: fileGetMetadata,
      createReadStream,
    });
    fileSave.mockResolvedValue(undefined);
    fileDelete.mockResolvedValue(undefined);
    assetSet.mockResolvedValue(undefined);
    fileGetMetadata.mockResolvedValue([{ contentType: "image/webp", etag: '"logo-etag"' }]);
    streamPipeline.mockResolvedValue(undefined);
    vi.mocked(validateImageMagicBytes).mockReturnValue({ valid: true, format: "png" });
    vi.mocked(generatePhotoDerivatives).mockResolvedValue({
      width: 1600,
      height: 900,
      original: { buffer: Buffer.from("original"), width: 1600, height: 900, fileSize: 8 },
      thumbnail: { buffer: Buffer.from("thumbnail"), width: 480, height: 270, fileSize: 9 },
      medium: { buffer: Buffer.from("medium"), width: 1280, height: 720, fileSize: 6 },
    });
  });

  it("registers adult authorization and route-level throttling", () => {
    const layer = router.stack.find((entry) => entry.route?.path === "/sponsor-logo");
    expect(layer?.route?.stack.map((entry) => entry.name)).toContain("ensureAdmin");
    expect(layer?.route?.stack).toHaveLength(3);
  });

  it.each([
    [request(Buffer.from("image"), "image/gif"), 400, "JPEG, PNG, or WebP"],
    [request(Buffer.alloc(0)), 400, "Choose a sponsor logo"],
    [request(Buffer.alloc(5 * 1024 * 1024 + 1)), 413, "5 MB or smaller"],
  ])("rejects invalid request %#", async (req, status, message) => {
    await expect(routeHandler()(req, response())).rejects.toMatchObject({
      status,
      message: expect.stringContaining(message),
    });
  });

  it("rejects invalid bytes and declared type mismatches", async () => {
    vi.mocked(validateImageMagicBytes).mockReturnValueOnce({ valid: false, format: "unknown" });
    await expect(routeHandler()(request(Buffer.from("bad")), response())).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("did not contain a valid"),
    });

    vi.mocked(validateImageMagicBytes).mockReturnValueOnce({ valid: true, format: "webp" });
    await expect(routeHandler()(request(Buffer.from("webp")), response())).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("declared image type"),
    });
  });

  it("rejects an image that cannot be decoded", async () => {
    vi.mocked(generatePhotoDerivatives).mockRejectedValueOnce(new Error("decode failed"));
    await expect(routeHandler()(request(Buffer.from("png")), response())).rejects.toMatchObject({
      status: 400,
      message: "The sponsor logo could not be decoded safely.",
    });
    expect(fileSave).not.toHaveBeenCalled();
  });

  it("stores a sanitized WebP and returns a bounded public DTO", async () => {
    const res = response();
    await routeHandler()(request(Buffer.from("png"), "image/png; charset=binary"), res);

    expect(storageFile).toHaveBeenCalledWith(
      expect.stringMatching(/^public-media\/sponsors\/[0-9a-f-]+\.webp$/),
    );
    expect(fileSave).toHaveBeenCalledWith(Buffer.from("medium"), {
      metadata: {
        contentType: "image/webp",
        cacheControl: "public,max-age=31536000,immutable",
        metadata: { purpose: "sponsor-logo" },
      },
      resumable: false,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      logo: {
        assetId: expect.stringMatching(/^[0-9a-f-]+$/),
        previewUrl: expect.stringMatching(/^\/api\/photos\/admin\/sponsor-logo-assets\/[0-9a-f-]+$/),
        width: 1280,
        height: 720,
      },
    });
    expect(assetSet).toHaveBeenCalledWith(expect.objectContaining({
      kind: "sponsor-logo",
      storagePath: expect.stringMatching(/^public-media\/sponsors\/[0-9a-f-]+\.webp$/),
      uploadedByUid: "admin-user",
    }));
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain("admin-user");
  });

  it("removes a partial object when Storage rejects the write", async () => {
    fileSave.mockRejectedValueOnce(new Error("Storage unavailable"));
    await expect(routeHandler()(request(Buffer.from("png")), response())).rejects.toThrow(
      "Storage unavailable",
    );
    expect(fileDelete).toHaveBeenCalledWith({ ignoreNotFound: true });

    fileSave.mockRejectedValueOnce(new Error("Storage unavailable again"));
    fileDelete.mockRejectedValueOnce(new Error("cleanup unavailable"));
    await expect(routeHandler()(request(Buffer.from("png")), response())).rejects.toThrow(
      "Storage unavailable again",
    );
  });

  it("removes the object when the private asset registry write fails", async () => {
    assetSet.mockRejectedValueOnce(new Error("Firestore unavailable"));
    await expect(routeHandler()(request(Buffer.from("png")), response())).rejects.toThrow(
      "Firestore unavailable",
    );
    expect(fileDelete).toHaveBeenCalledWith({ ignoreNotFound: true });
  });

  it("serves only active sponsor logos through the public CDN gateway", async () => {
    docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ isActive: true, isDeleted: 0, logoStoragePath: "public-media/sponsors/logo.webp" }),
    });
    const res = response();
    await routeHandler("/public/sponsor-logo/:sponsorId", "get")(
      { params: { sponsorId: "sp_active" }, headers: {} },
      res,
    );
    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
      "Cache-Control": "public, max-age=300, s-maxage=300, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      ETag: '"logo-etag"',
    }));
    expect(streamPipeline).toHaveBeenCalledWith({ kind: "sponsor-logo-stream" }, res);

    docGet.mockResolvedValueOnce({ exists: true, data: () => ({ isActive: false, isDeleted: 0 }) });
    await expect(routeHandler("/public/sponsor-logo/:sponsorId", "get")(
      { params: { sponsorId: "sp_hidden" }, headers: {} },
      response(),
    )).rejects.toMatchObject({ status: 404 });
  });

  it("serves inactive and staged logos only through administrator routes", async () => {
    docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ isActive: false, isDeleted: 0, logoStoragePath: "public-media/sponsors/inactive.webp" }),
    });
    const adminRes = response();
    await routeHandler("/admin/sponsor-logo/:sponsorId", "get")(
      { params: { sponsorId: "sp_hidden" }, headers: {} },
      adminRes,
    );
    expect(adminRes.set).toHaveBeenCalledWith(expect.objectContaining({
      "Cache-Control": "private, no-store",
    }));

    docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ isActive: false, isDeleted: 1, logoStoragePath: "public-media/sponsors/archived.webp" }),
    });
    await routeHandler("/admin/sponsor-logo/:sponsorId", "get")(
      { params: { sponsorId: "sp_archived" }, headers: {} },
      response(),
    );
    expect(storageFile).toHaveBeenLastCalledWith("public-media/sponsors/archived.webp");

    docGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ kind: "sponsor-logo", storagePath: "public-media/sponsors/staged.webp" }),
    });
    await routeHandler("/admin/sponsor-logo-assets/:assetId", "get")(
      { params: { assetId: "123e4567-e89b-42d3-a456-426614174000" }, headers: {} },
      response(),
    );
    expect(storageFile).toHaveBeenLastCalledWith("public-media/sponsors/staged.webp");
  });
});
