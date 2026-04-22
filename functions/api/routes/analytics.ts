import { Hono } from "hono";
import { AppEnv, ensureAdmin, checkWriteRateLimit, MAX_INPUT_LENGTHS, turnstileMiddleware  } from "../middleware";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const analyticsRouter = new Hono<AppEnv>();

// ── POST /analytics/track — log a page view ──────────────────────────
const trackSchema = z.object({
  path: z.string().max(MAX_INPUT_LENGTHS.slug).optional(),
  category: z.string().max(MAX_INPUT_LENGTHS.code).optional(),
  referrer: z.string().max(MAX_INPUT_LENGTHS.generic).optional()
});

analyticsRouter.post("/track", turnstileMiddleware(), zValidator("json", trackSchema), async (c) => {
  // SEC-DoW: Unauthenticated D1 write — enforce strict per-IP write limit
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  if (!checkWriteRateLimit(`track:${ip}`, 20, 60)) {
    return c.json({ success: false }, 429);
  }

  try {
    const { path, category, referrer } = c.req.valid("json");
    const userAgent = c.req.header("user-agent") || "";
    
    await c.env.DB.prepare(
      `INSERT INTO page_analytics (path, category, referrer, user_agent) VALUES (?, ?, ?, ?)`
    ).bind(
      path || "/", 
      category || "system", 
      referrer || "", 
      userAgent
    ).run();

    return c.json({ success: true });
  } catch (err) {
    console.error("Analytics tracking error:", err);
    return c.json({ success: false }, 500);
  }
});

// ── POST /analytics/sponsor-click — log a sponsor link click ─────────
const clickSchema = z.object({
  sponsor_id: z.string().min(1).max(MAX_INPUT_LENGTHS.code)
});

analyticsRouter.post("/sponsor-click", turnstileMiddleware(), zValidator("json", clickSchema), async (c) => {
  // SEC-DoW: Unauthenticated D1 write — enforce strict per-IP write limit
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  if (!checkWriteRateLimit(`click:${ip}`, 10, 60)) {
    return c.json({ success: false }, 429);
  }

  try {
    const { sponsor_id } = c.req.valid("json");
    
    const yearMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    await c.env.DB.prepare(
      `INSERT INTO sponsor_metrics (id, sponsor_id, year_month, clicks, impressions) 
       VALUES (?, ?, ?, 1, 0)
       ON CONFLICT(sponsor_id, year_month) DO UPDATE SET clicks = clicks + 1`
    ).bind(crypto.randomUUID(), sponsor_id, yearMonth).run();

    return c.json({ success: true });
  } catch (err) {
    console.error("Sponsor tracking error:", err);
    return c.json({ success: false }, 500);
  }
});

// ── GET /admin/analytics/summary — Analytics Dashboard ───────────────
analyticsRouter.get("/summary", ensureAdmin, async (c) => {
  try {
    const [topPages, recentViews, totals] = await Promise.all([
      c.env.DB.prepare(
        "SELECT path, category, COUNT(*) as views FROM page_analytics GROUP BY path, category ORDER BY views DESC LIMIT 10"
      ).all(),
      c.env.DB.prepare(
        "SELECT path, category, user_agent, referrer, timestamp FROM page_analytics ORDER BY timestamp DESC LIMIT 20"
      ).all(),
      c.env.DB.prepare(
        "SELECT category, COUNT(*) as total FROM page_analytics GROUP BY category"
      ).all()
    ]);

    return c.json({
      topPages: topPages.results || [],
      recentViews: recentViews.results || [],
      totals: totals.results || []
    });
  } catch (err) {
    console.error("Analytics summary error:", err);
    return c.json({ topPages: [], recentViews: [], totals: [] }, 500);
  }
});

// ── GET /admin/roster-stats — Member Impact Roster ──────────────────
analyticsRouter.get("/roster-stats", ensureAdmin, async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT 
          u.user_id,
          u.nickname,
          u.member_type,
          SUM(CASE WHEN s.attended = 1 THEN 1 ELSE 0 END) as attended_events,
          COALESCE(SUM(CASE WHEN s.attended = 1 THEN s.prep_hours ELSE 0 END), 0) as manual_prep_hours,
          COALESCE(SUM(CASE WHEN s.attended = 1 AND e.is_volunteer = 1 THEN 
              (strftime('%s', e.date_end) - strftime('%s', e.date_start)) / 3600.0
          ELSE 0 END), 0) as event_volunteer_hours
       FROM user_profiles u
       LEFT JOIN event_signups s ON u.user_id = s.user_id
       LEFT JOIN events e ON s.event_id = e.id AND e.status = 'published' AND e.is_deleted = 0
       GROUP BY u.user_id, u.nickname, u.member_type
       ORDER BY u.nickname ASC`
    ).all();

    return c.json({ roster: results || [] });
  } catch (err) {
    console.error("Roster stats error:", err);
    return c.json({ roster: [] }, 500);
  }
});

export default analyticsRouter;
