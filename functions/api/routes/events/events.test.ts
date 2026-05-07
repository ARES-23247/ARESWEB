/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAPI handler input validated by Zod schemas */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import type { Context } from "hono";
import { mockExecutionContext } from "../../../../src/test/utils";
import { TestEnv, DrizzleMock } from "../../../../src/test/types";
import eventsRouter from "./index";
import * as shared from "../../middleware";
import { eventHandlers } from "./handlers";

function createDrizzleProxy(dbMock: any): any {
  if (!dbMock) return dbMock;
  if (dbMock.__isDrizzleProxy) return dbMock;

  let isMutation = false;

  const drizzleMethods: any = {
    select: vi.fn().mockImplementation((..._args: any[]) => { isMutation = false; if (dbMock.select) dbMock.select(..._args); return proxy; }),
    from: vi.fn().mockImplementation((..._args: any[]) => { return proxy; }),
    all: vi.fn().mockImplementation((..._args: any[]) => { return dbMock.execute ? dbMock.execute(..._args) : Promise.resolve([]); }),
    get: vi.fn().mockImplementation((..._args: any[]) => { return dbMock.executeTakeFirst ? dbMock.executeTakeFirst(..._args) : Promise.resolve(null); }),
    run: vi.fn().mockImplementation((..._args: any[]) => {
      if (dbMock.execute) return dbMock.execute(..._args).then(() => ({ success: true, meta: { changes: 1 } }));
      return Promise.resolve({ success: true, meta: { changes: 1 } });
    }),
    insert: vi.fn().mockImplementation((..._args: any[]) => { isMutation = true; if (dbMock.insert) dbMock.insert(..._args); return proxy; }),
    update: vi.fn().mockImplementation((..._args: any[]) => { isMutation = true; if (dbMock.update) dbMock.update(..._args); return proxy; }),
    delete: vi.fn().mockImplementation((..._args: any[]) => { isMutation = true; if (dbMock.delete) dbMock.delete(..._args); return proxy; }),
    onConflictDoUpdate: vi.fn().mockImplementation((..._args: any[]) => { return proxy; }),
    leftJoin: vi.fn().mockImplementation((..._args: any[]) => { return proxy; }),
    innerJoin: vi.fn().mockImplementation((..._args: any[]) => { return proxy; }),
    values: vi.fn().mockImplementation((..._args: any[]) => { if (dbMock.values) dbMock.values(..._args); return proxy; }),
    set: vi.fn().mockImplementation((..._args: any[]) => { if (dbMock.set) dbMock.set(..._args); return proxy; }),
    limit: vi.fn().mockImplementation((..._args: any[]) => { if (dbMock.limit) dbMock.limit(..._args); return proxy; }),
    where: vi.fn().mockImplementation((..._args: any[]) => { if (dbMock.where) dbMock.where(..._args); return proxy; }),
    orderBy: vi.fn().mockImplementation((..._args: any[]) => { if (dbMock.orderBy) dbMock.orderBy(..._args); return proxy; }),
    offset: vi.fn().mockImplementation((..._args: any[]) => { if (dbMock.offset) dbMock.offset(..._args); return proxy; }),
    returning: vi.fn().mockImplementation((..._args: any[]) => { return proxy; }),
    __isDrizzleProxy: true
  };

  const proxy = new Proxy(dbMock, {
    get(target, prop) {
      if (prop === 'transaction') return vi.fn().mockImplementation(async (cb: any) => cb(proxy));
      if (prop === 'query') return { userProfiles: { findFirst: vi.fn().mockResolvedValue(null) }, teams: { findFirst: vi.fn().mockResolvedValue(null) }, entities: { findFirst: vi.fn().mockResolvedValue(null) } };
      if (prop === 'then') {
        return function(resolve: any, reject: any) {
          if (isMutation && target.executeTakeFirst) {
             return target.executeTakeFirst().then(() => ({ success: true, meta: { changes: 1 } })).then(resolve, reject);
          } else if (target.execute) {
             return target.execute().then(resolve, reject);
          }
          return Promise.resolve([]).then(resolve, reject);
        };
      }
      if (prop in drizzleMethods) return drizzleMethods[prop as string];
      return target[prop];
    }
  });
  return proxy;
}

