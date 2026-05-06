import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { OpenAPIHono } from "@hono/zod-openapi";
import { AppEnv, ensureAdmin, verifyTurnstile, logAuditAction, checkPersistentRateLimit } from "../middleware";
import {
  judgeLoginRoute,
  judgePortfolioRoute,
  listJudgeCodesRoute,
  createJudgeCodeRoute,
  deleteJudgeCodeRoute,
} from "../../../shared/routes/judges";
import type { HonoContext } from "@shared/types/api";

export const judgesRouter = new OpenAPIHono<AppEnv>();

/**
 * Strips internal metadata and TODOs from content before judge consumption.
 * Ensures the printed portfolio is championship-ready.
 */
function sanitizeJudgeContent(content: string): string {
  if (!content) return "";
  return content
    .replace(/\[\/\/\]: # \(.*?\)/gs, '') // HTML comments / Tiptap hidden nodes
    .replace(/TODO:.*?(?:\n|$)/gi, '')        // Inline TODOs
    .replace(/FIXME:.*?(?:\n|$)/gi, '')       // Inline FIXMEs
    .trim();
}

// WR-08: Add cache versioning to prevent stale data
let portfolioCacheVersion = 0;

const portfolioCache = new Map<string, { data: unknown; expiresAt: number; version: number }>();

// Helper to get the current portfolio cache key with version
const getPortfolioCacheKey = () => `portfolio_v${portfolioCacheVersion}`;

judgesRouter.openapi(judgeLoginRoute, async (c) => {
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  const db = c.get("db") as Kysely<DB>;

  const ua = c.req.header("User-Agent") || "unknown";
  const allowed = await checkPersistentRateLimit(db, `judge-login:${ip}`, ua, 10, 60);
  if (!allowed) {
    return c.json({ error: "Too many attempts. Please try again later." }, 429);
  }

  try {
    const { code, turnstileToken } = c.req.valid("json");
    if (!code) {
      return c.json({ error: "Code required" }, 400);
    }

    const validToken = await verifyTurnstile(turnstileToken || "", c.env.TURNSTILE_SECRET_KEY, ip);
    if (!validToken) {
      return c.json({ error: "Security verification failed." }, 403);
    }

    const row = await db.selectFrom("judge_access_codes")
      .select(["code", "label", "expires_at"])
      .where("code", "=", code)
      .where((eb) => eb.or([
        eb("expires_at", "is", null),
        eb("expires_at", ">", new Date().toISOString())
      ]))
      .executeTakeFirst();

    if (!row) {
      return c.json({ error: "Invalid or expired access code" }, 403);
    }

    return c.json({ success: true, label: row.label }, 200);
  } catch {
    return c.json({ error: "Login failed" }, 500);
  }
});

judgesRouter.openapi(judgePortfolioRoute, async (c) => {
  const db = c.get("db") as Kysely<DB>;
  try {
    const { "x-judge-code": code } = c.req.valid("header");
    if (!code) {
      return c.json({ error: "Access code required" }, 401);
    }

    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    const ua = c.req.header("User-Agent") || "unknown";
    const allowed = await checkPersistentRateLimit(db, `judge-portfolio:${ip}`, ua, 20, 60);
    if (!allowed) {
      return c.json({ error: "Too many requests" }, 429);
    }

    const valid = await db.selectFrom("judge_access_codes")
      .select("code")
      .where("code", "=", code)
      .where((eb) => eb.or([
        eb("expires_at", "is", null),
        eb("expires_at", ">", new Date().toISOString())
      ]))
      .executeTakeFirst();
    if (!valid) {
      return c.json({ error: "Invalid or expired access code" }, 403);
    }

    // WR-10: Audit log judge portfolio access for security monitoring
    c.executionCtx.waitUntil(logAuditAction(c, "JUDGE_PORTFOLIO_ACCESS", "judge_access", code, `Judge portfolio accessed via code ${code}`));

    const now = Date.now();
    const cacheKey = getPortfolioCacheKey();
    const cached = portfolioCache.get(cacheKey);
    if (cached && cached.expiresAt > now && cached.version === portfolioCacheVersion) {
      return c.json(cached.data, 200);
    }

    const [portfolioDocs, outreach, awards, sponsors] = await Promise.all([
      db.selectFrom("docs")
        .select(["slug", "title", "category", "description", "content"])
        .where("is_deleted", "=", 0)
        .where("status", "=", "published")
        .where((eb) => eb.or([eb("is_portfolio", "=", 1), eb("is_executive_summary", "=", 1)]))
        .orderBy("is_executive_summary", "desc")
        .orderBy("category")
        .orderBy("sort_order")
        .execute(),
      db.selectFrom("outreach_logs")
        .select(["id", "title", "date", "location", "students_count", "hours as hours_logged", "people_reached as reach_count", "impact_summary as description"])
        .where("is_deleted", "=", 0)
        .orderBy("date", "desc")
        .execute(),
      db.selectFrom("awards")
        .select(["id", "title", "date", "event_name", "icon_type as image_url", "description"])
        .where("is_deleted", "=", 0)
        .orderBy("date", "desc")
        .execute(),
      db.selectFrom("sponsors")
        .select(["id", "name", "tier", "logo_url", "website_url"])
        .where("is_active", "=", 1)
        .execute()
    ]);

    const payload = {
      portfolioDocs: portfolioDocs.map(d => ({
        ...d,
        content: sanitizeJudgeContent(d.content)
      })),
      outreach: outreach.map(o => ({
        ...o,
        description: sanitizeJudgeContent(o.description || ""),
        students_count: Number(o.students_count),
        hours_logged: Number(o.hours_logged),
        reach_count: Number(o.reach_count)
      })),
      awards: awards.map(a => ({
        ...a,
        description: sanitizeJudgeContent(a.description || ""),
        year: Number(a.date)
      })),
      sponsors: sponsors.map(s => ({ ...s, id: s.id || "", tier: s.tier as string }))
    };

    portfolioCache.set(cacheKey, { data: payload, expiresAt: now + 300000, version: portfolioCacheVersion });

    return c.json(payload, 200);
  } catch (err) {
    console.error("[Judges] Portfolio failed:", err);
    return c.json({ error: "Portfolio fetch failed" }, 500);
  }
});

// Admin routes require ensureAdmin middleware
judgesRouter.use("/admin/*", ensureAdmin);

judgesRouter.openapi(listJudgeCodesRoute, async (c) => {
  const db = c.get("db") as Kysely<DB>;
  try {
    const results = await db.selectFrom("judge_access_codes")
      .select(["id", "code", "label", "created_at", "expires_at"])
      .orderBy("created_at", "desc")
      .execute();

    const codes = results.map(r => ({
      ...r,
      created_at: String(r.created_at),
      expires_at: r.expires_at || null
    }));

    return c.json({ codes }, 200);
  } catch {
    return c.json({ error: "Failed to fetch codes" }, 500);
  }
});

judgesRouter.openapi(createJudgeCodeRoute, async (c) => {
  const db = c.get("db") as Kysely<DB>;
  try {
    const { label, expiresAt } = c.req.valid("json");
    const code = (crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')).slice(0, 12).toUpperCase();
    const id = crypto.randomUUID();

    await db.insertInto("judge_access_codes")
      .values({
        id,
        code,
        label: label || "Judges",
        expires_at: expiresAt || null
      })
      .execute();

    // WR-08: Invalidate cache when content changes
    portfolioCacheVersion++;
    portfolioCache.clear();

    c.executionCtx.waitUntil(logAuditAction(c, "CREATE_JUDGE_CODE", "judge_access", id, `Created access code: ${label}`));
    return c.json({ success: true, code, id }, 200);
  } catch {
    return c.json({ error: "Create failed" }, 500);
  }
});

judgesRouter.openapi(deleteJudgeCodeRoute, async (c) => {
  const db = c.get("db") as Kysely<DB>;
  try {
    const { id } = c.req.valid("param");
    await db.deleteFrom("judge_access_codes").where("id", "=", id).execute();

    // WR-08: Invalidate cache when content changes
    portfolioCacheVersion++;
    portfolioCache.clear();

    return c.json({ success: true }, 200);
  } catch {
    return c.json({ error: "Delete failed" }, 500);
  }
});

export default judgesRouter;
