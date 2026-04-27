import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";

// Mock middleware
vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (_c: any, next: any) => next(),
    rateLimitMiddleware: () => async (_c: any, next: any) => next(),
    logAuditAction: vi.fn().mockResolvedValue(true),
    getSessionUser: vi.fn().mockResolvedValue({ id: "admin-1", role: "admin", email: "admin@ares.org" }),
  };
});

import financeRouter from "./finance";

describe("Hono Backend - /finance Router", () => {
  let mockDb: any;
  let testApp: Hono<any>;

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
      onConflict: vi.fn().mockReturnThis(),
      doNothing: vi.fn().mockReturnThis(),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      deleteFrom: vi.fn().mockReturnThis(),
      transaction: vi.fn().mockReturnThis(),
    };

    // Mock transaction flow
    mockDb.transaction.mockReturnValue({
      execute: vi.fn().mockImplementation(async (callback) => {
        return await callback(mockDb);
      })
    });

    testApp = new Hono<any>();
    testApp.use("*", async (c: any, next: any) => {
      c.set("db", mockDb);
      c.executionCtx = mockExecutionContext;
      await next();
    });
    testApp.route("/", financeRouter);
  });

  const mockEnv = {
    DB: {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({}),
      run: vi.fn().mockResolvedValue({}),
    },
    ARES_STORAGE: {
      delete: vi.fn().mockResolvedValue({}),
    },
    ENVIRONMENT: "test",
    DEV_BYPASS: "true"
  };

  it("GET /summary - returns aggregated totals", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ start_year: 2024 });
    mockDb.execute.mockResolvedValueOnce([{ type: "income", total: 1000 }, { type: "expense", total: 400 }]);
    
    const res = await testApp.request("/summary", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.total_income).toBe(1000);
    expect(body.total_expenses).toBe(400);
    expect(body.balance).toBe(600);
  });

  it("GET /summary - handles no seasons", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    const res = await testApp.request("/summary", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.total_income).toBe(0);
  });

  it("GET /sponsorship - lists pipeline", async () => {
    mockDb.execute.mockResolvedValueOnce([{ id: "lead-1", company_name: "Test Corp", status: "Potential" }]);
    const res = await testApp.request("/sponsorship", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.pipeline[0].company_name).toBe("Test Corp");
  });

  it("POST /sponsorship - handles 'Secured' side-effects atomically", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ status: "Potential" }); // current
    mockDb.execute.mockResolvedValue([]); // For transaction batch
    
    const payload = {
      company_name: "New Sponsor",
      status: "Secured",
      amount: 500,
      season_id: 2024,
      tier: "Gold"
    };

    const res = await testApp.request("/sponsorship", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, id: "123" })
    }, mockEnv, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.insertInto).toHaveBeenCalledWith("sponsors");
    expect(mockDb.insertInto).toHaveBeenCalledWith("finance_transactions");
  });

  it("POST /sponsorship - idempotent when already 'secured'", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ status: "Secured" });
    const payload = { company_name: "Sponsor", status: "Secured", amount: 500, season_id: 2024 };
    const res = await testApp.request("/sponsorship", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, id: "123" })
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.insertInto).not.toHaveBeenCalledWith("sponsors");
  });

  it("POST /sponsorship - returns 404 for missing item update", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    const payload = { company_name: "Sponsor", status: "Potential", amount: 500, season_id: 2024 };
    const res = await testApp.request("/sponsorship", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, id: "missing" })
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("DELETE /sponsorship/:id - deletes pipeline item", async () => {
    const res = await testApp.request("/sponsorship/lead-123", { 
      method: "DELETE"
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.deleteFrom).toHaveBeenCalledWith("sponsorship_pipeline");
  });

  it("GET /transactions - lists transactions", async () => {
    mockDb.execute.mockResolvedValueOnce([{ id: "1", amount: 100, type: "income", category: "Donation", date: "2024-01-01" }]);
    const res = await testApp.request("/transactions", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.transactions[0].amount).toBe(100);
  });

  it("GET /transactions - filters by type", async () => {
    mockDb.execute.mockResolvedValueOnce([{ id: "1", amount: 50, type: "expense", category: "parts", date: "2024-01-01" }]);
    const res = await testApp.request("/transactions?type=expense", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.where).toHaveBeenCalledWith("type", "=", "expense");
  });

  it("POST /transactions - saves existing transaction", async () => {
    const payload = { type: "income", amount: 100, category: "Donation", date: "2024-01-01", id: "tx-1" };
    const res = await testApp.request("/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.updateTable).toHaveBeenCalledWith("finance_transactions");
  });

  it("POST /transactions - creates new transaction", async () => {
    mockDb.execute.mockResolvedValueOnce([]);
    const payload = { type: "expense", amount: 50, category: "parts", date: "2024-01-01" };
    const res = await testApp.request("/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.insertInto).toHaveBeenCalledWith("finance_transactions");
  });

  it("DELETE /transactions/:id - triggers R2 asset cleanup", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ receipt_url: "https://ares-r2.org/receipts/123.jpg" });
    mockDb.execute.mockResolvedValueOnce([]);
    const res = await testApp.request("/transactions/123", { method: "DELETE" }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockEnv.ARES_STORAGE.delete).toHaveBeenCalledWith("receipts/123.jpg");
  });

  it("DELETE /transactions/:id - handles missing transaction", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    const res = await testApp.request("/transactions/missing", { method: "DELETE" }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("DELETE /transactions/:id - handles malformed URL", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ receipt_url: "invalid-url" });
    const res = await testApp.request("/transactions/123", { method: "DELETE" }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });
});
