import { ApiError } from "../middleware/errorHandler";
import { OpenAPIHono } from "@hono/zod-openapi";
import { eq, desc, and } from "drizzle-orm";
import * as schema from "../../../src/db/schema";

import { AppEnv, ensureAdmin, logAuditAction, getDb } from "../middleware";
import { triggerBackgroundReindex } from "./ai/autoReindex";
import {
  listSeasonsRoute,
  adminListSeasonsRoute,
  adminDetailSeasonRoute,
  getSeasonDetailRoute,
  saveSeasonRoute,
  deleteSeasonRoute,
  undeleteSeasonRoute,
  purgeSeasonRoute,
} from "../../../shared/routes/seasons";
import { edgeCacheMiddleware } from "../middleware/cache";
import { list, notDeleted } from "../../../src/db/query-helpers";

const _seasonsRouter = new OpenAPIHono<AppEnv>();

// Apply edge caching to public GET routes (non-admin, non-signups)
_seasonsRouter.use("*", async (c, next) => {
  const path = c.req.path;
  if (c.req.method !== "GET" || path.includes("/admin/") || path.includes("/signups") || path.includes("/history")) {
    return next();
  }
  return edgeCacheMiddleware(180, 60, 300)(c, next);
});

// Apply admin protection and rate limiting to admin routes
_seasonsRouter.use("/admin/*", ensureAdmin);

