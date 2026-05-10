import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  priority: z.string(),
  sortOrder: z.number(),
  assignees: z.array(
    z.object({
      id: z.string(),
      nickname: z.string().nullable(),
    })
  ).optional().default([]),
  createdBy: z.string(),
  creatorName: z.string().nullable(),
  dueDate: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  subteam: z.string().nullable(),
  zulipStream: z.string().nullable(),
  zulipTopic: z.string().nullable(),
  // Legacy fields for backward compatibility (transitioning to camelCase)
  assignedTo: z.string().nullable(),
  assigneeName: z.string().nullable(),
  parentId: z.string().nullable(),
  timeSpentSeconds: z.number().nullable(),
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
      parentId: z.string().optional(),
      subteam: z.string().optional(),
      assignedTo: z.string().optional(),
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
            dueDate: z.string().optional(),
            parentId: z.string().nullable().optional(),
            timeSpentSeconds: z.number().optional(),
            sortOrder: z.number().optional(),
            assignedTo: z.string().nullable().optional(),
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
                sortOrder: z.number(),
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
            dueDate: z.string().nullable().optional(),
            sortOrder: z.number().optional(),
            parentId: z.string().nullable().optional(),
            timeSpentSeconds: z.number().optional(),
            assignedTo: z.string().nullable().optional(),
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
