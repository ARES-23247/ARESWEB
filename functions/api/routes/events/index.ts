/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EVENTS ROUTER - NATIVE HONO TYPE INFERENCE PATTERN
 * ─────────────────────────────────────────────────────────────────────────────
 * Handler return types are validated at the handler level via ApiResponse<T>.
 * Router-level casts are safe because the contract is enforced in handlers.ts.
 */

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

/* eslint-disable @typescript-eslint/no-explicit-any -- Router-level casts are safe; handler return types validated by ApiResponse<T> */

// ─── Public Routes ───────────────────────────────────────────────────────
export const finalEventsRouter = eventsRouter.openapi(getEventsRoute, async (c) => {
  const result = await eventHandlers.getEvents({ query: c.req.valid("query"), body: undefined, params: {} }, c);
  return c.json(result.body, result.status) as any;
})

.openapi(getCalendarSettingsRoute, async (c) => {
  const result = await eventHandlers.getCalendarSettings({ query: {}, body: undefined, params: {} }, c);
  return c.json(result.body, result.status) as any;
})

.openapi(getEventRoute, async (c) => {
  const result = await eventHandlers.getEvent({ params: c.req.valid("param"), query: {}, body: undefined }, c);
  return c.json(result.body, result.status) as any;
})

.openapi(getSignupsRoute, async (c) => {
  const result = await eventHandlers.getSignups({ params: c.req.valid("param"), query: {}, body: undefined }, c);
  return c.json(result.body, result.status) as any;
})

.openapi(submitSignupRoute, async (c) => {
  const result = await eventHandlers.submitSignup({ params: c.req.valid("param"), body: c.req.valid("json"), query: {} }, c);
  return c.json(result.body, result.status) as any;
})

.openapi(deleteMySignupRoute, async (c) => {
  const result = await eventHandlers.deleteMySignup({ params: c.req.valid("param"), query: {}, body: undefined }, c);
  return c.json(result.body, result.status) as any;
})

.openapi(updateMyAttendanceRoute, async (c) => {
  const result = await eventHandlers.updateMyAttendance({ params: c.req.valid("param"), body: c.req.valid("json"), query: {} }, c);
  return c.json(result.body, result.status) as any;
})

// ─── Admin Routes ────────────────────────────────────────────────────────
.openapi(getAdminEventsRoute, async (c) => {
  const result = await eventHandlers.getAdminEvents({ query: c.req.valid("query"), body: undefined, params: {} }, c);
  return c.json(result.body, result.status) as any;
})

.openapi(getAdminEventRoute, async (c) => {
  const result = await eventHandlers.adminDetail({ params: c.req.valid("param"), query: {}, body: undefined }, c);
  return c.json(result.body, result.status) as any;
})

.openapi(saveEventRoute, async (c) => {
  const result = await eventHandlers.saveEvent({ body: c.req.valid("json") as any, query: {}, params: {} }, c); // eslint-disable-line @typescript-eslint/no-explicit-any
  return c.json(result.body, result.status) as any;
})

.openapi(updateEventRoute, async (c) => {
  const result = await eventHandlers.updateEvent({ params: c.req.valid("param"), body: c.req.valid("json"), query: {} }, c);
  return c.json(result.body, result.status) as any;
})

.openapi(deleteEventRoute, async (c) => {
  const result = await eventHandlers.deleteEvent({ params: c.req.valid("param"), query: {}, body: {} }, c);
  return c.json(result.body, result.status) as any;
})

.openapi(syncEventsRoute, async (c) => {
  const result = await eventHandlers.syncEvents({ body: undefined, query: {}, params: {} }, c);
  return c.json(result.body, result.status) as any;
})

.openapi(repairCalendarRoute, async (c) => {
  const result = await eventHandlers.repairCalendar({ body: undefined, query: {}, params: {} }, c);
  return c.json(result.body, result.status) as any;
})

.openapi(approveEventRoute, async (c) => {
  const result = await eventHandlers.approveEvent({ params: c.req.valid("param"), query: {}, body: undefined }, c);
  return c.json(result.body, result.status) as any;
})

.openapi(rejectEventRoute, async (c) => {
  const result = await eventHandlers.rejectEvent({ params: c.req.valid("param"), body: c.req.valid("json"), query: {} }, c);
  return c.json(result.body, result.status) as any;
})

.openapi(undeleteEventRoute, async (c) => {
  const result = await eventHandlers.undeleteEvent({ params: c.req.valid("param"), query: {}, body: undefined }, c);
  return c.json(result.body, result.status) as any;
})

.openapi(purgeEventRoute, async (c) => {
  const result = await eventHandlers.purgeEvent({ params: c.req.valid("param"), query: {}, body: undefined }, c);
  return c.json(result.body, result.status) as any;
})

.openapi(repushEventRoute, async (c) => {
  const result = await eventHandlers.repushEvent({ params: c.req.valid("param"), query: {}, body: {} }, c);
  return c.json(result.body, result.status) as any;
})

.openapi(updateUserAttendanceRoute, async (c) => {
  const result = await eventHandlers.updateUserAttendance({ params: c.req.valid("param"), body: c.req.valid("json"), query: {} }, c);
  return c.json(result.body, result.status) as any;
})

// ─── Event Version History ──────────────────────────────────────────────
// NOTE: Event history feature not yet implemented - requires migration
.openapi(getEventHistoryRoute, async (c) => {
    // Return empty history for now
    return c.json({ history: [] }, 200) as any;
  })

.openapi(restoreEventHistoryRoute, async (_c) => {
    throw new ApiError("Event history feature not yet implemented", 501);
  });

/* eslint-enable @typescript-eslint/no-explicit-any */

export default finalEventsRouter;
