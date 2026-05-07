/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAPI handler input validated by Zod schemas */
import { eq, desc } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import type { RouteHandler } from "@hono/zod-openapi";
import { getDb, type AppEnv } from "../../middleware";
import { SNIPPET_LENGTH, fetchVolunteerEvents } from "./utils";
import type { listOutreachRoute, adminListOutreachRoute } from "../../../../shared/routes/outreach";

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

    const combined = [...logs, ...volunteerEvents].sort((a: any, b: any) => b.date.localeCompare(a.date));
     
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

    const combined = [...logs, ...volunteerEvents].sort((a: any, b: any) => b.date.localeCompare(a.date));
     
    return c.json({ logs: combined as any[] }, 200);
  } catch (err) {
    console.error("[Outreach:AdminList] Error", err);
    return c.json({ error: "Failed to fetch outreach logs" }, 500);
  }
};
