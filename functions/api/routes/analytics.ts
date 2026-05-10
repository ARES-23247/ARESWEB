import { QUERY_LIMITS } from "../utils/queryLimits";
import { ApiError } from "../middleware/errorHandler";
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

// ─────────────────────────────────────────────────────────────────────────────
// Type Inference from Schemas
// ─────────────────────────────────────────────────────────────────────────────

// Database Result Types
interface SqlUniqueCountResult {
  uniqueCount: number;
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
  userAgent: string;
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
  avgLatency: number;
}

interface RosterMemberRow {
  userId: string;
  nickname: string | null;
  memberType: string | null;
  avatar: string | null;
  attendedEvents: number;
  manualPrepHours: number;
  eventVolunteerHours: number;
}

interface LeaderboardRow {
  userId: string;
  firstName: string;
  lastName: string | null;
  nickname: string | null;
  memberType: string;
  avatar: string | null;
  badgeCount: number;
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
analyticsRouter.openapi(
  trackPageViewRoute,
  async (c) => {
    const db = getDb(c);
    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    const ua = c.req.header("User-Agent") || "unknown";
    if (!(await checkPersistentRateLimit(db, `track:${ip}`, ua, 20, 600))) {
      throw new ApiError("Rate limit exceeded", 429, "RATE_LIMIT_EXCEEDED");
    }
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

    return c.json({ success: true }, 200);
  }
);

// Track sponsor click
analyticsRouter.openapi(
  trackSponsorClickRoute,
  async (c) => {
    const db = getDb(c);
    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    const ua = c.req.header("User-Agent") || "unknown";
    if (!(await checkPersistentRateLimit(db, `click:${ip}`, ua, 10, 600))) {
      throw new ApiError("Rate limit exceeded", 429, "RATE_LIMIT_EXCEEDED");
    }
    const { sponsorId } = c.req.valid("json");

    // WR-04: Validate sponsor exists to prevent database pollution
    if (!sponsorId || typeof sponsorId !== 'string') {
      throw new ApiError("Invalid sponsor ID", 400, "VALIDATION_ERROR");
    }

    const sponsor = await db.select({ id: schema.sponsors.id })
      .from(schema.sponsors)
      .where(and(eq(schema.sponsors.id, sponsorId), eq(schema.sponsors.isActive, 1)))
      .get();

    if (!sponsor) {
      throw new ApiError("Invalid sponsor", 400, "VALIDATION_ERROR");
    }

    const yearMonth = new Date().toISOString().slice(0, 7);

    await db.all(sql`
      INSERT INTO sponsor_metrics (id, sponsor_id, year_month, clicks, impressions)
      VALUES (${crypto.randomUUID()}, ${sponsorId}, ${yearMonth}, 1, 0)
      ON CONFLICT(sponsor_id, year_month) DO UPDATE SET clicks = sponsor_metrics.clicks + 1
    `);

    return c.json({ success: true }, 200);
  }
);

// Get platform analytics (admin)
analyticsRouter.openapi(
  getPlatformAnalyticsRoute,
  async (c) => {
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
      db.all(sql<SqlUniqueCountResult>`SELECT COUNT(DISTINCT user_agent) as uniqueCount FROM page_analytics`)
        .then((results) => results?.[0] || { uniqueCount: 0 })
        .catch((err) => { console.error("Analytics: Failed to count unique visitors:", err); return { uniqueCount: 0 }; }),
      db.select({ path: schema.pageAnalytics.path, category: schema.pageAnalytics.category, views: sql<number>`count(${schema.pageAnalytics.path})` })
        .from(schema.pageAnalytics).groupBy(schema.pageAnalytics.path, schema.pageAnalytics.category).orderBy(desc(sql`views`)).limit(10).all()
        .catch((err) => { console.error("Analytics: Failed to fetch top pages:", err); return []; }),
      db.select({ referrer: schema.pageAnalytics.referrer, visits: sql<number>`count(${schema.pageAnalytics.referrer})` })
        .from(schema.pageAnalytics).where(sql`referrer != ''`).groupBy(schema.pageAnalytics.referrer).orderBy(desc(sql`visits`)).limit(10).all()
        .catch((err) => { console.error("Analytics: Failed to fetch top referrers:", err); return []; }),
      db.select({ path: schema.pageAnalytics.path, category: schema.pageAnalytics.category, userAgent: schema.pageAnalytics.userAgent, referrer: schema.pageAnalytics.referrer, timestamp: schema.pageAnalytics.timestamp })
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
          AVG(latency_ms) as avgLatency
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
      userAgent: String(v.userAgent || ""),
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
      avgLatency: Number(l.avgLatency)
    }));

    return c.json({
      totalPageViews: Number(totalViewsData?.total || 0),
      uniqueVisitors: Number((uniqueVisitorsData as SqlUniqueCountResult)?.uniqueCount || 0),
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
    }, 200)
  }
);

