/* eslint-disable @typescript-eslint/no-explicit-any */
import { typedHandler } from "../utils/handler";
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
import type { HonoContext as _HonoContext } from "@shared/types/api";



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

judgesRouter.openapi(judgeLoginRoute, typedHandler<typeof judgeLoginRoute>(async (c) => {
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  const db = c.get("db") as any;

  const ua = c.req.header("User-Agent") || "unknown";
  const allowed = await checkPersistentRateLimit(db, `judge-login:${ip}`, ua, 10, 60);
  if (!allowed) {
    return c.json({ error: "Too many attempts. Please try again later." } as any, 429 as any);
  }

  try {
    const { code, turnstileToken } = c.req.valid("json");
    if (!code) {
      return c.json({ error: "Code required" } as any, 400 as any);
    }

    const validToken = await verifyTurnstile(turnstileToken || "", c.env.TURNSTILE_SECRET_KEY, ip);
    if (!validToken) {
      return c.json({ error: "Security verification failed." } as any, 403 as any);
    }

    const row = await db.selectFrom("judge_access_codes")
      .select(["code", "label", "expires_at"])
      .where("code", "=", code)
      .where((eb: any) => eb.or([
        eb("expires_at", "is", null),
        eb("expires_at", ">", new Date().toISOString())
      ]))
      .executeTakeFirst();

    if (!row) {
      return c.json({ error: "Invalid or expired access code" } as any, 403 as any);
    }

    return c.json({ success: true, label: row.label } as any, 200 as any);
  } catch {
    return c.json({ error: "Login failed" } as any, 500 as any);
  }
}));

judgesRouter.openapi(judgePortfolioRoute, typedHandler<typeof judgePortfolioRoute>(async (c) => {
  const db = c.get("db") as any;
  try {
    const { "x-judge-code": code } = c.req.valid("header");
    if (!code) {
      return c.json({ error: "Access code required" } as any, 401 as any);
    }

    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    const ua = c.req.header("User-Agent") || "unknown";
    const allowed = await checkPersistentRateLimit(db, `judge-portfolio:${ip}`, ua, 20, 60);
    if (!allowed) {
      return c.json({ error: "Too many requests" } as any, 429 as any);
    }

    const valid = await db.selectFrom("judge_access_codes")
      .select("code")
      .where("code", "=", code)
      .where((eb: any) => eb.or([
        eb("expires_at", "is", null),
        eb("expires_at", ">", new Date().toISOString())
      ]))
      .executeTakeFirst();
    if (!valid) {
      return c.json({ error: "Invalid or expired access code" } as any, 403 as any);
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
        .where((eb: any) => eb.or([eb("is_portfolio", "=", 1), eb("is_executive_summary", "=", 1)]))
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
      portfolioDocs: portfolioDocs.map((d: any) => ({
        ...d,
        content: sanitizeJudgeContent(d.content)
      })),
      outreach: outreach.map((o: any) => ({
        ...o,
        description: sanitizeJudgeContent(o.description || ""),
        students_count: Number(o.students_count),
        hours_logged: Number(o.hours_logged),
        reach_count: Number(o.reach_count)
      })),
      awards: awards.map((a: any) => ({
        ...a,
        description: sanitizeJudgeContent(a.description || ""),
        year: Number(a.date)
      })),
      sponsors: sponsors.map((s: any) => ({ ...s, id: s.id || "", tier: s.tier as string }))
    };

    portfolioCache.set(cacheKey, { data: payload, expiresAt: now + 300000, version: portfolioCacheVersion });

    return c.json(payload as any, 200 as any);
  } catch (err) {
    console.error("[Judges] Portfolio failed:", err);
    return c.json({ error: "Portfolio fetch failed" } as any, 500 as any);
  }
}));

// Admin routes require ensureAdmin middleware
judgesRouter.use("/admin/*", ensureAdmin);

judgesRouter.openapi(listJudgeCodesRoute, typedHandler<typeof listJudgeCodesRoute>(async (c) => {
  const db = c.get("db") as any;
  try {
    const results = await db.selectFrom("judge_access_codes")
      .select(["id", "code", "label", "created_at", "expires_at"])
      .orderBy("created_at", "desc")
      .execute();

    const codes = results.map((r: any) => ({
      ...r,
      created_at: String(r.created_at),
      expires_at: r.expires_at || null
    }));

    return c.json({ codes } as any, 200 as any);
  } catch {
    return c.json({ error: "Failed to fetch codes" } as any, 500 as any);
  }
}));

judgesRouter.openapi(createJudgeCodeRoute, typedHandler<typeof createJudgeCodeRoute>(async (c) => {
  const db = c.get("db") as any;
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
    return c.json({ success: true, code, id } as any, 200 as any);
  } catch {
    return c.json({ error: "Create failed" } as any, 500 as any);
  }
}));

judgesRouter.openapi(deleteJudgeCodeRoute, typedHandler<typeof deleteJudgeCodeRoute>(async (c) => {
  const db = c.get("db") as any;
  try {
    const { id } = c.req.valid("param");
    await db.deleteFrom("judge_access_codes").where("id", "=", id).execute();

    // WR-08: Invalidate cache when content changes
    portfolioCacheVersion++;
    portfolioCache.clear();

    return c.json({ success: true } as any, 200 as any);
  } catch {
    return c.json({ error: "Delete failed" } as any, 500 as any);
  }
}));

export default judgesRouter;
