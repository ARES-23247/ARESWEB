import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Context } from "hono";
import { AppEnv } from "../middleware";
import seasonsRouter from "./seasons";

vi.mock("../middleware/cache", () => ({
  edgeCacheMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: (c: Context<AppEnv>, next: () => Promise<void>) => next(),
    logAuditAction: vi.fn().mockResolvedValue(true),
    rateLimitMiddleware: () => (c: Context<AppEnv>, next: () => Promise<void>) => next(),
  };
});

vi.mock("./ai/autoReindex", () => ({
  triggerBackgroundReindex: vi.fn(),
}));

// Simple inline mock execution context
function createMockExecutionContext() {
  return {
    waitUntil: vi.fn((promise: Promise<unknown>) => promise),
    passThroughOnException: vi.fn(),
    props: {},
  };
}

// Simple inline mock database
function createMockDb() {
  return {
    prepare: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue([]),
    first: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 0 } }),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
}

describe("Seasons Router", () => {
  let app: Hono<AppEnv>;
  let mockDb: ReturnType<typeof createMockDb>;
  const env = { DB: {} as unknown as D1Database };
  const mockExecutionContext = createMockExecutionContext();

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = createMockDb();

    app = new Hono<AppEnv>();
    app.use("*", async (c: Context<AppEnv>, next: () => Promise<void>) => {
      c.set("db", mockDb as any);
      await next();
    });
    app.route("/", seasonsRouter);
  });

  it("GET / - returns published seasons", async () => {
    mockDb.all.mockResolvedValueOnce([{ start_year: 2023, challenge_name: "Centerstage", status: "published" }]);
    const res = await app.request("/", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { seasons: { start_year: number }[] };
    expect(body.seasons[0].start_year).toBe(2023);
  });

  it("GET / - handles database error", async () => {
    // Handler uses .select().from().where().orderBy().all() — mock .all to reject
    mockDb.all.mockRejectedValueOnce(new Error("DB Fail"));
    const res = await app.request("/", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /admin/list - returns all seasons", async () => {
    mockDb.all.mockResolvedValueOnce([{ start_year: 2023, end_year: 2024, challenge_name: "Centerstage", status: "draft" }]);
    const res = await app.request("/admin/list", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /:year - returns season details with relations", async () => {
    // Handler does Promise.all([...get(), ...all(), ...all(), ...all(), ...all()])
    mockDb.first.mockResolvedValueOnce({ start_year: 2023, end_year: 2024, challenge_name: "Centerstage", status: "published" });
    // Reset all to return [] for each of the 4 relation queries
    mockDb.all.mockResolvedValue([]);
    const res = await app.request("/2023", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /:year - handles error", async () => {
    // Handler uses .get() for season lookup — reject it
    mockDb.first.mockRejectedValueOnce(new Error("Detail fail"));
    // Also need all() to reject since Promise.all will call it too
    mockDb.all.mockRejectedValue(new Error("Detail fail"));
    const res = await app.request("/2023", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /admin/:id - returns details", async () => {
    mockDb.first.mockResolvedValueOnce({ start_year: 2023, end_year: 2024, challenge_name: "Centerstage", status: "draft" });
    const res = await app.request("/admin/2023", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /admin/:id - handles error", async () => {
    // Handler uses .select().from().where().get() — mock .first to reject
    mockDb.first.mockRejectedValueOnce(new Error("Admin Detail fail"));
    const res = await app.request("/admin/2023", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/save - creates new season", async () => {
    mockDb.first.mockResolvedValueOnce(null); // not existing
    mockDb.run.mockResolvedValueOnce({ success: true, meta: { changes: 1 } }); // insert success
    const res = await app.request("/admin/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_year: 2024, end_year: 2025, challenge_name: "Next" })
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - handles error", async () => {
    // Handler uses .select().from().where().get() for collision check — mock .first to reject
    mockDb.first.mockRejectedValueOnce(new Error("Save check fail"));
    const res = await app.request("/admin/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_year: 2024, end_year: 2025, challenge_name: "Fail" })
    }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:id - soft deletes", async () => {
    const res = await app.request("/admin/2023", { method: "DELETE" }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.update).toHaveBeenCalledWith(expect.anything());
  });

  it("DELETE /admin/:id - handles error", async () => {
    // Handler uses db.update().set().where() which is a mutation — mock update to throw
    mockDb.update.mockImplementationOnce(() => { throw new Error("Delete fail"); });
    const res = await app.request("/admin/2023", { method: "DELETE" }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/:id/undelete - restores", async () => {
    const res = await app.request("/admin/2023/undelete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/:id/undelete - handles error", async () => {
    // Handler uses db.update().set().where() — mock update to throw
    mockDb.update.mockImplementationOnce(() => { throw new Error("Undelete fail"); });
    const res = await app.request("/admin/2023/undelete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:id/purge - permanent delete", async () => {
    const res = await app.request("/admin/2023/purge", { method: "DELETE" }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.delete).toHaveBeenCalledWith(expect.anything());
  });

  it("DELETE /admin/:id/purge - handles error", async () => {
    // Handler uses db.delete().where() — mock delete to throw
    mockDb.delete.mockImplementationOnce(() => { throw new Error("Purge fail"); });
    const res = await app.request("/admin/2023/purge", { method: "DELETE" }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/save - handles year change and cascading updates", async () => {
    mockDb.first.mockResolvedValueOnce(null); // no collision
    mockDb.first.mockResolvedValueOnce({ start_year: 2023 }); // existing
    const res = await app.request("/admin/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ original_year: 2023, start_year: 2024, end_year: 2025, challenge_name: "Moved" })
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.update).toHaveBeenCalledWith(expect.anything());
  });

  it("GET /:year - returns 404 for missing season", async () => {
    mockDb.first.mockResolvedValueOnce(null);
    const res = await app.request("/9999", {}, env, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("GET /:year - returns 404 for invalid year", async () => {
    const res = await app.request("/abc", {}, env, mockExecutionContext);
    expect(res.status).toBe(404);
  });
});
