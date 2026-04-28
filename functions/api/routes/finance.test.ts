import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { Kysely } from "kysely";

// Mock middleware BEFORE importing the router
vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (c: any, next: any) => next(),
    rateLimitMiddleware: () => (c: any, next: any) => next(),
    logAuditAction: vi.fn(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "user-123" }),
  };
});

import financeRouter from "./finance";

const mockEnv = {
  DB: {} as any,
  ARES_STORAGE: {
    delete: vi.fn().mockResolvedValue(undefined),
  } as any,
  DEV_BYPASS: "true",
};

const mockExecutionContext = {
  waitUntil: vi.fn(),
} as any;

describe("Hono Backend - /finance Router", () => {
  let testApp: Hono<any>;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      deleteFrom: vi.fn().mockReturnThis(),
      transaction: vi.fn().mockReturnThis(),
    };
    
    // Support transaction callback
    mockDb.execute.mockImplementation(async (cb: any) => {
      if (typeof cb === 'function') return cb(mockDb);
      return [];
    });

    testApp = new Hono<any>();
    testApp.use("*", async (c, next) => {
      c.set("db", mockDb as unknown as Kysely<any>);
      c.set("executionCtx", mockExecutionContext);
      await next();
    });
    testApp.route("/", financeRouter);
  });

  describe("GET /summary", () => {
    it("returns correct totals for a specific season", async () => {
      mockDb.execute.mockResolvedValueOnce([{ type: "income", total: 1000 }, { type: "expense", total: 400 }]);
      const res = await testApp.request("/summary?season_id=2024", {}, mockEnv, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.total_income).toBe(1000);
      expect(body.total_expenses).toBe(400);
      expect(mockDb.where).toHaveBeenCalledWith("season_id", "=", "2024");
    });

    it("returns correct totals for latest season if not specified", async () => {
      mockDb.executeTakeFirst.mockResolvedValueOnce({ start_year: 2024 });
      mockDb.execute.mockResolvedValueOnce([{ type: "income", total: 1000 }]);
      
      const res = await testApp.request("/summary", {}, mockEnv, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.season_id).toBe(2024);
    });

    it("handles no seasons", async () => {
      mockDb.executeTakeFirst.mockResolvedValueOnce(null);
      const res = await testApp.request("/summary", {}, mockEnv, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.season_id).toBe(null);
    });

    it("handles summary error", async () => {
      mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("Fail"));
      const res = await testApp.request("/summary", {}, mockEnv, mockExecutionContext);
      expect(res.status).toBe(500);
    });
  });

  describe("GET /sponsorship", () => {
    it("lists pipeline with season filter", async () => {
      mockDb.execute.mockResolvedValueOnce([{ id: "lead-1", company_name: "Test Corp", status: "potential", estimated_value: 500 }]);
      const res = await testApp.request("/sponsorship?season_id=2024", {}, mockEnv, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.pipeline).toHaveLength(1);
    });

    it("handles list pipeline error", async () => {
      mockDb.execute.mockRejectedValueOnce(new Error("Fail"));
      const res = await testApp.request("/sponsorship", {}, mockEnv, mockExecutionContext);
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
      const res = await testApp.request("/sponsorship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, status: "potential" })
      }, mockEnv, mockExecutionContext);
      expect(res.status).toBe(200);
      expect(mockDb.insertInto).toHaveBeenCalledWith("sponsorship_pipeline");
    });

    it("handles 'secured' side-effects atomically", async () => {
      const res = await testApp.request("/sponsorship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }, mockEnv, mockExecutionContext);

      expect(res.status).toBe(200);
      expect(mockDb.insertInto).toHaveBeenCalledWith("sponsors");
    });

    it("idempotent when already 'secured'", async () => {
      mockDb.executeTakeFirst.mockResolvedValueOnce({ status: "secured" });
      
      const res = await testApp.request("/sponsorship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, id: "123" })
      }, mockEnv, mockExecutionContext);
      expect(res.status).toBe(200);
      expect(mockDb.insertInto).not.toHaveBeenCalledWith("sponsors");
    });

    it("handles save error", async () => {
      mockDb.transaction.mockImplementationOnce(() => { throw new Error("Fail"); });
      const res = await testApp.request("/sponsorship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }, mockEnv, mockExecutionContext);
      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /sponsorship/:id", () => {
    it("deletes pipeline item", async () => {
      const res = await testApp.request("/sponsorship/123", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }, mockEnv, mockExecutionContext);
      expect(res.status).toBe(200);
    });

    it("handles delete error", async () => {
      mockDb.execute.mockRejectedValueOnce(new Error("Fail"));
      const res = await testApp.request("/sponsorship/123", { 
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }, mockEnv, mockExecutionContext);
      expect(res.status).toBe(500);
    });
  });

  describe("GET /transactions", () => {
    it("lists transactions with filters", async () => {
      mockDb.execute.mockResolvedValueOnce([{ id: "tx-1", amount: 100, type: "income", category: "Donation", date: "2024-01-01" }]);
      const res = await testApp.request("/transactions?season_id=2024&type=income", {}, mockEnv, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.transactions).toHaveLength(1);
    });

    it("handles list error", async () => {
      mockDb.execute.mockRejectedValueOnce(new Error("Fail"));
      const res = await testApp.request("/transactions", {}, mockEnv, mockExecutionContext);
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
      const res = await testApp.request("/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }, mockEnv, mockExecutionContext);
      expect(res.status).toBe(200);
      expect(mockDb.insertInto).toHaveBeenCalledWith("finance_transactions");
    });

    it("updates existing transaction", async () => {
      const res = await testApp.request("/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, id: "tx-123" })
      }, mockEnv, mockExecutionContext);
      expect(res.status).toBe(200);
      expect(mockDb.updateTable).toHaveBeenCalledWith("finance_transactions");
    });

    it("handles save error", async () => {
      mockDb.insertInto.mockImplementationOnce(() => { throw new Error("Fail"); });
      const res = await testApp.request("/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }, mockEnv, mockExecutionContext);
      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /transactions/:id", () => {
    it("deletes an existing transaction", async () => {
      mockDb.executeTakeFirst.mockResolvedValueOnce({ receipt_url: "https://r2.ares/receipts/test.png" });
      const res = await testApp.request("/transactions/tx-123", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }, mockEnv, mockExecutionContext);
      expect(res.status).toBe(200);
      expect(mockDb.deleteFrom).toHaveBeenCalled();
      expect(mockEnv.ARES_STORAGE.delete).toHaveBeenCalledWith("receipts/test.png");
    });

    it("handles missing transaction", async () => {
      mockDb.executeTakeFirst.mockResolvedValueOnce(null);
      const res = await testApp.request("/transactions/tx-123", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }, mockEnv, mockExecutionContext);
      expect(res.status).toBe(404);
    });

    it("handles delete error", async () => {
      mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("Fail"));
      const res = await testApp.request("/transactions/tx-123", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }, mockEnv, mockExecutionContext);
      expect(res.status).toBe(500);
    });
  });
});
