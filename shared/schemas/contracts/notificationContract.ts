import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { standardErrors } from "./common";

const c = initContract();

export const notificationSchema = z.object({
  id: z.string(),
  title: z.string(),
  message: z.string(),
  link: z.string().nullable().optional(),
  priority: z.string().optional(),
  is_read: z.number(),
  created_at: z.string(),
});

export const notificationContract = c.router({
  getNotifications: {
    method: "GET",
    path: "/",
    responses: {
      ...standardErrors,
      200: z.object({
        notifications: z.array(notificationSchema),
      }),
    },
    summary: "Get user notifications",
  },
  markAsRead: {
    method: "PUT",
    path: "/:id/read",
    pathParams: z.object({
      id: z.string(),
    }),
    body: c.type<null>(),
    responses: {
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
      }),
    },
    summary: "Mark a notification as read",
  },
  markAllAsRead: {
    method: "PUT",
    path: "/read-all",
    body: c.noBody(),
    responses: {
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
      }),
    },
    summary: "Mark all notifications as read",
  },
  deleteNotification: {
    method: "DELETE",
    path: "/:id",
    pathParams: z.object({
      id: z.string(),
    }),
    body: c.noBody(),
    responses: {
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
      }),
    },
    summary: "Delete a notification",
  },
  getPendingCounts: {
    method: "GET",
    path: "/pending-counts",
    responses: {
      ...standardErrors,
      200: z.object({
        inquiries: z.number(),
        posts: z.number(),
        events: z.number(),
        docs: z.number(),
      }),
    },
    summary: "Get counts of pending items for dashboard badges",
  },
  getDashboardActionItems: {
    method: "GET",
    path: "/action-items",
    responses: {
      ...standardErrors,
      200: z.object({
        inquiries: z.array(z.any()),
        posts: z.array(z.any()),
        events: z.array(z.any()),
        docs: z.array(z.any()),
      }),
    },
    summary: "Get detailed action items (pending requests) in a single batch",
  },
});
export type NotificationContract = typeof notificationContract;
