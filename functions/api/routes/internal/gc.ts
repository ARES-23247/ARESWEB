import { Hono } from "hono";
import { AppEnv } from "../../middleware";
import { Kysely } from "kysely";
import { DB } from "../../../../shared/schemas/database";

export const gcRouter = new Hono<AppEnv>();

// This is an internal cron trigger endpoint
gcRouter.post("/", async (c) => {
  try {
    const cronSecret = c.env.CRON_SECRET;
    const providedSecret = c.req.header("x-cron-secret");

    if (!cronSecret || providedSecret !== cronSecret) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const db = c.get("db") as Kysely<DB>;

    // Delete rows soft-deleted more than 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString();

    const results = await Promise.all([
      db.deleteFrom("docs").where("is_deleted", "=", 1).where("updated_at", "<", dateStr).execute(),
      db.deleteFrom("comments").where("is_deleted", "=", 1).where("updated_at", "<", dateStr).execute(),
      db.deleteFrom("seasons").where("is_deleted", "=", 1).where("updated_at", "<", dateStr).execute()
    ]);

    const deletedCounts = {
      docs: Number(results[0][0]?.numDeletedRows ?? 0),
      comments: Number(results[1][0]?.numDeletedRows ?? 0),
      seasons: Number(results[2][0]?.numDeletedRows ?? 0)
    };

    return c.json({ success: true, deleted: deletedCounts });
  } catch (e) {
    console.error("[GC Cron] Error", e);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

export default gcRouter;
