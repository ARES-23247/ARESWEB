import { typedHandler } from "../utils/handler";
import { QUERY_LIMITS } from "../utils/queryLimits";
import { ApiError } from "../middleware/errorHandler";
import { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";

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

// ── Type Inference from Schemas ───────────────────────────────────────────────

type TrackPageViewBody = z.infer<typeof trackPageViewRoute.request.body.content["application/json"]["schema"]>;
type TrackPageViewSuccess = z.infer<typeof trackPageViewRoute.responses[200]["content"]["application/json"]["schema"]>;

type TrackSponsorClickBody = z.infer<typeof trackSponsorClickRoute.request.body.content["application/json"]["schema"]>;
type TrackSponsorClickSuccess = z.infer<typeof trackSponsorClickRoute.responses[200]["content"]["application/json"]["schema"]>;

type RosterStatsSuccess = z.infer<typeof getRosterStatsRoute.responses[200]["content"]["application/json"]["schema"]>;

type LeaderboardSuccess = z.infer<typeof getLeaderboardRoute.responses[200]["content"]["application/json"]["schema"]>;

type StatsSuccess = z.infer<typeof getStatsRoute.responses[200]["content"]["application/json"]["schema"]>;

type PlatformAnalyticsSuccess = z.infer<typeof getPlatformAnalyticsRoute.responses[200]["content"]["application/json"]["schema"]>;

type SearchQuery = z.infer<typeof searchRoute.request.query>;
type SearchSuccess = z.infer<typeof searchRoute.responses[200]["content"]["application/json"]["schema"]>;

// ── Database Result Types ───────────────────────────────────────────────────────

interface SqlUniqueCountResult {
  unique_count: number;
}

interface SqlTotalResult {
  total: number;
}

interface PlatformViewRow {
  path: string;
  category: string;
  views: number;
}

interface ReferrerRow {
  referrer: string;
  visits: number;
}

interface RecentViewRow {
  path: string;
  category: string;
  user_agent: string;
  referrer: string;
  timestamp: string;
}

interface CategoryTotalRow {
  category: string;
  total: number;
}

interface UserActivityRow {
  date: string;
  pageViews: number;
}

interface LatencyRow {
  date: string;
  avg_latency: number;
}

interface RosterMemberRow {
  user_id: string;
  nickname: string | null;
  member_type: string | null;
  avatar: string | null;
  attended_events: number;
  manual_prep_hours: number;
  event_volunteer_hours: number;
}

interface LeaderboardRow {
  user_id: string;
  first_name: string;
  last_name: string | null;
  nickname: string | null;
  member_type: string;
  avatar: string | null;
  badge_count: number;
}

interface SearchResultRow {
  id: string;
  title: string;
}

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
    throw new ApiError("Rate limit exceeded", 429, "RATE_LIMIT_EXCEEDED");
  }
    const body = c.req.valid("json") as TrackPageViewBody;
    const { path, category, referrer } = body;
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

    const response: TrackPageViewSuccess = { success: true };
    return c.json(response satisfies TrackPageViewSuccess, 200);
}));

// Track sponsor click
analyticsRouter.openapi(trackSponsorClickRoute, typedHandler<typeof trackSponsorClickRoute>(async (c) => {
  const db = getDb(c);
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  const ua = c.req.header("User-Agent") || "unknown";
  if (!(await checkPersistentRateLimit(db, `click:${ip}`, ua, 10, 600))) {
    throw new ApiError("Rate limit exceeded", 429, "RATE_LIMIT_EXCEEDED");
  }
    const body = c.req.valid("json") as TrackSponsorClickBody;
    const { sponsor_id } = body;

    // WR-04: Validate sponsor exists to prevent database pollution
    if (!sponsor_id || typeof sponsor_id !== 'string') {
      throw new ApiError("Invalid sponsor ID", 400, "VALIDATION_ERROR");
    }

    const sponsor = await db.select({ id: schema.sponsors.id })
      .from(schema.sponsors)
      .where(and(eq(schema.sponsors.id, sponsor_id), eq(schema.sponsors.isActive, 1)))
      .get();

    if (!sponsor) {
      throw new ApiError("Invalid sponsor", 400, "VALIDATION_ERROR");
    }

    const yearMonth = new Date().toISOString().slice(0, 7);

    await db.all(sql`
      INSERT INTO sponsor_metrics (id, sponsor_id, year_month, clicks, impressions)
      VALUES (${crypto.randomUUID()}, ${sponsor_id}, ${yearMonth}, 1, 0)
      ON CONFLICT(sponsor_id, year_month) DO UPDATE SET clicks = sponsor_metrics.clicks + 1
    `);

    const response: TrackSponsorClickSuccess = { success: true };
    return c.json(response satisfies TrackSponsorClickSuccess, 200);
}));

