import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import { AppEnv, ensureAdmin, logAuditAction, rateLimitMiddleware } from "../middleware";
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

type AppRouteHandler<T extends RouteConfig> = RouteHandler<T, AppEnv>;

export const seasonsRouter = new OpenAPIHono<AppEnv>();

// Apply caching to public routes
seasonsRouter.use("/", edgeCacheMiddleware(300, 60));
seasonsRouter.use("/:year", edgeCacheMiddleware(300, 60));

// Apply admin protection and rate limiting to admin routes
seasonsRouter.use("/admin/*", ensureAdmin);
seasonsRouter.use("/admin/*", rateLimitMiddleware(15, 60));

seasonsRouter.openapi(listSeasonsRoute, (async (c) => {
  try {
    const db = c.get("db");
    const results = await db
      .selectFrom("seasons")
      .select([
        "start_year",
        "end_year",
        "challenge_name",
        "robot_name",
        "robot_image",
        "robot_description",
        "robot_cad_url",
        "summary",
        "album_url",
        "album_cover",
        "status",
        "is_deleted",
      ])
      .where("is_deleted", "=", 0)
      .where("status", "=", "published")
      .orderBy("start_year", "desc")
      .execute();

    const seasons = results.map((r: any) => ({
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
}) as AppRouteHandler<typeof listSeasonsRoute>);

seasonsRouter.openapi(adminListSeasonsRoute, (async (c) => {
  try {
    const db = c.get("db");
    const results = await db
      .selectFrom("seasons")
      .select([
        "start_year",
        "end_year",
        "challenge_name",
        "robot_name",
        "robot_image",
        "robot_description",
        "robot_cad_url",
        "summary",
        "album_url",
        "album_cover",
        "status",
        "is_deleted",
      ])
      .orderBy("start_year", "desc")
      .execute();

    const seasons = results.map((r: any) => ({
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
}) as AppRouteHandler<typeof adminListSeasonsRoute>);

seasonsRouter.openapi(adminDetailSeasonRoute, (async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = c.get("db");
    const year = parseInt(id);
    const row = await db
      .selectFrom("seasons")
      .select([
        "start_year",
        "end_year",
        "challenge_name",
        "robot_name",
        "robot_image",
        "robot_description",
        "robot_cad_url",
        "summary",
        "album_url",
        "album_cover",
        "status",
        "is_deleted",
      ])
      .where("start_year", "=", year)
      .executeTakeFirst();

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
}) as AppRouteHandler<typeof adminDetailSeasonRoute>);

seasonsRouter.openapi(getSeasonDetailRoute, (async (c) => {
  try {
    const { year } = c.req.valid("param");
    const db = c.get("db");
    const yearNum = parseInt(year);
    if (isNaN(yearNum)) return c.json({ error: "Invalid year" }, 404);

    const [seasonRow, awards, events, posts, outreach] = await Promise.all([
      db
        .selectFrom("seasons")
        .select([
          "start_year",
          "end_year",
          "challenge_name",
          "robot_name",
          "robot_image",
          "robot_description",
          "robot_cad_url",
          "summary",
          "album_url",
          "album_cover",
          "status",
          "is_deleted",
        ])
        .where("start_year", "=", yearNum)
        .executeTakeFirst(),
      db
        .selectFrom("awards")
        .select(["id", "title", "event_name", "date", "season_id", "is_deleted"])
        .where("season_id", "=", yearNum)
        .where("is_deleted", "=", 0)
        .execute(),
      db
        .selectFrom("events")
        .select([
          "id",
          "title",
          "category",
          "date_start",
          "date_end",
          "location",
          "cover_image",
          "status",
          "is_deleted",
          "season_id",
        ])
        .where("season_id", "=", yearNum)
        .where("is_deleted", "=", 0)
        .where("status", "=", "published")
        .execute(),
      db
        .selectFrom("posts")
        .select([
          "slug",
          "title",
          "snippet",
          "thumbnail",
          "status",
          "is_deleted",
          "season_id",
          "date",
        ])
        .where("season_id", "=", yearNum)
        .where("is_deleted", "=", 0)
        .where("status", "=", "published")
        .execute(),
      db
        .selectFrom("outreach_logs")
        .select([
          "id",
          "title",
          "date",
          "location",
          "hours",
          "students_count",
          "people_reached",
          "impact_summary",
          "season_id",
          "is_deleted",
        ])
        .where("season_id", "=", yearNum)
        .where("is_deleted", "=", 0)
        .execute(),
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
}) as AppRouteHandler<typeof getSeasonDetailRoute>);

seasonsRouter.openapi(saveSeasonRoute, (async (c) => {
  try {
    const body = c.req.valid("json");
    const db = c.get("db");

    // Type assertion for the body
    const seasonData = body;

    const targetYear = seasonData.original_year || seasonData.start_year;

    if (seasonData.original_year && seasonData.original_year !== seasonData.start_year) {
      const collision = await db
        .selectFrom("seasons")
        .select("start_year")
        .where("start_year", "=", seasonData.start_year)
        .executeTakeFirst();
      if (collision) {
        return c.json({ error: `Season ${seasonData.start_year} already exists.` }, 500);
      }
    }

    const existing = await db
      .selectFrom("seasons")
      .select("start_year")
      .where("start_year", "=", targetYear)
      .executeTakeFirst();

    const values = {
      start_year: seasonData.start_year,
      end_year: seasonData.end_year,
      challenge_name: seasonData.challenge_name,
      robot_name: seasonData.robot_name || null,
      robot_image: seasonData.robot_image || null,
      robot_description: seasonData.robot_description || null,
      robot_cad_url: seasonData.robot_cad_url || null,
      summary: seasonData.summary || null,
      album_url: seasonData.album_url || null,
      album_cover: seasonData.album_cover || null,
      status: seasonData.status || "draft",
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await db
        .updateTable("seasons")
        .set(values)
        .where("start_year", "=", targetYear)
        .execute();

      if (seasonData.original_year && seasonData.original_year !== seasonData.start_year) {
        const oldId = targetYear;
        const newId = seasonData.start_year;
        await db.updateTable("events").set({ season_id: newId }).where("season_id", "=", oldId).execute();
        await db.updateTable("posts").set({ season_id: newId }).where("season_id", "=", oldId).execute();
        await db.updateTable("awards").set({ season_id: newId }).where("season_id", "=", oldId).execute();
        await db.updateTable("outreach_logs").set({ season_id: newId }).where("season_id", "=", oldId).execute();

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
      await db.insertInto("seasons").values({ ...values, is_deleted: 0 }).execute();
      c.executionCtx.waitUntil(
        logAuditAction(c, "season_created", "seasons", seasonData.start_year.toString(), `Season "${seasonData.start_year}" created`)
      );
    }
    triggerBackgroundReindex(c.executionCtx, c.get("db"), c.env.AI, c.env.VECTORIZE_DB);
    return c.json({ success: true }, 200);
  } catch (e) {
    console.error("[Seasons:Save] Error", e);
    return c.json({ error: "Save failed" }, 500);
  }
}) as AppRouteHandler<typeof saveSeasonRoute>);

seasonsRouter.openapi(deleteSeasonRoute, (async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = c.get("db");
    const year = parseInt(id);
    await db
      .updateTable("seasons")
      .set({ is_deleted: 1 })
      .where("start_year", "=", year)
      .execute();
    c.executionCtx.waitUntil(logAuditAction(c, "season_deleted", "seasons", id, `Season "${id}" soft-deleted`));

    triggerBackgroundReindex(c.executionCtx, c.get("db"), c.env.AI, c.env.VECTORIZE_DB);
    return c.json({ success: true }, 200);
  } catch (e) {
    console.error("[Seasons:Delete] Error", e);
    return c.json({ error: "Delete failed" }, 500);
  }
}) as AppRouteHandler<typeof deleteSeasonRoute>);

seasonsRouter.openapi(undeleteSeasonRoute, (async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = c.get("db");
    const year = parseInt(id);
    await db
      .updateTable("seasons")
      .set({ is_deleted: 0 })
      .where("start_year", "=", year)
      .execute();
    c.executionCtx.waitUntil(logAuditAction(c, "season_restored", "seasons", id, `Season "${id}" restored`));
    return c.json({ success: true }, 200);
  } catch (e) {
    console.error("[Seasons:Undelete] Error", e);
    return c.json({ error: "Restore failed" }, 500);
  }
}) as AppRouteHandler<typeof undeleteSeasonRoute>);

seasonsRouter.openapi(purgeSeasonRoute, (async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = c.get("db");
    const year = parseInt(id);
    await db
      .deleteFrom("seasons")
      .where("start_year", "=", year)
      .execute();
    c.executionCtx.waitUntil(logAuditAction(c, "season_purged", "seasons", id, `Season "${id}" permanently deleted`));
    return c.json({ success: true }, 200);
  } catch (e) {
    console.error("[Seasons:Purge] Error", e);
    return c.json({ error: "Purge failed" }, 500);
  }
}) as AppRouteHandler<typeof purgeSeasonRoute>);

export default seasonsRouter;
