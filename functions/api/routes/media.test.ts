import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { AppEnv } from "../middleware";
import type { DbRows } from "../../test/testTypes";

// Mock external utilities
vi.mock("../../utils/socialSync", () => ({
  dispatchPhotoSocials: vi.fn().mockResolvedValue(true)
}));

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    getDbSettings: vi.fn().mockResolvedValue({}),
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "1", role: "admin", email: "admin@test.com" }),
    logAuditAction: vi.fn().mockResolvedValue(true),
    rateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
    checkPersistentRateLimit: vi.fn().mockResolvedValue(true),
  };
});

vi.mock("../../utils/zulipSync", () => ({
  sendZulipAlert: vi.fn(),
}));

import mediaRouter from "./media/index";

interface MockR2 {
  list: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

type MockAI = {
  run: ReturnType<typeof vi.fn>;
};

type TestEnvWithStorage = AppEnv["Bindings"] & {
  ARES_STORAGE: MockR2;
  AI: MockAI;
};

// Mock execution context
function createMockExecutionContext() {
  return {
    waitUntil: vi.fn((promise: Promise<unknown>) => promise),
    passThroughOnException: vi.fn(),
    props: {},
  };
}

// Mock database types (same pattern as judges.test.ts)
type MockFn = ReturnType<typeof vi.fn>;

interface MockDbFunctions {
  all: MockFn;
  get: MockFn;
  run: MockFn;
  execute: MockFn;
  executeTakeFirst: MockFn;
  first: MockFn;
  [key: string]: MockFn;
}

interface ChainableQuery {
  select: MockFn & ChainableQuery;
  from: MockFn & ChainableQuery;
  where: MockFn & ChainableQuery;
  insert: MockFn & ChainableQuery;
  values: MockFn & ChainableQuery;
  update: MockFn & ChainableQuery;
  set: MockFn & ChainableQuery;
  delete: MockFn & ChainableQuery;
  limit: MockFn & ChainableQuery;
  offset: MockFn & ChainableQuery;
  orderBy: MockFn & ChainableQuery;
  returning: MockFn & ChainableQuery;
  transaction: MockFn;
  [key: string]: MockFn | ChainableQuery | unknown;
}

type MockDb = MockDbFunctions & ChainableQuery;

// Simple inline mock database for Drizzle ORM
const createMockDb = (): MockDb => {
      const allFn = vi.fn().mockResolvedValue([]);
      const getFn = vi.fn().mockResolvedValue(null);
      const runFn = vi.fn().mockResolvedValue({ success: true });

      const fns: MockDbFunctions = {
        all: allFn,
        get: getFn,
        run: runFn,
        execute: allFn,
        executeTakeFirst: getFn,
        first: getFn
      };

      const chainable = new Proxy(fns, {
        get: (target, prop) => {
          if (prop === 'then') {
            return (resolve: (value: DbRows) => unknown, reject: (reason?: unknown) => unknown) => Promise.resolve(fns.all()).then(resolve).catch(reject);
          }
          if (prop === 'catch') {
            return (reject: (reason?: unknown) => unknown) => Promise.resolve(fns.all()).catch(reject);
          }
          if (prop === 'finally') {
            return (cb: () => void) => Promise.resolve(fns.all()).finally(cb);
          }
          if (prop === 'query') {
             return new Proxy({}, {
                get: () => new Proxy({}, {
                   get: (_tTarget: unknown, tProp: string | symbol) => {
                      if (tProp === 'findFirst') return fns.get;
                      if (tProp === 'findMany') return fns.all;
                      return vi.fn().mockReturnValue(chainable);
                   }
                })
             });
          }
          if (prop in target) return target[prop as keyof MockDbFunctions];
          if (prop === 'transaction') return vi.fn(async (cb: (tx: MockDb) => Promise<unknown>) => cb(chainable));
          if (typeof prop === 'symbol') return chainable;
          (target[prop as string] as MockFn) = vi.fn().mockReturnValue(chainable);
          return target[prop as string];
        }
      });
      return chainable as MockDb;
    };

describe("Hono Backend - /media Router", () => {
  let mockR2: MockR2;
  let mockDb: MockDb;
  let testApp: Hono<AppEnv>;
  let env: TestEnvWithStorage;
  const mockExecutionContext = createMockExecutionContext();

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

    mockDb = createMockDb();

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
    } as TestEnvWithStorage;

    testApp = new Hono<AppEnv>();
    testApp.use("*", async (c: Context<AppEnv>, next: () => Promise<void>) => {
      c.set("db", mockDb as never);
      c.set("sessionUser", { id: "1", role: "admin", email: "admin@test.com", name: null, nickname: "Admin", image: null, member_type: "student" } as never);
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
    const parsed = await res.json() as { media: Array<{ folder: string }> };
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

  it("GET /:key - object without body", async () => {
    mockR2.get.mockResolvedValue({ body: null, writeHttpMetadata: vi.fn() });
    const res = await testApp.request("/Gallery/empty.png", {}, env, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("GET /:key - serves raw object", async () => {
    mockR2.get.mockResolvedValue({ body: "data", httpMetadata: { contentType: "image/png" }, writeHttpMetadata: vi.fn((headers: { set: (key: string, value: string) => void }) => headers.set("Content-Type", "image/png")) });
    const res = await testApp.request("/Gallery/img1.png", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
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
});
