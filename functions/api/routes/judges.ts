import { eq, or, and, isNull, gt, desc } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv, ensureAdmin, verifyTurnstile, logAuditAction, checkPersistentRateLimit, getDb } from "../middleware";
import { list, notDeleted } from "../../../src/db/query-helpers";

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
  studentsCount: number | null;
  hoursLogged: number | null;
  reachCount: number | null;
  description: string | null;
}



interface SponsorResult {
  id: string;
  name: string;
  tier: string;
  logoUrl: string | null;
  websiteUrl: string | null;
}

interface JudgeCodeListResult {
  id: string;
  code: string;
  label: string | null;
  createdAt: string;
  expiresAt: string | null;
}

// Types for API responses - inferred from shared routes


type JudgeLoginSuccess = z.infer<typeof judgeLoginRoute.responses[200]["content"]["application/json"]["schema"]>;


type JudgePortfolioSuccess = z.infer<typeof judgePortfolioRoute.responses[200]["content"]["application/json"]["schema"]>;


type ListJudgeCodesSuccess = z.infer<typeof listJudgeCodesRoute.responses[200]["content"]["application/json"]["schema"]>;


type CreateJudgeCodeSuccess = z.infer<typeof createJudgeCodeRoute.responses[200]["content"]["application/json"]["schema"]>;


type DeleteJudgeCodeSuccess = z.infer<typeof deleteJudgeCodeRoute.responses[200]["content"]["application/json"]["schema"]>;




const _judgesRouter = new OpenAPIHono<AppEnv>();

