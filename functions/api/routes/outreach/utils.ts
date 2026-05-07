import { eq, and, desc } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import type { DrizzleDB } from "../../middleware";

export const SNIPPET_LENGTH = 200;

export async function fetchVolunteerEvents(db: DrizzleDB, existingEventIds: string[]) {
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
