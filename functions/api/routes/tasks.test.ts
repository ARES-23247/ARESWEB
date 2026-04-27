import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";
import tasksRouter from "./tasks";

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAuth: async (_c: unknown, next: () => Promise<void>) => next(),
    rateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
    getSessionUser: vi.fn(),
    getSocialConfig: vi.fn().mockResolvedValue({})
  };
});



vi.mock("../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn()
}));

import { getSessionUser } from "../middleware";
import { sendZulipMessage } from "../../utils/zulipSync";

describe("Hono Backend - /tasks Router", () => {
  let mockDb: any;
  let testApp: Hono<any>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      deleteFrom: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
    };

    testApp = new Hono<any>();
    testApp.use("*", async (c: any, next: any) => {
      c.set("db", mockDb);
      c.set("executionCtx", mockExecutionContext);
      await next();
    });
    testApp.route("/", tasksRouter);
  });

  it("GET / - lists tasks", async () => {
    mockDb.execute.mockResolvedValueOnce([
      { id: "task1", title: "Test Task", status: "todo", priority: "high", sort_order: 1, created_by: "user1", assignee_name: "Alice" }
    ]);

    const res = await testApp.request("/", {}, {}, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.tasks).toHaveLength(1);
    expect(body.tasks[0].title).toBe("Test Task");
  });

  it("GET / - handles db error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB Error"));
    const res = await testApp.request("/", {}, {}, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET / - filters by status", async () => {
    mockDb.execute.mockResolvedValueOnce([]);
    const res = await testApp.request("/?status=todo", {}, {}, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.where).toHaveBeenCalledWith("t.status", "=", "todo");
  });

  it("POST / - creates task", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "student" } as any);
    
    const res = await testApp.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Task", description: "Desc", priority: "high" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.insertInto).toHaveBeenCalledWith("tasks");
    
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.task.title).toBe("New Task");
  });

  it("POST / - handles create error", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "student" } as any);
    mockDb.insertInto.mockImplementationOnce(() => { throw new Error("Create fail"); });

    const res = await testApp.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Task" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("POST / - handles Zulip failure in create gracefully", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "student" } as any);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ email: "alice@test.com" });
    vi.mocked(sendZulipMessage).mockRejectedValueOnce(new Error("Zulip Down"));

    const res = await testApp.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Task", assigned_to: "user2" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST / - returns 401 if unauthenticated", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce(null);
    const res = await testApp.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Task" })
    }, {}, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("PATCH /reorder - updates tasks inside transaction", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "student" } as any);
    
    const res = await testApp.request("/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: "task1", status: "todo", sort_order: 1 }] })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.updateTable).toHaveBeenCalledWith("tasks");
  });

  it("PATCH /reorder - handles reorder error", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "student" } as any);
    mockDb.updateTable.mockImplementationOnce(() => { throw new Error("Reorder fail"); });

    const res = await testApp.request("/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: "task1", status: "todo", sort_order: 1 }] })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("PATCH /:id - updates task", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "admin" } as any);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "task1", created_by: "user2", assigned_to: "user2", title: "Task" });
    
    const res = await testApp.request("/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Task", status: "done" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.updateTable).toHaveBeenCalledWith("tasks");
  });

  it("PATCH /:id - returns 403 if not admin or owner", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "student" } as any);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "task1", created_by: "user2" });
    
    const res = await testApp.request("/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Task" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(403);
  });

  it("PATCH /:id - handles update error", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "admin" } as any);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "task1", created_by: "user1" });
    mockDb.updateTable.mockImplementationOnce(() => { throw new Error("Update fail"); });

    const res = await testApp.request("/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("PATCH /:id - handles Zulip failure gracefully", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "admin" } as any);
    mockDb.executeTakeFirst
      .mockResolvedValueOnce({ id: "task1", created_by: "user1", assigned_to: "old", title: "Task" }) // Task check
      .mockResolvedValueOnce({ email: "bob@test.com" }); // Assignee fetch
    
    vi.mocked(sendZulipMessage).mockRejectedValueOnce(new Error("Zulip Down"));

    const res = await testApp.request("/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigned_to: "new" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("DELETE /:id - deletes task", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "admin" } as any);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ created_by: "user2" });
    
    const res = await testApp.request("/task1", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }, {}, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.deleteFrom).toHaveBeenCalledWith("tasks");
  });

  it("DELETE /:id - returns 403 if not authorized", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "student" } as any);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ created_by: "user2" });
    
    const res = await testApp.request("/task1", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }, {}, mockExecutionContext);
    expect(res.status).toBe(403);
  });

  it("DELETE /:id - returns 404 if not found", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "admin" } as any);
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    
    const res = await testApp.request("/task1", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }, {}, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("DELETE /:id - handles delete error", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "admin" } as any);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ created_by: "user1" });
    mockDb.deleteFrom.mockImplementationOnce(() => { throw new Error("Delete fail"); });

    const res = await testApp.request("/task1", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }, {}, mockExecutionContext);

    expect(res.status).toBe(500);
  });
});
