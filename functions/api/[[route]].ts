import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import { cors } from "hono/cors";
import { Bindings, AppEnv, checkRateLimit, logSystemError } from "./middleware";

// ── Domain Routers ───────────────────────────────────────────────────
import authRouter from "./routes/auth";
import analyticsRouter from "./routes/analytics";
import sponsorsRouter from "./routes/sponsors";
import tbaRouter from "./routes/tba";
import outreachRouter from "./routes/outreach";
import awardsRouter from "./routes/awards";
import postsRouter from "./routes/posts";
import eventsRouter, { adminEventsRouter, syncEventsRouter } from "./routes/events/index";
import docsRouter from "./routes/docs";
import mediaRouter, { adminMediaRouter } from "./routes/media";
import settingsRouter from "./routes/settings";
import judgesRouter from "./routes/judges";
import profilesRouter from "./routes/profiles";
import logisticsRouter from "./routes/logistics";
import usersRouter from "./routes/users";
import commentsRouter from "./routes/comments";
import { inquiriesRouter, adminInquiriesRouter } from "./routes/inquiries";
import badgesRouter from "./routes/badges";
import { locationsRouter, adminLocationsRouter } from "./routes/locations";
import sitemapRouter from "./routes/sitemap";
import githubRouter from "./routes/github";
import githubWebhookRouter from "./routes/githubWebhook";
import zulipWebhookRouter from "./routes/zulipWebhook";
import zulipRouter from "./routes/zulip";
import notificationsRouter from "./routes/notifications";

const app = new Hono<AppEnv>();
const apiRouter = new Hono<AppEnv>();
// ── Isolate-Memory Rate Limiting ─────────────────────────────────────
app.use("*", async (c, next) => {
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  if (ip !== "unknown" && !c.req.path.startsWith("/assets")) {
    const allowed = checkRateLimit(ip, 150, 60); // 150 requests per minute
    if (!allowed) {
      console.warn(`[Local Rate Limit] Blocked IP ${ip}`);
      return c.json({ error: "Too many requests. Please try again later." }, 429);
    }
  }
  await next();
});

// ── Request Logger (suppressed in production to reduce log noise) ────
app.use("*", async (c, next) => {
  if (c.env?.ENVIRONMENT !== "production") {
    const logUrl = new URL(c.req.url);
    // SEC-F03: Strip auth-related query params before logging
    for (const key of [...logUrl.searchParams.keys()]) {
      if (/token|secret|key|auth|session/i.test(key)) {
        logUrl.searchParams.set(key, "***");
      }
    }
    console.log(`[${c.req.method}] ${logUrl.pathname}${logUrl.search}`);
  }
  await next();
});

// ── SEC-04: CORS — restrict API to same-origin + trusted domains ─────
apiRouter.use("*", cors({
  origin: (origin, c) => {
    // Same-origin requests (no origin header) are always allowed
    if (!origin) return origin;
    // Dynamically trust the current request's origin
    const requestOrigin = new URL(c.req.url).origin;
    if (origin === requestOrigin) return origin;
    // Static trusted origins for development
    const trusted = [
      "http://localhost:5173",
      "http://localhost:8788",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:8788",
    ];
    if (trusted.includes(origin)) return origin;
    return undefined; // Deny
  },
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "x-better-auth-origin", "x-better-auth-session-id", "better-auth-agent"],
  credentials: true,
  maxAge: 86400,
}));

// ── Admin routes self-enforce auth via ensureAdmin per-handler ────────

// ── Mount Domain Routers ─────────────────────────────────────────────
// ── Auth
apiRouter.route("/auth", authRouter);

// ── Content (routes now self-enforce auth via ensureAdmin/ensureAuth)
apiRouter.route("/posts", postsRouter);
apiRouter.route("/docs", docsRouter);

apiRouter.route("/events", eventsRouter);
apiRouter.route("/admin/events", adminEventsRouter);
apiRouter.route("/admin/events/sync", syncEventsRouter);

