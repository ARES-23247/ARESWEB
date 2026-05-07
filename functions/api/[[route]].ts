import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { Bindings, AppEnv, persistentRateLimitMiddleware, logSystemError, dbMiddleware, envMiddleware, originIntegrityMiddleware, DrizzleDB } from "./middleware";
import { sql, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../src/db/schema";

// ── Domain Routers ───────────────────────────────────────────────────
import authRouter from "./routes/auth";
import analyticsRouter from "./routes/analytics";
import sponsorsRouter from "./routes/sponsors";
import tbaRouter from "./routes/tba";
import outreachRouter from "./routes/outreach/index";
import awardsRouter from "./routes/awards";
import postsRouter from "./routes/posts";
import eventsRouter from "./routes/events/index";
import seasonsRouter from "./routes/seasons";
import docsRouter from "./routes/docs";
import mediaRouter from "./routes/media/index";
import settingsRouter from "./routes/settings";
import judgesRouter from "./routes/judges";
import profilesRouter from "./routes/profiles";
import logisticsRouter from "./routes/logistics";
import usersRouter from "./routes/users";
import commentsRouter from "./routes/comments";
import inquiriesRouter from "./routes/inquiries/index";
import { badgesRouter } from "./routes/badges";
import locationsRouter from "./routes/locations";
import renderRouter from "./routes/render";
import sitemapRouter from "./routes/sitemap";
import githubRouter from "./routes/github";
import githubWebhookRouter from "./routes/githubWebhook";
import zulipWebhookRouter from "./routes/zulipWebhook";
import zulipRouter from "./routes/zulip";
import notificationsRouter from "./routes/notifications";
import tasksRouter from "./routes/tasks";
import financeRouter from "./routes/finance";
import entitiesRouter from "./routes/entities";
import gcRouter from "./routes/internal/gc";
import storeHandler from "./routes/store";
import pointsRouter from "./routes/points";
import { aiRouter } from "./routes/ai/index";
import socialQueueRouter from "./routes/socialQueue";
import scoutingRouter from "./routes/scouting/index";
import { searchRoute, auditLogRoute } from "../../shared/routes/internal";

import { logger } from "hono/logger";
import { sentry } from "@hono/sentry";
import { secureHeaders } from "hono/secure-headers";
import { etag } from "hono/etag";
import { OpenAPIHono } from "@hono/zod-openapi";
import { apiReference } from "@scalar/hono-api-reference";

const app = new Hono<AppEnv>();

app.use("*", logger());
app.use("*", secureHeaders());
app.use("*", etag());
app.use("*", async (c, next) => {
  if (c.env.SENTRY_DSN) {
    return sentry({ dsn: c.env.SENTRY_DSN })(c, next);
  }
  await next();
});

app.use("*", envMiddleware);
app.use("*", dbMiddleware);

// ── 4. Origin Integrity Check (Non-GET) ────
app.use("*", originIntegrityMiddleware());

import { fromError } from "zod-validation-error";

const apiRouter = new OpenAPIHono<AppEnv>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({ error: fromError(result.error).toString() }, 400);
    }
  }
});

// SCA-P01: Prevent CDN Cache Poisoning (Context-Aware Default)
apiRouter.use("*", async (c, next) => {
  await next();
  if (!c.res.headers.has("Cache-Control")) {
    c.res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  }
});

// Mount OpenAPI documentation
apiRouter.doc('/openapi.json', {
  openapi: '3.1.0',
  info: { title: 'ARESWEB API', version: 'v6.8' }
});

const scalarConfig = { spec: { url: '/api/openapi.json' }, theme: 'moon' as const };
apiRouter.get('/reference', apiReference(scalarConfig as unknown as Parameters<typeof apiReference>[0]));

