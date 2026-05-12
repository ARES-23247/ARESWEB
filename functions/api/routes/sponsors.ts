/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SPONSORS ROUTER - NATIVE HONO TYPE INFERENCE PATTERN
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ApiError } from "../middleware/errorHandler";
import { eq, asc, desc, sql } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv, ensureAdmin, logAuditAction, rateLimitMiddleware, getDb, typedJson } from "../middleware";
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

const _sponsorsRouter = new OpenAPIHono<AppEnv>();

// Drizzle sponsor row type
type SponsorRow = typeof schema.sponsors.$inferSelect;

/** Normalize a Drizzle sponsor row into the API response shape. */
function formatSponsor(s: SponsorRow) {
  return {
    id: s.id ?? "",
    name: s.name,
    tier: (s.tier || "In-Kind") as string,
    logoUrl: s.logoUrl ?? null,
    websiteUrl: s.websiteUrl ?? null,
    isActive: s.isActive ? 1 : 0,
    createdAt: s.createdAt ?? null,
  };
}

// Apply edge caching to public GET routes (non-admin, non-signups)
_sponsorsRouter.use("*", async (c, next) => {
  const path = c.req.path;
  if (c.req.method !== "GET" || path.includes("/admin/") || path.includes("/signups") || path.includes("/history")) {
    return next();
  }
  return edgeCacheMiddleware(180, 60, 300)(c, next);
});

// WR-12: Add rate limiting to public sponsor endpoint to prevent scraping
_sponsorsRouter.use("*", rateLimitMiddleware(15, 60));

// WR-01 FIX: Standardize on /admin/* pattern (remove redundant /admin patterns)
_sponsorsRouter.use("/admin/*", ensureAdmin);

// Routes
export const sponsorsRouter = _sponsorsRouter
    .openapi(getSponsorsRoute, async (c) => {
        const db = getDb(c);
        const results = await db
          .select()
          .from(schema.sponsors)
          .where(eq(schema.sponsors.isActive, 1))
          .orderBy(sql<number>`CASE tier WHEN 'Titanium' THEN 1 WHEN 'Gold' THEN 2 WHEN 'Silver' THEN 3 ELSE 4 END`)
          .all();

        const sponsors = results.map(formatSponsor);

        // Response boundary: Drizzle return type diverges from Zod schema
        return typedJson(c, { sponsors }, 200);
      }
    )
    .openapi(getRoiRoute, async (c) => {
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
          .select()
          .from(schema.sponsors)
          .where(eq(schema.sponsors.id, sponsorId))
          .get();

        if (!sponsorRow) {
          throw new ApiError("Sponsor not found", 403);
        }

        const metricsRow = await db
          .select()
          .from(schema.sponsorMetrics)
          .where(eq(schema.sponsorMetrics.sponsorId, sponsorId))
          .orderBy(asc(schema.sponsorMetrics.createdAt))
          .all();

        const sponsor = formatSponsor(sponsorRow);

        const metrics = metricsRow.map((m) => ({
          id: m.id ?? null,
          sponsorId: m.sponsorId,
          clicks: m.clicks ?? null,
          impressions: m.impressions ?? null,
          yearMonth: m.yearMonth,
        }));

        // Response boundary: Drizzle return type diverges from Zod schema
        return typedJson(c, { sponsor, metrics }, 200);
      }
    )
    .openapi(adminListSponsorsRoute, async (c) => {
        const db = getDb(c);
        const sponsors = await db.select().from(schema.sponsors).all();

        const mappedSponsors = sponsors.map(formatSponsor);

        // Response boundary: Drizzle return type diverges from Zod schema
        return typedJson(c, { sponsors: mappedSponsors }, 200);
      }
    )
    .openapi(saveSponsorRoute, async (c) => {
        // Request boundary: Explicit type cast to avoid complex Zod inference falling back to {}
        const body = c.req.valid("json") as unknown as {
          id?: string;
          name: string;
          tier: string;
          logoUrl?: string | null;
          websiteUrl?: string | null;
          isActive?: boolean | number;
        };
        const db = getDb(c);
        const id = (body.id as string | undefined) || crypto.randomUUID();

        if (body.id) {
          try {
            await db
              .update(schema.sponsors)
              .set({
                name: body.name as string,
                tier: body.tier as string,
                logoUrl: (body.logoUrl as string | null | undefined) ?? null,
                websiteUrl: (body.websiteUrl as string | null | undefined) ?? null,
                isActive: body.isActive ? 1 : 0,
              })
              .where(eq(schema.sponsors.id, body.id as string))
              .run();
          } catch (err) {
            console.error("FAILED_SPONSOR_UPDATE:", err);
            throw new ApiError("Failed to synchronize sponsor record.", 500, "SPONSOR_UPDATE_FAILED");
          }
          c.executionCtx.waitUntil(logAuditAction(c, "update_sponsor", "sponsors", id));
        } else {
          try {
            await db
              .insert(schema.sponsors)
              .values({
                id,
                name: body.name as string,
                tier: body.tier as string,
                logoUrl: (body.logoUrl as string | null | undefined) ?? null,
                websiteUrl: (body.websiteUrl as string | null | undefined) ?? null,
                isActive: body.isActive ? 1 : 0,
              })
              .run();
          } catch (err) {
            console.error("FAILED_SPONSOR_CREATE:", err);
            throw new ApiError("Failed to register new sponsor.", 500, "SPONSOR_CREATE_FAILED");
          }
          c.executionCtx.waitUntil(
            logAuditAction(c, "create_sponsor", "sponsors", id, `Created sponsor ${body.name as string}`)
          );
        }

        return c.json({ success: true, id }, 200);
      }
    )
    .openapi(deleteSponsorRoute, async (c) => {
        const params = c.req.valid("param");
        const db = getDb(c);

        try {
          await db.delete(schema.sponsors).where(eq(schema.sponsors.id, params.id)).run();
        } catch (err) {
          console.error("FAILED_SPONSOR_DELETE:", err);
          throw new ApiError("Failed to permanently remove sponsor.", 500, "SPONSOR_DELETE_FAILED");
        }
        c.executionCtx.waitUntil(logAuditAction(c, "delete_sponsor", "sponsors", params.id));

        return c.json({ success: true }, 200);
      }
    )
    .openapi(getAdminTokensRoute, async (c) => {
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
          createdAt: t.createdAt ?? null,
          lastUsed: null,
        }));

        // Response boundary: Drizzle return type diverges from Zod schema
        return typedJson(c, { tokens }, 200);
      }
    )
    .openapi(generateTokenRoute, async (c) => {
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
