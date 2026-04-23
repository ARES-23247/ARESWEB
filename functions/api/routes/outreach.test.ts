import { describe, it, expect, vi, beforeEach } from "vitest";
import outreachRouter from "./outreach";
import { createMockOutreach } from "../../../src/test/factories/logisticsFactory";
import { mockExecutionContext } from "../../../src/test/utils";

describe("Hono Backend - /outreach Router", () => {
  let env: { DB: Record<string, ReturnType<typeof vi.fn>>; DEV_BYPASS: string };

  beforeEach(() => {
    vi.clearAllMocks();
    env = {
      DB: {
        prepare: vi.fn().mockReturnThis(),
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(null),
      },
      DEV_BYPASS: "true",
    };
  });

  it("should list all outreach records", async () => {
    const mockOutreach = [createMockOutreach(), createMockOutreach()];
    // First call for direct logs
    env.DB.all.mockResolvedValueOnce({ results: mockOutreach });
    // Second call for volunteer events
    env.DB.all.mockResolvedValueOnce({ results: [] });

    const req = new Request("http://localhost/", { method: "GET" });
    const res = await outreachRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as { logs: unknown[] };
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
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO outreach_logs"));
  });

  it("should update outreach record if id exists (admin)", async () => {
    env.DB.first.mockResolvedValueOnce({ id: "log1" }); // mock exists check
    const payload = { id: "log1", title: "Updated", date: "2024-05-01" };
    const req = new Request("http://localhost/", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });
    const res = await outreachRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE outreach_logs"));
  });

  it("POST / should handle missing fields", async () => {
    const req = new Request("http://localhost/", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await outreachRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(400);
  });

  it("POST / should handle DB errors", async () => {
    env.DB.run.mockRejectedValueOnce(new Error("DB error"));
    const payload = { title: "Test Outreach", date: "2024-05-01" };
    const req = new Request("http://localhost/", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });
    const res = await outreachRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /:id should soft-delete", async () => {
    const req = new Request("http://localhost/123", { method: "DELETE" });
    const res = await outreachRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("DELETE /:id should handle DB errors", async () => {
    env.DB.run.mockRejectedValueOnce(new Error("DB error"));
    const req = new Request("http://localhost/123", { method: "DELETE" });
    const res = await outreachRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET / should handle main DB errors", async () => {
    env.DB.all.mockRejectedValueOnce(new Error("DB error"));
    const req = new Request("http://localhost/", { method: "GET" });
    const res = await outreachRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET / should handle volunteer events DB errors", async () => {
    env.DB.all.mockResolvedValueOnce({ results: [] }); // logs success
    env.DB.all.mockRejectedValueOnce(new Error("DB error")); // volunteer fail
    const req = new Request("http://localhost/", { method: "GET" });
    const res = await outreachRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { logs: unknown[] };
    expect(body.logs).toEqual([]);
  });
});
