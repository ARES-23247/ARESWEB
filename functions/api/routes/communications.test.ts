/* eslint-disable @typescript-eslint/no-explicit-any -- ts-rest handler input validated by contract library */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TestEnv } from "../../../src/test/types";
import { Hono } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";
import communicationsRouter from "./communications";

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
    getSocialConfig: vi.fn(),
    logAuditAction: vi.fn(),
    logSystemError: vi.fn()
  };
});

import { getSocialConfig, logAuditAction, logSystemError } from "../middleware";

const globalFetch = globalThis.fetch;

describe("Hono Backend - /communications Router", () => {
  let mockDb: any;
  let testApp: Hono<TestEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();

    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
    } as any;

    testApp = new Hono<TestEnv>();
    testApp.use("*", async (c, next) => {
      c.set("db", mockDb);
      await next();
    });
    testApp.route("/", communicationsRouter);
  });

  afterEach(() => {
    globalThis.fetch = globalFetch;
  });

  it("GET /stats - returns active users count", async () => {
    mockDb.execute.mockResolvedValueOnce([
      { email: "test1@test.com" },
      { email: "test2@test.com" },
      { email: null }
    ]);

    const res = await testApp.request("/stats", {}, {}, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { activeUsers?: number };
    expect(body.activeUsers).toBe(2);
  });

  it("GET /stats - returns 500 when DB is null", async () => {
    const errorApp = new Hono<TestEnv>();
    errorApp.use("*", async (c, next) => {
      c.set("db", null as any);
      await next();
    });
    errorApp.route("/", communicationsRouter);

    const res = await errorApp.request("/stats", {}, {}, mockExecutionContext);
    expect(res.status).toBe(500);
    const body = await res.json() as { success?: boolean; error?: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe("Database not initialized");
  });

  it("GET /stats - handles DB error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB Connection Error"));

    const res = await testApp.request("/stats", {}, {}, mockExecutionContext);
    expect(res.status).toBe(500);
    const body = await res.json() as { error?: string };
    expect(body.error).toBe("DB Connection Error");
  });

  it("POST /mass-email - returns 400 if API key is missing", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({});
    
    const res = await testApp.request("/mass-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "Test", htmlContent: "<p>Hi</p>" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toContain("Resend API key");
  });

  it("POST /mass-email - returns 400 if no active users", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({ RESEND_API_KEY: "test_key" });
    mockDb.execute.mockResolvedValueOnce([]); // No users

    const res = await testApp.request("/mass-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "Test", htmlContent: "<p>Hi</p>" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toContain("No active users found");
  });

  it("POST /mass-email - handles Resend API failure", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({ RESEND_API_KEY: "test_key" });
    mockDb.execute.mockResolvedValueOnce([{ email: "test@test.com" }]);

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      text: async () => "Unauthorized"
    } as Response);

    const res = await testApp.request("/mass-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "Test", htmlContent: "<p>Hi</p>" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(500);
    const body = await res.json() as { error?: string };
    expect(body.error).toContain("Resend API Error: Unauthorized");
    expect(logSystemError).toHaveBeenCalled();
  });

  it("POST /mass-email - handles Resend Batch payload error", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({ RESEND_API_KEY: "test_key" });
    mockDb.execute.mockResolvedValueOnce([{ email: "test@test.com" }]);

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: { message: "Invalid domain" } })
    } as Response);

    const res = await testApp.request("/mass-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "Test", htmlContent: "<p>Hi</p>" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(500);
    const body = await res.json() as { error?: string };
    expect(body.error).toContain("Resend Batch Error: Invalid domain");
  });

  it("POST /mass-email - sends emails successfully in batches", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({ RESEND_API_KEY: "test_key" });

    // Create 51 users to test batching logic (batch size is 50)
    const mockUsers = Array.from({ length: 51 }, (_, i) => ({ email: `user${i}@test.com` }));
    mockDb.execute.mockResolvedValueOnce(mockUsers);

    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "batch-id" })
    } as Response);

    const res = await testApp.request("/mass-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "Hello", htmlContent: "<p>Hi</p>" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as { success?: boolean; recipientCount?: number };
    expect(body.success).toBe(true);
    expect(body.recipientCount).toBe(51);

    // Expect fetch to have been called twice (1 for 50, 1 for 1)
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(logAuditAction).toHaveBeenCalled();
  });
});

