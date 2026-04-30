import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import pointsRouter from "./points";

describe("Hono Backend - /points Router", () => {
  let app: Hono;
  let mockDb: any;
  let sessionUser: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis()
    };

    sessionUser = { id: "user-1", role: "user" };

    app = new Hono();
    app.use("*", async (c, next) => {
      c.set("db", mockDb);
      if (sessionUser) {
        c.set("sessionUser", sessionUser);
      }
      await next();
    });
    app.route("/", pointsRouter);
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
      const data = await res.json();
      expect(data.balance).toBe(5);
    });

    it("allows admin to get another user's balance", async () => {
      sessionUser.role = "admin";
      mockDb.execute.mockResolvedValueOnce([{ points_delta: 20 }]);
      const res = await app.request("/api/points/balance/user-2");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.balance).toBe(20);
    });

    it("returns 500 on db error", async () => {
      mockDb.execute.mockRejectedValueOnce(new Error("DB Error"));
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
        { id: "tx1", points_delta: 10, reason: "Meeting", created_by: "admin-1" }
      ]);
      const res = await app.request("/api/points/history/user-1");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe("tx1");
    });

    it("returns 500 on db error", async () => {
      mockDb.execute.mockRejectedValueOnce(new Error("DB Error"));
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
      sessionUser.role = "admin";
      const res = await app.request("/api/points/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "user-1", points_delta: 10, reason: "Test" })
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.points_delta).toBe(10);
      expect(data.reason).toBe("Test");
    });

    it("returns 500 on db error", async () => {
      sessionUser.role = "admin";
      mockDb.execute.mockRejectedValueOnce(new Error("DB Error"));
      const res = await app.request("/api/points/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "user-1", points_delta: 10, reason: "Test" })
      });
      expect(res.status).toBe(500);
    });
  });
});
