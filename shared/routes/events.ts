import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";
import { eventSchema, EventCategoryEnum } from "../schemas/eventSchema";

export const eventResponseSchema = z.object({
  id: z.string().openapi({ example: "123" }),
  title: z.string().openapi({ example: "Kickoff" }),
  dateStart: z.string().openapi({ example: "2025-01-15T10:00:00Z" }),
  dateEnd: z.string().nullish(),
  location: z.string().nullish(),
  description: z.string().nullish(),
  coverImage: z.string().nullish(),
  status: z.string().nullish(),
  category: EventCategoryEnum.nullish(),
  isDeleted: z.number().nullish(),
  seasonId: z.coerce.number().nullish(),
  meetingNotes: z.string().nullish(),
  recurringGroupId: z.string().nullish(),
  rrule: z.string().nullish(),
  zulipStream: z.string().nullable().optional(),
  zulipTopic: z.string().nullable().optional(),
  locationAddress: z.string().nullish(),
  tbaEventKey: z.string().nullish(),
  recurringException: z.number().nullish(),
  isPotluck: z.number().nullish(),
  isVolunteer: z.number().nullish(),
});

export const eventSignupSchema = z.object({
  userId: z.string(),
  nickname: z.string().nullable().optional(),
  bringing: z.string().nullable(),
  notes: z.string().nullable(),
  prepHours: z.coerce.number().nullable(),
  attended: z.number().optional(),
  isOwn: z.boolean().optional(),
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
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            events: z.array(eventResponseSchema),
          }),
        },
      },
      description: "List of public events",
    },
  },
  tags: ["events"],
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
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            events: z.array(eventResponseSchema),
            lastSyncedAt: z.string().nullable(),
            nextCursor: z.string().nullable().optional(),
          }),
        },
      },
      description: "Admin view of events",
    },
  },
  tags: ["events", "admin"],
});

export const getAdminEventRoute = createRoute({
  method: "get",
  path: "/admin/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            event: eventResponseSchema,
          }),
        },
      },
      description: "Admin detail for an event",
    },
  },
  tags: ["events", "admin"],
});

export const saveEventRoute = createRoute({
  method: "post",
  path: "/admin/save",
  request: {
    body: {
      content: {
        "application/json": {
          schema: eventSchema,
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
            id: z.string().optional(),
            warning: z.string().optional(),
          }),
        },
      },
      description: "Event created or updated",
    },
  },
  tags: ["events", "admin"],
});

export const getEventRoute = createRoute({
  method: "get",
  path: "/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            event: eventResponseSchema,
            isEditor: z.boolean().optional(),
            signups: z.array(eventSignupSchema).optional(),
            mySignup: eventSignupSchema.optional(),
          }),
        },
      },
      description: "Single event details",
    },
  },
  tags: ["events"],
});

export const updateEventRoute = createRoute({
  method: "patch",
  path: "/admin/{id}",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: eventSchema.partial(),
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
            id: z.string().optional(),
            error: z.string().optional(),
          }),
        },
      },
      description: "Event updated",
    },
  },
  tags: ["events", "admin"],
});

export const deleteEventRoute = createRoute({
  method: "delete",
  path: "/admin/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Event soft-deleted",
    },
  },
  tags: ["events", "admin"],
});

export const syncEventsRoute = createRoute({
  method: "post",
  path: "/admin/sync",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean(), count: z.number().optional() }),
        },
      },
      description: "Events synced from Google Calendar",
    },
  },
  tags: ["events", "admin"],
});

export const repairCalendarRoute = createRoute({
  method: "post",
  path: "/admin/repair-calendar",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ 
            success: z.boolean(), 
            pushed: z.number(), 
            failed: z.number(), 
            errors: z.array(z.string()).optional() 
          }),
        },
      },
      description: "Calendar repair completed",
    },
  },
  tags: ["events", "admin"],
});

export const approveEventRoute = createRoute({
  method: "post",
  path: "/admin/{id}/approve",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Event approved",
    },
  },
  tags: ["events", "admin"],
});

export const rejectEventRoute = createRoute({
  method: "post",
  path: "/admin/{id}/reject",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({ reason: z.string().optional() }),
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Event rejected",
    },
  },
  tags: ["events", "admin"],
});

export const undeleteEventRoute = createRoute({
  method: "post",
  path: "/admin/{id}/restore",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Event restored",
    },
  },
  tags: ["events", "admin"],
});

export const purgeEventRoute = createRoute({
  method: "delete",
  path: "/admin/{id}/purge",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Event permanently purged",
    },
  },
  tags: ["events", "admin"],
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
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Social media repost queued",
    },
    502: {
      content: {
        "application/json": {
          schema: z.object({ error: z.string() }),
        },
      },
      description: "Social media service error",
    },
  },
  tags: ["events", "admin"],
});

export const getCalendarSettingsRoute = createRoute({
  method: "get",
  path: "/calendar-settings",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            calendarIdInternal: z.string(),
            calendarIdOutreach: z.string(),
            calendarIdExternal: z.string(),
          }),
        },
      },
      description: "Public calendar IDs",
    },
  },
  tags: ["events"],
});

export const getSignupsRoute = createRoute({
  method: "get",
  path: "/{id}/signups",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            signups: z.array(eventSignupSchema),
            dietarySummary: z.record(z.string(), z.number()).nullable(),
            teamDietarySummary: z.record(z.string(), z.number()).nullable(),
            authenticated: z.boolean(),
            role: z.string().nullable(),
            memberType: z.string().nullable(),
            canManage: z.boolean(),
          }),
        },
      },
      description: "Event signups list",
    },
  },
  tags: ["events"],
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
            prepHours: z.coerce.number().optional(),
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
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Signup submitted",
    },
  },
  tags: ["events"],
});

export const deleteMySignupRoute = createRoute({
  method: "delete",
  path: "/{id}/signups",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Signup removed",
    },
  },
  tags: ["events"],
});

export const updateMyAttendanceRoute = createRoute({
  method: "patch",
  path: "/{id}/signups/me/attendance",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({ attended: z.boolean() }),
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Attendance updated",
    },
  },
  tags: ["events"],
});

export const updateUserAttendanceRoute = createRoute({
  method: "patch",
  path: "/admin/{id}/signups/{userId}/attendance",
  request: {
    params: z.object({ id: z.string(), userId: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({ attended: z.boolean() }),
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "User attendance updated",
    },
  },
  tags: ["events", "admin"],
});
export const getEventHistoryRoute = createRoute({
  method: "get",
  path: "/admin/{id}/history",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            history: z.array(z.object({
              id: z.number(),
              title: z.string(),
              authorEmail: z.string(),
              createdAt: z.string(),
            })),
          }),
        },
      },
      description: "Event version history",
    },
  },
  tags: ["events", "admin"],
});

export const restoreEventHistoryRoute = createRoute({
  method: "patch",
  path: "/admin/{id}/history/{historyId}/restore",
  request: {
    params: z.object({ id: z.string(), historyId: z.string() }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Event version restored",
    },
  },
  tags: ["events", "admin"],
});
