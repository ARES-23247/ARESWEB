import { describe, it, expect, vi, beforeEach } from "vitest";
import { locationsRouter, adminLocationsRouter } from "./locations";
import { mockExecutionContext } from "../../../src/test/utils";

describe("Hono Backend - /locations Router", () => {
  let env: { DB: Record<string, ReturnType<typeof vi.fn>>; DEV_BYPASS: string };

  beforeEach(() => {
    vi.clearAllMocks();
    env = {
      DB: {
        prepare: vi.fn().mockReturnThis(),
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
      },
      DEV_BYPASS: "true",
    };
  });

  it("GET / - list locations", async () => {
    const mockLocs = [{ id: "1", name: "HQ", address: "123 Main" }];
    env.DB.all.mockResolvedValue({ results: mockLocs });

    const req = new Request("http://localhost/");
    const res = await locationsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as { locations: unknown[] };
    expect(body.locations).toHaveLength(1);
  });

  it("POST / - create location (admin)", async () => {
    const req = new Request("http://localhost/", {
      method: "POST",
      body: JSON.stringify({ name: "New", address: "Addr" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await adminLocationsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("GET / - handles DB errors", async () => {
    env.DB.all.mockRejectedValueOnce(new Error("DB error"));
    const req = new Request("http://localhost/");
    const res = await locationsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { locations: unknown[] };
    expect(body.locations).toEqual([]);
  });

  it("POST / - handles DB errors", async () => {
    env.DB.run.mockRejectedValueOnce(new Error("DB error"));
    const req = new Request("http://localhost/", {
      method: "POST",
      body: JSON.stringify({ name: "New", address: "Addr" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await adminLocationsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("PUT /:id - updates location", async () => {
    const req = new Request("http://localhost/123", {
      method: "PUT",
      body: JSON.stringify({ name: "Updated", address: "Updated Addr" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await adminLocationsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PUT /:id - handles DB errors", async () => {
    env.DB.run.mockRejectedValueOnce(new Error("DB error"));
    const req = new Request("http://localhost/123", {
      method: "PUT",
      body: JSON.stringify({ name: "Updated", address: "Updated Addr" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await adminLocationsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /:id - soft deletes location", async () => {
    const req = new Request("http://localhost/123", { method: "DELETE" });
    const res = await adminLocationsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("DELETE /:id - handles DB errors", async () => {
    env.DB.run.mockRejectedValueOnce(new Error("DB error"));
    const req = new Request("http://localhost/123", { method: "DELETE" });
    const res = await adminLocationsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });
});
