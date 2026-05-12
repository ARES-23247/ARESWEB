import { desc } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import type { RouteHandler } from "@hono/zod-openapi";
import { getDb, type AppEnv, typedJson } from "../../middleware";
import { SNIPPET_LENGTH, fetchVolunteerEvents } from "./utils";
import type { listOutreachRoute, adminListOutreachRoute } from "../../../../shared/routes/outreach";
import { list, notDeleted } from "../../../../src/db/query-helpers";
import type { DrizzleDB } from "../../../../src/db/types";

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

// Drizzle inferred row type for outreachLogs
type OutreachRow = typeof schema.outreachLogs.$inferSelect;

/** Shared: query, map, and merge outreach logs with volunteer events. */
async function fetchCombinedOutreachLogs(db: DrizzleDB): Promise<OutreachLog[]> {
  const results = await list(db, schema.outreachLogs, {
    where: notDeleted(schema.outreachLogs),
    orderBy: desc(schema.outreachLogs.date),
    useAll: true
  });

  const rows = results as OutreachRow[];

  const existingEventIds = rows
    .filter((r) => r.eventId !== null)
    .map((r) => String(r.eventId));
  const volunteerEvents = await fetchVolunteerEvents(db, existingEventIds);

  const logs: OutreachLog[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    date: r.date,
    location: r.location,
    studentsCount: Number(r.studentsCount || 0),
    hours: Number(r.hours || 0),
    peopleReached: Number(r.peopleReached || 0),
    impactSummary: r.impactSummary ? (r.impactSummary.length > SNIPPET_LENGTH ? r.impactSummary.substring(0, SNIPPET_LENGTH) + "..." : r.impactSummary) : null,
    isMentoring: r.isMentoring || 0,
    mentoredTeamNumber: r.mentoredTeamNumber,
    seasonId: r.seasonId,
    eventId: r.eventId,
    mentorCount: Number(r.mentorCount || 0),
    mentorHours: Number(r.mentorHours || 0)
  }));

  return [...logs, ...volunteerEvents].sort((a, b) => b.date.localeCompare(a.date));
}

export const handleListOutreach: RouteHandler<typeof listOutreachRoute, AppEnv> = async (c) => {
  const db = getDb(c);
  const combined = await fetchCombinedOutreachLogs(db);
  return typedJson(c, { logs: combined }, 200);
};

export const handleAdminListOutreach: RouteHandler<typeof adminListOutreachRoute, AppEnv> = async (c) => {
  const db = getDb(c);
  const combined = await fetchCombinedOutreachLogs(db);
  return typedJson(c, { logs: combined }, 200);
};
