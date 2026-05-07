import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { AppEnv } from "../middleware";
import tasksRouter from "./tasks";

// Simple inline mock execution context
function createMockExecutionContext() {
  const promises: Promise<unknown>[] = [];
  return {
    waitUntil: vi.fn((promise: Promise<unknown>) => {
      promises.push(promise);
      return promise;
    }),
    passThroughOnException: vi.fn(),
    props: {},
    promises,
  };
}

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

describe("Hono Backend - /tasks Router", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let testApp: Hono<AppEnv>;
  const mockExecutionContext = createMockExecutionContext();

  beforeEach(async () => {
    vi.clearAllMocks();
    (getSessionUser as unknown as ReturnType<typeof vi.fn>).mockReset();

    mockDb = createMockDb();

    // Set default behavior for sendZulipMessage mock
    vi.mocked(sendZulipMessage).mockResolvedValue(123 as never);

    testApp = new Hono<AppEnv>();
    testApp.use("*", async (c, next) => {
      c.set("db", mockDb as any);
      (c.set as any)("executionCtx", mockExecutionContext);
      c.env.DEV_BYPASS = "true";
      await next();
    });
    testApp.route("/", tasksRouter);

    // Wrap request method to always include DEV_BYPASS in env
    const originalRequest = testApp.request.bind(testApp);
    testApp.request = async (input: string | URL | Request, init?: RequestInit, env?: Record<string, unknown>, execCtx?: ExecutionContext) => {
      return originalRequest(input, init, { ...env, DEV_BYPASS: "true" }, execCtx);
    };
  });

  // ─── LIST ───────────────────────────────────────────────────────────────

  it("GET / - lists tasks", async () => {
    mockDb.all.mockResolvedValueOnce([
      {
        id: "task1",
        title: "Test Task",
        status: "todo",
        priority: "high",
        sortOrder: 1,
        createdBy: "user1",
        assignees_json: '[{"id":"user2","nickname":"Alice"}]'
      },
      {
        id: "task2",
        title: "Test Task 2",
        status: null,
        priority: null,
        sortOrder: 2,
        createdBy: "user1",
        assignees_json: '[]'
      }
    ]);

    const res = await testApp.request("/", {}, {}, mockExecutionContext);
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.tasks).toHaveLength(2);
    expect(body.tasks[0].title).toBe("Test Task");
    expect(body.tasks[0].assignees).toHaveLength(1);
    expect(body.tasks[0].assignees[0].nickname).toBe("Alice");
    expect(body.tasks[1].status).toBe("todo");
    expect(body.tasks[1].priority).toBe("normal");
  });

  it("GET / - handles db error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB Error"));
    const res = await testApp.request("/", {}, {}, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET / - filters by status", async () => {
    mockDb.all.mockResolvedValueOnce([]);
    const res = await testApp.request("/?status=todo", {}, {}, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.where).toHaveBeenCalled();
  });

  it("GET / - handles malformed assignees_json gracefully", async () => {
    mockDb.all.mockResolvedValueOnce([
      { id: "t1", title: "Bad JSON", status: "todo", priority: "normal", sortOrder: 0, createdBy: "u1", assignees_json: "INVALID" }
    ]);
    const res = await testApp.request("/", {}, {}, mockExecutionContext);
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.tasks[0].assignees).toEqual([]);
  });

  it("GET / - filters null assignee ids from left join", async () => {
    mockDb.all.mockResolvedValueOnce([
      { id: "t1", title: "Task", status: "todo", priority: "normal", sortOrder: 0, createdBy: "u1", assignees_json: '[{"id":null,"nickname":null},{"id":"u2","nickname":"Alice"}]' }
    ]);
    const res = await testApp.request("/", {}, {}, mockExecutionContext);
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.tasks[0].assignees).toHaveLength(1);
    expect(body.tasks[0].assignees[0].id).toBe("u2");
  });

  it("GET / - handles empty assignees_json", async () => {
    mockDb.all.mockResolvedValueOnce([
      { id: "t1", title: "No Assigns", status: "done", priority: "low", sortOrder: 0, createdBy: "u1", assignees_json: null }
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
    mockDb.all.mockResolvedValueOnce([{ id: "user2", nickname: "Alice" }]); // For profiles fetch

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
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();

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

    console.log(await res.text());
    expect(res.status).toBe(401);
  });

  it("POST / - handles create error", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "student" } as any);
    (mockDb.insert as any).mockImplementationOnce(() => { throw new Error("Create fail"); });

    const res = await testApp.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Task" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("POST / - handles Zulip failure in create gracefully", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "student" } as any);

    // Fail the user query to trigger the catch block for assignee notifications
    mockDb.all = vi.fn()
      .mockResolvedValueOnce([]) // insert tasks
      .mockResolvedValueOnce([]) // insert assignments
      .mockResolvedValueOnce([]) // insert audit
      .mockResolvedValueOnce([{ id: "user2", nickname: "Alice" }]) // profiles
      .mockRejectedValueOnce(new Error("DB query fail for user emails"));

    const res = await testApp.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Task", assignees: ["user2"] })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
    await Promise.allSettled(mockExecutionContext.promises); // allow waitUntil to throw
  });

  it("POST / - handles Zulip thread creation failure gracefully", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "student" } as any);
    mockDb.all = vi.fn()
      .mockResolvedValueOnce([]) // insert tasks
      .mockResolvedValueOnce([]) // insert assignments
      .mockResolvedValueOnce([]) // insert audit
      .mockResolvedValueOnce([]) // profiles
      .mockResolvedValueOnce([]); // emails

    vi.mocked(sendZulipMessage).mockRejectedValueOnce(new Error("Zulip Thread Down"));

    const res = await testApp.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Task", assignees: [] })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
    await Promise.allSettled(mockExecutionContext.promises); // allow waitUntil to throw
  });

  it("POST / - sends Zulip notification on create", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "student" } as any);
    mockDb.all = vi.fn().mockResolvedValue([{ email: "alice@test.com", id: "user2", nickname: null }]);
    vi.mocked(sendZulipMessage).mockResolvedValueOnce("msg123");

    const res = await testApp.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Task", assignees: ["user2"], due_date: "2024-01-01" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
    await Promise.allSettled(mockExecutionContext.promises); // allow waitUntil to resolve
    expect(sendZulipMessage).toHaveBeenCalled();
  });

  it("POST / - handles Zulip individual notification failure gracefully", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "student" } as any);
    mockDb.all = vi.fn()
      .mockResolvedValueOnce([]) // insert tasks
      .mockResolvedValueOnce([]) // insert assignments
      .mockResolvedValueOnce([]) // insert audit
      .mockResolvedValueOnce([{ id: "user2", nickname: "Alice" }]) // profiles
      .mockResolvedValueOnce([{ email: "alice@test.com", user_id: "user2", nickname: null }]); // emails

    vi.mocked(sendZulipMessage).mockRejectedValueOnce(new Error("Zulip single fail"));

    const res = await testApp.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Task", assignees: ["user2"], due_date: "2024-01-01" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
    await Promise.allSettled(mockExecutionContext.promises); // allow waitUntil to resolve
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
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("PATCH /reorder - rejects unauthenticated user", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce(null);

    const res = await testApp.request("/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [] })
    }, {}, mockExecutionContext);

    console.log(await res.text());
    expect(res.status).toBe(401);
  });

  it("PATCH /reorder - handles db error", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "student" } as any);
    mockDb.run.mockRejectedValueOnce(new Error("DB fail"));

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
    mockDb.first.mockResolvedValueOnce({ id: "task1", createdBy: "user2", title: "Task" });

    const res = await testApp.request("/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Task", assignees: ["user3"] })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.delete).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("PATCH /:id - allows any member to update task fields (no assignees)", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "member1", role: "student" } as any);
    mockDb.first.mockResolvedValueOnce({ id: "task1", createdBy: "other_user", title: "Task" });

    const res = await testApp.request("/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Renamed", status: "in_progress", priority: "high" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("PATCH /:id - blocks assignment change by non-privileged non-owner", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "student1", role: "student" } as any);
    mockDb.first.mockResolvedValueOnce({ id: "task1", createdBy: "other_user", title: "Task" });

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
    mockDb.first.mockResolvedValueOnce({ id: "task1", createdBy: "creator1", title: "My Task" });

    const res = await testApp.request("/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignees: ["user2"] })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockDb.delete).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("PATCH /:id - allows mentor to change assignments", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "mentor1", role: "mentor" } as any);
    mockDb.first.mockResolvedValueOnce({ id: "task1", createdBy: "other", title: "Task" });

    const res = await testApp.request("/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignees: ["user2"] })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("PATCH /:id - returns 404 for non-existent task", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "admin" } as any);
    mockDb.first.mockResolvedValueOnce(null);

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

    console.log(await res.text());
    expect(res.status).toBe(401);
  });

  it("PATCH /:id - handles update error", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "admin" } as any);
    mockDb.first.mockRejectedValueOnce(new Error("DB fail"));

    const res = await testApp.request("/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Crash" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("PATCH /:id - sends Zulip notification to new assignees", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "admin" } as any);
    mockDb.first.mockResolvedValueOnce({ id: "task1", createdBy: "user2", title: "Task" });
    mockDb.all = vi.fn().mockResolvedValue([{ email: "bob@test.com", user_id: "user3", nickname: "Bob" }]);
    vi.mocked(sendZulipMessage).mockResolvedValueOnce("msg123");

    const res = await testApp.request("/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Task", assignees: ["user3"] })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(sendZulipMessage).toHaveBeenCalled();
  });

  it("PATCH /:id - handles Zulip notification rejection", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "admin" } as any);
    mockDb.first.mockResolvedValueOnce({ id: "task1", createdBy: "user2", title: "Task" });
    mockDb.all = vi.fn().mockResolvedValue([{ email: "bob@test.com", user_id: "user3", nickname: "Bob" }]);
    vi.mocked(sendZulipMessage).mockRejectedValueOnce(new Error("Zulip API down"));

    const res = await testApp.request("/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignees: ["user3"] })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("PATCH /:id - updates all fields and clears assignees", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "admin" } as any);
    mockDb.first.mockResolvedValueOnce({ id: "task1", createdBy: "user2", title: "Task" });
    mockDb.all = vi.fn().mockResolvedValue([]);

    const res = await testApp.request("/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "New desc",
        due_date: "2024-01-01",
        sortOrder: 5,
        assignees: []
      })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("PATCH /:id - handles Zulip failure in update gracefully", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "admin" } as any);
    mockDb.first.mockResolvedValueOnce({ id: "task1", createdBy: "user2", title: "Task" });

    // Fail the user query to trigger the catch block for assignee notifications
    mockDb.all = vi.fn()
      .mockResolvedValueOnce([]) // update task
      .mockResolvedValueOnce([]) // delete assignments
      .mockResolvedValueOnce([]) // insert assignments
      .mockRejectedValueOnce(new Error("DB query fail for user emails"));

    const res = await testApp.request("/task1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Task", assignees: ["user3"] })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  // ─── DELETE ─────────────────────────────────────────────────────────────

  it("DELETE /:id - deletes task (admin)", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "admin" } as any);
    mockDb.first.mockResolvedValueOnce({ createdBy: "user2" });

    const res = await testApp.request("/task1", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }, {}, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("DELETE /:id - deletes task (owner)", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "owner1", role: "student" } as any);
    mockDb.first.mockResolvedValueOnce({ createdBy: "owner1" });

    const res = await testApp.request("/task1", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }, {}, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("DELETE /:id - blocks non-admin non-owner", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "student1", role: "student" } as any);
    mockDb.first.mockResolvedValueOnce({ createdBy: "other_user" });

    const res = await testApp.request("/task1", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }, {}, mockExecutionContext);
    expect(res.status).toBe(403);

    const body = await res.json() as any;
    expect(body.error).toContain("not authorized");
  });

  it("DELETE /:id - returns 404 for non-existent task", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "admin" } as any);
    mockDb.first.mockResolvedValueOnce(null);

    const res = await testApp.request("/task1", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }, {}, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("DELETE /:id - rejects unauthenticated user", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce(null);

    const res = await testApp.request("/task1", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }, {}, mockExecutionContext);
    console.log(await res.text());
    expect(res.status).toBe(401);
  });

  it("DELETE /:id - handles error", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce({ id: "user1", role: "admin" } as any);
    mockDb.first.mockRejectedValueOnce(new Error("DB fail"));

    const res = await testApp.request("/task1", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }, {}, mockExecutionContext);
    expect(res.status).toBe(500);
  });
});
