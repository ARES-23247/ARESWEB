import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  status: z.string(),
  priority: z.string(),
  sort_order: z.number(),
  assignees: z.array(z.object({
    id: z.string(),
    nickname: z.string().nullable().optional(),
  })).optional().default([]),
  created_by: z.string(),
  creator_name: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  subteam: z.string().nullable().optional(),
  zulip_stream: z.string().nullable().optional(),
  zulip_topic: z.string().nullable().optional(),
  // Legacy fields for backward compatibility
  assigned_to: z.string().nullable().optional(),
  assignee_name: z.string().nullable().optional(),
  parent_id: z.string().nullable().optional(),
  time_spent_seconds: z.number().nullable().optional(),
});

export const listTasksRoute = createRoute({
  method: "get",
  path: "/",
  request: {
    query: z.object({
      status: z.string().optional(),
      parent_id: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "List all tasks",
      content: { "application/json": { schema: z.object({ tasks: z.array(taskSchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const createTaskRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            title: z.string().min(1).max(500),
            description: z.string().max(10000).optional(),
            status: z.enum(["todo", "in_progress", "done", "blocked"]).optional(),
            priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
            subteam: z.string().nullable().optional(),
            assignees: z.array(z.string()).optional(),
            due_date: z.string().optional(),
            parent_id: z.string().nullable().optional(),
            time_spent_seconds: z.number().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Create a new task",
      content: { "application/json": { schema: z.object({ success: z.boolean(), task: taskSchema }) } },
    },
    ...openApiStandardErrors,
  },
});

export const reorderTasksRoute = createRoute({
  method: "patch",
  path: "/reorder",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            items: z.array(z.object({
              id: z.string(),
              status: z.string(),
              sort_order: z.number(),
            })),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Batch reorder tasks (for drag-and-drop)",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const updateTaskRoute = createRoute({
  method: "patch",
  path: "/{id}",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            title: z.string().min(1).max(500).optional(),
            description: z.string().max(10000).nullable().optional(),
            status: z.enum(["todo", "in_progress", "done", "blocked"]).optional(),
            priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
            subteam: z.string().nullable().optional(),
            assignees: z.array(z.string()).optional(),
            due_date: z.string().nullable().optional(),
            sort_order: z.number().optional(),
            parent_id: z.string().nullable().optional(),
            time_spent_seconds: z.number().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Update a task",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const deleteTaskRoute = createRoute({
  method: "delete",
  path: "/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Delete a task",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});
