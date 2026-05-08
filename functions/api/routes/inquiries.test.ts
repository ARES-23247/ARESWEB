import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { AppEnv } from "../middleware";
import type {
  ApiResponse,
  DbRows,
  Inquiry,
  MockFn,
  QueryBuilderProxy,
  SessionUser,
} from "../../test/testTypes";
vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    getDbSettings: vi.fn().mockResolvedValue({}),
    getSocialConfig: vi.fn().mockResolvedValue({
      GITHUB_TOKEN: "ghp_test",
      GITHUB_PROJECT_ID: "123",
      GITHUB_ORG: "test-org",
      DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/test"
    }),
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "1", role: "admin", email: "admin@test.com" }),
    logAuditAction: vi.fn().mockResolvedValue(true),
    rateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
    turnstileMiddleware: () => async (_c: unknown, next: any) => {
      if (next && typeof next === 'function') {
        return await next();
      }
    },
    persistentRateLimitMiddleware: () => async (_c: unknown, next: any) => {
      if (next && typeof next === 'function') {
        return await next();
      }
    },
  };
});

vi.mock("../../utils/githubProjects", () => ({
  buildGitHubConfig: vi.fn().mockReturnValue({}),
  createProjectItem: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn(),
}));

vi.mock("../../utils/notifications", () => ({
  notifyByRole: vi.fn(),
}));

import inquiriesRouter from "./inquiries/index";

// Test interfaces - flexible response type for API responses
interface InquiryResponseType extends ApiResponse {
  inquiries?: Inquiry[];
  inquiry?: Inquiry & { id: string };
  id?: string;
  status?: string;
}

// Simple inline mock execution context
function createMockExecutionContext() {
  const promises: Promise<unknown>[] = [];
  return {
    waitUntil: vi.fn((promise: Promise<unknown>) => {
      promises.push(promise);
      return promise;
    }),
    passThroughOnException: vi.fn(),
    props: {},
    promises,
  };
}

// Simple inline mock database
const createMockDb = (): QueryBuilderProxy => {
      const allFn = vi.fn().mockResolvedValue<DbRows>([]);
      const getFn = vi.fn().mockResolvedValue<unknown>(null);
      const runFn = vi.fn().mockResolvedValue({ success: true });

      const fns: Record<string, MockFn> = {
        all: allFn,
        get: getFn,
        run: runFn,
        execute: allFn,
        executeTakeFirst: getFn,
        first: getFn
      };

      const chainable = new Proxy(fns, {
        get: (target, prop) => {
          if (prop === 'then') return undefined;
          if (prop === 'query') {
             return new Proxy({}, {
                get: () => new Proxy({}, {
                   get: (_tTarget, tProp) => {
                      if (tProp === 'findFirst') return fns.get;
                      if (tProp === 'findMany') return fns.all;
                      return vi.fn().mockReturnValue(chainable);
                   }
                })
             });
          }
          if (prop in target) return target[prop as string];
          if (prop === 'transaction') return vi.fn(async (cb) => cb(chainable));
          target[prop as string] = vi.fn().mockReturnValue(chainable);
          return target[prop as string];
        }
      }) as QueryBuilderProxy;
      return chainable;
    };

