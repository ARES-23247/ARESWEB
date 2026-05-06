import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";

export const notificationSchema = z.object({
  id: z.string(),
  title: z.string(),
  message: z.string(),
  link: z.string().nullable().optional(),
  priority: z.string().optional(),
  is_read: z.number(),
  created_at: z.string(),
});

export const getNotificationsRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      description: "Get user notifications",
      content: { "application/json": { schema: z.object({ notifications: z.array(notificationSchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const markNotificationReadRoute = createRoute({
  method: "put",
  path: "/{id}/read",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Mark a notification as read",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const markAllNotificationsReadRoute = createRoute({
  method: "put",
  path: "/read-all",
  responses: {
    200: {
      description: "Mark all notifications as read",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const deleteNotificationRoute = createRoute({
  method: "delete",
  path: "/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Delete a notification",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const getPendingCountsRoute = createRoute({
  method: "get",
  path: "/pending-counts",
  responses: {
    200: {
      description: "Get counts of pending items for dashboard badges",
      content: {
        "application/json": {
          schema: z.object({
            inquiries: z.number(),
            posts: z.number(),
            events: z.number(),
            docs: z.number(),
          })
        }
      },
    },
    ...openApiStandardErrors,
  },
});

export const getDashboardActionItemsRoute = createRoute({
  method: "get",
  path: "/action-items",
  responses: {
    200: {
      description: "Get detailed action items (pending requests) in a single batch",
      content: {
        "application/json": {
          schema: z.object({
            inquiries: z.array(z.record(z.string(), z.unknown())),
            posts: z.array(z.record(z.string(), z.unknown())),
            events: z.array(z.record(z.string(), z.unknown())),
            docs: z.array(z.record(z.string(), z.unknown())),
          })
        }
      },
    },
    ...openApiStandardErrors,
  },
});
