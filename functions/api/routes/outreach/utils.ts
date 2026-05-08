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
  season_id: number | null;
}

/**
 * Mapped volunteer event for outreach display
 */
interface VolunteerEvent {
  id: string;
  title: string;
  date: string;
  location: string | null;
  students_count: number;
  hours_logged: number;
  reach_count: number;
  description: string;
  is_mentoring: boolean;
  mentored_team_number: null;
  season_id: number | null;
  is_dynamic: boolean;
  event_id: string;
}

export async function fetchVolunteerEvents(db: DrizzleDB, existingEventIds: string[]): Promise<VolunteerEvent[]> {
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
      .orderBy(desc(schema.events.dateStart))
      .all();
      
    const filteredResults = results.filter((r: VolunteerEventDbResult) => !existingEventIds.includes(String(r.id)));

    return filteredResults.map((r: VolunteerEventDbResult): VolunteerEvent => ({
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
  } catch (_error: unknown) {
    return [];
  }
}
