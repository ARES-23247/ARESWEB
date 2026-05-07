/* eslint-disable @typescript-eslint/no-explicit-any */
import { typedHandler } from "../utils/handler";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv, ensureAuth, ensureAdmin, rateLimitMiddleware, turnstileMiddleware, getDbSettings, checkPersistentRateLimit, getDb } from "../middleware";
import { eq, and, desc, sql } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import {

  trackPageViewRoute,
  trackSponsorClickRoute,
  getRosterStatsRoute,
  getLeaderboardRoute,
  getStatsRoute,
  getPlatformAnalyticsRoute,
  searchRoute,
} from "../../../shared/routes/analytics";


export const analyticsRouter = new OpenAPIHono<AppEnv>();

import perfRouter from "./analytics/performance";
analyticsRouter.route("/performance", perfRouter);

// CR-01 FIX: Apply authentication to all analytics routes
// Public routes (page view tracking, search) have rate limiting only
analyticsRouter.use("/admin/stats", ensureAuth);
analyticsRouter.use("/admin/roster-stats", ensureAuth);
analyticsRouter.use("/leaderboard", ensureAuth);

// Apply ensureAdmin ONLY to administrative routes
analyticsRouter.use("/admin/*", ensureAdmin);

analyticsRouter.use("/sponsor-click", turnstileMiddleware());
analyticsRouter.use("/search", rateLimitMiddleware(100, 60));

// Track page view
analyticsRouter.openapi(trackPageViewRoute, typedHandler<typeof trackPageViewRoute>(async (c) => {
  const db = getDb(c);
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  const ua = c.req.header("User-Agent") || "unknown";
  if (!(await checkPersistentRateLimit(db, `track:${ip}`, ua, 20, 600))) {
    return c.json({ error: "Rate limit exceeded" } as any, 429 as any);
  }
  try {
    const { path, category, referrer } = c.req.valid("json");
    const userAgent = c.req.header("user-agent") || ua;

    await db.insert(schema.pageAnalytics)
      .values({
        path: path || "/",
        category: category || "system",
        referrer: referrer || "",
        userAgent: userAgent,
        timestamp: new Date().toISOString()
      })
      .run();

    return c.json({ success: true } as any, 200 as any);
  } catch {
    return c.json({ error: "Internal Server Error" } as any, 500 as any);
  }
}));

// Track sponsor click
analyticsRouter.openapi(trackSponsorClickRoute, typedHandler<typeof trackSponsorClickRoute>(async (c) => {
  const db = getDb(c);
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  const ua = c.req.header("User-Agent") || "unknown";
  if (!(await checkPersistentRateLimit(db, `click:${ip}`, ua, 10, 600))) {
    return c.json({ error: "Rate limit exceeded" } as any, 429 as any);
  }
  try {
    const { sponsor_id } = c.req.valid("json");

    // WR-04: Validate sponsor exists to prevent database pollution
    if (!sponsor_id || typeof sponsor_id !== 'string') {
      return c.json({ error: "Invalid sponsor ID" } as any, 400 as any);
    }

    const sponsor = await db.select({ id: schema.sponsors.id })
      .from(schema.sponsors)
      .where(and(eq(schema.sponsors.id, sponsor_id), eq(schema.sponsors.isActive, 1)))
      .get();

    if (!sponsor) {
      return c.json({ error: "Invalid sponsor" } as any, 400 as any);
    }

    const yearMonth = new Date().toISOString().slice(0, 7);

    await db.run(sql`
      INSERT INTO sponsor_metrics (id, sponsor_id, year_month, clicks, impressions)
      VALUES (${crypto.randomUUID()}, ${sponsor_id}, ${yearMonth}, 1, 0)
      ON CONFLICT(sponsor_id, year_month) DO UPDATE SET clicks = sponsor_metrics.clicks + 1
    `);

    return c.json({ success: true } as any, 200 as any);
  } catch {
    return c.json({ error: "Internal Server Error" } as any, 500 as any);
  }
}));

