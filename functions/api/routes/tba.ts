import { Hono, Context } from "hono";
import { AppEnv  } from "./_shared";

const tbaRouter = new Hono<AppEnv>();

// SEC-DoW: Cache TBA responses in-memory to prevent external API quota exhaustion
const tbaCache = new Map<string, { data: unknown; expiresAt: number }>();

async function getTBA(path: string, c: Context<AppEnv>) {
  // Check in-memory cache first (5 minute TTL)
  const now = Date.now();
  const cached = tbaCache.get(path);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const { results: settingsRows } = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'TBA_API_KEY'").all();
  const apiKey = (settingsRows[0] as { value: string })?.value;
  if (!apiKey) throw new Error("TBA_API_KEY not configured");

  const r = await fetch(`https://www.thebluealliance.com/api/v3${path}`, {
    headers: { "X-TBA-Auth-Key": apiKey }
  });
  if (!r.ok) throw new Error(`TBA API error: ${r.status}`);
  const data = await r.json();

  // Cache for 5 minutes
  tbaCache.set(path, { data, expiresAt: now + 300000 });

  // Periodic GC
  if (Math.random() < 0.05) {
    for (const [k, v] of tbaCache.entries()) {
      if (v.expiresAt < now) tbaCache.delete(k);
    }
  }

  return data;
}

// ── GET /tba/rankings/:eventKey ───────────────────────────────────────
tbaRouter.get("/rankings/:eventKey", async (c) => {
  try {
    const eventKey = (c.req.param("eventKey") || "");
    const data = await getTBA(`/event/${eventKey}/rankings`, c);
    return c.json(data);
  } catch (err) {
    console.error("TBA rankings error:", err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

// ── GET /tba/matches/:eventKey ────────────────────────────────────────
tbaRouter.get("/matches/:eventKey", async (c) => {
  try {
    const eventKey = (c.req.param("eventKey") || "");
    const data = (await getTBA(`/event/${eventKey}/matches/simple`, c)) as Array<{ time?: number; [key: string]: unknown }>;
    const sorted = (data || []).sort((a: { time?: number }, b: { time?: number }) => (a.time || 0) - (b.time || 0));
    return c.json({ matches: sorted });
  } catch (err) {
    console.error("TBA matches error:", err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

// ── GET /tba/team/:teamKey/events/:year ───────────────────────────────
tbaRouter.get("/team/:teamKey/events/:year", async (c) => {
  try {
    const { teamKey, year } = c.req.param();
    const data = await getTBA(`/team/${teamKey}/events/${year}/simple`, c);
    return c.json({ events: data });
  } catch (err) {
    console.error("TBA team events error:", err);
    return c.json({ error: (err as Error).message }, 500);
  }
});

export default tbaRouter;
