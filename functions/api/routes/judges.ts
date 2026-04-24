import { Hono } from "hono";
import { Kysely } from "kysely";
import { DB } from "../../../src/schemas/database";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { judgeContract } from "../../../src/schemas/contracts/judgeContract";
import { AppEnv, ensureAdmin, verifyTurnstile, logAuditAction } from "../middleware";

const s = initServer<AppEnv>();
export const judgesRouter = new Hono<AppEnv>();

const portfolioCache = new Map<string, { data: any; expiresAt: number }>();
const judgesTsRestRouter: any = s.router(judgeContract as any, {
    login: async ({ body }: { body: any }, c: any) => {
    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    const { checkPersistentRateLimit } = await import("../middleware/security");
    const db = c.get("db") as Kysely<DB>;

    const allowed = await checkPersistentRateLimit(db, `judge-login:${ip}`, 10, 60);
    if (!allowed) return { status: 429 as const, body: { error: "Too many attempts. Please try again later." } };

    try {
      const { code, turnstileToken } = body;
      if (!code) return { status: 400 as const, body: { error: "Code required" } };

      const validToken = await verifyTurnstile(turnstileToken || "", c.env.TURNSTILE_SECRET_KEY, ip);
      if (!validToken) return { status: 403 as const, body: { error: "Security verification failed." } };

      const row = await db.selectFrom("judge_access_codes")
                .select(["code", "label" as any, "expires_at" as any])
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
    portfolio: async ({ headers }: { headers: any }, c: any) => {
    const db = c.get("db") as Kysely<DB>;
    try {
      const code = headers["x-judge-code"];
      if (!code) return { status: 401 as const, body: { error: "Access code required" } };

      const ip = c.req.header("CF-Connecting-IP") || "unknown";
      const { checkPersistentRateLimit } = await import("../middleware/security");
      const allowed = await checkPersistentRateLimit(db, `judge-portfolio:${ip}`, 20, 60);
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

      const now = Date.now();
      const cached = portfolioCache.get("portfolio");
      if (cached && cached.expiresAt > now) return { status: 200 as const, body: cached.data };

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
        portfolioDocs: portfolioDocs.map(d => ({ ...d })),
        outreach: outreach.map(o => ({ ...o, students_count: Number(o.students_count), hours_logged: Number(o.hours_logged), reach_count: Number(o.reach_count) })),
        awards: awards.map(a => ({ ...a, year: Number(a.date) })),
        sponsors: sponsors.map(s => ({ ...s, id: s.id || "", tier: s.tier as any }))
      };

      portfolioCache.set("portfolio", { data: payload, expiresAt: now + 300000 });
      return { status: 200 as const, body: payload as any };
    } catch {
      console.error("[Judges] Portfolio failed:", _err);
      return { status: 500 as const, body: { error: "Portfolio fetch failed" } };
    }
  },
    listCodes: async (_: any, c: any) => {
    const db = c.get("db") as Kysely<DB>;
    try {
      const results = await db.selectFrom("judge_access_codes")
                .select(["id", "code", "label" as any, "created_at", "expires_at" as any])
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
    createCode: async ({ body }: { body: any }, c: any) => {
    const db = c.get("db") as Kysely<DB>;
    try {
      const { label, expiresAt: _expiresAt } = body;
      const code = (crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')).slice(0, 12).toUpperCase();
      const id = crypto.randomUUID();

      await db.insertInto("judge_access_codes")
        .values({
          id,
          code,
          label: label || "Judges",
          expires_at: expiresAt || null
        } as any)
        .execute();

      c.executionCtx.waitUntil(logAuditAction(c, "CREATE_JUDGE_CODE", "judge_access", id, `Created access code: ${label}`));
      return { status: 200 as const, body: { success: true, code, id } };
    } catch {
      return { status: 500 as const, body: { error: "Create failed" } };
    }
  },
    deleteCode: async ({ params }: { params: any }, c: any) => {
    const db = c.get("db") as Kysely<DB>;
    try {
      await db.deleteFrom("judge_access_codes").where("id", "=", params.id).execute();
      return { status: 200 as const, body: { success: true } };
    } catch {
      return { status: 500 as const, body: { error: "Delete failed" } };
    }
  },
} as any);

judgesRouter.use("/admin/*", ensureAdmin);
createHonoEndpoints(judgeContract, judgesTsRestRouter, judgesRouter);

export default judgesRouter;