// Get platform analytics (admin)
analyticsRouter.openapi(getPlatformAnalyticsRoute, typedHandler<typeof getPlatformAnalyticsRoute>(async (c) => {
  const db = getDb(c);
  console.log("[Analytics] Fetching platform analytics...");
    const [
      totalViewsData,
      uniqueVisitorsData,
      topPagesDataRow,
      referrersDataRow,
      recentViewsDataRow,
      totalsDataRow,
      activityData,
    ] = await Promise.all([
      db.select({ total: sql<number>`count(${schema.pageAnalytics.path})` }).from(schema.pageAnalytics).get()
        .catch((err) => { console.error("Analytics: Failed to fetch total views:", err); return { total: 0 }; }),
      db.all(sql<SqlUniqueCountResult>`SELECT COUNT(DISTINCT user_agent) as unique_count FROM page_analytics`)
        .then((results) => results?.[0] || { unique_count: 0 })
        .catch((err) => { console.error("Analytics: Failed to count unique visitors:", err); return { unique_count: 0 }; }),
      db.select({ path: schema.pageAnalytics.path, category: schema.pageAnalytics.category, views: sql<number>`count(${schema.pageAnalytics.path})` })
        .from(schema.pageAnalytics).groupBy(schema.pageAnalytics.path, schema.pageAnalytics.category).orderBy(desc(sql`views`)).limit(10).all()
        .catch((err) => { console.error("Analytics: Failed to fetch top pages:", err); return []; }),
      db.select({ referrer: schema.pageAnalytics.referrer, visits: sql<number>`count(${schema.pageAnalytics.referrer})` })
        .from(schema.pageAnalytics).where(sql`referrer != ''`).groupBy(schema.pageAnalytics.referrer).orderBy(desc(sql`visits`)).limit(10).all()
        .catch((err) => { console.error("Analytics: Failed to fetch top referrers:", err); return []; }),
      db.select({ path: schema.pageAnalytics.path, category: schema.pageAnalytics.category, user_agent: schema.pageAnalytics.userAgent, referrer: schema.pageAnalytics.referrer, timestamp: schema.pageAnalytics.timestamp })
        .from(schema.pageAnalytics).orderBy(desc(schema.pageAnalytics.timestamp)).limit(20).all()
        .catch((err) => { console.error("Analytics: Failed to fetch recent views:", err); return []; }),
      db.select({ category: schema.pageAnalytics.category, total: sql<number>`count(${schema.pageAnalytics.category})` })
        .from(schema.pageAnalytics).groupBy(schema.pageAnalytics.category).all()
        .catch((err) => { console.error("Analytics: Failed to fetch category totals:", err); return []; }),
      db.all(sql<UserActivityRow>`
        SELECT
          date(timestamp, 'localtime') as date,
          COUNT(*) as pageViews
        FROM page_analytics
        WHERE timestamp >= datetime('now', '-30 days')
        GROUP BY date(timestamp, 'localtime')
        ORDER BY date ASC
      `).catch((err) => { console.error("Analytics: Failed to fetch user activity:", err); return []; })
    ]);

    const assetsCount = await db.select({ total: sql<number>`count(${schema.mediaTags.key})` }).from(schema.mediaTags).get()
      .catch((err) => { console.error("Analytics: Failed to fetch asset count:", err); return { total: 0 }; });

    // usage_metrics table may not exist in all environments (needs migration)
    let apiCount: SqlTotalResult;
    let latencyData: LatencyRow[];
    try {
      const apiResults = await db.all(sql<SqlTotalResult>`SELECT COUNT(id) as total FROM usage_metrics`);
      apiCount = (apiResults?.[0] as SqlTotalResult) || { total: 0 };
      const res = await db.all(sql<LatencyRow>`
        SELECT
          date(timestamp, 'localtime') as date,
          AVG(latency_ms) as avg_latency
        FROM usage_metrics
        WHERE timestamp >= datetime('now', '-30 days')
        GROUP BY date(timestamp, 'localtime')
        ORDER BY date ASC
      `);
      latencyData = (res || []) as LatencyRow[];
    } catch {
      // Table doesn't exist or other error - use defaults
      apiCount = { total: 0 };
      latencyData = [];
    }

    const topPages = (topPagesDataRow as PlatformViewRow[]).map((p) => ({
      path: String(p.path),
      category: String(p.category),
      views: Number(p.views)
    }));

    const topReferrers = (referrersDataRow as ReferrerRow[]).map((r) => ({
      referrer: String(r.referrer),
      visits: Number(r.visits),
    }));

    const recentViews = (recentViewsDataRow as RecentViewRow[]).map((v) => ({
      path: String(v.path),
      category: String(v.category),
      user_agent: String(v.user_agent || ""),
      referrer: String(v.referrer || ""),
      timestamp: String(v.timestamp)
    }));

    const totals = (totalsDataRow as CategoryTotalRow[]).map((t) => ({
      category: String(t.category),
      total: Number(t.total)
    }));

    const userActivity = (activityData as UserActivityRow[]).map((a) => ({
      date: String(a.date),
      pageViews: Number(a.pageViews),
    }));

    const latency = (latencyData || []).map((l: LatencyRow) => ({
      date: String(l.date),
      avg_latency: Number(l.avg_latency)
    }));

    const response: PlatformAnalyticsSuccess = {
      totalPageViews: Number(totalViewsData?.total || 0),
      uniqueVisitors: Number((uniqueVisitorsData as SqlUniqueCountResult)?.unique_count || 0),
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
    };
    return c.json(response satisfies PlatformAnalyticsSuccess, 200);
}));

