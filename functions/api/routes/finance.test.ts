/* eslint-disable @typescript-eslint/no-explicit-any -- ts-rest handler input validated by contract library */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { TestEnv } from "../../../src/test/types";
import { mockExecutionContext } from "../../../src/test/utils";
import { createMockExpressionBuilder } from "../../../src/test/utils";

// Mock middleware BEFORE importing the router
vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
    rateLimitMiddleware: () => (_c: unknown, next: () => Promise<void>) => next(),
    logAuditAction: vi.fn(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "user-123", role: "admin", member_type: "mentor" }),
  };
});

import financeRouter from "./finance";



const mockEnv = {
  DB: {} as D1Database,
  ARES_STORAGE: {
    delete: vi.fn().mockResolvedValue(undefined),
  },
  DEV_BYPASS: "true",
};

describe("Hono Backend - /finance Router", () => {
  let testApp: Hono<TestEnv>;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      select: vi.fn().mockImplementation((args) => {
        if (Array.isArray(args)) {
          args.forEach((arg: unknown) => {
            if (typeof arg === "function") {
              arg(createMockExpressionBuilder());
            }
          });
        }
        return mockDb;
      }),
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
    mockDb.execute.mockImplementation(async (cb: unknown) => {
      if (typeof cb === "function") return cb(mockDb);
      return [];
    });

    testApp = new Hono<TestEnv>();
    testApp.use("*", async (c: any, next) => {
      c.set("db", mockDb);
      c.set("executionCtx", mockExecutionContext);
      c.set("sessionUser", { id: "admin-123", role: "admin", email: "admin@test.com", name: null, member_type: "mentor" });
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
      expect(mockDb.where).toHaveBeenCalledWith("season_id", "=", 2024);
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
      // Mock existing pipeline item as not secured yet
      mockDb.executeTakeFirst.mockResolvedValueOnce({ status: "potential" });
      // Mock no existing transaction
      mockDb.executeTakeFirst.mockResolvedValueOnce(null);

      const res = await testApp.request("/sponsorship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, id: "123" })
      }, mockEnv, mockExecutionContext);

      expect(res.status).toBe(200);
      expect(mockDb.insertInto).toHaveBeenCalledWith("sponsors");
    });

    it("does not duplicate transaction if it already exists (idempotency)", async () => {
      // Mock existing pipeline item as not secured yet
      mockDb.executeTakeFirst.mockResolvedValueOnce({ status: "potential" });
      // Mock existing transaction found
      mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "tx-already-exists" });

      const res = await testApp.request("/sponsorship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, id: "123", season_id: 2024 })
      }, mockEnv, mockExecutionContext);

      expect(res.status).toBe(200);
      // Since it already exists, sponsors should NOT be inserted again.
      expect(mockDb.insertInto).not.toHaveBeenCalledWith("sponsors");
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
      mockDb.execute.mockRejectedValueOnce(new Error("Fail"));
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
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();
      expect(mockEnv.ARES_STORAGE.delete).toHaveBeenCalledWith("receipts/test.png");
    });

    it("handles delete safely when executionCtx is not provided", async () => {
      mockDb.executeTakeFirst.mockResolvedValueOnce({ receipt_url: "https://r2.ares/receipts/test2.png" });
      const res = await testApp.request("/transactions/tx-123", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }, mockEnv, undefined); // no executionCtx
      expect(res.status).toBe(200);
      expect(mockDb.deleteFrom).toHaveBeenCalled();
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