apiRouter.route("/comments", commentsRouter);
apiRouter.route("/inquiries", inquiriesRouter);
apiRouter.route("/locations", locationsRouter);
apiRouter.route("/sponsors", sponsorsRouter);
apiRouter.route("/media", mediaRouter);
apiRouter.route("/awards", awardsRouter);
apiRouter.route("/outreach", outreachRouter);
apiRouter.route("/tba", tbaRouter);
apiRouter.route("/judges", judgesRouter);
apiRouter.route("/profile", profilesRouter);
apiRouter.route("/logistics", logisticsRouter);
apiRouter.route("/users", usersRouter);
apiRouter.route("/badges", badgesRouter);
apiRouter.route("/settings", settingsRouter);
apiRouter.route("/sitemap", sitemapRouter);
apiRouter.route("/notifications", notificationsRouter);
apiRouter.route("/analytics", analyticsRouter);
apiRouter.route("/github", githubRouter);
apiRouter.route("/zulip", zulipRouter);

// ── Admin Aliases (only where the dashboard explicitly uses /api/admin/*)
apiRouter.route("/admin/posts", postsRouter);
apiRouter.route("/admin/docs", docsRouter);
apiRouter.route("/admin/locations", adminLocationsRouter);
apiRouter.route("/admin/inquiries", adminInquiriesRouter);
apiRouter.route("/admin/comments", commentsRouter);
apiRouter.route("/admin/media", adminMediaRouter);
apiRouter.route("/admin/awards", awardsRouter);
apiRouter.route("/admin/outreach", outreachRouter);
apiRouter.route("/admin/judges", judgesRouter);
apiRouter.route("/admin/users", usersRouter);
apiRouter.route("/admin/logistics", logisticsRouter);
apiRouter.route("/admin/badges", badgesRouter);
apiRouter.route("/admin/settings", settingsRouter);
apiRouter.route("/admin/notifications", notificationsRouter);
apiRouter.route("/admin/analytics", analyticsRouter);
apiRouter.route("/admin/github", githubRouter);
apiRouter.route("/admin/zulip", zulipRouter);

// Special mount for logistics summary fallback (About page / Logistics tab)
// Handled by /api/profile/... endpoints now

// Webhooks (public — self-authenticated via signatures/tokens)
apiRouter.route("/webhooks/github", githubWebhookRouter);
apiRouter.route("/webhooks/zulip", zulipWebhookRouter);

// ── Global Platform Search (stays in aggregator — crosses domains) ───
const MAX_SEARCH_CACHE = 100;
const searchCache = new Map<string, { data: unknown; expiresAt: number }>();

function setSearchCache(key: string, value: { data: unknown; expiresAt: number }) {
  if (searchCache.size >= MAX_SEARCH_CACHE) {
    const first = searchCache.keys().next().value;
    if (first !== undefined) searchCache.delete(first);
  }
  searchCache.set(key, value);
}

