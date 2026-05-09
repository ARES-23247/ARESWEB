import { typedHandler } from "../../utils/handler";
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

// Type for event handler responses with optional error field
type EventHandlerResponse<T = unknown> = {
  status: number;
  body: T | { error?: string };
};

// Helper to extract error message from handler response body
function getErrorMessage(body: unknown): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const errorBody = body as { error?: string };
    return typeof errorBody.error === "string" ? errorBody.error : "Operation failed";
  }
  return "Operation failed";
}

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
eventsRouter.openapi(getEventsRoute, typedHandler<typeof getEventsRoute>(async (c) => {
  const query = c.req.valid("query");
  const result = await eventHandlers.getEvents({ query, params: {}, body: {} }, c);
  if (result.status === 200) return c.json(result.body satisfies GetEventsSuccess, 200);
  if (result.status === 500) throw new ApiError(getErrorMessage(result.body), 500);
  throw new ApiError("Unknown status code", 500, "INTERNAL_SERVER_ERROR");
}));

eventsRouter.openapi(getCalendarSettingsRoute, typedHandler<typeof getCalendarSettingsRoute>(async (c) => {
  const result = await eventHandlers.getCalendarSettings({ params: {}, query: {}, body: {} }, c);
  if (result.status === 200) return c.json(result.body satisfies GetCalendarSettingsSuccess, 200);
  if (result.status === 500) throw new ApiError(getErrorMessage(result.body), 500);
  throw new ApiError("Unknown status code", 500, "INTERNAL_SERVER_ERROR");
}));

eventsRouter.openapi(getEventRoute, typedHandler<typeof getEventRoute>(async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.getEvent({ params, query: {}, body: {} }, c);
  if (result.status === 200) return c.json(result.body satisfies GetEventSuccess, 200);
  if (result.status === 404) throw new ApiError(getErrorMessage(result.body), 404);
  throw new ApiError("Unknown status code", 500, "INTERNAL_SERVER_ERROR");
}));

eventsRouter.openapi(getSignupsRoute, typedHandler<typeof getSignupsRoute>(async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.getSignups({ params, query: {}, body: {} }, c);
  if (result.status === 200) return c.json(result.body satisfies GetSignupsSuccess, 200);
  if (result.status === 500) throw new ApiError(getErrorMessage(result.body), 500);
  throw new ApiError("Unknown status code", 500, "INTERNAL_SERVER_ERROR");
}));

eventsRouter.openapi(submitSignupRoute, typedHandler<typeof submitSignupRoute>(async (c) => {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await eventHandlers.submitSignup({ params, body, query: {} }, c);
  if (result.status === 200) return c.json(result.body satisfies SubmitSignupSuccess, 200);
  if (result.status === 403) throw new ApiError(getErrorMessage(result.body), 403);
  if (result.status === 500) throw new ApiError(getErrorMessage(result.body), 500);
  throw new ApiError("Unknown status code", 500, "INTERNAL_SERVER_ERROR");
}));

eventsRouter.openapi(deleteMySignupRoute, typedHandler<typeof deleteMySignupRoute>(async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.deleteMySignup({ params, query: {}, body: {} }, c);
  if (result.status === 200) return c.json(result.body satisfies DeleteMySignupSuccess, 200);
  if (result.status === 401) throw new ApiError(getErrorMessage(result.body), 401);
  if (result.status === 500) throw new ApiError(getErrorMessage(result.body), 500);
  throw new ApiError("Unknown status code", 500, "INTERNAL_SERVER_ERROR");
}));

eventsRouter.openapi(updateMyAttendanceRoute, typedHandler<typeof updateMyAttendanceRoute>(async (c) => {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await eventHandlers.updateMyAttendance({ params, body, query: {} }, c);
  if (result.status === 200) return c.json(result.body satisfies UpdateMyAttendanceSuccess, 200);
  if (result.status === 401) throw new ApiError(getErrorMessage(result.body), 401);
  if (result.status === 500) throw new ApiError(getErrorMessage(result.body), 500);
  throw new ApiError("Unknown status code", 500, "INTERNAL_SERVER_ERROR");
}));

// ─── Admin Routes ────────────────────────────────────────────────────────
eventsRouter.openapi(getAdminEventsRoute, typedHandler<typeof getAdminEventsRoute>(async (c) => {
  const query = c.req.valid("query");
  const result = await eventHandlers.getAdminEvents({ query, params: {}, body: {} }, c);
  if (result.status === 200) return c.json(result.body satisfies GetAdminEventsSuccess, 200);
  if (result.status === 500) throw new ApiError(getErrorMessage(result.body), 500);
  throw new ApiError("Unknown status code", 500, "INTERNAL_SERVER_ERROR");
}));

eventsRouter.openapi(getAdminEventRoute, typedHandler<typeof getAdminEventRoute>(async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.adminDetail({ params, query: {}, body: {} }, c);
  if (result.status === 200) return c.json(result.body satisfies GetAdminEventSuccess, 200);
  if (result.status === 404) throw new ApiError(getErrorMessage(result.body), 404);
  if (result.status === 500) throw new ApiError(getErrorMessage(result.body), 500);
  throw new ApiError("Unknown status code", 500, "INTERNAL_SERVER_ERROR");
}));

eventsRouter.openapi(saveEventRoute, typedHandler<typeof saveEventRoute>(async (c) => {
  const body = c.req.valid("json");
  const result = await eventHandlers.saveEvent({ body, params: {}, query: {} }, c);
  if (result.status === 200) return c.json(result.body satisfies SaveEventSuccess, 200);
  if (result.status === 400) throw new ApiError(getErrorMessage(result.body), 400);
  if (result.status === 401) throw new ApiError(getErrorMessage(result.body), 401);
  if (result.status === 500) throw new ApiError(getErrorMessage(result.body), 500);
  throw new ApiError("Unknown status code", 500, "INTERNAL_SERVER_ERROR");
}));

