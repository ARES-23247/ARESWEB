import { typedHandler } from "../../utils/handler";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import { AppEnv } from "../../middleware";
import { listScoutingAnalysesRoute } from "../../../../shared/routes/scouting";



const analysesRouter = new OpenAPIHono<AppEnv>();

analysesRouter.openapi(listScoutingAnalysesRoute, typedHandler<typeof listScoutingAnalysesRoute>(async (c) => {
  const { teamNumber: teamNumberStr, eventKey } = c.req.valid("query");
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
    return c.json(results as any, 200 as any);
  } catch (err) {
    console.error("[Scouting Analyses] Database error:", err);
    return c.json({ error: "Failed to fetch saved analyses" } as any, 500 as any);
  }
}));

export default analysesRouter;