// Get roster stats (admin)
// CRITICAL-002 FIX: SQL query only selects non-PII fields (nickname, member_type, avatar)
// No email, phone, or full name data is selected from user_profiles or user tables
analyticsRouter.openapi(getRosterStatsRoute, typedHandler<typeof getRosterStatsRoute>(async (c) => {
  const db = getDb(c);
    const results = await db.all(sql<RosterMemberRow>`
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

    const rows = (results || []) as RosterMemberRow[];
    const roster = rows.map((r) => ({
      user_id: String(r.user_id),
      nickname: r.nickname || null,
      member_type: r.member_type || null,
      attended_events: Number(r.attended_events || 0),
      manual_prep_hours: Number(r.manual_prep_hours || 0),
      event_volunteer_hours: Number(r.event_volunteer_hours || 0),
      avatar: r.avatar ? String(r.avatar) : null
    }));

    const response: RosterStatsSuccess = { roster };
    return c.json(response satisfies RosterStatsSuccess, 200);
}));

// Get leaderboard
// CRITICAL-002 FIX: Student PII redaction applied at application layer
// Students (member_type = 'student') have names replaced with "ARES Member"
// This endpoint is public and must not expose student PII
analyticsRouter.openapi(getLeaderboardRoute, typedHandler<typeof getLeaderboardRoute>(async (c) => {
  const db = getDb(c);
    const results = await db.all(sql<LeaderboardRow>`
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
      LIMIT ${QUERY_LIMITS.AUDIT_LOG_LIMIT}
    `);

    const rows = (results || []) as LeaderboardRow[];
    const leaderboard = rows.map((r) => {
      // CRITICAL-002 FIX: Redact all PII for students (COPPA compliance)
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

    const response: LeaderboardSuccess = { leaderboard };
    return c.json(response satisfies LeaderboardSuccess, 200);
}));

// Get stats (admin)
analyticsRouter.openapi(getStatsRoute, typedHandler<typeof getStatsRoute>(async (c) => {
  const db = getDb(c);
    const [postsCount, eventsCount, docsCount, securityBlocksRow, dbSettings] = await Promise.all([
      db.select({ total: sql<number>`count(${schema.posts.slug})` }).from(schema.posts).where(eq(schema.posts.isDeleted, 0)).get(),
      db.select({ total: sql<number>`count(${schema.events.id})` }).from(schema.events).where(eq(schema.events.isDeleted, 0)).get(),
      db.select({ total: sql<number>`count(${schema.docs.slug})` }).from(schema.docs).where(eq(schema.docs.isDeleted, 0)).get(),
      db.select({ total: sql<number>`count(${schema.auditLog.id})` }).from(schema.auditLog).where(eq(schema.auditLog.action, "SECURITY_BLOCK")).get(),
      getDbSettings(c)
    ]);

    const response: StatsSuccess = {
      posts: Number(postsCount?.total || 0),
      events: Number(eventsCount?.total || 0),
      docs: Number(docsCount?.total || 0),
      integrations: {
        zulip: !!dbSettings["ZULIP_API_KEY"],
        github: !!dbSettings["GITHUB_PAT"],
        discord: !!dbSettings["DISCORD_WEBHOOK_URL"],
        bluesky: !!dbSettings["BLUESKY_APP_PASSWORD"],
        slack: !!dbSettings["SLACK_WEBHOOK_URL"],
        gcal: !!dbSettings["GCAL_PRIVATE_KEY"]
      },
      securityBlocks: Number(securityBlocksRow?.total || 0)
    };
    return c.json(response satisfies StatsSuccess, 200);
}));

// Search
analyticsRouter.openapi(searchRoute, typedHandler<typeof searchRoute>(async (c) => {
  const db = getDb(c);
  const query = c.req.valid("query") as SearchQuery;
  const { q } = query;
    // W3A-SEC-01: Use proper FTS5 query sanitization to prevent SQL injection
    // Allows alphanumeric, spaces, hyphens, and periods. Uses proper FTS5 phrase search.
    const sanitizeFtsQuery = (query: string): string => {
      const cleanQ = (query || "").replace(/[^\w\s\-.]/g, "").trim();
      if (!cleanQ) return "";
      return `"${cleanQ.replace(/"/g, '""')}*`;
    };
    const ftsQ = sanitizeFtsQuery(String(q || ""));
    if (!ftsQ) {
      const emptyResponse: SearchSuccess = { results: [] };
      return c.json(emptyResponse satisfies SearchSuccess, 200);
    }

    const [postsReq, eventsReq, docsReq] = await Promise.all([
      db.all(sql<SearchResultRow>`SELECT f.slug as id, f.title FROM posts_fts f JOIN posts p ON f.slug = p.slug WHERE p.is_deleted = 0 AND p.status = 'published' AND f.posts_fts MATCH ${ftsQ} LIMIT ${QUERY_LIMITS.GLOBAL_SEARCH}`),
      db.all(sql<SearchResultRow>`SELECT f.id, f.title FROM events_fts f JOIN events e ON f.id = e.id WHERE e.is_deleted = 0 AND e.status = 'published' AND f.events_fts MATCH ${ftsQ} LIMIT ${QUERY_LIMITS.GLOBAL_SEARCH}`),
      db.all(sql<SearchResultRow>`SELECT f.slug as id, f.title FROM docs_fts f JOIN docs d ON f.slug = d.slug WHERE d.status = 'published' AND d.is_deleted = 0 AND f.docs_fts MATCH ${ftsQ} LIMIT ${QUERY_LIMITS.GLOBAL_SEARCH}`)
    ]);

    const postsRows = postsReq || [];
    const eventsRows = eventsReq || [];
    const docsRows = docsReq || [];

    const results = [
      ...(postsRows as SearchResultRow[]).map((r) => ({ type: "blog" as const, id: r.id, title: r.title })),
      ...(eventsRows as SearchResultRow[]).map((r) => ({ type: "event" as const, id: r.id, title: r.title })),
      ...(docsRows as SearchResultRow[]).map((r) => ({ type: "doc" as const, id: r.id, title: r.title }))
    ];

    const response: SearchSuccess = { results };
    return c.json(response satisfies SearchSuccess, 200);
}));

export default analyticsRouter;
