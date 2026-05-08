import { eq, desc } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import type { RouteHandler } from "@hono/zod-openapi";
import { getDb, type AppEnv } from "../../middleware";
import { SNIPPET_LENGTH, fetchVolunteerEvents } from "./utils";
import type { listOutreachRoute, adminListOutreachRoute } from "../../../../shared/routes/outreach";

// Database query result type
interface OutreachQueryResult {
  id: number;
  title: string;
  date: string;
  location: string | null;
  hours_logged: number | null;
  reach_count: number | null;
  students_count: number | null;
  description: string | null;
  season_id: number | null;
  is_mentoring: number | null;
  mentored_team_number: number | null;
  event_id: string | null;
  mentor_count: number | null;
  mentor_hours: number | null;
}

// Combined log entry type (database + volunteer events)
interface OutreachLog {
  id: string;
  title: string;
  date: string;
  location: string | null;
  students_count: number;
  hours_logged: number;
  reach_count: number;
  description: string | null;
  is_mentoring: boolean;
  mentored_team_number: number | null;
  season_id: number | null;
  is_dynamic: boolean;
  event_id: string | null;
  mentor_count: number;
  mentor_hours: number;
}

export const handleListOutreach: RouteHandler<typeof listOutreachRoute, AppEnv> = async (c) => {
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
    .orderBy(desc(schema.outreachLogs.date))
    .all();
  
  const existingEventIds = results.filter((r: any) => r.event_id).map((r: any) => String(r.event_id));
  const volunteerEvents = await fetchVolunteerEvents(db, existingEventIds);
  
  const logs = results.map((r: any): OutreachLog => ({
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

  const combined = [...logs, ...volunteerEvents].sort((a, b) => b.date.localeCompare(a.date));

  return c.json({ logs: combined } as any, 200);
};

export const handleAdminListOutreach: RouteHandler<typeof adminListOutreachRoute, AppEnv> = async (c) => {
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
    .orderBy(desc(schema.outreachLogs.date))
    .all();
  
  const existingEventIds = results.filter((r: any) => r.event_id).map((r: any) => String(r.event_id));
  const volunteerEvents = await fetchVolunteerEvents(db, existingEventIds);
  
  const logs = results.map((r: any): OutreachLog => ({
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

  const combined = [...logs, ...volunteerEvents].sort((a, b) => b.date.localeCompare(a.date));

  return c.json({ logs: combined } as any, 200);
};
