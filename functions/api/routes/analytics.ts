import { Hono } from "hono";
import { Bindings, ensureAdmin } from "./_shared";

const analyticsRouter = new Hono<{ Bindings: Bindings }>();

// ── POST /analytics/track — log a page view ──────────────────────────
analyticsRouter.post("/analytics/track", async (c) => {
  try {
    const body = await c.req.json();
    const { path, category, referrer } = body as { path?: string; category?: string; referrer?: string };
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

// ── GET /admin/analytics/summary — Analytics Dashboard ───────────────
analyticsRouter.get("/admin/analytics/summary", ensureAdmin, async (c) => {
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
analyticsRouter.get("/admin/roster-stats", ensureAdmin, async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT 
          u.user_id,
          u.first_name,
          u.last_name,
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
       GROUP BY u.user_id
       ORDER BY MAX(u.first_name) ASC`
    ).all();

    return c.json({ roster: results || [] });
  } catch (err) {
    console.error("Roster stats error:", err);
    return c.json({ roster: [] }, 500);
  }
});

export default analyticsRouter;
