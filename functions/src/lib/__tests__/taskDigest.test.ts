import { beforeEach, describe, expect, it, vi } from "vitest";
import { bucketByDueDate, formatDueDigest, sendTaskDueDigest } from "../taskDigest";

const sendZulipMessage = vi.fn();

vi.mock("../zulip", () => ({
  sendZulipMessage: (...args: unknown[]) => sendZulipMessage(...args),
}));

const queryGet = vi.fn();
const collectionRef = {
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  startAfter: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  get: queryGet,
};
const getAll = vi.fn();

vi.mock("../firebase-admin", () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === "user_profiles") return { doc: (uid: string) => ({ kind: "profile", uid }) };
      return collectionRef;
    }),
    getAll: (...args: unknown[]) => getAll(...args),
  },
}));

function taskDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

function pageOf(docs: ReturnType<typeof taskDoc>[]) {
  return {
    empty: docs.length === 0,
    size: docs.length,
    docs,
  };
}

describe("task due-date digest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendZulipMessage.mockResolvedValue(true);
    getAll.mockResolvedValue([]);
    delete process.env.ZULIP_KANBAN_STREAM;
  });

  it("buckets due dates relative to the digest day", () => {
    expect(bucketByDueDate("2026-08-16", "2026-08-17")).toBe("overdue");
    expect(bucketByDueDate("2026-08-17", "2026-08-17")).toBe("today");
    expect(bucketByDueDate("2026-08-18", "2026-08-17")).toBe("tomorrow");
    expect(bucketByDueDate("2026-09-01", "2026-08-17")).toBeNull();
    expect(bucketByDueDate("not-a-date", "2026-08-17")).toBeNull();
  });

  it("formats sections with per-card links and skips when nothing is due", () => {
    const content = formatDueDigest({
      overdue: [{ id: "task_a", title: "Fix intake", dueDate: "2026-08-16", status: "todo", assignees: ["uid-1"] }],
      today: [],
      tomorrow: [{ id: "task_b", title: "Print brackets", dueDate: "2026-08-18", status: "in_progress", assignees: [] }],
    });
    expect(content).toContain("**Overdue (1)**");
    expect(content).toContain("Fix intake — uid-1");
    expect(content).toContain("(https://aresfirst.org/dashboard/tasks?task=task_a)");
    expect(content).toContain("**Due tomorrow (1)**");
    expect(content).not.toContain("**Due today**");

    expect(formatDueDigest({ overdue: [], today: [], tomorrow: [] })).toBeNull();
  });

  it("renders a generic label instead of internal UIDs when a nickname map is supplied", () => {
    const content = formatDueDigest(
      {
        overdue: [{ id: "task_a", title: "Fix intake", dueDate: "2026-08-16", status: "todo", assignees: ["uid-1", "uid-2"] }],
        today: [],
        tomorrow: [],
      },
      undefined,
      new Map([["uid-1", "Alice"]]),
    );
    expect(content).toContain("Fix intake — Alice, member");
    expect(content).not.toContain("uid-1");
    expect(content).not.toContain("uid-2");
  });

  it("posts one digest, resolving assignees to nicknames, and excludes stale tasks", async () => {
    queryGet.mockResolvedValueOnce(
      pageOf([
        taskDoc("task_overdue", { title: "Overdue work", status: "todo", archived: false, isDeleted: 0, dueDate: "2026-08-15", assignees: ["uid-1"] }),
        taskDoc("task_today", { title: "Today work", status: "in_progress", archived: false, isDeleted: 0, dueDate: "2026-08-17", assignees: [] }),
        taskDoc("task_completed", { title: "Done", status: "completed", archived: false, isDeleted: 0, dueDate: "2026-08-16", assignees: [] }),
        taskDoc("task_archived", { title: "Old", status: "todo", archived: true, isDeleted: 0, dueDate: "2026-08-16", assignees: [] }),
        taskDoc("task_deleted", { title: "Gone", status: "todo", archived: false, isDeleted: 1, dueDate: "2026-08-16", assignees: [] }),
        taskDoc("task_later", { title: "Later", status: "todo", archived: false, isDeleted: 0, dueDate: "2026-09-20", assignees: [] }),
        taskDoc("task_nodate", { title: "Someday", status: "todo", archived: false, isDeleted: 0, assignees: [] }),
      ]),
    );
    getAll.mockResolvedValue([{ data: () => ({ nickname: "Alice" }) }]);

    await expect(sendTaskDueDigest(new Date("2026-08-17T12:00:00Z"))).resolves.toBe(true);
    expect(sendZulipMessage).toHaveBeenCalledTimes(1);
    const [stream, topic, content] = sendZulipMessage.mock.calls[0];
    expect(stream).toBe("kanban");
    expect(topic).toBe("Due Dates");
    expect(content).toContain("Overdue work — Alice");
    expect(content).toContain("Today work");
    expect(content).not.toContain("uid-1");
    expect(content).not.toContain("Done");
    expect(content).not.toContain("Old");
    expect(content).not.toContain("Gone");
    expect(content).not.toContain("Later");
    expect(content).not.toContain("Someday");
  });

  it("pages past a full first page so no due task is silently omitted", async () => {
    const firstPage = Array.from({ length: 400 }, (_, i) =>
      taskDoc(`task_${i}`, { title: `Task ${i}`, status: "todo", archived: false, isDeleted: 0, dueDate: "2026-08-17" }),
    );
    queryGet
      .mockResolvedValueOnce(pageOf(firstPage))
      .mockResolvedValueOnce(
        pageOf([
          taskDoc("task_400", { title: "Next page task", status: "todo", archived: false, isDeleted: 0, dueDate: "2026-08-17" }),
        ]),
      );

    await expect(sendTaskDueDigest(new Date("2026-08-17T12:00:00Z"))).resolves.toBe(true);
    expect(queryGet).toHaveBeenCalledTimes(2);
    expect(collectionRef.startAfter).toHaveBeenCalledWith(firstPage[399]);
    const content = sendZulipMessage.mock.calls[0][2];
    expect(content).toContain("**Due today (401)**");
    expect(content).toContain("Next page task");
  });

  it("skips posting entirely when no task is due within the window", async () => {
    queryGet.mockResolvedValueOnce(
      pageOf([taskDoc("task_later", { title: "Later", status: "todo", archived: false, isDeleted: 0, dueDate: "2026-09-20", assignees: [] })]),
    );
    await expect(sendTaskDueDigest(new Date("2026-08-17T12:00:00Z"))).resolves.toBe(true);
    expect(sendZulipMessage).not.toHaveBeenCalled();
  });

  it("reports the failure when Zulip does not accept the digest", async () => {
    sendZulipMessage.mockResolvedValue(false);
    queryGet.mockResolvedValueOnce(
      pageOf([taskDoc("task_today", { title: "Today work", status: "todo", archived: false, isDeleted: 0, dueDate: "2026-08-17", assignees: [] })]),
    );

    await expect(sendTaskDueDigest(new Date("2026-08-17T12:00:00Z"))).resolves.toBe(false);
  });
});
