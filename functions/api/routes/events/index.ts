import { ApiError } from "../../middleware/errorHandler";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { z } from "zod";

import { AppEnv, ensureAdmin, ensureAuth, getDb, getSessionUser } from "../../middleware";
import { eventHandlers } from "./handlers";
import { eq, desc, sql, and } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
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

// ─── Type Inference from Schemas ───────────────────────────────────────────────

type GetEventsSuccess = z.infer<typeof getEventsRoute.responses[200]["content"]["application/json"]["schema"]>;
type GetEventSuccess = z.infer<typeof getEventRoute.responses[200]["content"]["application/json"]["schema"]>;
type GetAdminEventSuccess = z.infer<typeof getAdminEventRoute.responses[200]["content"]["application/json"]["schema"]>;
type GetAdminEventsSuccess = z.infer<typeof getAdminEventsRoute.responses[200]["content"]["application/json"]["schema"]>;
type SaveEventSuccess = z.infer<typeof saveEventRoute.responses[200]["content"]["application/json"]["schema"]>;
type UpdateEventSuccess = z.infer<typeof updateEventRoute.responses[200]["content"]["application/json"]["schema"]>;
type DeleteEventSuccess = z.infer<typeof deleteEventRoute.responses[200]["content"]["application/json"]["schema"]>;
type SyncEventsSuccess = z.infer<typeof syncEventsRoute.responses[200]["content"]["application/json"]["schema"]>;
type RepairCalendarSuccess = z.infer<typeof repairCalendarRoute.responses[200]["content"]["application/json"]["schema"]>;
type ApproveEventSuccess = z.infer<typeof approveEventRoute.responses[200]["content"]["application/json"]["schema"]>;
type RejectEventSuccess = z.infer<typeof rejectEventRoute.responses[200]["content"]["application/json"]["schema"]>;
type UndeleteEventSuccess = z.infer<typeof undeleteEventRoute.responses[200]["content"]["application/json"]["schema"]>;
type PurgeEventSuccess = z.infer<typeof purgeEventRoute.responses[200]["content"]["application/json"]["schema"]>;
type RepushEventSuccess = z.infer<typeof repushEventRoute.responses[200]["content"]["application/json"]["schema"]>;
type GetCalendarSettingsSuccess = z.infer<typeof getCalendarSettingsRoute.responses[200]["content"]["application/json"]["schema"]>;
type GetSignupsSuccess = z.infer<typeof getSignupsRoute.responses[200]["content"]["application/json"]["schema"]>;
type SubmitSignupSuccess = z.infer<typeof submitSignupRoute.responses[200]["content"]["application/json"]["schema"]>;
type DeleteMySignupSuccess = z.infer<typeof deleteMySignupRoute.responses[200]["content"]["application/json"]["schema"]>;
type UpdateMyAttendanceSuccess = z.infer<typeof updateMyAttendanceRoute.responses[200]["content"]["application/json"]["schema"]>;
type UpdateUserAttendanceSuccess = z.infer<typeof updateUserAttendanceRoute.responses[200]["content"]["application/json"]["schema"]>;
type RestoreEventHistorySuccess = z.infer<typeof restoreEventHistoryRoute.responses[200]["content"]["application/json"]["schema"]>;

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
eventsRouter.openapi(getEventsRoute, wrapHandler(getEventsRoute, async (c, input) => eventHandlers.getEvents(input, c)));

eventsRouter.openapi(getCalendarSettingsRoute, wrapHandler(getCalendarSettingsRoute, async (c, input) => eventHandlers.getCalendarSettings(input, c)));

eventsRouter.openapi(getEventRoute, wrapHandler(getEventRoute, async (c, input) => eventHandlers.getEvent(input, c)));

eventsRouter.openapi(getSignupsRoute, wrapHandler(getSignupsRoute, async (c, input) => eventHandlers.getSignups(input, c)));

eventsRouter.openapi(submitSignupRoute, wrapHandler(submitSignupRoute, async (c, input) => eventHandlers.submitSignup(input, c)));

eventsRouter.openapi(deleteMySignupRoute, wrapHandler(deleteMySignupRoute, async (c, input) => eventHandlers.deleteMySignup(input, c)));

eventsRouter.openapi(updateMyAttendanceRoute, wrapHandler(updateMyAttendanceRoute, async (c, input) => eventHandlers.updateMyAttendance(input, c)));

