
import { Kysely } from "kysely";
import { DB } from "../../../../shared/schemas/database";

import { AppEnv, getSessionUser, logAuditAction } from "../../middleware";

import { initServer } from "ts-rest-hono";

const _s = initServer<AppEnv>();

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
      id: String(r.id),
      title: r.title,
      date: r.date,
      location: r.location || null,
      students_count: 0,
      hours_logged: 0,
      reach_count: 0,
      description: "Volunteer Event (Synced)",
      is_mentoring: false,
      mentored_team_number: null,
      season_id: r.season_id ? Number(r.season_id) : null,
      is_dynamic: true
    }));
  } catch {
    return [];
  }
}

export const outreachHandlers: any = {
  list: async (_input: any, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const results = await db.selectFrom("outreach_logs")
        .select([
          "id", "title", "date", "location", 
          "hours as hours_logged", "people_reached as reach_count", 
          "students_count", "impact_summary as description", "season_id",
          "is_mentoring", "mentored_team_number"
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
        description: r.description ? (r.description.length > 200 ? r.description.substring(0, 200) + "..." : r.description) : null,
        is_mentoring: !!r.is_mentoring,
        mentored_team_number: r.mentored_team_number || null,
        season_id: r.season_id ? Number(r.season_id) : null,
        is_dynamic: false
      }));

      const combined = [...logs, ...volunteerEvents].sort(
        (a, b) => b.date.localeCompare(a.date)
      );

      return { status: 200 as const, body: { logs: combined as any } };
    } catch (err) {
      console.error("[Outreach:List] Error", err);
      return { status: 500 as const, body: { error: "Failed to fetch outreach logs" } };
    }
  },
  adminList: async (_input: any, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const results = await db.selectFrom("outreach_logs")
        .select([
          "id", "title", "date", "location", 
          "hours as hours_logged", "people_reached as reach_count", 
          "students_count", "impact_summary as description", "season_id",
          "is_mentoring", "mentored_team_number"
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
        description: r.description ? (r.description.length > 200 ? r.description.substring(0, 200) + "..." : r.description) : null,
        is_mentoring: !!r.is_mentoring,
        mentored_team_number: r.mentored_team_number || null,
        season_id: r.season_id ? Number(r.season_id) : null,
        is_dynamic: false
      }));

      const combined = [...logs, ...volunteerEvents].sort(
        (a, b) => b.date.localeCompare(a.date)
      );

      return { status: 200 as const, body: { logs: combined as any } };
    } catch (err) {
      console.error("[Outreach:AdminList] Error", err);
      return { status: 500 as const, body: { error: "Failed to fetch outreach logs" } };
    }
  },
  save: async (input: any, c: any) => {
    try {
      const { body } = input;
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } };

      let result: string | number;
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
            is_mentoring: body.is_mentoring ? 1 : 0,
            mentored_team_number: body.mentored_team_number,
            season_id: body.season_id,
          })
          .where("id", "=", body.id as any)
          .execute();
        result = body.id;
      } else {
        const inserted = await db.insertInto("outreach_logs")
          .values({
            title: body.title,
            date: body.date,
            location: body.location,
            hours: body.hours_logged,
            people_reached: body.reach_count,
            students_count: body.students_count,
            impact_summary: body.description,
            is_mentoring: body.is_mentoring ? 1 : 0,
            mentored_team_number: body.mentored_team_number,
            season_id: body.season_id,
          })
          .executeTakeFirst();
        result = inserted.insertId?.toString() || "new";
      }

      if (body.id) {
        c.executionCtx.waitUntil(logAuditAction(c, "update_outreach", "outreach_logs", body.id, `Updated outreach: ${body.title}`));
        return { status: 200 as const, body: { success: true, id: body.id } };
      } else {
        c.executionCtx.waitUntil(logAuditAction(c, "create_outreach", "outreach_logs", String(result), `Created outreach: ${body.title}`));
        return { status: 200 as const, body: { success: true, id: result } };
      }
    } catch (err) {
      console.error("[Outreach:Save] Error", err);
      return { status: 500 as const, body: { error: "Save failed" } };
    }
  },
  delete: async (input: any, c: any) => {
    try {
      const { params } = input;
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } };

      await db.updateTable("outreach_logs")
        .set({ is_deleted: 1 })
        .where("id", "=", params.id as any)
        .execute();
      c.executionCtx.waitUntil(logAuditAction(c, "delete_outreach", "outreach_logs", params.id, "Outreach log soft-deleted"));
      return { status: 200 as const, body: { success: true } };
    } catch (err) {
      console.error("[Outreach:Delete] Error", err);
      return { status: 500 as const, body: { error: "Delete failed" } };
    }
  },
};
