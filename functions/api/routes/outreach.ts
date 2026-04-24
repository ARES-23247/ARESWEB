import { Hono } from "hono";
import { Kysely } from "kysely";
import { DB } from "../../../src/schemas/database";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { outreachContract } from "../../../src/schemas/contracts/outreachContract";
import { AppEnv, ensureAdmin, logAuditAction, rateLimitMiddleware } from "../middleware";

const s = initServer<AppEnv>();
export const outreachRouter = new Hono<AppEnv>();

// SCA-F01: Synchronize volunteer events as outreach records
async function fetchVolunteerEvents(db: Kysely<DB>) {
  try {
    const results = await db.selectFrom("events")
      .select(["id", "title", "date_start as date", "location", "season_id"])
      .where("is_volunteer", "=", 1)
      .where("is_deleted", "=", 0)
      .where("status", "=", "published")
      .orderBy("date_start", "desc")
      .execute();
    
    return results.map((r) => ({
      id: r.id,
      title: r.title,
      date: r.date,
      location: r.location || null,
      students_count: 0,
      hours_logged: 0,
      reach_count: 0,
      description: "Volunteer Event (Synced)",
      season_id: r.season_id ? Number(r.season_id) : null,
      is_dynamic: true
    }));
  } catch (_err) {
    return [];
  }
}
const outreachTsRestRouter: any = s.router(outreachContract as any, {
    list: async (_: any, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const results = await db.selectFrom("outreach_logs")
        .select([
          "id", "title", "date", "location", 
          "hours as hours_logged", "people_reached as reach_count", 
          "students_count", "impact_summary as description", "season_id"
        ])
        .where("is_deleted", "=", 0)
        .orderBy("date", "desc")
        .execute();
      
      const volunteerEvents = await fetchVolunteerEvents(db);
      
      const logs = results.map(r => ({
        id: String(r.id),
        title: r.title,
        date: r.date,
        location: r.location || null,
        students_count: Number(r.students_count || 0),
        hours_logged: Number(r.hours_logged || 0),
        reach_count: Number(r.reach_count || 0),
        description: r.description || null,
        season_id: r.season_id ? Number(r.season_id) : null,
        is_dynamic: false
      }));

      const combined = [...logs, ...volunteerEvents].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      return { status: 200 as const, body: { logs: combined } };
    } catch (_err) {
      return { status: 500 as const, body: { error: "Failed to fetch outreach logs" } };
    }
  },
    adminList: async (_: any, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const results = await db.selectFrom("outreach_logs")
        .select([
          "id", "title", "date", "location", 
          "hours as hours_logged", "people_reached as reach_count", 
          "students_count", "impact_summary as description", "season_id"
        ])
        .where("is_deleted", "=", 0)
        .orderBy("date", "desc")
        .execute();
      
      const volunteerEvents = await fetchVolunteerEvents(db);
      
      const logs = results.map(r => ({
        id: String(r.id),
        title: r.title,
        date: r.date,
        location: r.location || null,
        students_count: Number(r.students_count || 0),
        hours_logged: Number(r.hours_logged || 0),
        reach_count: Number(r.reach_count || 0),
        description: r.description || null,
        season_id: r.season_id ? Number(r.season_id) : null,
        is_dynamic: false
      }));

      const combined = [...logs, ...volunteerEvents].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      return { status: 200 as const, body: { logs: combined } };
    } catch (_err) {
      return { status: 500 as const, body: { error: "Failed to fetch outreach logs" } };
    }
  },
    save: async ({ body }: { body: any }, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      if (body.id) {
        await db.updateTable("outreach_logs")
          .set({
            title: body.title,
            date: body.date,
            location: body.location,
            hours: body.hours_logged,
            people_reached: body.reach_count,
            students_count: body.students_count,
            impact_summary: body.description,
            season_id: body.season_id,
          })
          .where("id", "=", body.id as any)
          .execute();
        c.executionCtx.waitUntil(logAuditAction(c, "update_outreach", "outreach_logs", body.id, `Updated outreach: ${body.title}`));
        return { status: 200 as const, body: { success: true, id: body.id } };
      } else {
        const id = crypto.randomUUID();
        await db.insertInto("outreach_logs")
          .values({
            id: id as any, 
            title: body.title,
            date: body.date,
            location: body.location,
            hours: body.hours_logged,
            people_reached: body.reach_count,
            students_count: body.students_count,
            impact_summary: body.description,
            season_id: body.season_id,
          })
          .execute();
        c.executionCtx.waitUntil(logAuditAction(c, "create_outreach", "outreach_logs", id, `Created outreach: ${body.title}`));
        return { status: 200 as const, body: { success: true, id } };
      }
    } catch (_err) {
      return { status: 500 as const, body: { error: "Save failed" } };
    }
  },
    delete: async ({ params }: { params: any }, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      await db.updateTable("outreach_logs")
        .set({ is_deleted: 1 })
        .where("id", "=", params.id as any)
        .execute();
      c.executionCtx.waitUntil(logAuditAction(c, "delete_outreach", "outreach_logs", params.id, "Outreach log soft-deleted"));
      return { status: 200 as const, body: { success: true } };
    } catch (_err) {
      return { status: 500 as const, body: { error: "Delete failed" } };
    }
  },
} as any);



// Middlewares
outreachRouter.use("/admin", ensureAdmin);
outreachRouter.use("/admin/*", ensureAdmin);
outreachRouter.use("/admin", rateLimitMiddleware(15, 60));


createHonoEndpoints(outreachContract, outreachTsRestRouter, outreachRouter);

export default outreachRouter;
