/**
 * Tasks API - Task Management, Kanban Board
 *
 * Types imported from backend route definitions in @shared/routes/tasks.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse, withMutationCallbacks } from "./honoClient";
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
  dueDate?: string | null;
  parentId?: string | null;
  timeSpentSeconds?: number;
  assignedTo?: string | null;
  startDate?: string | null;
  estimatedMinutes?: number | null;
  coverImage?: string | null;
}

export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {
  sortOrder?: number;
}

export interface ReorderTasksRequest {
  items: Array<{ id: string; status: string; sortOrder: number }>;
}


// ============================================
// Tasks
// ============================================

/**
 * GET /api/tasks - Get all tasks
 */
export function useGetTasks(
  query?: { status?: string; parentId?: string },
  options?: Omit<UseQueryOptions<TasksResponse>, "queryKey" | "queryFn">
) {
  return useQuery<TasksResponse>({
    queryKey: ["tasks", query],
    queryFn: async function getTasks() {
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
    mutationFn: async function createTask(data) {
      const response = await client.tasks.$post({ json: data });
      return unwrapResponse<{ success: boolean; task: Task }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["tasks"] });
      }
    })
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
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["tasks"] });
      }
    })
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
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["tasks"] });
      }
    })
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
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["tasks"] });
      }
    })
  });
}

export function useCreateTaskAttachment(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { id: string; url: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { id: string; url: string }>({
    mutationFn: async ({ id, url }) => {
      const response = await client.tasks[":id"].attachments.$post({ param: { id }, json: { url } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["tasks"] });
      }
    })
  });
}

export function useDeleteTaskAttachment(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { id: string; attachmentId: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { id: string; attachmentId: string }>({
    mutationFn: async ({ id, attachmentId }) => {
      const response = await client.tasks[":id"].attachments[":attachmentId"].$delete({ param: { id, attachmentId } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["tasks"] });
      }
    })
  });
}

export function useCreateTaskChecklist(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { id: string; content: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { id: string; content: string }>({
    mutationFn: async ({ id, content }) => {
      const response = await client.tasks[":id"].checklists.$post({ param: { id }, json: { content } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["tasks"] });
      }
    })
  });
}

export function useUpdateTaskChecklist(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { id: string; checklistId: string; updates: { isCompleted?: number; content?: string; sortOrder?: number } }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { id: string; checklistId: string; updates: { isCompleted?: number; content?: string; sortOrder?: number } }>({
    mutationFn: async ({ id, checklistId, updates }) => {
      const response = await client.tasks[":id"].checklists[":checklistId"].$patch({ param: { id, checklistId }, json: updates });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["tasks"] });
      }
    })
  });
}

export function useDeleteTaskChecklist(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { id: string; checklistId: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { id: string; checklistId: string }>({
    mutationFn: async ({ id, checklistId }) => {
      const response = await client.tasks[":id"].checklists[":checklistId"].$delete({ param: { id, checklistId } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["tasks"] });
      }
    })
  });
}

export function useSetTaskLabels(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { id: string; labelIds: string[] }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { id: string; labelIds: string[] }>({
    mutationFn: async ({ id, labelIds }) => {
      const response = await client.tasks[":id"].labels.$post({ param: { id }, json: { labelIds } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["tasks"] });
      }
    })
  });
}
