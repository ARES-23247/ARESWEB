import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";
import { eventSchema } from "../schemas/eventSchema";
import { selectEventSchema, selectEventSignupSchema } from "../db/schema-zod";
import { toCamelCaseResponse } from "../db/schema-openapi";

// Response schema derived from Drizzle selectEventSchema
export const eventResponseSchema = toCamelCaseResponse(
  selectEventSchema
).extend({
  locationAddress: z.string().nullable().optional(),
}).openapi({
  example: {
    id: "abc123",
    title: "Team Meeting",
    dateStart: "2025-01-15T18:00:00Z",
    dateEnd: "2025-01-15T20:00:00Z",
    location: "ARES Lab",
    locationAddress: "123 Robot Lane, City, ST 12345",
    description: "Weekly team meeting to discuss upcoming competitions...",
    coverImage: "/images/team-meeting.jpg",
    status: "published",
    category: "internal",
    isDeleted: 0,
    seasonId: 1,
    meetingNotes: "Bring your laptops for CAD training",
    recurringGroupId: null,
    rrule: null,
    zulipStream: "events",
    zulipTopic: "Event: Team Meeting",
    tbaEventKey: null,
    recurringException: null,
    isPotluck: 0,
    isVolunteer: 0,
  },
});

// Signup schema derived from Drizzle selectEventSignupSchema
export const eventSignupSchema = toCamelCaseResponse(
  selectEventSignupSchema
).extend({
  nickname: z.string().nullable().optional(),
  isOwn: z.boolean().optional(),
}).openapi({
  example: {
    id: 1,
    eventId: "abc123",
    userId: "user123",
    nickname: "John",
    bringing: "Chips",
    notes: "Will arrive 10 minutes late",
    prepHours: 1.5,
    attended: 0,
    isOwn: false,
  },
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
          example: {
            events: [
              {
                id: "abc123",
                title: "Team Meeting",
                dateStart: "2025-01-15T18:00:00Z",
                dateEnd: "2025-01-15T20:00:00Z",
                location: "ARES Lab",
                description: "Weekly team meeting to discuss upcoming competitions...",
                coverImage: "/images/team-meeting.jpg",
                status: "published",
                category: "internal",
                isDeleted: 0,
                seasonId: 1,
                meetingNotes: "Bring your laptops for CAD training",
                recurringGroupId: null,
                rrule: null,
                zulipStream: "events",
                zulipTopic: "Event: Team Meeting",
                tbaEventKey: null,
                recurringException: null,
                isPotluck: 0,
                isVolunteer: 0,
              },
            ],
          },
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
          example: {
            title: "Team Meeting",
            category: "internal",
            dateStart: "2025-01-15T18:00:00Z",
            dateEnd: "2025-01-15T20:00:00Z",
            location: "ARES Lab",
            description: "Weekly team meeting to discuss upcoming competitions",
            coverImage: "/images/team-meeting.jpg",
            tbaEventKey: null,
            socials: { twitter: true },
            isPotluck: false,
            isVolunteer: false,
            isDraft: false,
            publishedAt: "2025-01-15T18:00:00Z",
            seasonId: 1,
            meetingNotes: "Bring your laptops for CAD training",
            recurrenceRule: null,
            parentEventId: null,
            originalStartTime: null,
            rrule: null,
          },
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
          example: {
            success: true,
            id: "abc123-def456-ghi789",
          },
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
          example: {
            event: {
              id: "abc123",
              title: "Team Meeting",
              dateStart: "2025-01-15T18:00:00Z",
              dateEnd: "2025-01-15T20:00:00Z",
              location: "ARES Lab",
              description: "Weekly team meeting to discuss upcoming competitions",
              coverImage: "/images/team-meeting.jpg",
              status: "published",
              category: "internal",
              isDeleted: 0,
              seasonId: 1,
              meetingNotes: "Bring your laptops for CAD training",
              recurringGroupId: null,
              rrule: null,
              zulipStream: "events",
              zulipTopic: "Event: Team Meeting",
              tbaEventKey: null,
              recurringException: null,
              isPotluck: 0,
              isVolunteer: 0,
            },
            isEditor: false,
            signups: [
              {
                id: 1,
                eventId: "abc123",
                userId: "user123",
                nickname: "John",
                bringing: "Chips",
                notes: "Will arrive 10 minutes late",
                prepHours: 1.5,
                attended: 0,
                isOwn: false,
              },
            ],
            mySignup: null,
          },
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
            message: z.string().optional(),
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
          example: {
            bringing: "Chips and dip",
            notes: "Vegetarian options please",
            prepHours: 1.5,
          },
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
          example: { success: true },
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