vi.mock("kysely", async (importOriginal) => {
  const actual = await importOriginal<typeof import("kysely")>();
  return {
    ...actual,
    sql: Object.assign(vi.fn().mockReturnValue({
      execute: vi.fn().mockResolvedValue({ rows: [{ id: "1", title: "Test", category: "outreach", dateStart: "2026", dateEnd: null, location: "Lab", description: null, coverImage: null, status: "published", isDeleted: 0, seasonId: 1, meetingNotes: null }] })
    }), {
      type: vi.fn().mockReturnThis()
    })
  };
});

vi.mock("../../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
    ensureAuth: async (_c: unknown, next: () => Promise<void>) => next(),
    logAuditAction: vi.fn().mockResolvedValue(true),
    getSocialConfig: vi.fn().mockResolvedValue({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key",
      ZULIP_SITE: "https://test.com",
      GCAL_SERVICE_ACCOUNT_EMAIL: "gcal@test.com",
      GCAL_PRIVATE_KEY: "key",
      CALENDAR_ID: "cal1",
      CALENDAR_ID_INTERNAL: "cal1",
      CALENDAR_ID_OUTREACH: "cal2",
      CALENDAR_ID_EXTERNAL: "cal3"
    }),
    getDbSettings: vi.fn().mockResolvedValue({
      GCAL_SERVICE_ACCOUNT_EMAIL: "gcal@test.com",
      GCAL_PRIVATE_KEY: "key",
      CALENDAR_ID: "cal1"
    }),
    getSessionUser: vi.fn().mockResolvedValue(null),
    sanitizeProfileForPublic: vi.fn().mockImplementation((val: any) => val),
  };
});

