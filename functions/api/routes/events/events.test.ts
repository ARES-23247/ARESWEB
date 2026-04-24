/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext } from "../../../../src/test/utils";
import eventsRouter from "./index";

vi.mock("../../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
    ensureAuth: async (_c: unknown, next: () => Promise<void>) => next(),
    logAuditAction: vi.fn().mockResolvedValue(true),
    getSocialConfig: vi.fn().mockResolvedValue({}),
    getDbSettings: vi.fn().mockResolvedValue({}),
  };
});

describe("Hono Backend - Events Router", () => {
  
  
   
  let mockDb: any;
  let testApp: Hono<any>;
  let env: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      join: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue({ id: "1", title: "Test" }),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      deleteFrom: vi.fn().mockReturnThis(),
    };

    env = {
      DB: {},
      ENVIRONMENT: "test",
      DEV_BYPASS: "true",
    };

    testApp = new Hono<any>();
    testApp.use("*", async (c: any, next: any) => {
      c.set("db", mockDb);
      c.set("user", { id: "1", email: "admin@test.com", role: "admin", member_type: "mentor" });
      await next();
    });
    testApp.route("/", eventsRouter);
  });

  it("GET / - list public events", async () => {
    const res = await testApp.request("/", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.selectFrom).toHaveBeenCalledWith("events");
  });

  it("GET /admin/list - list admin events", async () => {
    const res = await testApp.request("/admin/list", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.selectFrom).toHaveBeenCalledWith("events");
  });

  it("GET /:id - detail view", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "1", title: "Test" });
    const res = await testApp.request("/1", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - create event", async () => {
    const res = await testApp.request("/admin/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "New Event",
        category: "outreach",
        dateStart: "2026-01-01T10:00:00Z",
        dateEnd: "2026-01-01T12:00:00Z",
        location: "Lab",
        description: "Test description",
        isDraft: false
      })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.insertInto).toHaveBeenCalledWith("events");
  });

  it("DELETE /admin/:id - delete event", async () => {
    const res = await testApp.request("/admin/1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.updateTable).toHaveBeenCalledWith("events");
  });

  it("GET /:id/signups - get signups", async () => {
    const res = await testApp.request("/1/signups", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.selectFrom).toHaveBeenCalledWith("event_signups as s");
  });

  it("POST /:id/signups - submit signup", async () => {
    const res = await testApp.request("/1/signups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "some notes" })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.insertInto).toHaveBeenCalledWith("event_signups");
  });
});
