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
import eventsRouter from "./routes/events";
import docsRouter from "./routes/docs";
import mediaRouter from "./routes/media";
import settingsRouter from "./routes/settings";
import judgesRouter from "./routes/judges";
import profilesRouter from "./routes/profiles";
import commentsRouter from "./routes/comments";
import inquiriesRouter from "./routes/inquiries";

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
apiRouter.route("/", eventsRouter);
apiRouter.route("/", docsRouter);
apiRouter.route("/", commentsRouter);
apiRouter.route("/", inquiriesRouter);

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

// Users & Profiles
apiRouter.route("/", profilesRouter);

// ── Global Platform Search (stays in aggregator — crosses domains) ───
apiRouter.get("/search", async (c) => {
  try {
    const q = c.req.query("q") || "";
    if (q.length < 2) return c.json({ results: [] });

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

// ── Mount at /api and /dashboard/api ─────────────────────────────────
app.route("/api", apiRouter);
app.route("/dashboard/api", apiRouter);

export const onRequest = handle(app);

export default app;
