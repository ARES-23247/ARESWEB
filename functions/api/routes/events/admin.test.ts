import { describe, it, expect, vi, beforeEach } from "vitest";
import adminRouter from "./admin";

const mockExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
};

vi.mock("../../middleware/auth", () => {
  return {
    ensureAdmin: async (c: unknown, next: () => Promise<void>) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ role: "admin", email: "admin@test.com" }),
  };
});

vi.mock("../../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (c: unknown, next: () => Promise<void>) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ role: "admin", email: "admin@test.com" }),
    getSocialConfig: vi.fn().mockResolvedValue({}),
    getDbSettings: vi.fn().mockResolvedValue({}),
  };
});

vi.mock("../../../utils/socialSync", () => ({
  dispatchSocials: vi.fn().mockResolvedValue(true)
}));

vi.mock("../../../utils/notifications", () => ({
  notifyByRole: vi.fn().mockResolvedValue(true)
}));

describe("Events Admin Router", () => {
  let mockDb: Record<string, ReturnType<typeof vi.fn>>;
  let env: { DB: Record<string, ReturnType<typeof vi.fn>> };

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true }),
      batch: vi.fn().mockResolvedValue([]),
    };
    env = { DB: mockDb };
    vi.clearAllMocks();
  });

  it("GET / should return events and last sync", async () => {
    mockDb.all.mockResolvedValueOnce({ results: [{ id: "e1", title: "Test Event" }] });
    mockDb.first.mockResolvedValueOnce({ value: "2026-01-01" });

    const req = new Request("http://localhost/");
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { events: unknown[], lastSyncedAt: string };
    expect(body.events.length).toBe(1);
    expect(body.lastSyncedAt).toBe("2026-01-01");
  });

  it("GET /:id should return single event", async () => {
    mockDb.first.mockResolvedValueOnce({ id: "e1", title: "Test" });
    const req = new Request("http://localhost/e1");
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /:id should return 404 if not found", async () => {
    mockDb.first.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/e2");
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("POST / should create an event", async () => {
    const payload = {
      title: "New Event",
      dateStart: "2026-05-01",
      category: "outreach"
    };
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.run).toHaveBeenCalled();
  });

  it("POST / should reject missing title", async () => {
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dateStart: "2026-05-01" })
    });
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(400);
  });

  it("PUT /:id should update an event", async () => {
    mockDb.first.mockResolvedValueOnce({ id: "e1" });
    const req = new Request("http://localhost/e1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated", dateStart: "2026-05-01" })
    });
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("DELETE /:id should mark event as deleted", async () => {
    mockDb.first.mockResolvedValueOnce({ id: "e1" });
    const req = new Request("http://localhost/e1", { method: "DELETE" });
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /:id/repush should trigger social dispatch", async () => {
    mockDb.first.mockResolvedValueOnce({ title: "T", description: "D", cover_image: "img" });
    const req = new Request("http://localhost/e1/repush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socials: { discord: true } })
    });
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PUT /:id should create revision for student users", async () => {
    const { getSessionUser } = await import("../../middleware");
    // @ts-expect-error -- mocking return value
    vi.mocked(getSessionUser).mockResolvedValueOnce({ role: "user", email: "student@test.com" });
    const req = new Request("http://localhost/e1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated", dateStart: "2026-05-01" })
    });
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PATCH /:id/restore should run custom restore logic", async () => {
    const req = new Request("http://localhost/e1/restore", { method: "PATCH" });
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET / should handle DB errors", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB error"));
    const req = new Request("http://localhost/");
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
    const body = await res.json() as any;
    expect(body.error).toBeDefined();
  });

  it("GET /:id should handle DB errors", async () => {
    mockDb.first.mockRejectedValueOnce(new Error("DB error"));
    const req = new Request("http://localhost/e1");
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST / should handle malformed JSON", async () => {
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json"
    });
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(400);
  });

  it("POST / should handle DB errors", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Event", dateStart: "2026-05-01" })
    });
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("PUT /:id should handle malformed JSON", async () => {
    const req = new Request("http://localhost/e1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not-json"
    });
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(400);
  });

  it("PUT /:id should handle DB errors", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    const req = new Request("http://localhost/e1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated", dateStart: "2026-05-01" })
    });
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("PATCH /:id/approve should run custom approve logic", async () => {
    mockDb.first.mockResolvedValueOnce({ revision_of: "parent_event", title: "Updated", date_start: "2026", date_end: "2026", location: "loc", description: "desc", cover_image: "img", gcal_event_id: "gcal1", is_potluck: 0, is_volunteer: 0 });
    const req = new Request("http://localhost/rev_e1/approve", { method: "PATCH" });
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.batch).toHaveBeenCalled();
  });

  it("DELETE /:id/purge should run custom delete logic", async () => {
    mockDb.first.mockResolvedValueOnce({ gcal_event_id: "gcal1", category: "outreach" });
    const { getDbSettings } = await import("../../middleware");
    // @ts-expect-error -- mocking return value
    getDbSettings.mockResolvedValueOnce({ GCAL_SERVICE_ACCOUNT_EMAIL: "test@test.com", GCAL_PRIVATE_KEY: "key", CALENDAR_ID_OUTREACH: "cal_outreach" });
    const req = new Request("http://localhost/e1/purge", { method: "DELETE" });
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /:id/repush should handle malformed JSON", async () => {
    const req = new Request("http://localhost/e1/repush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json"
    });
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(400);
  });

  it("POST /:id/repush should handle event not found", async () => {
    mockDb.first.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/e1/repush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socials: { discord: true } })
    });
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("POST /:id/repush should handle DB errors", async () => {
    mockDb.first.mockRejectedValueOnce(new Error("DB error"));
    const req = new Request("http://localhost/e1/repush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socials: { discord: true } })
    });
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("PUT /:id should catch dispatchSocials error", async () => {
    mockDb.run.mockResolvedValueOnce({ success: true });
    const { dispatchSocials } = await import("../../../utils/socialSync");
    // @ts-expect-error mocking
    vi.mocked(dispatchSocials).mockRejectedValueOnce(new Error("Social failure"));
    
    const req = new Request("http://localhost/e1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated", dateStart: "2026-05-01", isDraft: false, socials: { discord: true } })
    });
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /:id/repush should catch dispatchSocials error", async () => {
    mockDb.first.mockResolvedValueOnce({ title: "Event", description: "Desc", cover_image: "img" });
    const { dispatchSocials } = await import("../../../utils/socialSync");
    // @ts-expect-error mocking
    vi.mocked(dispatchSocials).mockRejectedValueOnce(new Error("Repush failure"));
    
    const req = new Request("http://localhost/e1/repush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socials: { discord: true } })
    });
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PUT /:id should catch notifyByRole error when user is not admin", async () => {
    const { getSessionUser } = await import("../../middleware");
    // @ts-expect-error mocking
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "1", role: "author", email: "auth@ares" });
    
    const { notifyByRole } = await import("../../../utils/notifications");
    // @ts-expect-error mocking
    vi.mocked(notifyByRole).mockRejectedValueOnce(new Error("Notify failure"));

    const req = new Request("http://localhost/e1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Event", dateStart: "2026-05-01" })
    });
    const res = await adminRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200); // Because notifyByRole fails silently in waitUntil
  });
});


