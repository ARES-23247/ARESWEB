import type { TaskItem } from "@/types/task";
import { formatDateOnly, parseDateOnly } from "@/lib/dateOnly";
import { readSubtasks } from "./taskSubtasks";

const FALLBACK_DATE = "1970-01-01T00:00:00.000Z";
const TASK_DESCRIPTION_SUMMARY_LIMIT = 240;
const TASK_DESCRIPTION_NODE_LIMIT = 256;

export type TaskSortMode = "newest" | "priority" | "due";
export type TaskDueState = "overdue" | "today" | "upcoming" | null;

function normalizedToken(value: unknown): string {
  return typeof value === "string"
    ? value
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_")
    : "";
}

function compactTaskDescription(value: string): string {
  const compacted = value.replace(/\s+/g, " ").trim();
  if (compacted.length <= TASK_DESCRIPTION_SUMMARY_LIMIT) return compacted;
  return `${compacted.slice(0, TASK_DESCRIPTION_SUMMARY_LIMIT - 1).trimEnd()}…`;
}

function richTaskDescriptionSummary(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const root = value as Record<string, unknown>;
  if (root.type !== "doc" || !Array.isArray(root.content)) return null;

  const fragments: string[] = [];
  const pending: unknown[] = [root];
  let visited = 0;

  while (pending.length > 0 && visited < TASK_DESCRIPTION_NODE_LIMIT) {
    const candidate = pending.pop();
    visited += 1;
    if (typeof candidate !== "object" || candidate === null) continue;

    const node = candidate as Record<string, unknown>;
    if (node.type === "text" && typeof node.text === "string") {
      fragments.push(node.text);
    }

    const attrs =
      typeof node.attrs === "object" && node.attrs !== null
        ? (node.attrs as Record<string, unknown>)
        : null;
    if (node.type === "googleDriveEmbed") {
      const title = typeof attrs?.title === "string" ? attrs.title.trim() : "";
      fragments.push(title ? `Google Drive attachment: ${title}` : "Google Drive attachment");
    } else if (node.type === "image") {
      const alt = typeof attrs?.alt === "string" ? attrs.alt.trim() : "";
      fragments.push(alt ? `Image: ${alt}` : "Image attachment");
    } else if (node.type === "interactiveComponent") {
      const componentName =
        typeof attrs?.componentName === "string" ? attrs.componentName.trim() : "";
      fragments.push(componentName ? `Simulation: ${componentName}` : "Simulation attachment");
    }

    if (Array.isArray(node.content)) {
      for (let index = node.content.length - 1; index >= 0; index -= 1) {
        pending.push(node.content[index]);
      }
    }
  }

  return compactTaskDescription(fragments.join(" ")) || "Attached rich task content";
}