describe("Hono Backend - /inquiries Router", () => {
  let mockDb: QueryBuilderProxy;
  let testApp: Hono<AppEnv>;
  let env: { DB: D1Database; DEV_BYPASS?: string; TURNSTILE_SECRET?: string; ENCRYPTION_SECRET?: string };
  const mockExecutionContext = createMockExecutionContext();

  beforeEach(async () => {
    vi.clearAllMocks();

    // Polyfill crypto for Node.js test environment if needed
    if (typeof (global as any).crypto === "undefined") {
      (global as any).crypto = {
        randomUUID: () => `test-uuid-${Math.random().toString(36).substring(7)}` as any
      };
    } else if (typeof (global as any).crypto.randomUUID === "undefined") {
      (global as any).crypto.randomUUID = () => `test-uuid-${Math.random().toString(36).substring(7)}` as any;
    }

    mockDb = createMockDb();

    // Set default behavior for mocks
    const { sendZulipMessage } = await import("../../utils/zulipSync");
    vi.mocked(sendZulipMessage).mockResolvedValue(true as never);

    const { notifyByRole } = await import("../../utils/notifications");
    vi.mocked(notifyByRole).mockResolvedValue(true as never);

    env = {
      DB: {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      } as any,
      DEV_BYPASS: "true",
      TURNSTILE_SECRET: "test-secret",
      ENCRYPTION_SECRET: "test-encryption-secret-key-for-unit-tests",
    };

    testApp = new Hono<AppEnv>();
    testApp.onError((err: any, c: any) => {
      console.error("Test App Error:", err);
      return c.json({ error: err.message }, 500);
    });
    testApp.use("*", async (c, next) => {
      c.set("db", mockDb as any);
      // getSessionUser checks for "sessionUser" in context
      c.set("sessionUser", { id: "1", email: "admin@test.com", name: "Admin", role: "admin", member_type: "mentor" } as any);
      await next();
    });
    testApp.route("/", inquiriesRouter);
  });

  afterEach(async () => {
    if (mockExecutionContext.promises && mockExecutionContext.promises.length > 0) {
      await Promise.allSettled(mockExecutionContext.promises);
      mockExecutionContext.promises.length = 0;
    }
  });

  it("GET /admin/list - list all", async () => {
    const res = await testApp.request("/admin/list?page=1&limit=50", {
      headers: { "DEV_BYPASS": "true" }
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("GET /admin/list - mask PII for students", async () => {
    testApp = new Hono<AppEnv>();
    testApp.use("*", async (c, next) => {
      c.set("db", mockDb as any);
      c.set("sessionUser", { id: "2", email: "student@test.com", name: "Student", role: "user", member_type: "student" } as any);
      await next();
    });
    testApp.route("/", inquiriesRouter);

    mockDb.all.mockResolvedValue([
      { id: "1", type: "outreach", name: "John Doe", email: "john.doe@example.com", metadata: JSON.stringify({ level: "high", secret: "hidden" }), status: "pending", created_at: "2024-01-01" }
    ]);

    const res = await testApp.request("/admin/list", { headers: { "DEV_BYPASS": "true" } }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { inquiries: unknown[] };
    expect((body.inquiries as any)[0].name).toBe("J*******");
    expect((body.inquiries as any)[0].email).toContain("***@");
    expect((body.inquiries as any)[0].metadata).not.toContain("secret");
  });

  it("POST / - submit new inquiry", async () => {
    // Mock fetch for turnstile
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });

    const res = await testApp.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "support",
        name: "Test",
        email: "test@test.com",
        metadata: { msg: "hello" }
      })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("POST / - submit sponsor inquiry", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    mockDb.all.mockResolvedValue([]);

    const res = await testApp.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "sponsor", name: "Acme Corp", email: "sponsor@acme.com", metadata: { level: "Gold Tier Sponsor" } })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("POST / - prevent duplicate submissions", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    mockDb.all.mockResolvedValue([{
      id: "dup-id", email: "test@test.com", metadata: JSON.stringify({ msg: "hello" })
    }]);

    // Polyfill decrypt to return the same email
    const cryptoModule = await import("../../utils/crypto");
    vi.spyOn(cryptoModule, "decrypt").mockResolvedValue("test@test.com");

    const res = await testApp.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "support", name: "Test", email: "test@test.com", metadata: { msg: "hello" } })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as InquiryResponseType;
    expect(body.id).toBe("dup-id");
  });

  it("PATCH /admin/:id/status - update status", async () => {
    const res = await testApp.request("/admin/1/status", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "DEV_BYPASS": "true"
      },
      body: JSON.stringify({ status: "resolved" })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("DELETE /admin/:id - delete", async () => {
    const res = await testApp.request("/admin/1", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "DEV_BYPASS": "true"
      },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("purgeOldInquiries - delete old inquiries", async () => {
    const { purgeOldInquiries } = await import("./inquiries/index");
    mockDb.run.mockResolvedValueOnce({ meta: { changes: 2 } });
    const res = await purgeOldInquiries(mockDb as any, 30);
    expect(res.deleted).toBe(2);
  });

  it("GET /admin/list - masks PII for students (with new app)", async () => {
    // Setup a new app instance to override sessionUser for this test
    const studentApp = new Hono<AppEnv>();
    studentApp.use("*", async (c: any, next) => {
      c.set("db", mockDb as any);
      c.set("sessionUser", { id: "2", role: "user", member_type: "student", email: "student@test.com", name: "Student" } as any);
      await next();
    });
    studentApp.route("/", inquiriesRouter);

    mockDb.all.mockResolvedValue([
      {
        id: "1",
        type: "support",
        name: "John Doe",
        email: "john.doe@example.com",
        status: "pending",
        created_at: "2023-01-01T00:00:00Z",
        metadata: JSON.stringify({ level: "Gold", secret: "private" })
      }
    ]);

    const res = await studentApp.request("/admin/list", {
      headers: { "DEV_BYPASS": "true" }
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as InquiryResponseType;
    const inquiry = (body.inquiries as any)[0];

    // name: J******* (1 + length-1 stars)
    expect(inquiry.name).toBe("J" + "*".repeat("John Doe".length - 1));
    // email: jo******@example.com
    expect(inquiry.email).toBe("jo" + "*".repeat("hn.doe".length) + "@example.com");
    // metadata: only whitelisted keys
    const meta = JSON.parse(inquiry.metadata);
    expect(meta.level).toBe("Gold");
    expect(meta.secret).toBeUndefined();
  });

  it("POST / - submit new sponsor inquiry (duplicate test)", async () => {
    const res = await testApp.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "sponsor",
        name: "Test Sponsor",
        email: "sponsor@test.com",
        metadata: { level: "Gold" }
      })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("GET /admin/list - returns 401 if no user", async () => {
    const noUserApp = new Hono<AppEnv>();
    noUserApp.use("*", async (c, next) => {
      c.set("db", mockDb as any);
      // No sessionUser set
      await next();
    });
    noUserApp.route("/", inquiriesRouter);

    const res = await noUserApp.request("/admin/list", { headers: { "DEV_BYPASS": "true" } }, env, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("GET /admin/list - handles failure", async () => {
    mockDb.all.mockRejectedValueOnce(() => { throw new Error("DB Error"); });
    const res = await testApp.request("/admin/list", { headers: { "DEV_BYPASS": "true" } }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST / - handles submission failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    mockDb.run.mockRejectedValueOnce(new Error("Insert Error"));

    const res = await testApp.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "support", name: "Test", email: "test@test.com" })
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("POST / - handles decryption error in duplicate check", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    mockDb.all.mockResolvedValueOnce([{ id: "123", email: "bad-data", metadata: "{}" }]);

    // Decrypt will fail (throw) for "bad-data"
    const cryptoModule = await import("../../utils/crypto");
    vi.spyOn(cryptoModule, "decrypt").mockRejectedValueOnce(new Error("Decryption failed"));

    const res = await testApp.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "support", name: "Test", email: "test@test.com" })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200); // Should proceed to create new if check fails
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("PATCH /admin/:id/status - handles failure", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("Update Error"));
    const res = await testApp.request("/admin/1/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "DEV_BYPASS": "true" },
      body: JSON.stringify({ status: "resolved" })
    }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /admin/list - handles decryption failure", async () => {
    mockDb.all.mockResolvedValueOnce([{ id: "1", name: "bad:name", email: "bad:email", type: "support", status: "pending", created_at: "now" }]);
    const cryptoModule = await import("../../utils/crypto");
    vi.spyOn(cryptoModule, "decrypt").mockRejectedValue(new Error("Decryption failed"));

    const res = await testApp.request("/admin/list", { headers: { "DEV_BYPASS": "true" } }, env, mockExecutionContext);
    const body = await res.json() as InquiryResponseType;
    expect((body.inquiries as any)[0].name).toBe("[ENCRYPTED NAME]");
    expect((body.inquiries as any)[0].email).toBe("[ENCRYPTED EMAIL]");
  });

  it("POST / - handles large metadata", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    const largeMeta = { data: "x".repeat(6000) };
    const res = await testApp.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "support", name: "Test", email: "test@test.com", metadata: largeMeta })
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("POST / - handles duplicate submission", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    mockDb.all.mockResolvedValueOnce([{ id: "old-id", email: "enc-email", metadata: JSON.stringify({ key: "val" }) }]);

    const cryptoModule = await import("../../utils/crypto");
    vi.spyOn(cryptoModule, "decrypt").mockResolvedValue("test@test.com");

    const res = await testApp.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "support", name: "Test", email: "test@test.com", metadata: { key: "val" } })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as InquiryResponseType;
    expect(body.id).toBe("old-id");
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("DELETE /admin/:id - handles failure (with body)", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("Delete Error"));
    const res = await testApp.request("/admin/1", {
      method: "DELETE",
      headers: {
        "DEV_BYPASS": "true",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET / - bypasses turnstile", async () => {
    const res = await testApp.request("/", { method: "GET" }, env, mockExecutionContext);
    // Should pass through to ts-rest which returns 404 for GET / since it's not defined in contract for root
    // But the middleware next() will be called.
    expect(res.status).toBe(404);
  });

  it("purgeOldInquiries function - with results", async () => {
    const { purgeOldInquiries } = await import("./inquiries/handlers");
    mockDb.run.mockResolvedValueOnce({ meta: { changes: 1 } });

    const res = await purgeOldInquiries(mockDb as any, 30);
    expect(res.deleted).toBe(1);
    expect(mockDb.run).toHaveBeenCalled();

    const res2 = await purgeOldInquiries(mockDb as any, 0);
    expect(res2.deleted).toBe(0);
  });

  it("POST / - handles background task errors gracefully", async () => {
    // Force all external calls to reject to hit the .catch(() => {}) blocks
    global.fetch = vi.fn().mockRejectedValue(new Error("Fetch failed"));
    const zulipModule = await import("../../utils/zulipSync");
    vi.spyOn(zulipModule, "sendZulipMessage").mockRejectedValue(new Error("Zulip failed"));
    const notifyModule = await import("../../utils/notifications");
    vi.spyOn(notifyModule, "notifyByRole").mockRejectedValue(new Error("Notify failed"));
    const githubModule = await import("../../utils/githubProjects");
    vi.spyOn(githubModule, "createProjectItem").mockRejectedValue(new Error("GitHub failed"));

    const res = await testApp.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "sponsor", name: "Acme", email: "sponsor@acme.com", metadata: {} })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);

    // Wait for the background task to complete to ensure the catches are executed
    if (mockExecutionContext.promises && mockExecutionContext.promises.length > 0) {
      await Promise.allSettled(mockExecutionContext.promises);
    }
  });
});
