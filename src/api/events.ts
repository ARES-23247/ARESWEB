/**
 * Events API - Events, Signups, Calendar Integration
 *
 * Types imported from backend route definitions in @shared/routes/events.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse, wrapOnSuccess } from "./honoClient";
import { eventResponseSchema, eventSignupSchema } from "@shared/routes/events";
import { eventSchema, EventCategoryEnum } from "@shared/schemas/eventSchema";

// Infer TypeScript types from Zod schemas
export type Event = z.infer<typeof eventResponseSchema>;
export type EventItem = Event;
export type FullEventItem = Event;
export type EventSignup = z.infer<typeof eventSignupSchema>;
export type EventPayload = z.infer<typeof eventSchema>;
export type EventCategory = z.infer<typeof EventCategoryEnum>;

export interface EventsResponse {
  events: Event[];
}

export interface AdminEventsResponse {
  events: Event[];
  lastSyncedAt: string | null;
  nextCursor?: string;
}

export interface EventDetailResponse {
  event: Event;
  isEditor?: boolean;
  signups?: EventSignup[];
  mySignup?: EventSignup;
}

export interface EventSignupsResponse {
  signups: EventSignup[];
  dietary_summary: Record<string, number> | null;
  team_dietary_summary: Record<string, number> | null;
  authenticated: boolean;
  role: string | null;
  memberType: string | null;
  can_manage: boolean;
}

export interface CalendarSettings {
  calendarIdInternal: string;
  calendarIdOutreach: string;
  calendarIdExternal: string;
}


// ============================================
// Public Events
// ============================================

/**
 * GET /api/events - Get all public events
 */
