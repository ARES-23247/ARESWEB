import { eq, and, desc } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import type { DrizzleDB } from "../../middleware";

export const SNIPPET_LENGTH = 200;

/**
 * Raw database result from volunteer events query
 */
interface VolunteerEventDbResult {
  id: string;
  title: string;
  date: string;
  location: string | null;
  seasonId: number | null;
}

/**
 * Mapped volunteer event for outreach display
 */
interface VolunteerEvent {
  id: string | number;
  title: string;
  date: string;
  location: string | null;
  studentsCount: number;
  hours: number;
  peopleReached: number;
  impactSummary: string;
  isMentoring: number;
  mentoredTeamNumber: string | null;
  seasonId: number | null;
  isDynamic: boolean;
  eventId: string;
  mentorCount: number;
  mentorHours: number;
}

export async function fetchVolunteerEvents(db: DrizzleDB, existingEventIds: string[]): Promise<VolunteerEvent[]> {
  try {
    const results = await db.select({
      id: schema.events.id,
      title: schema.events.title,
      date: schema.events.dateStart,
      location: schema.events.location,
      seasonId: schema.events.seasonId,
    }).from(schema.events)
      .where(
        and(
          eq(schema.events.isVolunteer, 1),
          eq(schema.events.isDeleted, 0),
          eq(schema.events.status, "published")
        )
      )
      .orderBy(desc(schema.events.dateStart))
      .all();
      
    const filteredResults = results.filter((r: VolunteerEventDbResult) => !existingEventIds.includes(String(r.id)));

    return filteredResults.map((r: VolunteerEventDbResult): VolunteerEvent => ({
      id: r.id,
      title: r.title,
      date: r.date,
      location: r.location || null,
      studentsCount: 0,
      hours: 0,
      peopleReached: 0,
      impactSummary: "Volunteer Event (Synced)",
      isMentoring: 0,
      mentoredTeamNumber: null,
      seasonId: r.seasonId ? Number(r.seasonId) : null,
      isDynamic: true,
      eventId: String(r.id),
      mentorCount: 0,
      mentorHours: 0
    }));
  } catch (_error: unknown) {
    return [];
  }
}

