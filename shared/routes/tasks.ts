import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import {
  selectTaskSchema,
  selectTaskAssignmentSchema,
} from "@shared/db/schema-zod";
import { responseWrappers } from "@shared/db/schema-openapi";
import { standardErrors } from "./common";

// ============================================================================
// DERIVED RESPONSE SCHEMAS (from Drizzle)
// ============================================================================

/**
 * Task assignee schema (from task_assignments table)
 * Note: task_assignments has composite PK (taskId, userId), no separate id field
 */
export const taskAssigneeSchema = selectTaskAssignmentSchema.pick({
  taskId: true,
  userId: true,
});

/**
 * Task response schema with assignees relation
 * Combines task data with assignment information
 */
/**
 * Task response schema with assignees relation
 * Combines task data with assignment information
 */
export const TaskSchema = selectTaskSchema.extend({
  assignees: z.array(
    z.object({
      id: z.string(),
      nickname: z.string().nullable(),
    })
  ).nullish(),
  creatorName: z.string().nullish(),
  zulipStream: z.string().nullish(),
  zulipTopic: z.string().nullish(),
  isDeleted: z.number().nullish(),
  checklists: z.array(
    z.object({
      id: z.string(),
      content: z.string(),
      isCompleted: z.number(),
      sortOrder: z.number(),
    })
  ).nullish(),
  labels: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      colorTheme: z.string().nullable(),
    })
  ).nullish(),
  attachments: z.array(
    z.object({
      id: z.string(),
      url: z.string(),
      title: z.string(),
      type: z.string(),
      thumbnailUrl: z.string().nullable(),
      createdAt: z.string().nullable(),
    })
  ).nullish(),
});

/**
 * Create task request schema
 */
export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  status: z.enum(["todo", "in_progress", "done", "blocked"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  subteam: z.string().nullable().optional(),
  assignees: z.array(z.string()).optional(),
  dueDate: z.string().optional(),
  startDate: z.string().optional(),
  estimatedMinutes: z.number().optional(),
  coverImage: z.string().optional(),
  parentId: z.string().nullable().optional(),
  timeSpentSeconds: z.number().optional(),
  sortOrder: z.number().optional(),
  assignedTo: z.string().nullable().optional(),
});

/**
 * Update task request schema (all fields optional)
 */
export const updateTaskSchema = createTaskSchema.partial();

/**
 * Reorder tasks request schema
 */
export const reorderTasksSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      sortOrder: z.number(),
    })
  ),
});

// ============================================================================
// ROUTES
// ============================================================================

export const listTasksRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["tasks"],
  summary: "List all tasks",
  description: "Fetches all tasks with optional filtering.",
  request: {
    query: z.object({
      id: z.string().optional(),
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
          schema: createTaskSchema,
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
          schema: reorderTasksSchema,
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: responseWrappers.success(),
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
          schema: updateTaskSchema,
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: responseWrappers.success(),
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
          schema: responseWrappers.success(),
        },
      },
      description: "Task deleted successfully",
    },
  },
});

export const createTaskAttachmentRoute = createRoute({
  method: "post",
  path: "/{id}/attachments",
  tags: ["tasks"],
  summary: "Create a task attachment",
  description: "Creates a new task attachment via URL unfurling.",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({ 
            url: z.string().url(),
            title: z.string().optional()
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
          schema: responseWrappers.success(),
        },
      },
      description: "Attachment created successfully",
    },
  },
});

export const deleteTaskAttachmentRoute = createRoute({
  method: "delete",
  path: "/{id}/attachments/{attachmentId}",
  tags: ["tasks"],
  summary: "Delete a task attachment",
  description: "Deletes a task attachment.",
  request: {
    params: z.object({ id: z.string(), attachmentId: z.string() }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: responseWrappers.success(),
        },
      },
      description: "Attachment deleted successfully",
    },
  },
});

export const createTaskChecklistRoute = createRoute({
  method: "post",
  path: "/{id}/checklists",
  tags: ["tasks"],
  summary: "Create a task checklist item",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({ content: z.string().min(1) }),
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: responseWrappers.success(),
        },
      },
      description: "Checklist item created successfully",
    },
  },
});

export const updateTaskChecklistRoute = createRoute({
  method: "patch",
  path: "/{id}/checklists/{checklistId}",
  tags: ["tasks"],
  summary: "Update a task checklist item",
  request: {
    params: z.object({ id: z.string(), checklistId: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({ 
            isCompleted: z.number().min(0).max(1).optional(), 
            content: z.string().optional(), 
            sortOrder: z.number().optional() 
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
          schema: responseWrappers.success(),
        },
      },
      description: "Checklist item updated successfully",
    },
  },
});

export const deleteTaskChecklistRoute = createRoute({
  method: "delete",
  path: "/{id}/checklists/{checklistId}",
  tags: ["tasks"],
  summary: "Delete a task checklist item",
  request: {
    params: z.object({ id: z.string(), checklistId: z.string() }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: responseWrappers.success(),
        },
      },
      description: "Checklist item deleted successfully",
    },
  },
});

export const setTaskLabelsRoute = createRoute({
  method: "post",
  path: "/{id}/labels",
  tags: ["tasks"],
  summary: "Set task labels",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({ labelIds: z.array(z.string()) }),
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: responseWrappers.success(),
        },
      },
      description: "Task labels set successfully",
    },
  },
});
