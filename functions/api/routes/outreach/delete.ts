/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAPI handler input validated by Zod schemas */
import { eq } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import type { RouteHandler } from "@hono/zod-openapi";
import { getSessionUser, logAuditAction, getDb, type AppEnv } from "../../middleware";
import type { deleteOutreachRoute } from "../../../../shared/routes/outreach";

export const handleDeleteOutreach: RouteHandler<typeof deleteOutreachRoute, AppEnv> = async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = getDb(c);
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    await db.update(schema.outreachLogs)
      .set({ isDeleted: 1 })
      .where(eq(schema.outreachLogs.id, Number(id)))
      .run();
    c.executionCtx.waitUntil(logAuditAction(c, "delete_outreach", "outreach_logs", String(id), "Outreach log soft-deleted"));
    return c.json({ success: true }, 200);
  } catch (err) {
    console.error("[Outreach:Delete] Error", err);
    return c.json({ error: "Delete failed" }, 500);
  }
};
