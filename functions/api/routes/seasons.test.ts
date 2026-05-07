import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Context } from "hono";
import type { TestEnv } from "../../../src/test/types";
import { mockExecutionContext } from "../../../src/test/utils";
import seasonsRouter from "./seasons";

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: (c: Context<TestEnv>, next: () => Promise<void>) => next(),
    logAuditAction: vi.fn().mockResolvedValue(true),
    rateLimitMiddleware: () => (c: Context<TestEnv>, next: () => Promise<void>) => next(),
  };
});

describe("Seasons Router", () => {
  let app: Hono<TestEnv>;
  let mockDb: any;
  const env: TestEnv["Bindings"] = { DB: {} as unknown as D1Database };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn(),
      executeTakeFirst: vi.fn(),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      deleteFrom: vi.fn().mockReturnThis(),
    };

    app = new Hono<TestEnv>();
    app.use("*", async (c, next) => {
      c.set("db", mockDb);
      await next();
    });
    app.route("/", seasonsRouter);
  });

  it("GET / - returns published seasons", async () => {
    mockDb.execute.mockResolvedValueOnce([{ start_year: 2023, challenge_name: "Centerstage", status: "published" }]);
    const res = await app.request("/", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { seasons: { start_year: number }[] };
    expect(body.seasons[0].start_year).toBe(2023);
  });

  it("GET / - handles database error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB Fail"));
    const res = await app.request("/", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /admin/list - returns all seasons", async () => {
    mockDb.execute.mockResolvedValueOnce([{ start_year: 2023, end_year: 2024, challenge_name: "Centerstage", status: "draft" }]);
    const res = await app.request("/admin/list", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /:year - returns season details with relations", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ start_year: 2023, end_year: 2024, challenge_name: "Centerstage", status: "published" });
    mockDb.execute.mockResolvedValue([]); // for awards, events, posts, outreach
    const res = await app.request("/2023", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /:year - handles error", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("Detail fail"));
    const res = await app.request("/2023", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /admin/:id - returns details", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ start_year: 2023, end_year: 2024, challenge_name: "Centerstage", status: "draft" });
    const res = await app.request("/admin/2023", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /admin/:id - handles error", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("Admin Detail fail"));
    const res = await app.request("/admin/2023", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/save - creates new season", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null); // not existing
    mockDb.execute.mockResolvedValueOnce([]); // insert success
    const res = await app.request("/admin/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_year: 2024, end_year: 2025, challenge_name: "Next" })
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - handles error", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("Save check fail"));
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
    expect(mockDb.updateTable).toHaveBeenCalledWith("seasons");
  });

  it("DELETE /admin/:id - handles error", async () => {
    mockDb.updateTable.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ execute: vi.fn().mockRejectedValueOnce(new Error("Delete fail")) }) }) });
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
    mockDb.updateTable.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ execute: vi.fn().mockRejectedValueOnce(new Error("Undelete fail")) }) }) });
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
    expect(mockDb.deleteFrom).toHaveBeenCalledWith("seasons");
  });

  it("DELETE /admin/:id/purge - handles error", async () => {
    mockDb.deleteFrom.mockReturnValue({ where: vi.fn().mockReturnValue({ execute: vi.fn().mockRejectedValueOnce(new Error("Purge fail")) }) });
    const res = await app.request("/admin/2023/purge", { method: "DELETE" }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/save - handles year change and cascading updates", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null); // no collision
    mockDb.executeTakeFirst.mockResolvedValueOnce({ start_year: 2023 }); // existing
    const res = await app.request("/admin/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ original_year: 2023, start_year: 2024, end_year: 2025, challenge_name: "Moved" })
    }, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.updateTable).toHaveBeenCalledWith("events");
  });

  it("GET /:year - returns 404 for missing season", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    const res = await app.request("/9999", {}, env, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("GET /:year - returns 404 for invalid year", async () => {
    const res = await app.request("/abc", {}, env, mockExecutionContext);
    expect(res.status).toBe(404);
  });
});

