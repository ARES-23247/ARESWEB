/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from "hono";
import { Kysely } from "kysely";
import { handle } from "hono/cloudflare-pages";
import { cors } from "hono/cors";
import { Bindings, AppEnv, checkRateLimit, logSystemError, ensureAdmin, dbMiddleware, envMiddleware, parsePagination } from "./middleware";
import { sql } from "kysely";
import { DB } from "../../src/schemas/database";

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
app.use("*", envMiddleware);
app.use("*", dbMiddleware);

const apiRouter = new Hono<AppEnv>();
// ── Isolate-Memory Rate Limiting ─────────────────────────────────────
app.use("*", async (c, next) => {
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  if (ip !== "unknown" && !c.req.path.startsWith("/assets")) {
    const isBypass = c.env.DEV_BYPASS === "true" || c.env.DEV_BYPASS === "1";
    const allowed = isBypass || checkRateLimit(ip, 150, 60); 
    if (!allowed) return c.json({ error: "Too many requests" }, 429);
  }
  await next();
});

// ── Request Logger ────
app.use("*", async (c, next) => {
  if (c.env?.ENVIRONMENT !== "production") {
    const logUrl = new URL(c.req.url);
    for (const key of [...logUrl.searchParams.keys()]) {
      if (/token|secret|key|auth|session/i.test(key)) logUrl.searchParams.set(key, "***");
    }
    console.log(`[${c.req.method}] ${logUrl.pathname}${logUrl.search}`);
  }
  await next();
});

// ── CORS ─────
apiRouter.use("*", cors({
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

// Webhooks
apiRouter.route("/webhooks/github", githubWebhookRouter);
apiRouter.route("/webhooks/zulip", zulipWebhookRouter);

// ── Global Search ───
apiRouter.get("/search", async (c) => {
  const q = c.req.query("q") || "";
  if (q.length < 3) return c.json({ results: [] });
  const ftsQ = `"${q.replace(/"/g, '""')}"*`;
  const db = c.get("db") as Kysely<DB>;
  const [postsReq, eventsReq, docsReq] = await Promise.all([
    sql<Record<string, unknown>>`SELECT 'blog' as type, f.slug as id, f.title FROM posts_fts f JOIN posts p ON f.slug = p.slug WHERE p.is_deleted = 0 AND p.status = 'published' AND f.posts_fts MATCH ${ftsQ} LIMIT 5`.execute(db),
    sql<Record<string, unknown>>`SELECT 'event' as type, f.id, f.title FROM events_fts f JOIN events e ON f.id = e.id WHERE e.is_deleted = 0 AND e.status = 'published' AND f.events_fts MATCH ${ftsQ} LIMIT 5`.execute(db),
    sql<Record<string, unknown>>`SELECT 'doc' as type, f.slug as id, f.title FROM docs_fts f JOIN docs d ON f.slug = d.slug WHERE d.status = 'published' AND d.is_deleted = 0 AND f.docs_fts MATCH ${ftsQ} LIMIT 5`.execute(db)
  ]);
  return c.json({ results: [...(postsReq.rows || []), ...(eventsReq.rows || []), ...(docsReq.rows || [])] });
});

// ── Audit Log ────────────────────────────
apiRouter.get("/admin/audit-log", ensureAdmin, async (c) => {
  const { limit, offset } = parsePagination(c, 50, 200);
  const db = c.get("db");
  const results = await db.selectFrom("audit_log").selectAll().orderBy("created_at", "desc").limit(limit).offset(offset).execute();
  return c.json({ logs: results || [] });
});

app.onError(async (err, c: any) => {
  console.error("Global API Error:", err);
  const db = c.get("db") as Kysely<DB>;
  if (c.env?.DB) await logSystemError(db, "GlobalErrorHandler", err.message || "Unknown error", err.stack);
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
  await db.deleteFrom("audit_log").where("created_at", "<", sql`datetime('now', '-90 days')` as any).execute();
};

export default app;
