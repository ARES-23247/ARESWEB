/* eslint-disable @typescript-eslint/no-explicit-any -- ts-rest handler input validated by contract library */
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { Hono } from "hono";
import { AppEnv, ensureAuth, rateLimitMiddleware } from "../middleware";
import { initServer, createHonoEndpoints } from "ts-rest-hono";
import { tbaContract } from "../../../shared/schemas/contracts/tbaContract";
import type { HonoContext } from "@shared/types/api";
const s = initServer<AppEnv>();
export const tbaRouter = new Hono<AppEnv>();

// CR-06 FIX: Apply authentication and rate limiting to all TBA proxy routes
// While TBA data is public, the proxy could be abused for rate limit evasion
tbaRouter.use("*", ensureAuth);
tbaRouter.use("*", rateLimitMiddleware(30, 60));

const tbaCache = new Map<string, { data: unknown; expiresAt: number }>();

function setTbaCache(key: string, value: { data: unknown; expiresAt: number }) {
  if (tbaCache.size >= 100) {
    const firstKey = tbaCache.keys().next().value;
    if (firstKey !== undefined) tbaCache.delete(firstKey);
  }
  tbaCache.set(key, value);
}

async function getTBA(path: string, c: HonoContext) {
  const now = Date.now();
  const cached = tbaCache.get(path);
  if (cached && cached.expiresAt > now) return cached.data;

  const db = c.get("db") as Kysely<DB>;
  const settingsRow = await db.selectFrom("settings").select("value").where("key", "=", "TBA_API_KEY").executeTakeFirst();
  const apiKey = settingsRow?.value;
  if (!apiKey) throw new Error("TBA_API_KEY missing");

  const r = await fetch(`https://www.thebluealliance.com/api/v3${path}`, { headers: { "X-TBA-Auth-Key": apiKey } }).catch(() => null);
  
  if (!r || !r.ok) {
    // ECO-TBA-01: Graceful fallback to expired cache if external API is down or rate-limited
    if (cached) {
      console.warn(`[TBA Fallback] External API error ${r?.status || 'network'}. Serving expired cache for ${path}`);
      return cached.data;
    }
    throw new Error(`TBA API Error: ${r?.status || 'Network failure'} and no cache available`);
  }

  const data = await r.json();
  setTbaCache(path, { data, expiresAt: now + 300000 });
  return data;
}

import { ServerInferRequest } from "../../../shared/types/api";

const tbaHandlers = {
  getRankings: async (input: ServerInferRequest<typeof tbaContract["getRankings"]>, c: HonoContext) => {
    try {
      const eventKey = input.params.eventKey;
      if (!/^[a-zA-Z0-9]+$/.test(eventKey)) {
        return { status: 400 as const, body: { error: "Invalid eventKey" } };
      }
      const data = await getTBA(`/event/${eventKey}/rankings`, c);
      return { status: 200 as const, body: { rankings: (data as { rankings?: unknown[] })?.rankings || [] } };
    } catch (e) {
      console.error("GET_TBA_RANKINGS ERROR", e);
      return { status: 500 as const, body: { error: "Failed to fetch rankings" } };
    }
  },
  getMatches: async (input: ServerInferRequest<typeof tbaContract["getMatches"]>, c: HonoContext) => {
    try {
      const eventKey = input.params.eventKey;
      if (!/^[a-zA-Z0-9]+$/.test(eventKey)) {
        return { status: 400 as const, body: { error: "Invalid eventKey" } };
      }
      const data = await getTBA(`/event/${eventKey}/matches/simple`, c) as Array<{ time?: number }>;
      const sorted = (data || []).sort((a, b) => (a.time || 0) - (b.time || 0));
      return { status: 200 as const, body: { matches: sorted as unknown[] } };
    } catch (e) {
      console.error("GET_TBA_MATCHES ERROR", e);
      return { status: 500 as const, body: { error: "Failed to fetch matches" } };
    }
  },
  getFtcEvents: async (input: ServerInferRequest<typeof tbaContract["getFtcEvents"]>, c: HonoContext) => {
    try {
      const { season, eventCode, type } = input.params;
      const path = `/${season}/events/${eventCode}/${type}`;
      
      const now = Date.now();
      const cacheKey = `ftc_${path}`;
      const cached = tbaCache.get(cacheKey);
      if (cached && cached.expiresAt > now) return { status: 200 as const, body: cached.data as never }; // TS-Rest handles validation

      const db = c.get("db") as Kysely<DB>;
      const settingsRow = await db.selectFrom("settings").select("value").where("key", "=", "FTC_EVENTS_API_KEY").executeTakeFirst();
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
      setTbaCache(cacheKey, { data, expiresAt: now + 300000 });
      return { status: 200 as const, body: data as never };
    } catch (_e) {
      return { status: 500 as const, body: { error: "Failed to fetch official event data" } };
    }
  },
};
const tbaTsRestRouter = s.router(tbaContract, tbaHandlers as any);

createHonoEndpoints(
  tbaContract,
  tbaTsRestRouter,
  tbaRouter,
  {
    responseValidation: true,
    responseValidationErrorHandler: (err, _c) => {
      console.error('[Contract] Response validation failed:', err.cause);
      return { error: { message: 'Internal server error' }, status: 500 };
    }
  }
);
export default tbaRouter;


