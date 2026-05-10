import { autoResponseHandler, success, error } from "../utils/handler-v2";
import { eq, or, and, isNull, gt, desc } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv, ensureAdmin, verifyTurnstile, logAuditAction, checkPersistentRateLimit, getDb } from "../middleware";

import {
  judgeLoginRoute,
  judgePortfolioRoute,
  listJudgeCodesRoute,
  createJudgeCodeRoute,
  deleteJudgeCodeRoute,
} from "../../../shared/routes/judges";
import type { z } from "zod";

// Types for database query results

interface PortfolioDocResult {
  slug: string;
  title: string;
  category: string;
  description: string | null;
  content: string;
}

interface OutreachResult {
  id: number;
  title: string;
  date: string;
  location: string | null;
  students_count: number | null;
  hours_logged: number | null;
  reach_count: number | null;
  description: string | null;
}



interface SponsorResult {
  id: string;
  name: string;
  tier: string;
  logo_url: string | null;
  website_url: string | null;
}

interface JudgeCodeListResult {
  id: string;
  code: string;
  label: string;
  createdAt: string;
  expires_at: string | null;
}

// Types for API responses - inferred from shared routes


type JudgeLoginSuccess = z.infer<typeof judgeLoginRoute.responses[200]["content"]["application/json"]["schema"]>;


type JudgePortfolioSuccess = z.infer<typeof judgePortfolioRoute.responses[200]["content"]["application/json"]["schema"]>;


type ListJudgeCodesSuccess = z.infer<typeof listJudgeCodesRoute.responses[200]["content"]["application/json"]["schema"]>;


type CreateJudgeCodeSuccess = z.infer<typeof createJudgeCodeRoute.responses[200]["content"]["application/json"]["schema"]>;


type DeleteJudgeCodeSuccess = z.infer<typeof deleteJudgeCodeRoute.responses[200]["content"]["application/json"]["schema"]>;




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

judgesRouter.openapi(judgeLoginRoute, autoResponseHandler<typeof judgeLoginRoute>(async (c, { body }) => {
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  const db = getDb(c);

  const ua = c.req.header("User-Agent") || "unknown";
  const allowed = await checkPersistentRateLimit(db, `judge-login:${ip}`, ua, 10, 60);
  if (!allowed) {
    return error({ error: "Too many requests" }, 429);
  }

    const { code, turnstileToken } = body;
    if (!code) {
      return error({ error: "Code required" }, 400);
    }

    const validToken = await verifyTurnstile(turnstileToken || "", c.env.TURNSTILE_SECRET_KEY, ip);
    if (!validToken) {
      return error({ error: "Security verification failed" }, 403);
    }

    const [row] = await db.select({
      code: schema.judgeAccessCodes.code,
      label: schema.judgeAccessCodes.label,
      expires_at: schema.judgeAccessCodes.expiresAt,
    }).from(schema.judgeAccessCodes)
      .where(
        and(
          eq(schema.judgeAccessCodes.code, code),
          or(
            isNull(schema.judgeAccessCodes.expiresAt),
            gt(schema.judgeAccessCodes.expiresAt, new Date().toISOString())
          )
        )
      ).limit(1);

    if (!row) {
      return error({ error: "Invalid or expired access code" }, 403);
    }

    return success({ success: true, label: row.label || "" } satisfies JudgeLoginSuccess);
}));