// ── Usage Metrics Logging (Phase 10) ──
import { SessionUser } from "./middleware";
apiRouter.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const latency = Date.now() - start;

  if (!c.req.path.includes("polling") && c.req.method !== "OPTIONS" && !c.req.path.startsWith("/assets")) {
    const user = c.get("sessionUser") as SessionUser | undefined;
    const db = c.get("db");
    if (db) {
      c.executionCtx.waitUntil(
        (async () => {
          try {
            await c.env.DB.prepare(`
              INSERT INTO usage_metrics (id, endpoint, method, status_code, latency_ms, user_id, cf_ray, cf_ip)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              crypto.randomUUID(),
              c.req.path,
              c.req.method,
              c.res.status,
              latency,
              user?.id || null,
              c.req.header("cf-ray") || null,
              c.req.header("cf-connecting-ip") || null
            ).run();
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            if (!errorMsg.includes("no such table") && !errorMsg.includes("does not exist")) {
              console.error("[UsageMetrics] Log failed:", errorMsg);
            }
          }
        })()
      );
    }
  }
});

// ── CSRF Protection ──
apiRouter.use("*", async (c, next) => {
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
  origin: (origin, c) => {
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

// ── Distributed Persistent Rate Limiting (D1 Backed) ─────────────────
apiRouter.use("/auth/*", persistentRateLimitMiddleware(30, 60));
apiRouter.use("/inquiries/*", persistentRateLimitMiddleware(30, 60)); 
apiRouter.use("/comments/*", persistentRateLimitMiddleware(20, 60));


// ── Mount Domain Routers ─────────────────────────────────────────────
apiRouter.route("/auth", authRouter);
apiRouter.route("/finance", financeRouter);
apiRouter.route("/entities", entitiesRouter);
apiRouter.route("/posts", postsRouter);
apiRouter.route("/docs", docsRouter);
apiRouter.route("/events", eventsRouter);
apiRouter.route("/render", renderRouter);
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
apiRouter.route("/internal/gc", gcRouter);
apiRouter.route("/tasks", tasksRouter);
apiRouter.route("/store", storeHandler);
apiRouter.route("/points", pointsRouter);
apiRouter.route("/ai", aiRouter);
apiRouter.route("/social-queue", socialQueueRouter);
apiRouter.route("/scouting", scoutingRouter);

import { simulationsRouter } from "./routes/simulations";
apiRouter.route("/simulations", simulationsRouter);

import { communicationsRouter } from "./routes/communications";
apiRouter.route("/webhooks/github", githubWebhookRouter);
apiRouter.route("/webhooks/zulip", zulipWebhookRouter);
apiRouter.route("/communications", communicationsRouter);

// ── Global Search ───
// D1 FTS result shape from raw SQL queries
interface FTSResult {
  type: string;
  id: string;
  title: string;
  snippet: string;
}

apiRouter.openapi(searchRoute, async (c) => {
  const { q } = c.req.valid("query");
  const qClean = q.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  if (!qClean || qClean.length > 100) return c.json({ results: [] }, 200);
  const ftsQ = qClean.replace(/\*/g, '') + '*';
  const db = c.get("db");
  const [postsReq, eventsReq, docsReq] = await Promise.all([
    db.all(sql<FTSResult>`
      SELECT 'blog' as type, f.slug as id, highlight(posts_fts, 1, '<b>', '</b>') as title, snippet(posts_fts, 4, '...', '...', '...', 15) as snippet
      FROM posts_fts f JOIN posts p ON f.slug = p.slug WHERE p.isDeleted = 0 AND p.status = 'published' AND f.posts_fts MATCH ${ftsQ} ORDER BY rank LIMIT 5`),
    db.all(sql<FTSResult>`
      SELECT 'event' as type, f.id, highlight(events_fts, 1, '<b>', '</b>') as title, snippet(events_fts, 2, '...', '...', '...', 15) as snippet
      FROM events_fts f JOIN events e ON f.id = e.id WHERE e.isDeleted = 0 AND e.status = 'published' AND f.events_fts MATCH ${ftsQ} ORDER BY rank LIMIT 5`),
    db.all(sql<FTSResult>`
      SELECT 'doc' as type, f.slug as id, highlight(docs_fts, 1, '<b>', '</b>') as title, snippet(docs_fts, 4, '...', '...', '...', 15) as snippet
      FROM docs_fts f JOIN docs d ON f.slug = d.slug WHERE d.status = 'published' AND d.isDeleted = 0 AND f.docs_fts MATCH ${ftsQ} ORDER BY rank LIMIT 5`)
  ]);
  return c.json({
    results: [
      ...((postsReq.results || []).map((r) => ({ ...r, type: 'blog' as const, id: String(r.id), title: String(r.title), snippet: String(r.snippet) }))),
      ...((eventsReq.results || []).map((r) => ({ ...r, type: 'event' as const, id: String(r.id), title: String(r.title), snippet: String(r.snippet) }))),
      ...((docsReq.results || []).map((r) => ({ ...r, type: 'doc' as const, id: String(r.id), title: String(r.title), snippet: String(r.snippet) })))
    ]
  }, 200);
});

// ── Audit Log ────────────────────────────
apiRouter.openapi(auditLogRoute, async (c) => {
  const { limit: l, offset: o } = c.req.valid("query");
  const limit = l ? parseInt(l, 10) : 50;
  const offset = o ? parseInt(o, 10) : 0;

  const db = c.get("db");
  const results = await db.select({
      id: schema.auditLog.id,
      actor: schema.auditLog.actor,
      action: schema.auditLog.action,
      resource_type: schema.auditLog.resourceType,
      resource_id: schema.auditLog.resourceId,
      created_at: schema.auditLog.createdAt,
      details: sql<string>`substr(${schema.auditLog.details}, 1, 500)`
    })
    .from(schema.auditLog)
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const logs = results.map((r: { id?: string; created_at?: string | null; details?: string | null }) => ({
    ...r,
    id: r.id || crypto.randomUUID(),
    created_at: r.created_at || new Date().toISOString(),
    details: r.details || ""
  }));

  return c.json({ logs }, 200);
});

app.onError(async (err, c) => {
  console.error("Global API Error:", err);
  const db = c.get("db");
  if (c.env?.DB && db) {
    c.executionCtx.waitUntil(logSystemError(db, "GlobalErrorHandler", err.message || "Unknown error", err.stack));
  }
  const isProd = c.env?.ENVIRONMENT === "production";
  return c.json({ error: "Internal Server Error", message: isProd ? "Unexpected error" : err.message }, 500);
});

app.route("/api", apiRouter);
app.route("/dashboard/api", apiRouter);

export const onRequest = handle(app);
import { purgeOldInquiries } from "./routes/inquiries/index";
export const scheduled = async (event: ScheduledEvent, env: Bindings) => {
  const db = drizzle(env.DB, { schema });
  await purgeOldInquiries(db as unknown as DrizzleDB, 30);
  const auditRetentionDays = parseInt(env.AUDIT_LOG_RETENTION_DAYS || "90", 10);
  await env.DB.prepare(`DELETE FROM audit_log WHERE id IN (SELECT id FROM audit_log WHERE created_at < datetime('now', '-' || ? || ' days') LIMIT 100)`).bind(auditRetentionDays).run();
  
  const now = new Date().toISOString();
  const pendingPostsRes = await env.DB.prepare(`SELECT * FROM social_queue WHERE status = 'pending' AND scheduled_for <= ?`).bind(now).all();
  const pendingPosts = pendingPostsRes.results || [];
  
  if (pendingPosts.length > 0) {
    const settingsRes = await env.DB.prepare(`SELECT * FROM settings`).all();
    const settings = settingsRes.results || [];
    const settingsMap = settings.reduce((acc: Record<string, string>, s: { key?: string; value?: string }) => { if (s.key) acc[s.key] = s.value || ""; return acc; }, {} as Record<string, string>);
    const socialConfig = { DISCORD_WEBHOOK_URL: env.DISCORD_WEBHOOK_URL || settingsMap["DISCORD_WEBHOOK_URL"], MAKE_WEBHOOK_URL: settingsMap["MAKE_WEBHOOK_URL"], BLUESKY_HANDLE: settingsMap["BLUESKY_HANDLE"], BLUESKY_APP_PASSWORD: settingsMap["BLUESKY_APP_PASSWORD"], SLACK_WEBHOOK_URL: settingsMap["SLACK_WEBHOOK_URL"], TEAMS_WEBHOOK_URL: settingsMap["TEAMS_WEBHOOK_URL"], GCHAT_WEBHOOK_URL: settingsMap["GCHAT_WEBHOOK_URL"], FACEBOOK_PAGE_ID: settingsMap["FACEBOOK_PAGE_ID"], FACEBOOK_ACCESS_TOKEN: settingsMap["FACEBOOK_ACCESS_TOKEN"], TWITTER_API_KEY: settingsMap["TWITTER_API_KEY"], TWITTER_API_SECRET: settingsMap["TWITTER_API_SECRET"], TWITTER_ACCESS_TOKEN: settingsMap["TWITTER_ACCESS_TOKEN"], TWITTER_ACCESS_SECRET: settingsMap["TWITTER_ACCESS_SECRET"] };
    const { dispatchSocials } = await import("../utils/socialSync");
    for (const post of pendingPosts) {
      try {
        await env.DB.prepare(`UPDATE social_queue SET status = 'processing' WHERE id = ?`).bind(post.id).run();
        const platforms = JSON.parse(post.platforms as string);
        await dispatchSocials(db as unknown as DrizzleDB, { title: post.linked_type ? "ARES Content Update" : "ARES Social Post", url: post.linked_type ? `https://aresfirst.org/${post.linked_type}/${post.linked_id}` : "https://aresfirst.org", snippet: post.content as string, thumbnail: post.media_urls ? JSON.parse(post.media_urls as string)?.[0] : undefined }, socialConfig, platforms);
        await env.DB.prepare(`UPDATE social_queue SET status = 'sent', sent_at = ? WHERE id = ?`).bind(now, post.id).run();
      } catch (error) {
        console.error(`[Cron] Failed to send social post ${post.id}:`, error);
        await env.DB.prepare(`UPDATE social_queue SET status = 'failed', error_message = ? WHERE id = ?`).bind(String(error), post.id).run();
      }
    }
  }
  if (env.AI && env.VECTORIZE_DB) {
    try {
      const { indexSiteContent } = await import("./routes/ai/indexer");
      await indexSiteContent(db as unknown as DrizzleDB, env.AI, env.VECTORIZE_DB);
    } catch (e) { console.error("[Cron] Vectorize indexing failed:", e); }
  }
  try {
    const nowIso = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).bind("cron_last_run", nowIso, nowIso).run();
  } catch (err) { console.error("[Cron] Failed to update heartbeat in D1", err); }
};

export { apiRouter };
export type AppType = typeof apiRouter;
export default app;