export function useGetEvents(
  query?: { q?: string; limit?: number; offset?: number },
  options?: Omit<UseQueryOptions<EventsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<EventsResponse>({
    queryKey: ["events", query],
    queryFn: async () => {
      const response = await client.events.$get({ query });
      return unwrapResponse<EventsResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/events/:id - Get a single event by id
 */
export function useGetEvent(
  id: string,
  options?: Omit<UseQueryOptions<EventDetailResponse>, "queryKey" | "queryFn">
) {
  return useQuery<EventDetailResponse>({
    queryKey: ["event", id],
    queryFn: async () => {
      const response = await client.events[":id"].$get({ param: { id } });
      return unwrapResponse<EventDetailResponse>(response);
    },
    enabled: !!id,
    ...options,
  });
}

/**
 * GET /api/events/calendar-settings - Get public calendar IDs
 */
export function useGetCalendarSettings(
  options?: Omit<UseQueryOptions<CalendarSettings>, "queryKey" | "queryFn">
) {
  return useQuery<CalendarSettings>({
    queryKey: ["calendar-settings"],
    queryFn: async () => {
      const response = await client.events["calendar-settings"].$get();
      return unwrapResponse<CalendarSettings>(response);
    },
    ...options,
  });
}

// ============================================
// Event Signups
// ============================================

/**
 * GET /api/events/:id/signups - Get signups for an event
 */
export function useGetEventSignups(
  eventId: string,
  options?: Omit<UseQueryOptions<EventSignupsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<EventSignupsResponse>({
    queryKey: ["event_signups", eventId],
    queryFn: async () => {
      const response = await client.events[":id"].signups.$get({ param: { id: eventId } });
      return unwrapResponse<EventSignupsResponse>(response);
    },
    enabled: !!eventId,
    ...options,
  });
}

/**
 * POST /api/events/:id/signups - Sign up for an event
 */
export function useSubmitEventSignup(
  options?: UseMutationOptions<{ success: boolean }, Error, { eventId: string; body: { bringing?: string; notes?: string; prep_hours?: number } }>
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { eventId: string; body: { bringing?: string; notes?: string; prep_hours?: number } }>({
    mutationFn: async ({ eventId, body }) => {
      const response = await client.events[":id"].signups.$post({ param: { id: eventId }, json: body });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...wrapOnSuccess(options, (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["event_signups", variables.eventId] });
    })
  });
}

/**
 * DELETE /api/events/:id/signups - Remove my signup
 */
export function useDeleteMyEventSignup(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  type MutationData = { success: boolean };
  type MutationVariables = string;
  type MutationContext = unknown;

  return useMutation<MutationData, Error, MutationVariables, MutationContext>({
    mutationFn: async (eventId: string) => {
      const response = await client.events[":id"].signups.$delete({ param: { id: eventId } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...wrapOnSuccess(options, (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["event_signups", variables] });
    })
  });
}

/**
 * PATCH /api/events/:id/signups/me/attendance - Update my own attendance
 */
export function useUpdateMyEventAttendance(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { eventId: string; attended: boolean }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  type MutationData = { success: boolean };
  type MutationVariables = { eventId: string; attended: boolean };
  type MutationContext = unknown;

  return useMutation<MutationData, Error, MutationVariables, MutationContext>({
    mutationFn: async ({ eventId, attended }) => {
      const response = await client.events[":id"].signups.me.attendance.$patch({ param: { id: eventId }, json: { attended } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...wrapOnSuccess(options, (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["event_signups", variables.eventId] });
    })
  });
}

// ============================================
// Admin Events
// ============================================

/**
 * GET /api/events/admin/list - Get all events (admin view)
 */
export function useGetAdminEvents(
  query?: { limit?: number; cursor?: string },
  options?: Omit<UseQueryOptions<AdminEventsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<AdminEventsResponse>({
    queryKey: ["admin_events", query],
    queryFn: async () => {
      const response = await client.events.admin.list.$get({ query });
      return unwrapResponse<AdminEventsResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/events/admin/:id - Get single event (admin view)
 */
export function useGetAdminEventDetail(
  id: string,
  options?: Omit<UseQueryOptions<{ event: Event }>, "queryKey" | "queryFn">
) {
  return useQuery<{ event: Event }>({
    queryKey: ["admin_event_detail", id],
    queryFn: async () => {
      const response = await client.events.admin[":id"].$get({ param: { id } });
      return unwrapResponse<{ event: Event }>(response);
    },
    enabled: !!id,
    ...options,
  });
}

/**
 * POST /api/events/admin/save - Create or update an event
 */
export function useSaveEvent(
  options?: Omit<UseMutationOptions<{ success: boolean; id?: string; warning?: string }, Error, EventPayload>, "mutationFn">
) {
  const queryClient = useQueryClient();
  type MutationData = { success: boolean; id?: string; warning?: string };
  type MutationVariables = EventPayload;
  type MutationContext = unknown;

  return useMutation<MutationData, Error, MutationVariables, MutationContext>({
    mutationFn: async (body) => {
      const response = await client.events.admin.save.$post({ json: body });
      return unwrapResponse<{ success: boolean; id?: string; warning?: string }>(response);
    },
    ...wrapOnSuccess(options, (_data, _variables) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["admin_events"] });
    })
  });
}

/**
 * PATCH /api/events/admin/:id - Update an event
 */
export function useUpdateEvent(
  options?: Omit<UseMutationOptions<{ success: boolean; id?: string; error?: string; warning?: string }, Error, { id: string; body: Partial<EventPayload> }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  type MutationData = { success: boolean; id?: string; error?: string; warning?: string };
  type MutationVariables = { id: string; body: Partial<EventPayload> };
  type MutationContext = unknown;

  return useMutation<MutationData, Error, MutationVariables, MutationContext>({
    mutationFn: async ({ id, body }) => {
      const response = await client.events.admin[":id"].$patch({ param: { id }, json: body });
      return unwrapResponse<{ success: boolean; id?: string; error?: string; warning?: string }>(response);
    },
    ...wrapOnSuccess(options, (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["admin_events"] });
      if (variables.id) {
        queryClient.invalidateQueries({ queryKey: ["event", variables.id] });
        queryClient.invalidateQueries({ queryKey: ["admin_event_detail", variables.id] });
      }
    })
  });
}

/**
 * DELETE /api/events/admin/:id - Soft-delete an event
 */
export function useDeleteEvent(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { id: string; deleteMode?: "single" | "following" }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  type MutationData = { success: boolean };
  type MutationVariables = { id: string; deleteMode?: "single" | "following" };
  type MutationContext = unknown;

  return useMutation<MutationData, Error, MutationVariables, MutationContext>({
    mutationFn: async ({ id, deleteMode }) => {
      const response = await client.events.admin[":id"].$delete({ param: { id }, json: { deleteMode } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...wrapOnSuccess(options, (_data, _variables) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["admin_events"] });
    })
  });
}

/**
 * POST /api/events/admin/sync - Sync events from Google Calendar
 */
export function useSyncEvents(
  options?: Omit<UseMutationOptions<{ success: boolean; count?: number }, Error, void>, "mutationFn">
) {
  const queryClient = useQueryClient();
  type MutationData = { success: boolean; count?: number };
  type MutationVariables = void;
  type MutationContext = unknown;

  return useMutation<MutationData, Error, MutationVariables, MutationContext>({
    mutationFn: async () => {
      const response = await client.events.admin.sync.$post();
      return unwrapResponse<{ success: boolean; count?: number }>(response);
    },
    ...wrapOnSuccess(options, (_data, _variables) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["admin_events"] });
    })
  });
}

/**
 * POST /api/events/admin/repair-calendar - Repair Google Calendar integration
 */
export function useRepairCalendar(
  options?: Omit<UseMutationOptions<{ success: boolean; pushed: number; failed: number; errors?: string[] }, Error, void>, "mutationFn">
) {
  return useMutation<{ success: boolean; pushed: number; failed: number; errors?: string[] }, Error, void>({
    mutationFn: async () => {
      const response = await client.events.admin["repair-calendar"].$post();
      return unwrapResponse<{ success: boolean; pushed: number; failed: number; errors?: string[] }>(response);
    },
    ...options,
  });
}

/**
 * POST /api/events/admin/:id/approve - Approve an event
 */
export function useApproveEvent(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  type MutationData = { success: boolean };
  type MutationVariables = string;
  type MutationContext = unknown;

  return useMutation<MutationData, Error, MutationVariables, MutationContext>({
    mutationFn: async (id) => {
      const response = await client.events.admin[":id"].approve.$post({ param: { id } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...wrapOnSuccess(options, (_data, _variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin_events"] });
    })
  });
}

/**
 * POST /api/events/admin/:id/reject - Reject an event
 */
export function useRejectEvent(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { id: string; reason?: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  type MutationData = { success: boolean };
  type MutationVariables = { id: string; reason?: string };
  type MutationContext = unknown;

  return useMutation<MutationData, Error, MutationVariables, MutationContext>({
    mutationFn: async ({ id, reason }) => {
      const response = await client.events.admin[":id"].reject.$post({ param: { id }, json: { reason } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...wrapOnSuccess(options, (_data, _variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin_events"] });
    })
  });
}

/**
 * POST /api/events/admin/:id/restore - Restore a deleted event
 */
export function useUndeleteEvent(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  type MutationData = { success: boolean };
  type MutationVariables = string;
  type MutationContext = unknown;

  return useMutation<MutationData, Error, MutationVariables, MutationContext>({
    mutationFn: async (id) => {
      const response = await client.events.admin[":id"].restore.$post({ param: { id } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...wrapOnSuccess(options, (_data, _variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin_events"] });
    })
  });
}

/**
 * DELETE /api/events/admin/:id/purge - Permanently delete an event
 */
export function usePurgeEvent(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  type MutationData = { success: boolean };
  type MutationVariables = string;
  type MutationContext = unknown;

  return useMutation<MutationData, Error, MutationVariables, MutationContext>({
    mutationFn: async (id) => {
      const response = await client.events.admin[":id"].purge.$delete({ param: { id } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...wrapOnSuccess(options, (_data, _variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin_events"] });
    })
  });
}

/**
 * POST /api/events/admin/:id/repush - Repush event to social media
 */
export function useRepushEvent(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { id: string; socials?: string[] }>, "mutationFn">
) {
  return useMutation<{ success: boolean }, Error, { id: string; socials?: string[] }>({
    mutationFn: async ({ id, socials }) => {
      const response = await client.events.admin[":id"].repush.$post({ param: { id }, json: { socials } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...options,
  });
}

/**
 * PATCH /api/events/admin/:id/signups/:userId/attendance - Update user attendance (admin)
 */
export function useUpdateUserEventAttendance(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { eventId: string; userId: string; attended: boolean }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  type MutationData = { success: boolean };
  type MutationVariables = { eventId: string; userId: string; attended: boolean };
  type MutationContext = unknown;

  return useMutation<MutationData, Error, MutationVariables, MutationContext>({
    mutationFn: async ({ eventId, userId, attended }) => {
      const response = await client.events.admin[":id"].signups[":userId"].attendance.$patch({ param: { id: eventId, userId }, json: { attended } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...wrapOnSuccess(options, (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["event_signups", variables.eventId] });
    })
  });
}

