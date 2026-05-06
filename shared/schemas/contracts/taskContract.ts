import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { standardErrors } from "./common";

const c = initContract();

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

export const taskContract = c.router({
  list: {
    method: "GET",
    path: "/",
    query: z.object({
      status: z.string().optional(),
      parent_id: z.string().optional(),
    }).optional(),
    responses: {
      ...standardErrors,
      200: z.object({ tasks: z.array(taskSchema) }),
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
      subteam: z.string().nullable().optional(),
      assignees: z.array(z.string()).optional(),
      due_date: z.string().optional(),
      parent_id: z.string().nullable().optional(),
      time_spent_seconds: z.number().optional(),
    }),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean(), task: taskSchema }),
    },
    summary: "Create a new task",
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
      ...standardErrors,
      200: z.object({ success: z.boolean() }),
    },
    summary: "Batch reorder tasks (for drag-and-drop)",
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
      subteam: z.string().nullable().optional(),
      assignees: z.array(z.string()).optional(),
      due_date: z.string().nullable().optional(),
      sort_order: z.number().optional(),
      parent_id: z.string().nullable().optional(),
      time_spent_seconds: z.number().optional(),
    }),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean() }),
    },
    summary: "Update a task",
  },
  delete: {
    method: "DELETE",
    path: "/:id",
    pathParams: z.object({ id: z.string() }),
    body: c.type<null>(),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean() }),
    },
    summary: "Delete a task",
  },
});
export type TaskContract = typeof taskContract;