// ─── Admin Routes ────────────────────────────────────────────────────────
eventsRouter.openapi(getAdminEventsRoute, wrapHandler(getAdminEventsRoute, async (c, input) => eventHandlers.getAdminEvents(input, c)));

eventsRouter.openapi(getAdminEventRoute, wrapHandler(getAdminEventRoute, async (c, input) => eventHandlers.adminDetail(input, c)));

eventsRouter.openapi(saveEventRoute, wrapHandler(saveEventRoute, async (c, input) => eventHandlers.saveEvent(input, c)));

eventsRouter.openapi(updateEventRoute, wrapHandler(updateEventRoute, async (c, input) => eventHandlers.updateEvent(input, c)));

eventsRouter.openapi(deleteEventRoute, wrapHandler(deleteEventRoute, async (c, input) => eventHandlers.deleteEvent(input, c)));

eventsRouter.openapi(syncEventsRoute, wrapHandler(syncEventsRoute, async (c, input) => eventHandlers.syncEvents(input, c)));

eventsRouter.openapi(repairCalendarRoute, wrapHandler(repairCalendarRoute, async (c, input) => eventHandlers.repairCalendar(input, c)));

eventsRouter.openapi(approveEventRoute, wrapHandler(approveEventRoute, async (c, input) => eventHandlers.approveEvent(input, c)));

eventsRouter.openapi(rejectEventRoute, wrapHandler(rejectEventRoute, async (c, input) => eventHandlers.rejectEvent(input, c)));

eventsRouter.openapi(undeleteEventRoute, wrapHandler(undeleteEventRoute, async (c, input) => eventHandlers.undeleteEvent(input, c)));

eventsRouter.openapi(purgeEventRoute, wrapHandler(purgeEventRoute, async (c, input) => eventHandlers.purgeEvent(input, c)));

eventsRouter.openapi(repushEventRoute, wrapHandler(repushEventRoute, async (c, input) => eventHandlers.repushEvent(input, c)));

eventsRouter.openapi(updateUserAttendanceRoute, wrapHandler(updateUserAttendanceRoute, async (c, input) => eventHandlers.updateUserAttendance(input, c)));

// ─── Event Version History ──────────────────────────────────────────────
eventsRouter.openapi(getEventHistoryRoute, createTypedHandler(getEventHistoryRoute, async (c) => {
    const { id } = c.req.valid("param");
    const db = getDb(c);
    const results = await db.select({
      id: schema.documentHistory.id,
      roomId: schema.documentHistory.roomId,
      content: schema.documentHistory.content,
      createdBy: schema.documentHistory.createdBy,
      createdAt: schema.documentHistory.createdAt,
    })
      .from(schema.documentHistory)
      .where(eq(schema.documentHistory.roomId, `event_${id}`))
      .orderBy(desc(schema.documentHistory.createdAt))
      .limit(50)
      .all();

    const history: Array<{
      id: number;
      title: string;
      authorEmail: string;
      createdAt: string;
    }> = results.map((h) => ({
      id: Number(h.id),
      title: `Revision ${h.id}`,
      authorEmail: h.createdBy ?? "",
      createdAt: String(h.createdAt ?? ""),
    }));

    return c.json({ history }, 200);
}));

eventsRouter.openapi(restoreEventHistoryRoute, createTypedHandler(restoreEventHistoryRoute, async (c) => {
    const { id, historyId } = c.req.valid("param");
    const db = getDb(c);

    const row = await db.select({
      content: schema.documentHistory.content,
    })
      .from(schema.documentHistory)
      .where(and(eq(schema.documentHistory.id, Number(historyId)), eq(schema.documentHistory.roomId, `event_${id}`)))
      .get();

    if (!row) {
      throw new ApiError("Version", 404, "NOT_FOUND");
    }

    // Update the event description with the restored content
    await db.update(schema.events)
      .set({ description: row.content })
      .where(eq(schema.events.id, id))
      .run();

    // Save a new history entry for the restore action
    const user = await getSessionUser(c);
    await db.insert(schema.documentHistory)
      .values({
        roomId: `event_${id}`,
        content: row.content,
        createdBy: user?.email || "admin",
        createdAt: sql`CURRENT_TIMESTAMP`,
      })
      .run();

    return c.json({ success: true } satisfies RestoreEventHistorySuccess, 200);
}));

export default eventsRouter;




