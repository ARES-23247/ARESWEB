import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { AppEnv } from "../middleware";
import entitiesRouter from "./entities";

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAuth: async (_c: unknown, next: () => Promise<void>) => next(),
    logAuditAction: vi.fn()
  };
});

import { logAuditAction } from "../middleware";

// Simple inline mock execution context
function createMockExecutionContext() {
  return {
    waitUntil: vi.fn((promise: Promise<unknown>) => promise),
    passThroughOnException: vi.fn(),
    props: {},
  };
}

// Simple inline mock database for Drizzle ORM
function createMockDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
}

describe("Hono Backend - /entities Router", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let testApp: Hono<AppEnv>;
  const mockExecutionContext = createMockExecutionContext();

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();

    testApp = new Hono<AppEnv>();
    testApp.use("*", async (c, next) => {
      c.set("db", mockDb as any);
      await next();
    });
    testApp.route("/", entitiesRouter);
  });

  it("GET /links - fetches and resolves entity links", async () => {
    mockDb.execute
      // 1st call: fetch raw links
      .mockResolvedValueOnce([
        { id: "1", source_type: "doc", source_id: "doc1", target_type: "task", target_id: "task1", link_type: "reference" },
        { id: "2", source_type: "post", source_id: "post1", target_type: "doc", target_id: "doc1", link_type: "reference" },
        { id: "3", source_type: "doc", source_id: "doc1", target_type: "event", target_id: "event1", link_type: "reference" },
        { id: "4", source_type: "doc", source_id: "doc1", target_type: "outreach", target_id: "1", link_type: "reference" }
      ])
      // Subsequent calls: resolve titles
      .mockResolvedValueOnce([{ id: "task1", title: "Task 1" }]) // task
      .mockResolvedValueOnce([{ slug: "post1", title: "Post 1" }]) // post
      .mockResolvedValueOnce([{ id: "event1", title: "Event 1" }]) // event
      .mockResolvedValueOnce([{ id: 1, title: "Outreach 1" }]); // outreach

    const res = await testApp.request("/links?type=doc&id=doc1", {}, {}, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;

    expect(body.links).toHaveLength(4);
    expect(body.links[0]).toEqual({
      id: "1", target_type: "task", target_id: "task1", target_title: "Task 1", link_type: "reference"
    });
    expect(body.links[1]).toEqual({
      id: "2", target_type: "post", target_id: "post1", target_title: "Post 1", link_type: "reference"
    });
  });

  it("GET /links - handles bulk resolution for docs", async () => {
    mockDb.execute
      .mockResolvedValueOnce([
        { id: "1", source_type: "task", source_id: "task1", target_type: "doc", target_id: "doc2", link_type: "reference" }
      ])
      .mockResolvedValueOnce([{ slug: "doc2", title: "Doc 2" }]); // doc

    const res = await testApp.request("/links?type=task&id=task1", {}, {}, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;

    expect(body.links[0].target_title).toBe("Doc 2");
  });

  it("GET /links - returns 500 on DB error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/links?type=doc&id=1", {}, {}, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /links - saves new link and logs audit", async () => {
    const res = await testApp.request("/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_type: "doc", source_id: "1", target_type: "task", target_id: "2", link_type: "reference"
      })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.insert).toHaveBeenCalledWith(expect.anything());
    expect(logAuditAction).toHaveBeenCalled();
  });

  it("POST /links - returns 500 on DB error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_type: "doc", source_id: "1", target_type: "task", target_id: "2", link_type: "reference" })
    }, {}, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /links/:id - deletes link and logs audit", async () => {
    const res = await testApp.request("/links/link123", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }, {}, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.delete).toHaveBeenCalledWith(expect.anything());
    expect(logAuditAction).toHaveBeenCalled();
  });

  it("DELETE /links/:id - returns 500 on DB error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/links/link123", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }, {}, mockExecutionContext);
    expect(res.status).toBe(500);
  });
});
