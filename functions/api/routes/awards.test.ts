/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import awardsRouter from "./awards";
import { mockExecutionContext } from "../../../src/test/utils";

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (c: any, next: any) => next(),
    logAuditAction: vi.fn().mockResolvedValue(true),
  };
});

describe("Hono Backend - /awards Router", () => {
  const env = {
    DB: {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true }),
    } as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET / should list all awards", async () => {
    env.DB.all.mockResolvedValueOnce({ results: [{ id: "a1", title: "Award" }] });
    const req = new Request("http://localhost/");
    const res = await awardsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.awards).toHaveLength(1);
  });

  it("GET / should handle DB errors", async () => {
    env.DB.all.mockRejectedValueOnce(new Error("DB Error"));
    const req = new Request("http://localhost/");
    const res = await awardsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
    const data = await res.json() as any;
    expect(data.error).toBeDefined();
  });

  it("POST / should insert new award", async () => {
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Award", year: 2026 })
    });
    const res = await awardsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST / should update existing award", async () => {
    env.DB.first.mockResolvedValueOnce({ id: "a1" });
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "a1", title: "Updated Award", year: 2026 })
    });
    const res = await awardsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST / should reject invalid payload", async () => {
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}) // missing title/year
    });
    const res = await awardsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(400); // zod validation
  });

  it("POST / should handle DB errors", async () => {
    env.DB.run.mockRejectedValueOnce(new Error("DB Error"));
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Award", year: 2026 })
    });
    const res = await awardsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /:id should soft-delete an award", async () => {
    const req = new Request("http://localhost/a1", { method: "DELETE" });
    const res = await awardsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("DELETE /:id should handle DB errors", async () => {
    env.DB.run.mockRejectedValueOnce(new Error("DB Error"));
    const req = new Request("http://localhost/a1", { method: "DELETE" });
    const res = await awardsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });
});
