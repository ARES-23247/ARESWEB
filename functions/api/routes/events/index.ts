import { ApiError } from "../../middleware/errorHandler";
import { OpenAPIHono } from "@hono/zod-openapi";

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
  const result = await eventHandlers.getEvents({ query: c.req.valid("query"), body: undefined, params: {} }, c);
  return c.json(result.body, result.status);
})

.openapi(getCalendarSettingsRoute, async (c) => {
  const result = await eventHandlers.getCalendarSettings({ query: {}, body: undefined, params: {} }, c);
  return c.json(result.body, result.status);
})

.openapi(getEventRoute, async (c) => {
  const result = await eventHandlers.getEvent({ params: c.req.valid("param"), query: c.req.valid("query"), body: undefined }, c);
  return c.json(result.body, result.status);
})

.openapi(getSignupsRoute, async (c) => {
  const result = await eventHandlers.getSignups({ params: c.req.valid("param"), query: {}, body: undefined }, c);
  return c.json(result.body, result.status);
})

.openapi(submitSignupRoute, async (c) => {
  const result = await eventHandlers.submitSignup({ params: c.req.valid("param"), body: c.req.valid("json"), query: {} }, c);
  return c.json(result.body, result.status);
})

.openapi(deleteMySignupRoute, async (c) => {
  const result = await eventHandlers.deleteMySignup({ params: c.req.valid("param"), query: {}, body: undefined }, c);
  return c.json(result.body, result.status);
})

.openapi(updateMyAttendanceRoute, async (c) => {
  const result = await eventHandlers.updateMyAttendance({ params: c.req.valid("param"), body: c.req.valid("json"), query: {} }, c);
  return c.json(result.body, result.status);
})

// ─── Admin Routes ────────────────────────────────────────────────────────
.openapi(getAdminEventsRoute, async (c) => {
  const result = await eventHandlers.getAdminEvents({ query: c.req.valid("query"), body: undefined, params: {} }, c);
  return c.json(result.body, result.status);
})

.openapi(getAdminEventRoute, async (c) => {
  const result = await eventHandlers.adminDetail({ params: c.req.valid("param"), query: {}, body: undefined }, c);
  return c.json(result.body, result.status);
})

.openapi(saveEventRoute, async (c) => {
  const result = await eventHandlers.saveEvent({ body: c.req.valid("json"), query: {}, params: {} }, c);
  return c.json(result.body, result.status);
})

.openapi(updateEventRoute, async (c) => {
  const result = await eventHandlers.updateEvent({ params: c.req.valid("param"), body: c.req.valid("json"), query: {} }, c);
  return c.json(result.body, result.status);
})

.openapi(deleteEventRoute, async (c) => {
  const result = await eventHandlers.deleteEvent({ params: c.req.valid("param"), query: {}, body: {} }, c);
  return c.json(result.body, result.status);
})

.openapi(syncEventsRoute, async (c) => {
  const result = await eventHandlers.syncEvents({ body: c.req.valid("json"), query: {}, params: {} }, c);
  return c.json(result.body, result.status);
})

.openapi(repairCalendarRoute, async (c) => {
  const result = await eventHandlers.repairCalendar({ body: c.req.valid("json"), query: {}, params: {} }, c);
  return c.json(result.body, result.status);
})

.openapi(approveEventRoute, async (c) => {
  const result = await eventHandlers.approveEvent({ params: c.req.valid("param"), query: {}, body: undefined }, c);
  return c.json(result.body, result.status);
})

.openapi(rejectEventRoute, async (c) => {
  const result = await eventHandlers.rejectEvent({ params: c.req.valid("param"), body: c.req.valid("json"), query: {} }, c);
  return c.json(result.body, result.status);
})

.openapi(undeleteEventRoute, async (c) => {
  const result = await eventHandlers.undeleteEvent({ params: c.req.valid("param"), query: {}, body: undefined }, c);
  return c.json(result.body, result.status);
})

.openapi(purgeEventRoute, async (c) => {
  const result = await eventHandlers.purgeEvent({ params: c.req.valid("param"), query: {}, body: undefined }, c);
  return c.json(result.body, result.status);
})

.openapi(repushEventRoute, async (c) => {
  const result = await eventHandlers.repushEvent({ params: c.req.valid("param"), query: {}, body: {} }, c);
  return c.json(result.body, result.status);
})

.openapi(updateUserAttendanceRoute, async (c) => {
  const result = await eventHandlers.updateUserAttendance({ params: c.req.valid("param"), body: c.req.valid("json"), query: {} }, c);
  return c.json(result.body, result.status);
})

// ─── Event Version History ──────────────────────────────────────────────
// NOTE: Event history feature not yet implemented - requires migration
.openapi(getEventHistoryRoute, async (c) => {
    // Return empty history for now
    return c.json({ history: [] }, 200);
  })

.openapi(restoreEventHistoryRoute, async (_c) => {
    throw new ApiError("Event history feature not yet implemented", 501);
  });

export default finalEventsRouter;
