import { z } from "zod";
import { ApiError } from "../middleware/errorHandler";
import { wrapLegacyHandler } from "../utils/handler-v2";
import { eq, asc, desc, sql } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";

import { AppEnv, ensureAdmin, logAuditAction, rateLimitMiddleware, getDb } from "../middleware";
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
import {
  sponsorResponseSchema,
  sponsorRoiMetricSchema,
  sponsorTokenSchema,
} from "../../../shared/routes/sponsors";

export const sponsorsRouter = new OpenAPIHono<AppEnv>();

// Apply edge caching to public GET routes (non-admin, non-signups)
sponsorsRouter.use("*", async (c, next) => {
  const path = c.req.path;
  if (c.req.method !== "GET" || path.includes("/admin/") || path.includes("/signups") || path.includes("/history")) {
    return next();
  }
  return edgeCacheMiddleware(180, 60, 300)(c, next);
});

// Response type inference helpers
type GetSponsorsResponse = z.infer<typeof getSponsorsRoute.responses[200]["content"]["application/json"]["schema"]>;

// Infer individual types from schemas
type SponsorResponse = z.infer<typeof sponsorResponseSchema>;
type SponsorRoiMetric = z.infer<typeof sponsorRoiMetricSchema>;
type SponsorToken = z.infer<typeof sponsorTokenSchema>;

// WR-12: Add rate limiting to public sponsor endpoint to prevent scraping
sponsorsRouter.use("*", rateLimitMiddleware(15, 60));

// WR-01 FIX: Standardize on /admin/* pattern (remove redundant /admin patterns)
sponsorsRouter.use("/admin/*", ensureAdmin);

// Handler functions
type HandlerInput = { query?: Record<string, unknown>; params?: Record<string, unknown>; body?: Record<string, unknown> };

