import { Hono } from "hono";
import { Kysely } from "kysely";
import { handle } from "hono/cloudflare-pages";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { Bindings, AppEnv, checkRateLimit, rateLimitMiddleware, logSystemError, ensureAdmin, dbMiddleware, envMiddleware, parsePagination } from "./middleware";
import { sql } from "kysely";
import { DB } from "../../shared/schemas/database";

// ── Domain Routers ───────────────────────────────────────────────────
import authRouter from "./routes/auth";
import analyticsRouter from "./routes/analytics";
import sponsorsRouter from "./routes/sponsors";
import tbaRouter from "./routes/tba";
import outreachRouter from "./routes/outreach";
import awardsRouter from "./routes/awards";
import postsRouter from "./routes/posts";
import eventsRouter from "./routes/events/index";
import seasonsRouter from "./routes/seasons";
import docsRouter from "./routes/docs";
import mediaRouter from "./routes/media";
import settingsRouter from "./routes/settings";
import judgesRouter from "./routes/judges";
import profilesRouter from "./routes/profiles";
import logisticsRouter from "./routes/logistics";
import usersRouter from "./routes/users";
import commentsRouter from "./routes/comments";
import inquiriesRouter from "./routes/inquiries";
import badgesRouter from "./routes/badges";
import locationsRouter from "./routes/locations";
import sitemapRouter from "./routes/sitemap";
import githubRouter from "./routes/github";
import githubWebhookRouter from "./routes/githubWebhook";
import zulipWebhookRouter from "./routes/zulipWebhook";
import zulipRouter from "./routes/zulip";
import notificationsRouter from "./routes/notifications";

const app = new Hono<AppEnv>();

// ── 2. Isolate-Memory Rate Limiting (Fast reject) ────────────────────
app.use("*", async (c, next) => {
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  if (ip !== "unknown" && !c.req.path.startsWith("/assets")) {
    const isBypass = c.env.DEV_BYPASS === "true" || c.env.DEV_BYPASS === "1";
    const allowed = isBypass || checkRateLimit(ip, 150, 60); 
    if (!allowed) return c.json({ error: "Too many requests" }, 429);
  }
  await next();
});

// ── 3. Env & DB setup ────
app.use("*", envMiddleware);
app.use("*", dbMiddleware);

const apiRouter = new Hono<AppEnv>();

// SCA-P01: Prevent CDN Cache Poisoning
apiRouter.use("*", async (c, next) => {
  await next();
  c.res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
});

// ── CSRF Protection ──
apiRouter.use("*", async (c, next) => {
  // Webhooks from external services don't have our origin
  if (c.req.path.startsWith("/api/webhooks/")) {
    return await next();
  }
  
  return csrf({
    origin: (origin) => {
      if (!origin) return false;
      const trusted = ["http://localhost:5173", "http://localhost:8788", "https://aresfirst.org"];
      if (trusted.includes(origin)) return true;
      return origin.endsWith(".pages.dev") || origin.endsWith(".aresfirst.org");
    }
  })(c, next);
});


// ── CORS ─────
apiRouter.use("*", cors({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Hono CORS origin callback context is untyped
  origin: (origin, c: any) => {
    if (!origin) return origin;
    const requestOrigin = new URL(c.req.url).origin;
    if (origin === requestOrigin) return origin;
    const trusted = ["http://localhost:5173", "http://localhost:8788"];
    if (trusted.includes(origin)) return origin;
    return undefined;
  },
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "x-better-auth-origin", "x-better-auth-session-id"],
  credentials: true,
  maxAge: 86400,
}));

// ── Mount Domain Routers ─────────────────────────────────────────────
apiRouter.route("/auth", authRouter);
apiRouter.route("/posts", postsRouter);
apiRouter.route("/docs", docsRouter);
apiRouter.route("/events", eventsRouter);
apiRouter.route("/comments", commentsRouter);
apiRouter.route("/inquiries", inquiriesRouter);
apiRouter.route("/locations", locationsRouter);
apiRouter.route("/sponsors", sponsorsRouter);
apiRouter.route("/media", mediaRouter);
apiRouter.route("/awards", awardsRouter);
apiRouter.route("/outreach", outreachRouter);
apiRouter.route("/seasons", seasonsRouter);
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

import { communicationsRouter } from "./routes/communications";

// Webhooks
apiRouter.route("/webhooks/github", githubWebhookRouter);
apiRouter.route("/webhooks/zulip", zulipWebhookRouter);
apiRouter.route("/communications", communicationsRouter);

