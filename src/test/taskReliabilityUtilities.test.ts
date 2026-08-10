import { describe, expect, it } from "vitest";
import { describeTaskError } from "@/app/dashboard/tasks/taskErrors";
import {
  appendSubtask,
  readSubtasks,
  removeSubtask,
  toggleSubtask,
} from "@/app/dashboard/tasks/taskSubtasks";

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
    const parsed = readSubtasks([...subtasks, null, { id: "bad" }]);

    expect(readSubtasks("invalid")).toEqual([]);
    expect(parsed).toEqual(subtasks);
    expect(toggleSubtask(parsed, "one")).toEqual([
      { id: "one", title: "First", done: true },
      subtasks[1],
    ]);
    expect(removeSubtask(parsed, "two")).toEqual([subtasks[0]]);
    expect(appendSubtask(parsed, { id: "three", title: "Third", done: false })).toHaveLength(3);
    expect(subtasks[0].done).toBe(false);
  });
});