const sponsorHandlers = {
  getSponsors: async (input: HandlerInput, c: Context<AppEnv>) => {
    const db = getDb(c);
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

    const sponsors: SponsorResponse[] = results.map((s): SponsorResponse => ({
      id: s.id ?? "",
      name: s.name,
      tier: (s.tier || "In-Kind") as SponsorResponse["tier"],
      logo_url: s.logo_url ?? null,
      website_url: s.website_url ?? null,
      is_active: s.is_active ? 1 : 0,
      created_at: s.created_at ?? null,
    }));

    return { status: 200, body: { sponsors } as GetSponsorsResponse };
  },

  getRoi: async (input: HandlerInput, c: Context<AppEnv>) => {
    const { token } = input.params as { token: string };
    const db = getDb(c);
    const tokens = await db
      .select({ sponsorId: schema.sponsorTokens.sponsorId })
      .from(schema.sponsorTokens)
      .where(eq(schema.sponsorTokens.token, token))
      .all();

    if (!tokens || tokens.length === 0) {
      return { status: 403, body: { error: "Invalid token" } };
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
      return { status: 403, body: { error: "Sponsor not found" } };
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

    const sponsor: SponsorResponse = {
      id: sponsorRow.id ?? "",
      name: sponsorRow.name,
      tier: (sponsorRow.tier || "In-Kind") as SponsorResponse["tier"],
      logo_url: sponsorRow.logo_url ?? null,
      website_url: sponsorRow.website_url ?? null,
      is_active: sponsorRow.is_active ? 1 : 0,
      created_at: sponsorRow.created_at ?? null,
    };

    const metrics: SponsorRoiMetric[] = metricsRow.map((m): SponsorRoiMetric => ({
      id: m.id ?? "",
      sponsor_id: m.sponsor_id,
      clicks: m.clicks ?? 0,
      impressions: m.impressions ?? 0,
      year_month: m.year_month,
    }));

    const response = { sponsor, metrics } satisfies z.infer<typeof getRoiRoute.responses[200]["content"]["application/json"]["schema"]>;
    return { status: 200, body: response };
  },

  adminListSponsors: async (input: HandlerInput, c: Context<AppEnv>) => {
    const db = getDb(c);
    const sponsors = await db.select({
        id: schema.sponsors.id,
        name: schema.sponsors.name,
        tier: schema.sponsors.tier,
        logo_url: schema.sponsors.logoUrl,
        website_url: schema.sponsors.websiteUrl,
        is_active: schema.sponsors.isActive,
        created_at: schema.sponsors.createdAt,
      }).from(schema.sponsors).all();

    const mappedSponsors: SponsorResponse[] = sponsors.map((s): SponsorResponse => ({
      id: s.id ?? "",
      name: s.name,
      tier: (s.tier || "In-Kind") as SponsorResponse["tier"],
      logo_url: s.logo_url ?? null,
      website_url: s.website_url ?? null,
      is_active: s.is_active ? 1 : 0,
      created_at: s.created_at ?? null,
    }));

    const response = { sponsors: mappedSponsors } satisfies z.infer<typeof adminListSponsorsRoute.responses[200]["content"]["application/json"]["schema"]>;
    return { status: 200, body: response };
  },

  saveSponsor: async (input: HandlerInput, c: Context<AppEnv>) => {
    const body = input.body as { id?: string; name: string; tier: string; logo_url?: string; website_url?: string; is_active?: number };
    const db = getDb(c);
    const id = body.id || crypto.randomUUID();

    if (body.id) {
      await db
        .update(schema.sponsors)
        .set({
          name: body.name,
          tier: body.tier,
          logoUrl: body.logo_url ?? null,
          websiteUrl: body.website_url ?? null,
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
          logoUrl: body.logo_url ?? null,
          websiteUrl: body.website_url ?? null,
          isActive: body.is_active ? 1 : 0,
        })
        .run();
      c.executionCtx.waitUntil(
        logAuditAction(c, "create_sponsor", "sponsors", id, `Created sponsor ${body.name}`)
      );
    }

    const response = { success: true, id } satisfies z.infer<typeof saveSponsorRoute.responses[200]["content"]["application/json"]["schema"]>;
    return { status: 200, body: response };
  },

  deleteSponsor: async (input: HandlerInput, c: Context<AppEnv>) => {
    const { id } = input.params as { id: string };
    const db = getDb(c);

    await db.delete(schema.sponsors).where(eq(schema.sponsors.id, id)).run();
    c.executionCtx.waitUntil(logAuditAction(c, "delete_sponsor", "sponsors", id));

    const response = { success: true } satisfies z.infer<typeof deleteSponsorRoute.responses[200]["content"]["application/json"]["schema"]>;
    return { status: 200, body: response };
  },

  getAdminTokens: async (input: HandlerInput, c: Context<AppEnv>) => {
    const db = getDb(c);
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

    const tokens: SponsorToken[] = results.map((t): SponsorToken => ({
      token: t.token ?? "",
      sponsor_id: t.sponsor_id,
      sponsor_name: t.sponsor_name ?? undefined,
      created_at: t.created_at ?? "",
      last_used: null,
    }));

    const response = { tokens } satisfies z.infer<typeof getAdminTokensRoute.responses[200]["content"]["application/json"]["schema"]>;
    return { status: 200, body: response };
  },

  generateToken: async (input: HandlerInput, c: Context<AppEnv>) => {
    const { sponsor_id } = input.body as { sponsor_id: string };
    const db = getDb(c);

    const token = crypto.randomUUID();
    await db.insert(schema.sponsorTokens).values({ token, sponsorId: sponsor_id }).run();

    c.executionCtx.waitUntil(logAuditAction(c, "generate_token", "sponsor_tokens", sponsor_id));

    const sRes = await db
      .select({ name: schema.sponsors.name })
      .from(schema.sponsors)
      .where(eq(schema.sponsors.id, sponsor_id))
      .get();
    if (sRes) await sendZulipAlert(c.env, "Sponsor", "ROI Token Generated", `ROI token for **${sRes.name}**.`);

    const response = { success: true, token } satisfies z.infer<typeof generateTokenRoute.responses[200]["content"]["application/json"]["schema"]>;
    return { status: 200, body: response };
  },
};

// Routes
sponsorsRouter.openapi(getSponsorsRoute, wrapLegacyHandler(sponsorHandlers.getSponsors, getSponsorsRoute.responses[200].content["application/json"].schema));

sponsorsRouter.openapi(getRoiRoute, wrapLegacyHandler(sponsorHandlers.getRoi, getRoiRoute.responses[200].content["application/json"].schema));

sponsorsRouter.openapi(adminListSponsorsRoute, wrapLegacyHandler(sponsorHandlers.adminListSponsors, adminListSponsorsRoute.responses[200].content["application/json"].schema));

sponsorsRouter.openapi(saveSponsorRoute, wrapLegacyHandler(sponsorHandlers.saveSponsor, saveSponsorRoute.responses[200].content["application/json"].schema));

sponsorsRouter.openapi(deleteSponsorRoute, wrapLegacyHandler(sponsorHandlers.deleteSponsor, deleteSponsorRoute.responses[200].content["application/json"].schema));

sponsorsRouter.openapi(getAdminTokensRoute, wrapLegacyHandler(sponsorHandlers.getAdminTokens, getAdminTokensRoute.responses[200].content["application/json"].schema));

sponsorsRouter.openapi(generateTokenRoute, wrapLegacyHandler(sponsorHandlers.generateToken, generateTokenRoute.responses[200].content["application/json"].schema));

export default sponsorsRouter;
