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

/**
 * Helper to properly type handler responses.
 * The handlers return { status, body } from ApiResponse<T>, which needs to be
 * converted to Hono's Response type.
 */
function handlerResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── Public Routes ───────────────────────────────────────────────────────
export const finalEventsRouter = eventsRouter.openapi(getEventsRoute, async (c) => {
  const result = await eventHandlers.getEvents({ query: c.req.valid("query"), body: undefined, params: {} }, c);
  return handlerResponse(result);
})

.openapi(getCalendarSettingsRoute, async (c) => {
  const result = await eventHandlers.getCalendarSettings({ query: {}, body: undefined, params: {} }, c);
  return handlerResponse(result);
})

.openapi(getEventRoute, async (c) => {
  const result = await eventHandlers.getEvent({ params: c.req.valid("param"), query: {}, body: undefined }, c);
  return handlerResponse(result);
})

.openapi(getSignupsRoute, async (c) => {
  const result = await eventHandlers.getSignups({ params: c.req.valid("param"), query: {}, body: undefined }, c);
  return handlerResponse(result);
})

.openapi(submitSignupRoute, async (c) => {
  const result = await eventHandlers.submitSignup({ params: c.req.valid("param"), body: c.req.valid("json"), query: {} }, c);
  return handlerResponse(result);
})

.openapi(deleteMySignupRoute, async (c) => {
  const result = await eventHandlers.deleteMySignup({ params: c.req.valid("param"), query: {}, body: undefined }, c);
  return handlerResponse(result);
})

.openapi(updateMyAttendanceRoute, async (c) => {
  const result = await eventHandlers.updateMyAttendance({ params: c.req.valid("param"), body: c.req.valid("json"), query: {} }, c);
  return handlerResponse(result);
})

// ─── Admin Routes ────────────────────────────────────────────────────────
.openapi(getAdminEventsRoute, async (c) => {
  const result = await eventHandlers.getAdminEvents({ query: c.req.valid("query"), body: undefined, params: {} }, c);
  return handlerResponse(result);
})

.openapi(getAdminEventRoute, async (c) => {
  const result = await eventHandlers.adminDetail({ params: c.req.valid("param"), query: {}, body: undefined }, c);
  return handlerResponse(result);
})

.openapi(saveEventRoute, async (c) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await eventHandlers.saveEvent({ body: c.req.valid("json") as any, query: {}, params: {} }, c);
  return handlerResponse(result);
})

.openapi(updateEventRoute, async (c) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await eventHandlers.updateEvent({ params: c.req.valid("param"), body: c.req.valid("json") as any, query: {} }, c);
  return handlerResponse(result);
})

.openapi(deleteEventRoute, async (c) => {
  const result = await eventHandlers.deleteEvent({ params: c.req.valid("param"), query: {}, body: {} }, c);
  return handlerResponse(result);
})

.openapi(syncEventsRoute, async (c) => {
  const result = await eventHandlers.syncEvents({ body: undefined, query: {}, params: {} }, c);
  return handlerResponse(result);
})

.openapi(repairCalendarRoute, async (c) => {
  const result = await eventHandlers.repairCalendar({ body: undefined, query: {}, params: {} }, c);
  return handlerResponse(result);
})

.openapi(approveEventRoute, async (c) => {
  const result = await eventHandlers.approveEvent({ params: c.req.valid("param"), query: {}, body: undefined }, c);
  return handlerResponse(result);
})

.openapi(rejectEventRoute, async (c) => {
  const result = await eventHandlers.rejectEvent({ params: c.req.valid("param"), body: c.req.valid("json"), query: {} }, c);
  return handlerResponse(result);
})

.openapi(undeleteEventRoute, async (c) => {
  const result = await eventHandlers.undeleteEvent({ params: c.req.valid("param"), query: {}, body: undefined }, c);
  return handlerResponse(result);
})

.openapi(purgeEventRoute, async (c) => {
  const result = await eventHandlers.purgeEvent({ params: c.req.valid("param"), query: {}, body: undefined }, c);
  return handlerResponse(result);
})

.openapi(repushEventRoute, async (c) => {
  const result = await eventHandlers.repushEvent({ params: c.req.valid("param"), query: {}, body: {} }, c);
  return handlerResponse(result);
})

.openapi(updateUserAttendanceRoute, async (c) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await eventHandlers.updateUserAttendance({ params: c.req.valid("param"), body: c.req.valid("json") as any, query: {} }, c);
  return handlerResponse(result);
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
