import { typedHandler } from "../utils/handler";
/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAPI handler input validated by Zod schemas */
import { OpenAPIHono } from "@hono/zod-openapi";
import { eq, desc, and } from "drizzle-orm";
import * as schema from "../../../src/db/schema";

import { AppEnv, ensureAdmin, logAuditAction, rateLimitMiddleware, getDb } from "../middleware";
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

export const seasonsRouter = new OpenAPIHono<AppEnv>();

// Apply caching to public routes
seasonsRouter.use("/", edgeCacheMiddleware(180, 60, 300));
seasonsRouter.use("/:year", edgeCacheMiddleware(180, 60, 300));

// Apply admin protection and rate limiting to admin routes
seasonsRouter.use("/admin/*", ensureAdmin);
seasonsRouter.use("/admin/*", rateLimitMiddleware(15, 60));

seasonsRouter.openapi(listSeasonsRoute, typedHandler<typeof listSeasonsRoute>(async (c) => {
  try {
    const db = getDb(c);
    const results = await db
      .select({
        start_year: schema.seasons.startYear,
        end_year: schema.seasons.endYear,
        challenge_name: schema.seasons.challengeName,
        robot_name: schema.seasons.robotName,
        robot_image: schema.seasons.robotImage,
        robot_description: schema.seasons.robotDescription,
        robot_cad_url: schema.seasons.robotCadUrl,
        summary: schema.seasons.summary,
        album_url: schema.seasons.albumUrl,
        album_cover: schema.seasons.albumCover,
        status: schema.seasons.status,
        is_deleted: schema.seasons.isDeleted,
      })
      .from(schema.seasons)
      .where(
        and(
          eq(schema.seasons.isDeleted, 0),
          eq(schema.seasons.status, "published")
        )
      )
      .orderBy(desc(schema.seasons.startYear))
      .all();

    const seasons = results.map((r) => ({
      ...r,
      start_year: Number(r.start_year),
      end_year: Number(r.end_year || Number(r.start_year) + 1),
      is_deleted: Number(r.is_deleted || 0),
      status: r.status as string | null | undefined,
    }));

    return c.json({ seasons }, 200);
  } catch (e) {
    console.error("[Seasons:List] Error", e);
    return c.json({ error: "Failed to fetch seasons" }, 500);
  }
}));

seasonsRouter.openapi(adminListSeasonsRoute, typedHandler<typeof adminListSeasonsRoute>(async (c) => {
  try {
    const db = getDb(c);
    const results = await db
      .select({
        start_year: schema.seasons.startYear,
        end_year: schema.seasons.endYear,
        challenge_name: schema.seasons.challengeName,
        robot_name: schema.seasons.robotName,
        robot_image: schema.seasons.robotImage,
        robot_description: schema.seasons.robotDescription,
        robot_cad_url: schema.seasons.robotCadUrl,
        summary: schema.seasons.summary,
        album_url: schema.seasons.albumUrl,
        album_cover: schema.seasons.albumCover,
        status: schema.seasons.status,
        is_deleted: schema.seasons.isDeleted,
      })
      .from(schema.seasons)
      .orderBy(desc(schema.seasons.startYear))
      .all();

    const seasons = results.map((r) => ({
      ...r,
      start_year: Number(r.start_year),
      end_year: Number(r.end_year || Number(r.start_year) + 1),
      is_deleted: Number(r.is_deleted || 0),
      status: r.status as string | null | undefined,
    }));

    return c.json({ seasons }, 200);
  } catch (e) {
    console.error("[Seasons:AdminList] Error", e);
    return c.json({ error: "Failed to list seasons" }, 500);
  }
}));

seasonsRouter.openapi(adminDetailSeasonRoute, typedHandler<typeof adminDetailSeasonRoute>(async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = getDb(c);
    const year = parseInt(id);
    const row = await db
      .select({
        start_year: schema.seasons.startYear,
        end_year: schema.seasons.endYear,
        challenge_name: schema.seasons.challengeName,
        robot_name: schema.seasons.robotName,
        robot_image: schema.seasons.robotImage,
        robot_description: schema.seasons.robotDescription,
        robot_cad_url: schema.seasons.robotCadUrl,
        summary: schema.seasons.summary,
        album_url: schema.seasons.albumUrl,
        album_cover: schema.seasons.albumCover,
        status: schema.seasons.status,
        is_deleted: schema.seasons.isDeleted,
      })
      .from(schema.seasons)
      .where(eq(schema.seasons.startYear, year))
      .get();

    if (!row) return c.json({ error: "Season not found" }, 404);

    return c.json(
      {
        season: {
          ...row,
          start_year: Number(row.start_year),
          end_year: Number(row.end_year || Number(row.start_year) + 1),
          is_deleted: Number(row.is_deleted || 0),
          status: row.status as string | null | undefined,
        },
      },
      200
    );
  } catch (e) {
    console.error("[Seasons:AdminDetail] Error", e);
    return c.json({ error: "Failed to fetch season" }, 500);
  }
}));

