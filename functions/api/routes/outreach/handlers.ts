/* eslint-disable @typescript-eslint/no-explicit-any -- ts-rest handler input validated by contract library */
import { Kysely } from "kysely";
import { DB } from "../../../../shared/schemas/database";
import { getSessionUser, logAuditAction } from "../../middleware";
import { outreachSchema, OutreachPayload } from "../../../../shared/schemas/outreachSchema";
import { outreachContract } from "../../../../shared/schemas/contracts/outreachContract";
import { ServerInferRequest, HonoContext } from "../../../../shared/types/api";

// Description snippet length for list views (IN-07: use named constant instead of magic number)
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

export const outreachHandlers = {
  list: async (_input: ServerInferRequest<typeof outreachContract["list"]>, c: HonoContext) => {
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

      return { status: 200 as const, body: { logs: combined as OutreachPayload[] } };
    } catch (err) {
      console.error("[Outreach:List] Error", err);
      return { status: 500 as const, body: { error: "Failed to fetch outreach logs" } };
    }
  },
  adminList: async (_input: ServerInferRequest<typeof outreachContract["adminList"]>, c: HonoContext) => {
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

      return { status: 200 as const, body: { logs: combined as OutreachPayload[] } };
    } catch (err) {
      console.error("[Outreach:AdminList] Error", err);
      return { status: 500 as const, body: { error: "Failed to fetch outreach logs" } };
    }
  },
  save: async (input: ServerInferRequest<typeof outreachContract["save"]>, c: HonoContext) => {
    try {
      const { body } = input;
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } };

      // Validate input against schema before database insertion
      const validationResult = outreachSchema.safeParse(body);
      if (!validationResult.success) {
        return {
          status: 400 as const,
          body: {
            error: "Invalid outreach data: " + validationResult.error.issues.map(i => i.message).join(", ")
          }
        };
      }

      const validatedData = validationResult.data;
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
        return { status: 200 as const, body: { success: true, id: validatedData.id } };
      } else {
        c.executionCtx.waitUntil(logAuditAction(c, "create_outreach", "outreach_logs", String(result), `Created outreach: ${validatedData.title}`));
        return { status: 200 as const, body: { success: true, id: result } };
      }
    } catch (err) {
      console.error("[Outreach:Save] Error", err);
      return { status: 500 as const, body: { error: "Save failed" } };
    }
  },
  delete: async (input: ServerInferRequest<typeof outreachContract["delete"]>, c: HonoContext) => {
    try {
      const { params } = input;
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } };

      await db.updateTable("outreach_logs")
        .set({ is_deleted: 1 })
        .where("id", "=", params.id )
        .execute();
      c.executionCtx.waitUntil(logAuditAction(c, "delete_outreach", "outreach_logs", params.id, "Outreach log soft-deleted"));
      return { status: 200 as const, body: { success: true } };
    } catch (err) {
      console.error("[Outreach:Delete] Error", err);
      return { status: 500 as const, body: { error: "Delete failed" } };
    }
  },
};

