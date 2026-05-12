import { eq } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import type { RouteHandler } from "@hono/zod-openapi";
import { logAuditAction, getDb, type AppEnv, requireAuth } from "../../middleware";
import type { deleteOutreachRoute } from "../../../../shared/routes/outreach";

export const handleDeleteOutreach: RouteHandler<typeof deleteOutreachRoute, AppEnv> = async (c) => {
    const { id } = c.req.valid("param");
    const db = getDb(c);
    await requireAuth(c);
    await db.update(schema.outreachLogs)
        .set({ isDeleted: 1 })
        .where(eq(schema.outreachLogs.id, Number(id)))
        .run();
    c.executionCtx.waitUntil(logAuditAction(c, "delete_outreach", "outreach_logs", String(id), "Outreach log soft-deleted"));
    return c.json({ success: true }, 200);
};
