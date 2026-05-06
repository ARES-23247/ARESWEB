import { Kysely, sql } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import { AppEnv, ensureAdmin, logAuditAction, rateLimitMiddleware } from "../middleware";
import { sendZulipAlert } from "../../utils/zulipSync";
import {
  getSponsorsRoute,
  getRoiRoute,
  adminListSponsorsRoute,
  saveSponsorRoute,
  deleteSponsorRoute,
  getAdminTokensRoute,
  generateTokenRoute,
} from "../../../shared/routes/sponsors";

type AppRouteHandler<T extends RouteConfig> = RouteHandler<T, AppEnv>;

export const sponsorsRouter = new OpenAPIHono<AppEnv>();

type SponsorSelectedRow = {
  id: string | null;
  name: string;
  tier: string;
  logo_url: string | null;
  website_url: string | null;
  is_active: number | null;
  created_at: string | null;
};

// WR-12: Add rate limiting to public sponsor endpoint to prevent scraping
sponsorsRouter.use("*", rateLimitMiddleware(15, 60));

// WR-01 FIX: Standardize on /admin/* pattern (remove redundant /admin patterns)
sponsorsRouter.use("/admin/*", ensureAdmin);

// Get all public sponsors
sponsorsRouter.openapi(getSponsorsRoute, (async (c) => {
  try {
    const db = c.get("db") as Kysely<DB>;
    const results = await db
      .selectFrom("sponsors")
      .select(["id", "name", "tier", "logo_url", "website_url", "is_active", "created_at"])
      .where("is_active", "=", 1)
      .orderBy(sql<number>`CASE tier WHEN 'Titanium' THEN 1 WHEN 'Gold' THEN 2 WHEN 'Silver' THEN 3 ELSE 4 END`)
      .execute();

    const sponsors = (results as SponsorSelectedRow[] & { created_at: string | null }[]).map((s) => ({
      id: s.id ?? "",
      name: s.name,
      tier: (s.tier || "In-Kind") as "Titanium" | "Gold" | "Silver" | "Bronze" | "In-Kind",
      logo_url: s.logo_url || null,
      website_url: s.website_url || null,
      is_active: s.is_active ? 1 : 0,
      created_at: s.created_at ?? null,
    }));

    return c.json({ sponsors }, 200);
  } catch (e) {
    console.error("[Sponsors:List] Error", e);
    return c.json({ error: "Failed to fetch sponsors" }, 500);
  }
}) as AppRouteHandler<typeof getSponsorsRoute>);

// Get ROI dashboard by token
sponsorsRouter.openapi(getRoiRoute, (async (c) => {
  try {
    const { token } = c.req.valid("param");
    const db = c.get("db") as Kysely<DB>;
    const tokens = await db
      .selectFrom("sponsor_tokens")
      .select("sponsor_id")
      .where("token", "=", token)
      .execute();

    if (!tokens || tokens.length === 0) {
      return c.json({ error: "Invalid token" }, 403);
    }
    const sponsor_id = tokens[0].sponsor_id;

    const sponsorRow = await db
      .selectFrom("sponsors")
      .select(["id", "name", "tier", "logo_url", "website_url", "is_active", "created_at"])
      .where("id", "=", sponsor_id)
      .executeTakeFirst();

    if (!sponsorRow) {
      return c.json({ error: "Sponsor not found" }, 403);
    }

    const metricsRow = await db
      .selectFrom("sponsor_metrics")
      .select(["id", "sponsor_id", "clicks", "impressions", "year_month"])
      .where("sponsor_id", "=", sponsor_id)
      .orderBy("created_at", "asc")
      .execute();

    const sponsor = {
      id: sponsorRow.id ?? "",
      name: sponsorRow.name,
      tier: (sponsorRow.tier || "In-Kind") as "Titanium" | "Gold" | "Silver" | "Bronze" | "In-Kind",
      logo_url: sponsorRow.logo_url || null,
      website_url: sponsorRow.website_url || null,
      is_active: sponsorRow.is_active ? 1 : 0,
      created_at: sponsorRow.created_at ?? null,
    };

    const metrics = metricsRow.map((m) => ({
      id: m.id ?? "",
      sponsor_id: m.sponsor_id,
      clicks: m.clicks ?? 0,
      impressions: m.impressions ?? 0,
      year_month: m.year_month,
    }));

    return c.json({ sponsor, metrics }, 200);
  } catch (e) {
    console.error("[Sponsors:Roi] Error", e);
    return c.json({ error: "Failed to fetch ROI" }, 500);
  }
}) as AppRouteHandler<typeof getRoiRoute>);

