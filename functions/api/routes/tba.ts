import { Hono, Context } from "hono";
import { AppEnv  } from "../middleware";
import { initServer, createHonoEndpoints } from "ts-rest-hono";
import { tbaContract } from "../../../src/schemas/contracts/tbaContract";

const s = initServer<AppEnv>();
const tbaRouter = new Hono<AppEnv>();

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

  const db = c.get("db");
  const settingsRow = await db.selectFrom("settings").select("value").where("key", "=", "TBA_API_KEY").executeTakeFirst();
  const apiKey = settingsRow?.value;
  if (!apiKey) throw new Error("TBA_API_KEY missing");

  const r = await fetch(`https://www.thebluealliance.com/api/v3${path}`, { headers: { "X-TBA-Auth-Key": apiKey } });
  const data = await r.json();
  setTbaCache(path, { data, expiresAt: now + 300000 });
  return data;
}

const tbaTsRestRouter = s.router(tbaContract, {
  getRankings: async ({ params }, c) => {
    try {
      const data = await getTBA(`/event/${params.eventKey}/rankings`, c);
      return { status: 200, body: { rankings: (data as any)?.rankings || [] } };
    } catch (_err) {
      return { status: 200, body: { rankings: [] } };
    }
  },
  getMatches: async ({ params }, c) => {
    try {
      const data = await getTBA(`/event/${params.eventKey}/matches/simple`, c) as any[];
      const sorted = (data || []).sort((a, b) => (a.time || 0) - (b.time || 0));
      return { status: 200, body: { matches: sorted } };
    } catch (_err) {
      return { status: 200, body: { matches: [] } };
    }
  },
});

createHonoEndpoints(tbaContract, tbaTsRestRouter, tbaRouter);
export default tbaRouter;