// ── Global Search ───
apiRouter.get("/search", rateLimitMiddleware(50, 60), async (c) => {
  const q = c.req.query("q") || "";
  if (q.length < 2) return c.json({ results: [] });
  
  // SCA-FTS-01: Sanitize FTS5 query
  const qClean = q.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  if (!qClean) return c.json({ results: [] });
  const ftsQ = `${qClean}*`;

  const db = c.get("db") as Kysely<DB>;
  
  // SCA-FTS-02: Use rich FTS5 features (snippet/highlight) for championship-grade search
  const [postsReq, eventsReq, docsReq] = await Promise.all([
    sql<Record<string, unknown>>`
      SELECT 
        'blog' as type, 
        f.slug as id, 
        highlight(posts_fts, 1, '<b>', '</b>') as title,
        snippet(posts_fts, 4, '...', '...', '...', 15) as snippet
      FROM posts_fts f 
      JOIN posts p ON f.slug = p.slug 
      WHERE p.is_deleted = 0 AND p.status = 'published' AND f.posts_fts MATCH ${ftsQ} 
      ORDER BY rank LIMIT 5
    `.execute(db),
    sql<Record<string, unknown>>`
      SELECT 
        'event' as type, 
        f.id, 
        highlight(events_fts, 1, '<b>', '</b>') as title,
        snippet(events_fts, 2, '...', '...', '...', 15) as snippet
      FROM events_fts f 
      JOIN events e ON f.id = e.id 
      WHERE e.is_deleted = 0 AND e.status = 'published' AND f.events_fts MATCH ${ftsQ} 
      ORDER BY rank LIMIT 5
    `.execute(db),
    sql<Record<string, unknown>>`
      SELECT 
        'doc' as type, 
        f.slug as id, 
        highlight(docs_fts, 1, '<b>', '</b>') as title,
        snippet(docs_fts, 4, '...', '...', '...', 15) as snippet
      FROM docs_fts f 
      JOIN docs d ON f.slug = d.slug 
      WHERE d.status = 'published' AND d.is_deleted = 0 AND f.docs_fts MATCH ${ftsQ} 
      ORDER BY rank LIMIT 5
    `.execute(db)
  ]);
  
  const results = [
    ...(postsReq.rows || []),
    ...(eventsReq.rows || []),
    ...(docsReq.rows || [])
  ];

  return c.json({ results });
});

// ── Audit Log ────────────────────────────
apiRouter.get("/admin/audit-log", ensureAdmin, async (c) => {
  const { limit, offset } = parsePagination(c, 50, 200);
  const db = c.get("db");
  const results = await db.selectFrom("audit_log")
    .select([
      "id",
      "actor",
      "action",
      "resource_type",
      "resource_id",
      "created_at",
      sql<string>`substr(details, 1, 500)`.as("details")
    ])
    .orderBy("created_at", "desc")
    .limit(limit)
    .offset(offset)
    .execute();
  return c.json({ logs: results || [] });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Hono error handler context requires any for env access
app.onError(async (err, c: any) => {
  console.error("Global API Error:", err);
  const db = c.get("db") as Kysely<DB>;
  if (c.env?.DB && db) {
    // SCA-F01: Non-blocking error logging
    c.executionCtx.waitUntil(logSystemError(db, "GlobalErrorHandler", err.message || "Unknown error", err.stack));
  }
  const isProd = c.env?.ENVIRONMENT === "production";
  return c.json({ error: "Internal Server Error", message: isProd ? "Unexpected error" : err.message }, 500);
});

app.route("/api", apiRouter);
app.route("/dashboard/api", apiRouter);

export const onRequest = handle(app);
import { purgeOldInquiries } from "./routes/inquiries";
export const scheduled = async (event: ScheduledEvent, env: Bindings) => {
  const { D1Dialect } = await import("kysely-d1");
  const { Kysely } = await import("kysely");
  const db = new Kysely<DB>({ dialect: new D1Dialect({ database: env.DB }) });
  await purgeOldInquiries(db, 30);
  await db.deleteFrom("audit_log")
    .where("id", "in", (eb) => eb.selectFrom("audit_log")
      .select("id")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- sql template literal type mismatch with Kysely
      .where("created_at", "<", sql`datetime('now', '-90 days')` as any)
      .limit(100)
    )
    .execute();
};

export default app;
