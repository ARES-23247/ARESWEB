import { SubTask } from "@/types/task";

export function readSubtasks(value: unknown): SubTask[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is SubTask => {
    if (typeof item !== "object" || item === null) return false;
    const candidate = item as Record<string, unknown>;
    return (
      typeof candidate.id === "string" &&
      typeof candidate.title === "string" &&
      typeof candidate.done === "boolean"
    );
  });
}

export function toggleSubtask(subtasks: SubTask[], subtaskId: string): SubTask[] {
  return subtasks.map((subtask) =>
    subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask
  );
}

export function removeSubtask(subtasks: SubTask[], subtaskId: string): SubTask[] {
  return subtasks.filter((subtask) => subtask.id !== subtaskId);
}

export function appendSubtask(subtasks: SubTask[], subtask: SubTask): SubTask[] {
  return [...subtasks, subtask];
}