export const seasonsRouter = _seasonsRouter
    .openapi(listSeasonsRoute, async (c) => {
      const db = getDb(c);
      const results = await list(db, schema.seasons, {
        where: and(
          notDeleted(schema.seasons),
          eq(schema.seasons.status, "published")
        ),
        orderBy: desc(schema.seasons.startYear),
        useAll: true
      });

      const seasons = results.map((r) => ({
        ...r,
        startYear: Number(r.startYear),
        endYear: Number(r.endYear ?? Number(r.startYear) + 1),
        isDeleted: Number(r.isDeleted ?? 0),
        status: r.status as string | null | undefined,
        createdAt: r.createdAt as string,
        updatedAt: r.updatedAt as string,
      }));

      // Response boundary: Drizzle return type diverges from Zod schema
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.json({ seasons } as any, 200);
    })
    .openapi(adminListSeasonsRoute, async (c) => {
      const db = getDb(c);
      const results = await list(db, schema.seasons, {
        orderBy: desc(schema.seasons.startYear),
        useAll: true
      });

      const seasons = results.map((r) => ({
        ...r,
        startYear: Number(r.startYear),
        endYear: Number(r.endYear ?? Number(r.startYear) + 1),
        isDeleted: Number(r.isDeleted ?? 0),
        status: r.status as string | null | undefined,
        createdAt: r.createdAt as string,
        updatedAt: r.updatedAt as string,
      }));

      // Response boundary: Drizzle return type diverges from Zod schema
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.json({ seasons } as any, 200);
    })
    .openapi(adminDetailSeasonRoute, async (c) => {
      const params = c.req.valid("param");
      const { id } = params;
      const db = getDb(c);
      const year = parseInt(id, 10);
      const row = await db
        .select()
        .from(schema.seasons)
        .where(eq(schema.seasons.startYear, year))
        .get();

      if (!row) {
        throw new ApiError("Season", 404, "NOT_FOUND");
      }

      const season = {
        ...row,
        startYear: Number(row.startYear),
        endYear: Number(row.endYear ?? Number(row.startYear) + 1),
        isDeleted: Number(row.isDeleted ?? 0),
        status: row.status as string | null | undefined,
        createdAt: row.createdAt as string,
        updatedAt: row.updatedAt as string,
      };

      // Response boundary: Drizzle return type diverges from Zod schema
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.json({ season } as any, 200);
    })
    .openapi(getSeasonDetailRoute, async (c) => {
      const params = c.req.valid("param");
      const { year } = params;
      const db = getDb(c);
      const yearNum = parseInt(year, 10);
      if (Number.isNaN(yearNum)) {
        throw new ApiError("Season", 404, "NOT_FOUND");
      }

      const [seasonRow, awards, events, posts, outreach] = await Promise.all([
        db
          .select()
          .from(schema.seasons)
          .where(eq(schema.seasons.startYear, yearNum))
          .get(),
        list(db, schema.awards, {
          select: {
            id: schema.awards.id,
            title: schema.awards.title,
            eventName: schema.awards.eventName,
            date: schema.awards.date,
            seasonId: schema.awards.seasonId,
            isDeleted: schema.awards.isDeleted
          },
          where: and(
            eq(schema.awards.seasonId, yearNum),
            notDeleted(schema.awards)
          ),
          useAll: true
        }),
        list(db, schema.events, {
          select: {
            id: schema.events.id,
            title: schema.events.title,
            category: schema.events.category,
            dateStart: schema.events.dateStart,
            dateEnd: schema.events.dateEnd,
            location: schema.events.location,
            coverImage: schema.events.coverImage,
            status: schema.events.status,
            isDeleted: schema.events.isDeleted,
            seasonId: schema.events.seasonId,
          },
          where: and(
            eq(schema.events.seasonId, yearNum),
            notDeleted(schema.events),
            eq(schema.events.status, "published")
          ),
          useAll: true
        }),
        list(db, schema.posts, {
          select: {
            slug: schema.posts.slug,
            title: schema.posts.title,
            snippet: schema.posts.snippet,
            thumbnail: schema.posts.thumbnail,
            status: schema.posts.status,
            isDeleted: schema.posts.isDeleted,
            seasonId: schema.posts.seasonId,
            date: schema.posts.date,
          },
          where: and(
            eq(schema.posts.seasonId, yearNum),
            notDeleted(schema.posts),
            eq(schema.posts.status, "published")
          ),
          useAll: true
        }),
        list(db, schema.outreachLogs, {
          select: {
            id: schema.outreachLogs.id,
            title: schema.outreachLogs.title,
            date: schema.outreachLogs.date,
            location: schema.outreachLogs.location,
            hours: schema.outreachLogs.hours,
            studentsCount: schema.outreachLogs.studentsCount,
            peopleReached: schema.outreachLogs.peopleReached,
            impactSummary: schema.outreachLogs.impactSummary,
            seasonId: schema.outreachLogs.seasonId,
            isDeleted: schema.outreachLogs.isDeleted,
          },
          where: and(
            eq(schema.outreachLogs.seasonId, yearNum),
            notDeleted(schema.outreachLogs)
          ),
          useAll: true
        }),
      ]);

      if (!seasonRow) {
        throw new ApiError("Season", 404, "NOT_FOUND");
      }

      const season = {
        ...seasonRow,
        startYear: Number(seasonRow.startYear),
        endYear: Number(seasonRow.endYear ?? Number(seasonRow.startYear) + 1),
        isDeleted: Number(seasonRow.isDeleted ?? 0),
        status: seasonRow.status as string | null | undefined,
        createdAt: seasonRow.createdAt as string,
        updatedAt: seasonRow.updatedAt as string,
      };

      // Response boundary: Drizzle return type diverges from Zod schema
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.json({ season, awards, events, posts, outreach } as any, 200);
    })
    .openapi(saveSeasonRoute, async (c) => {
      const body = c.req.valid("json");
      const db = getDb(c);
      const targetYear = body.originalYear ?? body.startYear;

      if (body.originalYear && body.originalYear !== body.startYear) {
        const collision = await db
          .select({ startYear: schema.seasons.startYear })
          .from(schema.seasons)
          .where(eq(schema.seasons.startYear, body.startYear))
          .get();
        if (collision) {
          throw new ApiError(`Season ${body.startYear} already exists.`, 409);
        }
      }

      const existing = await db
        .select({ startYear: schema.seasons.startYear })
        .from(schema.seasons)
        .where(eq(schema.seasons.startYear, targetYear))
        .get();

      const values = {
        startYear: body.startYear,
        endYear: body.endYear,
        challengeName: body.challengeName,
        robotName: body.robotName ?? null,
        robotImage: body.robotImage ?? null,
        robotDescription: body.robotDescription ?? null,
        robotCadUrl: body.robotCadUrl ?? null,
        summary: body.summary ?? null,
        albumUrl: body.albumUrl ?? null,
        albumCover: body.albumCover ?? null,
        status: body.status ?? "draft",
        updatedAt: new Date().toISOString(),
      };

      if (existing) {
        await db
          .update(schema.seasons)
          .set(values)
          .where(eq(schema.seasons.startYear, targetYear))
          .run();

        if (body.originalYear && body.originalYear !== body.startYear) {
          const oldId = targetYear;
          const newId = body.startYear;
          await db.update(schema.events).set({ seasonId: newId }).where(eq(schema.events.seasonId, oldId)).run();
          await db.update(schema.posts).set({ seasonId: newId }).where(eq(schema.posts.seasonId, oldId)).run();
          await db.update(schema.awards).set({ seasonId: newId }).where(eq(schema.awards.seasonId, oldId)).run();
          await db.update(schema.outreachLogs).set({ seasonId: newId }).where(eq(schema.outreachLogs.seasonId, oldId)).run();

          c.executionCtx.waitUntil(
            logAuditAction(
              c,
              "season_year_updated",
              "seasons",
              body.startYear.toString(),
              `Season ID changed from ${targetYear} to ${body.startYear}`
            )
          );
        } else {
          c.executionCtx.waitUntil(
            logAuditAction(c, "season_updated", "seasons", body.startYear.toString(), `Season "${body.startYear}" updated`)
          );
        }
      } else {
        await db.insert(schema.seasons).values({ ...values, isDeleted: 0 }).run();
        c.executionCtx.waitUntil(
          logAuditAction(c, "season_created", "seasons", body.startYear.toString(), `Season "${body.startYear}" created`)
        );
      }
      triggerBackgroundReindex(c.executionCtx, db, c.env.AI, c.env.VECTORIZE_DB);
      return c.json({ success: true }, 200);
    })
    .openapi(deleteSeasonRoute, async (c) => {
      const params = c.req.valid("param");
      const { id } = params;
      const db = getDb(c);
      const year = parseInt(id, 10);
      await db
        .update(schema.seasons)
        .set({ isDeleted: 1 })
        .where(eq(schema.seasons.startYear, year));
      c.executionCtx.waitUntil(logAuditAction(c, "season_deleted", "seasons", id, `Season "${id}" soft-deleted`));

      triggerBackgroundReindex(c.executionCtx, db, c.env.AI, c.env.VECTORIZE_DB);
      return c.json({ success: true }, 200);
    })
    .openapi(undeleteSeasonRoute, async (c) => {
      const params = c.req.valid("param");
      const { id } = params;
      const db = getDb(c);
      const year = parseInt(id, 10);
      await db
        .update(schema.seasons)
        .set({ isDeleted: 0 })
        .where(eq(schema.seasons.startYear, year));
      c.executionCtx.waitUntil(logAuditAction(c, "season_restored", "seasons", id, `Season "${id}" restored`));
      return c.json({ success: true }, 200);
    })
    .openapi(purgeSeasonRoute, async (c) => {
      const params = c.req.valid("param");
      const { id } = params;
      const db = getDb(c);
      const year = parseInt(id, 10);
      await db
        .delete(schema.seasons)
        .where(eq(schema.seasons.startYear, year));
      c.executionCtx.waitUntil(logAuditAction(c, "season_purged", "seasons", id, `Season "${id}" permanently deleted`));
      return c.json({ success: true }, 200);
    });
export default seasonsRouter;
