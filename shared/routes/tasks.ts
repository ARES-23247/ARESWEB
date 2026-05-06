import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  priority: z.string(),
  sort_order: z.number(),
  assignees: z.array(
    z.object({
      id: z.string(),
      nickname: z.string().nullable(),
    })
  ).optional().default([]),
  created_by: z.string(),
  creator_name: z.string().nullable(),
  due_date: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  subteam: z.string().nullable(),
  zulip_stream: z.string().nullable(),
  zulip_topic: z.string().nullable(),
  // Legacy fields for backward compatibility
  assigned_to: z.string().nullable(),
  assignee_name: z.string().nullable(),
  parent_id: z.string().nullable(),
  time_spent_seconds: z.number().nullable(),
});

export const listTasksRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["tasks"],
  summary: "List all tasks",
  description: "Fetches all tasks with optional filtering.",
  request: {
    query: z.object({
      status: z.string().optional(),
      parent_id: z.string().optional(),
      subteam: z.string().optional(),
      assigned_to: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            tasks: z.array(TaskSchema),
          }),
        },
      },
      description: "List of tasks",
    },
  },
});

export const createTaskRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["tasks"],
  summary: "Create a new task",
  description: "Creates a new task with the provided details.",
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
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            task: TaskSchema,
          }),
        },
      },
      description: "Task created successfully",
    },
  },
});

export const reorderTasksRoute = createRoute({
  method: "patch",
  path: "/reorder",
  tags: ["tasks"],
  summary: "Batch reorder tasks (for drag-and-drop)",
  description: "Updates the status and sort order of multiple tasks.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            items: z.array(
              z.object({
                id: z.string(),
                status: z.string(),
                sort_order: z.number(),
              })
            ),
          }),
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
      description: "Tasks reordered successfully",
    },
  },
});

export const updateTaskRoute = createRoute({
  method: "patch",
  path: "/{id}",
  tags: ["tasks"],
  summary: "Update a task",
  description: "Updates an existing task with the provided details.",
  request: {
    params: z.object({
      id: z.string(),
    }),
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
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
      description: "Task updated successfully",
    },
  },
});

export const deleteTaskRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["tasks"],
  summary: "Delete a task",
  description: "Deletes a task by ID.",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
      description: "Task deleted successfully",
    },
  },
});
