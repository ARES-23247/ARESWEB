import type { TeamEvent } from "@/types/event";
import type { TaskItem } from "@/types/task";
import { selectPriorityTasks } from "../tasks/taskRecord";

export function selectNextEvent(
  events: TeamEvent[],
  now = new Date(),
): TeamEvent | null {
  const nowTime = now.getTime();
  return [...events]
    .filter((event) => {
      const start = Date.parse(event.dateStart);
      const end = event.dateEnd ? Date.parse(event.dateEnd) : start;
      return Number.isFinite(start) && Number.isFinite(end) && end >= nowTime;
    })
    .sort((left, right) => Date.parse(left.dateStart) - Date.parse(right.dateStart))[0] ?? null;
}

export function selectTodayTasks(
  tasks: TaskItem[],
  identities: Array<string | null | undefined>,
  maximum = 4,
): { tasks: TaskItem[]; personalized: boolean } {
  const normalizedIdentities = new Set(
    identities
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  const activeTasks = tasks.filter(
    (task) => task.isDeleted !== 1 && !task.archived && task.status !== "completed",
  );
  const assigned = activeTasks.filter((task) =>
    task.assignees.some((assignee) => normalizedIdentities.has(assignee.trim().toLowerCase())),
  );

  return assigned.length > 0
    ? { tasks: selectPriorityTasks(assigned, maximum), personalized: true }
    : { tasks: selectPriorityTasks(activeTasks, maximum), personalized: false };
}
