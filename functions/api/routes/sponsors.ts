/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SPONSORS ROUTER - NATIVE HONO TYPE INFERENCE PATTERN
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ApiError } from "../middleware/errorHandler";
import { wrapHandler } from "../utils/handler-native";
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

export const sponsorsRouter = new OpenAPIHono<AppEnv>();

// Apply edge caching to public GET routes (non-admin, non-signups)
sponsorsRouter.use("*", async (c, next) => {
  const path = c.req.path;
  if (c.req.method !== "GET" || path.includes("/admin/") || path.includes("/signups") || path.includes("/history")) {
    return next();
  }
  return edgeCacheMiddleware(180, 60, 300)(c, next);
});

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
        logoUrl: schema.sponsors.logoUrl,
        websiteUrl: schema.sponsors.websiteUrl,
        isActive: schema.sponsors.isActive,
        createdAt: schema.sponsors.createdAt,
      })
      .from(schema.sponsors)
      .where(eq(schema.sponsors.isActive, 1))
      .orderBy(sql<number>`CASE tier WHEN 'Titanium' THEN 1 WHEN 'Gold' THEN 2 WHEN 'Silver' THEN 3 ELSE 4 END`)
      .all();

    const sponsors = results.map((s) => ({
      id: s.id ?? "",
      name: s.name,
      tier: (s.tier || "In-Kind") as string,
      logoUrl: s.logoUrl ?? null,
      websiteUrl: s.websiteUrl ?? null,
      isActive: s.isActive ? 1 : 0,
      createdAt: s.createdAt ?? null,
    }));

    return { status: 200, body: { sponsors } };
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
    const sponsorId = tokens[0].sponsorId;

    const sponsorRow = await db
      .select({
        id: schema.sponsors.id,
        name: schema.sponsors.name,
        tier: schema.sponsors.tier,
        logoUrl: schema.sponsors.logoUrl,
        websiteUrl: schema.sponsors.websiteUrl,
        isActive: schema.sponsors.isActive,
        createdAt: schema.sponsors.createdAt,
      })
      .from(schema.sponsors)
      .where(eq(schema.sponsors.id, sponsorId))
      .get();

    if (!sponsorRow) {
      return { status: 403, body: { error: "Sponsor not found" } };
    }

    const metricsRow = await db
      .select({
        id: schema.sponsorMetrics.id,
        sponsorId: schema.sponsorMetrics.sponsorId,
        clicks: schema.sponsorMetrics.clicks,
        impressions: schema.sponsorMetrics.impressions,
        yearMonth: schema.sponsorMetrics.yearMonth,
      })
      .from(schema.sponsorMetrics)
      .where(eq(schema.sponsorMetrics.sponsorId, sponsorId))
      .orderBy(asc(schema.sponsorMetrics.createdAt))
      .all();

    const sponsor = {
      id: sponsorRow.id ?? "",
      name: sponsorRow.name,
      tier: (sponsorRow.tier || "In-Kind") as string,
      logoUrl: sponsorRow.logoUrl ?? null,
      websiteUrl: sponsorRow.websiteUrl ?? null,
      isActive: sponsorRow.isActive ? 1 : 0,
      createdAt: sponsorRow.createdAt ?? null,
    };

    const metrics = metricsRow.map((m) => ({
      id: m.id ?? "",
      sponsorId: m.sponsorId,
      clicks: m.clicks ?? 0,
      impressions: m.impressions ?? 0,
      yearMonth: m.yearMonth,
    }));

    return { status: 200, body: { sponsor, metrics } };
  },

  adminListSponsors: async (input: HandlerInput, c: Context<AppEnv>) => {
    const db = getDb(c);
    const sponsors = await db.select({
        id: schema.sponsors.id,
        name: schema.sponsors.name,
        tier: schema.sponsors.tier,
        logoUrl: schema.sponsors.logoUrl,
        websiteUrl: schema.sponsors.websiteUrl,
        isActive: schema.sponsors.isActive,
        createdAt: schema.sponsors.createdAt,
      }).from(schema.sponsors).all();

    const mappedSponsors = sponsors.map((s) => ({
      id: s.id ?? "",
      name: s.name,
      tier: (s.tier || "In-Kind") as string,
      logoUrl: s.logoUrl ?? null,
      websiteUrl: s.websiteUrl ?? null,
      isActive: s.isActive ? 1 : 0,
      createdAt: s.createdAt ?? null,
    }));

    return { status: 200, body: { sponsors: mappedSponsors } };
  },

  saveSponsor: async (input: HandlerInput, c: Context<AppEnv>) => {
    const body = input.body as { id?: string; name: string; tier: string; logoUrl?: string; websiteUrl?: string; isActive?: number };
    const db = getDb(c);
    const id = body.id || crypto.randomUUID();

    if (body.id) {
      await db
        .update(schema.sponsors)
        .set({
          name: body.name,
          tier: body.tier,
          logoUrl: body.logoUrl ?? null,
          websiteUrl: body.websiteUrl ?? null,
          isActive: body.isActive ? 1 : 0,
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
          logoUrl: body.logoUrl ?? null,
          websiteUrl: body.websiteUrl ?? null,
          isActive: body.isActive ? 1 : 0,
        })
        .run();
      c.executionCtx.waitUntil(
        logAuditAction(c, "create_sponsor", "sponsors", id, `Created sponsor ${body.name}`)
      );
    }

    return { status: 200, body: { success: true, id } };
  },

  deleteSponsor: async (input: HandlerInput, c: Context<AppEnv>) => {
    const { id } = input.params as { id: string };
    const db = getDb(c);

    await db.delete(schema.sponsors).where(eq(schema.sponsors.id, id)).run();
    c.executionCtx.waitUntil(logAuditAction(c, "delete_sponsor", "sponsors", id));

    return { status: 200, body: { success: true } };
  },

  getAdminTokens: async (input: HandlerInput, c: Context<AppEnv>) => {
    const db = getDb(c);
    const results = await db
      .select({
        token: schema.sponsorTokens.token,
        sponsorId: schema.sponsorTokens.sponsorId,
        createdAt: schema.sponsorTokens.createdAt,
        sponsorName: schema.sponsors.name,
      })
      .from(schema.sponsorTokens)
      .innerJoin(schema.sponsors, eq(schema.sponsorTokens.sponsorId, schema.sponsors.id))
      .orderBy(desc(schema.sponsorTokens.createdAt))
      .all();

    const tokens = results.map((t) => ({
      token: t.token ?? "",
      sponsorId: t.sponsorId,
      sponsorName: t.sponsorName ?? undefined,
      createdAt: t.createdAt ?? "",
      lastUsed: null,
    }));

    return { status: 200, body: { tokens } };
  },

  generateToken: async (input: HandlerInput, c: Context<AppEnv>) => {
    const { sponsorId } = input.body as { sponsorId: string };
    const db = getDb(c);

    const token = crypto.randomUUID();
    await db.insert(schema.sponsorTokens).values({ token, sponsorId }).run();

    c.executionCtx.waitUntil(logAuditAction(c, "generate_token", "sponsor_tokens", sponsorId));

    const sRes = await db
      .select({ name: schema.sponsors.name })
      .from(schema.sponsors)
      .where(eq(schema.sponsors.id, sponsorId))
      .get();
    if (sRes) await sendZulipAlert(c.env, "Sponsor", "ROI Token Generated", `ROI token for **${sRes.name}**.`);

    return { status: 200, body: { success: true, token } };
  },
};

