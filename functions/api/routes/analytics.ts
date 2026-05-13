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

interface SearchResultRow {
  id: string;
  title: string;
}

const _analyticsRouter = new OpenAPIHono<AppEnv>();

import perfRouter from "./analytics/performance";
_analyticsRouter.route("/performance", perfRouter);

// CR-01 FIX: Apply authentication to all analytics routes
// Public routes (page view tracking, search) have rate limiting only
_analyticsRouter.use("/admin/stats", ensureAuth);
_analyticsRouter.use("/admin/roster-stats", ensureAuth);
_analyticsRouter.use("/leaderboard", ensureAuth);

// Apply ensureAdmin ONLY to administrative routes
_analyticsRouter.use("/admin/*", ensureAdmin);

_analyticsRouter.use("/sponsor-click", turnstileMiddleware());
_analyticsRouter.use("/search", rateLimitMiddleware(100, 60));

// Track page view
export const analyticsRouter = _analyticsRouter
    .openapi(
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
    )
    .openapi(
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

        await db.insert(schema.sponsorMetrics)
          .values({
            id: crypto.randomUUID(),
            sponsorId,
            yearMonth,
            clicks: 1,
            impressions: 0,
          })
          .onConflictDoUpdate({
            target: [schema.sponsorMetrics.sponsorId, schema.sponsorMetrics.yearMonth],
            set: {
              clicks: sql`${schema.sponsorMetrics.clicks} + 1`,
            },
          })
          .run();

        return c.json({ success: true }, 200);
      }
    )
    .openapi(
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
            .from(schema.pageAnalytics).groupBy(schema.pageAnalytics.path, schema.pageAnalytics.category).orderBy(desc(sql`count(${schema.pageAnalytics.path})`)).limit(10).all()
            .catch((err) => { console.error("Analytics: Failed to fetch top pages:", err); return []; }),
          db.select({ referrer: schema.pageAnalytics.referrer, visits: sql<number>`count(${schema.pageAnalytics.referrer})` })
            .from(schema.pageAnalytics).where(sql`referrer != ''`).groupBy(schema.pageAnalytics.referrer).orderBy(desc(sql`count(${schema.pageAnalytics.referrer})`)).limit(10).all()
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
    )
    .openapi(
      getRosterStatsRoute,
      async (c) => {
        const db = getDb(c);

        const attendedEventsCount = sql<number>`sum(case when ${schema.eventSignups.attended} = 1 then 1 else 0 end)`;
        const manualPrepHoursSum = sql<number>`coalesce(sum(case when ${schema.eventSignups.attended} = 1 then ${schema.eventSignups.prepHours} else 0 end), 0)`;
        const volunteerHoursCalc = sql<number>`coalesce(sum(case when ${schema.eventSignups.attended} = 1 and ${schema.events.isVolunteer} = 1 then (strftime('%s', ${schema.events.dateEnd}) - strftime('%s', ${schema.events.dateStart})) / 3600.0 else 0 end), 0)`;

        const results = await db
          .select({
            userId: schema.userProfiles.userId,
            nickname: schema.userProfiles.nickname,
            memberType: schema.userProfiles.memberType,
            avatar: schema.user.image,
            attendedEvents: attendedEventsCount,
            manualPrepHours: manualPrepHoursSum,
            eventVolunteerHours: volunteerHoursCalc,
          })
          .from(schema.userProfiles)
          .innerJoin(schema.user, eq(schema.user.id, schema.userProfiles.userId))
          .leftJoin(schema.eventSignups, eq(schema.userProfiles.userId, schema.eventSignups.userId))
          .leftJoin(schema.events, and(
            eq(schema.eventSignups.eventId, schema.events.id),
            eq(schema.events.status, 'published'),
            eq(schema.events.isDeleted, 0)
          ))
          .groupBy(schema.userProfiles.userId, schema.userProfiles.nickname, schema.userProfiles.memberType, schema.user.image)
          .orderBy(schema.userProfiles.nickname);

        const roster = results.map((r) => ({
          userId: String(r.userId),
          nickname: r.nickname || null,
          memberType: r.memberType || null,
          attendedEvents: Number(r.attendedEvents ?? 0),
          manualPrepHours: Number(r.manualPrepHours ?? 0),
          eventVolunteerHours: Number(r.eventVolunteerHours ?? 0),
          avatar: r.avatar || null
        }));

        return c.json({ roster }, 200);
      }
    )
    .openapi(
      getLeaderboardRoute,
      async (c) => {
        const db = getDb(c);

        const results = await db
          .select({
            userId: schema.user.id,
            firstName: schema.user.name,
            lastName: schema.userProfiles.lastName,
            nickname: schema.userProfiles.nickname,
            memberType: schema.userProfiles.memberType,
            avatar: schema.user.image,
            badgeCount: sql<number>`count(${schema.userBadges.id})`,
          })
          .from(schema.user)
          .innerJoin(schema.userProfiles, eq(schema.user.id, schema.userProfiles.userId))
          .innerJoin(schema.userBadges, eq(schema.user.id, schema.userBadges.userId))
          .where(eq(schema.userProfiles.showOnAbout, 1))
          .groupBy(schema.user.id, schema.user.name, schema.userProfiles.lastName, schema.userProfiles.nickname, schema.userProfiles.memberType, schema.user.image)
          .orderBy(desc(sql<number>`count(${schema.userBadges.id})`))
          .limit(QUERY_LIMITS.AUDIT_LOG_LIMIT)
          .all();

        const leaderboard = results.map((r) => {
          // CRITICAL-002 FIX: Redact all PII for students (COPPA compliance)
          const isMinor = r.memberType === "student";
          return {
            userId: String(r.userId),
            firstName: isMinor ? "ARES Member" : String(r.firstName || "ARES"),
            lastName: isMinor ? null : (r.lastName || null),
            nickname: r.nickname || null,
            memberType: String(r.memberType || "student"),
            badgeCount: Number(r.badgeCount),
            avatar: r.avatar || null
          };
        });

        return c.json({ leaderboard }, 200)
      }
    )
    .openapi(
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
    )
    .openapi(
      searchRoute,
      async (c) => {
        const db = getDb(c);
        const { q } = c.req.valid("query");
        // W3A-SEC-01: Use proper FTS5 query sanitization to prevent SQL injection
        // Allows alphanumeric, spaces, hyphens, and periods. Uses proper FTS5 phrase search.
        const sanitizeFtsQuery = (query: string): string => {
          // Remove all characters except alphanumeric, spaces, hyphens, and periods
          const cleanQ = (query || "").replace(/[^\w\s\-.]/g, "").trim();
          if (!cleanQ) return "";
          // Escape double quotes by doubling them (FTS5 escaping)
          // Use prefix search with * for better UX
          return `"${cleanQ.replace(/"/g, '""')}*`;
        };
        const ftsQ = sanitizeFtsQuery(String(q || ""));
        if (!ftsQ) {
          return c.json({ results: [] }, 200);
        }

        const [postsReq, eventsReq, docsReq] = await Promise.all([
          db.all(`SELECT f.slug as id, f.title FROM posts_fts f JOIN posts p ON f.slug = p.slug WHERE p.is_deleted = 0 AND p.status = 'published' AND f.posts_fts MATCH ${ftsQ} LIMIT ${QUERY_LIMITS.GLOBAL_SEARCH}`),
          db.all(`SELECT f.id, f.title FROM events_fts f JOIN events e ON f.id = e.id WHERE e.is_deleted = 0 AND e.status = 'published' AND f.events_fts MATCH ${ftsQ} LIMIT ${QUERY_LIMITS.GLOBAL_SEARCH}`),
          db.all(`SELECT f.slug as id, f.title FROM docs_fts f JOIN docs d ON f.slug = d.slug WHERE d.status = 'published' AND d.is_deleted = 0 AND f.docs_fts MATCH ${ftsQ} LIMIT ${QUERY_LIMITS.GLOBAL_SEARCH}`)
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
// Track sponsor click
// Get platform analytics (admin)
// Get roster stats (admin)
// CRITICAL-002 FIX: SQL query only selects non-PII fields (nickname, memberType, avatar)
// No email, phone, or full name data is selected from user_profiles or user tables
// Get leaderboard
// CRITICAL-002 FIX: Student PII redaction applied at application layer
// Students (memberType = 'student') have names replaced with "ARES Member"
// This endpoint is public and must not expose student PII
// Get stats (admin)
// Search
export default analyticsRouter;
