 
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

import mediaRouter from "./media";

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
      
      if (c.req.path.includes("/admin/upload")) {
        c.req.parseBody = async () => ({
          file: new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00])], "test.png", { type: "image/png" }),
          folder: "Gallery"
        });
      }
      
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

  it("DELETE /admin/:key - delete asset", async () => {
    const res = await testApp.request("/admin/img1.png", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it.skip("POST /admin/upload - upload file", async () => {
    const res = await testApp.request("/admin/upload", {
      method: "POST",
      headers: { "Content-Type": "multipart/form-data; boundary=---test" }
    }, env, { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as any);

    expect(res.status).toBe(200);
  });
});
