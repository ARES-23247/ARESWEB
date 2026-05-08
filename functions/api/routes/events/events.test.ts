import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import type { Context } from "hono";
import { AppEnv } from "../../middleware";
import eventsRouter from "./index";
import * as shared from "../../middleware";
import { eventHandlers } from "./handlers";
import type {
  DbRows,
  MockFn,
  QueryBuilderProxy,
} from "../../../test/testTypes";

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
    sanitizeProfileForPublic: vi.fn().mockImplementation((val: unknown) => val),
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
  decrypt: vi.fn().mockImplementation((val: unknown) => val),
  encrypt: vi.fn().mockImplementation((val: unknown) => val),
}));

const mockExecutionContext = {
  waitUntil: vi.fn(),
};

describe("Hono Backend - Events Router", () => {
  let app: Hono<AppEnv>;

  // Simple inline mock database using Proxy pattern with proper types
  const createMockDb = (): QueryBuilderProxy => {
      const allFn = vi.fn().mockResolvedValue<DbRows>([]);
      const getFn = vi.fn().mockResolvedValue(null);
      const runFn = vi.fn().mockResolvedValue({ success: true });

      const fns: Record<string, MockFn> = {
        all: allFn,
        get: getFn,
        run: runFn,
        execute: allFn,
        executeTakeFirst: getFn,
        first: getFn
      };

      const chainable = new Proxy(fns, {
        get: (target, prop) => {
          if (prop === 'then') {
            return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
              Promise.resolve(fns.all()).then(resolve).catch(reject);
          }
          if (prop === 'catch') {
            return (reject: (reason: unknown) => unknown) => Promise.resolve(fns.all()).catch(reject);
          }
          if (prop === 'finally') {
            return (cb: () => void) => Promise.resolve(fns.all()).finally(cb);
          }
          if (prop === 'query') {
             return new Proxy({}, {
                get: () => new Proxy({}, {
                   get: (_tTarget, tProp) => {
                      if (tProp === 'findFirst') return fns.get;
                      if (tProp === 'findMany') return fns.all;
                      return vi.fn().mockReturnValue(chainable);
                   }
                })
             });
          }
          if (prop in target) return target[prop as string];
          if (prop === 'transaction') return vi.fn(async (cb: (tx: typeof chainable) => Promise<unknown>) => cb(chainable));
          if (typeof prop === 'symbol') return chainable;
          target[prop as string] = vi.fn().mockReturnValue(chainable);
          return target[prop as string];
        }
      }) as QueryBuilderProxy;
      return chainable;
    };

  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset socialSync mock to default behavior
    const { dispatchSocials } = await import("../../../utils/socialSync");
    vi.mocked(dispatchSocials).mockResolvedValue(undefined as never);

    mockDb = createMockDb();

    app = new Hono<AppEnv>();
    app.use("*", async (c: Context<AppEnv>, next: () => Promise<void>) => {
      c.set("db", mockDb as never);
      const defaultUser = { id: "local-dev", email: "admin@test.com", role: "admin", name: "Local Dev", nickname: "Local Dev", image: null, member_type: "mentor" };
      const user = (c.get("sessionUser") as typeof defaultUser | undefined) ?? defaultUser;
      vi.mocked(shared.getSessionUser).mockResolvedValue(user);
      await next();
    });
    app.route("/", eventsRouter);
  });

  afterEach(async () => {
    if (mockExecutionContext.waitUntil.mock.calls.length > 0) {
      const promises = mockExecutionContext.waitUntil.mock.calls.map((call: unknown[]) => call[0] as Promise<unknown>);
      await Promise.all(promises);
    }
  });

  it("GET / - list public events", async () => {
    mockDb.execute.mockResolvedValueOnce([]);
    const res = await app.request("/", {}, {} as never, mockExecutionContext as never);
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
    const res = await app.request("/", {}, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
  });

  it("GET /admin/list - list admin events", async () => {
    mockDb.execute.mockResolvedValueOnce([]);
    const res = await app.request("/admin/list", {}, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
    expect(mockDb.select).toHaveBeenCalledWith(expect.anything());
  });

  it("GET /admin/list - list admin events with items", async () => {
    mockDb.execute = vi.fn()
      .mockResolvedValueOnce([
        { id: "1", title: "Admin", category: "internal", status: "published", location: "Lab", date_start: "2026-01-01" }
      ])
      .mockResolvedValueOnce({ value: "2026-01-01" });
    const res = await app.request("/admin/list", {}, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
  });

  it("GET /:id - detail view", async () => {
    mockDb.get.mockResolvedValueOnce({ id: "1", title: "Test", date_start: "2026-01-01" });
    const res = await app.request("/1", {}, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
  });

  it("GET /calendar-settings - handles database error", async () => {
    const mockDbFail = { select: vi.fn().mockImplementation(() => { throw new Error("Fail"); }) };
    const mockC = { get: vi.fn((key: string) => key === "db" ? mockDbFail : undefined), env: {}, req: { url: "http://localhost/calendar-settings" } };
    const result = await eventHandlers.getCalendarSettings({} as never, mockC as never);
    expect(result.status).toBe(500);
  });

  it("GET /:id - handles location lookup error", async () => {
    mockDb.get.mockResolvedValueOnce({ id: "event1", title: "Test", location: "Lab", date_start: "2026-01-01" });
    // Location lookup fails:
    mockDb.all.mockRejectedValueOnce(new Error("No locations table"));
    mockDb.get.mockRejectedValueOnce(new Error("No locations table"));
    mockDb.run.mockRejectedValueOnce(new Error("No locations table"));
    mockDb.first.mockRejectedValueOnce(new Error("No locations table"));
    const res = await app.request("/event1", {}, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
    const body = await res.json() as { event: { location_address: string | null } };
    expect(body.event.location_address).toBeNull();
  });

  it("POST /admin/save - create event", async () => {
    mockDb.get.mockResolvedValueOnce(null); // bypass duplicate check
    const res = await app.request("/admin/save", {
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
    }, {} as never, mockExecutionContext as never);

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
    mockDb.get.mockResolvedValueOnce(null);
    const res = await app.request("/admin/save", {
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
    }, {} as never, mockExecutionContext as never);

    expect(res.status).toBe(200);
    await Promise.all(vi.mocked(mockExecutionContext.waitUntil).mock.results.map((r) => r.value).filter((v): v is Promise<unknown> => v !== undefined));
  });

  it("POST /admin/save - handles pushEventToGcal failure gracefully", async () => {
    const { pushEventToGcal } = await import("../../../utils/gcalSync");
    vi.mocked(pushEventToGcal).mockRejectedValueOnce(new Error("Gcal error"));

    mockDb.get.mockResolvedValueOnce(null);
    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({
        title: "Test", category: "internal", status: "published",
        dateStart: "2026-01-01T10:00:00Z", dateEnd: "2026-01-01T12:00:00Z", location: "Lab"
      }),
      headers: { "Content-Type": "application/json" }
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
    await Promise.all(vi.mocked(mockExecutionContext.waitUntil).mock.results.map((r) => r.value).filter((v): v is Promise<unknown> => v !== undefined));
  });

  it("DELETE /admin/:id - delete event", async () => {
    const res = await app.request("/admin/1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, {} as never, mockExecutionContext as never);

    expect(res.status).toBe(200);
    expect(mockDb.update).toHaveBeenCalledWith(expect.anything());
  });

  it("GET /:id/signups - get signups", async () => {
    const res = await app.request("/1/signups", {}, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
    expect(mockDb.select).toHaveBeenCalledWith(expect.anything());
  });

  it("POST /:id/signups - submit signup", async () => {
    const res = await app.request("/1/signups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "some notes" })
    }, {} as never, mockExecutionContext as never);

    expect(res.status).toBe(200);
    expect(mockDb.insert).toHaveBeenCalledWith(expect.anything());
  });
  it("PATCH /admin/:id - update event", async () => {
    mockDb.get.mockResolvedValueOnce({ id: "1", title: "Test", category: "internal" });
    const res = await app.request("/admin/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated", category: "outreach", dateStart: "2026-01-01T00:00:00Z" })
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
    expect(mockDb.run).toHaveBeenCalled();
  });

  it("POST /admin/:id/approve - approve event", async () => {
    mockDb.get.mockResolvedValueOnce({ id: "1", title: "Test", revisionOf: null });
    const res = await app.request("/admin/1/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
    expect(mockDb.update).toHaveBeenCalledWith(expect.anything());
  });

  it("POST /admin/:id/approve - with Zulip failure", async () => {
    const { sendZulipMessage } = await import("../../../utils/zulipSync");
    vi.mocked(sendZulipMessage).mockRejectedValueOnce(new Error("Zulip Down"));
    mockDb.get.mockResolvedValueOnce({ id: "1", title: "Test", revisionOf: null });
    const res = await app.request("/admin/1/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
    await Promise.all(vi.mocked(mockExecutionContext.waitUntil).mock.results.map((r) => r.value).filter((v): v is Promise<unknown> => v !== undefined));
  });

  it("POST /admin/:id/reject - reject event", async () => {
    const res = await app.request("/admin/1/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
    expect(mockDb.update).toHaveBeenCalledWith(expect.anything());
  });

  it("POST /admin/:id/restore - undelete event", async () => {
    mockDb.get.mockResolvedValueOnce({ id: "1", title: "Test", status: "published" });
    const res = await app.request("/admin/1/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
    expect(mockDb.update).toHaveBeenCalledWith(expect.anything());
  });

  it("DELETE /admin/:id/purge - permanently delete event", async () => {
    mockDb.get.mockResolvedValueOnce({ gcalEventId: "test", category: "internal" });
    const res = await app.request("/admin/1/purge", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, {} as never, mockExecutionContext as never);
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

    const res = await app.request("/admin/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, {} as never, mockExecutionContext as never);

    // GCal API mock is not available, but should handle error or empty list
    expect(res.status).toBe(200);
  });

  it("POST /admin/:id/repush - repush event", async () => {
    mockDb.get.mockResolvedValueOnce({
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
    const res = await app.request("http://localhost/admin/1/repush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socials: ["zulip"] })
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
  });

  it("GET /calendar-settings - get public calendars", async () => {
    mockDb.all.mockResolvedValueOnce([{ key: "CALENDAR_ID", value: "cal1" }]);
    const res = await app.request("/calendar-settings", {}, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
  });

  // Error Paths and Edge Cases

  it("GET / - db error", async () => {
    // The route calls .select().from().where().all() which uses execute() via the proxy
    // Replace both execute() and all() to reject since the proxy checks both
    mockDb.execute = vi.fn().mockRejectedValueOnce(new Error("DB error"));
    mockDb.all = vi.fn().mockRejectedValueOnce(new Error("DB error"));
    const res = await app.request("/", {}, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(500);
  });

  it("GET /:id - 404", async () => {
    mockDb.get.mockResolvedValueOnce(null);
    const res = await app.request("/999", {}, {} as never, mockExecutionContext as never);
    // If ts-rest throws 404, we expect 404
    expect(res.status).toBe(404);
  });

  it("GET /:id - db error", async () => {
    // The route calls .select().from().where().get() which uses get() via the proxy
    // Replace both get() and get() to reject since proxy checks both
    mockDb.all.mockRejectedValueOnce(new Error("DB error"));
    mockDb.get.mockRejectedValueOnce(new Error("DB error"));
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    mockDb.first.mockRejectedValueOnce(new Error("DB error"));
    mockDb.all.mockRejectedValueOnce(new Error("DB error"));
    mockDb.get.mockRejectedValueOnce(new Error("DB error"));
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    mockDb.first.mockRejectedValueOnce(new Error("DB error"));
    const res = await app.request("/1", {}, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(404); // Database error returns 404 per code
  });

  it("POST /admin/save - upsert if id provided", async () => {
    mockDb.get.mockResolvedValue({ id: "1" }); // existing for both saveEvent and updateEvent
    const res = await app.request("/admin/save", {
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
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
    expect(mockDb.update).toHaveBeenCalledWith(expect.anything());
  });

  it("PATCH /admin/:id - non-admin creates revision", async () => {
    await app.request("/admin/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated" })
    }, {} as never, { ...mockExecutionContext } as never);
  });

  it("POST /admin/save - db error", async () => {
    (mockDb.insert as ReturnType<typeof vi.fn>).mockImplementationOnce(() => { throw new Error("DB error") });
    mockDb.get.mockResolvedValueOnce(null); // not duplicate
    mockDb.get.mockResolvedValueOnce(null); // not recent
    const res = await app.request("/admin/save", {
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
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:id - db error", async () => {
    (mockDb.update as MockFn).mockImplementationOnce(() => { throw new Error("DB error") });
    const res = await app.request("/admin/1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(500);
  });

  it("GET /:id/signups - db error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB error"));
    mockDb.get.mockRejectedValueOnce(new Error("DB error"));
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    mockDb.first.mockRejectedValueOnce(new Error("DB error"));
    const res = await app.request("/1/signups", {}, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(500);
  });

  it("POST /:id/signups - db error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB error"));
    mockDb.get.mockRejectedValueOnce(new Error("DB error"));
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    mockDb.first.mockRejectedValueOnce(new Error("DB error"));
    const res = await app.request("/1/signups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(500);
  });

  it("DELETE /:id/signups - delete my signup", async () => {
    const res = await app.request("/1/signups", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
  });

  it("PATCH /:id/signups/me/attendance - update my attendance", async () => {
    const res = await app.request("/1/signups/me/attendance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attended: true })
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
  });

  it("PATCH /admin/:id/signups/:userId/attendance - update user attendance", async () => {
    const res = await app.request("/admin/1/signups/user1/attendance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attended: true })
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
  });

  it("GET / - with search query", async () => {
    // The code uses (db as any).all(sql...) for FTS search
    mockDb.all.mockResolvedValueOnce([
      { id: "1", title: "Searched Event", category: "outreach", date_start: "2026-01-01", date_end: "2026-01-02", location: "Test", description: "Test", cover_image: null, status: "published", is_deleted: 0, season_id: 1, meeting_notes: null, tba_event_key: null, recurring_exception: null, is_potluck: 0, is_volunteer: 0 }
    ]);
    const res = await app.request("/?q=search", {}, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
    expect(mockDb.all).toHaveBeenCalled();
  });

  it("POST /admin/:id/approve - approve revision", async () => {
    mockDb.get.mockResolvedValueOnce({ id: "rev1", title: "Revision", revisionOf: "1" });
    mockDb.get.mockResolvedValueOnce({ id: "1", title: "Original" });
    const res = await app.request("/admin/rev1/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
    expect(mockDb.delete).toHaveBeenCalledWith(expect.anything());
  });

  it("POST /admin/sync - handles GCal failure", async () => {
    const { pullEventsFromGcal } = await import("../../../utils/gcalSync");
    vi.mocked(pullEventsFromGcal).mockRejectedValueOnce(new Error("GCal Fail"));
    const res = await app.request("/admin/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200); // We return 200 with error list
  });

  it("GET /admin/list - handles legacy schema error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("no such column"));
    mockDb.all.mockResolvedValueOnce([]); // fallback
    mockDb.get.mockResolvedValueOnce(null); // sync query
    const res = await app.request("/admin/list", {}, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
  });

  it("PATCH /admin/:id/signups/:userId/attendance - unauthorized for normal user", async () => {
    app = new Hono();
    app.use("*", async (c, next) => {
      c.set("db", mockDb as never);
      const user = { id: "user2", role: "user", member_type: "student", email: "u2@example.com", name: "User 2", nickname: "U2", image: null };
      c.set("sessionUser", user);
      vi.mocked(shared.getSessionUser).mockResolvedValue(user);
      await next();
    });
    app.route("/", eventsRouter);

    const res = await app.request("/admin/1/signups/user1/attendance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attended: true })
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(401);
  });

  it("POST /admin/:id/repush - handles error", async () => {
    mockDb.get.mockResolvedValueOnce(null);
    const res = await app.request("/admin/999/repush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socials: ["zulip"] })
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(404);
  });

  it("GET / - handles fallback to older schema", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("Column status missing"));
    mockDb.get.mockRejectedValueOnce(new Error("Column status missing"));
    mockDb.run.mockRejectedValueOnce(new Error("Column status missing"));
    mockDb.first.mockRejectedValueOnce(new Error("Column status missing"));
    mockDb.execute.mockResolvedValueOnce([{ id: "1", title: "Legacy", date_start: "2026-01-01" }]);
    const res = await app.request("/", {}, {} as never, mockExecutionContext as never);
    if (res.status !== 200) {
      console.log(await res.text());
    }
    expect(res.status).toBe(200);
  });

  it("POST /admin/:id/repush - handles external tool error", async () => {
    mockDb.get.mockResolvedValueOnce({ id: "1", title: "Test", category: "internal" });
    const { dispatchSocials } = await import("../../../utils/socialSync");
    vi.mocked(dispatchSocials).mockRejectedValueOnce(new Error("Zulip Down"));
    const res = await app.request("/admin/1/repush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socials: ["zulip"] })
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(502);
  });

  it("GET /:id/signups - handles complex diet summary", async () => {
    mockDb.all.mockResolvedValueOnce([
      { userId: "1", nickname: "User1", dietaryRestrictions: "Vegan, Nut-Free", bringing: null, notes: null, prepHours: 0 },
      { userId: "2", nickname: "User2", dietaryRestrictions: "Vegan", bringing: null, notes: null, prepHours: 0 },
      { userId: "3", nickname: "User3", dietaryRestrictions: null, bringing: null, notes: null, prepHours: 0 }
    ]);
    const res = await app.request("/1/signups", {}, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
    const body = await res.json() as { dietary_summary: Record<string, number> };
    expect(body.dietary_summary["Vegan"]).toBe(2);
    expect(body.dietary_summary["Nut-Free"]).toBe(1);
  });

  it("PATCH /admin/:id/signups/:userId/attendance - handles db error", async () => {
    mockDb.insert.mockImplementationOnce(() => { throw new Error("DB fail") });
    const res = await app.request("/admin/1/signups/user1/attendance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attended: true })
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(500);
  });

  it("POST /admin/:id/repush - handles GCal error", async () => {
    mockDb.get.mockResolvedValueOnce({ id: "1", title: "Test", category: "internal", gcalEventId: "old" });
    const { pushEventToGcal } = await import("../../../utils/gcalSync");
    vi.mocked(pushEventToGcal).mockRejectedValueOnce(new Error("GCal Down"));
    const res = await app.request("/admin/1/repush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socials: [] })
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200); // GCal error in repush is caught and logged, returns 200
  });

  it("POST /admin/:id/repush - handles top level error", async () => {
    (mockDb.select as MockFn).mockImplementationOnce(() => { throw new Error("Fatal") });
    const res = await app.request("/admin/1/repush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socials: [] })
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(502);
  });

  it("PATCH /:id/signups/me/attendance - handles db error", async () => {
    (mockDb.insert as MockFn).mockImplementationOnce(() => { throw new Error("DB fail") });
    const res = await app.request("/1/signups/me/attendance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attended: true })
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(500);
  });

  it("DELETE /:id/signups - handles db error", async () => {
    (mockDb.delete as MockFn).mockImplementationOnce(() => { throw new Error("DB fail") });
    const res = await app.request("/1/signups", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:id - handles db error", async () => {
    mockDb.update.mockImplementationOnce(() => { throw new Error("DB fail") });
    const res = await app.request("/admin/1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:id/purge - handles db error", async () => {
    mockDb.select.mockImplementationOnce(() => { throw new Error("DB fail") });
    const res = await app.request("/admin/1/purge", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(500);
  });

  it("POST /admin/sync - handles missing config", async () => {
    vi.mocked(shared.getDbSettings).mockResolvedValueOnce({});
    const res = await app.request("/admin/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: "GCal config missing" });
  });

  it("POST /admin/sync - handles fatal error", async () => {
    vi.mocked(shared.getDbSettings).mockRejectedValueOnce(new Error("Fatal"));
    const res = await app.request("/admin/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: "Sync failed" });
  });

  it("GET /:id/signups - handles unverified user", async () => {
    vi.mocked(shared.getSessionUser).mockResolvedValueOnce({ id: "unv-1", email: "unv@test.com", role: "unverified", name: "Unv", nickname: "Unv", image: null, member_type: "student" });
    mockDb.execute.mockResolvedValueOnce([]);
    const res = await app.request("/1/signups", {}, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
    const body = await res.json() as { signups: unknown[] };
    expect(body.signups).toHaveLength(0);
  });

  it("GET /admin/list - handles error without fallback", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("Total fail"));
    mockDb.get.mockRejectedValueOnce(new Error("Total fail"));
    mockDb.run.mockRejectedValueOnce(new Error("Total fail"));
    mockDb.first.mockRejectedValueOnce(new Error("Total fail")); // main query
    mockDb.all.mockRejectedValueOnce(new Error("Total fail"));
    mockDb.get.mockRejectedValueOnce(new Error("Total fail"));
    mockDb.run.mockRejectedValueOnce(new Error("Total fail"));
    mockDb.first.mockRejectedValueOnce(new Error("Total fail")); // fallback query
    const res = await app.request("/admin/list", {}, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(500);
  });

  it("POST /admin/:id/reject - handles db error", async () => {
    (mockDb.update as MockFn).mockImplementationOnce(() => { throw new Error("DB fail") });
    const res = await app.request("/admin/1/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(500);
  });

  it("POST /admin/:id/restore - handles db error", async () => {
    (mockDb.update as MockFn).mockImplementationOnce(() => { throw new Error("DB fail") });
    const res = await app.request("/admin/1/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(500);
  });

  it("POST /admin/:id/restore - handles gcal error in wait", async () => {
    mockDb.get.mockResolvedValueOnce({ id: "1", title: "Test", status: "published", category: "internal" });
    const { pushEventToGcal } = await import("../../../utils/gcalSync");
    vi.mocked(pushEventToGcal).mockRejectedValueOnce(new Error("GCal fail"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await app.request("/admin/1/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
    // Flush waitUntil promises
    await Promise.all(vi.mocked(mockExecutionContext.waitUntil).mock.results.map((r) => r.value).filter((v): v is Promise<unknown> => v !== undefined));
    expect(consoleSpy).toHaveBeenCalledWith("GCAL_UNDELETE_FAIL", expect.any(Error));
    consoleSpy.mockRestore();
  });

  it("DELETE /admin/:id - handles gcal delete", async () => {
    mockDb.get.mockResolvedValueOnce({ id: "1", recurringGroupId: null, date_start: "2026-01-01", gcalEventId: "gcal-1", category: "internal" });
    const { deleteEventFromGcal } = await import("../../../utils/gcalSync");
    const res = await app.request("/admin/1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
    await Promise.all(vi.mocked(mockExecutionContext.waitUntil).mock.results.map((r) => r.value).filter((v): v is Promise<unknown> => v !== undefined));
    expect(deleteEventFromGcal).toHaveBeenCalled();
  });

  it("POST /admin/:id/approve - handles gcal fail", async () => {
    mockDb.get.mockResolvedValueOnce({ id: "1", title: "Test", category: "internal" });
    mockDb.get.mockResolvedValueOnce({ id: "1", title: "Test", category: "internal" }); // second for wait
    const { pushEventToGcal } = await import("../../../utils/gcalSync");
    vi.mocked(pushEventToGcal).mockRejectedValueOnce(new Error("GCal fail"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await app.request("/admin/1/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
    await Promise.all(vi.mocked(mockExecutionContext.waitUntil).mock.results.map((r) => r.value).filter((v): v is Promise<unknown> => v !== undefined));
    expect(consoleSpy).toHaveBeenCalledWith("GCAL_APPROVE_FAIL", expect.any(Error));
    consoleSpy.mockRestore();
  });

  it("PATCH /admin/:id - handles non-admin revision", async () => {
    vi.mocked(shared.getSessionUser).mockResolvedValueOnce({ id: "author-1", email: "author@test.com", role: "author", name: "Author", nickname: "Author", image: null, member_type: "student" });

    app = new Hono();
    app.use("*", async (c, next) => {
      c.set("db", mockDb as never);
      c.set("sessionUser", { id: "author-1", role: "author" } as never);
      await next();
    });
    app.route("/", eventsRouter);

    const res = await app.request("/admin/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Title", category: "internal", dateStart: "2026-01-01T00:00:00Z" })
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
    expect(mockDb.insert).toHaveBeenCalledWith(expect.anything());
    const body = await res.json() as { id: string };
    expect(body.id).toContain("-rev-");
  });

  it("PATCH /admin/:id - handles gcal fail in wait", async () => {
    mockDb.get.mockResolvedValueOnce({ gcalEventId: "old" });
    const { pushEventToGcal } = await import("../../../utils/gcalSync");
    vi.mocked(pushEventToGcal).mockRejectedValueOnce(new Error("GCal fail"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await app.request("/admin/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New", category: "internal", dateStart: "2026-01-01T00:00:00Z" })
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
    await Promise.all(vi.mocked(mockExecutionContext.waitUntil).mock.results.map((r) => r.value).filter((v): v is Promise<unknown> => v !== undefined));
    expect(consoleSpy).toHaveBeenCalledWith("GCAL_UPDATE_FAIL", expect.any(Error));
    consoleSpy.mockRestore();
  });

  it("PATCH /admin/:id - handles db fail", async () => {
    mockDb.get.mockResolvedValueOnce({ id: "1", title: "Test" });
    mockDb.all.mockRejectedValueOnce(new Error("DB fail"));
    mockDb.get.mockRejectedValueOnce(new Error("DB fail"));
    mockDb.run.mockRejectedValueOnce(new Error("DB fail"));
    mockDb.first.mockRejectedValueOnce(new Error("DB fail"));
    const res = await app.request("/admin/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New", category: "internal", dateStart: "2026-01-01T00:00:00Z" })
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(500);
  });

  it("POST /admin/:id/approve - handles db fail", async () => {
    mockDb.get.mockImplementationOnce(() => { throw new Error("DB fail") });
    const res = await app.request("/admin/1/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(500);
  });

  it("GET /admin/:id - handles error with fallback", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("no such column"));
    mockDb.get.mockResolvedValueOnce({ id: "1", title: "Fallback", date_start: "2026-01-01" });
    const res = await app.request("/admin/1", {}, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
  });

  it("GET /admin/:id - handles fatal error", async () => {
    (mockDb.select as MockFn).mockImplementationOnce(() => { throw new Error("Fatal 1") });
    (mockDb.select as MockFn).mockImplementationOnce(() => { throw new Error("Fatal 2") });
    const res = await app.request("/admin/1", {}, {} as never, mockExecutionContext as never);
    expect(res.status).toBe(500);
  });

  it("POST /admin/save - handles double submission", async () => {
    mockDb.get.mockResolvedValueOnce({ id: "recent-1" });
    const res = await app.request("/admin/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Recent", category: "internal", dateStart: "2026-01-01T00:00:00Z" })
    }, {} as never, mockExecutionContext as never);
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

    const res = await app.request("/admin/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "New",
        category: "internal",
        dateStart: "2026-01-01T00:00:00Z",
        isDraft: false,
        id: "new-evt-1"
      })
    }, testEnv as never, mockExecutionContext as never);
    expect(res.status).toBe(200);

    console.log("WAIT_UNTIL_CALLS", vi.mocked(mockExecutionContext.waitUntil).mock.calls.length);

    // Flush waitUntil promises
    await Promise.all(vi.mocked(mockExecutionContext.waitUntil).mock.results.map((r) => r.value).filter((v): v is Promise<unknown> => v !== undefined));

    expect(pushEventToGcal).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/GCAL_(SAVE|UPDATE)_FAIL/), expect.any(Error));
    consoleSpy.mockRestore();
  });
});
