/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAPI handler input validated by Zod schemas */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Context } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";
import { TestEnv, DrizzleMock } from "../../../src/test/types";

interface _MediaResponse {
  success?: boolean;
  media?: unknown[];
  error?: string;
  altText?: string;
  [key: string]: unknown;
}

type HandlerResponse = Response & {
  body?: { success?: boolean; error?: string; altText?: string; media?: unknown[] };
};

interface MockContext {
  get: ReturnType<typeof vi.fn>;
  env: TestEnvWithStorage;
  req: { url: string; header: ReturnType<typeof vi.fn> };
  executionCtx?: typeof mockExecutionContext;
}

// Mock external utilities
vi.mock("../../utils/socialSync", () => ({
  dispatchPhotoSocials: vi.fn().mockResolvedValue(true)
}));

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    getDbSettings: vi.fn().mockResolvedValue({}),
    ensureAdmin: async (c: Context<TestEnv>, next: () => Promise<void>) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "1", role: "admin", email: "admin@test.com" }),
    logAuditAction: vi.fn().mockResolvedValue(true),
    rateLimitMiddleware: () => async (c: Context<TestEnv>, next: () => Promise<void>) => next(),
    checkPersistentRateLimit: vi.fn().mockResolvedValue(true),
  };
});

vi.mock("../../utils/zulipSync", () => ({
  sendZulipAlert: vi.fn(),
}));

import mediaRouter from "./media/index";
import { createDrizzleProxy } from "../../../src/test/utils";
// import type { DrizzleProxy } from "../../../src/test/mocks";

