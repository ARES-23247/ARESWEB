import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { Bindings, AppEnv, persistentRateLimitMiddleware, logSystemError, dbMiddleware, envMiddleware, originIntegrityMiddleware, DrizzleDB } from "./middleware";
import { desc, eq, and, inArray, lt, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../src/db/schema";
import { purgeOldInquiries } from "./routes/inquiries/index";
import { dispatchSocials } from "../utils/socialSync";
import { indexSiteContent } from "./routes/ai/indexer";

// ── Domain Routers ───────────────────────────────────────────────────
import authRouter from "./routes/auth";
import analyticsRouter from "./routes/analytics";
import sponsorsRouter from "./routes/sponsors";
import tbaRouter from "./routes/tba";
import outreachRouter from "./routes/outreach/index";
import awardsRouter from "./routes/awards";
import postsRouter from "./routes/posts/index";
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
import galleriesRouter from "./routes/galleries/index";
import videosRouter from "./routes/videos/index";
import youtubeRouter from "./routes/youtube/index";
import gmailRouter from "./routes/gmail/index";
import { aiToolsRouter } from "./routes/ai-tools/index";
import { searchRoute, auditLogRoute } from "../../shared/routes/internal";
import { driveRouter } from "./routes/google-drive";
import { photosRouter } from "./routes/google-photos";
import onshapeRouter from "./routes/onshape";

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
  info: {
    title: 'ARESWEB API',
    version: 'v6.8',
    description: 'REST API for the ARES 23247 Web Portal'
  },
  servers: [
    {
      url: '/api',
      description: 'API Endpoint'
    }
  ],
  tags: [
    { name: 'galleries', description: 'Photo gallery management' },
    { name: 'videos', description: 'Video library management' },
    { name: 'posts', description: 'Blog posts and news' },
    { name: 'events', description: 'Calendar events' },
    { name: 'admin', description: 'Administrative operations' },
  ]
});

apiRouter.get('/reference', apiReference({
  url: '/api/openapi.json',
  theme: 'moon',
}));

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
            // SEC-SQL-01: Sanitize path to prevent SQL injection in analytics queries
            const sanitizedPath = c.req.path.replace(/[^\w/\-_.]/g, '').substring(0, 500);
            await db.insert(schema.usageMetrics).values({
              id: crypto.randomUUID(),
              endpoint: sanitizedPath,
              method: c.req.method,
              statusCode: c.res.status,
              latencyMs: latency,
              userId: user?.id || null,
              cfRay: c.req.header("cf-ray") || null,
              cfIp: c.req.header("cf-connecting-ip") || null
            }).run();
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
      // Allow same-origin requests (no Origin header)
      if (!origin) return true;
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
apiRouter.use("/inquiries/*", persistentRateLimitMiddleware(30, 60)); 
apiRouter.use("/comments/*", persistentRateLimitMiddleware(20, 60));


// ── Mount Domain Routers ─────────────────────────────────────────────
import { simulationsRouter } from "./routes/simulations";
import { communicationsRouter } from "./routes/communications";
import filesRouter from "./routes/files";

// @ts-expect-error TS2590: Union type too complex — known Hono limitation
export const group1 = new OpenAPIHono<AppEnv>()
  .route("/auth", authRouter)
  .route("/finance", financeRouter)
  .route("/entities", entitiesRouter)
  .route("/posts", postsRouter)
  .route("/docs", docsRouter)
  .route("/events", eventsRouter)
  .route("/render", renderRouter)
  .route("/comments", commentsRouter)
  .route("/inquiries", inquiriesRouter)
  .route("/locations", locationsRouter);

export const group2 = new OpenAPIHono<AppEnv>()
  .route("/sponsors", sponsorsRouter)
  .route("/media", mediaRouter)
  .route("/awards", awardsRouter)
  .route("/outreach", outreachRouter)
  .route("/seasons", seasonsRouter)
  .route("/tba", tbaRouter)
  .route("/judges", judgesRouter)
  .route("/profile", profilesRouter)
  .route("/logistics", logisticsRouter)
  .route("/users", usersRouter)
  .route("/galleries", galleriesRouter)
  .route("/videos", videosRouter)
  .route("/youtube", youtubeRouter);

