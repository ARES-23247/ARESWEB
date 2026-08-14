import { describe, expect, it } from "vitest";
import { describeTaskError } from "@/app/dashboard/tasks/taskErrors";
import {
  appendSubtask,
  readSubtasks,
  removeSubtask,
  toggleSubtask,
} from "@/app/dashboard/tasks/taskSubtasks";
import {
  normalizeTaskDate,
  normalizeTaskPriority,
  normalizeTaskRecord,
  normalizeTaskStatus,
  normalizeTaskSubteam,
  selectPriorityTasks,
} from "@/app/dashboard/tasks/taskRecord";

describe("Kanban reliability utilities", () => {
  it("turns authentication and authorization failures into actionable diagnostics", () => {
    expect(describeTaskError("save task", { status: 401, message: "Unauthorized" })).toMatchObject({
      title: "Unable to save task",
      message: expect.stringContaining("Sign in again"),
      diagnostic: "HTTP 401: Unauthorized",
    });

    expect(describeTaskError("delete task", { code: "permission-denied", message: "Forbidden" })).toMatchObject({
      message: expect.stringContaining("coach or administrator"),
      diagnostic: "permission-denied: Forbidden",
    });
  });

  it("describes conflict, missing, network, primitive, and Error failures", () => {
    expect(describeTaskError("update subtask", new Error("aborted conflict"))).toMatchObject({
      message: expect.stringContaining("same time"),
    });
    expect(describeTaskError("delete task", { code: "not-found", message: "Missing" })).toMatchObject({
      message: expect.stringContaining("no longer exists"),
    });
    expect(describeTaskError("move task", "network disconnected")).toMatchObject({
      message: expect.stringContaining("connection"),
      diagnostic: "network disconnected",
    });
  });

  it("validates and transforms subtask arrays without mutating the input", () => {
    const subtasks = [
      { id: "one", title: "First", done: false },
      { id: "two", title: "Second", done: true },
    ];
    const parsed = readSubtasks([...subtasks, null, { id: "bad" }, { id: "", title: "Empty", done: false }]);

    expect(readSubtasks("invalid")).toEqual([]);
    expect(parsed).toEqual(subtasks);
    expect(toggleSubtask(parsed, "one")).toEqual([
      { id: "one", title: "First", done: true },
      subtasks[1],
    ]);
    expect(removeSubtask(parsed, "two")).toEqual([subtasks[0]]);
    expect(appendSubtask(parsed, { id: "three", title: "Third", done: false })).toHaveLength(3);
    expect(subtasks[0].done).toBe(false);
    expect(readSubtasks([{ id: ` ${"i".repeat(170)} `, title: ` ${"T".repeat(510)} `, done: false }]))
      .toEqual([{ id: "i".repeat(160), title: "T".repeat(500), done: false }]);
    expect(readSubtasks(Array.from({ length: 105 }, (_, index) => ({
      id: `${index}`,
      title: "Bounded",
      done: false,
    })))).toHaveLength(100);
  });

  it("normalizes legacy task enums into the current board contract", () => {
    expect(normalizeTaskStatus("In Progress")).toBe("in_progress");
    expect(normalizeTaskStatus("QA")).toBe("review");
    expect(normalizeTaskStatus("done")).toBe("completed");
    expect(normalizeTaskStatus("unknown")).toBe("todo");

    expect(normalizeTaskPriority("urgent")).toBe("high");
    expect(normalizeTaskPriority("low")).toBe("low");
    expect(normalizeTaskPriority("normal")).toBe("medium");

    expect(normalizeTaskSubteam("Mechanical")).toBe("hardware");
    expect(normalizeTaskSubteam("Fundraising")).toBe("business");
    expect(normalizeTaskSubteam("Community")).toBe("outreach");
    expect(normalizeTaskSubteam("Programming")).toBe("software");
  });

  it("normalizes timestamp variants and fails closed to a stable oldest date", () => {
    expect(normalizeTaskDate("2026-08-14T01:02:03.000Z")).toBe("2026-08-14T01:02:03.000Z");
    expect(normalizeTaskDate(new Date("2026-08-13T01:02:03.000Z"))).toBe("2026-08-13T01:02:03.000Z");
    expect(normalizeTaskDate({ toDate: () => new Date("2026-08-12T01:02:03.000Z") }))
      .toBe("2026-08-12T01:02:03.000Z");
    expect(normalizeTaskDate({ toDate: () => { throw new Error("invalid timestamp"); } }))
      .toBe("1970-01-01T00:00:00.000Z");
    expect(normalizeTaskDate("not-a-date")).toBe("1970-01-01T00:00:00.000Z");
    expect(normalizeTaskDate(null)).toBe("1970-01-01T00:00:00.000Z");
  });

  it("bounds untrusted task records while preserving usable legacy content", () => {
    const task = normalizeTaskRecord("trusted-document-id", {
      id: "spoofed-id",
      title: `  ${"T".repeat(250)}  `,
      description: "D".repeat(20_010),
      status: "started",
      priority: "critical",
      subteam: "Build",
      assignees: [" member-1 ", "member-1", null, "", "member-2"],
      subtasks: [
        { id: "one", title: "Valid", done: false },
        { id: "invalid" },
      ],
      archived: "yes",
      isDeleted: true,
      createdAt: 0,
      commentsCount: -10,
    });

    expect(task).toMatchObject({
      id: "trusted-document-id",
      status: "in_progress",
      priority: "high",
      subteam: "hardware",
      assignees: ["member-1", "member-2"],
      subtasks: [{ id: "one", title: "Valid", done: false }],
      archived: false,
      isDeleted: 1,
      createdAt: "1970-01-01T00:00:00.000Z",
      commentsCount: 0,
    });
    expect(task.title).toHaveLength(240);
    expect(task.description).toHaveLength(20_000);

    expect(normalizeTaskRecord("empty", null)).toMatchObject({
      title: "Untitled Task",
      description: "",
      commentsCount: 0,
    });
    expect(normalizeTaskRecord("large-count", { commentsCount: 2_000_000 }).commentsCount)
      .toBe(1_000_000);
  });

  it("selects visible active tasks by priority and then recency", () => {
    const task = (id: string, overrides: Record<string, unknown> = {}) => normalizeTaskRecord(id, {
      title: id,
      status: "todo",
      priority: "medium",
      subteam: "software",
      createdAt: "2026-08-10T00:00:00.000Z",
      ...overrides,
    });
    const selected = selectPriorityTasks([
      task("older-medium"),
      task("newer-medium", { createdAt: "2026-08-11T00:00:00.000Z" }),
      task("high", { priority: "high" }),
      task("completed", { status: "completed", priority: "high" }),
      task("archived", { archived: true, priority: "high" }),
      task("deleted", { isDeleted: 1, priority: "high" }),
    ], 2);

    expect(selected.map(({ id }) => id)).toEqual(["high", "newer-medium"]);
    expect(selectPriorityTasks([task("only")], -1)).toEqual([]);
  });
});