judgesRouter.openapi(judgePortfolioRoute, autoResponseHandler<typeof judgePortfolioRoute>(async (c) => {
  const db = getDb(c);
    const { "x-judge-code": code } = c.req.header();
    if (!code) {
      return error({ error: "Access code required" }, 401);
    }

    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    const ua = c.req.header("User-Agent") || "unknown";
    const allowed = await checkPersistentRateLimit(db, `judge-portfolio:${ip}`, ua, 20, 60);
    if (!allowed) {
      return error({ error: "Too many requests" }, 429);
    }

    const [valid] = await db.select({
      code: schema.judgeAccessCodes.code,
    }).from(schema.judgeAccessCodes)
      .where(
        and(
          eq(schema.judgeAccessCodes.code, code),
          or(
            isNull(schema.judgeAccessCodes.expiresAt),
            gt(schema.judgeAccessCodes.expiresAt, new Date().toISOString())
          )
        )
      ).limit(1);
    if (!valid) {
      return error({ error: "Invalid or expired access code" }, 403);
    }

    // WR-10: Audit log judge portfolio access for security monitoring
    c.executionCtx.waitUntil(logAuditAction(c, "JUDGE_PORTFOLIO_ACCESS", "judge_access", code, `Judge portfolio accessed via code ${code}`));

    const now = Date.now();
    const cacheKey = getPortfolioCacheKey();
    const cached = portfolioCache.get(cacheKey);
    if (cached && cached.expiresAt > now && cached.version === portfolioCacheVersion) {
      return success(cached.data as JudgePortfolioSuccess);
    }

    const [portfolioDocs, outreach, awards, sponsors] = await Promise.all([
      db.select({
        slug: schema.docs.slug,
        title: schema.docs.title,
        category: schema.docs.category,
        description: schema.docs.description,
        content: schema.docs.content,
      }).from(schema.docs)
        .where(
          and(
            eq(schema.docs.isDeleted, 0),
            eq(schema.docs.status, "published"),
            or(eq(schema.docs.isPortfolio, 1), eq(schema.docs.isExecutiveSummary, 1))
          )
        )
        .orderBy(desc(schema.docs.isExecutiveSummary), schema.docs.category, schema.docs.sortOrder),
      db.select({
        id: schema.outreachLogs.id,
        title: schema.outreachLogs.title,
        date: schema.outreachLogs.date,
        location: schema.outreachLogs.location,
        students_count: schema.outreachLogs.studentsCount,
        hours_logged: schema.outreachLogs.hours,
        reach_count: schema.outreachLogs.peopleReached,
        description: schema.outreachLogs.impactSummary,
      }).from(schema.outreachLogs)
        .where(eq(schema.outreachLogs.isDeleted, 0))
        .orderBy(desc(schema.outreachLogs.date)),
      db.select({
        id: schema.awards.id,
        title: schema.awards.title,
        date: schema.awards.date,
        eventName: schema.awards.eventName,
        image_url: schema.awards.iconType,
        description: schema.awards.description,
      }).from(schema.awards)
        .where(eq(schema.awards.isDeleted, 0))
        .orderBy(desc(schema.awards.date)),
      db.select({
        id: schema.sponsors.id,
        name: schema.sponsors.name,
        tier: schema.sponsors.tier,
        logo_url: schema.sponsors.logoUrl,
        website_url: schema.sponsors.websiteUrl,
      }).from(schema.sponsors)
        .where(eq(schema.sponsors.isActive, 1))
    ]);

    const payload: JudgePortfolioSuccess = {
      portfolioDocs: portfolioDocs.map((d: PortfolioDocResult) => ({
        slug: d.slug,
        title: d.title,
        category: d.category,
        description: d.description || "",
        content: sanitizeJudgeContent(d.content),
        is_executive_summary: d.category === "Executive Summary" ? 1 : undefined,
      })),
      outreach: outreach.map((o: OutreachResult) => ({
        id: o.id,
        title: o.title,
        date: o.date,
        location: o.location || "",
        students_count: Number(o.students_count),
        hours_logged: Number(o.hours_logged),
        reach_count: Number(o.reach_count),
        description: sanitizeJudgeContent(o.description || ""),
      })),
      awards: awards.map((a) => ({
        id: a.id,
        title: a.title,
        date: a.date,
        event_name: a.eventName,
        image_url: a.image_url,
        description: sanitizeJudgeContent(a.description || ""),
        year: Number(a.date)
      })),
      sponsors: sponsors.map((s: SponsorResult) => ({ ...s, id: s.id || "", tier: s.tier as string }))
    };

    portfolioCache.set(cacheKey, { data: payload, expiresAt: now + 300000, version: portfolioCacheVersion });

    return success(payload);
}));

// Admin routes require ensureAdmin middleware
judgesRouter.use("/admin/*", ensureAdmin);

judgesRouter.openapi(listJudgeCodesRoute, autoResponseHandler<typeof listJudgeCodesRoute>(async (c) => {
  const db = getDb(c);
    const results = await db.select({
      id: schema.judgeAccessCodes.id,
      code: schema.judgeAccessCodes.code,
      label: schema.judgeAccessCodes.label,
      createdAt: schema.judgeAccessCodes.createdAt,
      expires_at: schema.judgeAccessCodes.expiresAt,
    }).from(schema.judgeAccessCodes)
      .orderBy(desc(schema.judgeAccessCodes.createdAt));

    const codes: JudgeCodeListResult[] = results.map((r) => ({
      id: r.id,
      code: r.code,
      label: r.label,
      createdAt: String(r.createdAt),
      expires_at: r.expires_at || null
    }));

    return success({ codes } satisfies ListJudgeCodesSuccess);
}));

judgesRouter.openapi(createJudgeCodeRoute, autoResponseHandler<typeof createJudgeCodeRoute>(async (c, { body }) => {
  const db = getDb(c);
    const { label, expiresAt } = body;
    const code = (crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')).slice(0, 12).toUpperCase();
    const id = crypto.randomUUID();

    await db.insert(schema.judgeAccessCodes)
      .values({
        id,
        code,
        label: label || "Judges",
        expiresAt: expiresAt || null
      })
      .run();

    // WR-08: Invalidate cache when content changes
    portfolioCacheVersion++;
    portfolioCache.clear();

    c.executionCtx.waitUntil(logAuditAction(c, "CREATE_JUDGE_CODE", "judge_access", id, `Created access code: ${label}`));
    return success({ success: true, code, id } satisfies CreateJudgeCodeSuccess);
}));

judgesRouter.openapi(deleteJudgeCodeRoute, autoResponseHandler<typeof deleteJudgeCodeRoute>(async (c, { params }) => {
  const db = getDb(c);
    const { id } = params;
    await db.delete(schema.judgeAccessCodes).where(eq(schema.judgeAccessCodes.id, id)).run();

    // WR-08: Invalidate cache when content changes
    portfolioCacheVersion++;
    portfolioCache.clear();

    return success({ success: true } satisfies DeleteJudgeCodeSuccess);
}));

export default judgesRouter;