// Get platform analytics (admin)
analyticsRouter.openapi(getPlatformAnalyticsRoute, typedHandler<typeof getPlatformAnalyticsRoute>(async (c) => {
  const db = getDb(c);
  console.log("[Analytics] Fetching platform analytics...");
  try {
    const [
      totalViewsData,
      uniqueVisitorsData,
      topPagesDataRow,
      referrersDataRow,
      recentViewsDataRow,
      totalsDataRow,
      activityData,
    ] = await Promise.all([
      db.select({ total: sql<number>`count(${schema.pageAnalytics.path})` }).from(schema.pageAnalytics).get().catch(() => ({ total: 0 })),
      db.run(sql<{ unique_count: number }>`SELECT COUNT(DISTINCT user_agent) as unique_count FROM page_analytics`).then((r: any) => (r as any).rows?.[0] || { unique_count: 0 }).catch(() => ({ unique_count: 0 })),
      db.select({ path: schema.pageAnalytics.path, category: schema.pageAnalytics.category, views: sql<number>`count(${schema.pageAnalytics.path})` }).from(schema.pageAnalytics).groupBy(schema.pageAnalytics.path, schema.pageAnalytics.category).orderBy(desc(sql`views`)).limit(10).all().catch(() => []),
      db.select({ referrer: schema.pageAnalytics.referrer, visits: sql<number>`count(${schema.pageAnalytics.referrer})` }).from(schema.pageAnalytics).where(sql`referrer != ''`).groupBy(schema.pageAnalytics.referrer).orderBy(desc(sql`visits`)).limit(10).all().catch(() => []),
      db.select({ path: schema.pageAnalytics.path, category: schema.pageAnalytics.category, user_agent: schema.pageAnalytics.userAgent, referrer: schema.pageAnalytics.referrer, timestamp: schema.pageAnalytics.timestamp }).from(schema.pageAnalytics).orderBy(desc(schema.pageAnalytics.timestamp)).limit(20).all().catch(() => []),
      db.select({ category: schema.pageAnalytics.category, total: sql<number>`count(${schema.pageAnalytics.category})` }).from(schema.pageAnalytics).groupBy(schema.pageAnalytics.category).all().catch(() => []),
      db.run(sql<{ date: string; pageViews: number }>`
        SELECT
          date(timestamp, 'localtime') as date,
          COUNT(*) as pageViews
        FROM page_analytics
        WHERE timestamp >= datetime('now', '-30 days')
        GROUP BY date(timestamp, 'localtime')
        ORDER BY date ASC
      `).catch(() => ({ rows: [] }))
    ]);

    const assetsCount = await db.select({ total: sql<number>`count(${schema.mediaTags.key})` }).from(schema.mediaTags).get().catch(() => ({ total: 0 }));

    // usage_metrics table may not exist in all environments (needs migration)
    let apiCount = { total: 0 };
    let latencyData: { rows: Array<{ date: string; avg_latency: number }> } = { rows: [] };
    try {
      apiCount = await db.run(sql<{ total: number }>`SELECT COUNT(id) as total FROM usage_metrics`)
        .then((r: any) => (r as any).rows?.[0] || { total: 0 })
        .catch(() => ({ total: 0 }));
      const res = await db.run(sql<{ date: string; avg_latency: number }>`
        SELECT
          date(timestamp, 'localtime') as date,
          AVG(latency_ms) as avg_latency
        FROM usage_metrics
        WHERE timestamp >= datetime('now', '-30 days')
        GROUP BY date(timestamp, 'localtime')
        ORDER BY date ASC
      `);
      latencyData = { rows: (res as any).rows || [] };
    } catch {
      // Table doesn't exist or other error - use defaults
      apiCount = { total: 0 };
      latencyData = { rows: [] };
    }

    const topPages = topPagesDataRow.map((p: any) => ({
      path: String(p.path),
      category: String(p.category),
      views: Number(p.views)
    }));

    const topReferrers = referrersDataRow.map((r: any) => ({
      referrer: String(r.referrer),
      visits: Number(r.visits),
    }));

    const recentViews = recentViewsDataRow.map((v: any) => ({
      path: String(v.path),
      category: String(v.category),
      user_agent: String(v.user_agent || ""),
      referrer: String(v.referrer || ""),
      timestamp: String(v.timestamp)
    }));

    const totals = totalsDataRow.map((t: any) => ({
      category: String(t.category),
      total: Number(t.total)
    }));

    const userActivity = ((activityData as any).rows || []).map((a: any) => ({
      date: String(a.date),
      pageViews: Number(a.pageViews),
    }));

    const latency = (latencyData.rows || []).map((l: any) => ({
      date: String(l.date),
      avg_latency: Number(l.avg_latency)
    }));

    return c.json({
      totalPageViews: Number(totalViewsData?.total || 0),
      uniqueVisitors: Number(uniqueVisitorsData?.unique_count || 0),
      topPages,
      topReferrers,
      recentViews,
      totals,
      userActivity,
      latency,
      resourceUsage: {
        totalAssets: Number(assetsCount?.total || 0),
        totalStorage: 0,
        apiCalls: Number(apiCount?.total || 0),
      }
    } as any, 200 as any);
  } catch (err) {
    console.error("[Analytics] Platform metrics error:", err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    return c.json({
      error: "Failed to fetch platform metrics",
      details: errorMsg.includes("no such table") ? "Required database table missing. Run migrations." : errorMsg
    } as any, 500 as any);
  }
}));

// Get roster stats (admin)
analyticsRouter.openapi(getRosterStatsRoute, typedHandler<typeof getRosterStatsRoute>(async (c) => {
  const db = getDb(c);
  try {
    const results = await db.run(sql<{
      user_id: string;
      nickname: string | null;
      member_type: string | null;
      avatar: string | null;
      attended_events: number;
      manual_prep_hours: number;
      event_volunteer_hours: number;
    }>`
      SELECT
        u.user_id,
        u.nickname,
        u.member_type,
        auth_user.image as avatar,
        sum(case when s.attended = 1 then 1 else 0 end) as attended_events,
        coalesce(sum(case when s.attended = 1 then s.prep_hours else 0 end), 0) as manual_prep_hours,
        coalesce(sum(case when s.attended = 1 and e.is_volunteer = 1 then (strftime('%s', e.date_end) - strftime('%s', e.date_start)) / 3600.0 else 0 end), 0) as event_volunteer_hours
      FROM user_profiles u
      INNER JOIN user auth_user ON auth_user.id = u.user_id
      LEFT JOIN event_signups s ON u.user_id = s.user_id
      LEFT JOIN events e ON s.event_id = e.id AND e.status = 'published' AND e.is_deleted = 0
      GROUP BY u.user_id, u.nickname, u.member_type, auth_user.image
      ORDER BY u.nickname ASC
    `);

    const rows = (results as any).rows || [];
    const roster = rows.map((r: any) => ({
      user_id: String(r.user_id),
      nickname: r.nickname || null,
      member_type: r.member_type || null,
      attended_events: Number(r.attended_events || 0),
      manual_prep_hours: Number(r.manual_prep_hours || 0),
      event_volunteer_hours: Number(r.event_volunteer_hours || 0),
      avatar: r.avatar ? String(r.avatar) : null
    }));

    return c.json({ roster } as any, 200 as any);
  } catch {
    return c.json({ error: "Failed to fetch roster stats" } as any, 500 as any);
  }
}));

// Get leaderboard
analyticsRouter.openapi(getLeaderboardRoute, typedHandler<typeof getLeaderboardRoute>(async (c) => {
  const db = getDb(c);
  try {
    const results = await db.run(sql<{
      user_id: string;
      first_name: string;
      last_name: string | null;
      nickname: string | null;
      member_type: string;
      avatar: string | null;
      badge_count: number;
    }>`
      SELECT
        u.id as user_id,
        u.name as first_name,
        p.last_name,
        p.nickname,
        p.member_type,
        u.image as avatar,
        COUNT(ub.id) as badge_count
      FROM user as u
      INNER JOIN user_profiles as p ON u.id = p.user_id
      INNER JOIN user_badges as ub ON u.id = ub.user_id
      WHERE p.show_on_about = 1
      GROUP BY u.id, u.name, p.last_name, p.nickname, p.member_type, u.image
      ORDER BY badge_count DESC
      LIMIT 50
    `);

    const rows = (results as any).rows || [];
    const leaderboard = rows.map((r: any) => {
      const isMinor = r.member_type === "student";
      return {
        user_id: String(r.user_id),
        first_name: isMinor ? "ARES Member" : String(r.first_name || "ARES"),
        last_name: isMinor ? null : (r.last_name || null),
        nickname: r.nickname || null,
        member_type: String(r.member_type || "student"),
        badge_count: Number(r.badge_count),
        avatar: r.avatar ? String(r.avatar) : null
      };
    });

    return c.json({ leaderboard } as any, 200 as any);
  } catch {
    return c.json({ error: "Failed to fetch leaderboard" } as any, 500 as any);
  }
}));

// Get stats (admin)
analyticsRouter.openapi(getStatsRoute, typedHandler<typeof getStatsRoute>(async (c) => {
  const db = getDb(c);
  try {
    const [postsCount, eventsCount, docsCount, securityBlocksRow, dbSettings] = await Promise.all([
      db.select({ total: sql<number>`count(${schema.posts.slug})` }).from(schema.posts).where(eq(schema.posts.isDeleted, 0)).get(),
      db.select({ total: sql<number>`count(${schema.events.id})` }).from(schema.events).where(eq(schema.events.isDeleted, 0)).get(),
      db.select({ total: sql<number>`count(${schema.docs.slug})` }).from(schema.docs).where(eq(schema.docs.isDeleted, 0)).get(),
      db.select({ total: sql<number>`count(${schema.auditLog.id})` }).from(schema.auditLog).where(eq(schema.auditLog.action, "SECURITY_BLOCK")).get(),
      getDbSettings(c)
    ]);

    return c.json({
      posts: Number(postsCount?.total || 0),
      events: Number(eventsCount?.total || 0),
      docs: Number(docsCount?.total || 0),
      integrations: {
        zulip: !!dbSettings["ZULIP_API_KEY"],
        github: !!dbSettings["GITHUB_PAT"],
        discord: !!dbSettings["DISCORD_WEBHOOK_URL"],
        bluesky: !!dbSettings["BLUESKY_APP_PASSWORD"],
        band: !!dbSettings["BAND_ACCESS_TOKEN"],
        slack: !!dbSettings["SLACK_WEBHOOK_URL"],
        gcal: !!dbSettings["GCAL_PRIVATE_KEY"]
      },
      securityBlocks: Number(securityBlocksRow?.total || 0)
    } as any, 200 as any);
  } catch {
    return c.json({ error: "Failed to fetch stats" } as any, 500 as any);
  }
}));

// Search
analyticsRouter.openapi(searchRoute, typedHandler<typeof searchRoute>(async (c) => {
  const db = getDb(c);
  const { q } = c.req.valid("query");
  try {
    // SCA-FTS-01: Sanitize FTS5 query
    const qClean = (q || "").replace(/[^a-zA-Z0-9\s]/g, "").trim();
    if (!qClean) return c.json({ results: [] } as any, 200 as any);
    const ftsQ = `"${qClean}"*`;

    const [postsReq, eventsReq, docsReq] = await Promise.all([
      db.run(sql<{ id: string; title: string }>`SELECT f.slug as id, f.title FROM posts_fts f JOIN posts p ON f.slug = p.slug WHERE p.is_deleted = 0 AND p.status = 'published' AND f.posts_fts MATCH ${ftsQ} LIMIT 5`),
      db.run(sql<{ id: string; title: string }>`SELECT f.id, f.title FROM events_fts f JOIN events e ON f.id = e.id WHERE e.is_deleted = 0 AND e.status = 'published' AND f.events_fts MATCH ${ftsQ} LIMIT 5`),
      db.run(sql<{ id: string; title: string }>`SELECT f.slug as id, f.title FROM docs_fts f JOIN docs d ON f.slug = d.slug WHERE d.status = 'published' AND d.is_deleted = 0 AND f.docs_fts MATCH ${ftsQ} LIMIT 5`)
    ]);

    const postsRows = (postsReq as any).rows || [];
    const eventsRows = (eventsReq as any).rows || [];
    const docsRows = (docsReq as any).rows || [];

    const results = [
      ...(postsRows || []).map((r: any) => ({ type: "blog" as const, id: r.id, title: r.title })),
      ...(eventsRows || []).map((r: any) => ({ type: "event" as const, id: r.id, title: r.title })),
      ...(docsRows || []).map((r: any) => ({ type: "doc" as const, id: r.id, title: r.title }))
    ];

    return c.json({ results } as any, 200 as any);
  } catch {
    return c.json({ error: "Search failed" } as any, 500 as any);
  }
}));

export default analyticsRouter;