export const group5 = new OpenAPIHono<AppEnv>()
  .route("/gmail", gmailRouter);

export const group3 = new OpenAPIHono<AppEnv>()
  .route("/badges", badgesRouter)
  .route("/settings", settingsRouter)
  .route("/", sitemapRouter)
  .route("/notifications", notificationsRouter)
  .route("/analytics", analyticsRouter)
  .route("/github", githubRouter)
  .route("/zulip", zulipRouter)
  .route("/internal/gc", gcRouter)
  .route("/tasks", tasksRouter)
  .route("/store", storeHandler)
  .route("/ai-tools", aiToolsRouter);

export const group4 = new OpenAPIHono<AppEnv>()
  .route("/points", pointsRouter)
  .route("/ai", aiRouter)
  .route("/social-queue", socialQueueRouter)
  .route("/scouting", scoutingRouter)
  .route("/simulations", simulationsRouter)
  .route("/webhooks/github", githubWebhookRouter)
  .route("/webhooks/zulip", zulipWebhookRouter)
  .route("/communications", communicationsRouter)
  .route("/google-drive", driveRouter)
  .route("/google-photos", photosRouter)
  .route("/onshape", onshapeRouter)
  .route("/files", filesRouter);

// ── Global Search ───
// D1 FTS result shape from raw SQL queries
interface FTSResult {
  type: string;
  id: string;
  title: string;
  snippet: string;
}

