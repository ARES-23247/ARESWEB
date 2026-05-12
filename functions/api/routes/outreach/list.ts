import { eq, desc } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import type { RouteHandler } from "@hono/zod-openapi";
import { getDb, type AppEnv } from "../../middleware";
import { SNIPPET_LENGTH, fetchVolunteerEvents } from "./utils";
import type { listOutreachRoute, adminListOutreachRoute } from "../../../../shared/routes/outreach";

type OutreachQueryResult = {
  id: number;
  title: string;
  date: string;
  location: string | null;
  hours: number | null;
  peopleReached: number | null;
  studentsCount: number | null;
  impactSummary: string | null;
  seasonId: number | null;
  isMentoring: number | null;
  mentoredTeamNumber: string | null;
  eventId: string | null;
  mentorCount: number | null;
  mentorHours: number | null;
};

// Combined log entry type (database + volunteer events)
interface OutreachLog {
  id: string | number;
  title: string;
  date: string;
  location: string | null;
  studentsCount: number;
  hours: number;
  peopleReached: number;
  impactSummary: string | null;
  isMentoring: number;
  mentoredTeamNumber: string | null;
  seasonId: number | null;
  isDynamic?: boolean;
  eventId: string | null;
  mentorCount: number;
  mentorHours: number;
}

export const handleListOutreach: RouteHandler<typeof listOutreachRoute, AppEnv> = async (c) => {
  const db = getDb(c);
  const results = await db.select({
      id: schema.outreachLogs.id,
      title: schema.outreachLogs.title,
      date: schema.outreachLogs.date,
      location: schema.outreachLogs.location,
      hours: schema.outreachLogs.hours,
      peopleReached: schema.outreachLogs.peopleReached,
      studentsCount: schema.outreachLogs.studentsCount,
      impactSummary: schema.outreachLogs.impactSummary,
      seasonId: schema.outreachLogs.seasonId,
      isMentoring: schema.outreachLogs.isMentoring,
      mentoredTeamNumber: schema.outreachLogs.mentoredTeamNumber,
      eventId: schema.outreachLogs.eventId,
      mentorCount: schema.outreachLogs.mentorCount,
      mentorHours: schema.outreachLogs.mentorHours,
  }).from(schema.outreachLogs)
    .where(eq(schema.outreachLogs.isDeleted, 0))
    .orderBy(desc(schema.outreachLogs.date))
    .all();

  const existingEventIds = results
    .filter((r: OutreachQueryResult) => r.eventId !== null)
    .map((r: OutreachQueryResult) => String(r.eventId));
  const volunteerEvents = await fetchVolunteerEvents(db, existingEventIds);

  const logs = results.map((r: OutreachQueryResult): OutreachLog => ({
    id: r.id,
    title: r.title,
    date: r.date,
    location: r.location || null,
    studentsCount: Number(r.studentsCount || 0),
    hours: Number(r.hours || 0),
    peopleReached: Number(r.peopleReached || 0),
    impactSummary: r.impactSummary ? (r.impactSummary.length > SNIPPET_LENGTH ? r.impactSummary.substring(0, SNIPPET_LENGTH) + "..." : r.impactSummary) : null,
    isMentoring: r.isMentoring || 0,
    mentoredTeamNumber: r.mentoredTeamNumber || null,
    seasonId: r.seasonId ? Number(r.seasonId) : null,
    eventId: r.eventId || null,
    mentorCount: Number(r.mentorCount || 0),
    mentorHours: Number(r.mentorHours || 0)
  }));

  const combined = [...logs, ...volunteerEvents].sort((a, b) => b.date.localeCompare(a.date));

  // Response boundary: Drizzle return type matches Zod schema
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return c.json({ logs: combined } as any, 200);
};

export const handleAdminListOutreach: RouteHandler<typeof adminListOutreachRoute, AppEnv> = async (c) => {
  const db = getDb(c);
  const results = await db.select({
      id: schema.outreachLogs.id,
      title: schema.outreachLogs.title,
      date: schema.outreachLogs.date,
      location: schema.outreachLogs.location,
      hours: schema.outreachLogs.hours,
      peopleReached: schema.outreachLogs.peopleReached,
      studentsCount: schema.outreachLogs.studentsCount,
      impactSummary: schema.outreachLogs.impactSummary,
      seasonId: schema.outreachLogs.seasonId,
      isMentoring: schema.outreachLogs.isMentoring,
      mentoredTeamNumber: schema.outreachLogs.mentoredTeamNumber,
      eventId: schema.outreachLogs.eventId,
      mentorCount: schema.outreachLogs.mentorCount,
      mentorHours: schema.outreachLogs.mentorHours,
  }).from(schema.outreachLogs)
    .where(eq(schema.outreachLogs.isDeleted, 0))
    .orderBy(desc(schema.outreachLogs.date))
    .all();

  const existingEventIds = results
    .filter((r: OutreachQueryResult) => r.eventId !== null)
    .map((r: OutreachQueryResult) => String(r.eventId));
  const volunteerEvents = await fetchVolunteerEvents(db, existingEventIds);

  const logs = results.map((r: OutreachQueryResult): OutreachLog => ({
    id: r.id,
    title: r.title,
    date: r.date,
    location: r.location || null,
    studentsCount: Number(r.studentsCount || 0),
    hours: Number(r.hours || 0),
    peopleReached: Number(r.peopleReached || 0),
    impactSummary: r.impactSummary ? (r.impactSummary.length > SNIPPET_LENGTH ? r.impactSummary.substring(0, SNIPPET_LENGTH) + "..." : r.impactSummary) : null,
    isMentoring: r.isMentoring || 0,
    mentoredTeamNumber: r.mentoredTeamNumber || null,
    seasonId: r.seasonId ? Number(r.seasonId) : null,
    eventId: r.eventId || null,
    mentorCount: Number(r.mentorCount || 0),
    mentorHours: Number(r.mentorHours || 0)
  }));

  const combined = [...logs, ...volunteerEvents].sort((a, b) => b.date.localeCompare(a.date));

  // Response boundary: Drizzle return type matches Zod schema
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return c.json({ logs: combined } as any, 200);
};

