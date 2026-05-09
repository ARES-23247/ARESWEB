import { typedHandler } from "../utils/handler";
import { ApiError } from "../middleware/errorHandler";
import { OpenAPIHono } from "@hono/zod-openapi";

import { eq, desc, asc, and } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { AppEnv, ensureAdmin, logAuditAction, getDb } from "../middleware";
import { edgeCacheMiddleware } from "../middleware/cache";
import { getAwardsRoute, saveAwardRoute, deleteAwardRoute } from "../../../shared/routes/awards";




export const awardsRouter = new OpenAPIHono<AppEnv>();


// Apply edge caching to public GET routes (non-admin, non-signups)
awardsRouter.use("*", async (c, next) => {
  const path = c.req.path;
  if (c.req.method !== "GET" || path.includes("/admin/") || path.includes("/signups") || path.includes("/history")) {
    return next();
  }
  return edgeCacheMiddleware(180, 60, 300)(c, next);
});

// Apply caching to public awards list


awardsRouter.openapi(getAwardsRoute, typedHandler<typeof getAwardsRoute>(async (c) => {
    const db = getDb(c);
    const { limit = 50, offset = 0 } = c.req.valid('query');
    const results = await db.select({
        id: schema.awards.id,
        title: schema.awards.title,
        date: schema.awards.date,
        event_name: schema.awards.eventName,
        description: schema.awards.description,
        image_url: schema.awards.iconType,
        season_id: schema.awards.seasonId,
        created_at: schema.awards.createdAt
      })
      .from(schema.awards)
      .where(eq(schema.awards.isDeleted, 0))
      .orderBy(desc(schema.awards.date), asc(schema.awards.title))
      .limit(limit || 50)
      .offset(offset || 0)
      .all();
    
    const awards = results.map((a) => ({
      id: String(a.id),
      title: a.title,
      year: Number(a.date),
      event_name: a.event_name || null,
      description: a.description || null,
      image_url: a.image_url || "trophy",
      season_id: a.season_id ? Number(a.season_id) : null,
      created_at: a.created_at || new Date().toISOString(),
      updated_at: a.created_at || new Date().toISOString()
    }));

    return c.json({ awards }, 200);
}));

awardsRouter.use("/admin/*", ensureAdmin);

awardsRouter.openapi(saveAwardRoute, typedHandler<typeof saveAwardRoute>(async (c) => {
    const validatedData = c.req.valid('json');
    const db = getDb(c);
    const { id, title, year, event_name, description, image_url, season_id } = validatedData;

    const values = {
      title,
      date: String(year),
      eventName: event_name || "",
      description: description || null,
      iconType: image_url || "trophy",
      seasonId: season_id ? Number(season_id) : null,
      isDeleted: 0
    } as const;

    // If updating by ID, use the ID directly (no race condition)
    if (id) {
      const numericId = Number(id);
      if (isNaN(numericId) || numericId <= 0) {
        throw new ApiError("Invalid award ID", 400, "BAD_REQUEST");
      }
      // Verify the record exists before updating
      const row = await db.select({ id: schema.awards.id }).from(schema.awards).where(eq(schema.awards.id, numericId)).get();
      if (!row) {
        throw new ApiError("Award not found", 404, "NOT_FOUND");
      }
      await db.update(schema.awards).set(values).where(eq(schema.awards.id, numericId)).run();
      c.executionCtx.waitUntil(logAuditAction(c, "award_updated", "awards", id, `Award "${title}" (${year}) updated`));
      return c.json({ success: true, id }, 200);
    }

    // For new awards, use insert-or-find pattern to handle race conditions atomically
    // First, try to find an existing non-deleted award with the same key
    const existingAward = await db.select({ id: schema.awards.id })
      .from(schema.awards)
      .where(and(
        eq(schema.awards.title, title),
        eq(schema.awards.date, String(year)),
        eq(schema.awards.eventName, event_name || ""),
        eq(schema.awards.isDeleted, 0)
      ))
      .get();

    if (existingAward) {
      // Award already exists, return its ID
      c.executionCtx.waitUntil(logAuditAction(c, "award_duplicate_found", "awards", String(existingAward.id), `Award "${title}" (${year}) already exists`));
      return c.json({ success: true, id: String(existingAward.id) }, 200);
    }

    // No existing award found, attempt to insert
    // Use a try-catch to handle the race condition where another request
    // might have inserted the same award between our check and insert
    try {
      const res = await db.insert(schema.awards).values(values).returning({ insertId: schema.awards.id }).get();
      const newId = res && "insertId" in res ? String(res.insertId) : "new";
      c.executionCtx.waitUntil(logAuditAction(c, "award_created", "awards", newId, `Award "${title}" (${year}) created`));
      return c.json({ success: true, id: newId }, 200);
    } catch (insertError: unknown) {
      const err = insertError as Error;
      // If we get a constraint error (race condition), check again for the duplicate
      // This handles the case where another request inserted the same award
      const duplicate = await db.select({ id: schema.awards.id })
        .from(schema.awards)
        .where(and(
          eq(schema.awards.title, title),
          eq(schema.awards.date, String(year)),
          eq(schema.awards.eventName, event_name || ""),
          eq(schema.awards.isDeleted, 0)
        ))
        .get();

      if (duplicate) {
        // Another request won the race, return the existing award
        c.executionCtx.waitUntil(logAuditAction(c, "award_race_condition_handled", "awards", String(duplicate.id), `Award "${title}" (${year}) race condition - returned existing record`));
        return c.json({ success: true, id: String(duplicate.id) }, 200);
      }

      // Not a duplicate error, rethrow
      throw insertError;
    }
}));

awardsRouter.openapi(deleteAwardRoute, typedHandler<typeof deleteAwardRoute>(async (c) => {
    const db = getDb(c);
    const params = c.req.valid('param');
    const numericId = Number(params.id);
    if (isNaN(numericId) || numericId <= 0) {
      throw new ApiError("Invalid award ID", 400, "BAD_REQUEST");
    }
    await db.update(schema.awards).set({ isDeleted: 1 }).where(eq(schema.awards.id, numericId)).run();
    c.executionCtx.waitUntil(logAuditAction(c, "award_deleted", "awards", params.id, "Award soft-deleted"));
    return c.json({ success: true }, 200);
}));

export default awardsRouter;
