import { typedHandler } from "../utils/handler";
import { OpenAPIHono } from "@hono/zod-openapi";

import { eq, asc, desc, and, sql } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { DB } from "../../../shared/schemas/database";
import { AppEnv, ensureAdmin, ensureAuth, getSessionUser, rateLimitMiddleware } from "../middleware";
import { sendZulipMessage } from "../../utils/zulipSync";
import { 

  listBadgesRoute, 
  createBadgeRoute, 
  grantBadgeRoute, 
  revokeBadgeRoute, 
  deleteBadgeRoute, 
  leaderboardBadgeRoute 
} from "../../../shared/routes/badges";


export const badgesRouter = new OpenAPIHono<AppEnv>();

// Middlewares
badgesRouter.use("/", ensureAuth);
// WR-01 FIX: Standardize on /admin/* pattern (remove redundant /admin patterns)
badgesRouter.use("/admin/*", ensureAdmin);
badgesRouter.use("/admin/*", rateLimitMiddleware(15, 60));

badgesRouter.openapi(listBadgesRoute, typedHandler<typeof listBadgesRoute>(async (c) => {
  try {
    const db = c.get("db") as any;
    const results = await db
      .select({
        id: schema.badges.id,
        name: schema.badges.name,
        description: schema.badges.description,
        icon: schema.badges.icon,
        color_theme: schema.badges.colorTheme,
        created_at: schema.badges.createdAt,
      })
      .from(schema.badges)
      .orderBy(asc(schema.badges.createdAt))
      .all();

    const badges = results.map((b: any) => ({
      id: b.id as string,
      name: b.name,
      description: b.description || "",
      icon: b.icon || "Award",
      color_theme: b.color_theme || "ares-gold",
      created_at: String(b.created_at),
    }));

    return c.json({ badges }, 200);
  } catch (e: unknown) {
    const err = e as Error;
    return c.json({ error: err.message || "Failed to fetch badges", code: "INTERNAL_SERVER_ERROR" }, 500);
  }
}));

badgesRouter.openapi(createBadgeRoute, typedHandler<typeof createBadgeRoute>(async (c) => {
  try {
    const { id, name, description, icon, color_theme } = c.req.valid("json");
    const db = c.get("db") as any;
    await db
      .insert(schema.badges)
      .values({
        id,
        name,
        description,
        icon,
        colorTheme: color_theme,
      })
      .run();
    return c.json({ success: true }, 200);
  } catch (e: unknown) {
    const err = e as Error;
    return c.json({ error: err.message || "Failed to create badge", code: "INTERNAL_SERVER_ERROR" }, 500);
  }
}));

badgesRouter.openapi(grantBadgeRoute, typedHandler<typeof grantBadgeRoute>(async (c) => {
  try {
    const { userId, badgeId } = c.req.valid("json");
    const db = c.get("db") as any;
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
              first_name: schema.userProfiles.firstName,
              last_name: schema.userProfiles.lastName,
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
            const userName = userProfile.nickname || userProfile.first_name || "A team member";
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
  } catch (e: unknown) {
    const err = e as Error;
    return c.json({ error: err.message || "Failed to award badge", code: "INTERNAL_SERVER_ERROR" }, 500);
  }
}));

badgesRouter.openapi(revokeBadgeRoute, typedHandler<typeof revokeBadgeRoute>(async (c) => {
  try {
    const { userId, badgeId } = c.req.valid("param");
    const db = c.get("db") as any;
    await db
      .delete(schema.userBadges)
      .where(and(eq(schema.userBadges.userId, userId), eq(schema.userBadges.badgeId, badgeId)))
      .run();
    return c.json({ success: true }, 200);
  } catch (e: unknown) {
    const err = e as Error;
    return c.json({ error: err.message || "Failed to revoke badge", code: "INTERNAL_SERVER_ERROR" }, 500);
  }
}));

badgesRouter.openapi(deleteBadgeRoute, typedHandler<typeof deleteBadgeRoute>(async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = c.get("db") as any;
    await db.delete(schema.badges).where(eq(schema.badges.id, id)).run();
    return c.json({ success: true }, 200);
  } catch (e: unknown) {
    const err = e as Error;
    return c.json({ error: err.message || "Failed to delete badge definition", code: "INTERNAL_SERVER_ERROR" }, 500);
  }
}));

badgesRouter.openapi(leaderboardBadgeRoute, typedHandler<typeof leaderboardBadgeRoute>(async (c) => {
  try {
    const db = c.get("db") as any;
    const results = await db
      .select({
        user_id: schema.userProfiles.userId,
        nickname: schema.userProfiles.nickname,
        member_type: schema.userProfiles.memberType,
        badge_count: sql<number>`count(${schema.userBadges.id})`.as("badge_count")
      })
      .from(schema.userProfiles)
      .innerJoin(schema.userBadges, eq(schema.userProfiles.userId, schema.userBadges.userId))
      .where(eq(schema.userProfiles.showOnAbout, 1))
      .groupBy(schema.userProfiles.userId)
      .orderBy(desc(sql`count(${schema.userBadges.id})`), asc(schema.userProfiles.nickname))
      .limit(20)
      .all();

    const leaderboard = results.map((r: any) => ({
      user_id: r.user_id as string,
      nickname: r.nickname as string | null,
      member_type: r.member_type as string | null,
      badge_count: Number(r.badge_count),
    }));

    return c.json({ leaderboard }, 200);
  } catch (e: unknown) {
    const err = e as Error;
    return c.json({ error: err.message || "Failed to fetch leaderboard", code: "INTERNAL_SERVER_ERROR" }, 500);
  }
}));

export default badgesRouter;
