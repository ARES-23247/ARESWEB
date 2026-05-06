/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAPI handler input validated by Zod schemas */
import { Kysely } from "kysely";
import type { RouteHandler } from "@hono/zod-openapi";
import { DB } from "../../../../shared/schemas/database";
import { getSessionUser, logAuditAction } from "../../middleware";

import type {
  listOutreachRoute,
  adminListOutreachRoute,
  saveOutreachRoute,
  deleteOutreachRoute
} from "../../../../shared/routes/outreach";

const SNIPPET_LENGTH = 200;

async function fetchVolunteerEvents(db: Kysely<DB>, existingEventIds: string[]) {
  try {
    const results = await db.selectFrom("events")
      .select(["id", "title", "date_start as date", "location", "season_id"])
      .where("is_volunteer", "=", 1)
      .where("is_deleted", "=", 0)
      .where("status", "=", "published")
      .orderBy("date_start", "desc")
      .execute();
      
    const filteredResults = results.filter(r => !existingEventIds.includes(String(r.id)));
    
    return filteredResults.map((r) => ({
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
      is_dynamic: true,
      event_id: String(r.id)
    }));
  } catch {
    return [];
  }
}

export const handleListOutreach: RouteHandler<typeof listOutreachRoute> = async (c: any) => {
  try {
    const db = c.get("db") as Kysely<DB>;
    const results = await db.selectFrom("outreach_logs")
      .select([
        "id", "title", "date", "location",
        "hours as hours_logged", "people_reached as reach_count",
        "students_count", "impact_summary as description", "season_id",
        "is_mentoring", "mentored_team_number", "event_id",
        "mentor_count", "mentor_hours"
      ])
      .where("is_deleted", "=", 0)
      .orderBy("date", "desc")
      .execute();
    
    const existingEventIds = results.filter(r => r.event_id).map(r => String(r.event_id));
    const volunteerEvents = await fetchVolunteerEvents(db, existingEventIds);
    
    const logs = results.map(r => ({
      id: String(r.id),
      title: r.title,
      date: r.date,
      location: r.location || null,
      students_count: Number(r.students_count || 0),
      hours_logged: Number(r.hours_logged || 0),
      reach_count: Number(r.reach_count || 0),
      description: r.description ? (r.description.length > SNIPPET_LENGTH ? r.description.substring(0, SNIPPET_LENGTH) + "..." : r.description) : null,
      is_mentoring: !!r.is_mentoring,
      mentored_team_number: r.mentored_team_number || null,
      season_id: r.season_id ? Number(r.season_id) : null,
      is_dynamic: !!r.event_id,
      event_id: r.event_id || null,
      mentor_count: Number(r.mentor_count || 0),
      mentor_hours: Number(r.mentor_hours || 0)
    }));

    const combined = [...logs, ...volunteerEvents].sort(
      (a, b) => b.date.localeCompare(a.date)
    );

     
    return c.json({ logs: combined as any[] }, 200);
  } catch (err) {
    console.error("[Outreach:List] Error", err);
    return c.json({ error: "Failed to fetch outreach logs" }, 500);
  }
};

export const handleAdminListOutreach: RouteHandler<typeof adminListOutreachRoute> = async (c: any) => {
  try {
    const db = c.get("db") as Kysely<DB>;
    const results = await db.selectFrom("outreach_logs")
      .select([
        "id", "title", "date", "location",
        "hours as hours_logged", "people_reached as reach_count",
        "students_count", "impact_summary as description", "season_id",
        "is_mentoring", "mentored_team_number", "event_id",
        "mentor_count", "mentor_hours"
      ])
      .where("is_deleted", "=", 0)
      .orderBy("date", "desc")
      .execute();
    
    const existingEventIds = results.filter(r => r.event_id).map(r => String(r.event_id));
    const volunteerEvents = await fetchVolunteerEvents(db, existingEventIds);
    
    const logs = results.map(r => ({
      id: String(r.id),
      title: r.title,
      date: r.date,
      location: r.location || null,
      students_count: Number(r.students_count || 0),
      hours_logged: Number(r.hours_logged || 0),
      reach_count: Number(r.reach_count || 0),
      description: r.description ? (r.description.length > SNIPPET_LENGTH ? r.description.substring(0, SNIPPET_LENGTH) + "..." : r.description) : null,
      is_mentoring: !!r.is_mentoring,
      mentored_team_number: r.mentored_team_number || null,
      season_id: r.season_id ? Number(r.season_id) : null,
      is_dynamic: !!r.event_id,
      event_id: r.event_id || null,
      mentor_count: Number(r.mentor_count || 0),
      mentor_hours: Number(r.mentor_hours || 0)
    }));

    const combined = [...logs, ...volunteerEvents].sort(
      (a, b) => b.date.localeCompare(a.date)
    );

     
    return c.json({ logs: combined as any[] }, 200);
  } catch (err) {
    console.error("[Outreach:AdminList] Error", err);
    return c.json({ error: "Failed to fetch outreach logs" }, 500);
  }
};

