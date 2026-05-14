/**
 * ─────────────────────────────────────────────────────────────────────────────
 * FTC EVENTS API — FIRST FTC Events data proxy
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ApiError } from "../middleware/errorHandler";
import { OpenAPIHono } from "@hono/zod-openapi";
import { AppEnv, ensureAuth, rateLimitMiddleware, getDb } from "../middleware";
import { getFtcEventsRoute } from "../../../shared/routes/ftc";
import type { HonoContext } from "@shared/types/api";
import * as schema from "../../../src/db/schema";
import { eq } from "drizzle-orm";
import { cache } from "hono/cache";

const _ftcRouter = new OpenAPIHono<AppEnv>();

// Apply authentication and rate limiting to all FTC proxy routes
_ftcRouter.use("*", ensureAuth);
_ftcRouter.use("*", rateLimitMiddleware(30, 60));

// Apply Cloudflare Edge Caching (stale-while-revalidate)
_ftcRouter.use("*", cache({
  cacheName: 'aresweb-ftc-cache',
  cacheControl: 'max-age=300, stale-while-revalidate=86400'
}));

/**
 * Fetch data from FIRST FTC Events API
 */
async function getFtcData(path: string, c: HonoContext) {
  const db = getDb(c);
  const settingsRow = await db.select({ value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.key, "FTC_EVENTS_API_KEY"))
    .get();
  const apiKey = settingsRow?.value;
  if (!apiKey) throw new Error("FTC_EVENTS_API_KEY missing from settings");

  const r = await fetch(`https://ftc-api.firstinspires.org/v2.0${path}`, {
    headers: {
      "Authorization": `Basic ${apiKey}`,
      "Accept": "application/json"
    }
  });

  if (!r.ok) {
    throw new Error(`FTC API Error: ${r.status} ${r.statusText}`);
  }

  return await r.json();
}

export const ftcRouter = _ftcRouter
  .openapi(getFtcEventsRoute, async (c) => {
    const params = c.req.valid("param");
    const { season, eventCode, type } = params;
    const path = `/${season}/events/${eventCode}/${type}`;

    try {
      const data = await getFtcData(path, c);
      return c.json(data, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new ApiError(`Failed to fetch FTC events: ${message}`, 500);
    }
  });

export default ftcRouter;
