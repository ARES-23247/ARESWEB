import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import * as schema from "../../../../src/db/schema";
import { AppEnv, getDb, requireAuth } from "../../middleware";
import { openApiStandardErrors } from "../../../../shared/routes/common";

// Request schemas
const ScoutingSubmitSchema = z.object({
  type: z.enum(["pit", "match"]),
  teamNumber: z.number(),
  eventKey: z.string().optional().default(""),
  seasonKey: z.string().optional().default("25-26"),
  data: z.record(z.any()),
});

const submitScoutingRoute = createRoute({
  method: "post",
  path: "/submit",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ScoutingSubmitSchema,
        },
      },
    },
  },
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            id: z.string(),
          }),
        },
      },
      description: "Successfully submitted scouting report",
    },
  },
});

const submitRouter = new OpenAPIHono<AppEnv>();

submitRouter.openapi(submitScoutingRoute, async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c);
  const user = await requireAuth(c);

  const { type, teamNumber, eventKey, seasonKey, data } = body;
  const id = crypto.randomUUID();

  // Generate a beautiful, readable markdown summary from the form data
  let markdown = "";
  if (type === "pit") {
    markdown = `# Pit Scouting Report: Team ${teamNumber}

**Season:** ${seasonKey}
**Event:** ${eventKey || "General Info"}
**Scout:** ${user.name}

## 🤖 Robot Specifications
- **Drivetrain:** ${data.drivetrain || "N/A"}
- **Motor Count & Configuration:** ${data.motors || "N/A"}
- **Intake Mechanism:** ${data.intake || "N/A"}
- **Outtake Capabilities:** ${data.outtake || "N/A"}

## 📝 Scouting Notes
${data.notes || "No additional comments provided."}
`;
  } else {
    markdown = `# Match Scouting Report: Team ${teamNumber} (Match #${data.matchNumber || "N/A"})

**Alliance:** ${String(data.alliance || "N/A").toUpperCase()}
**Season:** ${seasonKey}
**Event:** ${eventKey}
**Scout:** ${user.name}

## 🚀 Autonomous Period
- **Samples Scored (High/Low):** ${data.autoSamples || 0}
- **Specimens Scored (High/Low):** ${data.autoSpecimens || 0}
- **Parked:** ${data.autoPark ? "Yes" : "No"}

## 🎮 Teleoperated Period
- **Basket Samples Scored:** ${data.teleSamples || 0}
- **Chamber Specimens Scored:** ${data.teleSpecimens || 0}

## 🏁 Endgame Period
- **Ascent Level:** ${data.endgameAscent || "None"}
- **Drone Launch:** ${data.endgameDrone ? "Successful" : "No"}

## 📝 Scouting Notes & Observations
${data.notes || "No additional comments provided."}
`;
  }

  // Insert the generated report directly into scoutingAnalyses
  await db.insert(schema.scoutingAnalyses).values({
    id,
    seasonKey,
    eventKey: eventKey || null,
    teamNumber,
    mode: type === "pit" ? "pit_scout" : "match_scout",
    model: "scout_form",
    markdown,
    createdBy: user.id,
  }).run();

  return c.json({ success: true, id }, 200);
});

export default submitRouter;
