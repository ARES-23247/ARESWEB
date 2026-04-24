import { Hono } from "hono";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { seasonContract as seasonsContract } from "../../../src/schemas/contracts/seasonContract";
import { AppEnv, ensureAdmin, logAuditAction, rateLimitMiddleware } from "../middleware";
import { Kysely } from "kysely";
import { DB } from "../../../src/schemas/database";

const s = initServer<AppEnv>();
const seasonsRouter = new Hono<AppEnv>();

// @ts-expect-error - ts-rest-hono inference quirk with complex AppEnv
const seasonsTsRestRouter = s.router(seasonsContract, {
  list: async (_: any, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const results = await db.selectFrom("seasons")
        .selectAll()
        .where("is_deleted", "=", 0)
        .where("status", "=", "published")
        .orderBy("start_year", "desc")
        .execute();
      
      const seasons = results.map(r => ({
        ...r,
        start_year: Number(r.start_year),
        end_year: Number(r.end_year || r.start_year + 1),
        is_deleted: Number(r.is_deleted || 0),
        status: r.status as "published" | "draft"
      }));

      return { status: 200, body: { seasons: seasons as any[] } };
    } catch (_err) {
      return { status: 500, body: { error: "Failed to fetch seasons" } };
    }
  },
  adminList: async (_: any, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const results = await db.selectFrom("seasons")
        .selectAll()
        .orderBy("start_year", "desc")
        .execute();

      const seasons = results.map(r => ({
        ...r,
        start_year: Number(r.start_year),
        end_year: Number(r.end_year || r.start_year + 1),
        is_deleted: Number(r.is_deleted || 0),
        status: r.status as "published" | "draft"
      }));

      return { status: 200, body: { seasons: seasons as any[] } };
    } catch (_err) {
      return { status: 500, body: { error: "Failed to list seasons" } };
    }
  },
  adminDetail: async ({ params }: { params: any }, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const year = parseInt(params.id);
      const row = await db.selectFrom("seasons")
        .selectAll()
        .where("start_year", "=", year)
        .executeTakeFirst();

      if (!row) return { status: 404, body: { error: "Season not found" } };
      
      return { 
        status: 200, 
        body: { 
          season: {
            ...row,
            start_year: Number(row.start_year),
            end_year: Number(row.end_year || row.start_year + 1),
            is_deleted: Number(row.is_deleted || 0),
            status: row.status as "published" | "draft"
          }
        } as any
      };
    } catch (_err) {
      return { status: 500, body: { error: "Failed to fetch season" } };
    }
  },
  getDetail: async ({ params }: { params: any }, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const year = parseInt(params.year);
      if (isNaN(year)) return { status: 404, body: { error: "Invalid year" } };

      const [seasonRow, awards, events, posts, outreach] = await Promise.all([
        db.selectFrom("seasons").selectAll().where("start_year", "=", year).executeTakeFirst(),
        db.selectFrom("awards").selectAll().where("season_id", "=", Number(year) as any).execute(),
        db.selectFrom("events").selectAll().where("season_id", "=", Number(year) as any).where("is_deleted", "=", 0).execute(),
        db.selectFrom("posts").selectAll().where("season_id", "=", Number(year) as any).where("is_deleted", "=", 0).execute(),
        db.selectFrom("outreach_logs").selectAll().where("season_id", "=", Number(year) as any).execute(),
      ]);

      if (!seasonRow) return { status: 404, body: { error: "Season not found" } };

      return {
        status: 200,
        body: {
          season: {
            ...seasonRow,
            start_year: Number(seasonRow.start_year),
            end_year: Number(seasonRow.end_year || seasonRow.start_year + 1),
            is_deleted: Number(seasonRow.is_deleted || 0),
            status: seasonRow.status as "published" | "draft"
          },
          awards: awards as any[],
          events: events as any[],
          posts: posts as any[],
          outreach: outreach as any[],
        } as any
      };
    } catch (_err) {
      return { status: 500, body: { error: "Failed to fetch season details" } };
    }
  },
  save: async ({ body }: { body: any }, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const existing = await db.selectFrom("seasons")
        .select("start_year")
        .where("start_year", "=", body.start_year)
        .executeTakeFirst();

      const values = {
        start_year: body.start_year,
        end_year: body.end_year,
        challenge_name: body.challenge_name,
        robot_name: body.robot_name || null,
        robot_image: body.robot_image || null,
        robot_description: body.robot_description || null,
        robot_cad_url: body.robot_cad_url || null,
        summary: body.summary || null,
        album_url: body.album_url || null,
        album_cover: body.album_cover || null,
        status: body.status,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await db.updateTable("seasons")
          .set(values)
          .where("start_year", "=", body.start_year)
          .execute();
        c.executionCtx.waitUntil(logAuditAction(c, "season_updated", "seasons", body.start_year.toString(), `Season "${body.start_year}" updated`));
      } else {
        await db.insertInto("seasons")
          .values({ ...values, is_deleted: 0 })
          .execute();
        c.executionCtx.waitUntil(logAuditAction(c, "season_created", "seasons", body.start_year.toString(), `Season "${body.start_year}" created`));
      }
      return { status: 200, body: { success: true } };
    } catch (_err) {
      return { status: 500, body: { error: "Save failed" } };
    }
  },
  delete: async ({ params }: { params: any }, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const year = parseInt(params.id);
      await db.updateTable("seasons")
        .set({ is_deleted: 1 })
        .where("start_year", "=", year)
        .execute();
      c.executionCtx.waitUntil(logAuditAction(c, "season_deleted", "seasons", params.id, `Season "${params.id}" soft-deleted`));
      return { status: 200, body: { success: true } };
    } catch (_err) {
      return { status: 500, body: { error: "Delete failed" } };
    }
  },
  undelete: async ({ params }: { params: any }, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const year = parseInt(params.id);
      await db.updateTable("seasons")
        .set({ is_deleted: 0 })
        .where("start_year", "=", year)
        .execute();
      c.executionCtx.waitUntil(logAuditAction(c, "season_restored", "seasons", params.id, `Season "${params.id}" restored`));
      return { status: 200, body: { success: true } };
    } catch (_err) {
      return { status: 500, body: { error: "Restore failed" } };
    }
  },
  purge: async ({ params }: { params: any }, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const year = parseInt(params.id);
      await db.deleteFrom("seasons")
        .where("start_year", "=", year)
        .execute();
      c.executionCtx.waitUntil(logAuditAction(c, "season_purged", "seasons", params.id, `Season "${params.id}" permanently deleted`));
      return { status: 200, body: { success: true } };
    } catch (_err) {
      return { status: 500, body: { error: "Purge failed" } };
    }
  },
});

seasonsRouter.use("/admin", ensureAdmin);
seasonsRouter.use("/admin/*", ensureAdmin);
seasonsRouter.use("/admin", rateLimitMiddleware(15, 60));

createHonoEndpoints(seasonsContract, seasonsTsRestRouter, seasonsRouter);

export { seasonsRouter };
export default seasonsRouter;