export const handleSaveOutreach: RouteHandler<typeof saveOutreachRoute> = async (c: any) => {
  try {
    const body = c.req.valid("json");
    const db = c.get("db") as Kysely<DB>;
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const validatedData = body;
    let result: string | number;
    if (validatedData.id) {
      await db.updateTable("outreach_logs")
        .set({
          title: validatedData.title,
          date: validatedData.date,
          location: validatedData.location || null,
          hours: validatedData.hours_logged,
          people_reached: validatedData.reach_count,
          students_count: validatedData.students_count,
          impact_summary: validatedData.description || null,
          is_mentoring: validatedData.is_mentoring ? 1 : 0,
          mentored_team_number: validatedData.mentored_team_number || null,
          season_id: validatedData.season_id || null,
          event_id: validatedData.event_id || null,
          mentor_count: validatedData.mentor_count || 0,
          mentor_hours: validatedData.mentor_hours || 0,
        })
        .where("id", "=", Number(validatedData.id))
        .execute();
      result = validatedData.id;
    } else {
      const inserted = await db.insertInto("outreach_logs")
        .values({
          title: validatedData.title,
          date: validatedData.date,
          location: validatedData.location || null,
          hours: validatedData.hours_logged,
          people_reached: validatedData.reach_count,
          students_count: validatedData.students_count,
          impact_summary: validatedData.description || null,
          is_mentoring: validatedData.is_mentoring ? 1 : 0,
          mentored_team_number: validatedData.mentored_team_number || null,
          season_id: validatedData.season_id || null,
          event_id: validatedData.event_id || null,
          mentor_count: validatedData.mentor_count || 0,
          mentor_hours: validatedData.mentor_hours || 0,
        })
        .executeTakeFirst();
      result = inserted.insertId?.toString() || "new";
    }

    if (validatedData.id) {
      c.executionCtx.waitUntil(logAuditAction(c, "update_outreach", "outreach_logs", validatedData.id, `Updated outreach: ${validatedData.title}`));
      return c.json({ success: true, id: validatedData.id }, 200);
    } else {
      c.executionCtx.waitUntil(logAuditAction(c, "create_outreach", "outreach_logs", String(result), `Created outreach: ${validatedData.title}`));
      return c.json({ success: true, id: result }, 200);
    }
  } catch (err) {
    console.error("[Outreach:Save] Error", err);
    return c.json({ error: "Save failed" }, 500);
  }
};

export const handleDeleteOutreach: RouteHandler<typeof deleteOutreachRoute> = async (c: any) => {
  try {
    const { id } = c.req.valid("param");
    const db = c.get("db") as Kysely<DB>;
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    await db.updateTable("outreach_logs")
      .set({ is_deleted: 1 })
      .where("id", "=", Number(id))
      .execute();
    c.executionCtx.waitUntil(logAuditAction(c, "delete_outreach", "outreach_logs", id, "Outreach log soft-deleted"));
    return c.json({ success: true }, 200);
  } catch (err) {
    console.error("[Outreach:Delete] Error", err);
    return c.json({ error: "Delete failed" }, 500);
  }
};
