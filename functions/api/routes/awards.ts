import { typedHandler } from "../utils/handler";
import { OpenAPIHono } from "@hono/zod-openapi";

import { eq, desc, asc, and } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { AppEnv, ensureAdmin, logAuditAction, getDb } from "../middleware";
import { edgeCacheMiddleware } from "../middleware/cache";
import { getAwardsRoute, saveAwardRoute, deleteAwardRoute } from "../../../shared/routes/awards";




export const awardsRouter = new OpenAPIHono<AppEnv>();

// Apply caching to public awards list
awardsRouter.use("/", edgeCacheMiddleware(180, 60, 300));

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

    let finalId: string | undefined = id;
    let exists = false;
    if (id) {
      const numericId = Number(id);
      if (isNaN(numericId) || numericId <= 0) {
        return c.json({ error: "Invalid award ID", code: "BAD_REQUEST" }, 400);
      }
      const row = await db.select({ id: schema.awards.id }).from(schema.awards).where(eq(schema.awards.id, numericId)).get();
      if (row) {
        exists = true;
        finalId = String(row.id);
      }
    }

    if (!exists) {
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
        exists = true;
        finalId = String(duplicate.id);
      }
    }

    const values = {
      title,
      date: String(year),
      eventName: event_name || "",
      description: description || null,
      iconType: image_url || "trophy",
      seasonId: season_id || null,
      isDeleted: 0
    } as const;

    if (exists && finalId) {
      const updateId = Number(finalId);
      if (isNaN(updateId) || updateId <= 0) {
        return c.json({ error: "Invalid award ID for update", code: "BAD_REQUEST" }, 400);
      }
      await db.update(schema.awards).set(values).where(eq(schema.awards.id, updateId)).run();
      c.executionCtx.waitUntil(logAuditAction(c, "award_updated", "awards", finalId, `Award "${title}" (${year}) updated`));
    } else {
      try {
        const res = await db.insert(schema.awards).values(values).returning({ insertId: schema.awards.id }).get();
        const newId = res && "insertId" in res ? String(res.insertId) : "new";
        c.executionCtx.waitUntil(logAuditAction(c, "award_created", "awards", newId, `Award "${title}" (${year}) created`));
        finalId = newId;
      } catch (insertError: unknown) {
        const err = insertError as Error;
        if (err?.message?.includes('UNIQUE') || err?.message?.includes('constraint')) {
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
            finalId = String(duplicate.id);
            c.executionCtx.waitUntil(logAuditAction(c, "award_race_condition_handled", "awards", finalId, `Award "${title}" (${year}) race condition - returned existing record`));
          } else {
            throw insertError;
          }
        } else {
          throw insertError;
        }
      }
    }

    return c.json({ success: true, id: finalId! }, 200);
}));

awardsRouter.openapi(deleteAwardRoute, typedHandler<typeof deleteAwardRoute>(async (c) => {
    const db = getDb(c);
    const params = c.req.valid('param');
    const numericId = Number(params.id);
    if (isNaN(numericId) || numericId <= 0) {
      return c.json({ error: "Invalid award ID", code: "BAD_REQUEST" }, 400);
    }
    await db.update(schema.awards).set({ isDeleted: 1 }).where(eq(schema.awards.id, numericId)).run();
    c.executionCtx.waitUntil(logAuditAction(c, "award_deleted", "awards", params.id, "Award soft-deleted"));
    return c.json({ success: true }, 200);
}));

export default awardsRouter;
