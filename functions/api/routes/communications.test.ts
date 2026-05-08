import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import communicationsRouter from "./communications";
import { AppEnv } from "../middleware";

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
    getSocialConfig: vi.fn(),
    logAuditAction: vi.fn(),
    logSystemError: vi.fn(),
    getDb: () => {
      const fns = {
        all: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
        execute: vi.fn().mockResolvedValue([]),
        executeTakeFirst: vi.fn().mockResolvedValue(null),
        first: vi.fn().mockResolvedValue(null)
      };
      const methods = ['mockResolvedValueOnce', 'mockResolvedValue', 'mockRejectedValueOnce', 'mockRejectedValue'];
      const orig = {};
      for (const m of methods) {
        orig[m] = {
          all: fns.all[m].bind(fns.all),
          get: fns.get[m].bind(fns.get),
          run: fns.run[m].bind(fns.run),
          execute: fns.execute[m].bind(fns.execute),
          executeTakeFirst: fns.executeTakeFirst[m].bind(fns.executeTakeFirst),
          first: fns.first[m].bind(fns.first)
        };
      }
      const terminalsList = ['all', 'get', 'run', 'execute', 'executeTakeFirst', 'first'];
      for (const key of terminalsList) {
        for (const m of methods) {
          fns[key][m] = (...args) => {
            const terminals = ['all', 'get', 'run', 'execute', 'executeTakeFirst', 'first'];
            for (const k of terminals) {
              if (orig[m][k]) orig[m][k](...args);
            }
            return fns[key];
          };
        }
      }
      const chainable = new Proxy(fns, {
        get: (target, prop) => {
          if (prop === 'then') return undefined;
          if (prop in target) return target[prop];
          if (prop === 'transaction') return vi.fn(async (cb) => cb(chainable));
          target[prop] = vi.fn().mockReturnValue(chainable);
          return target[prop];
        }
      });
      return chainable;
    },
  };
});

import { getSocialConfig, logAuditAction, logSystemError } from "../middleware";

describe("Hono Backend - /communications Router", () => {
  let app: Hono<AppEnv>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    app = new Hono<AppEnv>();
    app.route("/", communicationsRouter);

    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  it("GET /stats - returns active users count", async () => {
    const { getDb } = await import("../middleware");
    const mockDb = getDb({} as any);
    (mockDb.all as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { email: "test1@test.com" },
      { email: "test2@test.com" },
      { email: null }
    ]);

    const res = await app.request("/stats", {}, {
      env: {} as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { activeUsers?: number };
    expect(body.activeUsers).toBe(2);
  });

  it("GET /stats - returns 500 when getDb throws", async () => {
    const { getDb } = await import("../middleware");
    const mockDb = getDb({} as any);
    (mockDb.select as ReturnType<typeof vi.fn>).mockImplementationOnce(() => { throw new Error("Database not initialized"); });

    const res = await app.request("/stats", {}, {
      env: {} as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(500);
    const body = await res.json() as { success?: boolean; error?: string };
    expect(body.success).toBe(false);
  });

  it("GET /stats - handles DB error", async () => {
    const { getDb } = await import("../middleware");
    const mockDb = getDb({} as any);
    (mockDb.all as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("DB Connection Error"));

    const res = await app.request("/stats", {}, {
      env: {} as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });
    expect(res.status).toBe(500);
    const body = await res.json() as { error?: string };
    expect(body.error).toBe("DB Connection Error");
  });

  it("POST /mass-email - returns 400 if API key is missing", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({});

    const res = await app.request("/mass-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "Test", htmlContent: "<p>Hi</p>" })
    }, {
      env: {} as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toContain("Resend API key");
  });

  it("POST /mass-email - returns 400 if no active users", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({ RESEND_API_KEY: "test_key" });
    const { getDb } = await import("../middleware");
    const mockDb = getDb({} as any);
    (mockDb.all as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const res = await app.request("/mass-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "Test", htmlContent: "<p>Hi</p>" })
    }, {
      env: {} as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toContain("No active users found");
  });

  it("POST /mass-email - handles Resend API failure", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({ RESEND_API_KEY: "test_key" });
    const { getDb } = await import("../middleware");
    const mockDb = getDb({} as any);
    (mockDb.all as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ email: "test@test.com" }]);

    fetchMock.mockResolvedValueOnce({
      ok: false,
      text: async () => "Unauthorized"
    } as Response);

    const res = await app.request("/mass-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "Test", htmlContent: "<p>Hi</p>" })
    }, {
      env: {} as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });

    expect(res.status).toBe(500);
    const body = await res.json() as { error?: string };
    expect(body.error).toContain("Resend API Error: Unauthorized");
    expect(logSystemError).toHaveBeenCalled();
  });

  it("POST /mass-email - handles Resend Batch payload error", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({ RESEND_API_KEY: "test_key" });
    const { getDb } = await import("../middleware");
    const mockDb = getDb({} as any);
    (mockDb.all as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ email: "test@test.com" }]);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: { message: "Invalid domain" } })
    } as Response);

    const res = await app.request("/mass-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "Test", htmlContent: "<p>Hi</p>" })
    }, {
      env: {} as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });

    expect(res.status).toBe(500);
    const body = await res.json() as { error?: string };
    expect(body.error).toContain("Resend Batch Error: Invalid domain");
  });

  it("POST /mass-email - sends emails successfully in batches", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({ RESEND_API_KEY: "test_key" });
    const { getDb } = await import("../middleware");
    const mockDb = getDb({} as any);

    // Create 51 users to test batching logic (batch size is 50)
    const mockUsers = Array.from({ length: 51 }, (_, i) => ({ email: `user${i}@test.com` }));
    (mockDb.all as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockUsers);

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "batch-id" })
    } as Response);

    const res = await app.request("/mass-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "Hello", htmlContent: "<p>Hi</p>" })
    }, {
      env: {} as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { success?: boolean; recipientCount?: number };
    expect(body.success).toBe(true);
    expect(body.recipientCount).toBe(51);

    // Expect fetch to have been called twice (1 for 50, 1 for 1)
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logAuditAction).toHaveBeenCalled();
  });
});
