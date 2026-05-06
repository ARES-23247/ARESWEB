/* eslint-disable @typescript-eslint/no-explicit-any -- ts-rest handler input validated by contract library */
import { ServerInferRequest } from "../../../shared/types/api";
import { Hono } from "hono";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { createHonoEndpoints } from "ts-rest-hono";
import { judgeContract } from "../../../shared/schemas/contracts/judgeContract";
import { AppEnv, ensureAdmin, verifyTurnstile, logAuditAction, s } from "../middleware";
import type { HonoContext } from "@shared/types/api";
 


export const judgesRouter = new Hono<AppEnv>();

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

const portfolioCache = new Map<string, { data: any; expiresAt: number; version: number }>();

// Helper to get the current portfolio cache key with version
const getPortfolioCacheKey = () => `portfolio_v${portfolioCacheVersion}`;

const judgesHandlers: any = {
  login: async (input: ServerInferRequest<typeof judgeContract["login"]>, c: HonoContext) => {
    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    const { checkPersistentRateLimit } = await import("../middleware/security");
    const db = c.get("db") as Kysely<DB>;

    const ua = c.req.header("User-Agent") || "unknown";
    const allowed = await checkPersistentRateLimit(db, `judge-login:${ip}`, ua, 10, 60);
    if (!allowed) return { status: 429 as const, body: { error: "Too many attempts. Please try again later." } };

    try {
      const { code, turnstileToken } = input.body;
      if (!code) return { status: 400 as const, body: { error: "Code required" } };

      const validToken = await verifyTurnstile(turnstileToken || "", c.env.TURNSTILE_SECRET_KEY, ip);
      if (!validToken) return { status: 403 as const, body: { error: "Security verification failed." } };

      const row = await db.selectFrom("judge_access_codes")
 
                .select(["code", "label", "expires_at"])
        .where("code", "=", code)
        .where((eb) => eb.or([
          eb("expires_at", "is", null),
          eb("expires_at", ">", new Date().toISOString())
        ]))
        .executeTakeFirst();

      if (!row) return { status: 403 as const, body: { error: "Invalid or expired access code" } };

      return { status: 200 as const, body: { success: true, label: row.label } };
    } catch {
      return { status: 500 as const, body: { error: "Login failed" } };
    }
  },
    portfolio: async (input: ServerInferRequest<typeof judgeContract["portfolio"]>, c: HonoContext) => {
    const db = c.get("db") as Kysely<DB>;
    try {
      const code = input.headers["x-judge-code"];
      if (!code) return { status: 401 as const, body: { error: "Access code required" } };

      const ip = c.req.header("CF-Connecting-IP") || "unknown";
      const { checkPersistentRateLimit } = await import("../middleware/security");
      const ua = c.req.header("User-Agent") || "unknown";
      const allowed = await checkPersistentRateLimit(db, `judge-portfolio:${ip}`, ua, 20, 60);
      if (!allowed) return { status: 429 as const, body: { error: "Too many requests" } };

      const valid = await db.selectFrom("judge_access_codes")
        .select("code")
        .where("code", "=", code)
        .where((eb) => eb.or([
          eb("expires_at", "is", null),
          eb("expires_at", ">", new Date().toISOString())
        ]))
        .executeTakeFirst();
      if (!valid) return { status: 403 as const, body: { error: "Invalid or expired access code" } };

      // WR-10: Audit log judge portfolio access for security monitoring
      c.executionCtx.waitUntil(logAuditAction(c, "JUDGE_PORTFOLIO_ACCESS", "judge_access", code, `Judge portfolio accessed via code ${code}`));

      const now = Date.now();
      const cacheKey = getPortfolioCacheKey();
      const cached = portfolioCache.get(cacheKey);
      if (cached && cached.expiresAt > now && cached.version === portfolioCacheVersion) {
        return { status: 200 as const, body: cached.data };
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
 
        sponsors: sponsors.map(s => ({ ...s, id: s.id || "", tier: s.tier as any }))
      };

      portfolioCache.set(cacheKey, { data: payload, expiresAt: now + 300000, version: portfolioCacheVersion });
 
      return { status: 200 as const, body: payload as any };
    } catch (err) {
      console.error("[Judges] Portfolio failed:", err);
      return { status: 500 as const, body: { error: "Portfolio fetch failed" } };
    }
  },
    listCodes: async (_input: ServerInferRequest<typeof judgeContract["listCodes"]>, c: HonoContext) => {
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

 
      return { status: 200 as const, body: { codes: codes as any[] } };
    } catch {
      return { status: 500 as const, body: { error: "Failed to fetch codes" } };
    }
  },
    createCode: async (input: ServerInferRequest<typeof judgeContract["createCode"]>, c: HonoContext) => {
    const db = c.get("db") as Kysely<DB>;
    try {
      const { label, expiresAt } = input.body;
      const code = (crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')).slice(0, 12).toUpperCase();
      const id = crypto.randomUUID();

      await db.insertInto("judge_access_codes")
        .values({
          id,
          code,
          label: label || "Judges",
          expires_at: expiresAt || null
        } )
        .execute();

      // WR-08: Invalidate cache when content changes
      portfolioCacheVersion++;
      portfolioCache.clear();

      c.executionCtx.waitUntil(logAuditAction(c, "CREATE_JUDGE_CODE", "judge_access", id, `Created access code: ${label}`));
      return { status: 200 as const, body: { success: true, code, id } };
    } catch {
      return { status: 500 as const, body: { error: "Create failed" } };
    }
  },
    deleteCode: async (input: ServerInferRequest<typeof judgeContract["deleteCode"]>, c: HonoContext) => {
    const db = c.get("db") as Kysely<DB>;
    try {
      await db.deleteFrom("judge_access_codes").where("id", "=", input.params.id).execute();

      // WR-08: Invalidate cache when content changes
      portfolioCacheVersion++;
      portfolioCache.clear();

      return { status: 200 as const, body: { success: true } };
    } catch {
      return { status: 500 as const, body: { error: "Delete failed" } };
    }
  },
};
const judgesTsRestRouter = s.router(judgeContract, judgesHandlers as any);

judgesRouter.use("/admin/*", ensureAdmin);
createHonoEndpoints(
  judgeContract,
  judgesTsRestRouter,
  judgesRouter,
  {
    responseValidation: true,
    responseValidationErrorHandler: (err, _c) => {
      console.error('[Contract] Response validation failed:', err.cause);
      return { error: { message: 'Internal server error' }, status: 500 };
    }
  }
);


export default judgesRouter;

