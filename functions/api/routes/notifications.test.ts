import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";
import { getSessionUser } from "../middleware";

// Mock middleware
vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAuth: async (_c: unknown, next: () => Promise<void>) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "1", email: "test@test.com", role: "member" }),
  };
});

import notificationsRouter from "./notifications";

describe("Hono Backend - /notifications Router", () => {
  
  
   
  let mockDb: any;
  let testApp: Hono<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    (getSessionUser as any).mockResolvedValue({ id: "1", email: "test@test.com", role: "member" });
    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      deleteFrom: vi.fn().mockReturnThis(),
      fn: {
        count: vi.fn().mockReturnValue({ as: vi.fn().mockReturnValue("count") })
      },
      getExecutor: vi.fn().mockReturnValue({
        compileQuery: vi.fn().mockReturnValue({ sql: "", parameters: [], query: { kind: "RawNode" } }),
        executeQuery: vi.fn().mockResolvedValue({ rows: [] }),
        transformQuery: vi.fn((q) => q),
      }),
    };

    testApp = new Hono<any>();
    testApp.use("*", async (c: any, next: any) => {
      c.set("db", mockDb);
      await next();
    });
    testApp.route("/", notificationsRouter);
  });

  it("GET / - list notifications", async () => {
    mockDb.execute.mockResolvedValueOnce([
      { id: "1", title: "Test", message: "...", link: "/test", priority: "high", is_read: 0, created_at: "..." },
      { id: "2", title: "Test2", message: "...", is_read: null, created_at: "..." }
    ]);
    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PUT /:id/read - mark as read", async () => {
    const res = await testApp.request("/123/read", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PUT /read-all - mark all as read", async () => {
    const res = await testApp.request("/read-all", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("DELETE /:id - delete notification", async () => {
    const res = await testApp.request("/123", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /pending-counts - get pending counts", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 5 }); // inquiries
    mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 2 }); // posts
    mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 1 }); // events
    mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 0 }); // docs
    const res = await testApp.request("/pending-counts", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.inquiries).toBe(5);
  });

  it("GET /action-items - get dashboard action items", async () => {
    mockDb.execute.mockResolvedValueOnce([{ id: 1 }]); // inquiries
    mockDb.execute.mockResolvedValueOnce([{ title: "post1" }]); // posts
    mockDb.execute.mockResolvedValueOnce([]); // events
    mockDb.execute.mockResolvedValueOnce([]); // docs
    const res = await testApp.request("/action-items", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.inquiries.length).toBe(1);
  });

  it("GET / - handles unauthenticated", async () => {
    (getSessionUser as any).mockResolvedValueOnce(null);
    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("PUT /:id/read - handles unauthenticated", async () => {
    (getSessionUser as any).mockResolvedValueOnce(null);
    const res = await testApp.request("/123/read", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("PUT /read-all - handles unauthenticated", async () => {
    (getSessionUser as any).mockResolvedValueOnce(null);
    const res = await testApp.request("/read-all", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("DELETE /:id - handles database error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("Fail"));
    const res = await testApp.request("/123", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /:id - handles unauthenticated", async () => {
    (getSessionUser as any).mockResolvedValueOnce(null);
    const res = await testApp.request("/123", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("GET /pending-counts - handles unauthenticated", async () => {
    (getSessionUser as any).mockResolvedValueOnce(null);
    const res = await testApp.request("/pending-counts", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("GET /action-items - handles unauthenticated", async () => {
    (getSessionUser as any).mockResolvedValueOnce(null);
    const res = await testApp.request("/action-items", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("GET / - handles db error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("Fail"));
    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("PUT /:id/read - handles db error", async () => {
    mockDb.updateTable.mockImplementationOnce(() => { throw new Error("DB error") });
    const res = await testApp.request("/123/read", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("PUT /read-all - handles db error", async () => {
    mockDb.updateTable.mockImplementationOnce(() => { throw new Error("DB error") });
    const res = await testApp.request("/read-all", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /:id - handles db error", async () => {
    mockDb.deleteFrom.mockImplementationOnce(() => { throw new Error("DB error") });
    const res = await testApp.request("/123", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /pending-counts - handles db error", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/pending-counts", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /action-items - handles db error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/action-items", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /pending-counts - filters outreach for students", async () => {
    (getSessionUser as any).mockResolvedValueOnce({ id: "1", role: "user", member_type: "student" });
    
    mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 5 }); // inquiries
    mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 2 }); // posts
    mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 1 }); // events
    mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 0 }); // docs
    const res = await testApp.request("/pending-counts", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /action-items - filters outreach for students", async () => {
    (getSessionUser as any).mockResolvedValueOnce({ id: "1", role: "user", member_type: "student" });
    mockDb.execute.mockResolvedValueOnce([{ id: 1 }]); // inquiries
    mockDb.execute.mockResolvedValueOnce([{ title: "post1" }]); // posts
    mockDb.execute.mockResolvedValueOnce([]); // events
    mockDb.execute.mockResolvedValueOnce([]); // docs
    const res = await testApp.request("/action-items", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /pending-counts - does not filter outreach for mentors", async () => {
    (getSessionUser as any).mockResolvedValueOnce({ id: "1", role: "user", member_type: "mentor" });
    
    mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 5 }); // inquiries
    mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 2 }); // posts
    mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 1 }); // events
    mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 0 }); // docs
    const res = await testApp.request("/pending-counts", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /action-items - does not filter outreach for mentors", async () => {
    (getSessionUser as any).mockResolvedValueOnce({ id: "1", role: "user", member_type: "mentor" });
    mockDb.execute.mockResolvedValueOnce([{ id: 1 }]); // inquiries
    mockDb.execute.mockResolvedValueOnce([{ title: "post1" }]); // posts
    mockDb.execute.mockResolvedValueOnce([]); // events
    mockDb.execute.mockResolvedValueOnce([]); // docs
    const res = await testApp.request("/action-items", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });
});
