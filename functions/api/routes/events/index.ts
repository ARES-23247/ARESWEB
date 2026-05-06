/* eslint-disable @typescript-eslint/no-explicit-any */
import { typedHandler } from "../../utils/handler";
 
import { OpenAPIHono } from "@hono/zod-openapi";

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



const eventsRouter = new OpenAPIHono<AppEnv>();

// ─── Middleware ───────────────────────────────────────────────────────────
eventsRouter.use("/", edgeCacheMiddleware(300, 60)); // Cache list
eventsRouter.use("/:id", edgeCacheMiddleware(300, 60)); // Cache single
eventsRouter.use("/admin/*", ensureAdmin);
eventsRouter.use("/:id/signups", ensureAuth);



// ─── Public Routes ───────────────────────────────────────────────────────
eventsRouter.openapi(getEventsRoute, typedHandler<typeof getEventsRoute>(async (c) => {
  const query = c.req.valid("query");
  const result = await eventHandlers.getEvents({ query, params: {}, body: {} }, c);
  return c.json(result.body as any, result.status as any);
}));

eventsRouter.openapi(getEventRoute, typedHandler<typeof getEventRoute>(async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.getEvent({ params, query: {}, body: {} }, c);
  return c.json(result.body as any, result.status as any);
}));

eventsRouter.openapi(getCalendarSettingsRoute, typedHandler<typeof getCalendarSettingsRoute>(async (c) => {
  const result = await eventHandlers.getCalendarSettings({ params: {}, query: {}, body: {} }, c);
  return c.json(result.body as any, result.status as any);
}));

eventsRouter.openapi(getSignupsRoute, typedHandler<typeof getSignupsRoute>(async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.getSignups({ params, query: {}, body: {} }, c);
  return c.json(result.body as any, result.status as any);
}));

eventsRouter.openapi(submitSignupRoute, typedHandler<typeof submitSignupRoute>(async (c) => {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await eventHandlers.submitSignup({ params, body, query: {} }, c);
  return c.json(result.body as any, result.status as any);
}));

eventsRouter.openapi(deleteMySignupRoute, typedHandler<typeof deleteMySignupRoute>(async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.deleteMySignup({ params, query: {}, body: {} }, c);
  return c.json(result.body as any, result.status as any);
}));

eventsRouter.openapi(updateMyAttendanceRoute, typedHandler<typeof updateMyAttendanceRoute>(async (c) => {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await eventHandlers.updateMyAttendance({ params, body, query: {} }, c);
  return c.json(result.body as any, result.status as any);
}));

// ─── Admin Routes ────────────────────────────────────────────────────────
eventsRouter.openapi(getAdminEventsRoute, typedHandler<typeof getAdminEventsRoute>(async (c) => {
  const query = c.req.valid("query");
  const result = await eventHandlers.getAdminEvents({ query, params: {}, body: {} }, c);
  return c.json(result.body as any, result.status as any);
}));

eventsRouter.openapi(getAdminEventRoute, typedHandler<typeof getAdminEventRoute>(async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.adminDetail({ params, query: {}, body: {} }, c);
  return c.json(result.body as any, result.status as any);
}));

eventsRouter.openapi(saveEventRoute, typedHandler<typeof saveEventRoute>(async (c) => {
  const body = c.req.valid("json");
  const result = await eventHandlers.saveEvent({ body, params: {}, query: {} }, c);
  return c.json(result.body as any, result.status as any);
}));

eventsRouter.openapi(updateEventRoute, typedHandler<typeof updateEventRoute>(async (c) => {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await eventHandlers.updateEvent({ params, body, query: {} }, c);
  return c.json(result.body as any, result.status as any);
}));

eventsRouter.openapi(deleteEventRoute, typedHandler<typeof deleteEventRoute>(async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.deleteEvent({ params, body: {} as any, query: {} }, c);
  return c.json(result.body as any, result.status as any);
}));

eventsRouter.openapi(syncEventsRoute, typedHandler<typeof syncEventsRoute>(async (c) => {
  const result = await eventHandlers.syncEvents({ params: {}, query: {}, body: {} }, c);
  return c.json(result.body as any, result.status as any);
}));

eventsRouter.openapi(repairCalendarRoute, typedHandler<typeof repairCalendarRoute>(async (c) => {
  const result = await eventHandlers.repairCalendar({ params: {}, query: {}, body: {} }, c);
  return c.json(result.body as any, result.status as any);
}));

eventsRouter.openapi(approveEventRoute, typedHandler<typeof approveEventRoute>(async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.approveEvent({ params, query: {}, body: {} }, c);
  return c.json(result.body as any, result.status as any);
}));

eventsRouter.openapi(rejectEventRoute, typedHandler<typeof rejectEventRoute>(async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.rejectEvent({ params, query: {}, body: {} }, c);
  return c.json(result.body as any, result.status as any);
}));

eventsRouter.openapi(undeleteEventRoute, typedHandler<typeof undeleteEventRoute>(async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.undeleteEvent({ params, query: {}, body: {} }, c);
  return c.json(result.body as any, result.status as any);
}));

eventsRouter.openapi(purgeEventRoute, typedHandler<typeof purgeEventRoute>(async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.purgeEvent({ params, query: {}, body: {} }, c);
  return c.json(result.body as any, result.status as any);
}));

eventsRouter.openapi(repushEventRoute, typedHandler<typeof repushEventRoute>(async (c) => {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await eventHandlers.repushEvent({ params, body, query: {} }, c);
  return c.json(result.body as any, result.status as any);
}));

eventsRouter.openapi(updateUserAttendanceRoute, typedHandler<typeof updateUserAttendanceRoute>(async (c) => {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await eventHandlers.updateUserAttendance({ params, body, query: {} }, c);
  return c.json(result.body as any, result.status as any);
}));

// ─── Event Version History ──────────────────────────────────────────────
eventsRouter.openapi(getEventHistoryRoute, typedHandler<typeof getEventHistoryRoute>(async (c) => {
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

    return c.json({ history } as any, 200 as any);
  } catch (e) {
    console.error("[Events:History] Error", e);
    return c.json({ error: "Failed to fetch history" }, 500);
  }
}));

eventsRouter.openapi(restoreEventHistoryRoute, typedHandler<typeof restoreEventHistoryRoute>(async (c) => {
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
}));

export default eventsRouter;
