import { SubTask } from "@/types/task";

export function readSubtasks(value: unknown): SubTask[] {
  if (!Array.isArray(value)) return [];

  const subtasks: SubTask[] = [];
  for (const item of value) {
    if (subtasks.length >= 100) break;
    if (typeof item !== "object" || item === null) continue;
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.title !== "string" ||
      typeof candidate.done !== "boolean"
    ) continue;
    const id = candidate.id.trim().slice(0, 160);
    const title = candidate.title.trim().slice(0, 500);
    if (!id || !title) continue;
    subtasks.push({ id, title, done: candidate.done });
  }
  return subtasks;
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
