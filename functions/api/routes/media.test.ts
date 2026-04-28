
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";

// Mock external utilities
vi.mock("../../utils/socialSync", () => ({
  dispatchPhotoSocials: vi.fn().mockResolvedValue(true)
}));

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    getDbSettings: vi.fn().mockResolvedValue({}),
    ensureAdmin: async (c: any, next: any) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "1", role: "admin", email: "admin@test.com" }),
    logAuditAction: vi.fn().mockResolvedValue(true),
    rateLimitMiddleware: () => async (c: any, next: any) => next(),
    checkRateLimit: vi.fn().mockReturnValue(true),
  };
});

vi.mock("../../utils/zulipSync", () => ({
  sendZulipAlert: vi.fn().mockResolvedValue(true),
}));

import mediaRouter from "./media/index";

describe("Hono Backend - /media Router", () => {
  let mockR2: any;
  let mockDb: any;
  let testApp: Hono<any>;
  let env: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockR2 = {
      list: vi.fn().mockResolvedValue({ objects: [], truncated: false }),
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(true),
    };

    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn((cb) => {
        const oc = {
          columns: vi.fn().mockReturnThis(),
          doUpdateSet: vi.fn().mockReturnThis(),
          execute: vi.fn().mockResolvedValue([]),
        };
        if (typeof cb === 'function') cb(oc);
        return oc;
      }),
      doUpdateSet: vi.fn().mockReturnThis(),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      deleteFrom: vi.fn().mockReturnThis(),
      getExecutor: vi.fn().mockReturnValue({
        compileQuery: vi.fn().mockReturnValue({ sql: "", parameters: [], query: { kind: "RawNode" } }),
        executeQuery: vi.fn().mockResolvedValue({ rows: [] }),
        transformQuery: vi.fn((q) => q),
      }),
    };

    env = {
      ARES_STORAGE: mockR2,
      DB: {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      },
      AI: { run: vi.fn().mockResolvedValue({ description: "Mocked Description" }) },
      DEV_BYPASS: "true",
      ENVIRONMENT: "test",
    };

    testApp = new Hono<any>();
    testApp.use("*", async (c: any, next: any) => {
      c.set("db", mockDb);
      c.set("sessionUser", { id: "1", role: "admin", email: "admin@test.com" });
      await next();
    });
    testApp.route("/", mediaRouter);

    vi.stubGlobal("caches", {
      default: {
        match: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(true),
      }
    });
  });

  it("GET / - list public gallery media", async () => {
    mockR2.list.mockResolvedValue({ objects: [{ key: "Gallery/img1.png", size: 100, uploaded: new Date(), httpEtag: "etag" }], truncated: false });
    mockDb.execute.mockResolvedValueOnce([{ key: "Gallery/img1.png", folder: "Gallery", tags: "test" }]);

    const res = await testApp.request("/", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /admin - list all media for admin", async () => {
    mockR2.list.mockResolvedValue({ objects: [{ key: "Library/doc1.pdf", size: 500, uploaded: new Date(), httpEtag: "etag" }], truncated: false });
    env.DB.prepare().all.mockResolvedValue({ results: [{ key: "Library/doc1.pdf", folder: "Library", tags: "test doc" }] });

    const res = await testApp.request("/admin", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.media).toHaveLength(1);
    expect(body.media[0].folder).toBe("Library");
  });

  it("DELETE /admin/:key - delete asset", async () => {
    const res = await testApp.request("/admin/img1.png", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PUT /admin/move/:key - move asset", async () => {
    mockR2.get.mockResolvedValue({ body: "data", httpMetadata: { contentType: "image/png" } });
    
    const res = await testApp.request("/admin/move/img1.png", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: "Archive" })
    }, env, mockExecutionContext);
    
    expect(res.status).toBe(200);
    expect(mockR2.put).toHaveBeenCalledWith("Archive/img1.png", "data", expect.any(Object));
    expect(mockR2.delete).toHaveBeenCalledWith("img1.png");
  });

  it("POST /admin/syndicate - syndicates media", async () => {
    const { dispatchPhotoSocials } = await import("../../utils/socialSync");
    const res = await testApp.request("/admin/syndicate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "Gallery/img1.png", caption: "Test post" })
    }, env, mockExecutionContext);
    
    expect(res.status).toBe(200);
    expect(dispatchPhotoSocials).toHaveBeenCalled();
  });

  it("POST /admin/upload - upload file (direct handler)", async () => {
    const { mediaHandlers } = await import("./media/handlers");
    mockR2.put.mockResolvedValue(undefined);

    const fileBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // Valid PNG header
    const file = new File([fileBytes], "test.png", { type: "image/png" });
    const mockFormData = { file, folder: "Gallery" };
    const mockC = { env, req: { url: "http://localhost/api/media/admin/upload", header: vi.fn().mockReturnValue("127.0.0.1") }, executionCtx: mockExecutionContext };

    const res = await (mediaHandlers.upload as any)({ body: mockFormData }, mockC);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockR2.put).toHaveBeenCalled();
  });

  it("POST /admin/upload - upload HEIC file", async () => {
    const { mediaHandlers } = await import("./media/handlers");
    const heicBytes = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
    const file = new File([heicBytes], "test.heic", { type: "image/heic" });
    const mockFormData = { file, folder: "Gallery" };
    const mockC = { env, req: { url: "http://localhost/api/media/admin/upload", header: vi.fn() }, executionCtx: mockExecutionContext };

    const res = await (mediaHandlers.upload as any)({ body: mockFormData }, mockC);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("POST /admin/upload - invalid magic bytes", async () => {
    const { mediaHandlers } = await import("./media/handlers");
    const invalidBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const file = new File([invalidBytes], "test.txt", { type: "text/plain" });
    const mockFormData = { file };
    const mockC = { env, req: { url: "http://localhost/api/media/admin/upload", header: vi.fn() } };

    const res = await (mediaHandlers.upload as any)({ body: mockFormData }, mockC);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid file type");
  });

  it("POST /admin/upload - large file (>10MB)", async () => {
    const { mediaHandlers } = await import("./media/handlers");
    const largeContent = new Uint8Array(11 * 1024 * 1024);
    largeContent.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    const file = new File([largeContent], "large.png", { type: "image/png" });
    if (!file.stream) {
      (file as any).stream = () => {
        return { getReader: () => ({ read: () => Promise.resolve({ done: true, value: undefined }) }) };
      };
    }
    const mockFormData = { file };
    const mockC = { env, req: { url: "http://localhost/api/media/admin/upload", header: vi.fn() }, executionCtx: mockExecutionContext };

    const res = await (mediaHandlers.upload as any)({ body: mockFormData }, mockC);
    expect(res.status).toBe(200);
  });

  it("POST /admin/upload - AI failure scenario", async () => {
    const { mediaHandlers } = await import("./media/handlers");
    env.AI.run.mockRejectedValue(new Error("AI Down"));
    const fileBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const file = new File([fileBytes], "test.png", { type: "image/png" });
    const mockFormData = { file };
    const mockC = { env, req: { url: "http://localhost/api/media/admin/upload", header: vi.fn() }, executionCtx: mockExecutionContext };

    const res = await (mediaHandlers.upload as any)({ body: mockFormData }, mockC);
    expect(res.status).toBe(200);
    expect(res.body.altText).toBe("ARES 23247 Team Media Image");
  });

  it("PUT /admin/move/:key - R2 move failure", async () => {
    const { mediaHandlers } = await import("./media/handlers");
    mockR2.get.mockRejectedValue(new Error("R2 Get Failed"));
    const mockC = { env, req: { url: "http://localhost/api/media/admin/move/test.png", header: vi.fn() } };

    const res = await (mediaHandlers.move as any)({ params: { key: "test.png" }, body: { folder: "Archive" } }, mockC);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Move failed");
  });

  it("DELETE /admin/:key - R2 delete failure", async () => {
    const { mediaHandlers } = await import("./media/handlers");
    mockR2.delete.mockRejectedValue(new Error("R2 Delete Failed"));
    const mockC = { env, req: { url: "http://localhost/api/media/admin/test.png", header: vi.fn() } };

    const res = await (mediaHandlers.delete as any)({ params: { key: "test.png" } }, mockC);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Delete failed");
  });

  it("POST /admin/syndicate - failure", async () => {
    const { mediaHandlers } = await import("./media/handlers");
    const mockC = { env, req: { url: "invalid url", header: vi.fn() }, executionCtx: mockExecutionContext };
    const res = await (mediaHandlers.syndicate as any)({ body: { key: "test.png" } }, mockC);
    expect(res.status).toBe(500);
  });

  it("POST /admin/upload - failure", async () => {
    const { mediaHandlers } = await import("./media/handlers");
    const fileBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const file = new File([fileBytes], "test.png", { type: "image/png" });
    const mockFormData = { file };
    const mockC = { env: { ...env, DB: null }, req: { url: "http://localhost/api/media/admin/upload", header: vi.fn() }, executionCtx: mockExecutionContext };
    const res = await (mediaHandlers.upload as any)({ body: mockFormData }, mockC);
    expect(res.status).toBe(500);
  });

  it("PUT /admin/move/:key - without R2", async () => {
    const { mediaHandlers } = await import("./media/handlers");
    const mockC = { env: { ...env, ARES_STORAGE: null }, req: { url: "http://localhost/api/media/admin/move/test.png", header: vi.fn() }, executionCtx: mockExecutionContext };
    const res = await (mediaHandlers.move as any)({ params: { key: "test.png" }, body: { folder: "Archive" } }, mockC);
    expect(res.status).toBe(200);
  });

  it("GET /:key - not found", async () => {
    mockR2.get.mockResolvedValue(null);
    const res = await testApp.request("/Gallery/missing.png", {}, env, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("GET /admin - without R2", async () => {
    const res = await testApp.request("/admin", {}, { ...env, ARES_STORAGE: null }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET / - without R2", async () => {
    const res = await testApp.request("/", {}, { ...env, ARES_STORAGE: null }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET / - rate limited", async () => {
    const { checkRateLimit } = await import("../middleware");
    (checkRateLimit as any).mockReturnValueOnce(false);
    const mockC = { env, req: { url: "http://localhost/api/media", header: vi.fn().mockReturnValue("127.0.0.1") } };
    const { mediaHandlers } = await import("./media/handlers");
    const res = await (mediaHandlers.getMedia as any)({}, mockC);
    expect(res.status).toBe(429);
  });

  it("GET /admin - database failure", async () => {
    const mockDbFail = { prepare: vi.fn().mockReturnValue({ all: vi.fn().mockRejectedValue(new Error("DB Error")) }) };
    const mockC = { env: { ...env, DB: mockDbFail }, req: { url: "http://localhost/api/media/admin", header: vi.fn().mockReturnValue("admin") } };
    const { mediaHandlers } = await import("./media/handlers");
    const res = await (mediaHandlers.adminList as any)({}, mockC);
    expect(res.status).toBe(500);
  });

  it("GET /:key - object without body", async () => {
    mockR2.get.mockResolvedValue({ body: null, writeHttpMetadata: vi.fn() });
    const res = await testApp.request("/Gallery/empty.png", {}, env, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("isValidImage - JPEG, GIF, WEBP, PNG, HEIC, and Invalid", async () => {
    const { isValidImage } = await import("./media/handlers");
    expect(isValidImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer)).toBe(true);
    expect(isValidImage(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]).buffer)).toBe(true);
    expect(isValidImage(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]).buffer)).toBe(true);
    expect(isValidImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBe(true);
    expect(isValidImage(new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00]).buffer)).toBe(true);
    expect(isValidImage(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f]).buffer)).toBe(false);
  });

  it("GET / admin - paginated list", async () => {
    mockR2.list
      .mockResolvedValueOnce({ objects: [{ key: "1.png", size: 100, uploaded: new Date(), httpEtag: "e1" }], truncated: true, cursor: "c1" })
      .mockResolvedValueOnce({ objects: [{ key: "2.png", size: 200, uploaded: new Date(), httpEtag: "e2" }], truncated: false });
    
    const res = await testApp.request("/admin", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET / - filter non-public objects", async () => {
    mockR2.list.mockResolvedValue({ objects: [{ key: "Public.png", size: 100, uploaded: new Date() }, { key: "Private.png", size: 100, uploaded: new Date() }], truncated: false });
    const mockDb = { prepare: vi.fn().mockReturnValue({ all: vi.fn().mockResolvedValue({ results: [{ key: "Public.png", folder: "Gallery", tags: "" }] }) }) };
    const { mediaHandlers } = await import("./media/handlers");
    const res = await (mediaHandlers.getMedia as any)({}, { env: { ...env, DB: mockDb }, req: { url: "http://localhost/", header: vi.fn().mockReturnValue("1.2.3.4") } });
    expect(res.body.media).toHaveLength(1);
  });

  it("GET /:key - private object cache control", async () => {
    const { getSessionUser } = await import("../middleware");
    (getSessionUser as any).mockResolvedValueOnce({ id: "1", role: "admin" });
    mockR2.get.mockResolvedValue({ body: "data", httpMetadata: { contentType: "image/png" }, writeHttpMetadata: (h: Headers) => h.set("Content-Type", "image/png") });
    const res = await testApp.request("/Archive/secret.png", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
  });

  it("GET / - internal failure", async () => {
    const { mediaHandlers } = await import("./media/handlers");
    const mockDbFail = { prepare: vi.fn().mockImplementation(() => { throw new Error("DB Error"); }) };
    const res = await (mediaHandlers.getMedia as any)({}, { env: { ...env, DB: mockDbFail }, req: { url: "http://localhost/", header: vi.fn() } });
    expect(res.status).toBe(500);
  });

  it("GET /:key - unauthorized", async () => {
    const { getSessionUser } = await import("../middleware");
    (getSessionUser as any).mockResolvedValueOnce(null);
    const res = await testApp.request("/Private/secret.png", {}, env, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("GET /:key - internal error", async () => {
    mockR2.get.mockRejectedValue(new Error("R2 Error"));
    const res = await testApp.request("/Gallery/error.png", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /:key - serves raw object", async () => {
    mockR2.get.mockResolvedValue({ body: "data", httpMetadata: { contentType: "image/png" }, writeHttpMetadata: vi.fn((headers) => headers.set("Content-Type", "image/png")) });
    const res = await testApp.request("/Gallery/img1.png", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });
});
