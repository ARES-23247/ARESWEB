import { typedHandler } from "../utils/handler";
import { eq, asc, desc, sql } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { DB } from "../../../shared/schemas/database";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv, ensureAdmin, logAuditAction, rateLimitMiddleware } from "../middleware";
import { edgeCacheMiddleware } from "../middleware/cache";
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

sponsorsRouter.use("/", edgeCacheMiddleware(180, 60, 300));
// Get all public sponsors
sponsorsRouter.openapi(getSponsorsRoute, typedHandler<typeof getSponsorsRoute>(async (c) => {
  try {
    const db = c.get("db") as any;
    const results = await db
      .select({
        id: schema.sponsors.id,
        name: schema.sponsors.name,
        tier: schema.sponsors.tier,
        logo_url: schema.sponsors.logoUrl,
        website_url: schema.sponsors.websiteUrl,
        is_active: schema.sponsors.isActive,
        created_at: schema.sponsors.createdAt,
      })
      .from(schema.sponsors)
      .where(eq(schema.sponsors.isActive, 1))
      .orderBy(sql<number>`CASE tier WHEN 'Titanium' THEN 1 WHEN 'Gold' THEN 2 WHEN 'Silver' THEN 3 ELSE 4 END`)
      .all();

    const sponsors = (results as SponsorSelectedRow[] & { created_at: string | null }[]).map((s: any) => ({
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
}));

// Get ROI dashboard by token
sponsorsRouter.openapi(getRoiRoute, typedHandler<typeof getRoiRoute>(async (c) => {
  try {
    const { token } = c.req.valid("param");
    const db = c.get("db") as any;
    const tokens = await db
      .select({ sponsorId: schema.sponsorTokens.sponsorId })
      .from(schema.sponsorTokens)
      .where(eq(schema.sponsorTokens.token, token))
      .all();

    if (!tokens || tokens.length === 0) {
      return c.json({ error: "Invalid token" }, 403);
    }
    const sponsor_id = tokens[0].sponsorId;

    const sponsorRow = await db
      .select({
        id: schema.sponsors.id,
        name: schema.sponsors.name,
        tier: schema.sponsors.tier,
        logo_url: schema.sponsors.logoUrl,
        website_url: schema.sponsors.websiteUrl,
        is_active: schema.sponsors.isActive,
        created_at: schema.sponsors.createdAt,
      })
      .from(schema.sponsors)
      .where(eq(schema.sponsors.id, sponsor_id))
      .get();

    if (!sponsorRow) {
      return c.json({ error: "Sponsor not found" }, 403);
    }

    const metricsRow = await db
      .select({
        id: schema.sponsorMetrics.id,
        sponsor_id: schema.sponsorMetrics.sponsorId,
        clicks: schema.sponsorMetrics.clicks,
        impressions: schema.sponsorMetrics.impressions,
        year_month: schema.sponsorMetrics.yearMonth,
      })
      .from(schema.sponsorMetrics)
      .where(eq(schema.sponsorMetrics.sponsorId, sponsor_id))
      .orderBy(asc(schema.sponsorMetrics.createdAt))
      .all();

    const sponsor = {
      id: sponsorRow.id ?? "",
      name: sponsorRow.name,
      tier: (sponsorRow.tier || "In-Kind") as "Titanium" | "Gold" | "Silver" | "Bronze" | "In-Kind",
      logo_url: sponsorRow.logo_url || null,
      website_url: sponsorRow.website_url || null,
      is_active: sponsorRow.is_active ? 1 : 0,
      created_at: sponsorRow.created_at ?? null,
    };

    const metrics = metricsRow.map((m: any) => ({
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
}));

// Admin list all sponsors
sponsorsRouter.openapi(adminListSponsorsRoute, typedHandler<typeof adminListSponsorsRoute>(async (c) => {
  try {
    const db = c.get("db") as any;
    const sponsors = await db.select({
        id: schema.sponsors.id,
        name: schema.sponsors.name,
        tier: schema.sponsors.tier,
        logo_url: schema.sponsors.logoUrl,
        website_url: schema.sponsors.websiteUrl,
        is_active: schema.sponsors.isActive,
        created_at: schema.sponsors.createdAt,
      }).from(schema.sponsors).all();

    return c.json(
      {
        sponsors: sponsors.map((s: any) => ({
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
}));

// Save/create sponsor
sponsorsRouter.openapi(saveSponsorRoute, typedHandler<typeof saveSponsorRoute>(async (c) => {
  try {
    const body = c.req.valid("json");
    const db = c.get("db") as any;
    const id = body.id || crypto.randomUUID();

    if (body.id) {
      await db
        .update(schema.sponsors)
        .set({
          name: body.name,
          tier: body.tier,
          logoUrl: body.logo_url || null,
          websiteUrl: body.website_url || null,
          isActive: body.is_active ? 1 : 0,
        })
        .where(eq(schema.sponsors.id, body.id))
        .run();
      c.executionCtx.waitUntil(logAuditAction(c, "update_sponsor", "sponsors", id));
    } else {
      await db
        .insert(schema.sponsors)
        .values({
          id,
          name: body.name,
          tier: body.tier,
          logoUrl: body.logo_url || null,
          websiteUrl: body.website_url || null,
          isActive: body.is_active ? 1 : 0,
        })
        .run();
      c.executionCtx.waitUntil(
        logAuditAction(c, "create_sponsor", "sponsors", id, `Created sponsor ${body.name}`)
      );
    }

    return c.json({ success: true, id }, 200);
  } catch (e) {
    console.error("[Sponsors:Save] Error", e);
    return c.json({ error: "Failed to save sponsor" }, 500);
  }
}));

// Delete sponsor
sponsorsRouter.openapi(deleteSponsorRoute, typedHandler<typeof deleteSponsorRoute>(async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = c.get("db") as any;

    await db.delete(schema.sponsors).where(eq(schema.sponsors.id, id)).run();
    c.executionCtx.waitUntil(logAuditAction(c, "delete_sponsor", "sponsors", id));
    return c.json({ success: true }, 200);
  } catch (e) {
    console.error("[Sponsors:Delete] Error", e);
    return c.json({ error: "Failed to delete sponsor" }, 500);
  }
}));

// Get admin tokens
sponsorsRouter.openapi(getAdminTokensRoute, typedHandler<typeof getAdminTokensRoute>(async (c) => {
  try {
    const db = c.get("db") as any;
    const results = await db
      .select({
        token: schema.sponsorTokens.token,
        sponsor_id: schema.sponsorTokens.sponsorId,
        created_at: schema.sponsorTokens.createdAt,
        sponsor_name: schema.sponsors.name,
      })
      .from(schema.sponsorTokens)
      .innerJoin(schema.sponsors, eq(schema.sponsorTokens.sponsorId, schema.sponsors.id))
      .orderBy(desc(schema.sponsorTokens.createdAt))
      .all();

    const tokens = results.map((t: any) => ({
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
}));

// Generate token
sponsorsRouter.openapi(generateTokenRoute, typedHandler<typeof generateTokenRoute>(async (c) => {
  try {
    const { sponsor_id } = c.req.valid("json");
    const db = c.get("db") as any;

    const token = crypto.randomUUID();
    await db.insert(schema.sponsorTokens).values({ token, sponsorId: sponsor_id }).run();

    c.executionCtx.waitUntil(logAuditAction(c, "generate_token", "sponsor_tokens", sponsor_id));

    const sRes = await db
      .select({ name: schema.sponsors.name })
      .from(schema.sponsors)
      .where(eq(schema.sponsors.id, sponsor_id))
      .get();
    if (sRes) await sendZulipAlert(c.env, "Sponsor", "ROI Token Generated", `ROI token for **${sRes.name}**.`);

    return c.json({ success: true, token }, 200);
  } catch (error) {
    console.error("[Sponsors:GenerateToken] Error:", error);
    return c.json({ error: "Failed to generate token" }, 500);
  }
}));

export default sponsorsRouter;
