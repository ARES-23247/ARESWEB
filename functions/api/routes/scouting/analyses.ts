import { Hono } from "hono";
import type { Context } from "hono";
import { AppEnv, ensureAuth } from "../../middleware";

const analysesRouter = new Hono<AppEnv>();

analysesRouter.get("/", ensureAuth, async (c: Context<AppEnv>) => {
  const teamNumberStr = c.req.query("teamNumber");
  const eventKey = c.req.query("eventKey");
  const db = c.get("db");

  try {
    let query = db.selectFrom("scouting_analyses").selectAll();

    if (teamNumberStr) {
      const teamNumber = parseInt(teamNumberStr, 10);
      if (!isNaN(teamNumber)) {
        query = query.where("team_number", "=", teamNumber);
      }
    }

    if (eventKey) {
      query = query.where("event_key", "=", eventKey);
    }

    const results = await query.orderBy("created_at", "desc").execute();
    return c.json(results);
  } catch (err) {
    console.error("[Scouting Analyses] Database error:", err);
    return c.json({ error: "Failed to fetch saved analyses" }, 500);
  }
});

export default analysesRouter;