apiRouter.get("/search", async (c) => {
  try {
    const q = c.req.query("q") || "";
    if (q.length < 3) return c.json({ results: [] });

    // Sanitize query for FTS MATCH
    const safeQ = q.replace(/"/g, '""');
    const ftsQ = `"${safeQ}"*`;

    // SEC-05: FTS Failsafe Cache (Denial of Wallet Protection)
    // FTS searches are expensive D1 operations. Cache them per V8 isolate for 60 seconds.
    const now = Date.now();
    const cached = searchCache.get(safeQ);
    if (cached && cached.expiresAt > now) {
      return c.json(cached.data);
    }

    const [postsReq, eventsReq, docsReq, usersReq] = await Promise.all([
      c.env.DB.prepare(
        "SELECT 'blog' as type, f.slug as id, f.title, f.snippet as matched_text FROM posts_fts f JOIN posts p ON f.slug = p.slug WHERE p.is_deleted = 0 AND p.status = 'published' AND f.posts_fts MATCH ? ORDER BY f.rank LIMIT 5"
      ).bind(ftsQ).all(),
      c.env.DB.prepare(
        "SELECT 'event' as type, f.id, f.title, f.description as matched_text FROM events_fts f JOIN events e ON f.id = e.id WHERE e.is_deleted = 0 AND e.status = 'published' AND f.events_fts MATCH ? ORDER BY f.rank LIMIT 5"
      ).bind(ftsQ).all(),
      c.env.DB.prepare(
        "SELECT 'doc' as type, f.slug as id, f.title, f.description as matched_text FROM docs_fts f JOIN docs d ON f.slug = d.slug WHERE d.status = 'published' AND d.is_deleted = 0 AND f.docs_fts MATCH ? ORDER BY f.rank LIMIT 5"
      ).bind(ftsQ).all(),
      c.env.DB.prepare(
        "SELECT 'user' as type, f.user_id as id, f.nickname as title, f.bio as matched_text FROM user_profiles_fts f JOIN user_profiles p ON f.user_id = p.user_id WHERE p.show_on_about = 1 AND f.user_profiles_fts MATCH ? ORDER BY f.rank LIMIT 5"
      ).bind(ftsQ).all()
    ]);

    const payload = { 
      results: [...(postsReq.results || []), ...(eventsReq.results || []), ...(docsReq.results || []), ...(usersReq.results || [])] 
    };

    setSearchCache(safeQ, { data: payload, expiresAt: now + 60000 });
    
    return c.json(payload);
  } catch (err) {
    console.error("D1 search error:", err);
    return c.json({ results: [] }, 500);
  }
});

// ── GAP-01: Audit Log Viewer (admin only) ────────────────────────────
apiRouter.get("/admin/audit-log", async (c) => {
  try {
    const limit = Math.min(Number(c.req.query("limit") || "50"), 200);
    const offset = Number(c.req.query("offset") || "0");
    const { results } = await c.env.DB.prepare(
      "SELECT id, action, resource_type, resource_id, actor, details, created_at FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?"
    ).bind(limit, offset).all();
    return c.json({ logs: results || [] });
  } catch (err) {
    console.error("Audit log read error:", err);
    return c.json({ logs: [] }, 500);
  }
});

app.onError(async (err, c) => {
  console.error("Global API Error:", err);
  
  try {
    if (c.env?.DB) {
      await logSystemError(c.env.DB, "GlobalErrorHandler", err.message || "Unknown error", err.stack);
    }
  } catch (logErr) {
    console.error("Failed to log system error in global handler", logErr);
  }

  if (err instanceof Error && err.name === "HTTPException") {
    return (err as { getResponse: () => Response }).getResponse();
  }

  // SEC-Z01: Mask technical error details for end users in production
  const isProd = c.env?.ENVIRONMENT === "production";
  return c.json({ 
    error: "Internal Server Error", 
    message: isProd ? "An unexpected system error occurred. ARES engineers have been notified." : err.message,
    stack: isProd ? undefined : err.stack
  }, 500);
});

// ── Mount at /api and /dashboard/api ─────────────────────────────────
app.route("/api", apiRouter);
app.route("/dashboard/api", apiRouter);

export const onRequest = handle(app);
// ── Scheduled Maintenance (Triggers) ──────────────────────────────────
import { purgeOldInquiries } from "./routes/inquiries";

export const scheduled = async (
  event: ScheduledEvent,
  env: Bindings,
  _ctx: ExecutionContext
) => {
  try {
    // 1. Fetch Retention Policies from Database
    const { results: settingsRows } = await env.DB.prepare(
      "SELECT key, value FROM settings WHERE key IN ('RETENTION_INQUIRY_DAYS', 'RETENTION_AUDIT_LOG_DAYS')"
    ).all();

    const settings: Record<string, string> = {};
    if (settingsRows) {
       for (const row of settingsRows as { key: string, value: string }[]) {
         settings[row.key] = row.value;
       }
    }

    const inquiryDays = Number(settings['RETENTION_INQUIRY_DAYS'] || "30");
    const auditDays = Number(settings['RETENTION_AUDIT_LOG_DAYS'] || "90");

    console.log(`[Scheduled] Starting maintenance. Inquiry: ${inquiryDays}d, Audit: ${auditDays}d.`);

    // 2. Execute Purges
    const [inquiryRes, auditRes] = await Promise.all([
      purgeOldInquiries(env.DB, inquiryDays),
      env.DB.prepare(
        "DELETE FROM audit_log WHERE created_at < datetime('now', '-' || ? || ' days')"
      ).bind(auditDays).run()
    ]);
    
    console.log(`[Scheduled] Maintenance complete. Purged ${inquiryRes.deleted} inquiries and ${auditRes.meta.changes} logs.`);
  } catch (err) {
    console.error("[Scheduled] Maintenance failed:", err);
  }
};

export default app;

