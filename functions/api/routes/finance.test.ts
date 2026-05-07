import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import financeRouter from "./finance";
import { AppEnv } from "../middleware";

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
    rateLimitMiddleware: () => (_c: unknown, next: () => Promise<void>) => next(),
    logAuditAction: vi.fn(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "user-123", role: "admin", member_type: "mentor" }),
    getDb: () => ({
      all: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    }),
  };
});

describe("Hono Backend - /finance Router", () => {
  let app: Hono<AppEnv>;
  let getDbMock: () => ReturnType<typeof vi.mocked<typeof import("../middleware").getDb>>;
  const env = {
    DB: {} as unknown as D1Database,
    DEV_BYPASS: "true",
    ARES_STORAGE: {
      delete: vi.fn().mockResolvedValue(undefined),
    },
  } as AppEnv["Bindings"];
  const mockExecutionContext = {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const middleware = await import("../middleware");
    getDbMock = middleware.getDb as any;

    app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("db", getDbMock());
      (c as any).set("executionCtx", mockExecutionContext);
      c.set("sessionUser", { id: "admin-123", role: "admin", email: "admin@test.com", name: null, member_type: "mentor" });
      await next();
    });
    app.route("/", financeRouter);
  });

  describe("GET /summary", () => {
    it("returns correct totals for a specific season", async () => {
      const mockDb = getDbMock();
      mockDb.all = vi.fn().mockResolvedValueOnce([{ type: "income", total: 1000 }, { type: "expense", total: 400 }]);
      const res = await app.request("/summary?season_id=2024", {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.total_income).toBe(1000);
      expect(body.total_expenses).toBe(400);
    });

    it("returns correct totals for latest season if not specified", async () => {
      const mockDb = getDbMock();
      mockDb.get = vi.fn()
        .mockResolvedValueOnce({ startYear: 2024 });
      mockDb.all = vi.fn().mockResolvedValueOnce([{ type: "income", total: 1000 }]);

      const res = await app.request("/summary", {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.season_id).toBe(2024);
    });

    it("handles no seasons", async () => {
      const mockDb = getDbMock();
      mockDb.get = vi.fn().mockResolvedValueOnce(null);
      const res = await app.request("/summary", {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.season_id).toBe(null);
    });

    it("handles summary error", async () => {
      const mockDb = getDbMock();
      mockDb.get = vi.fn().mockRejectedValueOnce(new Error("Fail"));
      const res = await app.request("/summary", {}, env, mockExecutionContext);
      expect(res.status).toBe(500);
    });
  });

  describe("GET /sponsorship", () => {
    it("lists pipeline with season filter", async () => {
      const mockDb = getDbMock();
      mockDb.all = vi.fn().mockResolvedValueOnce([{ id: "lead-1", companyName: "Test Corp", status: "potential", estimatedValue: 500 }]);
      const res = await app.request("/sponsorship?season_id=2024", {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.pipeline).toHaveLength(1);
    });

    it("handles list pipeline error", async () => {
      const mockDb = getDbMock();
      mockDb.all = vi.fn().mockRejectedValueOnce(new Error("Fail"));
      const res = await app.request("/sponsorship", {}, env, mockExecutionContext);
      expect(res.status).toBe(500);
    });
  });

  describe("POST /sponsorship", () => {
    const payload = {
      company_name: "Big Sponsor",
      status: "secured",
      estimated_value: 1000,
      season_id: 2024
    };

    it("creates a new pipeline item", async () => {
      const mockDb = getDbMock();
      const res = await app.request("/sponsorship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, status: "potential" })
      }, env, mockExecutionContext);
      expect(res.status).toBe(200);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("handles 'secured' side-effects atomically", async () => {
      const mockDb = getDbMock();
      // Mock existing pipeline item as not secured yet
      mockDb.get = vi.fn()
        .mockResolvedValueOnce({ status: "potential" })
        .mockResolvedValueOnce(null);

      const res = await app.request("/sponsorship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, id: "123" })
      }, env, mockExecutionContext);

      expect(res.status).toBe(200);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("does not duplicate transaction if it already exists (idempotency)", async () => {
      const mockDb = getDbMock();
      // Mock existing pipeline item as not secured yet
      mockDb.get = vi.fn()
        .mockResolvedValueOnce({ status: "potential" })
        .mockResolvedValueOnce({ id: "tx-already-exists" });

      const res = await app.request("/sponsorship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, id: "123", season_id: 2024 })
      }, env, mockExecutionContext);

      expect(res.status).toBe(200);
      // Since it already exists, sponsors should NOT be inserted again.
      // We expect 0 calls to insert (since the update method is called for the pipeline update)
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("idempotent when already 'secured'", async () => {
      const mockDb = getDbMock();
      mockDb.get = vi.fn().mockResolvedValueOnce({ status: "secured" });

      const res = await app.request("/sponsorship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, id: "123" })
      }, env, mockExecutionContext);
      expect(res.status).toBe(200);
      // Should call update for the pipeline, but not insert for sponsors/transactions
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("handles save error", async () => {
      const mockDb = getDbMock();
      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          run: vi.fn().mockRejectedValue(new Error("Fail"))
        })
      });
      const res = await app.request("/sponsorship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }, env, mockExecutionContext);
      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /sponsorship/:id", () => {
    it("deletes pipeline item", async () => {
      const res = await app.request("/sponsorship/123", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }, env, mockExecutionContext);
      expect(res.status).toBe(200);
    });

    it("handles delete error", async () => {
      const mockDb = getDbMock();
      mockDb.run = vi.fn().mockRejectedValueOnce(new Error("Fail"));
      const res = await app.request("/sponsorship/123", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }, env, mockExecutionContext);
      expect(res.status).toBe(500);
    });
  });

  describe("GET /transactions", () => {
    it("lists transactions with filters", async () => {
      const mockDb = getDbMock();
      mockDb.all = vi.fn().mockResolvedValueOnce([{ id: "tx-1", amount: 100, type: "income", category: "Donation", date: "2024-01-01" }]);
      const res = await app.request("/transactions?season_id=2024&type=income", {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.transactions).toHaveLength(1);
    });

    it("handles list error", async () => {
      const mockDb = getDbMock();
      mockDb.all = vi.fn().mockRejectedValueOnce(new Error("Fail"));
      const res = await app.request("/transactions", {}, env, mockExecutionContext);
      expect(res.status).toBe(500);
    });
  });

  describe("POST /transactions", () => {
    const payload = {
      type: "expense",
      amount: 50,
      category: "Hardware",
      date: "2024-01-10"
    };

    it("creates new transaction", async () => {
      const mockDb = getDbMock();
      const res = await app.request("/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }, env, mockExecutionContext);
      expect(res.status).toBe(200);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("updates existing transaction", async () => {
      const mockDb = getDbMock();
      const res = await app.request("/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, id: "tx-123" })
      }, env, mockExecutionContext);
      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("handles save error", async () => {
      const mockDb = getDbMock();
      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          run: vi.fn().mockRejectedValue(new Error("Fail"))
        })
      });
      const res = await app.request("/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }, env, mockExecutionContext);
      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /transactions/:id", () => {
    it("deletes an existing transaction", async () => {
      const mockDb = getDbMock();
      mockDb.get = vi.fn().mockResolvedValueOnce({ receiptUrl: "https://r2.ares/receipts/test.png" });
      const res = await app.request("/transactions/tx-123", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }, env, mockExecutionContext);
      expect(res.status).toBe(200);
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();
      expect((env as any).ARES_STORAGE.delete).toHaveBeenCalledWith(expect.anything());
    });

    it("handles delete safely when executionCtx is not provided", async () => {
      const mockDb = getDbMock();
      mockDb.get = vi.fn().mockResolvedValueOnce({ receiptUrl: "https://r2.ares/receipts/test2.png" });
      const res = await app.request("/transactions/tx-123", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }, env, undefined); // no executionCtx
      expect(res.status).toBe(200);
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("handles missing transaction", async () => {
      const mockDb = getDbMock();
      mockDb.get = vi.fn().mockResolvedValueOnce(null);
      const res = await app.request("/transactions/tx-123", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }, env, mockExecutionContext);
      expect(res.status).toBe(404);
    });

    it("handles delete error", async () => {
      const mockDb = getDbMock();
      mockDb.get = vi.fn().mockRejectedValueOnce(new Error("Fail"));
      const res = await app.request("/transactions/tx-123", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }, env, mockExecutionContext);
      expect(res.status).toBe(500);
    });
  });
});
