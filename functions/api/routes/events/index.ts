/* eslint-disable @typescript-eslint/no-explicit-any -- Event handlers work with dynamic external data */
import { OpenAPIHono } from "@hono/zod-openapi";
import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import { AppEnv, ensureAdmin, ensureAuth } from "../../middleware";
import { eventHandlers } from "./handlers";
import { Kysely } from "kysely";
import { DB } from "../../../../shared/schemas/database";
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

type AppRouteHandler<T extends RouteConfig> = RouteHandler<T, AppEnv>;

const eventsRouter = new OpenAPIHono<AppEnv>();

// ─── Middleware ───────────────────────────────────────────────────────────
eventsRouter.use("/", edgeCacheMiddleware(300, 60)); // Cache list
eventsRouter.use("/:id", edgeCacheMiddleware(300, 60)); // Cache single
eventsRouter.use("/admin/*", ensureAdmin);
eventsRouter.use("/:id/signups", ensureAuth);



// ─── Public Routes ───────────────────────────────────────────────────────
eventsRouter.openapi(getEventsRoute, (async (c) => {
  const query = c.req.valid("query");
  const result = await eventHandlers.getEvents({ query, params: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
}) as AppRouteHandler<typeof getEventsRoute>);

eventsRouter.openapi(getEventRoute, (async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.getEvent({ params, query: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
}) as AppRouteHandler<typeof getEventRoute>);

eventsRouter.openapi(getCalendarSettingsRoute, (async (c) => {
  const result = await eventHandlers.getCalendarSettings({ params: {}, query: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
}) as AppRouteHandler<typeof getCalendarSettingsRoute>);

eventsRouter.openapi(getSignupsRoute, (async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.getSignups({ params, query: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
}) as AppRouteHandler<typeof getSignupsRoute>);

eventsRouter.openapi(submitSignupRoute, (async (c) => {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await eventHandlers.submitSignup({ params, body, query: {} }, c);
  return c.json(result.body, result.status as any);
}) as AppRouteHandler<typeof submitSignupRoute>);

eventsRouter.openapi(deleteMySignupRoute, (async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.deleteMySignup({ params, query: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
}) as AppRouteHandler<typeof deleteMySignupRoute>);

eventsRouter.openapi(updateMyAttendanceRoute, (async (c) => {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await eventHandlers.updateMyAttendance({ params, body, query: {} }, c);
  return c.json(result.body, result.status as any);
}) as AppRouteHandler<typeof updateMyAttendanceRoute>);

// ─── Admin Routes ────────────────────────────────────────────────────────
eventsRouter.openapi(getAdminEventsRoute, (async (c) => {
  const query = c.req.valid("query");
  const result = await eventHandlers.getAdminEvents({ query, params: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
}) as AppRouteHandler<typeof getAdminEventsRoute>);

eventsRouter.openapi(getAdminEventRoute, (async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.adminDetail({ params, query: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
}) as AppRouteHandler<typeof getAdminEventRoute>);

eventsRouter.openapi(saveEventRoute, (async (c) => {
  const body = c.req.valid("json");
  const result = await eventHandlers.saveEvent({ body, params: {}, query: {} }, c);
  return c.json(result.body, result.status as any);
}) as AppRouteHandler<typeof saveEventRoute>);

eventsRouter.openapi(updateEventRoute, (async (c) => {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await eventHandlers.updateEvent({ params, body, query: {} }, c);
  return c.json(result.body, result.status as any);
}) as AppRouteHandler<typeof updateEventRoute>);

eventsRouter.openapi(deleteEventRoute, (async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.deleteEvent({ params, body: {} as any, query: {} }, c);
  return c.json(result.body, result.status as any);
}) as AppRouteHandler<typeof deleteEventRoute>);

eventsRouter.openapi(syncEventsRoute, (async (c) => {
  const result = await eventHandlers.syncEvents({ params: {}, query: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
}) as AppRouteHandler<typeof syncEventsRoute>);

eventsRouter.openapi(repairCalendarRoute, (async (c) => {
  const result = await eventHandlers.repairCalendar({ params: {}, query: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
}) as AppRouteHandler<typeof repairCalendarRoute>);

eventsRouter.openapi(approveEventRoute, (async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.approveEvent({ params, query: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
}) as AppRouteHandler<typeof approveEventRoute>);

eventsRouter.openapi(rejectEventRoute, (async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.rejectEvent({ params, query: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
}) as AppRouteHandler<typeof rejectEventRoute>);

eventsRouter.openapi(undeleteEventRoute, (async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.undeleteEvent({ params, query: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
}) as AppRouteHandler<typeof undeleteEventRoute>);

eventsRouter.openapi(purgeEventRoute, (async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.purgeEvent({ params, query: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
}) as AppRouteHandler<typeof purgeEventRoute>);

eventsRouter.openapi(repushEventRoute, (async (c) => {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await eventHandlers.repushEvent({ params, body, query: {} }, c);
  return c.json(result.body, result.status as any);
}) as AppRouteHandler<typeof repushEventRoute>);

eventsRouter.openapi(updateUserAttendanceRoute, (async (c) => {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await eventHandlers.updateUserAttendance({ params, body, query: {} }, c);
  return c.json(result.body, result.status as any);
}) as AppRouteHandler<typeof updateUserAttendanceRoute>);

// ─── Event Version History ──────────────────────────────────────────────
eventsRouter.openapi(getEventHistoryRoute, (async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = c.get("db") as Kysely<DB>;
    const results = await db.selectFrom("document_history")
      .select(["id", "room_id", "content", "created_by", "created_at"])
      .where("room_id", "=", `event_${id}`)
      .orderBy("created_at", "desc")
      .limit(50)
      .execute();

    const history = results.map(h => ({
      id: Number(h.id),
      title: `Revision ${h.id}`,
      author_email: h.created_by,
      created_at: h.created_at,
    }));

    return c.json({ history }, 200);
  } catch (e) {
    console.error("[Events:History] Error", e);
    return c.json({ error: "Failed to fetch history" }, 500);
  }
}) as AppRouteHandler<typeof getEventHistoryRoute>);

eventsRouter.openapi(restoreEventHistoryRoute, (async (c) => {
  try {
    const { id, historyId } = c.req.valid("param");
    const db = c.get("db") as Kysely<DB>;

    const row = await db.selectFrom("document_history")
      .select(["content"])
      .where("id", "=", Number(historyId))
      .where("room_id", "=", `event_${id}`)
      .executeTakeFirst();

    if (!row) {
      return c.json({ error: "Version not found" }, 404);
    }

    // Update the event description with the restored content
    await db.updateTable("events")
      .set({ description: row.content })
      .where("id", "=", id as string)
      .execute();

    // Save a new history entry for the restore action
    const { getSessionUser } = await import("../../middleware");
    const user = await getSessionUser(c);
    await db.insertInto("document_history")
      .values({
        room_id: `event_${id}`,
        content: row.content,
        created_by: user?.email || "admin",
        created_at: new Date().toISOString(),
      })
      .execute();

    return c.json({ success: true }, 200);
  } catch (e) {
    console.error("[Events:RestoreHistory] Error", e);
    return c.json({ error: "Restore failed" }, 500);
  }
}) as AppRouteHandler<typeof restoreEventHistoryRoute>);

export default eventsRouter;
