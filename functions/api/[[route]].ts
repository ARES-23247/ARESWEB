import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import { cors } from "hono/cors";
import { Bindings, ensureAdmin } from "./routes/_shared";

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
import mediaRouter from "./routes/media";
import settingsRouter from "./routes/settings";
import judgesRouter from "./routes/judges";
import profilesRouter from "./routes/profiles";
import commentsRouter from "./routes/comments";
import inquiriesRouter from "./routes/inquiries";
import badgesRouter from "./routes/badges";
import { locationsRouter } from "./routes/locations";
import sitemapRouter from "./routes/sitemap";
import githubRouter from "./routes/github";
import githubWebhookRouter from "./routes/githubWebhook";
import zulipWebhookRouter from "./routes/zulipWebhook";
import zulipRouter from "./routes/zulip";
import notificationsRouter from "./routes/notifications";

const app = new Hono<{ Bindings: Bindings }>();
const apiRouter = new Hono<{ Bindings: Bindings }>();

// ── Rate Limiting (In-Memory per-isolate) ─────────────────────────────
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100;

app.use("*", async (c, next) => {
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  
  // Skip rate limiting for static assets or internal
  if (ip !== "unknown" && !c.req.path.startsWith("/assets")) {
    const now = Date.now();
    let record = rateLimitMap.get(ip);
    
    if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
      record = { count: 0, windowStart: now };
    }
    
    record.count++;
    rateLimitMap.set(ip, record);
    
    // Clean up old entries occasionally (10% chance)
    if (Math.random() < 0.1) {
      for (const [key, val] of rateLimitMap.entries()) {
        if (now - val.windowStart > RATE_LIMIT_WINDOW_MS) {
          rateLimitMap.delete(key);
        }
      }
    }
    
    if (record.count > MAX_REQUESTS_PER_WINDOW) {
      console.warn(`[Rate Limit] Blocked IP ${ip} - ${record.count} reqs / 1m`);
      return c.json({ error: "Too many requests. Please try again later." }, 429);
    }
  }
  
  await next();
});

// ── Request Logger ───────────────────────────────────────────────────
app.use("*", async (c, next) => {
  console.log(`[${c.req.method}] ${c.req.url} (Path: ${c.req.path})`);
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

// ── Auth middleware for admin routes ──────────────────────────────────
apiRouter.use("/admin/*", ensureAdmin);

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
apiRouter.route("/media", mediaRouter);
apiRouter.route("/awards", awardsRouter);
apiRouter.route("/outreach", outreachRouter);
apiRouter.route("/tba", tbaRouter);
apiRouter.route("/judges", judgesRouter);
apiRouter.route("/profile", profilesRouter);
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
apiRouter.route("/admin/inquiries", inquiriesRouter);
apiRouter.route("/admin/comments", commentsRouter);
apiRouter.route("/admin/locations", locationsRouter);
apiRouter.route("/admin/sponsors", sponsorsRouter);
apiRouter.route("/admin/media", mediaRouter);
apiRouter.route("/admin/awards", awardsRouter);
apiRouter.route("/admin/outreach", outreachRouter);
apiRouter.route("/admin/judges", judgesRouter);
apiRouter.route("/admin/badges", badgesRouter);
apiRouter.route("/admin/settings", settingsRouter);
apiRouter.route("/admin/notifications", notificationsRouter);
apiRouter.route("/admin/analytics", analyticsRouter);
apiRouter.route("/admin/github", githubRouter);
apiRouter.route("/admin/zulip", zulipRouter);

// Special mount for logistics summary fallback (About page / Logistics tab)
apiRouter.get("/logistics/summary", (c) => profilesRouter.fetch(c.req.raw, c.env, c.executionCtx));
apiRouter.get("/team-roster", (c) => profilesRouter.fetch(c.req.raw, c.env, c.executionCtx));

// Webhooks (public — self-authenticated via signatures/tokens)
apiRouter.route("/webhooks/github", githubWebhookRouter);
apiRouter.route("/webhooks/zulip", zulipWebhookRouter);

// ── Global Platform Search (stays in aggregator — crosses domains) ───
apiRouter.get("/search", async (c) => {
  try {
    const q = c.req.query("q") || "";
    if (q.length < 3) return c.json({ results: [] });

    // Sanitize query for FTS MATCH
    const safeQ = q.replace(/"/g, '""');
    const ftsQ = `"${safeQ}"*`;


    const [postsReq, eventsReq, docsReq, usersReq] = await Promise.all([
      c.env.DB.prepare(
        "SELECT 'blog' as type, slug as id, title, snippet as matched_text FROM posts_fts WHERE is_deleted = '0' AND status = 'published' AND posts_fts MATCH ? ORDER BY rank LIMIT 5"
      ).bind(ftsQ).all(),
      c.env.DB.prepare(
        "SELECT 'event' as type, id, title, description as matched_text FROM events_fts WHERE is_deleted = 0 AND status = 'published' AND events_fts MATCH ? ORDER BY rank LIMIT 5"
      ).bind(ftsQ).all(),
      c.env.DB.prepare(
        "SELECT 'doc' as type, slug as id, title, description as matched_text FROM docs_fts WHERE status = 'published' AND is_deleted = '0' AND docs_fts MATCH ? ORDER BY rank LIMIT 5"
      ).bind(ftsQ).all(),
      c.env.DB.prepare(
        "SELECT 'user' as type, user_id as id, nickname as title, bio as matched_text FROM user_profiles_fts WHERE show_on_about = 1 AND user_profiles_fts MATCH ? ORDER BY rank LIMIT 5"
      ).bind(ftsQ).all()
    ]);


    return c.json({ results: [...(postsReq.results || []), ...(eventsReq.results || []), ...(docsReq.results || []), ...(usersReq.results || [])] });
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
      "SELECT id, action, target_type, target_id, actor_email, actor_role, details, timestamp FROM audit_log ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    ).bind(limit, offset).all();
    return c.json({ logs: results || [] });
  } catch (err) {
    console.error("Audit log read error:", err);
    return c.json({ logs: [] }, 500);
  }
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
    // 1. Fetch Retention Policy from Database
    const retentionRow = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = 'RETENTION_INQUIRY_DAYS'"
    ).first<{ value: string }>();

    const days = Number(retentionRow?.value || "30");

    console.log(`[Scheduled] Starting maintenance. Retention period: ${days} days.`);

    // 2. Execute Purge
    const { deleted } = await purgeOldInquiries(env.DB, days);
    
    console.log(`[Scheduled] Maintenance complete. Purged ${deleted} old inquiries.`);
  } catch (err) {
    console.error("[Scheduled] Maintenance failed:", err);
  }
};

export default app;

