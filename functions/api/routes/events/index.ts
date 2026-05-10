import { typedHandler } from "../../utils/handler";
import { wrapLegacyHandler, autoResponseHandler, success } from "../../utils/handler-v2";
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

// â”€â”€â”€ Type Inference from Schemas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Router Setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const eventsRouter = new OpenAPIHono<AppEnv>();


// Apply edge caching to public GET routes (non-admin, non-signups)
eventsRouter.use("*", async (c, next) => {
  const path = c.req.path;
  if (c.req.method !== "GET" || path.includes("/admin/") || path.includes("/signups") || path.includes("/history")) {
    return next();
  }
  return edgeCacheMiddleware(180, 60, 300)(c, next);
});

// â”€â”€â”€ Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


eventsRouter.use("/admin/*", ensureAdmin);
eventsRouter.use("/:id/signups", ensureAuth);


// â”€â”€â”€ Public Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
eventsRouter.openapi(getEventsRoute, wrapLegacyHandler(eventHandlers.getEvents, getEventsRoute.responses[200].content["application/json"].schema));

eventsRouter.openapi(getCalendarSettingsRoute, wrapLegacyHandler(eventHandlers.getCalendarSettings, getCalendarSettingsRoute.responses[200].content["application/json"].schema));

eventsRouter.openapi(getEventRoute, wrapLegacyHandler(eventHandlers.getEvent, getEventRoute.responses[200].content["application/json"].schema));

eventsRouter.openapi(getSignupsRoute, wrapLegacyHandler(eventHandlers.getSignups, getSignupsRoute.responses[200].content["application/json"].schema));

eventsRouter.openapi(submitSignupRoute, wrapLegacyHandler(eventHandlers.submitSignup, submitSignupRoute.responses[200].content["application/json"].schema));

eventsRouter.openapi(deleteMySignupRoute, wrapLegacyHandler(eventHandlers.deleteMySignup, deleteMySignupRoute.responses[200].content["application/json"].schema));

eventsRouter.openapi(updateMyAttendanceRoute, wrapLegacyHandler(eventHandlers.updateMyAttendance, updateMyAttendanceRoute.responses[200].content["application/json"].schema));

// â”€â”€â”€ Admin Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
eventsRouter.openapi(getAdminEventsRoute, wrapLegacyHandler(eventHandlers.getAdminEvents, getAdminEventsRoute.responses[200].content["application/json"].schema));

eventsRouter.openapi(getAdminEventRoute, wrapLegacyHandler(eventHandlers.adminDetail, getAdminEventRoute.responses[200].content["application/json"].schema));

eventsRouter.openapi(saveEventRoute, wrapLegacyHandler(eventHandlers.saveEvent, saveEventRoute.responses[200].content["application/json"].schema));

eventsRouter.openapi(updateEventRoute, wrapLegacyHandler(eventHandlers.updateEvent, updateEventRoute.responses[200].content["application/json"].schema));

eventsRouter.openapi(deleteEventRoute, wrapLegacyHandler(eventHandlers.deleteEvent, deleteEventRoute.responses[200].content["application/json"].schema));

eventsRouter.openapi(syncEventsRoute, wrapLegacyHandler(eventHandlers.syncEvents, syncEventsRoute.responses[200].content["application/json"].schema));

eventsRouter.openapi(repairCalendarRoute, wrapLegacyHandler(eventHandlers.repairCalendar, repairCalendarRoute.responses[200].content["application/json"].schema));

eventsRouter.openapi(approveEventRoute, wrapLegacyHandler(eventHandlers.approveEvent, approveEventRoute.responses[200].content["application/json"].schema));

eventsRouter.openapi(rejectEventRoute, wrapLegacyHandler(eventHandlers.rejectEvent, rejectEventRoute.responses[200].content["application/json"].schema));

eventsRouter.openapi(undeleteEventRoute, wrapLegacyHandler(eventHandlers.undeleteEvent, undeleteEventRoute.responses[200].content["application/json"].schema));

eventsRouter.openapi(purgeEventRoute, wrapLegacyHandler(eventHandlers.purgeEvent, purgeEventRoute.responses[200].content["application/json"].schema));

eventsRouter.openapi(repushEventRoute, wrapLegacyHandler(eventHandlers.repushEvent, repushEventRoute.responses[200].content["application/json"].schema));

eventsRouter.openapi(updateUserAttendanceRoute, wrapLegacyHandler(eventHandlers.updateUserAttendance, updateUserAttendanceRoute.responses[200].content["application/json"].schema));

// â”€â”€â”€ Event Version History â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
eventsRouter.openapi(getEventHistoryRoute, typedHandler<typeof getEventHistoryRoute>(async (c) => {
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

eventsRouter.openapi(restoreEventHistoryRoute, typedHandler<typeof restoreEventHistoryRoute>(async (c) => {
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


