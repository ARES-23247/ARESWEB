import { describe, it, expect, vi, beforeEach } from "vitest";
import outreachRouter from "./outreach";
import { createMockOutreach } from "../../../src/test/factories/logisticsFactory";
import { mockExecutionContext } from "../../../src/test/utils";

describe("Hono Backend - /outreach Router", () => {
  const env = {
    DB: {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn(),
      run: vi.fn().mockResolvedValue({ success: true }),
    } as any,
    DEV_BYPASS: "true",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list all outreach records", async () => {
    const mockOutreach = [createMockOutreach(), createMockOutreach()];
    // Mock the direct outreach logs query
    env.DB.all.mockResolvedValueOnce({ results: mockOutreach });
    // Mock the volunteer events query
    env.DB.all.mockResolvedValueOnce({ results: [] });

    const req = new Request("http://localhost/", { method: "GET" });
    const res = await outreachRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.logs).toHaveLength(2);
  });

  it("should create outreach record (admin)", async () => {
    const payload = { title: "Test Outreach", date: "2024-05-01", hours: 5, description: "Test" };
    const req = new Request("http://localhost/", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });
    const res = await outreachRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });
});
