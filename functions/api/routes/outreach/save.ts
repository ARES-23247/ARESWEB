import { eq } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import type { RouteHandler } from "@hono/zod-openapi";
import { getSessionUser, logAuditAction, getDb, type AppEnv } from "../../middleware";
import type { saveOutreachRoute } from "../../../../shared/routes/outreach";
import { ApiError } from "../../middleware/errorHandler";

export const handleSaveOutreach: RouteHandler<typeof saveOutreachRoute, AppEnv> = async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c);
  const user = await getSessionUser(c);
  if (!user) throw new ApiError("Unauthorized", 401);

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
      .returning({ id: schema.outreachLogs.id })
      .all();
    result = inserted[0]?.id?.toString() || "new";
  }

  if (validatedData.id) {
    c.executionCtx.waitUntil(logAuditAction(c, "update_outreach", "outreach_logs", String(validatedData.id), `Updated outreach: ${validatedData.title}`));
    return c.json({ success: true, id: validatedData.id }, 200);
  } else {
    c.executionCtx.waitUntil(logAuditAction(c, "create_outreach", "outreach_logs", String(result), `Created outreach: ${validatedData.title}`));
    return c.json({ success: true, id: result }, 200);
  }
};
