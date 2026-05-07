import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import outreachRouter from "./outreach/index";
import { AppEnv } from "../middleware";

// Mock middleware
vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "1", email: "admin@test.com", role: "admin" }),
    getDb: () => ({
      all: vi.fn().mockResolvedValue([]),
      run: vi.fn().mockResolvedValue({ success: true }),
    }),
  };
});

describe("Hono Backend - /outreach Router", () => {
  let app: Hono<AppEnv>;
  let getDbMock: () => ReturnType<typeof vi.mocked<typeof import("../middleware").getDb>>;
  const env = { DEV_BYPASS: "true" } as AppEnv["Bindings"];
  const mockExecutionContext = {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const middleware = await import("../middleware");
    getDbMock = middleware.getDb as any;

    app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("db", getDbMock());
      await next();
    });
    app.route("/", outreachRouter);
  });

  it("GET / - list outreach logs with volunteer events", async () => {
    const mockDb = getDbMock();
    mockDb.all = vi.fn()
      .mockResolvedValueOnce([
        { id: "1", title: "Test", date: "2024-01-01", students_count: 5, hours_logged: 10, reach_count: 50, description: "..." }
      ]) // outreach_logs
      .mockResolvedValueOnce([
        { id: "v1", title: "Volunteer", date: "2024-02-01", location: "Loc", season_id: "1" },
        { id: "v2", title: "Volunteer No Season", date: "2024-01-15", location: null, season_id: null }
      ]); // events

    const res = await app.request("/", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { logs: { title: string; season_id: string | null }[] };
    expect(body.logs).toHaveLength(3);
    expect(body.logs[0].title).toBe("Volunteer"); // Sorted by date
    expect(body.logs[1].title).toBe("Volunteer No Season");
    expect(body.logs[2].title).toBe("Test");
    expect(body.logs[1].season_id).toBeNull();
  });

  it("GET / - handles list failure", async () => {
    const mockDb = getDbMock();
    mockDb.all = vi.fn().mockRejectedValue(new Error("DB Error"));
    const res = await app.request("/", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/save - create", async () => {
    const mockDb = getDbMock();
    mockDb.run = vi.fn().mockResolvedValueOnce([{ id: 123 }]);
    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ title: "New", date: "2024-01-01", students_count: 5, hours_logged: 10, reach_count: 50, location: "Test", description: "Test" }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string };
    expect(body.id).toBe("123");
  });

  it("POST /admin/save - update existing", async () => {
    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ id: "1", title: "Updated", date: "2024-01-01", students_count: 5, hours_logged: 10, reach_count: 50, location: "Test", description: "Test" }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - handles save failure", async () => {
    const mockDb = getDbMock();
    mockDb.run = vi.fn().mockRejectedValueOnce(new Error("DB Error"));
    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({
        title: "Fail",
        date: "2024-01-01",
        students_count: 0,
        hours_logged: 0,
        reach_count: 0,
        location: null,
        description: null
      }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /admin/list - list outreach logs with volunteer events", async () => {
    const mockDb = getDbMock();
    mockDb.all = vi.fn()
      .mockResolvedValueOnce([
        { id: "1", title: "Test", date: "2024-01-01", students_count: 5, hours_logged: 10, reach_count: 50, description: "..." }
      ]) // outreach_logs
      .mockResolvedValueOnce([
        { id: "v1", title: "Volunteer", date: "2024-02-01", location: "Loc", season_id: "1" }
      ]); // events

    const res = await app.request("/admin/list", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { logs: { title: string }[] };
    expect(body.logs).toHaveLength(2);
    expect(body.logs[0].title).toBe("Volunteer");
  });

  it("GET /admin/list - fallback properties and long description", async () => {
    const mockDb = getDbMock();
    mockDb.all = vi.fn()
      .mockResolvedValueOnce([
        { id: "1", title: "Test", date: "2024-01-01", students_count: null, hours_logged: null, reach_count: null, description: "A".repeat(250), is_mentoring: null, mentored_team_number: null, season_id: null }
      ])
      .mockResolvedValueOnce([]); // events

    const res = await app.request("/admin/list", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { logs: { description: string }[] };
    expect(body.logs[0].description.length).toBe(203); // 200 + "..."
  });

  it("GET / - handles volunteer fetch failure gracefully", async () => {
    const mockDb = getDbMock();
    mockDb.all = vi.fn()
      .mockResolvedValueOnce([
        { id: "1", title: "Test", date: "2024-01-01", students_count: 5, hours_logged: 10, reach_count: 50, description: "A".repeat(250) }
      ])
      .mockRejectedValueOnce(new Error("Volunteer DB Error")); // fetchVolunteerEvents fails

    const res = await app.request("/", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { logs: unknown[] };
    expect(body.logs).toHaveLength(1);
  });

  it("GET /admin/list - handles admin list failure", async () => {
    const mockDb = getDbMock();
    mockDb.all = vi.fn().mockRejectedValue(new Error("DB Error"));
    const res = await app.request("/admin/list", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:id - soft-delete", async () => {
    const res = await app.request("/admin/123", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("DELETE /admin/:id - handles delete failure", async () => {
    const mockDb = getDbMock();
    mockDb.run = vi.fn().mockRejectedValue(new Error("DB Error"));
    const res = await app.request("/admin/123", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/save - handles unauthorized", async () => {
    const middleware = await import("../middleware");
    vi.mocked(middleware.getSessionUser).mockResolvedValueOnce(null);
    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ title: "Fail", date: "2024-01-01", students_count: 5, hours_logged: 10, reach_count: 50, location: "Test", description: "Test" }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("POST /admin/save - create with mentoring", async () => {
    const mockDb = getDbMock();
    mockDb.run = vi.fn().mockResolvedValueOnce([{ id: 123 }]);
    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ title: "New", is_mentoring: true, mentored_team_number: "1234", date: "2024-01-01", students_count: 5, hours_logged: 10, reach_count: 50, location: "Test", description: "Test" }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("DELETE /admin/:id - handles unauthorized", async () => {
    const middleware = await import("../middleware");
    vi.mocked(middleware.getSessionUser).mockResolvedValueOnce(null);
    const res = await app.request("/admin/123", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);
    expect(res.status).toBe(401);
  });
});