// Routes
sponsorsRouter.openapi(
  getSponsorsRoute,
  wrapHandler(getSponsorsRoute, async (c) => {
    const result = await sponsorHandlers.getSponsors({ query: {}, params: {}, body: {} }, c);
    if (result.status === 200) return c.json(result.body, 200);
    throw new ApiError((result.body as { error?: string })?.error || "Request failed", result.status);
  })
);

sponsorsRouter.openapi(
  getRoiRoute,
  wrapHandler(getRoiRoute, async (c, { params }) => {
    const result = await sponsorHandlers.getRoi({ query: {}, params, body: {} }, c);
    if (result.status === 200) return c.json(result.body, 200);
    throw new ApiError((result.body as { error?: string })?.error || "Request failed", result.status);
  })
);

sponsorsRouter.openapi(
  adminListSponsorsRoute,
  wrapHandler(adminListSponsorsRoute, async (c) => {
    const result = await sponsorHandlers.adminListSponsors({ query: {}, params: {}, body: {} }, c);
    if (result.status === 200) return c.json(result.body, 200);
    throw new ApiError((result.body as { error?: string })?.error || "Request failed", result.status);
  })
);

sponsorsRouter.openapi(
  saveSponsorRoute,
  wrapHandler(saveSponsorRoute, async (c, { body }) => {
    const result = await sponsorHandlers.saveSponsor({ query: {}, params: {}, body }, c);
    if (result.status === 200) return c.json(result.body, 200);
    throw new ApiError((result.body as { error?: string })?.error || "Request failed", result.status);
  })
);

sponsorsRouter.openapi(
  deleteSponsorRoute,
  wrapHandler(deleteSponsorRoute, async (c, { params }) => {
    const result = await sponsorHandlers.deleteSponsor({ query: {}, params, body: {} }, c);
    if (result.status === 200) return c.json(result.body, 200);
    throw new ApiError((result.body as { error?: string })?.error || "Request failed", result.status);
  })
);

sponsorsRouter.openapi(
  getAdminTokensRoute,
  wrapHandler(getAdminTokensRoute, async (c) => {
    const result = await sponsorHandlers.getAdminTokens({ query: {}, params: {}, body: {} }, c);
    if (result.status === 200) return c.json(result.body, 200);
    throw new ApiError((result.body as { error?: string })?.error || "Request failed", result.status);
  })
);

sponsorsRouter.openapi(
  generateTokenRoute,
  wrapHandler(generateTokenRoute, async (c, { body }) => {
    const result = await sponsorHandlers.generateToken({ query: {}, params: {}, body }, c);
    if (result.status === 200) return c.json(result.body, 200);
    throw new ApiError((result.body as { error?: string })?.error || "Request failed", result.status);
  })
);

export default sponsorsRouter;
