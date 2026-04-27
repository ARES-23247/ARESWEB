import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { Hono, Context } from "hono";
import { AppEnv  } from "../middleware";
import { initServer, createHonoEndpoints } from "ts-rest-hono";
import { tbaContract } from "../../../shared/schemas/contracts/tbaContract";

const s = initServer<AppEnv>();
export const tbaRouter = new Hono<AppEnv>();

const tbaCache = new Map<string, { data: any; expiresAt: number }>();

function setTbaCache(key: string, value: { data: any; expiresAt: number }) {
  if (tbaCache.size >= 100) {
    const firstKey = tbaCache.keys().next().value;
    if (firstKey !== undefined) tbaCache.delete(firstKey);
  }
  tbaCache.set(key, value);
}

async function getTBA(path: string, c: Context<AppEnv>) {
  const now = Date.now();
  const cached = tbaCache.get(path);
  if (cached && cached.expiresAt > now) return cached.data;

  const db = c.get("db") as Kysely<DB>;
  const settingsRow = await db.selectFrom("settings").select("value").where("key", "=", "TBA_API_KEY").executeTakeFirst();
  const apiKey = settingsRow?.value;
  if (!apiKey) throw new Error("TBA_API_KEY missing");

  const r = await fetch(`https://www.thebluealliance.com/api/v3${path}`, { headers: { "X-TBA-Auth-Key": apiKey } });
  
  if (!r.ok) {
    throw new Error(`TBA API Error: ${r.status}`);
  }

  const data = await r.json();
  setTbaCache(path, { data, expiresAt: now + 300000 });
  return data;
}

const tbaHandlers = {
  getRankings: async ({ params }: { params: any }, c: Context<AppEnv>) => {
    try {
      const eventKey = String(params.eventKey);
      if (!/^[a-zA-Z0-9]+$/.test(eventKey)) {
        return { status: 400 as const, body: { error: "Invalid eventKey" } as any };
      }
      const data = await getTBA(`/event/${eventKey}/rankings`, c);
      return { status: 200 as const, body: { rankings: (data as any)?.rankings as any[] || [] } as any };
    } catch (e) {
      console.error("GET_TBA_RANKINGS ERROR", e);
      return { status: 500 as const, body: { error: "Failed to fetch rankings" } as any };
    }
  },
  getMatches: async ({ params }: { params: any }, c: Context<AppEnv>) => {
    try {
      const eventKey = String(params.eventKey);
      if (!/^[a-zA-Z0-9]+$/.test(eventKey)) {
        return { status: 400 as const, body: { error: "Invalid eventKey" } as any };
      }
      const data = await getTBA(`/event/${eventKey}/matches/simple`, c) as any[];
      const sorted = (data || []).sort((a, b) => (a.time || 0) - (b.time || 0));
      return { status: 200 as const, body: { matches: sorted as any[] } as any };
    } catch (e) {
      console.error("GET_TBA_MATCHES ERROR", e);
      return { status: 500 as const, body: { error: "Failed to fetch matches" } as any };
    }
  },
  getFtcEvents: async ({ params }: { params: any }, c: Context<AppEnv>) => {
    try {
      const { season, eventCode, type } = params;
      const path = `/${season}/events/${eventCode}/${type}`;
      
      const now = Date.now();
      const cacheKey = `ftc_${path}`;
      const cached = tbaCache.get(cacheKey);
      if (cached && cached.expiresAt > now) return { status: 200 as const, body: cached.data };

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
      return { status: 200 as const, body: data };
    } catch (e) {
      console.error("GET_FTC_EVENTS ERROR", e);
      return { status: 500 as const, body: { error: "Failed to fetch official event data" } };
    }
  }
};

const tbaTsRestRouter = s.router(tbaContract, tbaHandlers as any);

createHonoEndpoints(tbaContract, tbaTsRestRouter, tbaRouter);
export default tbaRouter;
