import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockExecutionContext } from "@/test/utils";
import outreachRouter from "./outreach";
import { createMockOutreach } from "@/test/factories/logisticsFactory";

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
    env.DB.all.mockResolvedValue({ results: mockOutreach });

    const req = new Request("http://localhost/", { method: "GET" });
    const res = await outreachRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.outreach).toHaveLength(2);
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
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO outreach"));
  });
});