// @ts-expect-error TS2590: Union type too complex — known Hono limitation with large route chains.
// This suppression is safe: the routes chain is structurally correct, TypeScript just can't
// compute the cumulative type of 4 groups + 2 openapi handlers in a single chain.
const routes = new OpenAPIHono<AppEnv>()
  .route("/", group1)
  .route("/", group2)
  .route("/", group3)
  .route("/", group4)
  .route("/", group5)
  .openapi(searchRoute, async (c) => {
    const { q } = c.req.valid("query");
    // SEC-F01: D1 FTS5 MATCH cannot use parameterized bindings (SQLite limitation).
    // Mitigation: strip ALL non-alphanumeric/space chars, truncate to 100 chars,
    // escape any remaining single quotes, and append wildcard for prefix matching.
    const qClean = q.replace(/[^a-zA-Z0-9\s]/g, "").trim().substring(0, 100);
    if (!qClean) return c.json({ results: [] }, 200);
    const ftsQ = qClean.replace(/'/g, "''") + '*';
    const db = c.get("db");
    const postsQuery = `SELECT 'blog' as type, f.slug as id, highlight(posts_fts, 1, '<b>', '</b>') as title, snippet(posts_fts, 4, '...', '...', '...', 15) as snippet FROM posts_fts f JOIN posts p ON f.slug = p.slug WHERE p.is_deleted = 0 AND p.status = 'published' AND f.posts_fts MATCH '${ftsQ}' ORDER BY rank LIMIT 5`;
    const eventsQuery = `SELECT 'event' as type, f.id, highlight(events_fts, 1, '<b>', '</b>') as title, snippet(events_fts, 2, '...', '...', '...', 15) as snippet FROM events_fts f JOIN events e ON f.id = e.id WHERE e.is_deleted = 0 AND e.status = 'published' AND f.events_fts MATCH '${ftsQ}' ORDER BY rank LIMIT 5`;
    const docsQuery = `SELECT 'doc' as type, f.slug as id, highlight(docs_fts, 1, '<b>', '</b>') as title, snippet(docs_fts, 4, '...', '...', '...', 15) as snippet FROM docs_fts f JOIN docs d ON f.slug = d.slug WHERE d.status = 'published' AND d.is_deleted = 0 AND f.docs_fts MATCH '${ftsQ}' ORDER BY rank LIMIT 5`;
    const [postsReq, eventsReq, docsReq] = await Promise.all([
      db.all(postsQuery).then(r => (r || []) as FTSResult[]),
      db.all(eventsQuery).then(r => (r || []) as FTSResult[]),
      db.all(docsQuery).then(r => (r || []) as FTSResult[])
    ]);
    return c.json({
      results: [
        ...postsReq.map((r: FTSResult) => ({ ...r, type: 'blog' as const, id: String(r.id), title: String(r.title), snippet: String(r.snippet) })),
        ...eventsReq.map((r: FTSResult) => ({ ...r, type: 'event' as const, id: String(r.id), title: String(r.title), snippet: String(r.snippet) })),
        ...docsReq.map((r: FTSResult) => ({ ...r, type: 'doc' as const, id: String(r.id), title: String(r.title), snippet: String(r.snippet) }))
      ]
    }, 200);
  })
  .openapi(auditLogRoute, async (c) => {
    const { limit: l, offset: o } = c.req.valid("query");
    const limit = l ? parseInt(l, 10) : 50;
    const offset = o ? parseInt(o, 10) : 0;

    const db = c.get("db");
    const results = await db.select({
        id: schema.auditLog.id,
        actor: schema.auditLog.actor,
        action: schema.auditLog.action,
        resourceType: schema.auditLog.resourceType,
        resourceId: schema.auditLog.resourceId,
        createdAt: schema.auditLog.createdAt,
        details: schema.auditLog.details
      })
      .from(schema.auditLog)
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    const logs = results.map((r) => ({
      ...r,
      id: r.id || crypto.randomUUID(),
      createdAt: r.createdAt || new Date().toISOString(),
      resourceType: String(r.resourceType || "unknown"),
      resourceId: r.resourceId || "",
      details: (r.details || "").substring(0, 500)
    }));

    return c.json({ logs }, 200);
  });

// @ts-expect-error TS2590: Union type too complex — known Hono limitation
apiRouter.route("/", routes);

// ── Health Check ────────────
apiRouter.get("/health", (c) => {
  // FUN-F01: Do not expose environment type or hostname to prevent info disclosure
  return c.json({ status: "ok" }, 200);
});

app.onError(async (err, c) => {
  // Import ApiError dynamically to avoid circular deps
  const { ApiError } = await import("./middleware/errorHandler");

  // Handle ApiError with correct status code (400, 404, 429, etc.)
  if (err instanceof ApiError) {
    const response: Record<string, unknown> = { error: err.message };
    if (err.code) response.code = err.code;
    if (err.details) response.details = err.details;
    return c.json(response, err.status as 400 | 401 | 403 | 404 | 409 | 429 | 500);
  }

  // Generic errors — log and return 500
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
export const scheduled = async (event: ScheduledEvent, env: Bindings) => {
  const db = drizzle(env.DB, { schema });
  await purgeOldInquiries(db as unknown as DrizzleDB, 30);
  const auditRetentionDays = parseInt(env.AUDIT_LOG_RETENTION_DAYS || "90", 10);
  // Calculate cutoff date in JavaScript instead of SQL
  const auditCutoffDate = new Date(Date.now() - auditRetentionDays * 24 * 60 * 60 * 1000).toISOString();
  // Delete old audit logs using Drizzle
  const oldLogs = await db.select({ id: schema.auditLog.id })
    .from(schema.auditLog)
    .where(lt(schema.auditLog.createdAt, auditCutoffDate))
    .limit(100)
    .all();
  if (oldLogs.length > 0) {
    await db.delete(schema.auditLog)
      .where(inArray(schema.auditLog.id, oldLogs.map(l => l.id!)))
      .run();
  }

  const now = new Date().toISOString();

  // Get pending social queue posts using Drizzle
  const pendingPosts = await db.select({
    id: schema.socialQueue.id,
    content: schema.socialQueue.content,
    platforms: schema.socialQueue.platforms,
    mediaUrls: schema.socialQueue.mediaUrls,
    linkedType: schema.socialQueue.linkedType,
    linkedId: schema.socialQueue.linkedId
  })
  .from(schema.socialQueue)
  .where(and(
    eq(schema.socialQueue.status, "pending"),
    lte(schema.socialQueue.scheduledFor, now)
  ))
  .all();

  if (pendingPosts.length > 0) {
    // Get settings using Drizzle
    const settingsRows = await db.select({
      key: schema.settings.key,
      value: schema.settings.value
    })
    .from(schema.settings)
    .all();

    const settingsMap = settingsRows.reduce((acc: Record<string, string>, s) => {
      if (s.key) acc[s.key] = s.value || "";
      return acc;
    }, {} as Record<string, string>);

    const socialConfig = {
      DISCORD_WEBHOOK_URL: env.DISCORD_WEBHOOK_URL || settingsMap["DISCORD_WEBHOOK_URL"],
      MAKE_WEBHOOK_URL: settingsMap["MAKE_WEBHOOK_URL"],
      BLUESKY_HANDLE: settingsMap["BLUESKY_HANDLE"],
      BLUESKY_APP_PASSWORD: settingsMap["BLUESKY_APP_PASSWORD"],
      SLACK_WEBHOOK_URL: settingsMap["SLACK_WEBHOOK_URL"],
      TEAMS_WEBHOOK_URL: settingsMap["TEAMS_WEBHOOK_URL"],
      GCHAT_WEBHOOK_URL: settingsMap["GCHAT_WEBHOOK_URL"],
      FACEBOOK_PAGE_ID: settingsMap["FACEBOOK_PAGE_ID"],
      FACEBOOK_ACCESS_TOKEN: settingsMap["FACEBOOK_ACCESS_TOKEN"],
      TWITTER_API_KEY: settingsMap["TWITTER_API_KEY"],
      TWITTER_API_SECRET: settingsMap["TWITTER_API_SECRET"],
      TWITTER_ACCESS_TOKEN: settingsMap["TWITTER_ACCESS_TOKEN"],
      TWITTER_ACCESS_SECRET: settingsMap["TWITTER_ACCESS_SECRET"]
    };

    for (const post of pendingPosts) {
      try {
        await db.update(schema.socialQueue)
          .set({ status: "processing" })
          .where(eq(schema.socialQueue.id, post.id))
          .run();

        const platforms = JSON.parse(post.platforms as string);
        await dispatchSocials(
          db as unknown as DrizzleDB,
          {
            title: post.linkedType ? "ARES Content Update" : "ARES Social Post",
            url: post.linkedType ? `https://aresfirst.org/${post.linkedType}/${post.linkedId}` : "https://aresfirst.org",
            snippet: post.content as string,
            thumbnail: post.mediaUrls ? JSON.parse(post.mediaUrls as string)?.[0] : undefined
          },
          socialConfig,
          platforms
        );

        await db.update(schema.socialQueue)
          .set({
            status: "sent",
            sentAt: now
          })
          .where(eq(schema.socialQueue.id, post.id))
          .run();
      } catch (error) {
        console.error(`[Cron] Failed to send social post ${post.id}:`, error);
        await db.update(schema.socialQueue)
          .set({
            status: "failed",
            errorMessage: String(error)
          })
          .where(eq(schema.socialQueue.id, post.id))
          .run();
      }
    }
  }
  
  if (env.AI && env.VECTORIZE_DB) {
    try {
      await indexSiteContent(db as unknown as DrizzleDB, env.AI, env.VECTORIZE_DB);
    } catch (e) {
      console.error("[Cron] Vectorize indexing failed:", e);
      await logSystemError(db, "VectorizeIndexing", "Indexing failed", e instanceof Error ? e.message : String(e));
    }
  }
  
  try {
    const nowIso = new Date().toISOString();
    await db.insert(schema.settings)
      .values({
        key: "cron_last_run",
        value: nowIso,
        updatedAt: nowIso
      })
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: {
          value: nowIso,
          updatedAt: nowIso
        }
      })
      .run();
  } catch (err) {
    console.error("[Cron] Failed to update heartbeat in D1", err);
  }
};

export { apiRouter };
export type AppType = typeof routes;
export default app;
