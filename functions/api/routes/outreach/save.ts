import { eq } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import type { RouteHandler } from "@hono/zod-openapi";
import { logAuditAction, getDb, type AppEnv, requireAuth } from "../../middleware";
import type { saveOutreachRoute } from "../../../../shared/routes/outreach";

export const handleSaveOutreach: RouteHandler<typeof saveOutreachRoute, AppEnv> = async (c) => {
    const body = c.req.valid("json");
    const db = getDb(c);
    await requireAuth(c);
    const validatedData = body;
    let result: string | number;
    if (validatedData.id) {
        await db.update(schema.outreachLogs)
            .set({
                title: validatedData.title,
                date: validatedData.date,
                location: validatedData.location || null,
                hours: validatedData.hours,
                peopleReached: validatedData.peopleReached,
                studentsCount: validatedData.studentsCount,
                impactSummary: validatedData.impactSummary || null,
                isMentoring: validatedData.isMentoring ? 1 : 0,
                mentoredTeamNumber: validatedData.mentoredTeamNumber || null,
                seasonId: validatedData.seasonId || null,
                eventId: validatedData.eventId || null,
                mentorCount: validatedData.mentorCount || 0,
                mentorHours: validatedData.mentorHours || 0,
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
                hours: validatedData.hours,
                peopleReached: validatedData.peopleReached,
                studentsCount: validatedData.studentsCount,
                impactSummary: validatedData.impactSummary || null,
                isMentoring: validatedData.isMentoring ? 1 : 0,
                mentoredTeamNumber: validatedData.mentoredTeamNumber || null,
                seasonId: validatedData.seasonId || null,
                eventId: validatedData.eventId || null,
                mentorCount: validatedData.mentorCount || 0,
                mentorHours: validatedData.mentorHours || 0,
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


