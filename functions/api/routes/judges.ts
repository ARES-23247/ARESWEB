import { typedHandler } from "../utils/handler";
import { ApiError } from "../middleware/errorHandler";
import { eq, or, and, isNull, gt, desc } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv, ensureAdmin, verifyTurnstile, logAuditAction, checkPersistentRateLimit, getDb } from "../middleware";
import { errorResponses, ErrorCode } from "../../../shared/errors/api";
import {
  judgeLoginRoute,
  judgePortfolioRoute,
  listJudgeCodesRoute,
  createJudgeCodeRoute,
  deleteJudgeCodeRoute,
} from "../../../shared/routes/judges";
import type { HonoContext as _HonoContext } from "@shared/types/api";

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

interface AwardResult {
  id: number;
  title: string;
  date: string;
  event_name: string;
  image_url: string;
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
  created_at: string;
  expires_at: string | null;
}

// Types for API responses
interface ErrorResponse {
  error: string;
}

interface JudgeLoginSuccessResponse {
  success: true;
  label: string;
}

interface PortfolioResponse {
  portfolioDocs: Array<{
    slug: string;
    title: string;
    category: string;
    description: string | null;
    content: string;
  }>;
  outreach: Array<{
    id: number;
    title: string;
    date: string;
    location: string | null;
    students_count: number;
    hours_logged: number;
    reach_count: number;
    description: string;
  }>;
  awards: Array<{
    id: number;
    title: string;
    year: number;
    event_name: string;
    image_url: string;
    description: string;
  }>;
  sponsors: Array<{
    id: string;
    name: string;
    tier: string;
    logo_url: string | null;
    website_url: string | null;
  }>;
}

interface JudgeCodesResponse {
  codes: Array<{
    id: string;
    code: string;
    label: string;
    created_at: string;
    expires_at: string | null;
  }>;
}

interface CreateJudgeCodeResponse {
  success: true;
  code: string;
  id: string;
}

interface SuccessResponse {
  success: true;
}



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
  const db = getDb(c);

  const ua = c.req.header("User-Agent") || "unknown";
  const allowed = await checkPersistentRateLimit(db, `judge-login:${ip}`, ua, 10, 60);
  if (!allowed) {
    return errorResponses.tooManyRequests(c);
  }

    const { code, turnstileToken } = c.req.valid("json");
    if (!code) {
      throw new ApiError("Code required", 400, "VALIDATION_ERROR");
    }

    const validToken = await verifyTurnstile(turnstileToken || "", c.env.TURNSTILE_SECRET_KEY, ip);
    if (!validToken) {
      throw new ApiError("Security verification failed", 403);
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
      throw new ApiError("Invalid or expired access code", 403);
    }

    return c.json({ success: true, label: row.label }, 200);
}));

judgesRouter.openapi(judgePortfolioRoute, typedHandler<typeof judgePortfolioRoute>(async (c) => {
  const db = getDb(c);
    const { "x-judge-code": code } = c.req.valid("header");
    if (!code) {
      throw new ApiError("Access code required", 401);
    }

    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    const ua = c.req.header("User-Agent") || "unknown";
    const allowed = await checkPersistentRateLimit(db, `judge-portfolio:${ip}`, ua, 20, 60);
    if (!allowed) {
      return errorResponses.tooManyRequests(c);
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
      throw new ApiError("Invalid or expired access code", 403);
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
        event_name: schema.awards.eventName,
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

    const payload: PortfolioResponse = {
      portfolioDocs: portfolioDocs.map((d: PortfolioDocResult) => ({
        ...d,
        content: sanitizeJudgeContent(d.content)
      })),
      outreach: outreach.map((o: OutreachResult) => ({
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
      sponsors: sponsors.map((s: SponsorResult) => ({ ...s, id: s.id || "", tier: s.tier as string }))
    };

    portfolioCache.set(cacheKey, { data: payload, expiresAt: now + 300000, version: portfolioCacheVersion });

    return c.json(payload, 200);
}));

// Admin routes require ensureAdmin middleware
judgesRouter.use("/admin/*", ensureAdmin);

judgesRouter.openapi(listJudgeCodesRoute, typedHandler<typeof listJudgeCodesRoute>(async (c) => {
  const db = getDb(c);
    const results = await db.select({
      id: schema.judgeAccessCodes.id,
      code: schema.judgeAccessCodes.code,
      label: schema.judgeAccessCodes.label,
      created_at: schema.judgeAccessCodes.createdAt,
      expires_at: schema.judgeAccessCodes.expiresAt,
    }).from(schema.judgeAccessCodes)
      .orderBy(desc(schema.judgeAccessCodes.createdAt));

    const codes: JudgeCodeListResult[] = results.map((r: any) => ({
      ...r,
      created_at: String(r.created_at),
      expires_at: r.expires_at || null
    }));

    return c.json({ codes }, 200);
}));

judgesRouter.openapi(createJudgeCodeRoute, typedHandler<typeof createJudgeCodeRoute>(async (c) => {
  const db = getDb(c);
    const { label, expiresAt } = c.req.valid("json");
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
    return c.json({ success: true, code, id }, 200);
}));

judgesRouter.openapi(deleteJudgeCodeRoute, typedHandler<typeof deleteJudgeCodeRoute>(async (c) => {
  const db = getDb(c);
    const { id } = c.req.valid("param");
    await db.delete(schema.judgeAccessCodes).where(eq(schema.judgeAccessCodes.id, id)).run();

    // WR-08: Invalidate cache when content changes
    portfolioCacheVersion++;
    portfolioCache.clear();

    return c.json({ success: true }, 200);
}));

export default judgesRouter;
