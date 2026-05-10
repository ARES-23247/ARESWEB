import { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";

import { eq, desc } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import { AppEnv, getDb } from "../../middleware";
import { listScoutingAnalysesRoute, ScoutingAnalysisSchema } from "../../../../shared/routes/scouting";

// Type for scouting analysis response (matches ScoutingAnalysisSchema)
type ScoutingAnalysisResponse = z.infer<typeof ScoutingAnalysisSchema>;



const analysesRouter = new OpenAPIHono<AppEnv>();

analysesRouter.openapi(listScoutingAnalysesRoute, async (c) => {
  const { teamNumber: teamNumberStr, eventKey } = c.req.valid("query");
  const db = getDb(c);

  let query = db.select().from(schema.scoutingAnalyses).$dynamic();

  if (teamNumberStr) {
    const teamNumber = parseInt(teamNumberStr, 10);
    if (!isNaN(teamNumber)) {
      query = query.where(eq(schema.scoutingAnalyses.teamNumber, teamNumber));
    }
  }

  if (eventKey) {
    query = query.where(eq(schema.scoutingAnalyses.eventKey, eventKey));
  }

  const results = await query.orderBy(desc(schema.scoutingAnalyses.createdAt)).all();

  // Transform camelCase database results to snake_case API format
  const transformed = results.map((r) => ({
    id: r.id,
    team_number: r.teamNumber ?? 0,
    event_key: r.eventKey ?? "",
    analysis_json: r.markdown,
    created_at: r.createdAt ?? "",
    updated_at: r.createdAt ?? "",
  })) as ScoutingAnalysisResponse[];

  return c.json(transformed, 200);
});

export default analysesRouter;




