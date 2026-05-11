import { ApiError } from "../../middleware/errorHandler";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";

import { AppEnv, ensureAdmin, ensureAuth } from "../../middleware";
import { eventHandlers } from "./handlers";
import {
  getEventsRoute,
  getAdminEventsRoute,
  getAdminEventRoute,
  saveEventRoute,
  getEventRoute,
  updateEventRoute,
  deleteEventRoute,
  syncEventsRoute,
  repairCalendarRoute,
  approveEventRoute,
  rejectEventRoute,
  undeleteEventRoute,
  purgeEventRoute,
  repushEventRoute,
  getCalendarSettingsRoute,
  getSignupsRoute,
  submitSignupRoute,
  deleteMySignupRoute,
  updateMyAttendanceRoute,
  updateUserAttendanceRoute,
  getEventHistoryRoute,
  restoreEventHistoryRoute,
} from "../../../../shared/routes/events";
import { edgeCacheMiddleware } from "../../middleware/cache";

// ─── Router Setup ─────────────────────────────────────────────────────────────

const eventsRouter = new OpenAPIHono<AppEnv>();

// Helper to convert eventHandler responses to Hono responses
async function toResponse(result: { status: number; body: unknown }, c: Context<AppEnv>) {
  return c.json(result.body as never, result.status as never);
}

// Apply edge caching to public GET routes (non-admin, non-signups)
eventsRouter.use("*", async (c, next) => {
  const path = c.req.path;
  if (c.req.method !== "GET" || path.includes("/admin/") || path.includes("/signups") || path.includes("/history")) {
    return next();
  }
  return edgeCacheMiddleware(180, 60, 300)(c, next);
});

// ─── Middleware ───────────────────────────────────────────────────────────

eventsRouter.use("/admin/*", ensureAdmin);
eventsRouter.use("/:id/signups", ensureAuth);

// ─── Public Routes ───────────────────────────────────────────────────────
export const finalEventsRouter = eventsRouter.openapi(getEventsRoute, async (c) => {
  return toResponse(await eventHandlers.getEvents({ query: c.req.valid("query"), body: undefined, params: {} }, c), c);
})

.openapi(getCalendarSettingsRoute, async (c) => {
  return toResponse(await eventHandlers.getCalendarSettings({ query: {}, body: undefined, params: {} }, c), c);
})

.openapi(getEventRoute, async (c) => {
  // @ts-expect-error - Type inference issue with eventHandler params order
  return toResponse(await eventHandlers.getEvent({ params: c.req.valid("param"), query: c.req.valid("query"), body: undefined }, c), c);
})

.openapi(getSignupsRoute, async (c) => {
  return toResponse(await eventHandlers.getSignups({ params: c.req.valid("param"), query: {}, body: undefined }, c), c);
})

.openapi(submitSignupRoute, async (c) => {
  return toResponse(await eventHandlers.submitSignup({ params: c.req.valid("param"), body: c.req.valid("json"), query: {} }, c), c);
})

.openapi(deleteMySignupRoute, async (c) => {
  return toResponse(await eventHandlers.deleteMySignup({ params: c.req.valid("param"), query: {}, body: undefined }, c), c);
})

.openapi(updateMyAttendanceRoute, async (c) => {
  return toResponse(await eventHandlers.updateMyAttendance({ params: c.req.valid("param"), body: c.req.valid("json"), query: {} }, c), c);
})

// ─── Admin Routes ────────────────────────────────────────────────────────
.openapi(getAdminEventsRoute, async (c) => {
  return toResponse(await eventHandlers.getAdminEvents({ query: c.req.valid("query"), body: undefined, params: {} }, c), c);
})

.openapi(getAdminEventRoute, async (c) => {
  return toResponse(await eventHandlers.adminDetail({ params: c.req.valid("param"), query: {}, body: undefined }, c), c);
})

.openapi(saveEventRoute, async (c) => {
  return toResponse(await eventHandlers.saveEvent({ body: c.req.valid("json"), query: {}, params: {} }, c), c);
})

.openapi(updateEventRoute, async (c) => {
  return toResponse(await eventHandlers.updateEvent({ params: c.req.valid("param"), body: c.req.valid("json"), query: {} }, c), c);
})

.openapi(deleteEventRoute, async (c) => {
  return toResponse(await eventHandlers.deleteEvent({ params: c.req.valid("param"), query: {}, body: {} }, c), c);
})

.openapi(syncEventsRoute, async (c) => {
  // @ts-expect-error - Type inference issue with json body
  return toResponse(await eventHandlers.syncEvents({ body: c.req.valid("json"), query: {}, params: {} }, c), c);
})

.openapi(repairCalendarRoute, async (c) => {
  // @ts-expect-error - Type inference issue with json body
  return toResponse(await eventHandlers.repairCalendar({ body: c.req.valid("json"), query: {}, params: {} }, c), c);
})

.openapi(approveEventRoute, async (c) => {
  return toResponse(await eventHandlers.approveEvent({ params: c.req.valid("param"), query: {}, body: undefined }, c), c);
})

.openapi(rejectEventRoute, async (c) => {
  return toResponse(await eventHandlers.rejectEvent({ params: c.req.valid("param"), body: c.req.valid("json"), query: {} }, c), c);
})

.openapi(undeleteEventRoute, async (c) => {
  return toResponse(await eventHandlers.undeleteEvent({ params: c.req.valid("param"), query: {}, body: undefined }, c), c);
})

.openapi(purgeEventRoute, async (c) => {
  return toResponse(await eventHandlers.purgeEvent({ params: c.req.valid("param"), query: {}, body: undefined }, c), c);
})

.openapi(repushEventRoute, async (c) => {
  return toResponse(await eventHandlers.repushEvent({ params: c.req.valid("param"), query: {}, body: {} }, c), c);
})

.openapi(updateUserAttendanceRoute, async (c) => {
  return toResponse(await eventHandlers.updateUserAttendance({ params: c.req.valid("param"), body: c.req.valid("json"), query: {} }, c), c);
})

// ─── Event Version History ──────────────────────────────────────────────
// NOTE: Event history feature not yet implemented - requires migration
.openapi(getEventHistoryRoute, async (_c) => {
    return { history: [] } as never;
  })

.openapi(restoreEventHistoryRoute, async (_c) => {
    throw new ApiError("Event history feature not yet implemented", 501);
  });

export default finalEventsRouter;
