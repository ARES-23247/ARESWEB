import { createRoute, z } from "@hono/zod-openapi";
import { standardErrors } from "./common";
import { selectNotificationSchema } from "@shared/db/schema-zod";
import { createResponseSchema, responseWrappers, toCamelCaseResponse } from "@shared/db/schema-openapi";

// ============================================================================
// NOTIFICATION RESPONSE SCHEMAS (derived from Drizzle)
// ============================================================================

/**
 * Notification schema derived from Drizzle notifications table.
 * Uses camelCase naming (is_read -> isRead, created_at -> createdAt).
 */
export const notificationSchema = createResponseSchema(
  toCamelCaseResponse(
    selectNotificationSchema.pick({
      id: true,
      title: true,
      message: true,
      link: true,
      priority: true,
      isRead: true,
      createdAt: true,
    })
  ),
  {
    title: "Notification",
    description: "A user notification with delivery details",
    example: {
      id: "notif_123",
      title: "New Event Posted",
      message: "A new event 'Kickoff Meeting' has been posted",
      link: "/events/kickoff-meeting",
      priority: "normal",
      isRead: 0,
      createdAt: "2026-05-09T12:00:00Z",
    },
  }
);

/**
 * Paginated notifications response wrapper
 */
export const notificationsListSchema = z.object({
  notifications: z.array(notificationSchema).openapi({
    description: "Array of notifications for the user",
  }),
});

// ============================================================================
// NOTIFICATION ROUTES
// ============================================================================

export const getNotificationsRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      description: "Get user notifications",
      content: { "application/json": { schema: notificationsListSchema } },
    },
    ...standardErrors,
  },
  tags: ["notifications"],
  summary: "Get user notifications",
  description: "Retrieves all notifications for the authenticated user. Results are ordered by creation date, newest first.",
});

export const markNotificationReadRoute = createRoute({
  method: "put",
  path: "/{id}/read",
  request: {
    params: z.object({
      id: z.string().openapi({
        example: "notif_123",
        description: "Notification ID to mark as read",
      }),
    }),
  },
  responses: {
    200: {
      description: "Mark a notification as read",
      content: { "application/json": { schema: responseWrappers.success() } },
    },
    ...standardErrors,
  },
  tags: ["notifications"],
  summary: "Mark notification as read",
  description: "Marks a specific notification as read by its ID.",
});

export const markAllNotificationsReadRoute = createRoute({
  method: "put",
  path: "/read-all",
  responses: {
    200: {
      description: "Mark all notifications as read",
      content: { "application/json": { schema: responseWrappers.success() } },
    },
    ...standardErrors,
  },
  tags: ["notifications"],
  summary: "Mark all notifications as read",
  description: "Marks all notifications for the authenticated user as read.",
});

export const deleteNotificationRoute = createRoute({
  method: "delete",
  path: "/{id}",
  request: {
    params: z.object({
      id: z.string().openapi({
        example: "notif_123",
        description: "Notification ID to delete",
      }),
    }),
  },
  responses: {
    200: {
      description: "Delete a notification",
      content: { "application/json": { schema: responseWrappers.success() } },
    },
    ...standardErrors,
  },
  tags: ["notifications"],
  summary: "Delete notification",
  description: "Permanently deletes a notification by its ID.",
});

/**
 * Pending counts for dashboard badges
 */
export const pendingCountsSchema = z.object({
  inquiries: z.number().openapi({
    example: 5,
    description: "Number of pending inquiries",
  }),
  posts: z.number().openapi({
    example: 3,
    description: "Number of pending posts",
  }),
  events: z.number().openapi({
    example: 1,
    description: "Number of pending events",
  }),
  docs: z.number().openapi({
    example: 2,
    description: "Number of pending docs",
  }),
});

export const getPendingCountsRoute = createRoute({
  method: "get",
  path: "/pending-counts",
  responses: {
    200: {
      description: "Get counts of pending items for dashboard badges",
      content: {
        "application/json": {
          schema: pendingCountsSchema,
        }
      },
    },
    ...standardErrors,
  },
  tags: ["notifications", "admin"],
  summary: "Get pending counts",
  description: "Retrieves counts of pending items (inquiries, posts, events, docs) for dashboard badges. Requires admin authentication.",
});

/**
 * Action items are pending requests that need admin attention.
 * Each item is a partial record from its respective table.
 */
const pendingInquiryItem = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  email: z.string(),
  status: z.string(),
  createdAt: z.string(),
}).openapi({
  description: "Pending inquiry awaiting admin action",
  example: {
    id: "inq_123",
    type: "sponsor",
    name: "Acme Corp",
    email: "contact@acme.com",
    status: "pending",
    createdAt: "2026-05-09T12:00:00Z",
  },
});

const pendingPostItem = z.object({
  id: z.string(),
  title: z.string(),
  authorName: z.string(),
  createdAt: z.string(),
}).openapi({
  description: "Pending post awaiting approval",
  example: {
    id: "post_456",
    title: "Competition Recap",
    authorName: "Jane Doe",
    createdAt: "2026-05-09T12:00:00Z",
  },
});

const pendingEventItem = z.object({
  id: z.string(),
  title: z.string(),
  dateStart: z.string(),
  createdAt: z.string(),
}).openapi({
  description: "Pending event awaiting approval",
  example: {
    id: "evt_789",
    title: "Team Building Event",
    dateStart: "2026-06-01T10:00:00Z",
    createdAt: "2026-05-09T12:00:00Z",
  },
});

const pendingDocItem = z.object({
  slug: z.string(),
  title: z.string(),
  category: z.string(),
  updatedAt: z.string(),
}).openapi({
  description: "Pending doc awaiting review",
  example: {
    slug: "robot-manual",
    title: "Robot Operation Manual",
    category: "technical",
    updatedAt: "2026-05-09T12:00:00Z",
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
            inquiries: z.array(pendingInquiryItem).openapi({
              description: "Pending inquiries awaiting admin response",
            }),
            posts: z.array(pendingPostItem).openapi({
              description: "Pending posts awaiting approval",
            }),
            events: z.array(pendingEventItem).openapi({
              description: "Pending events awaiting approval",
            }),
            docs: z.array(pendingDocItem).openapi({
              description: "Pending docs awaiting review",
            }),
          })
        }
      },
    },
    ...standardErrors,
  },
  tags: ["notifications", "admin"],
  summary: "Get dashboard action items",
  description: "Retrieves all pending items that need admin attention across all content types. Requires admin authentication.",
});