// Apply ensureAdmin middleware to /admin/* routes BEFORE adding routes
_judgesRouter.use("/admin/*", ensureAdmin);

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
export const judgesRouter = _judgesRouter
    .openapi(judgeLoginRoute, async (c) => {
      const ip = c.req.header("CF-Connecting-IP") || "unknown";
      const db = getDb(c);

      const ua = c.req.header("User-Agent") || "unknown";
      const allowed = await checkPersistentRateLimit(db, `judge-login:${ip}`, ua, 10, 60);
      if (!allowed) {
        return c.json({ error: "Too many requests" }, 429);
      }

        const { code, turnstileToken } = c.req.valid("json");
        if (!code) {
          return c.json({ error: "Code required" }, 400);
        }

        const validToken = await verifyTurnstile(turnstileToken || "", c.env.TURNSTILE_SECRET_KEY, ip);
        if (!validToken) {
          return c.json({ error: "Security verification failed" }, 403);
        }

        const [row] = await db.select({
          code: schema.judgeAccessCodes.code,
          label: schema.judgeAccessCodes.label,
          expiresAt: schema.judgeAccessCodes.expiresAt,
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

        return c.json({ success: true, label: row.label || "" } satisfies JudgeLoginSuccess, 200);
    })
    .openapi(judgePortfolioRoute, async (c) => {
      const db = getDb(c);
        const { "x-judge-code": code } = c.req.header();
        if (!code) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        const ip = c.req.header("CF-Connecting-IP") || "unknown";
        const ua = c.req.header("User-Agent") || "unknown";
        const allowed = await checkPersistentRateLimit(db, `judge-portfolio:${ip}`, ua, 20, 60);
        if (!allowed) {
          return c.json({ error: "Too many requests" }, 429);
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
          return c.json({ error: "Invalid or expired access code" }, 403);
        }

        // WR-10: Audit log judge portfolio access for security monitoring
        c.executionCtx.waitUntil(logAuditAction(c, "JUDGE_PORTFOLIO_ACCESS", "judge_access", code, `Judge portfolio accessed via code ${code}`));

        const now = Date.now();
        const cacheKey = getPortfolioCacheKey();
        const cached = portfolioCache.get(cacheKey);
        if (cached && cached.expiresAt > now && cached.version === portfolioCacheVersion) {
          return c.json(cached.data as JudgePortfolioSuccess, 200);
        }

        const [portfolioDocs, outreach, awards, sponsors] = await Promise.all([
          list(db, schema.docs, {
            select: {
              slug: schema.docs.slug,
              title: schema.docs.title,
              category: schema.docs.category,
              description: schema.docs.description,
              content: schema.docs.content,
            },
            where: and(
              notDeleted(schema.docs),
              eq(schema.docs.status, "published"),
              or(eq(schema.docs.isPortfolio, 1), eq(schema.docs.isExecutiveSummary, 1))
            ),
            orderBy: [desc(schema.docs.isExecutiveSummary), schema.docs.category, schema.docs.sortOrder],
            useAll: true
          }),
          list(db, schema.outreachLogs, {
            select: {
              id: schema.outreachLogs.id,
              title: schema.outreachLogs.title,
              date: schema.outreachLogs.date,
              location: schema.outreachLogs.location,
              studentsCount: schema.outreachLogs.studentsCount,
              hoursLogged: schema.outreachLogs.hours,
              reachCount: schema.outreachLogs.peopleReached,
              description: schema.outreachLogs.impactSummary,
            },
            where: notDeleted(schema.outreachLogs),
            orderBy: desc(schema.outreachLogs.date),
            useAll: true
          }),
          list(db, schema.awards, {
            select: {
              id: schema.awards.id,
              title: schema.awards.title,
              date: schema.awards.date,
              eventName: schema.awards.eventName,
              imageUrl: schema.awards.iconType,
              description: schema.awards.description,
            },
            where: notDeleted(schema.awards),
            orderBy: desc(schema.awards.date),
            useAll: true
          }),
          db.select({
            id: schema.sponsors.id,
            name: schema.sponsors.name,
            tier: schema.sponsors.tier,
            logoUrl: schema.sponsors.logoUrl,
            websiteUrl: schema.sponsors.websiteUrl,
          }).from(schema.sponsors)
            .where(eq(schema.sponsors.isActive, 1))
            .all()
        ]);

        const payload: JudgePortfolioSuccess = {
          portfolioDocs: portfolioDocs.map((d: PortfolioDocResult) => ({
            slug: d.slug,
            title: d.title,
            category: d.category,
            description: d.description || "",
            content: sanitizeJudgeContent(d.content),
            isExecutiveSummary: d.category === "Executive Summary" ? 1 : undefined,
          })),
          outreach: outreach.map((o: OutreachResult) => ({
            id: o.id,
            title: o.title,
            date: o.date,
            location: o.location || "",
            studentsCount: Number(o.studentsCount),
            hoursLogged: Number(o.hoursLogged),
            reachCount: Number(o.reachCount),
            description: sanitizeJudgeContent(o.description || ""),
          })),
          awards: awards.map((a) => ({
            id: a.id,
            title: a.title,
            date: a.date,
            eventName: a.eventName,
            imageUrl: a.imageUrl,
            description: sanitizeJudgeContent(a.description || ""),
            year: Number(a.date)
          })),
          sponsors: sponsors.map((s: SponsorResult) => ({ ...s, id: s.id || "", tier: s.tier as string }))
        };

        portfolioCache.set(cacheKey, { data: payload, expiresAt: now + 300000, version: portfolioCacheVersion });

        return c.json(payload, 200);
    })
    .openapi(listJudgeCodesRoute, async (c) => {
      const db = getDb(c);
        const results = await db.select({
          id: schema.judgeAccessCodes.id,
          code: schema.judgeAccessCodes.code,
          label: schema.judgeAccessCodes.label,
          createdAt: schema.judgeAccessCodes.createdAt,
          expiresAt: schema.judgeAccessCodes.expiresAt,
        }).from(schema.judgeAccessCodes)
          .orderBy(desc(schema.judgeAccessCodes.createdAt));

        const codes: JudgeCodeListResult[] = results.map((r) => ({
          id: r.id,
          code: r.code,
          label: r.label || "",
          createdAt: String(r.createdAt),
          expiresAt: r.expiresAt || null
        }));

        return c.json({ codes } satisfies ListJudgeCodesSuccess, 200);
    })
    .openapi(createJudgeCodeRoute, async (c) => {
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
        return c.json({ success: true, code, id } satisfies CreateJudgeCodeSuccess, 200);
    })
    .openapi(deleteJudgeCodeRoute, async (c) => {
      const db = getDb(c);
        const { id } = c.req.valid("param");
        await db.delete(schema.judgeAccessCodes).where(eq(schema.judgeAccessCodes.id, id)).run();

        // WR-08: Invalidate cache when content changes
        portfolioCacheVersion++;
        portfolioCache.clear();

        return c.json({ success: true } satisfies DeleteJudgeCodeSuccess, 200);
    });

export default judgesRouter;
