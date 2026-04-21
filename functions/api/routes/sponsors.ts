import { Context, Hono } from "hono";
import { AppEnv, ensureAdmin, logAuditAction, parsePagination, validateLength, MAX_INPUT_LENGTHS } from "./_shared";
import { sendZulipAlert } from "../../utils/zulipSync";

const sponsorsRouter = new Hono<AppEnv>();

// ── GET /sponsors — list active sponsors for public display ───────────
sponsorsRouter.get("/", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT id, name, tier, logo_url, website_url FROM sponsors WHERE is_active = 1 ORDER BY CASE tier WHEN 'Titanium' THEN 1 WHEN 'Gold' THEN 2 WHEN 'Silver' THEN 3 ELSE 4 END"
    ).all();
    const response = c.json({ sponsors: results || [] });
    // SEC-DoW: CDN cache for 5 min — sponsors rarely change
    response.headers.set("Cache-Control", "public, s-maxage=300, max-age=60");
    return response;
  } catch (err) {
    console.error("D1 sponsors list error:", err);
    return c.json({ sponsors: [] });
  }
});

// ── GET /admin — list all sponsors (admin) ──────
sponsorsRouter.get("/admin", ensureAdmin, async (c) => {
  return handleSponsorList(c);
});

async function handleSponsorList(c: Context<AppEnv>) {
  try {
    const { limit, offset } = parsePagination(c, 50, 200);
    const { results } = await c.env.DB.prepare("SELECT id, name, tier, logo_url, website_url, is_active, created_at FROM sponsors ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(limit, offset).all();
    return c.json({ sponsors: results || [] });
  } catch (err) {
    console.error("D1 admin sponsors list error:", err);
    return c.json({ sponsors: [] });
  }
}

// ── POST /admin — create or update a sponsor (admin) ──────
sponsorsRouter.post("/admin", ensureAdmin, async (c) => {
  return handleSponsorSave(c);
});

async function handleSponsorSave(c: Context<AppEnv>) {
  try {
    const body = await c.req.json();
    const { id, name, tier, logo_url, website_url, is_active } = body;
    
    if (!id || !name || !tier) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    // REF-06: Input validation
    const VALID_TIERS = ["Titanium", "Gold", "Silver", "Bronze", "Community"];
    if (!VALID_TIERS.includes(tier)) {
      return c.json({ error: `Invalid tier. Must be one of: ${VALID_TIERS.join(", ")}` }, 400);
    }
    const nameErr = validateLength(name, MAX_INPUT_LENGTHS.name, "Sponsor name");
    if (nameErr) return c.json({ error: nameErr }, 400);

    await c.env.DB.prepare(
      "INSERT INTO sponsors (id, name, tier, logo_url, website_url, is_active) VALUES (?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET name=excluded.name, tier=excluded.tier, logo_url=excluded.logo_url, website_url=excluded.website_url, is_active=excluded.is_active"
    ).bind(id, name, tier, logo_url || null, website_url || null, is_active ?? 1).run();

    await logAuditAction(c, "sponsor_saved", "sponsors", id, `Sponsor "${name}" (${tier}) saved`);
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 sponsor save error:", err);
    return c.json({ error: "Save failed" }, 500);
  }
}

// ── DELETE /admin/:id — remove a sponsor (admin) ─────────
sponsorsRouter.delete("/admin/:id", ensureAdmin, async (c) => {
  try {
    const id = (c.req.param("id") || "");
    await c.env.DB.prepare("DELETE FROM sponsors WHERE id = ?").bind(id).run();
    await logAuditAction(c, "sponsor_deleted", "sponsors", id || "unknown", "Sponsor permanently deleted");
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 sponsor delete error:", err);
    return c.json({ error: "Delete failed" }, 500);
  }
});

// ── GET /sponsors/roi/:token — Public (hidden) Sponsor Dashboard ────
sponsorsRouter.get("/roi/:token", async (c) => {
  try {
    const token = (c.req.param("token") || "");
    const { results: tokens } = await c.env.DB.prepare(
      "SELECT sponsor_id FROM sponsor_tokens WHERE token = ?"
    ).bind(token).all();

    if (!tokens || tokens.length === 0) {
      return c.json({ error: "Invalid token" }, 403);
    }

    const sponsor_id = tokens[0].sponsor_id;

    // Fetch sponsor details
    const sponsorResult = await c.env.DB.prepare(
      "SELECT id, name, tier, logo_url, website_url FROM sponsors WHERE id = ?"
    ).bind(sponsor_id).all();

    // Fetch metrics
    const metricsResult = await c.env.DB.prepare(
      "SELECT year_month, impressions, clicks FROM sponsor_metrics WHERE sponsor_id = ? ORDER BY year_month ASC"
    ).bind(sponsor_id).all();

    return c.json({ 
      sponsor: sponsorResult.results?.[0], 
      metrics: metricsResult.results || [] 
    });
  } catch (err) {
    console.error("D1 sponsor ROI error:", err);
    return c.json({ error: "Failed to fetch ROI" }, 500);
  }
});

// ── GET /admin/tokens — Get Tokens for Admins (admin) ──────
sponsorsRouter.get("/admin/tokens", ensureAdmin, async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT t.token, t.sponsor_id, s.name as sponsor_name, t.created_at FROM sponsor_tokens t JOIN sponsors s ON t.sponsor_id = s.id ORDER BY t.created_at DESC"
    ).all();
    return c.json({ tokens: results || [] });
  } catch {
    return c.json({ tokens: [] }, 500);
  }
});

// ── POST /admin/tokens/generate — Generate Token (admin) ──────
sponsorsRouter.post("/admin/tokens/generate", ensureAdmin, async (c) => {
  try {
    const { sponsor_id } = await c.req.json();
    if (!sponsor_id) return c.json({ error: "Missing sponsor_id"}, 400);
    const token = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO sponsor_tokens (token, sponsor_id) VALUES (?, ?)"
    ).bind(token, sponsor_id).run();

    await logAuditAction(c, "sponsor_token_generated", "sponsor_tokens", token, `ROI token generated for sponsor ${sponsor_id}`);

    c.executionCtx.waitUntil((async () => {
      try {
        const sRes = await c.env.DB.prepare("SELECT name FROM sponsors WHERE id = ?").bind(sponsor_id).first<{name: string}>();
        if (sRes) {
          await sendZulipAlert(
            c.env,
            "Sponsor",
            "New Sponsor ROI Token Generated",
            `A magic ROI access link was just generated for **${sRes.name}**.\nTheir engagement and click metrics are now securely accessible via their specific token link.`
          );
        }
      } catch (err) {
        console.error("Failed to sync sponsor creation to Zulip", err);
      }
    })());

    return c.json({ success: true, token });
  } catch {
    return c.json({ error: "Failed to generate" }, 500);
  }
});

export default sponsorsRouter;
