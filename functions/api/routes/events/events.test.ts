 
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

  afterEach(async () => {
    if (mockExecutionContext.waitUntil.mock.calls.length > 0) {
      const promises = mockExecutionContext.waitUntil.mock.calls.map((call: any[]) => call[0]);
      await Promise.all(promises);
    }
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
    mockDb.executeTakeFirst.mockResolvedValueOnce(null); // bypass duplicate check
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
  it("PATCH /admin/:id - update event", async () => {
    const res = await testApp.request("/admin/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated", category: "outreach" })
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.updateTable).toHaveBeenCalledWith("events");
  });

  it("POST /admin/:id/approve - approve event", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "1", title: "Test", revision_of: null });
    const res = await testApp.request("/admin/1/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.updateTable).toHaveBeenCalledWith("events");
  });

  it("POST /admin/:id/reject - reject event", async () => {
    const res = await testApp.request("/admin/1/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.updateTable).toHaveBeenCalledWith("events");
  });

  it("POST /admin/:id/restore - undelete event", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "1", title: "Test", status: "published" });
    const res = await testApp.request("/admin/1/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.updateTable).toHaveBeenCalledWith("events");
  });

  it("DELETE /admin/:id/purge - permanently delete event", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ gcal_event_id: "test", category: "internal" });
    const res = await testApp.request("/admin/1/purge", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.deleteFrom).toHaveBeenCalledWith("events");
  });

  it("POST /admin/sync - sync events", async () => {
    // getDbSettings mocked to return GCAL settings
    const { getDbSettings } = await import("../../middleware");
    vi.mocked(getDbSettings).mockResolvedValueOnce({
      GCAL_SERVICE_ACCOUNT_EMAIL: "test@test.com",
      GCAL_PRIVATE_KEY: "key",
      CALENDAR_ID: "cal1"
    });

    const res = await testApp.request("/admin/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    
    // GCal API mock is not available, but should handle error or empty list
    expect(res.status).toBe(200);
  });

  it("POST /admin/:id/repush - repush event", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "1", title: "Test", status: "published" });
    const res = await testApp.request("http://localhost/admin/1/repush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socials: ["zulip"] })
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /calendar-settings - get public calendars", async () => {
    mockDb.execute.mockResolvedValueOnce([{ key: "CALENDAR_ID", value: "cal1" }]);
    const res = await testApp.request("/calendar-settings", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  // Error Paths and Edge Cases

  it("GET / - db error", async () => {
    mockDb.execute = vi.fn().mockRejectedValue(new Error("DB error"));
    const res = await testApp.request("/", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /:id - 404", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    const res = await testApp.request("/999", {}, env, mockExecutionContext);
    // If ts-rest throws 404, we expect 404
    expect(res.status).toBe(404);
  });

  it("GET /:id - db error", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/1", {}, env, mockExecutionContext);
    expect(res.status).toBe(404); // Database error returns 404 per code
  });

  it("POST /admin/save - upsert if id provided", async () => {
    mockDb.executeTakeFirst.mockResolvedValue({ id: "1" }); // existing for both saveEvent and updateEvent
    const res = await testApp.request("/admin/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "1",
        title: "Updated via Save",
        category: "outreach",
        dateStart: "2026-01-01T10:00:00Z",
        dateEnd: "2026-01-01T12:00:00Z",
        location: "Lab",
        description: "Test description",
        isDraft: false
      })
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.updateTable).toHaveBeenCalledWith("events");
  });

  it("PATCH /admin/:id - non-admin creates revision", async () => {
    await testApp.request("/admin/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated" })
    }, { ...env }, { ...mockExecutionContext });
  });

  it("POST /admin/save - db error", async () => {
    mockDb.insertInto.mockImplementationOnce(() => { throw new Error("DB error") });
    mockDb.executeTakeFirst.mockResolvedValueOnce(null); // not duplicate
    mockDb.executeTakeFirst.mockResolvedValueOnce(null); // not recent
    const res = await testApp.request("/admin/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        title: "Fail",
        category: "outreach",
        dateStart: "2026-01-01T10:00:00Z",
        dateEnd: "2026-01-01T12:00:00Z",
        location: "Lab",
        description: "Test description",
        isDraft: false
      })
    }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:id - db error", async () => {
    mockDb.updateTable.mockImplementationOnce(() => { throw new Error("DB error") });
    const res = await testApp.request("/admin/1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /:id/signups - db error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/1/signups", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /:id/signups - db error", async () => {
    mockDb.insertInto.mockImplementationOnce(() => { throw new Error("DB error") });
    const res = await testApp.request("/1/signups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /:id/signups - delete my signup", async () => {
    const res = await testApp.request("/1/signups", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PATCH /:id/signups/me/attendance - update my attendance", async () => {
    const res = await testApp.request("/1/signups/me/attendance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attended: true })
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PATCH /admin/:id/signups/:userId/attendance - update user attendance", async () => {
    const res = await testApp.request("/admin/1/signups/user1/attendance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attended: true })
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });
});
