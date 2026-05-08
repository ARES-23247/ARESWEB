import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { AppEnv } from "../middleware";
import pointsRouter from "./points";

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAuth: async (_c: unknown, next: () => Promise<void>) => next(),
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "user-1", email: "test@test.com", role: "user", member_type: "student" }),
  };
});

// Simple inline mock database for Drizzle ORM
const createMockDb = () => {
      const allFn = vi.fn().mockResolvedValue([]);
      const getFn = vi.fn().mockResolvedValue(null);
      const runFn = vi.fn().mockResolvedValue({ success: true });

      const fns: Record<string, any> = {
        all: allFn,
        get: getFn,
        run: runFn,
        execute: allFn,
        executeTakeFirst: getFn,
        first: getFn
      };

      const chainable: any = new Proxy(fns, {
        get: (target, prop) => {
          if (prop === 'then') {
            return (resolve: any, reject: any) => Promise.resolve(fns.all()).then(resolve).catch(reject);
          }
          if (prop === 'catch') {
            return (reject: any) => Promise.resolve(fns.all()).catch(reject);
          }
          if (prop === 'finally') {
            return (cb: any) => Promise.resolve(fns.all()).finally(cb);
          }
          if (prop === 'query') {
             return new Proxy({}, {
                get: () => new Proxy({}, {
                   get: (tTarget, tProp) => {
                      if (tProp === 'findFirst') return fns.get;
                      if (tProp === 'findMany') return fns.all;
                      return vi.fn().mockReturnValue(chainable);
                   }
                })
             });
          }
          if (prop in target) return target[prop];
          if (prop === 'transaction') return vi.fn(async (cb: any) => cb(chainable));
          if (typeof prop === 'symbol') return chainable;
          target[prop as string] = vi.fn().mockReturnValue(chainable);
          return target[prop as string];
        }
      });
      return chainable;
    };;

describe("Hono Backend - /points Router", () => {
  let app: Hono<AppEnv>;
  let mockDb: ReturnType<typeof createMockDb>;
  let sessionUser: { id: string; role: string } | null;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();

    sessionUser = { id: "user-1", role: "user" };

    app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("db", mockDb as any);
      if (sessionUser) {
        c.set("sessionUser", sessionUser as any);
      }
      await next();
    });
    app.route("/api/points", pointsRouter);
  });

  describe("GET /api/points/balance/:user_id", () => {
    it("returns 401 if unauthenticated", async () => {
      sessionUser = null;
      const res = await app.request("/api/points/balance/user-1");
      expect(res.status).toBe(401);
    });

    it("returns 403 if getting another user's balance as non-admin", async () => {
      const res = await app.request("/api/points/balance/user-2");
      expect(res.status).toBe(403);
    });

    it("allows user to get their own balance", async () => {
      mockDb.execute.mockResolvedValueOnce([{ points_delta: 10 }, { points_delta: -5 }]);
      const res = await app.request("/api/points/balance/user-1");
      expect(res.status).toBe(200);
      const data = (await res.json()) as { balance: number };
      expect(data.balance).toBe(5);
    });

    it("allows admin to get another user's balance", async () => {
      sessionUser!.role = "admin";
      mockDb.execute.mockResolvedValueOnce([{ points_delta: 20 }]);
      const res = await app.request("/api/points/balance/user-2");
      expect(res.status).toBe(200);
      const data = (await res.json()) as { balance: number };
      expect(data.balance).toBe(20);
    });

    it("returns 500 on db error", async () => {
      mockDb.all.mockRejectedValueOnce(new Error("DB Error"));
    mockDb.get.mockRejectedValueOnce(new Error("DB Error"));
    mockDb.run.mockRejectedValueOnce(new Error("DB Error"));
    mockDb.first.mockRejectedValueOnce(new Error("DB Error"));
      const res = await app.request("/api/points/balance/user-1");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /api/points/history/:user_id", () => {
    it("returns 401 if unauthenticated", async () => {
      sessionUser = null;
      const res = await app.request("/api/points/history/user-1");
      expect(res.status).toBe(401);
    });

    it("returns 403 if getting another user's history as non-admin", async () => {
      const res = await app.request("/api/points/history/user-2");
      expect(res.status).toBe(403);
    });

    it("returns history list", async () => {
      mockDb.execute.mockResolvedValueOnce([
        { id: "tx1", user_id: "user-1", points_delta: 10, reason: "Meeting", created_by: "admin-1", created_at: new Date().toISOString() }
      ]);
      const res = await app.request("/api/points/history/user-1");
      expect(res.status).toBe(200);
      const data = (await res.json()) as Array<{ id: string }>;
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe("tx1");
    });

    it("returns 500 on db error", async () => {
      mockDb.all.mockRejectedValueOnce(new Error("DB Error"));
    mockDb.get.mockRejectedValueOnce(new Error("DB Error"));
    mockDb.run.mockRejectedValueOnce(new Error("DB Error"));
    mockDb.first.mockRejectedValueOnce(new Error("DB Error"));
      const res = await app.request("/api/points/history/user-1");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /api/points/transaction", () => {
    it("returns 401 if not admin", async () => {
      const res = await app.request("/api/points/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "user-1", points_delta: 10, reason: "Test" })
      });
      expect(res.status).toBe(401);
    });

    it("awards points as admin", async () => {
      sessionUser!.role = "admin";
      const res = await app.request("/api/points/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "user-1", points_delta: 10, reason: "Test" })
      });
      expect(res.status).toBe(201);
      const data = (await res.json()) as { success: boolean; transaction_id: string };
      expect(data.success).toBe(true);
      expect(data.transaction_id).toBeDefined();
    });

    it("returns 500 on db error", async () => {
      sessionUser!.role = "admin";
      mockDb.all.mockRejectedValueOnce(new Error("DB Error"));
    mockDb.get.mockRejectedValueOnce(new Error("DB Error"));
    mockDb.run.mockRejectedValueOnce(new Error("DB Error"));
    mockDb.first.mockRejectedValueOnce(new Error("DB Error"));
      const res = await app.request("/api/points/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "user-1", points_delta: 10, reason: "Test" })
      });
      expect(res.status).toBe(500);
    });
  });
});
