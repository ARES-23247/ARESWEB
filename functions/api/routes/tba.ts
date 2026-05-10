import { wrapHandler } from "../utils/handler-native";
import { ApiError } from "../middleware/errorHandler";
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
    .get();
  const apiKey = settingsRow?.value;
  if (!apiKey) throw new Error("TBA_API_KEY missing");

  const r = await fetch(`https://www.thebluealliance.com/api/v3${path}`, { headers: { "X-TBA-Auth-Key": apiKey } }).catch(() => null);

  if (!r || !r.ok) {
    throw new Error(`TBA API Error: ${r?.status || 'Network failure'}`);
  }

  return await r.json();
}

tbaRouter.openapi(getRankingsRoute, wrapHandler(getRankingsRoute, async (c, { params }) => {
    const { eventKey } = params;
    if (!/^[a-zA-Z0-9]+$/.test(eventKey)) {
      throw new ApiError("Invalid eventKey", 400);
    }
    const data = await getTBA(`/event/${eventKey}/rankings`, c);
    return { status: 200, body: { rankings: (data as { rankings?: unknown[] })?.rankings || [] } };
}));

tbaRouter.openapi(getMatchesRoute, wrapHandler(getMatchesRoute, async (c, { params }) => {
    const { eventKey } = params;
    if (!/^[a-zA-Z0-9]+$/.test(eventKey)) {
      throw new ApiError("Invalid eventKey", 400);
    }
    const data = await getTBA(`/event/${eventKey}/matches/simple`, c) as Array<{ time?: number }>;
    const sorted = (data || []).sort((a, b) => (a.time || 0) - (b.time || 0));
    return { status: 200, body: { matches: sorted as unknown[] } };
}));

tbaRouter.openapi(getFtcEventsRoute, wrapHandler(getFtcEventsRoute, async (c, { params }) => {
    const { season, eventCode, type } = params;
    const path = `/${season}/events/${eventCode}/${type}`;

    const db = getDb(c);
    const settingsRow = await db.select({ value: schema.settings.value })
      .from(schema.settings)
      .where(eq(schema.settings.key, "FTC_EVENTS_API_KEY"))
      .get();
    const apiKey = settingsRow?.value;
    if (!apiKey) throw new Error("FTC_EVENTS_API_KEY missing");

    const r = await fetch(`https://ftc-api.firstinspires.org/v2.0${path}`,
      {
        headers: {
          "Authorization": `Basic ${apiKey}`,
          "Accept": "application/json"
        }
      });

    if (!r.ok) throw new Error(`FTC API Error: ${r.status}`);

    const data = await r.json();
    return { status: 200, body: data };
}));

export default tbaRouter;