eventsRouter.openapi(updateEventRoute, typedHandler<typeof updateEventRoute>(async (c) => {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await eventHandlers.updateEvent({ params, body, query: {} }, c);
  if (result.status === 200) return c.json(result.body satisfies UpdateEventSuccess, 200);
  if (result.status === 400) throw new ApiError(getErrorMessage(result.body), 400);
  if (result.status === 404) throw new ApiError(getErrorMessage(result.body), 404);
  if (result.status === 500) throw new ApiError(getErrorMessage(result.body), 500);
  throw new ApiError("Unknown status code", 500, "INTERNAL_SERVER_ERROR");
}));

eventsRouter.openapi(deleteEventRoute, typedHandler<typeof deleteEventRoute>(async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.deleteEvent({ params, body: {} , query: {} }, c);
  if (result.status === 200) return c.json(result.body satisfies DeleteEventSuccess, 200);
  if (result.status === 500) throw new ApiError(getErrorMessage(result.body), 500);
  throw new ApiError("Unknown status code", 500, "INTERNAL_SERVER_ERROR");
}));

eventsRouter.openapi(syncEventsRoute, typedHandler<typeof syncEventsRoute>(async (c) => {
  const result = await eventHandlers.syncEvents({ params: {}, query: {}, body: {} }, c);
  if (result.status === 200) return c.json(result.body satisfies SyncEventsSuccess, 200);
  if (result.status === 500) throw new ApiError(getErrorMessage(result.body), 500);
  throw new ApiError("Unknown status code", 500, "INTERNAL_SERVER_ERROR");
}));

eventsRouter.openapi(repairCalendarRoute, typedHandler<typeof repairCalendarRoute>(async (c) => {
  const result = await eventHandlers.repairCalendar({ params: {}, query: {}, body: {} }, c);
  if (result.status === 200) return c.json(result.body satisfies RepairCalendarSuccess, 200);
  if (result.status === 500) throw new ApiError(getErrorMessage(result.body), 500);
  throw new ApiError("Unknown status code", 500, "INTERNAL_SERVER_ERROR");
}));

eventsRouter.openapi(approveEventRoute, typedHandler<typeof approveEventRoute>(async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.approveEvent({ params, query: {}, body: {} }, c);
  if (result.status === 200) return c.json(result.body satisfies ApproveEventSuccess, 200);
  if (result.status === 500) throw new ApiError(getErrorMessage(result.body), 500);
  throw new ApiError("Unknown status code", 500, "INTERNAL_SERVER_ERROR");
}));

eventsRouter.openapi(rejectEventRoute, typedHandler<typeof rejectEventRoute>(async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.rejectEvent({ params, query: {}, body: {} }, c);
  if (result.status === 200) return c.json(result.body satisfies RejectEventSuccess, 200);
  if (result.status === 500) throw new ApiError(getErrorMessage(result.body), 500);
  throw new ApiError("Unknown status code", 500, "INTERNAL_SERVER_ERROR");
}));

eventsRouter.openapi(undeleteEventRoute, typedHandler<typeof undeleteEventRoute>(async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.undeleteEvent({ params, query: {}, body: {} }, c);
  if (result.status === 200) return c.json(result.body satisfies UndeleteEventSuccess, 200);
  if (result.status === 500) throw new ApiError(getErrorMessage(result.body), 500);
  throw new ApiError("Unknown status code", 500, "INTERNAL_SERVER_ERROR");
}));

eventsRouter.openapi(purgeEventRoute, typedHandler<typeof purgeEventRoute>(async (c) => {
  const params = c.req.valid("param");
  const result = await eventHandlers.purgeEvent({ params, query: {}, body: {} }, c);
  if (result.status === 200) return c.json(result.body satisfies PurgeEventSuccess, 200);
  if (result.status === 500) throw new ApiError(getErrorMessage(result.body), 500);
  throw new ApiError("Unknown status code", 500, "INTERNAL_SERVER_ERROR");
}));

eventsRouter.openapi(repushEventRoute, typedHandler<typeof repushEventRoute>(async (c) => {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await eventHandlers.repushEvent({ params, body, query: {} }, c);
  if (result.status === 200) return c.json(result.body satisfies RepushEventSuccess, 200);
  if (result.status === 401) throw new ApiError(getErrorMessage(result.body), 401);
  if (result.status === 404) throw new ApiError(getErrorMessage(result.body), 404);
  if (result.status === 502) throw new ApiError(getErrorMessage(result.body), 502);
  throw new ApiError("Unknown status code", 500, "INTERNAL_SERVER_ERROR");
}));

eventsRouter.openapi(updateUserAttendanceRoute, typedHandler<typeof updateUserAttendanceRoute>(async (c) => {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await eventHandlers.updateUserAttendance({ params, body, query: {} }, c);
  if (result.status === 200) return c.json(result.body satisfies UpdateUserAttendanceSuccess, 200);
  if (result.status === 401) throw new ApiError(getErrorMessage(result.body), 401);
  if (result.status === 500) throw new ApiError(getErrorMessage(result.body), 500);
  throw new ApiError("Unknown status code", 500, "INTERNAL_SERVER_ERROR");
}));

// ─── Event Version History ──────────────────────────────────────────────
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
      author_email: string;
      created_at: string;
    }> = results.map((h) => ({
      id: Number(h.id),
      title: `Revision ${h.id}`,
      author_email: h.createdBy ?? "",
      created_at: String(h.createdAt ?? ""),
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
