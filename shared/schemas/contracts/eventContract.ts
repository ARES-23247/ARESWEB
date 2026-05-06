import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";
import { eventSchema, EventCategoryEnum } from "../eventSchema";

export const eventResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  date_start: z.string(),
  date_end: z.string().nullish(),
  location: z.string().nullish(),
  description: z.string().nullish(),
  cover_image: z.string().nullish(),
  status: z.string().nullish(),
  category: EventCategoryEnum.nullish(),
  is_deleted: z.number().nullish(),
  season_id: z.coerce.number().nullish(),
  meeting_notes: z.string().nullish(),
  recurring_group_id: z.string().nullish(),
  rrule: z.string().nullish(),
  zulip_stream: z.string().nullable().optional(),
  zulip_topic: z.string().nullable().optional(),
  location_address: z.string().nullish(),
});

export const eventSignupSchema = z.object({
  user_id: z.string(),
  nickname: z.string().nullable().optional(),
  bringing: z.string().nullable(),
  notes: z.string().nullable(),
  prep_hours: z.coerce.number().nullable(),
  attended: z.number().optional(),
  is_own: z.boolean().optional(),
});

export const getEventsRoute = createRoute({
  method: "get",
  path: "/",
  request: {
    query: z.object({
      q: z.string().optional(),
      limit: z.coerce.number().optional(),
      offset: z.coerce.number().optional(),
    }),
  },
  responses: {
    200: {
      description: "Get all public events",
      content: { "application/json": { schema: z.object({ events: z.array(eventResponseSchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const getAdminEventsRoute = createRoute({
  method: "get",
  path: "/admin/list",
  request: {
    query: z.object({
      limit: z.coerce.number().optional(),
      cursor: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Get all events (admin view)",
      content: {
        "application/json": {
          schema: z.object({
            events: z.array(eventResponseSchema),
            lastSyncedAt: z.string().nullable(),
            nextCursor: z.string().nullable().optional(),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const adminDetailEventRoute = createRoute({
  method: "get",
  path: "/admin/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Get single event (admin view)",
      content: { "application/json": { schema: z.object({ event: eventResponseSchema }) } },
    },
    ...openApiStandardErrors,
  },
});

export const saveEventRoute = createRoute({
  method: "post",
  path: "/admin/save",
  request: {
    body: {
      content: { "application/json": { schema: eventSchema } },
    },
  },
  responses: {
    200: {
      description: "Create or update an event",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            id: z.string().optional(),
            warning: z.string().optional(),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const getEventRoute = createRoute({
  method: "get",
  path: "/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Get a single event by id",
      content: {
        "application/json": {
          schema: z.object({
            event: eventResponseSchema,
            is_editor: z.boolean().optional(),
            signups: z.array(eventSignupSchema).optional(),
            my_signup: eventSignupSchema.optional(),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const updateEventRoute = createRoute({
  method: "patch",
  path: "/admin/{id}",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { "application/json": { schema: eventSchema.partial() } },
    },
  },
  responses: {
    200: {
      description: "Update an event (or create revision)",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            id: z.string().optional(),
            error: z.string().optional(),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const deleteEventRoute = createRoute({
  method: "delete",
  path: "/admin/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Soft-delete an event",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const syncEventsRoute = createRoute({
  method: "post",
  path: "/admin/sync",
  responses: {
    200: {
      description: "Sync events from Google Calendar",
      content: { "application/json": { schema: z.object({ success: z.boolean(), count: z.number().optional() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const repairCalendarRoute = createRoute({
  method: "post",
  path: "/admin/repair-calendar",
  responses: {
    200: {
      description: "Push all published events missing from GCal",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            pushed: z.number(),
            failed: z.number(),
            errors: z.array(z.string()).optional(),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const approveEventRoute = createRoute({
  method: "post",
  path: "/admin/{id}/approve",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Approve a pending event or revision",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const rejectEventRoute = createRoute({
  method: "post",
  path: "/admin/{id}/reject",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { "application/json": { schema: z.object({ reason: z.string().optional() }) } },
    },
  },
  responses: {
    200: {
      description: "Reject a pending event",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const undeleteEventRoute = createRoute({
  method: "post",
  path: "/admin/{id}/restore",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Restore a soft-deleted event",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const purgeEventRoute = createRoute({
  method: "delete",
  path: "/admin/{id}/purge",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Permanently delete an event",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const repushEventRoute = createRoute({
  method: "post",
  path: "/admin/{id}/repush",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            socials: z.array(z.string()).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Re-broadcast event to social media",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    502: {
      description: "Bad Gateway",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

export const getCalendarSettingsRoute = createRoute({
  method: "get",
  path: "/calendar-settings",
  responses: {
    200: {
      description: "Get public calendar IDs",
      content: {
        "application/json": {
          schema: z.object({
            calendarIdInternal: z.string(),
            calendarIdOutreach: z.string(),
            calendarIdExternal: z.string(),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const getSignupsRoute = createRoute({
  method: "get",
  path: "/{id}/signups",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Get signups for an event",
      content: {
        "application/json": {
          schema: z.object({
            signups: z.array(eventSignupSchema),
            dietary_summary: z.record(z.string(), z.number()).nullable(),
            team_dietary_summary: z.record(z.string(), z.number()).nullable(),
            authenticated: z.boolean(),
            role: z.string().nullable(),
            member_type: z.string().nullable(),
            can_manage: z.boolean(),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const submitSignupRoute = createRoute({
  method: "post",
  path: "/{id}/signups",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            bringing: z.string().optional(),
            notes: z.string().optional(),
            prep_hours: z.coerce.number().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Sign up for an event",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const deleteMySignupRoute = createRoute({
  method: "delete",
  path: "/{id}/signups",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Remove my signup",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const updateMyAttendanceRoute = createRoute({
  method: "patch",
  path: "/{id}/signups/me/attendance",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { "application/json": { schema: z.object({ attended: z.boolean() }) } },
    },
  },
  responses: {
    200: {
      description: "Update my own attendance",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const updateUserAttendanceRoute = createRoute({
  method: "patch",
  path: "/admin/{id}/signups/{userId}/attendance",
  request: {
    params: z.object({ id: z.string(), userId: z.string() }),
    body: {
      content: { "application/json": { schema: z.object({ attended: z.boolean() }) } },
    },
  },
  responses: {
    200: {
      description: "Update user attendance (admin/manager)",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});
