import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  status: z.string(),
  priority: z.string(),
  sort_order: z.number(),
  assigned_to: z.string().nullable().optional(),
  assignee_name: z.string().nullable().optional(),
  created_by: z.string(),
  creator_name: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const taskContract = c.router({
  list: {
    method: "GET",
    path: "/",
    query: z.object({
      status: z.string().optional(),
    }).optional(),
    responses: {
      200: z.object({ tasks: z.array(taskSchema) }),
      500: z.object({ error: z.string() }),
    },
    summary: "List all tasks",
  },
  create: {
    method: "POST",
    path: "/",
    body: z.object({
      title: z.string().min(1).max(500),
      description: z.string().max(10000).optional(),
      status: z.enum(["todo", "in_progress", "done", "blocked"]).optional(),
      priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
      assigned_to: z.string().optional(),
      due_date: z.string().optional(),
    }),
    responses: {
      200: z.object({ success: z.boolean(), task: taskSchema }),
      401: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
    },
    summary: "Create a new task",
  },
  update: {
    method: "PATCH",
    path: "/:id",
    pathParams: z.object({ id: z.string() }),
    body: z.object({
      title: z.string().min(1).max(500).optional(),
      description: z.string().max(10000).nullable().optional(),
      status: z.enum(["todo", "in_progress", "done", "blocked"]).optional(),
      priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
      assigned_to: z.string().nullable().optional(),
      due_date: z.string().nullable().optional(),
      sort_order: z.number().optional(),
    }),
    responses: {
      200: z.object({ success: z.boolean() }),
      401: z.object({ error: z.string() }),
      404: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
    },
    summary: "Update a task",
  },
  reorder: {
    method: "PATCH",
    path: "/reorder",
    body: z.object({
      items: z.array(z.object({
        id: z.string(),
        status: z.string(),
        sort_order: z.number(),
      })),
    }),
    responses: {
      200: z.object({ success: z.boolean() }),
      401: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
    },
    summary: "Batch reorder tasks (for drag-and-drop)",
  },
  delete: {
    method: "DELETE",
    path: "/:id",
    pathParams: z.object({ id: z.string() }),
    body: c.type<null>(),
    responses: {
      200: z.object({ success: z.boolean() }),
      401: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
    },
    summary: "Delete a task",
  },
});
