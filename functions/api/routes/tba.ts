import { typedHandler } from "../utils/handler";
/* TBA API route handlers */
import { OpenAPIHono } from "@hono/zod-openapi";
import { AppEnv, ensureAuth, rateLimitMiddleware, getDb } from "../middleware";
import { getRankingsRoute, getMatchesRoute, getFtcEventsRoute } from "../../../shared/routes/tba";
import type { HonoContext } from "@shared/types/api";
import * as schema from "../../../src/db/schema";
import { eq } from "drizzle-orm";
import { cache } from "hono/cache";

export const tbaRouter = new OpenAPIHono<AppEnv>();

// CR-06 FIX: Apply authentication and rate limiting to all TBA proxy routes
// While TBA data is public, the proxy could be abused for rate limit evasion
tbaRouter.use("*", ensureAuth);
tbaRouter.use("*", rateLimitMiddleware(30, 60));

// Apply Cloudflare Edge Caching (stale-while-revalidate)
tbaRouter.use("*", cache({
  cacheName: 'aresweb-tba-cache',
  cacheControl: 'max-age=300, stale-while-revalidate=86400'
}));

async function getTBA(path: string, c: HonoContext) {
  const db = getDb(c);
  const settingsRow = await db.select({ value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.key, "TBA_API_KEY"))
    .executeTakeFirst();
  const apiKey = settingsRow?.value;
  if (!apiKey) throw new Error("TBA_API_KEY missing");

  const r = await fetch(`https://www.thebluealliance.com/api/v3${path}`, { headers: { "X-TBA-Auth-Key": apiKey } }).catch(() => null);
  
  if (!r || !r.ok) {
    throw new Error(`TBA API Error: ${r?.status || 'Network failure'}`);
  }

  return await r.json();
}

tbaRouter.openapi(getRankingsRoute, typedHandler<typeof getRankingsRoute>(async (c) => {
  try {
    const { eventKey } = c.req.valid("param");
    if (!/^[a-zA-Z0-9]+$/.test(eventKey)) {
      return c.json({ error: "Invalid eventKey" }, 400);
    }
    const data = await getTBA(`/event/${eventKey}/rankings`, c);
    return c.json({ rankings: (data as { rankings?: unknown[] })?.rankings || [] }, 200);
  } catch (e) {
    console.error("GET_TBA_RANKINGS ERROR", e);
    return c.json({ error: "Failed to fetch rankings" }, 500);
  }
}));

tbaRouter.openapi(getMatchesRoute, typedHandler<typeof getMatchesRoute>(async (c) => {
  try {
    const { eventKey } = c.req.valid("param");
    if (!/^[a-zA-Z0-9]+$/.test(eventKey)) {
      return c.json({ error: "Invalid eventKey" }, 400);
    }
    const data = await getTBA(`/event/${eventKey}/matches/simple`, c) as Array<{ time?: number }>;
    const sorted = (data || []).sort((a, b) => (a.time || 0) - (b.time || 0));
    return c.json({ matches: sorted as unknown[] }, 200);
  } catch (e) {
    console.error("GET_TBA_MATCHES ERROR", e);
    return c.json({ error: "Failed to fetch matches" }, 500);
  }
}));

tbaRouter.openapi(getFtcEventsRoute, typedHandler<typeof getFtcEventsRoute>(async (c) => {
  try {
    const { season, eventCode, type } = c.req.valid("param");
    const path = `/${season}/events/${eventCode}/${type}`;

    const db = getDb(c);
    const settingsRow = await db.select({ value: schema.settings.value })
      .from(schema.settings)
      .where(eq(schema.settings.key, "FTC_EVENTS_API_KEY"))
      .executeTakeFirst();
    const apiKey = settingsRow?.value;
    if (!apiKey) throw new Error("FTC_EVENTS_API_KEY missing");

    const r = await fetch(`https://ftc-api.firstinspires.org/v2.0${path}`, { 
      headers: { 
        "Authorization": `Basic ${apiKey}`,
        "Accept": "application/json"
      } 
    });
    
    if (!r.ok) throw new Error(`FTC API Error: ${r.status}`);
    
    const data = await r.json();
    return c.json(data, 200);
  } catch (_e) {
    return c.json({ error: "Failed to fetch official event data" }, 500);
  }
}));

export default tbaRouter;
