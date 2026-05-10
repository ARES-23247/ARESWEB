/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SPONSORS ROUTER - NATIVE HONO TYPE INFERENCE PATTERN
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ApiError } from "../middleware/errorHandler";
import { eq, asc, desc, sql } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";

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

// Routes
sponsorsRouter.openapi(getSponsorsRoute, async (c) => {
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

    return c.json({ sponsors }, 200);
  }
);

sponsorsRouter.openapi(getRoiRoute, async (c) => {
    const params = c.req.valid("param");
    const db = getDb(c);
    const tokens = await db
      .select({ sponsorId: schema.sponsorTokens.sponsorId })
      .from(schema.sponsorTokens)
      .where(eq(schema.sponsorTokens.token, params.token))
      .all();

    if (!tokens || tokens.length === 0) {
      throw new ApiError("Invalid token", 403);
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
      throw new ApiError("Sponsor not found", 403);
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

    return c.json({ sponsor, metrics }, 200);
  }
);

sponsorsRouter.openapi(adminListSponsorsRoute, async (c) => {
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

    return c.json({ sponsors: mappedSponsors }, 200);
  }
);

sponsorsRouter.openapi(saveSponsorRoute, async (c) => {
    const body = c.req.valid("json");
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

    return c.json({ success: true, id }, 200);
  }
);

sponsorsRouter.openapi(deleteSponsorRoute, async (c) => {
    const params = c.req.valid("param");
    const db = getDb(c);

    await db.delete(schema.sponsors).where(eq(schema.sponsors.id, params.id)).run();
    c.executionCtx.waitUntil(logAuditAction(c, "delete_sponsor", "sponsors", params.id));

    return c.json({ success: true }, 200);
  }
);

sponsorsRouter.openapi(getAdminTokensRoute, async (c) => {
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

    return c.json({ tokens }, 200);
  }
);

sponsorsRouter.openapi(generateTokenRoute, async (c) => {
    const body = c.req.valid("json");
    const db = getDb(c);

    const token = crypto.randomUUID();
    await db.insert(schema.sponsorTokens).values({ token, sponsorId: body.sponsorId }).run();

    c.executionCtx.waitUntil(logAuditAction(c, "generate_token", "sponsor_tokens", body.sponsorId));

    const sRes = await db
      .select({ name: schema.sponsors.name })
      .from(schema.sponsors)
      .where(eq(schema.sponsors.id, body.sponsorId))
      .get();
    if (sRes) await sendZulipAlert(c.env, "Sponsor", "ROI Token Generated", `ROI token for **${sRes.name}**.`);

    return c.json({ success: true, token }, 200);
  }
);

export default sponsorsRouter;
