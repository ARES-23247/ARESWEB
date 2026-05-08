/* eslint-disable @typescript-eslint/no-explicit-any */
import { typedHandler } from "../../utils/handler";
import { OpenAPIHono } from "@hono/zod-openapi";

import { eq, desc } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import { AppEnv, getDb } from "../../middleware";
import { listScoutingAnalysesRoute } from "../../../../shared/routes/scouting";



const analysesRouter = new OpenAPIHono<AppEnv>();

analysesRouter.openapi(listScoutingAnalysesRoute, typedHandler<typeof listScoutingAnalysesRoute>(async (c) => {
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
    return c.json(results, 200);
}));

export default analysesRouter;

