import { OpenAPIHono } from "@hono/zod-openapi";

import { eq, and, sql } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { AppEnv, ensureAdmin, logAuditAction, getDb } from "../middleware";
import { edgeCacheMiddleware } from "../middleware/cache";
import { getAwardsRoute, saveAwardRoute, deleteAwardRoute } from "../../../shared/routes/awards";
import { ApiError } from "../middleware/errorHandler";
import { notDeleted } from "../../../src/db/query-helpers";

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
        // SAF-01: Standard query with raw SQL for IDs to handle malformed legacy string IDs
        // Using sql`CAST(id AS TEXT)` ensures that we don't crash if an unexpected string exists in the integer column
        const results = await db.select({
            id: sql<string>`CAST(${schema.awards.id} AS TEXT)`,
            title: schema.awards.title,
            eventName: schema.awards.eventName,
            date: schema.awards.date,
            description: schema.awards.description,
            iconType: schema.awards.iconType,
            seasonId: schema.awards.seasonId,
            createdAt: schema.awards.createdAt
        })
        .from(schema.awards)
        .where(notDeleted(schema.awards))
        .orderBy(sql`date DESC, title ASC`)
        .limit(limit || 100) // Increase default limit slightly for better management
        .offset(offset || 0)
        .all()
        .catch(err => {
            console.error("DATABASE_FETCH_ERROR: Awards retrieval failed", err);
            throw new ApiError("Failed to fetch awards from database", 500, "DATABASE_ERROR");
        });

        const awards = (results || []).map((record) => {
            // SAF-02: Resilience for malformed legacy data
            const rawYear = Number(record.date);
            const validYear = isNaN(rawYear) ? new Date().getFullYear() : rawYear;

            return {
                id: String(record.id || ""),
                title: String(record.title || "Untitled Achievement"),
                year: validYear,
                eventName: record.eventName ? String(record.eventName) : null,
                description: record.description ? String(record.description) : null,
                // SAF-03: Clean placeholder images for frontend rendering
                imageUrl: (record.iconType && record.iconType !== "trophy" && String(record.iconType).startsWith("http")) ? String(record.iconType) : null,
                seasonId: record.seasonId ? Number(record.seasonId) : null,
                createdAt: record.createdAt ? String(record.createdAt) : new Date().toISOString(),
                updatedAt: record.createdAt ? String(record.createdAt) : new Date().toISOString()
            };
        });

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
        };

        let finalId: string;

        if (id) {
            const numericId = Number(id);
            if (isNaN(numericId) || numericId <= 0) {
                throw new ApiError("Invalid award ID", 400, "BAD_REQUEST");
            }
            try {
                await db.update(schema.awards).set(values).where(eq(schema.awards.id, numericId)).run();
            } catch (_e) {
                // Fallback for legacy string IDs that might be in an integer column (SQLite quirk)
                await db.run(sql`UPDATE awards SET title = ${values.title}, date = ${values.date}, event_name = ${values.eventName}, description = ${values.description}, icon_type = ${values.iconType}, season_id = ${values.seasonId}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`);
            }
            finalId = String(id);
            c.executionCtx.waitUntil(logAuditAction(c, "award_updated", "awards", finalId, `Award "${title}" (${year}) updated`));
        } else {
            // Check for duplicate to prevent race conditions
            // During update, exclude the current record from the duplicate check
            const duplicateWhere = [
                eq(schema.awards.title, title),
                eq(schema.awards.date, String(year)),
                eq(schema.awards.eventName, eventName || ""),
                eq(schema.awards.isDeleted, 0)
            ];

            const existing = await db.select({ id: schema.awards.id })
                .from(schema.awards)
                .where(and(...duplicateWhere))
                .get();

            if (existing) {
                finalId = String(existing.id);
                c.executionCtx.waitUntil(logAuditAction(c, "award_duplicate_found", "awards", finalId, `Award "${title}" (${year}) already exists`));
                // If it's a new record that matches an existing one, just return the existing ID
            } else {
                try {
                    // Try atomic returning first
                    const res = await db.insert(schema.awards).values(values).returning({ id: schema.awards.id }).get();
                    finalId = String(res.id);
                } catch (_e) {
                    // Fallback for drivers that don't support returning (like some test mocks)
                    const res = await db.insert(schema.awards).values(values).run();
                    finalId = String(res.meta.last_row_id);
                }
                c.executionCtx.waitUntil(logAuditAction(c, "award_created", "awards", finalId, `Award "${title}" (${year}) created`));
            }
        }

        return c.json({ success: true, id: finalId }, 200);
    })
    .openapi(deleteAwardRoute, async (c) => {
        const params = c.req.valid("param");
        const db = getDb(c);
        
        const numericId = Number(params.id);
        if (!isNaN(numericId) && numericId > 0) {
            await db.update(schema.awards).set({ isDeleted: 1 }).where(eq(schema.awards.id, numericId)).run();
        } else {
            // Raw SQL fallback for malformed IDs (e.g. string IDs from legacy injections)
            await db.run(sql`UPDATE awards SET is_deleted = 1 WHERE id = ${params.id}`);
        }
        
        c.executionCtx.waitUntil(logAuditAction(c, "award_deleted", "awards", params.id, "Award soft-deleted"));
        return c.json({ success: true }, 200);
    });

export default awardsRouter;