function markdownTaskDescriptionSummary(value: string): string {
  return compactTaskDescription(
    value
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s*(?:[-+*]|\d+\.)\s+/gm, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/[*_~`>|]/g, " "),
  );
}

export function summarizeTaskDescription(value: string | null | undefined): string | null {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate) return null;

  if (candidate.startsWith("{")) {
    try {
      const richSummary = richTaskDescriptionSummary(JSON.parse(candidate));
      if (richSummary) return richSummary;
    } catch {
      // A normal task description may begin with a brace; keep it as readable text.
    }
  }

  return markdownTaskDescriptionSummary(candidate) || "Attached task content";
}

export function taskMatchesSearch(task: TaskItem, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    task.title,
    summarizeTaskDescription(task.description),
    task.subteam,
    task.priority,
    task.status.replaceAll("_", " "),
  ]
    .filter((value): value is string => typeof value === "string")
    .some((value) => value.toLowerCase().includes(normalizedQuery));
}

export function buildDuplicateTaskCounts(tasks: TaskItem[]): ReadonlyMap<string, number> {
  const taskIdsByTitle = new Map<string, string[]>();

  for (const task of tasks) {
    const titleKey = task.title.replace(/\s+/g, " ").trim().toLowerCase();
    if (!titleKey) continue;
    const existing = taskIdsByTitle.get(titleKey) ?? [];
    existing.push(task.id);
    taskIdsByTitle.set(titleKey, existing);
  }

  const duplicateCounts = new Map<string, number>();
  for (const taskIds of taskIdsByTitle.values()) {
    if (taskIds.length < 2) continue;
    for (const taskId of taskIds) duplicateCounts.set(taskId, taskIds.length);
  }
  return duplicateCounts;
}

export function normalizeTaskStatus(value: unknown): TaskItem["status"] {
  const token = normalizedToken(value);
  if (token === "in_progress" || token === "doing" || token === "started")
    return "in_progress";
  if (token === "review" || token === "in_review" || token === "qa")
    return "review";
  if (token === "completed" || token === "complete" || token === "done")
    return "completed";
  return "todo";
}

export function normalizeTaskPriority(value: unknown): TaskItem["priority"] {
  const token = normalizedToken(value);
  if (token === "high" || token === "urgent" || token === "critical")
    return "high";
  if (token === "low") return "low";
  return "medium";
}

export function normalizeTaskSubteam(value: unknown): TaskItem["subteam"] {
  const token = normalizedToken(value);
  if (["hardware", "mechanical", "build"].includes(token)) return "hardware";
  if (["business", "marketing", "fundraising"].includes(token))
    return "business";
  if (["outreach", "community"].includes(token)) return "outreach";
  return "software";
}

export function normalizeTaskDate(value: unknown): string {
  try {
    const candidate =
      value instanceof Date
        ? value
        : typeof value === "object" &&
            value !== null &&
            "toDate" in value &&
            typeof value.toDate === "function"
          ? value.toDate()
          : typeof value === "string" || typeof value === "number"
            ? new Date(value)
            : null;
    return candidate instanceof Date && Number.isFinite(candidate.getTime())
      ? candidate.toISOString()
      : FALLBACK_DATE;
  } catch {
    return FALLBACK_DATE;
  }
}

export function normalizeTaskDueDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  return parseDateOnly(candidate) ? candidate : null;
}

export function getTaskDueState(
  task: Pick<TaskItem, "dueDate" | "status">,
  referenceDate = new Date(),
): TaskDueState {
  if (!task.dueDate || task.status === "completed") return null;
  const dueDate = parseDateOnly(task.dueDate);
  if (!dueDate) return null;
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  if (dueDate.getTime() < today.getTime()) return "overdue";
  if (dueDate.getTime() === today.getTime()) return "today";
  return "upcoming";
}

export function describeTaskDueDate(
  task: Pick<TaskItem, "dueDate" | "status">,
  referenceDate = new Date(),
): string | null {
  if (!task.dueDate) return null;
  const formatted = formatDateOnly(
    task.dueDate,
    { month: "short", day: "numeric" },
    "",
  );
  if (!formatted) return null;
  const state = getTaskDueState(task, referenceDate);
  if (state === "overdue") return `Overdue · ${formatted}`;
  if (state === "today") return "Due today";
  return `Due ${formatted}`;
}

export function normalizeTaskRecord(id: string, value: unknown): TaskItem {
  const data =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  const title =
    typeof data.title === "string" && data.title.trim()
      ? data.title.trim().slice(0, 240)
      : "Untitled Task";
  const description =
    typeof data.description === "string"
      ? data.description.slice(0, 20_000)
      : "";
  const assignees = Array.isArray(data.assignees)
    ? [
        ...new Set(
          data.assignees
            .filter(
              (assignee): assignee is string => typeof assignee === "string",
            )
            .map((assignee) => assignee.trim())
            .filter(Boolean),
        ),
      ].slice(0, 50)
    : [];
  const rawCommentsCount =
    typeof data.commentsCount === "number" &&
    Number.isFinite(data.commentsCount)
      ? Math.floor(data.commentsCount)
      : 0;

  return {
    id,
    title,
    description,
    status: normalizeTaskStatus(data.status),
    priority: normalizeTaskPriority(data.priority),
    subteam: normalizeTaskSubteam(data.subteam),
    assignees,
    subtasks: readSubtasks(data.subtasks).slice(0, 100),
    archived: data.archived === true,
    isDeleted: data.isDeleted === 1 || data.isDeleted === true ? 1 : 0,
    createdAt: normalizeTaskDate(data.createdAt),
    dueDate: normalizeTaskDueDate(data.dueDate),
    commentsCount: Math.min(Math.max(rawCommentsCount, 0), 1_000_000),
  };
}

const priorityWeight: Record<TaskItem["priority"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function sortTasks(tasks: TaskItem[], mode: TaskSortMode): TaskItem[] {
  return [...tasks].sort((left, right) => {
    if (mode === "due") {
      const leftDue = left.dueDate
        ? parseDateOnly(left.dueDate)?.getTime()
        : undefined;
      const rightDue = right.dueDate
        ? parseDateOnly(right.dueDate)?.getTime()
        : undefined;
      if (leftDue !== undefined || rightDue !== undefined) {
        if (leftDue === undefined) return 1;
        if (rightDue === undefined) return -1;
        if (leftDue !== rightDue) return leftDue - rightDue;
      }
    }
    if (mode === "priority" || mode === "due") {
      const priorityDifference =
        priorityWeight[right.priority] - priorityWeight[left.priority];
      if (priorityDifference) return priorityDifference;
    }
    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });
}

export function selectPriorityTasks(
  tasks: TaskItem[],
  maximum = 4,
): TaskItem[] {
  return tasks
    .filter(
      (task) =>
        task.isDeleted !== 1 && !task.archived && task.status !== "completed",
    )
    .sort((left, right) => {
      const priorityDifference =
        priorityWeight[right.priority] - priorityWeight[left.priority];
      return (
        priorityDifference ||
        Date.parse(right.createdAt) - Date.parse(left.createdAt)
      );
    })
    .slice(0, Math.max(0, maximum));
}