// Get roster stats (admin)
// CRITICAL-002 FIX: SQL query only selects non-PII fields (nickname, memberType, avatar)
// No email, phone, or full name data is selected from user_profiles or user tables
analyticsRouter.openapi(
  getRosterStatsRoute,
  async (c) => {
    const db = getDb(c);
    const results = await db.all(sql<RosterMemberRow>`
      SELECT
        u.user_id as userId,
        u.nickname,
        u.memberType,
        auth_user.image as avatar,
        sum(case when s.attended = 1 then 1 else 0 end) as attendedEvents,
        coalesce(sum(case when s.attended = 1 then s.prep_hours else 0 end), 0) as manualPrepHours,
        coalesce(sum(case when s.attended = 1 and e.isVolunteer = 1 then (strftime('%s', e.dateEnd) - strftime('%s', e.dateStart)) / 3600.0 else 0 end), 0) as eventVolunteerHours
      FROM user_profiles u
      INNER JOIN user auth_user ON auth_user.id = u.user_id
      LEFT JOIN event_signups s ON u.user_id = s.user_id
      LEFT JOIN events e ON s.event_id = e.id AND e.status = 'published' AND e.isDeleted = 0
      GROUP BY u.user_id, u.nickname, u.memberType, auth_user.image
      ORDER BY u.nickname ASC
    `);

    const rows = (results || []) as RosterMemberRow[];
    const roster = rows.map((r) => ({
      userId: String(r.userId),
      nickname: r.nickname || null,
      memberType: r.memberType || null,
      attendedEvents: Number(r.attendedEvents || 0),
      manualPrepHours: Number(r.manualPrepHours || 0),
      eventVolunteerHours: Number(r.eventVolunteerHours || 0),
      avatar: r.avatar ? String(r.avatar) : null
    }));

    return c.json({ roster }, 200);
  }
);

// Get leaderboard
// CRITICAL-002 FIX: Student PII redaction applied at application layer
// Students (memberType = 'student') have names replaced with "ARES Member"
// This endpoint is public and must not expose student PII
analyticsRouter.openapi(
  getLeaderboardRoute,
  async (c) => {
    const db = getDb(c);
    const results = await db.all(sql<LeaderboardRow>`
      SELECT
        u.id as userId,
        u.name as firstName,
        p.lastName,
        p.nickname,
        p.memberType,
        u.image as avatar,
        COUNT(ub.id) as badgeCount
      FROM user as u
      INNER JOIN user_profiles as p ON u.id = p.user_id
      INNER JOIN user_badges as ub ON u.id = ub.user_id
      WHERE p.showOnAbout = 1
      GROUP BY u.id, u.name, p.lastName, p.nickname, p.memberType, u.image
      ORDER BY badge_count DESC
      LIMIT ${QUERY_LIMITS.AUDIT_LOG_LIMIT}
    `);

    const rows = (results || []) as LeaderboardRow[];
    const leaderboard = rows.map((r) => {
      // CRITICAL-002 FIX: Redact all PII for students (COPPA compliance)
      const isMinor = r.memberType === "student";
      return {
        userId: String(r.userId),
        firstName: isMinor ? "ARES Member" : String(r.firstName || "ARES"),
        lastName: isMinor ? null : (r.lastName || null),
        nickname: r.nickname || null,
        memberType: String(r.memberType || "student"),
        badgeCount: Number(r.badgeCount),
        avatar: r.avatar ? String(r.avatar) : null
      };
    });

    return c.json({ leaderboard }, 200)
  }
);

// Get stats (admin)
analyticsRouter.openapi(
  getStatsRoute,
  async (c) => {
    const db = getDb(c);
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
        slack: !!dbSettings["SLACK_WEBHOOK_URL"],
        gcal: !!dbSettings["GCAL_PRIVATE_KEY"]
      },
      securityBlocks: Number(securityBlocksRow?.total || 0)
    }, 200)
  }
);

// Search
analyticsRouter.openapi(
  searchRoute,
  async (c) => {
    const db = getDb(c);
    const { q } = c.req.valid("query");
    // W3A-SEC-01: Use proper FTS5 query sanitization to prevent SQL injection
    // Allows alphanumeric, spaces, hyphens, and periods. Uses proper FTS5 phrase search.
    const sanitizeFtsQuery = (query: string): string => {
      const cleanQ = (query || "").replace(/[^\w\s\-.]/g, "").trim();
      if (!cleanQ) return "";
      return `"${cleanQ.replace(/"/g, '""')}*`;
    };
    const ftsQ = sanitizeFtsQuery(String(q || ""));
    if (!ftsQ) {
      return c.json({ results: [] }, 200);
    }

    const [postsReq, eventsReq, docsReq] = await Promise.all([
      db.all(sql<SearchResultRow>`SELECT f.slug as id, f.title FROM posts_fts f JOIN posts p ON f.slug = p.slug WHERE p.isDeleted = 0 AND p.status = 'published' AND f.posts_fts MATCH ${ftsQ} LIMIT ${QUERY_LIMITS.GLOBAL_SEARCH}`),
      db.all(sql<SearchResultRow>`SELECT f.id, f.title FROM events_fts f JOIN events e ON f.id = e.id WHERE e.isDeleted = 0 AND e.status = 'published' AND f.events_fts MATCH ${ftsQ} LIMIT ${QUERY_LIMITS.GLOBAL_SEARCH}`),
      db.all(sql<SearchResultRow>`SELECT f.slug as id, f.title FROM docs_fts f JOIN docs d ON f.slug = d.slug WHERE d.status = 'published' AND d.isDeleted = 0 AND f.docs_fts MATCH ${ftsQ} LIMIT ${QUERY_LIMITS.GLOBAL_SEARCH}`)
    ]);

    const postsRows = postsReq || [];
    const eventsRows = eventsReq || [];
    const docsRows = docsReq || [];

    const results = [
      ...(postsRows as SearchResultRow[]).map((r) => ({ type: "blog" as const, id: r.id, title: r.title })),
      ...(eventsRows as SearchResultRow[]).map((r) => ({ type: "event" as const, id: r.id, title: r.title })),
      ...(docsRows as SearchResultRow[]).map((r) => ({ type: "doc" as const, id: r.id, title: r.title }))
    ];

    return c.json({ results }, 200)
  }
);

export default analyticsRouter;
