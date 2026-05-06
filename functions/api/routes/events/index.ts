import { Context } from "hono";
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
eventsRouter.openapi(getEventsRoute, async (c: Context<AppEnv>) => {
  const query = c.req.valid("query");
  const result = await eventHandlers.getEvents({ query, params: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
});

eventsRouter.openapi(getEventRoute, async (c: Context<AppEnv>) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.getEvent({ params, query: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
});

eventsRouter.openapi(getCalendarSettingsRoute, async (c: Context<AppEnv>) => {
  const result = await eventHandlers.getCalendarSettings({ params: {}, query: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
});

eventsRouter.openapi(getSignupsRoute, async (c: Context<AppEnv>) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.getSignups({ params, query: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
});

eventsRouter.openapi(submitSignupRoute, async (c: Context<AppEnv>) => {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await eventHandlers.submitSignup({ params, body, query: {} }, c);
  return c.json(result.body, result.status as any);
});

eventsRouter.openapi(deleteMySignupRoute, async (c: Context<AppEnv>) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.deleteMySignup({ params, query: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
});

eventsRouter.openapi(updateMyAttendanceRoute, async (c: Context<AppEnv>) => {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await eventHandlers.updateMyAttendance({ params, body, query: {} }, c);
  return c.json(result.body, result.status as any);
});

// ─── Admin Routes ────────────────────────────────────────────────────────
eventsRouter.openapi(getAdminEventsRoute, async (c: Context<AppEnv>) => {
  const query = c.req.valid("query");
  const result = await eventHandlers.getAdminEvents({ query, params: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
});

eventsRouter.openapi(getAdminEventRoute, async (c: Context<AppEnv>) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.adminDetail({ params, query: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
});

eventsRouter.openapi(saveEventRoute, async (c: Context<AppEnv>) => {
  const body = c.req.valid("json");
  const result = await eventHandlers.saveEvent({ body, params: {}, query: {} }, c);
  return c.json(result.body, result.status as any);
});

eventsRouter.openapi(updateEventRoute, async (c: Context<AppEnv>) => {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await eventHandlers.updateEvent({ params, body, query: {} }, c);
  return c.json(result.body, result.status as any);
});

eventsRouter.openapi(deleteEventRoute, async (c: Context<AppEnv>) => {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await eventHandlers.deleteEvent({ params, body, query: {} }, c);
  return c.json(result.body, result.status as any);
});

eventsRouter.openapi(syncEventsRoute, async (c: Context<AppEnv>) => {
  const result = await eventHandlers.syncEvents({ params: {}, query: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
});

eventsRouter.openapi(repairCalendarRoute, async (c: Context<AppEnv>) => {
  const result = await eventHandlers.repairCalendar({ params: {}, query: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
});

eventsRouter.openapi(approveEventRoute, async (c: Context<AppEnv>) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.approveEvent({ params, query: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
});

eventsRouter.openapi(rejectEventRoute, async (c: Context<AppEnv>) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.rejectEvent({ params, query: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
});

eventsRouter.openapi(undeleteEventRoute, async (c: Context<AppEnv>) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.undeleteEvent({ params, query: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
});

eventsRouter.openapi(purgeEventRoute, async (c: Context<AppEnv>) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.purgeEvent({ params, query: {}, body: {} }, c);
  return c.json(result.body, result.status as any);
});

eventsRouter.openapi(repushEventRoute, async (c: Context<AppEnv>) => {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await eventHandlers.repushEvent({ params, body, query: {} }, c);
  return c.json(result.body, result.status as any);
});

eventsRouter.openapi(updateUserAttendanceRoute, async (c: Context<AppEnv>) => {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await eventHandlers.updateUserAttendance({ params, body, query: {} }, c);
  return c.json(result.body, result.status as any);
});

// ─── Event Version History ──────────────────────────────────────────────
eventsRouter.openapi(getEventHistoryRoute, async (c: Context<AppEnv>) => {
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
});

eventsRouter.openapi(restoreEventHistoryRoute, async (c: Context<AppEnv>) => {
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
});

export default eventsRouter;
