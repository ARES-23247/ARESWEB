/**
 * ─────────────────────────────────────────────────────────────────────────────
 * BADGES ROUTER - NATIVE HONO TYPE INFERENCE PATTERN
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createTypedHandler } from "../utils/handler-native";
import { OpenAPIHono } from "@hono/zod-openapi";

import { eq, asc, and } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { AppEnv, ensureAdmin, ensureAuth, getSessionUser, rateLimitMiddleware, getDb } from "../middleware";
import { sendZulipMessage } from "../../utils/zulipSync";
import {
  listBadgesRoute,
  createBadgeRoute,
  grantBadgeRoute,
  revokeBadgeRoute,
  deleteBadgeRoute,
  leaderboardBadgeRoute
} from "../../../shared/routes/badges";
import { queryHelpers } from "@/db/query-helpers";

export const badgesRouter = new OpenAPIHono<AppEnv>();

// Middlewares
badgesRouter.use("/", ensureAuth);
// WR-01 FIX: Standardize on /admin/* pattern (remove redundant /admin patterns)
badgesRouter.use("/admin/*", ensureAdmin);
badgesRouter.use("/admin/*", rateLimitMiddleware(15, 60));

badgesRouter.openapi(
  listBadgesRoute,
  createTypedHandler(listBadgesRoute, async (c) => {
    const db = getDb(c);
    const results = await db
      .select({
        id: schema.badges.id,
        name: schema.badges.name,
        description: schema.badges.description,
        icon: schema.badges.icon,
        colorTheme: schema.badges.colorTheme,
        createdAt: schema.badges.createdAt,
      })
      .from(schema.badges)
      .orderBy(asc(schema.badges.createdAt))
      .all();

    const badges = results.map((b) => ({
      id: b.id as string,
      name: b.name,
      description: b.description || "",
      icon: b.icon || "Award",
      colorTheme: b.colorTheme || "ares-gold",
      createdAt: String(b.createdAt),
    }));

    return c.json({ badges }, 200);
  })
);

badgesRouter.openapi(
  createBadgeRoute,
  createTypedHandler(createBadgeRoute, async (c, { body }) => {
    const { id, name, description, icon, colorTheme } = body;
    const db = getDb(c);
    await db
      .insert(schema.badges)
      .values({
        id,
        name,
        description,
        icon,
        colorTheme: colorTheme,
      })
      .run();
    return c.json({ success: true }, 200);
  })
);

badgesRouter.openapi(
  grantBadgeRoute,
  createTypedHandler(grantBadgeRoute, async (c, { body }) => {
    const { userId, badgeId } = body;
    const db = getDb(c);
    const user = await getSessionUser(c);
    const sessionId = user?.id || "system";

    await db
      .insert(schema.userBadges)
      .values({
        userId: userId,
        badgeId: badgeId,
        awardedBy: sessionId,
      })
      .run();

    c.executionCtx.waitUntil(
      (async () => {
        try {
          const userProfile = await db
            .select({
              firstName: schema.userProfiles.firstName,
              lastName: schema.userProfiles.lastName,
              nickname: schema.userProfiles.nickname
            })
            .from(schema.userProfiles)
            .where(eq(schema.userProfiles.userId, userId))
            .get();

          const badge = await db
            .select({
              name: schema.badges.name,
              icon: schema.badges.icon
            })
            .from(schema.badges)
            .where(eq(schema.badges.id, badgeId))
            .get();

          if (userProfile && badge) {
            const userName = userProfile.nickname || userProfile.firstName || "A team member";
            const iconMap: Record<string, string> = {
              Trophy: "🏆",
              Crown: "👑",
              Star: "⭐",
              Award: "🏅",
              Bolt: "⚡",
              Rocket: "🚀",
              Heart: "❤️",
            };
            const icon = iconMap[badge.icon || ""] || "🏅";

            await sendZulipMessage(
              c.env,
              "general",
              "Achievements",
              `${icon} **${userName}** was just awarded the **${badge.name}** badge!`
            );
          }
        } catch {
          /* ignore */
        }
      })()
    );

    return c.json({ success: true }, 200);
  })
);

badgesRouter.openapi(
  revokeBadgeRoute,
  createTypedHandler(revokeBadgeRoute, async (c, { params }) => {
    const { userId, badgeId } = params;
    const db = getDb(c);
    await db
      .delete(schema.userBadges)
      .where(and(eq(schema.userBadges.userId, userId), eq(schema.userBadges.badgeId, badgeId)))
      .run();
    return c.json({ success: true }, 200);
  })
);

badgesRouter.openapi(
  deleteBadgeRoute,
  createTypedHandler(deleteBadgeRoute, async (c, { params }) => {
    const { id } = params;
    const db = getDb(c);
    await db.delete(schema.badges).where(eq(schema.badges.id, id)).run();
    return c.json({ success: true }, 200);
  })
);

badgesRouter.openapi(
  leaderboardBadgeRoute,
  createTypedHandler(leaderboardBadgeRoute, async (c) => {
    const db = getDb(c);
    const results = await queryHelpers.getBadgeLeaderboard(db, 20);

    const leaderboard = results.map((r) => ({
      userId: r.userId as string,
      nickname: r.nickname as string | null,
      memberType: r.memberType as string | null,
      badgeCount: Number(r.badgeCount),
    }));

    return c.json({ leaderboard }, 200);
  })
);

export default badgesRouter;
