/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAPI handler input validated by Zod schemas */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { DrizzleMock, TestEnv } from "../../../src/test/types";
import { mockExecutionContext, createMockDrizzle } from "../../../src/test/utils";

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
  let mockDb: DrizzleMock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDrizzle();

    testApp = new Hono<TestEnv>();
    testApp.use("*", async (c, next) => {
      c.set("db", mockDb);
      (c as any).set("executionCtx", mockExecutionContext);
      c.set("sessionUser", { id: "admin-123", role: "admin", email: "admin@test.com", name: null, member_type: "mentor" });
      await next();
    });
    testApp.route("/", financeRouter);
  });

  describe("GET /summary", () => {
    it("returns correct totals for a specific season", async () => {
      mockDb.all.mockResolvedValueOnce([{ type: "income", total: 1000 }, { type: "expense", total: 400 }]);
      const res = await testApp.request("/summary?season_id=2024", {}, mockEnv, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.total_income).toBe(1000);
      expect(body.total_expenses).toBe(400);
      expect(mockDb.where).toHaveBeenCalled();
    });

    it("returns correct totals for latest season if not specified", async () => {
      mockDb.get.mockResolvedValueOnce({ startYear: 2024 });
      mockDb.all.mockResolvedValueOnce([{ type: "income", total: 1000 }]);
      
      const res = await testApp.request("/summary", {}, mockEnv, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.season_id).toBe(2024);
    });

    it("handles no seasons", async () => {
      mockDb.get.mockResolvedValueOnce(null);
      const res = await testApp.request("/summary", {}, mockEnv, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.season_id).toBe(null);
    });

    it("handles summary error", async () => {
      mockDb.get.mockRejectedValueOnce(new Error("Fail"));
      const res = await testApp.request("/summary", {}, mockEnv, mockExecutionContext);
      expect(res.status).toBe(500);
    });
  });

  describe("GET /sponsorship", () => {
    it("lists pipeline with season filter", async () => {
      mockDb.all.mockResolvedValueOnce([{ id: "lead-1", companyName: "Test Corp", status: "potential", estimatedValue: 500 }]);
      const res = await testApp.request("/sponsorship?season_id=2024", {}, mockEnv, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.pipeline).toHaveLength(1);
    });

    it("handles list pipeline error", async () => {
      mockDb.all.mockRejectedValueOnce(new Error("Fail"));
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
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("handles 'secured' side-effects atomically", async () => {
      // Mock existing pipeline item as not secured yet
      mockDb.get.mockResolvedValueOnce({ status: "potential" });
      // Mock no existing transaction
      mockDb.get.mockResolvedValueOnce(null);

      const res = await testApp.request("/sponsorship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, id: "123" })
      }, mockEnv, mockExecutionContext);

      expect(res.status).toBe(200);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("does not duplicate transaction if it already exists (idempotency)", async () => {
      // Mock existing pipeline item as not secured yet
      mockDb.get.mockResolvedValueOnce({ status: "potential" });
      // Mock existing transaction found
      mockDb.get.mockResolvedValueOnce({ id: "tx-already-exists" });

      const res = await testApp.request("/sponsorship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, id: "123", season_id: 2024 })
      }, mockEnv, mockExecutionContext);

      expect(res.status).toBe(200);
      // Since it already exists, sponsors should NOT be inserted again.
      // We expect 0 calls to insert (since the update method is called for the pipeline update)
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("idempotent when already 'secured'", async () => {
      mockDb.get.mockResolvedValueOnce({ status: "secured" });
      
      const res = await testApp.request("/sponsorship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, id: "123" })
      }, mockEnv, mockExecutionContext);
      expect(res.status).toBe(200);
      // Should call update for the pipeline, but not insert for sponsors/transactions
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("handles save error", async () => {
      mockDb.insert.mockImplementationOnce(() => { throw new Error("Fail"); });
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
      mockDb.run.mockRejectedValueOnce(new Error("Fail"));
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
      mockDb.all.mockResolvedValueOnce([{ id: "tx-1", amount: 100, type: "income", category: "Donation", date: "2024-01-01" }]);
      const res = await testApp.request("/transactions?season_id=2024&type=income", {}, mockEnv, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.transactions).toHaveLength(1);
    });

    it("handles list error", async () => {
      mockDb.all.mockRejectedValueOnce(new Error("Fail"));
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
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("updates existing transaction", async () => {
      const res = await testApp.request("/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, id: "tx-123" })
      }, mockEnv, mockExecutionContext);
      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("handles save error", async () => {
      mockDb.insert.mockImplementationOnce(() => { throw new Error("Fail"); });
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
      mockDb.get.mockResolvedValueOnce({ receiptUrl: "https://r2.ares/receipts/test.png" });
      const res = await testApp.request("/transactions/tx-123", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }, mockEnv, mockExecutionContext);
      expect(res.status).toBe(200);
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();
      expect(mockEnv.ARES_STORAGE.delete).toHaveBeenCalledWith(expect.anything());
    });

    it("handles delete safely when executionCtx is not provided", async () => {
      mockDb.get.mockResolvedValueOnce({ receiptUrl: "https://r2.ares/receipts/test2.png" });
      const res = await testApp.request("/transactions/tx-123", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }, mockEnv, undefined); // no executionCtx
      expect(res.status).toBe(200);
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("handles missing transaction", async () => {
      mockDb.get.mockResolvedValueOnce(null);
      const res = await testApp.request("/transactions/tx-123", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }, mockEnv, mockExecutionContext);
      expect(res.status).toBe(404);
    });

    it("handles delete error", async () => {
      mockDb.get.mockRejectedValueOnce(new Error("Fail"));
      const res = await testApp.request("/transactions/tx-123", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }, mockEnv, mockExecutionContext);
      expect(res.status).toBe(500);
    });
  });
});

