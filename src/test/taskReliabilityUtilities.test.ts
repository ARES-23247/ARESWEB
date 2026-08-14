import { describe, expect, it } from "vitest";
import { describeTaskError } from "@/app/dashboard/tasks/taskErrors";
import {
  appendSubtask,
  readSubtasks,
  removeSubtask,
  toggleSubtask,
} from "@/app/dashboard/tasks/taskSubtasks";
import {
  buildDuplicateTaskCounts,
  describeTaskDueDate,
  getTaskDueState,
  normalizeTaskDate,
  normalizeTaskDueDate,
  normalizeTaskPriority,
  normalizeTaskRecord,
  normalizeTaskStatus,
  normalizeTaskSubteam,
  selectPriorityTasks,
  sortTasks,
  summarizeTaskDescription,
  taskMatchesSearch,
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

  it("normalizes date-only deadlines and derives local calendar labels", () => {
    const referenceDate = new Date(2026, 7, 14, 23, 30);

    expect(normalizeTaskDueDate(" 2026-08-15 ")).toBe("2026-08-15");
    expect(normalizeTaskDueDate("2026-02-29")).toBeNull();
    expect(normalizeTaskDueDate(20260815)).toBeNull();
    expect(getTaskDueState({ dueDate: "2026-08-13", status: "todo" }, referenceDate)).toBe("overdue");
    expect(getTaskDueState({ dueDate: "2026-08-14", status: "review" }, referenceDate)).toBe("today");
    expect(getTaskDueState({ dueDate: "2026-08-15", status: "in_progress" }, referenceDate)).toBe("upcoming");
    expect(getTaskDueState({ dueDate: "2026-08-13", status: "completed" }, referenceDate)).toBeNull();
    expect(getTaskDueState({ dueDate: null, status: "todo" }, referenceDate)).toBeNull();
    expect(getTaskDueState({ dueDate: "invalid", status: "todo" }, referenceDate)).toBeNull();
    expect(describeTaskDueDate({ dueDate: "2026-08-13", status: "todo" }, referenceDate)).toBe("Overdue · Aug 13");
    expect(describeTaskDueDate({ dueDate: "2026-08-14", status: "todo" }, referenceDate)).toBe("Due today");
    expect(describeTaskDueDate({ dueDate: "2026-08-15", status: "todo" }, referenceDate)).toBe("Due Aug 15");
    expect(describeTaskDueDate({ dueDate: "invalid", status: "todo" }, referenceDate)).toBeNull();
    expect(describeTaskDueDate({ dueDate: null, status: "todo" }, referenceDate)).toBeNull();
  });

  it("summarizes rich and Markdown task descriptions without exposing serialized documents", () => {
    const richDescription = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "googleDriveEmbed",
          attrs: {
            src: "https://docs.google.com/document/d/private-id/edit",
            title: "Ball Script",
          },
        },
        { type: "paragraph", content: [{ type: "text", text: "Review before practice." }] },
      ],
    });

    expect(summarizeTaskDescription(richDescription)).toBe(
      "Google Drive attachment: Ball Script Review before practice.",
    );
    expect(summarizeTaskDescription("### Inspect **intake** with the [guide](https://example.org)"))
      .toBe("Inspect intake with the guide");
    expect(summarizeTaskDescription("{Inspect the drivetrain JSON output}")).toBe(
      "{Inspect the drivetrain JSON output}",
    );
    expect(summarizeTaskDescription("  ")).toBeNull();
    expect(summarizeTaskDescription(null)).toBeNull();
  });

  it("uses truthful attachment labels and bounds unusually large summaries", () => {
    const attachmentDescription = JSON.stringify({
      type: "doc",
      content: [
        { type: "image", attrs: { alt: "Intake prototype" } },
        { type: "interactiveComponent", attrs: { componentName: "Physics" } },
        { type: "googleDriveEmbed", attrs: {} },
      ],
    });
    const emptyRichDescription = JSON.stringify({ type: "doc", content: [] });

    expect(summarizeTaskDescription(attachmentDescription)).toBe(
      "Image: Intake prototype Simulation: Physics Google Drive attachment",
    );
    expect(summarizeTaskDescription(emptyRichDescription)).toBe("Attached rich task content");
    expect(summarizeTaskDescription("x".repeat(400))).toMatch(/^x{239}…$/);
  });

  it("matches useful task fields and identifies normalized duplicate titles", () => {
    const createTask = (id: string, title: string, overrides: Record<string, unknown> = {}) =>
      normalizeTaskRecord(id, {
        title,
        description: "Inspect the drivetrain before practice.",
        status: "in_progress",
        priority: "high",
        subteam: "hardware",
        createdAt: "2026-08-14T00:00:00.000Z",
        ...overrides,
      });
    const tasks = [
      createTask("first", "Review  robot plan"),
      createTask("second", " review robot PLAN "),
      createTask("unique", "Prepare notebook", { priority: "low" }),
    ];

    expect(taskMatchesSearch(tasks[0], "drivetrain")).toBe(true);
    expect(taskMatchesSearch(tasks[0], "IN PROGRESS")).toBe(true);
    expect(taskMatchesSearch(tasks[0], "hardware")).toBe(true);
    expect(taskMatchesSearch(tasks[0], "  ")).toBe(true);
    expect(taskMatchesSearch(tasks[0], "outreach")).toBe(false);

    const duplicates = buildDuplicateTaskCounts(tasks);
    expect([...duplicates.entries()]).toEqual([
      ["first", 2],
      ["second", 2],
    ]);
    expect(duplicates.has("unique")).toBe(false);
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
      dueDate: "2026-08-15",
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
      dueDate: "2026-08-15",
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

  it("sorts by newest, priority, or earliest deadline without mutating input", () => {
    const task = (id: string, overrides: Record<string, unknown> = {}) => normalizeTaskRecord(id, {
      title: id,
      status: "todo",
      priority: "medium",
      subteam: "software",
      createdAt: "2026-08-10T00:00:00.000Z",
      ...overrides,
    });
    const tasks = [
      task("no-due-high", { priority: "high", createdAt: "2026-08-12T00:00:00.000Z" }),
      task("later", { dueDate: "2026-08-20", createdAt: "2026-08-11T00:00:00.000Z" }),
      task("sooner-low", { dueDate: "2026-08-15", priority: "low" }),
      task("sooner-high", { dueDate: "2026-08-15", priority: "high" }),
    ];

    expect(sortTasks(tasks, "due").map(({ id }) => id)).toEqual([
      "sooner-high", "sooner-low", "later", "no-due-high",
    ]);
    expect(sortTasks(tasks, "priority").map(({ id }) => id)).toEqual([
      "no-due-high", "sooner-high", "later", "sooner-low",
    ]);
    expect(sortTasks(tasks, "newest").map(({ id }) => id)).toEqual([
      "no-due-high", "later", "sooner-low", "sooner-high",
    ]);
    expect(tasks.map(({ id }) => id)).toEqual([
      "no-due-high", "later", "sooner-low", "sooner-high",
    ]);
  });
});
