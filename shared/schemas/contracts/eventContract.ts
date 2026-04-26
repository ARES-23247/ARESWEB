import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { eventSchema } from "../eventSchema";

const c = initContract();

export const eventResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  date_start: z.string(),
  date_end: z.string().nullish(),
  location: z.string().nullish(),
  description: z.string().nullish(),
  cover_image: z.string().nullish(),
  status: z.string().nullish(),
  category: z.string().nullish(),
  is_deleted: z.number().nullish(),
  season_id: z.coerce.number().nullish(),
  meeting_notes: z.string().nullish(),
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

export const eventContract = c.router({
  getEvents: {
    method: "GET",
    path: "/",
    query: z.object({
      q: z.string().optional(),
      limit: z.coerce.number().optional(),
      offset: z.coerce.number().optional(),
    }),
    responses: {
      200: z.object({
        events: z.array(eventResponseSchema),
      }),
    },
    summary: "Get all public events",
  },
  getAdminEvents: {
    method: "GET",
    path: "/admin/list",
    query: z.object({
      limit: z.coerce.number().optional(),
      offset: z.coerce.number().optional(),
    }),
    responses: {
      200: z.object({
        events: z.array(eventResponseSchema),
        lastSyncedAt: z.string().nullable(),
      }),
    },
    summary: "Get all events (admin view)",
  },
  adminDetail: {
    method: "GET",
    path: "/admin/:id",
    responses: {
      200: z.object({
        event: eventResponseSchema,
      }),
      404: z.object({ error: z.string() }),
    },
    summary: "Get single event (admin view)",
  },
  saveEvent: {
    method: "POST",
    path: "/admin/save",
    body: eventSchema,
    responses: {
      200: z.object({
        success: z.boolean(),
        id: z.string().optional(),
        warning: z.string().optional(),
      }),
    },
    summary: "Create or update an event",
  },
  getEvent: {
    method: "GET",
    path: "/:id",
    responses: {
      200: z.object({
        event: eventResponseSchema,
        is_editor: z.boolean().optional(),
        signups: z.array(eventSignupSchema).optional(),
        my_signup: eventSignupSchema.optional(),
      }),
      404: z.object({ error: z.string() }),
    },
    summary: "Get a single event by id",
  },
  updateEvent: {
    method: "PATCH",
    path: "/admin/:id",
    body: eventSchema.partial(),
    responses: {
      200: z.object({
        success: z.boolean(),
        id: z.string().optional(),
        error: z.string().optional(),
      }),
    },
    summary: "Update an event (or create revision)",
  },
  deleteEvent: {
    method: "DELETE",
    path: "/admin/:id",
    body: c.noBody(),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: "Soft-delete an event",
  },
  syncEvents: {
    method: "POST",
    path: "/admin/sync",
    body: c.noBody(),
    responses: {
      200: z.object({ success: z.boolean(), count: z.number().optional() }),
    },
    summary: "Sync events from Google Calendar",
  },
  approveEvent: {
    method: "POST",
    path: "/admin/:id/approve",
    body: c.noBody(),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: "Approve a pending event or revision",
  },
  rejectEvent: {
    method: "POST",
    path: "/admin/:id/reject",
    body: z.object({ reason: z.string().optional() }),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: "Reject a pending event",
  },
  undeleteEvent: {
    method: "POST",
    path: "/admin/:id/restore",
    body: c.noBody(),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: "Restore a soft-deleted event",
  },
  purgeEvent: {
    method: "DELETE",
    path: "/admin/:id/purge",
    body: c.noBody(),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: "Permanently delete an event",
  },
  repushEvent: {
    method: "POST",
    path: "/admin/:id/repush",
    body: z.object({
      socials: z.array(z.string()).optional(),
    }),
    responses: {
      200: z.object({ success: z.boolean() }),
      404: z.object({ error: z.string() }),
      502: z.object({ error: z.string() }),
    },
    summary: "Re-broadcast event to social media",
  },
  getCalendarSettings: {
    method: "GET",
    path: "/calendar-settings",
    responses: {
      200: z.object({
        calendarIdInternal: z.string(),
        calendarIdOutreach: z.string(),
        calendarIdExternal: z.string(),
      }),
    },
    summary: "Get public calendar IDs",
  },
  getSignups: {
    method: "GET",
    path: "/:id/signups",
    responses: {
      200: z.object({
        signups: z.array(eventSignupSchema),
        dietary_summary: z.record(z.string(), z.number()).nullable(),
        team_dietary_summary: z.record(z.string(), z.number()).nullable(),
        authenticated: z.boolean(),
        role: z.string().nullable(),
        member_type: z.string().nullable(),
        can_manage: z.boolean(),
      }),
    },
    summary: "Get signups for an event",
  },
  submitSignup: {
    method: "POST",
    path: "/:id/signups",
    body: z.object({
      bringing: z.string().optional(),
      notes: z.string().optional(),
      prep_hours: z.coerce.number().optional(),
    }),
    responses: {
      200: z.object({ success: z.boolean() }),
      403: z.object({ error: z.string() }),
    },
    summary: "Sign up for an event",
  },
  deleteMySignup: {
    method: "DELETE",
    path: "/:id/signups",
    body: c.noBody(),
    responses: {
      200: z.object({ success: z.boolean() }),
      401: z.object({ error: z.string() }),
    },
    summary: "Remove my signup",
  },
  updateMyAttendance: {
    method: "PATCH",
    path: "/:id/signups/me/attendance",
    body: z.object({ attended: z.boolean() }),
    responses: {
      200: z.object({ success: z.boolean() }),
      401: z.object({ error: z.string() }),
    },
    summary: "Update my own attendance",
  },
  updateUserAttendance: {
    method: "PATCH",
    path: "/admin/:id/signups/:userId/attendance",
    body: z.object({ attended: z.boolean() }),
    responses: {
      200: z.object({ success: z.boolean() }),
      401: z.object({ error: z.string() }),
    },
    summary: "Update user attendance (admin/manager)",
  },
});
