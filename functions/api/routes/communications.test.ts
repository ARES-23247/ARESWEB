/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAPI handler input validated by Zod schemas */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TestEnv, MockDrizzle } from "../../../src/test/types";
import { Hono } from "hono";
import { mockExecutionContext, createMockDrizzle } from "../../../src/test/utils";
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
  let mockDb: MockDrizzle;
  let testApp: Hono<TestEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();

    mockDb = createMockDrizzle();

    testApp = new Hono<TestEnv>();
    testApp.use("*", async (c, next) => {
      c.set("db", mockDb as any);
      await next();
    });
    testApp.route("/", communicationsRouter);
  });

  afterEach(() => {
    globalThis.fetch = globalFetch;
  });

  it("GET /stats - returns active users count", async () => {
    // Handler does: db.select({ email: schema.user.email }).from(schema.user)
    // With mockReturnThis, select().from() returns mockDb, then await triggers .all()
    mockDb.all.mockResolvedValueOnce([
      { email: "test1@test.com" },
      { email: "test2@test.com" },
      { email: null }
    ]);

    const res = await testApp.request("/stats", {}, {}, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { activeUsers?: number };
    expect(body.activeUsers).toBe(2);
  });

  it("GET /stats - returns 500 when getDb throws", async () => {
    // Make the DB throw when any chain method is called
    mockDb.select.mockImplementationOnce(() => { throw new Error("Database not initialized"); });

    const res = await testApp.request("/stats", {}, {}, mockExecutionContext);
    expect(res.status).toBe(500);
    const body = await res.json() as { success?: boolean; error?: string };
    expect(body.success).toBe(false);
  });

  it("GET /stats - handles DB error", async () => {
    // Handler does: await db.select({}).from(table) — proxy resolves via .all()
    mockDb.all.mockRejectedValueOnce(new Error("DB Connection Error"));

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
    // Handler does: await db.select({}).from(table) — proxy resolves via .all()
    mockDb.all.mockResolvedValueOnce([]); // No users

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
    mockDb.all.mockResolvedValueOnce([{ email: "test@test.com" }]);

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
    mockDb.all.mockResolvedValueOnce([{ email: "test@test.com" }]);

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
    mockDb.all.mockResolvedValueOnce(mockUsers);

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