seasonsRouter.openapi(getSeasonDetailRoute, typedHandler<typeof getSeasonDetailRoute>(async (c) => {
  try {
    const { year } = c.req.valid("param");
    const db = getDb(c);
    const yearNum = parseInt(year);
    if (isNaN(yearNum)) return c.json({ error: "Invalid year" }, 404);

    const [seasonRow, awards, events, posts, outreach] = await Promise.all([
      db
        .select({
          start_year: schema.seasons.startYear,
          end_year: schema.seasons.endYear,
          challenge_name: schema.seasons.challengeName,
          robot_name: schema.seasons.robotName,
          robot_image: schema.seasons.robotImage,
          robot_description: schema.seasons.robotDescription,
          robot_cad_url: schema.seasons.robotCadUrl,
          summary: schema.seasons.summary,
          album_url: schema.seasons.albumUrl,
          album_cover: schema.seasons.albumCover,
          status: schema.seasons.status,
          is_deleted: schema.seasons.isDeleted,
        })
        .from(schema.seasons)
        .where(eq(schema.seasons.startYear, yearNum))
        .get(),
      db
        .select({
          id: schema.awards.id,
          title: schema.awards.title,
          event_name: schema.awards.eventName,
          date: schema.awards.date,
          season_id: schema.awards.seasonId,
          is_deleted: schema.awards.isDeleted
        })
        .from(schema.awards)
        .where(
          and(
            eq(schema.awards.seasonId, yearNum),
            eq(schema.awards.isDeleted, 0)
          )
        )
        .all(),
      db
        .select({
          id: schema.events.id,
          title: schema.events.title,
          category: schema.events.category,
          date_start: schema.events.dateStart,
          date_end: schema.events.dateEnd,
          location: schema.events.location,
          cover_image: schema.events.coverImage,
          status: schema.events.status,
          is_deleted: schema.events.isDeleted,
          season_id: schema.events.seasonId,
        })
        .from(schema.events)
        .where(
          and(
            eq(schema.events.seasonId, yearNum),
            eq(schema.events.isDeleted, 0),
            eq(schema.events.status, "published")
          )
        )
        .all(),
      db
        .select({
          slug: schema.posts.slug,
          title: schema.posts.title,
          snippet: schema.posts.snippet,
          thumbnail: schema.posts.thumbnail,
          status: schema.posts.status,
          is_deleted: schema.posts.isDeleted,
          season_id: schema.posts.seasonId,
          date: schema.posts.date,
        })
        .from(schema.posts)
        .where(
          and(
            eq(schema.posts.seasonId, yearNum),
            eq(schema.posts.isDeleted, 0),
            eq(schema.posts.status, "published")
          )
        )
        .all(),
      db
        .select({
          id: schema.outreachLogs.id,
          title: schema.outreachLogs.title,
          date: schema.outreachLogs.date,
          location: schema.outreachLogs.location,
          hours: schema.outreachLogs.hours,
          students_count: schema.outreachLogs.studentsCount,
          people_reached: schema.outreachLogs.peopleReached,
          impact_summary: schema.outreachLogs.impactSummary,
          season_id: schema.outreachLogs.seasonId,
          is_deleted: schema.outreachLogs.isDeleted,
        })
        .from(schema.outreachLogs)
        .where(
          and(
            eq(schema.outreachLogs.seasonId, yearNum),
            eq(schema.outreachLogs.isDeleted, 0)
          )
        )
        .all(),
    ]);

    if (!seasonRow) return c.json({ error: "Season not found" }, 404);

    return c.json(
      {
        season: {
          ...seasonRow,
          start_year: Number(seasonRow.start_year),
          end_year: Number(seasonRow.end_year || Number(seasonRow.start_year) + 1),
          is_deleted: Number(seasonRow.is_deleted || 0),
          status: seasonRow.status as string | null | undefined,
        },
        awards,
        events,
        posts,
        outreach,
      },
      200
    );
  } catch (e) {
    console.error("[Seasons:Detail] Error", e);
    return c.json({ error: "Failed to fetch season details" }, 500);
  }
}));

