/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAPI handler input validated by Zod schemas */
import { eq, and, desc } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import type { RouteHandler } from "@hono/zod-openapi";
import { getSessionUser, logAuditAction, getDb } from "../../middleware";

import type {
  listOutreachRoute,
  adminListOutreachRoute,
  saveOutreachRoute,
  deleteOutreachRoute
} from "../../../../shared/routes/outreach";

const SNIPPET_LENGTH = 200;

async function fetchVolunteerEvents(db: any, existingEventIds: string[]) {
  try {
    const results = await db.select({
      id: schema.events.id,
      title: schema.events.title,
      date: schema.events.dateStart,
      location: schema.events.location,
      season_id: schema.events.seasonId,
    }).from(schema.events)
      .where(
        and(
          eq(schema.events.isVolunteer, 1),
          eq(schema.events.isDeleted, 0),
          eq(schema.events.status, "published")
        )
      )
      .orderBy(desc(schema.events.dateStart));
      
    const filteredResults = results.filter((r: any) => !existingEventIds.includes(String(r.id)));
    
    return filteredResults.map((r: any) => ({
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

export const handleListOutreach: RouteHandler<typeof listOutreachRoute, AppEnv> = async (c) => {
  try {
    const db = getDb(c);
    const results = await db.select({
        id: schema.outreachLogs.id,
        title: schema.outreachLogs.title,
        date: schema.outreachLogs.date,
        location: schema.outreachLogs.location,
        hours_logged: schema.outreachLogs.hours,
        reach_count: schema.outreachLogs.peopleReached,
        students_count: schema.outreachLogs.studentsCount,
        description: schema.outreachLogs.impactSummary,
        season_id: schema.outreachLogs.seasonId,
        is_mentoring: schema.outreachLogs.isMentoring,
        mentored_team_number: schema.outreachLogs.mentoredTeamNumber,
        event_id: schema.outreachLogs.eventId,
        mentor_count: schema.outreachLogs.mentorCount,
        mentor_hours: schema.outreachLogs.mentorHours,
    }).from(schema.outreachLogs)
      .where(eq(schema.outreachLogs.isDeleted, 0))
      .orderBy(desc(schema.outreachLogs.date));
    
    const existingEventIds = results.filter((r: any) => r.event_id).map((r: any) => String(r.event_id));
    const volunteerEvents = await fetchVolunteerEvents(db, existingEventIds);
    
    const logs = results.map((r: any) => ({
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

    const combined = [...logs, ...volunteerEvents].sort((a: any, b: any) => b.date.localeCompare(a.date)
    );

     
    return c.json({ logs: combined as any[] }, 200);
  } catch (err) {
    console.error("[Outreach:List] Error", err);
    return c.json({ error: "Failed to fetch outreach logs" }, 500);
  }
};

export const handleAdminListOutreach: RouteHandler<typeof adminListOutreachRoute, AppEnv> = async (c) => {
  try {
    const db = getDb(c);
    const results = await db.select({
        id: schema.outreachLogs.id,
        title: schema.outreachLogs.title,
        date: schema.outreachLogs.date,
        location: schema.outreachLogs.location,
        hours_logged: schema.outreachLogs.hours,
        reach_count: schema.outreachLogs.peopleReached,
        students_count: schema.outreachLogs.studentsCount,
        description: schema.outreachLogs.impactSummary,
        season_id: schema.outreachLogs.seasonId,
        is_mentoring: schema.outreachLogs.isMentoring,
        mentored_team_number: schema.outreachLogs.mentoredTeamNumber,
        event_id: schema.outreachLogs.eventId,
        mentor_count: schema.outreachLogs.mentorCount,
        mentor_hours: schema.outreachLogs.mentorHours,
    }).from(schema.outreachLogs)
      .where(eq(schema.outreachLogs.isDeleted, 0))
      .orderBy(desc(schema.outreachLogs.date));
    
    const existingEventIds = results.filter((r: any) => r.event_id).map((r: any) => String(r.event_id));
    const volunteerEvents = await fetchVolunteerEvents(db, existingEventIds);
    
    const logs = results.map((r: any) => ({
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

    const combined = [...logs, ...volunteerEvents].sort((a: any, b: any) => b.date.localeCompare(a.date)
    );

     
    return c.json({ logs: combined as any[] }, 200);
  } catch (err) {
    console.error("[Outreach:AdminList] Error", err);
    return c.json({ error: "Failed to fetch outreach logs" }, 500);
  }
};

export const handleSaveOutreach: RouteHandler<typeof saveOutreachRoute, AppEnv> = async (c) => {
  try {
    const body = c.req.valid("json");
    const db = getDb(c);
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const validatedData = body;
    let result: string | number;
    if (validatedData.id) {
      await db.update(schema.outreachLogs)
        .set({
          title: validatedData.title,
          date: validatedData.date,
          location: validatedData.location || null,
          hours: validatedData.hours_logged,
          peopleReached: validatedData.reach_count,
          studentsCount: validatedData.students_count,
          impactSummary: validatedData.description || null,
          isMentoring: validatedData.is_mentoring ? 1 : 0,
          mentoredTeamNumber: validatedData.mentored_team_number || null,
          seasonId: validatedData.season_id || null,
          eventId: validatedData.event_id || null,
          mentorCount: validatedData.mentor_count || 0,
          mentorHours: validatedData.mentor_hours || 0,
        })
        .where(eq(schema.outreachLogs.id, Number(validatedData.id)))
        .run();
      result = validatedData.id;
    } else {
      const inserted = await db.insert(schema.outreachLogs)
        .values({
          title: validatedData.title,
          date: validatedData.date,
          location: validatedData.location || null,
          hours: validatedData.hours_logged,
          peopleReached: validatedData.reach_count,
          studentsCount: validatedData.students_count,
          impactSummary: validatedData.description || null,
          isMentoring: validatedData.is_mentoring ? 1 : 0,
          mentoredTeamNumber: validatedData.mentored_team_number || null,
          seasonId: validatedData.season_id || null,
          eventId: validatedData.event_id || null,
          mentorCount: validatedData.mentor_count || 0,
          mentorHours: validatedData.mentor_hours || 0,
        })
        .returning({ id: schema.outreachLogs.id });
      result = inserted[0]?.id?.toString() || "new";
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

export const handleDeleteOutreach: RouteHandler<typeof deleteOutreachRoute, AppEnv> = async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = getDb(c);
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    await db.update(schema.outreachLogs)
      .set({ isDeleted: 1 })
      .where(eq(schema.outreachLogs.id, Number(id)))
      .run();
    c.executionCtx.waitUntil(logAuditAction(c, "delete_outreach", "outreach_logs", id, "Outreach log soft-deleted"));
    return c.json({ success: true }, 200);
  } catch (err) {
    console.error("[Outreach:Delete] Error", err);
    return c.json({ error: "Delete failed" }, 500);
  }
};
