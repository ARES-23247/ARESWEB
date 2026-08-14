import type { TaskItem } from "@/types/task";
import { readSubtasks } from "./taskSubtasks";

const FALLBACK_DATE = "1970-01-01T00:00:00.000Z";

function normalizedToken(value: unknown): string {
  return typeof value === "string"
    ? value
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_")
    : "";
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
    commentsCount: Math.min(Math.max(rawCommentsCount, 0), 1_000_000),
  };
}

export function selectPriorityTasks(tasks: TaskItem[], maximum = 4): TaskItem[] {
  const priorityWeight: Record<TaskItem["priority"], number> = { high: 3, medium: 2, low: 1 };
  return tasks
    .filter((task) => task.isDeleted !== 1 && !task.archived && task.status !== "completed")
    .sort((left, right) => {
      const priorityDifference = priorityWeight[right.priority] - priorityWeight[left.priority];
      return priorityDifference || Date.parse(right.createdAt) - Date.parse(left.createdAt);
    })
    .slice(0, Math.max(0, maximum));
}
