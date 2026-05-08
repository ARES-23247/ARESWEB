/**
 * Tasks API - Task Management, Kanban Board
 *
 * Types imported from backend route definitions in @shared/routes/tasks.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse } from "./honoClient";
import { TaskSchema } from "@shared/routes/tasks";

// Infer TypeScript types from Zod schemas
export type Task = z.infer<typeof TaskSchema>;

export interface TasksResponse {
  tasks: Task[];
}

export interface CreateTaskRequest {
  title: string;
  description?: string | null;
  status?: "todo" | "in_progress" | "done" | "blocked";
  priority?: "low" | "normal" | "high" | "urgent";
  subteam?: string | null;
  assignees?: string[];
  due_date?: string | null;
  parent_id?: string | null;
  time_spent_seconds?: number;
}

export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {
  sort_order?: number;
}

export interface ReorderTasksRequest {
  items: Array<{ id: string; status: string; sort_order: number }>;
}


// ============================================
// Tasks
// ============================================

/**
 * GET /api/tasks - Get all tasks
 */
export function useGetTasks(
  query?: { status?: string; parent_id?: string },
  options?: Omit<UseQueryOptions<TasksResponse>, "queryKey" | "queryFn">
) {
  return useQuery<TasksResponse>({
    queryKey: ["tasks", query],
    queryFn: async () => {
      const response = await client.tasks.$get({ query });
      return unwrapResponse<TasksResponse>(response);
    },
    ...options,
  });
}

/**
 * POST /api/tasks - Create a new task
 */
export function useCreateTask(
  options?: Omit<UseMutationOptions<{ success: boolean; task: Task }, Error, CreateTaskRequest>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; task: Task }, Error, CreateTaskRequest>({
    mutationFn: async (data) => {
      const response = await client.tasks.$post({ json: data });
      return unwrapResponse<{ success: boolean; task: Task }>(response);
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      options?.onSuccess?.();
    }
  });
}

/**
 * PATCH /api/tasks/:id - Update a task
 */
export function useUpdateTask(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { id: string; updates: UpdateTaskRequest }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { id: string; updates: UpdateTaskRequest }>({
    mutationFn: async ({ id, updates }) => {
      const response = await client.tasks[":id"].$patch({ param: { id }, json: updates });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      options?.onSuccess?.();
    }
  });
}

/**
 * DELETE /api/tasks/:id - Delete a task
 */
export function useDeleteTask(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id) => {
      const response = await client.tasks[":id"].$delete({ param: { id } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      options?.onSuccess?.();
    }
  });
}

/**
 * PATCH /api/tasks/reorder - Reorder tasks (drag-and-drop)
 */
export function useReorderTasks(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, ReorderTasksRequest>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, ReorderTasksRequest>({
    mutationFn: async (items) => {
      const response = await client.tasks.reorder.$patch({ json: items });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      options?.onSuccess?.();
    }
  });
}
