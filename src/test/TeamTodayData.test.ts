import { describe, expect, it } from "vitest";
import type { TeamEvent } from "@/types/event";
import type { TaskItem } from "@/types/task";
import { selectNextEvent, selectTodayTasks } from "@/app/dashboard/today/todayData";

function event(id: string, dateStart: string, dateEnd?: string): TeamEvent {
  return { id, title: id, dateStart, dateEnd, category: "internal", isDeleted: 0 };
}

function task(id: string, overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id,
    title: id,
    description: "",
    status: "todo",
    priority: "medium",
    subteam: "software",
    assignees: [],
    subtasks: [],
    createdAt: "2026-08-20T12:00:00.000Z",
    ...overrides,
  };
}

describe("Team Today data selection", () => {
  it("selects the earliest current or future event and rejects malformed or finished entries", () => {
    const now = new Date("2026-08-23T16:00:00.000Z");
    expect(selectNextEvent([
      event("later", "2026-08-25T18:00:00.000Z"),
      event("finished", "2026-08-22T18:00:00.000Z"),
      event("active", "2026-08-23T15:00:00.000Z", "2026-08-23T17:00:00.000Z"),
      event("invalid", "not-a-date"),
    ], now)?.id).toBe("active");
    expect(selectNextEvent([event("past", "2026-08-20T18:00:00.000Z")], now)).toBeNull();
  });

  it("prefers active tasks assigned to a current identity", () => {
    const result = selectTodayTasks([
      task("mine", { assignees: ["MEMBER@example.org"], priority: "high" }),
      task("other", { assignees: ["other"] }),
      task("done", { assignees: ["member@example.org"], status: "completed" }),
      task("archived", { assignees: ["member@example.org"], archived: true }),
      task("deleted", { assignees: ["member@example.org"], isDeleted: 1 }),
    ], [null, " member@example.org "]);
    expect(result).toEqual({ tasks: [expect.objectContaining({ id: "mine" })], personalized: true });
  });

  it("falls back to bounded priority work when no task is assigned", () => {
    const result = selectTodayTasks([
      task("medium"),
      task("high", { priority: "high" }),
      task("low", { priority: "low" }),
    ], [undefined, "nobody"], 2);
    expect(result.personalized).toBe(false);
    expect(result.tasks.map((item) => item.id)).toEqual(["high", "medium"]);
  });
});