seasonsRouter.openapi(saveSeasonRoute, typedHandler<typeof saveSeasonRoute>(async (c) => {
  try {
    const body = c.req.valid("json");
    const db = getDb(c);

    const seasonData = body;
    const targetYear = seasonData.original_year || seasonData.start_year;

    if (seasonData.original_year && seasonData.original_year !== seasonData.start_year) {
      const collision = await db
        .select({ start_year: schema.seasons.startYear })
        .from(schema.seasons)
        .where(eq(schema.seasons.startYear, seasonData.start_year))
        .get();
      if (collision) {
        return c.json({ error: `Season ${seasonData.start_year} already exists.` }, 500);
      }
    }

    const existing = await db
      .select({ start_year: schema.seasons.startYear })
      .from(schema.seasons)
      .where(eq(schema.seasons.startYear, targetYear))
      .get();

    const values = {
      startYear: seasonData.start_year,
      endYear: seasonData.end_year,
      challengeName: seasonData.challenge_name,
      robotName: seasonData.robot_name || null,
      robotImage: seasonData.robot_image || null,
      robotDescription: seasonData.robot_description || null,
      robotCadUrl: seasonData.robot_cad_url || null,
      summary: seasonData.summary || null,
      albumUrl: seasonData.album_url || null,
      albumCover: seasonData.album_cover || null,
      status: seasonData.status || "draft",
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await db
        .update(schema.seasons)
        .set(values)
        .where(eq(schema.seasons.startYear, targetYear));

      if (seasonData.original_year && seasonData.original_year !== seasonData.start_year) {
        const oldId = targetYear;
        const newId = seasonData.start_year;
        await db.update(schema.events).set({ seasonId: newId }).where(eq(schema.events.seasonId, oldId));
        await db.update(schema.posts).set({ seasonId: newId }).where(eq(schema.posts.seasonId, oldId));
        await db.update(schema.awards).set({ seasonId: newId }).where(eq(schema.awards.seasonId, oldId));
        await db.update(schema.outreachLogs).set({ seasonId: newId }).where(eq(schema.outreachLogs.seasonId, oldId));

        c.executionCtx.waitUntil(
          logAuditAction(
            c,
            "season_year_updated",
            "seasons",
            seasonData.start_year.toString(),
            `Season ID changed from ${targetYear} to ${seasonData.start_year}`
          )
        );
      } else {
        c.executionCtx.waitUntil(
          logAuditAction(c, "season_updated", "seasons", seasonData.start_year.toString(), `Season "${seasonData.start_year}" updated`)
        );
      }
    } else {
      await db.insert(schema.seasons).values({ ...values, isDeleted: 0 });
      c.executionCtx.waitUntil(
        logAuditAction(c, "season_created", "seasons", seasonData.start_year.toString(), `Season "${seasonData.start_year}" created`)
      );
    }
    triggerBackgroundReindex(c.executionCtx, db, c.env.AI, c.env.VECTORIZE_DB);
    return c.json({ success: true }, 200);
  } catch (e) {
    console.error("[Seasons:Save] Error", e);
    return c.json({ error: "Save failed" }, 500);
  }
}));

seasonsRouter.openapi(deleteSeasonRoute, typedHandler<typeof deleteSeasonRoute>(async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = getDb(c);
    const year = parseInt(id);
    await db
      .update(schema.seasons)
      .set({ isDeleted: 1 })
      .where(eq(schema.seasons.startYear, year));
    c.executionCtx.waitUntil(logAuditAction(c, "season_deleted", "seasons", id, `Season "${id}" soft-deleted`));

    triggerBackgroundReindex(c.executionCtx, db, c.env.AI, c.env.VECTORIZE_DB);
    return c.json({ success: true }, 200);
  } catch (e) {
    console.error("[Seasons:Delete] Error", e);
    return c.json({ error: "Delete failed" }, 500);
  }
}));

seasonsRouter.openapi(undeleteSeasonRoute, typedHandler<typeof undeleteSeasonRoute>(async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = getDb(c);
    const year = parseInt(id);
    await db
      .update(schema.seasons)
      .set({ isDeleted: 0 })
      .where(eq(schema.seasons.startYear, year));
    c.executionCtx.waitUntil(logAuditAction(c, "season_restored", "seasons", id, `Season "${id}" restored`));
    return c.json({ success: true }, 200);
  } catch (e) {
    console.error("[Seasons:Undelete] Error", e);
    return c.json({ error: "Restore failed" }, 500);
  }
}));

seasonsRouter.openapi(purgeSeasonRoute, typedHandler<typeof purgeSeasonRoute>(async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = getDb(c);
    const year = parseInt(id);
    await db
      .delete(schema.seasons)
      .where(eq(schema.seasons.startYear, year));
    c.executionCtx.waitUntil(logAuditAction(c, "season_purged", "seasons", id, `Season "${id}" permanently deleted`));
    return c.json({ success: true }, 200);
  } catch (e) {
    console.error("[Seasons:Purge] Error", e);
    return c.json({ error: "Purge failed" }, 500);
  }
}));

export default seasonsRouter;
