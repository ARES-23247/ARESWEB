/* eslint-disable @typescript-eslint/no-explicit-any */
import { typedHandler } from "../../utils/handler";
import { OpenAPIHono } from "@hono/zod-openapi";

import * as schema from "../../../../src/db/schema";
import { AppEnv, getDb } from "../../middleware";
import { analyzeScoutingRoute } from "../../../../shared/routes/scouting";



const SYSTEM_PROMPTS: Record<string, string> = {
  team_analysis: `You are an expert FTC (FIRST Tech Challenge) scouting analyst for Team ARES 23247. Analyze the provided team data thoroughly. Structure your response with clear markdown headings:

## Team Overview
Brief summary of team identity and history.

## Strengths
Specific strengths based on match data, OPR, scoring patterns.

## Weaknesses  
Areas for improvement based on loss patterns, scoring gaps.

## Alliance Compatibility
How well this team would complement ARES 23247 in an alliance. Consider scoring synergies.

## Key Statistics
Highlight the most important numbers — OPR, win rate, scoring averages, consistency.

Be data-driven. Reference specific numbers from the provided context. Keep analysis concise but insightful.`,

  match_prediction: `You are an expert FTC match analyst for Team ARES 23247. Given alliance matchup data, predict the outcome. Structure your response:

## Prediction
Winner prediction with confidence percentage (e.g., "Red Alliance — 72% confidence").

## Scoring Breakdown
Expected auto, teleop, and endgame contributions per alliance.

## Key Matchups
Which robots on each alliance will have the biggest impact and why.

## Strategy Notes
Tactical recommendations for ARES 23247 if they are in this match.

Use concrete numbers from the provided data. Be honest about uncertainty.`,

  event_overview: `You are an expert FTC event analyst for Team ARES 23247. Provide a comprehensive event overview. Structure your response:

## Event Summary
High-level overview of the event — team count, competitiveness, notable teams.

## Top Contenders
Teams most likely to reach finals, with reasoning based on OPR, record, and recent form.

## Dark Horses
Teams that might surprise — inconsistent but with high potential.

## Key Matchups to Watch
Specific qualification matches or likely elimination matchups that will be decisive.

## Strategic Intel for ARES 23247
What ARES should focus on at this event. Alliance selection recommendations.

Be specific and use the data provided. Reference team numbers and stats.`,
};

const analyzeRouter = new OpenAPIHono<AppEnv>();

analyzeRouter.openapi(analyzeScoutingRoute, typedHandler<typeof analyzeScoutingRoute>(async (c) => {
  const { mode, teamNumber, eventKey, seasonKey, context } = c.req.valid("json");

  if (!SYSTEM_PROMPTS[mode]) {
    return c.json({ error: `Invalid analysis mode: ${mode}.` } as any, 400 as any);
  }

  const zaiKey = c.env.Z_AI_API_KEY;
  if (!zaiKey) {
    return c.json({ error: "AI service (Z_AI_API_KEY) not configured." } as any, 500 as any);
  }

  const systemPrompt = SYSTEM_PROMPTS[mode];
  const userContent = `Season: ${seasonKey}\n${teamNumber ? `Team: ${teamNumber}\n` : ""}Data:\n${JSON.stringify(context, null, 2)}`;

  try {
    const zaiRes = await fetch("https://api.z.ai/api/coding/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${zaiKey}`,
      },
      body: JSON.stringify({
        model: "GLM-5.1",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 4096,
      }),
    });

    if (!zaiRes.ok) {
      const errText = await zaiRes.text();
      console.error(`[Scouting Analyze] Z.ai error ${zaiRes.status}:`, errText);
      return c.json({ error: `AI analysis failed (${zaiRes.status})` } as any, 502 as any);
    }

    const data = (await zaiRes.json()) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string }; usage?: { total_tokens?: number } };
    if (data.error) {
      return c.json({ error: data.error.message || "AI returned an error" } as any, 502 as any);
    }

    const markdown = data.choices?.[0]?.message?.content || "";
    const tokensUsed = data.usage?.total_tokens;

    // Save to database
    try {
      const db = getDb(c);
      const user = c.get("sessionUser");
      const id = crypto.randomUUID();
      
      await db.insert(schema.scoutingAnalyses).values({
        id,
        mode,
        teamNumber: teamNumber || null,
        eventKey: eventKey || null,
        seasonKey: seasonKey,
        markdown,
        model: "GLM-5.1",
        tokensUsed: tokensUsed || 0,
        createdBy: user?.id || "system"
      }).run();
    } catch (dbErr) {
      console.error("[Scouting Analyze] Failed to persist analysis:", dbErr);
    }

    return c.json({
      markdown,
      model: "GLM-5.1",
      tokensUsed,
    } as any, 200 as any);
  } catch (err) {
    console.error("[Scouting Analyze] Error:", err);
    return c.json({ error: "AI analysis request failed" } as any, 500 as any);
  }
}));

export default analyzeRouter;

