import { Hono } from "hono";
import { AppEnv, ensureAdmin, checkWriteRateLimit, verifyTurnstile, rateLimitMiddleware  } from "../middleware";
import { getSessionUser } from "../middleware";

const judgesRouter = new Hono<AppEnv>();

// ── POST /judges/login — verify judge access code ─────────────────────
judgesRouter.post("/login", async (c) => {
  // SEC-DoW: Brute-force code guessing burns D1 reads
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  if (!checkWriteRateLimit(`judge-login:${ip}`, 10, 60)) {
    return c.json({ error: "Too many attempts. Please try again later." }, 429);
  }

  try {
    const body = await c.req.json();
    const { code, turnstileToken } = body;
    if (!code) return c.json({ error: "Code required" }, 400);
    if (code.length > 50) return c.json({ error: "Invalid code format" }, 400);

    // SEC-DoW: Verify Turnstile challenge before D1 lookup
    const valid = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET_KEY, ip);
    if (!valid) {
      return c.json({ error: "Security verification failed. Please try again." }, 403);
    }

    const row = await c.env.DB.prepare(
      "SELECT code, label, expires_at FROM judge_access_codes WHERE code = ? AND (expires_at IS NULL OR expires_at > datetime('now'))"
    ).bind(code).first();

    if (!row) return c.json({ error: "Invalid or expired access code" }, 403);

    return c.json({ success: true, label: row.label });
  } catch (err) {
    console.error("Judge login error:", err);
    return c.json({ error: "Login failed" }, 500);
  }
});

// SEC-DoW: Cache heavy portfolio responses (4 parallel D1 queries per request)
const portfolioCache = new Map<string, { data: unknown; expiresAt: number }>();

// ── GET /judges/portfolio — get all portfolio content ──────────────────
judgesRouter.get("/portfolio", async (c) => {
  try {
    // Verify access code from header
    const code = c.req.header("X-Judge-Code");
    if (!code) return c.json({ error: "Access code required" }, 401);

    // SEC-DoW: Rate-limit code validation attempts
    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    if (!checkWriteRateLimit(`judge-portfolio:${ip}`, 20, 60)) {
      return c.json({ error: "Too many requests" }, 429);
    }

    const valid = await c.env.DB.prepare(
      "SELECT code FROM judge_access_codes WHERE code = ? AND (expires_at IS NULL OR expires_at > datetime('now'))"
    ).bind(code).first();
    // wait, v.env.DB is wrong, should be c.env.DB. 
    // And actually it was c.env.DB in previous read. I must have misread or it changed.
    
    // Check cache (5 minute TTL — portfolio content doesn't change mid-tournament)
    const now = Date.now();
    const cached = portfolioCache.get("portfolio");
    if (cached && cached.expiresAt > now) {
      return c.json(cached.data);
    }

    // Fetch portfolio & executive summary docs
    const { results: portfolioDocs } = await c.env.DB.prepare(
      "SELECT slug, title, category, description, content FROM docs WHERE is_deleted = 0 AND (is_portfolio = 1 OR is_executive_summary = 1) ORDER BY is_executive_summary DESC, category, sort_order"
    ).all();

    // Fetch outreach data
    const { results: outreach } = await c.env.DB.prepare(
      "SELECT id, title, date, location, COALESCE(students_count, 0) as students_count, COALESCE(hours, 0) as hours_logged, COALESCE(people_reached, 0) as reach_count, impact_summary as description FROM outreach_logs ORDER BY date DESC"
    ).all();

    // Fetch awards
    const { results: awards } = await c.env.DB.prepare(
      "SELECT id, title, date as year, event_name, icon_type as image_url, description FROM awards ORDER BY date DESC"
    ).all();

    // Fetch sponsors
    const { results: sponsors } = await c.env.DB.prepare(
      "SELECT id, name, tier, logo_url, website_url FROM sponsors WHERE is_active = 1 ORDER BY CASE tier WHEN 'Titanium' THEN 1 WHEN 'Gold' THEN 2 WHEN 'Silver' THEN 3 ELSE 4 END"
    ).all();

    const payload = {
      portfolioDocs: portfolioDocs || [],
      outreach: outreach || [],
      awards: awards || [],
      sponsors: sponsors || [],
    };

    // Cache the heavy payload for 5 minutes
    portfolioCache.set("portfolio", { data: payload, expiresAt: now + 300000 });

    return c.json(payload);
  } catch (err) {
    console.error("Portfolio fetch error:", err);
    return c.json({ error: "Portfolio fetch failed" }, 500);
  }
});

// ── GET /admin/judges/codes — list all access codes (admin) ────────────
judgesRouter.get("/admin/codes", ensureAdmin, async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT id, code, label, created_at, expires_at FROM judge_access_codes ORDER BY created_at DESC"
    ).all();
    return c.json({ codes: results || [] });
  } catch (err) {
    console.error("D1 judge codes list error:", err);
    return c.json({ codes: [] }, 500);
  }
});

// ── POST /admin/judges/codes — create a new access code (admin) ───────
judgesRouter.post("/admin/codes", ensureAdmin, rateLimitMiddleware(15, 60), async (c) => {
  try {
    const { label, expiresAt } = await c.req.json();
    const code = (crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')).slice(0, 12).toUpperCase();
    const id = crypto.randomUUID();

    await c.env.DB.batch([
      c.env.DB.prepare(
        "INSERT INTO judge_access_codes (id, code, label, expires_at) VALUES (?, ?, ?, ?)"
      ).bind(id, code, label || "Judge Access", expiresAt || null),
      c.env.DB.prepare(
        `INSERT INTO audit_log (id, actor, action, resource_type, resource_id, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(crypto.randomUUID(), (await getSessionUser(c))?.email || "system", "CREATE_JUDGE_CODE", "judge_access", id, `Created access code: ${label}`)
    ]);

    return c.json({ success: true, code, id });
  } catch (err) {
    console.error("D1 judge code create error:", err);
    return c.json({ error: "Create failed" }, 500);
  }
});

// ── DELETE /admin/judges/codes/:id — delete an access code (admin) ────
judgesRouter.delete("/admin/codes/:id", ensureAdmin, rateLimitMiddleware(15, 60), async (c) => {
  try {
    const id = (c.req.param("id") || "");
    await c.env.DB.prepare("DELETE FROM judge_access_codes WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 judge code delete error:", err);
    return c.json({ error: "Delete failed" }, 500);
  }
});

export default judgesRouter;
