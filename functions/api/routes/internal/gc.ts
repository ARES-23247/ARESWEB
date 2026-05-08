import { typedHandler } from "../../utils/handler";
import { ApiError } from "../../middleware/errorHandler";
import { OpenAPIHono } from "@hono/zod-openapi";

import { eq, and, lt } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import { AppEnv, getDb } from "../../middleware";
import { gcRoute } from "../../../../shared/routes/internal";



export const gcRouter = new OpenAPIHono<AppEnv>();

// This is an internal cron trigger endpoint
gcRouter.openapi(gcRoute, typedHandler<typeof gcRoute>(async (c) => {
    const cronSecret = c.env.CRON_SECRET;
    const providedSecret = c.req.header("x-cron-secret");

    if (!cronSecret || providedSecret !== cronSecret) {
      throw new ApiError("Unauthorized", 401);
    }

    const db = getDb(c);

    // Delete rows soft-deleted more than 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString();

    const results = await Promise.all([
      db.delete(schema.docs).where(and(eq(schema.docs.isDeleted, 1), lt(schema.docs.updatedAt, dateStr))).run(),
      db.delete(schema.comments).where(and(eq(schema.comments.isDeleted, 1), lt(schema.comments.updatedAt, dateStr))).run(),
      db.delete(schema.seasons).where(and(eq(schema.seasons.isDeleted, 1), lt(schema.seasons.updatedAt, dateStr))).run()
    ]);

    const deletedCounts = {
      docs: Number((results[0] as { meta?: { changes?: number } }).meta?.changes ?? 0),
      comments: Number((results[1] as { meta?: { changes?: number } }).meta?.changes ?? 0),
      seasons: Number((results[2] as { meta?: { changes?: number } }).meta?.changes ?? 0)
    };

    return c.json({ success: true, deleted: deletedCounts }, 200);
}));

export default gcRouter;