vi.mock("../../middleware/cache", () => ({
  edgeCacheMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock("../../../utils/socialSync", () => ({
  dispatchSocials: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../../utils/gcalSync", () => ({
  pushEventToGcal: vi.fn().mockResolvedValue("gcal_123"),
  pullEventsFromGcal: vi.fn().mockResolvedValue([{ title: "Sync Event", dateStart: "2026-01-01T00:00:00Z", gcalEventId: "ext_123" }]),
  deleteEventFromGcal: vi.fn().mockResolvedValue(true)
}));

vi.mock("../../utils/crypto", () => ({
  decrypt: vi.fn().mockImplementation((val: any) => val),
  encrypt: vi.fn().mockImplementation((val: any) => val),
}));

describe("Hono Backend - Events Router", () => {
  
  
   
  let mockDb: DrizzleMock;
  let testApp: Hono<TestEnv>;
  let env: Record<string, unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset socialSync mock to default behavior
    const { dispatchSocials } = await import("../../../utils/socialSync");
    vi.mocked(dispatchSocials).mockResolvedValue(undefined as any);

    mockDb = {
      select: vi.fn().mockReturnThis(),
      selectDistinct: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation((cb: any) => {
        if (typeof cb === 'function') {
          const ebMock = Object.assign(vi.fn().mockReturnThis(), { or: vi.fn().mockReturnThis(), and: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis() }) as any;
          cb(ebMock);
        }
        return mockDb;
      }),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      having: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue({ id: "1", title: "Test" }),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      onConflictDoNothing: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      then: vi.fn().mockResolvedValue([]),
      batch: vi.fn().mockResolvedValue([]),
      transaction: vi.fn().mockImplementation(async (cb: any) => cb(mockDb)),
      all: vi.fn().mockResolvedValue([]),
      run: vi.fn().mockResolvedValue({ success: true }),
      get: vi.fn().mockResolvedValue(null),
      $dynamic: vi.fn().mockReturnThis(),
      query: new Proxy({}, { get: () => ({ findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) }) }),
    } as unknown as DrizzleMock;

    env = {
      DB: {},
      ENVIRONMENT: "test",
      DEV_BYPASS: "true",
    };

    testApp = new Hono<TestEnv>();
    testApp.use("*", async (c: Context<TestEnv>, next: () => Promise<void>) => {
      c.set("db", createDrizzleProxy(mockDb));
      const user = (c.get("sessionUser") as any) || { id: "local-dev", email: "admin@test.com", role: "admin", name: "Local Dev", nickname: "Local Dev", image: null, member_type: "mentor" };
      vi.mocked(shared.getSessionUser).mockResolvedValue(user);
      await next();
    });
    testApp.route("/", eventsRouter);
  });

  afterEach(async () => {
    if (mockExecutionContext.waitUntil.mock.calls.length > 0) {
      const promises = mockExecutionContext.waitUntil.mock.calls.map((call: any) => call[0]);
      await Promise.all(promises);
    }
  });

  it("GET / - list public events", async () => {
    mockDb.execute.mockResolvedValueOnce([]);
    const res = await testApp.request("/", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.select).toHaveBeenCalledWith(expect.anything());
  });

  it("GET / - list public events with locations", async () => {
    mockDb.execute.mockResolvedValueOnce([
      { id: "1", title: "Public", category: "outreach", date_start: "2026-01-01", status: "published", location: "Lab" }
    ]);
    mockDb.execute.mockResolvedValueOnce([
      { name: "Lab", address: "123 Main St" }
    ]);
    const res = await testApp.request("/", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /admin/list - list admin events", async () => {
    mockDb.execute.mockResolvedValueOnce([]);
    const res = await testApp.request("/admin/list", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.select).toHaveBeenCalledWith(expect.anything());
  });

  it("GET /admin/list - list admin events with items", async () => {
    mockDb.execute = vi.fn()
      .mockResolvedValueOnce([
        { id: "1", title: "Admin", category: "internal", status: "published", location: "Lab", date_start: "2026-01-01" }
      ])
      .mockResolvedValueOnce({ value: "2026-01-01" });
    const res = await testApp.request("/admin/list", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /:id - detail view", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "1", title: "Test", date_start: "2026-01-01" });
    const res = await testApp.request("/1", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /calendar-settings - handles database error", async () => {
    const mockDbFail = { select: vi.fn().mockImplementation(() => { throw new Error("Fail"); }) };
    const mockC = { get: vi.fn((key: string) => key === "db" ? mockDbFail : undefined), env, req: { url: "http://localhost/calendar-settings" } };
    const result = await eventHandlers.getCalendarSettings({} as any, mockC as any);
    expect(result.status).toBe(500);
  });

  it("GET /:id - handles location lookup error", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "event1", title: "Test", location: "Lab", date_start: "2026-01-01" });
    // Location lookup fails:
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("No locations table"));
    const res = await testApp.request("/event1", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { event: { location_address: string | null } };
    expect(body.event.location_address).toBeNull();
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

    if (res.status === 500) {
      console.log(await res.text());
    }

    expect(res.status).toBe(200);
    expect(mockDb.insert).toHaveBeenCalledWith(expect.anything());
  });

  it("POST /admin/save - with socials and Zulip failure", async () => {
    const { dispatchSocials } = await import("../../../utils/socialSync");
    const { sendZulipMessage } = await import("../../../utils/zulipSync");
    vi.mocked(dispatchSocials).mockRejectedValueOnce(new Error("Zulip Down"));
    vi.mocked(sendZulipMessage).mockRejectedValueOnce(new Error("Zulip Down"));
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
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
        isDraft: false,
        socials: { zulip: true }
      })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    await Promise.all(vi.mocked(mockExecutionContext.waitUntil).mock.results.map((r: any) => r.value));
  });

  it("POST /admin/save - handles pushEventToGcal failure gracefully", async () => {
    const { pushEventToGcal } = await import("../../../utils/gcalSync");
    vi.mocked(pushEventToGcal).mockRejectedValueOnce(new Error("Gcal error"));

    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ 
        title: "Test", category: "internal", status: "published",
        dateStart: "2026-01-01T10:00:00Z", dateEnd: "2026-01-01T12:00:00Z", location: "Lab"
      }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    await Promise.all(vi.mocked(mockExecutionContext.waitUntil).mock.results.map((r: any) => r.value));
  });

  it("DELETE /admin/:id - delete event", async () => {
    const res = await testApp.request("/admin/1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.update).toHaveBeenCalledWith(expect.anything());
  });

  it("GET /:id/signups - get signups", async () => {
    const res = await testApp.request("/1/signups", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.select).toHaveBeenCalledWith(expect.anything());
  });

  it("POST /:id/signups - submit signup", async () => {
    const res = await testApp.request("/1/signups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "some notes" })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.insert).toHaveBeenCalledWith(expect.anything());
  });
  it("PATCH /admin/:id - update event", async () => {
    const res = await testApp.request("/admin/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated", category: "outreach", dateStart: "2026-01-01T00:00:00Z" })
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.update).toHaveBeenCalledWith(expect.anything());
  });

  it("POST /admin/:id/approve - approve event", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "1", title: "Test", revisionOf: null });
    const res = await testApp.request("/admin/1/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.update).toHaveBeenCalledWith(expect.anything());
  });

  it("POST /admin/:id/approve - with Zulip failure", async () => {
    const { sendZulipMessage } = await import("../../../utils/zulipSync");
    vi.mocked(sendZulipMessage).mockRejectedValueOnce(new Error("Zulip Down"));
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "1", title: "Test", revisionOf: null });
    const res = await testApp.request("/admin/1/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    await Promise.all(vi.mocked(mockExecutionContext.waitUntil).mock.results.map((r: any) => r.value));
  });

  it("POST /admin/:id/reject - reject event", async () => {
    const res = await testApp.request("/admin/1/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.update).toHaveBeenCalledWith(expect.anything());
  });

  it("POST /admin/:id/restore - undelete event", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "1", title: "Test", status: "published" });
    const res = await testApp.request("/admin/1/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.update).toHaveBeenCalledWith(expect.anything());
  });

  it("DELETE /admin/:id/purge - permanently delete event", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ gcalEventId: "test", category: "internal" });
    const res = await testApp.request("/admin/1/purge", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.delete).toHaveBeenCalledWith(expect.anything());
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
    mockDb.executeTakeFirst.mockResolvedValueOnce({
      id: "1",
      title: "Test",
      status: "published",
      category: "internal",
      dateStart: "2026-01-01T10:00:00Z",
      dateEnd: "2026-01-01T12:00:00Z",
      location: "Lab",
      description: "Test description",
      coverImage: null,
      gcalEventId: null,
      meetingNotes: null
    });
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
    // The route calls .select().from().where().all() which uses execute() via the proxy
    // Replace both execute() and all() to reject since the proxy checks both
    mockDb.execute = vi.fn().mockRejectedValueOnce(new Error("DB error"));
    mockDb.all = vi.fn().mockRejectedValueOnce(new Error("DB error"));
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
    // The route calls .select().from().where().get() which uses get() via the proxy
    // Replace both get() and executeTakeFirst() to reject since proxy checks both
    mockDb.get.mockRejectedValueOnce(new Error("DB error"));
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
    expect(mockDb.update).toHaveBeenCalledWith(expect.anything());
  });

  it("PATCH /admin/:id - non-admin creates revision", async () => {
    await testApp.request("/admin/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated" })
    }, { ...env }, { ...mockExecutionContext });
  });

  it("POST /admin/save - db error", async () => {
    (mockDb.insert as any).mockImplementationOnce(() => { throw new Error("DB error") });
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
    mockDb.update.mockImplementationOnce(() => { throw new Error("DB error") });
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
    mockDb.insert.mockImplementationOnce(() => { throw new Error("DB error") });
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

  it.skip("GET / - with search query", async () => {
    // TODO: Fix drizzle-orm sql mock for FTS search
    mockDb.execute.mockResolvedValueOnce({ rows: [{ id: "1", title: "Searched Event" }] });
    const res = await testApp.request("/?q=search", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/:id/approve - approve revision", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "rev1", title: "Revision", revisionOf: "1" });
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "1", title: "Original" });
    const res = await testApp.request("/admin/rev1/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.delete).toHaveBeenCalledWith(expect.anything());
  });

  it("POST /admin/sync - handles GCal failure", async () => {
    const { pullEventsFromGcal } = await import("../../../utils/gcalSync");
    vi.mocked(pullEventsFromGcal).mockRejectedValueOnce(new Error("GCal Fail"));
    const res = await testApp.request("/admin/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(200); // We return 200 with error list
  });

  it("GET /admin/list - handles legacy schema error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("Missing column"));
    mockDb.execute.mockResolvedValueOnce([]); // fallback
    const res = await testApp.request("/admin/list", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PATCH /admin/:id/signups/:userId/attendance - unauthorized for normal user", async () => {
    testApp = new Hono();
    testApp.use("*", async (c, next) => {
      c.set("db", createDrizzleProxy(mockDb));
      const user = { id: "user2", role: "user", member_type: "student", email: "u2@example.com", name: "User 2", nickname: "U2", image: null };
      c.set("sessionUser", user);
      vi.mocked(shared.getSessionUser).mockResolvedValue(user);
      await next();
    });
    testApp.route("/", eventsRouter);

    const res = await testApp.request("/admin/1/signups/user1/attendance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attended: true })
    }, env, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("POST /admin/:id/repush - handles error", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    const res = await testApp.request("/admin/999/repush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socials: ["zulip"] })
    }, env, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("GET / - handles fallback to older schema", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("Column status missing"));
    mockDb.execute.mockResolvedValueOnce([{ id: "1", title: "Legacy", date_start: "2026-01-01" }]);
    const res = await testApp.request("/", {}, env, mockExecutionContext);
    if (res.status !== 200) {
      console.log(await res.text());
    }
    expect(res.status).toBe(200);
  });

  it("POST /admin/:id/repush - handles external tool error", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "1", title: "Test", category: "internal" });
    const { dispatchSocials } = await import("../../../utils/socialSync");
    vi.mocked(dispatchSocials).mockRejectedValueOnce(new Error("Zulip Down"));
    const res = await testApp.request("/admin/1/repush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socials: ["zulip"] })
    }, env, mockExecutionContext);
    expect(res.status).toBe(502);
  });

  it("GET /:id/signups - handles complex diet summary", async () => {
    mockDb.execute.mockResolvedValueOnce([
      { userId: "1", nickname: "User1", dietaryRestrictions: "Vegan, Nut-Free", bringing: null, notes: null, prepHours: 0 },
      { userId: "2", nickname: "User2", dietaryRestrictions: "Vegan", bringing: null, notes: null, prepHours: 0 },
      { userId: "3", nickname: "User3", dietaryRestrictions: null, bringing: null, notes: null, prepHours: 0 }
    ]);
    const res = await testApp.request("/1/signups", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { dietary_summary: Record<string, number> };
    expect(body.dietary_summary["Vegan"]).toBe(2);
    expect(body.dietary_summary["Nut-Free"]).toBe(1);
  });

  it("PATCH /admin/:id/signups/:userId/attendance - handles db error", async () => {
    mockDb.insert.mockImplementationOnce(() => { throw new Error("DB fail") });
    const res = await testApp.request("/admin/1/signups/user1/attendance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attended: true })
    }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/:id/repush - handles GCal error", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "1", title: "Test", category: "internal", gcalEventId: "old" });
    const { pushEventToGcal } = await import("../../../utils/gcalSync");
    vi.mocked(pushEventToGcal).mockRejectedValueOnce(new Error("GCal Down"));
    const res = await testApp.request("/admin/1/repush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socials: [] })
    }, env, mockExecutionContext);
    expect(res.status).toBe(200); // GCal error in repush is caught and logged, returns 200
  });

  it("POST /admin/:id/repush - handles top level error", async () => {
    mockDb.select.mockImplementationOnce(() => { throw new Error("Fatal") });
    const res = await testApp.request("/admin/1/repush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socials: [] })
    }, env, mockExecutionContext);
    expect(res.status).toBe(502);
  });

  it("PATCH /:id/signups/me/attendance - handles db error", async () => {
    mockDb.insert.mockImplementationOnce(() => { throw new Error("DB fail") });
    const res = await testApp.request("/1/signups/me/attendance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attended: true })
    }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /:id/signups - handles db error", async () => {
    mockDb.delete.mockImplementationOnce(() => { throw new Error("DB fail") });
    const res = await testApp.request("/1/signups", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:id - handles db error", async () => {
    mockDb.update.mockImplementationOnce(() => { throw new Error("DB fail") });
    const res = await testApp.request("/admin/1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:id/purge - handles db error", async () => {
    mockDb.select.mockImplementationOnce(() => { throw new Error("DB fail") });
    const res = await testApp.request("/admin/1/purge", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/sync - handles missing config", async () => {
    vi.mocked(shared.getDbSettings).mockResolvedValueOnce({});
    const res = await testApp.request("/admin/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: "GCal config missing" });
  });

  it("POST /admin/sync - handles fatal error", async () => {
    vi.mocked(shared.getDbSettings).mockRejectedValueOnce(new Error("Fatal"));
    const res = await testApp.request("/admin/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: "Sync failed" });
  });

  it("GET /:id/signups - handles unverified user", async () => {
    vi.mocked(shared.getSessionUser).mockResolvedValueOnce({ id: "unv-1", email: "unv@test.com", role: "unverified", name: "Unv", nickname: "Unv", image: null, member_type: "student" });
    mockDb.execute.mockResolvedValueOnce([]);
    const res = await testApp.request("/1/signups", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { signups: unknown[] };
    expect(body.signups).toHaveLength(0);
  });

  it("GET /admin/list - handles error without fallback", async () => {
    mockDb.execute.mockRejectedValue(new Error("Total fail"));
    const res = await testApp.request("/admin/list", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/:id/reject - handles db error", async () => {
    mockDb.update.mockImplementationOnce(() => { throw new Error("DB fail") });
    const res = await testApp.request("/admin/1/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/:id/restore - handles db error", async () => {
    mockDb.update.mockImplementationOnce(() => { throw new Error("DB fail") });
    const res = await testApp.request("/admin/1/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/:id/restore - handles gcal error in wait", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "1", title: "Test", status: "published", category: "internal" });
    const { pushEventToGcal } = await import("../../../utils/gcalSync");
    vi.mocked(pushEventToGcal).mockRejectedValueOnce(new Error("GCal fail"));
    
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await testApp.request("/admin/1/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    // Flush waitUntil promises
    await Promise.all(vi.mocked(mockExecutionContext.waitUntil).mock.results.map((r: any) => r.value));
    expect(consoleSpy).toHaveBeenCalledWith("GCAL_UNDELETE_FAIL", expect.any(Error));
    consoleSpy.mockRestore();
  });

  it("DELETE /admin/:id - handles gcal delete", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "1", recurringGroupId: null, date_start: "2026-01-01", gcalEventId: "gcal-1", category: "internal" });
    const { deleteEventFromGcal } = await import("../../../utils/gcalSync");
    const res = await testApp.request("/admin/1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    await Promise.all(vi.mocked(mockExecutionContext.waitUntil).mock.results.map((r: any) => r.value));
    expect(deleteEventFromGcal).toHaveBeenCalled();
  });

  it("POST /admin/:id/approve - handles gcal fail", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "1", title: "Test", category: "internal" });
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "1", title: "Test", category: "internal" }); // second for wait
    const { pushEventToGcal } = await import("../../../utils/gcalSync");
    vi.mocked(pushEventToGcal).mockRejectedValueOnce(new Error("GCal fail"));
    
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await testApp.request("/admin/1/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    await Promise.all(vi.mocked(mockExecutionContext.waitUntil).mock.results.map((r: any) => r.value));
    expect(consoleSpy).toHaveBeenCalledWith("GCAL_APPROVE_FAIL", expect.any(Error));
    consoleSpy.mockRestore();
  });

  it("PATCH /admin/:id - handles non-admin revision", async () => {
    vi.mocked(shared.getSessionUser).mockResolvedValueOnce({ id: "author-1", email: "author@test.com", role: "author", name: "Author", nickname: "Author", image: null, member_type: "student" });
    
    testApp = new Hono();
    testApp.use("*", async (c, next) => {
      c.set("db", createDrizzleProxy(mockDb));
      c.set("sessionUser", { id: "author-1", role: "author" } as any);
      await next();
    });
    testApp.route("/", eventsRouter);

    const res = await testApp.request("/admin/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Title", category: "internal", dateStart: "2026-01-01T00:00:00Z" })
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.insert).toHaveBeenCalledWith(expect.anything());
    const body = await res.json() as { id: string };
    expect(body.id).toContain("-rev-");
  });

  it("PATCH /admin/:id - handles gcal fail in wait", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ gcalEventId: "old" });
    const { pushEventToGcal } = await import("../../../utils/gcalSync");
    vi.mocked(pushEventToGcal).mockRejectedValueOnce(new Error("GCal fail"));
    
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await testApp.request("/admin/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New", category: "internal", dateStart: "2026-01-01T00:00:00Z" })
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    await Promise.all(vi.mocked(mockExecutionContext.waitUntil).mock.results.map((r: any) => r.value));
    expect(consoleSpy).toHaveBeenCalledWith("GCAL_UPDATE_FAIL", expect.any(Error));
    consoleSpy.mockRestore();
  });

  it("PATCH /admin/:id - handles db fail", async () => {
    mockDb.update.mockImplementationOnce(() => { throw new Error("DB fail") });
    const res = await testApp.request("/admin/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New", category: "internal", dateStart: "2026-01-01T00:00:00Z" })
    }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/:id/approve - handles db fail", async () => {
    mockDb.select.mockImplementationOnce(() => { throw new Error("DB fail") });
    const res = await testApp.request("/admin/1/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /admin/:id - handles error with fallback", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("Schema fail"));
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "1", title: "Fallback", date_start: "2026-01-01" });
    const res = await testApp.request("/admin/1", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /admin/:id - handles fatal error", async () => {
    mockDb.select.mockImplementationOnce(() => { throw new Error("Fatal 1") });
    mockDb.select.mockImplementationOnce(() => { throw new Error("Fatal 2") });
    const res = await testApp.request("/admin/1", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/save - handles double submission", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "recent-1" });
    const res = await testApp.request("/admin/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Recent", category: "internal", dateStart: "2026-01-01T00:00:00Z" })
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { warning?: string };
    expect(body.warning).toBe("Double-submission prevented");
  });

  it("POST /admin/save - handles gcal fail in wait", async () => {
    vi.mocked(shared.getSessionUser).mockResolvedValueOnce({ id: "admin-1", email: "admin@test.com", role: "admin", name: "Admin", nickname: "Admin", image: null, member_type: "mentor" });
    vi.mocked(shared.getSocialConfig).mockResolvedValueOnce({
      GCAL_SERVICE_ACCOUNT_EMAIL: "gcal@test.com",
      GCAL_PRIVATE_KEY: "key",
      CALENDAR_ID: "cal1"
    });
    
    const { pushEventToGcal } = await import("../../../utils/gcalSync");
    vi.mocked(pushEventToGcal).mockRejectedValueOnce(new Error("GCal fail"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const testEnv = {
      DB: mockDb,
      GCAL_SERVICE_ACCOUNT_EMAIL: "gcal@test.com",
      GCAL_PRIVATE_KEY: "key"
    };

    const res = await testApp.request("/admin/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "New",
        category: "internal",
        dateStart: "2026-01-01T00:00:00Z",
        isDraft: false,
        id: "new-evt-1"
      })
    }, testEnv as unknown as Partial<TestEnv["Bindings"]>, mockExecutionContext);
    expect(res.status).toBe(200);
    
    console.log("WAIT_UNTIL_CALLS", vi.mocked(mockExecutionContext.waitUntil).mock.calls.length);

    // Flush waitUntil promises
    await Promise.all(vi.mocked(mockExecutionContext.waitUntil).mock.results.map((r: any) => r.value));
    
    expect(pushEventToGcal).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/GCAL_(SAVE|UPDATE)_FAIL/), expect.any(Error));
    consoleSpy.mockRestore();
  });
});

