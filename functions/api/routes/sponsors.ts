import { Hono } from "hono";
import { sql } from "kysely";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { sponsorContract } from "../../../src/schemas/contracts/sponsorContract";
import { AppEnv, ensureAdmin, logAuditAction } from "../middleware";
import { sendZulipAlert } from "../../utils/zulipSync";

const s = initServer<AppEnv>();
export const sponsorsRouter = new Hono<AppEnv>();

const sponsorHandlers = {
  getSponsors: async (_: any, c: any) => {
            try {
      const db = c.get("db");
      const results = await db.selectFrom("sponsors")
        .select(["id", "name", "tier", "logo_url", "website_url", "is_active"])
        .where("is_active", "=", 1)
        .orderBy(sql<number>`CASE tier WHEN 'Titanium' THEN 1 WHEN 'Gold' THEN 2 WHEN 'Silver' THEN 3 ELSE 4 END`)
        .execute();

            const sponsors = results.map((s: any) => ({
        ...s,
        id: s.id || "",
        is_active: !!s.is_active,
        tier: s.tier as any
      }));

      return { status: 200 as const, body: { sponsors: sponsors as any[] } };
    } catch (_err) {
      return { status: 200 as const, body: { sponsors: [] } };
    }
  },
  getRoi: async ({ params }: { params: any }, c: any) => {
    try {
      const db = c.get("db");
      const { token } = params;
      const tokens = await db.selectFrom("sponsor_tokens")
        .select("sponsor_id")
        .where("token", "=", token)
        .execute();

      if (!tokens || tokens.length === 0) return { status: 403 as const, body: { error: "Invalid token" } };
      const sponsor_id = tokens[0].sponsor_id;

      const sponsorRow = await db.selectFrom("sponsors")
        .select(["id", "name", "tier", "logo_url", "website_url", "is_active"])
        .where("id", "=", sponsor_id)
        .executeTakeFirst();

      if (!sponsorRow) return { status: 403 as const, body: { error: "Sponsor not found" } };

      const metricsRow = await db.selectFrom("sponsor_metrics")
        .select(["id", "sponsor_id", "metric_key", "metric_value", "date"])
        .where("sponsor_id", "=", sponsor_id)
        .orderBy("date", "asc")
        .execute();

      const sponsor = { 
        ...sponsorRow, 
        id: sponsorRow.id || "",
        is_active: !!sponsorRow.is_active,
        tier: sponsorRow.tier as any
      };
            const metrics = metricsRow.map((m: any) => ({
        ...m,
        metric_value: Number(m.metric_value)
      }));

      return { status: 200 as const, body: { sponsor, metrics } as any };
    } catch (_err) {
      return { status: 500 as const, body: { error: "Failed to fetch ROI" } };
    }
  },
  adminList: async (_: any, c: any) => {
    try {
      const db = c.get("db");
      const results = await db.selectFrom("sponsors")
        .select(["id", "name", "tier", "logo_url", "website_url", "is_active"])
        .orderBy("created_at", "desc")
        .execute();
      
            const sponsors = results.map((s: any) => ({
        ...s,
        id: s.id || "",
        is_active: !!s.is_active,
        tier: s.tier as any
      }));

      return { status: 200 as const, body: { sponsors: sponsors as any[] } };
    } catch (_err) {
      return { status: 200 as const, body: { sponsors: [] } };
    }
  },
  saveSponsor: async ({ body }: { body: any }, c: any) => {
    try {
      const db = c.get("db");
      const { id, name, tier, logo_url, website_url, is_active } = body;
      const finalId = id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      await db.insertInto("sponsors")
        .values({ 
          id: finalId, 
          name, 
          tier, 
          logo_url: logo_url || null, 
          website_url: website_url || null, 
          is_active: is_active ? 1 : 0 
        })
                .onConflict((oc: any) => oc.column('id').doUpdateSet({ 
          name, 
          tier, 
          logo_url: logo_url || null, 
          website_url: website_url || null, 
          is_active: is_active ? 1 : 0 
        }))
        .execute();

      c.executionCtx.waitUntil(logAuditAction(c, "SAVE_SPONSOR", "sponsors", finalId, `Saved sponsor: ${name}`));
      return { status: 200 as const, body: { success: true, id: finalId } };
    } catch (_err) {
      return { status: 200 as const, body: { success: false } };
    }
  },
  deleteSponsor: async ({ params }: { params: any }, c: any) => {
    try {
      const db = c.get("db");
      await db.updateTable("sponsors").set({ is_active: 0 }).where("id", "=", params.id).execute();
      c.executionCtx.waitUntil(logAuditAction(c, "DEACTIVATE_SPONSOR", "sponsors", params.id, `Deactivated sponsor ${params.id}`));
      return { status: 200 as const, body: { success: true } };
    } catch (_err) {
      return { status: 200 as const, body: { success: false } };
    }
  },
  getAdminTokens: async (_: any, c: any) => {
    try {
      const db = c.get("db");
      const results = await db.selectFrom("sponsor_tokens as t")
        .innerJoin("sponsors as s", "t.sponsor_id", "s.id")
        .select(["t.id", "t.token", "t.sponsor_id", "t.created_at", "t.last_used"])
        .orderBy("t.created_at", "desc")
        .execute();
      
            const tokens = results.map((t: any) => ({
        ...t,
        last_used: t.last_used || null
      }));

      return { status: 200 as const, body: { tokens: tokens as any[] } };
    } catch (_err) {
      return { status: 500 as const, body: { tokens: [] } };
    }
  },
  generateToken: async ({ body }: { body: any }, c: any) => {
    try {
      const db = c.get("db");
      const { sponsor_id } = body;
      const token = crypto.randomUUID();
      const id = crypto.randomUUID();
      await db.insertInto("sponsor_tokens").values({ id, token, sponsor_id }).execute();

                  c.executionCtx.waitUntil(logAuditAction(c, "GENERATE_TOKEN", "sponsor_tokens", token, `Generated token for ${sponsor_id}`));
      
      c.executionCtx.waitUntil((async () => {
        const sRes = await db.selectFrom("sponsors").select("name").where("id", "=", sponsor_id).executeTakeFirst();
        if (sRes) await sendZulipAlert(c.env, "Sponsor", "ROI Token Generated", `ROI token for **${sRes.name}**.`);
      })());

      return { status: 200 as const, body: { success: true, token } };
    } catch (_err) {
      return { status: 500 as const, body: { error: "Failed to generate" } };
    }
  },
};

const sponsorTsRestRouter: any = s.router(sponsorContract as any, sponsorHandlers as any);


sponsorsRouter.use("/admin", ensureAdmin);


createHonoEndpoints(sponsorContract, sponsorTsRestRouter, sponsorsRouter);
export default sponsorsRouter;