// Admin list all sponsors
sponsorsRouter.openapi(adminListSponsorsRoute, (async (c) => {
  try {
    const db = c.get("db") as Kysely<DB>;
    const sponsors = await db.selectFrom("sponsors").selectAll().execute();

    return c.json(
      {
        sponsors: sponsors.map((s) => ({
          id: s.id ?? "",
          name: s.name,
          tier: (s.tier || "In-Kind") as "Titanium" | "Gold" | "Silver" | "Bronze" | "In-Kind",
          logo_url: s.logo_url || null,
          website_url: s.website_url || null,
          is_active: s.is_active ? 1 : 0,
          created_at: s.created_at ?? null,
        })),
      },
      200
    );
  } catch (e) {
    console.error("[Sponsors:AdminList] Error", e);
    return c.json({ error: "Admin access required" }, 500);
  }
}) as AppRouteHandler<typeof adminListSponsorsRoute>);

// Save/create sponsor
sponsorsRouter.openapi(saveSponsorRoute, (async (c) => {
  try {
    const body = c.req.valid("json");
    const db = c.get("db") as Kysely<DB>;
    const id = body.id || crypto.randomUUID();

    if (body.id) {
      await db
        .updateTable("sponsors")
        .set({
          name: body.name,
          tier: body.tier,
          logo_url: body.logo_url || null,
          website_url: body.website_url || null,
          is_active: body.is_active ? 1 : 0,
        })
        .where("id", "=", body.id)
        .execute();
      c.executionCtx.waitUntil(logAuditAction(c, "update_sponsor", "sponsors", id));
    } else {
      await db
        .insertInto("sponsors")
        .values({
          id,
          name: body.name,
          tier: body.tier,
          logo_url: body.logo_url || null,
          website_url: body.website_url || null,
          is_active: body.is_active ? 1 : 0,
        })
        .execute();
      c.executionCtx.waitUntil(
        logAuditAction(c, "create_sponsor", "sponsors", id, `Created sponsor ${body.name}`)
      );
    }

    return c.json({ success: true, id }, 200);
  } catch (e) {
    console.error("[Sponsors:Save] Error", e);
    return c.json({ error: "Failed to save sponsor" }, 500);
  }
}) as AppRouteHandler<typeof saveSponsorRoute>);

// Delete sponsor
sponsorsRouter.openapi(deleteSponsorRoute, (async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = c.get("db") as Kysely<DB>;

    await db.deleteFrom("sponsors").where("id", "=", id).execute();
    c.executionCtx.waitUntil(logAuditAction(c, "delete_sponsor", "sponsors", id));
    return c.json({ success: true }, 200);
  } catch (e) {
    console.error("[Sponsors:Delete] Error", e);
    return c.json({ error: "Failed to delete sponsor" }, 500);
  }
}) as AppRouteHandler<typeof deleteSponsorRoute>);

// Get admin tokens
sponsorsRouter.openapi(getAdminTokensRoute, (async (c) => {
  try {
    const db = c.get("db") as Kysely<DB>;
    const results = await db
      .selectFrom("sponsor_tokens as t")
      .innerJoin("sponsors as s", "t.sponsor_id", "s.id")
      .select(["t.token", "t.sponsor_id", "t.created_at", "s.name as sponsor_name"])
      .orderBy("t.created_at", "desc")
      .execute();

    const tokens = results.map((t) => ({
      token: t.token ?? "",
      sponsor_id: t.sponsor_id,
      sponsor_name: t.sponsor_name,
      created_at: t.created_at ?? "",
      last_used: null,
    }));

    return c.json({ tokens }, 200);
  } catch (e) {
    console.error("[Sponsors:Tokens] Error", e);
    return c.json({ error: "Failed to fetch tokens" }, 500);
  }
}) as AppRouteHandler<typeof getAdminTokensRoute>);

// Generate token
sponsorsRouter.openapi(generateTokenRoute, (async (c) => {
  try {
    const { sponsor_id } = c.req.valid("json");
    const db = c.get("db") as Kysely<DB>;

    const token = crypto.randomUUID();
    await db.insertInto("sponsor_tokens").values({ token, sponsor_id }).execute();

    c.executionCtx.waitUntil(logAuditAction(c, "generate_token", "sponsor_tokens", sponsor_id));

    const sRes = await db
      .selectFrom("sponsors")
      .select("name")
      .where("id", "=", sponsor_id)
      .executeTakeFirst();
    if (sRes) await sendZulipAlert(c.env, "Sponsor", "ROI Token Generated", `ROI token for **${sRes.name}**.`);

    return c.json({ success: true, token }, 200);
  } catch (error) {
    console.error("[Sponsors:GenerateToken] Error:", error);
    return c.json({ error: "Failed to generate token" }, 500);
  }
}) as AppRouteHandler<typeof generateTokenRoute>);

export default sponsorsRouter;
