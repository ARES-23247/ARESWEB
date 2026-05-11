import { OpenAPIHono } from "@hono/zod-openapi";

import { eq, desc, asc, and } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { AppEnv, ensureAdmin, logAuditAction, getDb } from "../middleware";
import { edgeCacheMiddleware } from "../middleware/cache";
import { getAwardsRoute, saveAwardRoute, deleteAwardRoute } from "../../../shared/routes/awards";
import { ApiError } from "../middleware/errorHandler";

const _awardsRouter = new OpenAPIHono<AppEnv>();

// Apply edge caching to public GET routes (non-admin, non-signups)
_awardsRouter.use("*", async (c, next) => {
  const path = c.req.path;
  if (c.req.method !== "GET" || path.includes("/admin/") || path.includes("/signups") || path.includes("/history")) {
    return next();
  }
  return edgeCacheMiddleware(180, 60, 300)(c, next);
});

// Apply ensureAdmin middleware to /admin/* routes BEFORE adding routes
_awardsRouter.use("/admin/*", ensureAdmin);

// Get awards list
export const awardsRouter = _awardsRouter
    .openapi(getAwardsRoute, async (c) => {
        const query = c.req.valid("query");
        const db = getDb(c);
        const { limit = 50, offset = 0 } = query;
        const results = await db.select({
            id: schema.awards.id,
            title: schema.awards.title,
            date: schema.awards.date,
            eventName: schema.awards.eventName,
            description: schema.awards.description,
            iconType: schema.awards.iconType,
            seasonId: schema.awards.seasonId,
            createdAt: schema.awards.createdAt
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
          eventName: a.eventName || null,
          description: a.description || null,
          imageUrl: a.iconType || "trophy",
          seasonId: a.seasonId ? Number(a.seasonId) : null,
          createdAt: a.createdAt || new Date().toISOString(),
          updatedAt: a.createdAt || new Date().toISOString()
        }));

        return c.json({ awards }, 200);
    })
    .openapi(saveAwardRoute, async (c) => {
        const body = c.req.valid("json");
        const db = getDb(c);
        const { id, title, year, eventName, description, imageUrl, seasonId } = body;

        const values = {
          title,
          date: String(year),
          eventName: eventName || "",
          description: description || null,
          iconType: imageUrl || "trophy",
          seasonId: seasonId ? Number(seasonId) : null,
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
        const existingAward = await db.select({ id: schema.awards.id })
          .from(schema.awards)
          .where(and(
            eq(schema.awards.title, title),
            eq(schema.awards.date, String(year)),
            eq(schema.awards.eventName, eventName || ""),
            eq(schema.awards.isDeleted, 0)
          ))
          .get();

        if (existingAward) {
          c.executionCtx.waitUntil(logAuditAction(c, "award_duplicate_found", "awards", String(existingAward.id), `Award "${title}" (${year}) already exists`));
          return c.json({ success: true, id: String(existingAward.id) }, 200);
        }

        try {
          const res = await db.insert(schema.awards).values(values).returning({ insertId: schema.awards.id }).get();
          const newId = res && "insertId" in res ? String(res.insertId) : "new";
          c.executionCtx.waitUntil(logAuditAction(c, "award_created", "awards", newId, `Award "${title}" (${year}) created`));
          return c.json({ success: true, id: newId }, 200);
        } catch (insertError: unknown) {
          const duplicate = await db.select({ id: schema.awards.id })
            .from(schema.awards)
            .where(and(
              eq(schema.awards.title, title),
              eq(schema.awards.date, String(year)),
              eq(schema.awards.eventName, eventName || ""),
              eq(schema.awards.isDeleted, 0)
            ))
            .get();

          if (duplicate) {
            c.executionCtx.waitUntil(logAuditAction(c, "award_race_condition_handled", "awards", String(duplicate.id), `Award "${title}" (${year}) race condition - returned existing record`));
            return c.json({ success: true, id: String(duplicate.id) }, 200);
          }
          throw insertError;
        }
    })
    .openapi(deleteAwardRoute, async (c) => {
        const params = c.req.valid("param");
        const db = getDb(c);
        const numericId = Number(params.id);
        if (isNaN(numericId) || numericId <= 0) {
          throw new ApiError("Invalid award ID", 400, "BAD_REQUEST");
        }
        await db.update(schema.awards).set({ isDeleted: 1 }).where(eq(schema.awards.id, numericId)).run();
        c.executionCtx.waitUntil(logAuditAction(c, "award_deleted", "awards", params.id, "Award soft-deleted"));
        return c.json({ success: true }, 200);
    });

export default awardsRouter;