interface MockR2 {
  list: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

type TestEnvWithStorage = TestEnv["Bindings"] & {
  ARES_STORAGE: MockR2;
  AI: { run: ReturnType<typeof vi.fn> };
};

describe("Hono Backend - /media Router", () => {
  let mockR2: MockR2;
  let mockDb: DrizzleMock;
  let testApp: Hono<TestEnv>;
  let env: TestEnvWithStorage;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Set default behavior for sendZulipAlert mock
    const { sendZulipAlert } = await import("../../utils/zulipSync");
    vi.mocked(sendZulipAlert).mockResolvedValue(true as never);

    mockR2 = {
      list: vi.fn().mockResolvedValue({ objects: [], truncated: false }),
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(true),
    };

    mockDb = {
      select: vi.fn().mockReturnThis(),
      selectDistinct: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      onConflictDoNothing: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      having: vi.fn().mockReturnThis(),
      then: vi.fn().mockResolvedValue([]),
      batch: vi.fn().mockResolvedValue([]),
      transaction: vi.fn().mockImplementation(async (cb: any) => cb(mockDb)),
      all: vi.fn().mockResolvedValue([]),
      run: vi.fn().mockResolvedValue({ success: true }),
      get: vi.fn().mockResolvedValue(null),
      $dynamic: vi.fn().mockReturnThis(),
      query: new Proxy({}, { get: () => ({ findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) }) }),
      getExecutor: vi.fn().mockReturnValue({
        compileQuery: vi.fn().mockReturnValue({ sql: "", parameters: [], query: { kind: "RawNode" } }),
        executeQuery: vi.fn().mockResolvedValue({ rows: [] }),
        transformQuery: vi.fn((q: unknown) => q),
      }),
    } as unknown as DrizzleMock;

    env = {
      ARES_STORAGE: mockR2,
      DB: {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      } as unknown as D1Database,
      AI: { run: vi.fn().mockResolvedValue({ description: "Mocked Description" }) },
      DEV_BYPASS: "true",
      ENVIRONMENT: "test",
    };

    testApp = new Hono<TestEnv>();
    testApp.use("*", async (c: Context<TestEnv>, next: () => Promise<void>) => {
      c.set("db", createDrizzleProxy(mockDb) as any);
      c.set("sessionUser", { id: "1", role: "admin", email: "admin@test.com", name: null, nickname: "Admin", image: null, member_type: "student" });
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
    mockDb.execute.mockResolvedValueOnce([{ key: "Library/doc1.pdf", folder: "Library", tags: "test doc" }]);

    const res = await testApp.request("/admin", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    // The response might be the raw OpenAPI handler return value { status, body }
    // or a Response object. Handle both cases.
    const body = (res as any).body ? (res as any).body : await res.text();
    const parsed = typeof body === "string" ? JSON.parse(body) : body;
    expect(parsed.media).toHaveLength(1);
    expect(parsed.media[0].folder).toBe("Library");
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
    expect(mockR2.delete).toHaveBeenCalledWith(expect.anything());
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


    if (!(file ).arrayBuffer) {

      (file ).arrayBuffer = () => Promise.resolve(fileBytes.buffer);
    }

    // Create a proper FormData mock with bracket notation access
    const formData = { file, folder: "Gallery" } as unknown as FormData;

    // Mock the full Hono request object with parseBody method
    const mockReq = {
      url: "http://localhost/api/media/admin/upload",
      header: vi.fn((key: string) => {
        if (key === "cf-connecting-ip") return "127.0.0.1";
        if (key === "x-forwarded-for") return undefined;
        if (key === "user-agent") return "test-agent";
        return undefined;
      }),
      parseBody: vi.fn().mockResolvedValue(formData),
    };

    const mockC = {
      get: vi.fn().mockReturnValue(mockDb),
      env,
      req: mockReq,
      executionCtx: mockExecutionContext
    };


    const uploadFn = mediaHandlers.upload as unknown as (c: any) => Promise<any>;
    const res = await uploadFn(mockC);
    if (res.status !== 200) throw new Error("TEST FAILED " + JSON.stringify(res));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockR2.put).toHaveBeenCalled();
  });

  it("POST /admin/upload - upload HEIC file", async () => {
    const { mediaHandlers } = await import("./media/handlers");
    const heicBytes = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
    const file = new File([heicBytes], "test.heic", { type: "image/heic" });


    if (!(file ).arrayBuffer) {

      (file ).arrayBuffer = () => Promise.resolve(heicBytes.buffer);
    }

    const formData = { file, folder: "Gallery" } as unknown as FormData;

    const mockReq = {
      url: "http://localhost/api/media/admin/upload",
      header: vi.fn((key: string) => {
        if (key === "cf-connecting-ip") return "127.0.0.1";
        if (key === "user-agent") return "test-agent";
        return undefined;
      }),
      parseBody: vi.fn().mockResolvedValue(formData),
    };

    const mockC = {
      get: vi.fn().mockReturnValue(mockDb),
      env,
      req: mockReq,
      executionCtx: mockExecutionContext
    };

    const uploadFn = mediaHandlers.upload as unknown as (c: any) => Promise<HandlerResponse>;
    const res = await uploadFn(mockC as any);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("POST /admin/upload - invalid magic bytes", async () => {
    const { mediaHandlers } = await import("./media/handlers");
    const invalidBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const file = new File([invalidBytes], "test.txt", { type: "text/plain" });

    // Mock FormData with bracket notation access (handler uses formData["file"])
    const formData = { file, folder: null } as unknown as FormData;

    const mockReq = {
      url: "http://localhost/api/media/admin/upload",
      header: vi.fn((key: string) => {
        if (key === "cf-connecting-ip") return "127.0.0.1";
        if (key === "user-agent") return "test-agent";
        return undefined;
      }),
      parseBody: vi.fn().mockResolvedValue(formData),
    };

    const mockC = { get: vi.fn().mockReturnValue(mockDb), set: vi.fn(), env, req: mockReq };

    const uploadFn = mediaHandlers.upload as unknown as (c: any) => Promise<HandlerResponse>;
    const res = await uploadFn(mockC as any);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid file type");
  });

  it("POST /admin/upload - large file (>2.5MB, skips AI)", async () => {
    const { mediaHandlers } = await import("./media/handlers");
    const largeContent = new Uint8Array(3 * 1024 * 1024);
    largeContent.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    const file = new File([largeContent], "large.png", { type: "image/png" });
    if (!file.stream) {
      (file as File & { stream?: () => unknown }).stream = (() => ({
        getReader: () => ({
          read: vi.fn().mockResolvedValue({ done: true, value: undefined })
        })
      })) as any;
    }
    const formData = { file, folder: "Gallery" } as unknown as FormData;

    const mockReq = {
      url: "http://localhost/api/media/admin/upload",
      header: vi.fn((key: string) => {
        if (key === "cf-connecting-ip") return "127.0.0.1";
        if (key === "user-agent") return "test-agent";
        return undefined;
      }),
      parseBody: vi.fn().mockResolvedValue(formData),
    };

    const mockC = { get: vi.fn().mockReturnValue(mockDb), env, req: mockReq, executionCtx: mockExecutionContext };

    const uploadFn = mediaHandlers.upload as unknown as (c: any) => Promise<HandlerResponse>;
    const res = await uploadFn(mockC as any);
    expect(res.status).toBe(200);
  });

  it("POST /admin/upload - AI failure scenario", async () => {
    const { mediaHandlers } = await import("./media/handlers");
    env.AI.run.mockRejectedValue(new Error("AI Down"));
    const fileBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const file = new File([fileBytes], "test.png", { type: "image/png" });


    if (!(file ).arrayBuffer) {

      (file ).arrayBuffer = () => Promise.resolve(fileBytes.buffer);
    }
    const formData = { file, folder: "Gallery" } as unknown as FormData;

    const mockReq = {
      url: "http://localhost/api/media/admin/upload",
      header: vi.fn((key: string) => {
        if (key === "cf-connecting-ip") return "127.0.0.1";
        if (key === "user-agent") return "test-agent";
        return undefined;
      }),
      parseBody: vi.fn().mockResolvedValue(formData),
    };

    const mockC = { get: vi.fn().mockReturnValue(mockDb), env, req: mockReq, executionCtx: mockExecutionContext };

    const uploadFn = mediaHandlers.upload as unknown as (c: any) => Promise<HandlerResponse>;
    const res = await uploadFn(mockC as any);
    expect(res.status).toBe(200);
    expect(res.body.altText).toBe("ARES 23247 Team Media Image");
  });

  it("PUT /admin/move/:key - R2 move failure", async () => {
    const { mediaHandlers } = await import("./media/handlers");
    mockR2.get.mockRejectedValue(new Error("R2 Get Failed"));
    const mockReq = {
      url: "http://localhost/api/media/admin/move/test.png",
      header: vi.fn(),
      valid: vi.fn((type: string) => {
        if (type === "param") return { key: "test.png" };
        if (type === "json") return { folder: "Archive" };
        return {};
      }),
    };
    const mockC = { get: vi.fn().mockReturnValue(mockDb), set: vi.fn(), env, req: mockReq };

    const moveFn = mediaHandlers.move as unknown as (c: any) => Promise<HandlerResponse>;
    const res = await moveFn(mockC as any);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Move failed");
  });

  it("DELETE /admin/:key - R2 delete failure", async () => {
    const { mediaHandlers } = await import("./media/handlers");
    mockR2.delete.mockRejectedValue(new Error("R2 Delete Failed"));
    const mockReq = {
      url: "http://localhost/api/media/admin/test.png",
      header: vi.fn(),
      valid: vi.fn((type: string) => {
        if (type === "param") return { key: "test.png" };
        return {};
      }),
    };
    const mockC = { get: vi.fn().mockReturnValue(mockDb), set: vi.fn(), env, req: mockReq };

    const deleteFn = mediaHandlers.delete as unknown as (c: any) => Promise<HandlerResponse>;
    const res = await deleteFn(mockC as any);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Delete failed");
  });

  it("POST /admin/syndicate - failure", async () => {
    const { mediaHandlers } = await import("./media/handlers");
    const mockC = { get: vi.fn().mockReturnValue(mockDb), set: vi.fn(), env, req: { url: "invalid url", header: vi.fn() }, executionCtx: mockExecutionContext };
    const syndicateFn = mediaHandlers.syndicate as unknown as (h: { body: { key: string }, params: Record<string, string>, query: Record<string, string> }, c: MockContext) => Promise<HandlerResponse>;
    const res = await syndicateFn({ body: { key: "test.png" }, params: {}, query: {} }, mockC as any);
    expect(res.status).toBe(500);
  });

  it("POST /admin/upload - failure", async () => {
    const { mediaHandlers } = await import("./media/handlers");
    const fileBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const file = new File([fileBytes], "test.png", { type: "image/png" });


    if (!(file ).arrayBuffer) {

      (file ).arrayBuffer = () => Promise.resolve(fileBytes.buffer);
    }
    const mockFormData = { file, folder: null } as unknown as FormData;
    const mockReq = {
      url: "http://localhost/api/media/admin/upload",
      header: vi.fn((key: string) => {
        if (key === "cf-connecting-ip") return "127.0.0.1";
        if (key === "user-agent") return "test-agent";
        return undefined;
      }),
      parseBody: vi.fn().mockResolvedValue(mockFormData),
    };
    const mockC = { get: vi.fn().mockReturnValue(null), env, req: mockReq, executionCtx: mockExecutionContext };

    const res = await (mediaHandlers.upload as unknown as (c: any) => Promise<any>)(mockC as any);
    expect(res.status).toBe(500);
  });

  it("PUT /admin/move/:key - without R2", async () => {
    const { mediaHandlers } = await import("./media/handlers");
    const mockReq = {
      url: "http://localhost/api/media/admin/move/test.png",
      header: vi.fn(),
      valid: vi.fn((type: string) => {
        if (type === "param") return { key: "test.png" };
        if (type === "json") return { folder: "Archive" };
        return {};
      }),
    };
    const mockC = {
      get: vi.fn().mockReturnValue(mockDb),
      env: { ...env, ARES_STORAGE: null },
      req: mockReq,
      executionCtx: mockExecutionContext
    };
    const moveFn = mediaHandlers.move as unknown as (c: any) => Promise<HandlerResponse>;
    const res = await moveFn(mockC as any);
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
    const { checkPersistentRateLimit } = await import("../middleware");
    const checkPersistentRateLimitMock = checkPersistentRateLimit as ReturnType<typeof vi.fn>;
    checkPersistentRateLimitMock.mockResolvedValueOnce(false);
    const mockReq = {
      url: "http://localhost/api/media",
      header: vi.fn((key: string) => {
        if (key === "cf-connecting-ip") return "127.0.0.1";
        if (key === "x-forwarded-for") return undefined;
        if (key === "user-agent") return "test-agent";
        return undefined;
      }),
    };
    const mockC = { get: vi.fn().mockReturnValue(mockDb), env, req: mockReq };
    const { mediaHandlers } = await import("./media/handlers");
    const getMediaFn = mediaHandlers.getMedia as unknown as (c: any) => Promise<HandlerResponse>;
    const res = await getMediaFn(mockC as any);
    expect(res.status).toBe(429);
  });

  it("GET /admin - database failure", async () => {
    const mockDbFail = { select: vi.fn().mockImplementation(() => { throw new Error("DB Error"); }) };
    const mockC = { get: vi.fn().mockReturnValue(mockDbFail), env, req: { url: "http://localhost/api/media/admin", header: vi.fn().mockReturnValue("admin") } };
    const { mediaHandlers } = await import("./media/handlers");
    const adminListFn = mediaHandlers.adminList as unknown as (_h: { params: any, query: any }, c: MockContext) => Promise<HandlerResponse>;
    const res = await adminListFn({ params: {}, query: {} }, mockC as any);
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
    // Explicit 8-byte PNG check
    expect(isValidImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer)).toBe(true);
    // Incomplete 4-byte PNG check should fail
    expect(isValidImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBe(false);
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
    const localMockDb = { select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue([{ key: "Public.png", folder: "Gallery", tags: "" }]) };
    const { mediaHandlers } = await import("./media/handlers");

    const mockReq = {
      url: "http://localhost/",
      header: vi.fn((key: string) => {
        if (key === "cf-connecting-ip") return "1.2.3.4";
        if (key === "x-forwarded-for") return undefined;
        if (key === "user-agent") return "test-agent";
        return undefined;
      }),
    };

    const res = await (mediaHandlers.getMedia as unknown as (c: any) => Promise<any>)({ get: vi.fn().mockReturnValue(localMockDb), env, req: mockReq } as any);
    expect(res.body.media).toHaveLength(1);
  });

  it("GET /:key - private object cache control", async () => {
    const { getSessionUser } = await import("../middleware");
    const getSessionUserMock = getSessionUser as ReturnType<typeof vi.fn>;
    getSessionUserMock.mockResolvedValueOnce({ id: "1", role: "admin" });
    mockR2.get.mockResolvedValue({ body: "data", httpMetadata: { contentType: "image/png" }, writeHttpMetadata: (h: Headers) => h.set("Content-Type", "image/png") });
    const res = await testApp.request("/Archive/secret.png", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate");
  });

  it("GET / - internal failure", async () => {
    const { mediaHandlers } = await import("./media/handlers");
    const mockDbFail = { select: vi.fn().mockImplementation(() => { throw new Error("DB Error"); }) };
    const mockReq = {
      url: "http://localhost/",
      header: vi.fn((key: string) => {
        if (key === "cf-connecting-ip") return "127.0.0.1";
        if (key === "user-agent") return "test-agent";
        return undefined;
      }),
    };
    const res = await (mediaHandlers.getMedia as unknown as (c: any) => Promise<any>)({ get: vi.fn().mockReturnValue(mockDbFail), env, req: mockReq } as any);
    expect(res.status).toBe(500);
  });

  it("GET /:key - unauthorized", async () => {
    const { getSessionUser } = await import("../middleware");
    const getSessionUserMock = getSessionUser as ReturnType<typeof vi.fn>;
    getSessionUserMock.mockResolvedValueOnce(null);
    const res = await testApp.request("/Private/secret.png", {}, env, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("GET /:key - internal error", async () => {
    mockR2.get.mockRejectedValue(new Error("R2 Error"));
    const res = await testApp.request("/Gallery/error.png", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /:key - serves raw object", async () => {
    mockR2.get.mockResolvedValue({ body: "data", httpMetadata: { contentType: "image/png" }, writeHttpMetadata: vi.fn((headers: any) => headers.set("Content-Type", "image/png")) });
    const res = await testApp.request("/Gallery/img1.png", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });
});

