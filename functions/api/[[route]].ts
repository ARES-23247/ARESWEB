import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
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
const app = new Hono<{ Bindings: Bindings }>();
const apiRouter = new Hono<{ Bindings: Bindings }>();

// ── Request Logger ───────────────────────────────────────────────────
app.use("*", async (c, next) => {
  console.log(`[${c.req.method}] ${c.req.url} (Path: ${c.req.path})`);
  await next();
});

// ── Auth middleware for admin routes ──────────────────────────────────
apiRouter.use("/admin/*", ensureAdmin);

// ── Mount Domain Routers ─────────────────────────────────────────────
// Auth (must be first — handles /auth/* wildcard)
apiRouter.route("/", authRouter);

// Content
apiRouter.route("/", postsRouter);
apiRouter.route("/events", eventsRouter);
apiRouter.route("/admin/events/sync", syncEventsRouter);
apiRouter.route("/admin/events", adminEventsRouter);
apiRouter.route("/", docsRouter);
apiRouter.route("/", commentsRouter);
apiRouter.route("/", inquiriesRouter);
apiRouter.route("/", locationsRouter);

// Media & Assets
apiRouter.route("/", mediaRouter);

// Data Management
apiRouter.route("/", analyticsRouter);
apiRouter.route("/", sponsorsRouter);
apiRouter.route("/", outreachRouter);
apiRouter.route("/", awardsRouter);

// External Integrations
apiRouter.route("/", tbaRouter);
apiRouter.route("/", settingsRouter);
apiRouter.route("/", judgesRouter);

apiRouter.route("/", sitemapRouter);
apiRouter.route("/", profilesRouter);
apiRouter.route("/", badgesRouter);

// ── Global Platform Search (stays in aggregator — crosses domains) ───
apiRouter.get("/search", async (c) => {
  try {
    const q = c.req.query("q") || "";
    if (q.length < 3) return c.json({ results: [] });

    const wildcard = `%${q}%`;
    const [postsReq, eventsReq] = await Promise.all([
      c.env.DB.prepare(
        "SELECT 'blog' as type, slug as id, title, snippet as matched_text FROM posts WHERE title LIKE ? OR snippet LIKE ? LIMIT 5"
      ).bind(wildcard, wildcard).all(),
      c.env.DB.prepare(
        "SELECT 'event' as type, id, title, description as matched_text FROM events WHERE title LIKE ? OR description LIKE ? LIMIT 5"
      ).bind(wildcard, wildcard).all()
    ]);

    return c.json({ results: [...(postsReq.results || []), ...(eventsReq.results || [])] });
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

export default app;
