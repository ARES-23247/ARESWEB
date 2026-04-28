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
  let mockDb: ReturnType<typeof createMockDb>;
  let testApp: Hono<any>;

  function createMockDb() {
    return {
      selectFrom: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      whereRef: vi.fn().mockReturnThis(),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      deleteFrom: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      as: vi.fn().mockReturnThis(),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = createMockDb();

    testApp = new Hono<any>();
    testApp.use("*", async (c: any, next: any) => {
      c.set("db", mockDb);
      c.set("executionCtx", mockExecutionContext);
      await next();
    });
    testApp.route("/", tasksRouter);
  });

  // ─── LIST ───────────────────────────────────────────────────────────────

  it("GET / - lists tasks", async () => {
    mockDb.execute.mockResolvedValueOnce([
      { 
        id: "task1", 
        title: "Test Task", 
        status: "todo", 
        priority: "high", 
        sort_order: 1, 
        created_by: "user1", 
        assignees_json: '[{"id":"user2","nickname":"Alice"}]' 
      }
    ]);

    const res = await testApp.request("/", {}, {}, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.tasks).toHaveLength(1);
    expect(body.tasks[0].title).toBe("Test Task");
    expect(body.tasks[0].assignees).toHaveLength(1);
    expect(body.tasks[0].assignees[0].nickname).toBe("Alice");
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

  it("GET / - handles malformed assignees_json gracefully", async () => {
    mockDb.execute.mockResolvedValueOnce([
      { id: "t1", title: "Bad JSON", status: "todo", priority: "normal", sort_order: 0, created_by: "u1", assignees_json: "INVALID" }
    ]);
    const res = await testApp.request("/", {}, {}, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.tasks[0].assignees).toEqual([]);
  });

  it("GET / - filters null assignee ids from left join", async () => {
    mockDb.execute.mockResolvedValueOnce([
      { id: "t1", title: "Task", status: "todo", priority: "normal", sort_order: 0, created_by: "u1", assignees_json: '[{"id":null,"nickname":null},{"id":"u2","nickname":"Alice"}]' }
    ]);
    const res = await testApp.request("/", {}, {}, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.tasks[0].assignees).toHaveLength(1);
    expect(body.tasks[0].assignees[0].id).toBe("u2");
  });

  it("GET / - handles empty assignees_json", async () => {
    mockDb.execute.mockResolvedValueOnce([
      { id: "t1", title: "No Assigns", status: "done", priority: "low", sort_order: 0, created_by: "u1", assignees_json: null }
    ]);
    const res = await testApp.request("/", {}, {}, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.tasks[0].assignees).toEqual([]);
    expect(body.tasks[0].assigned_to).toBeNull();
    expect(body.tasks[0].assignee_name).toBeNull();
  });

  // ─── CREATE ─────────────────────────────────────────────────────────────

  it("POST / - creates task with multiple assignees", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "student", nickname: "Creator" } as any);
    mockDb.execute.mockResolvedValueOnce([{ user_id: "user2", nickname: "Alice" }]); // For profiles fetch

    const res = await testApp.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        title: "New Task", 
        description: "Desc", 
        priority: "high",
        assignees: ["user2", "user3"]
      })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.insertInto).toHaveBeenCalledWith("tasks");
    expect(mockDb.insertInto).toHaveBeenCalledWith("task_assignments");
    
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.task.title).toBe("New Task");
    expect(body.task.assignees).toBeDefined();
  });

  it("POST / - creates task without assignees", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "student" } as any);

    const res = await testApp.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Solo Task" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.task.assignees).toEqual([]);
  });

  it("POST / - rejects unauthenticated user", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce(null);

    const res = await testApp.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Fail" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(401);
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
    mockDb.execute.mockResolvedValueOnce([]); // profiles
    mockDb.execute.mockResolvedValueOnce([{ email: "alice@test.com" }]); // user emails
    vi.mocked(sendZulipMessage).mockRejectedValueOnce(new Error("Zulip Down"));

    const res = await testApp.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Task", assignees: ["user2"] })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  // ─── REORDER ────────────────────────────────────────────────────────────

  it("PATCH /reorder - reorders tasks", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "student" } as any);

    const res = await testApp.request("/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [
        { id: "t1", status: "todo", sort_order: 0 },
        { id: "t2", status: "in_progress", sort_order: 1 }
      ]})
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(mockDb.updateTable).toHaveBeenCalledWith("tasks");
  });

  it("PATCH /reorder - rejects unauthenticated user", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce(null);

    const res = await testApp.request("/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [] })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(401);
  });

  it("PATCH /reorder - handles db error", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "student" } as any);
    mockDb.execute.mockRejectedValueOnce(new Error("DB fail"));

    const res = await testApp.request("/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: "t1", status: "todo", sort_order: 0 }] })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  // ─── UPDATE ─────────────────────────────────────────────────────────────

  it("PATCH /:id - updates task and assignments (admin)", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "admin" } as any);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "task1", created_by: "user2", title: "Task" });
    
    const res = await testApp.request("/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Task", assignees: ["user3"] })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.updateTable).toHaveBeenCalledWith("tasks");
    expect(mockDb.deleteFrom).toHaveBeenCalledWith("task_assignments");
    expect(mockDb.insertInto).toHaveBeenCalledWith("task_assignments");
  });

  it("PATCH /:id - allows any member to update task fields (no assignees)", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "member1", role: "student" } as any);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "task1", created_by: "other_user", title: "Task" });

    const res = await testApp.request("/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Renamed", status: "in_progress", priority: "high" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.updateTable).toHaveBeenCalledWith("tasks");
  });

  it("PATCH /:id - blocks assignment change by non-privileged non-owner", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "student1", role: "student" } as any);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "task1", created_by: "other_user", title: "Task" });

    const res = await testApp.request("/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignees: ["student1"] })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error).toContain("assignments");
  });

  it("PATCH /:id - allows task creator to change assignments", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "creator1", role: "student" } as any);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "task1", created_by: "creator1", title: "My Task" });

    const res = await testApp.request("/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignees: ["user2"] })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.deleteFrom).toHaveBeenCalledWith("task_assignments");
    expect(mockDb.insertInto).toHaveBeenCalledWith("task_assignments");
  });

  it("PATCH /:id - allows mentor to change assignments", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "mentor1", role: "mentor" } as any);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "task1", created_by: "other", title: "Task" });

    const res = await testApp.request("/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignees: ["user2"] })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("PATCH /:id - returns 404 for non-existent task", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "admin" } as any);
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);

    const res = await testApp.request("/nonexistent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "X" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(404);
  });

  it("PATCH /:id - rejects unauthenticated user", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce(null);

    const res = await testApp.request("/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Nope" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(401);
  });

  it("PATCH /:id - handles update error", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "admin" } as any);
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("DB fail"));

    const res = await testApp.request("/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Crash" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  // ─── DELETE ─────────────────────────────────────────────────────────────

  it("DELETE /:id - deletes task (admin)", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "admin" } as any);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ created_by: "user2" });
    
    const res = await testApp.request("/task1", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }, {}, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.deleteFrom).toHaveBeenCalledWith("tasks");
  });

  it("DELETE /:id - deletes task (owner)", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "owner1", role: "student" } as any);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ created_by: "owner1" });

    const res = await testApp.request("/task1", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }, {}, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.deleteFrom).toHaveBeenCalledWith("tasks");
  });

  it("DELETE /:id - blocks non-admin non-owner", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "student1", role: "student" } as any);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ created_by: "other_user" });

    const res = await testApp.request("/task1", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }, {}, mockExecutionContext);
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error).toContain("not authorized");
  });

  it("DELETE /:id - returns 404 for non-existent task", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "admin" } as any);
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);

    const res = await testApp.request("/task1", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }, {}, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("DELETE /:id - rejects unauthenticated user", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce(null);

    const res = await testApp.request("/task1", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }, {}, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("DELETE /:id - handles error", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "admin" } as any);
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("DB fail"));

    const res = await testApp.request("/task1", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }, {}, mockExecutionContext);
    expect(res.status).toBe(500);
  });
});
