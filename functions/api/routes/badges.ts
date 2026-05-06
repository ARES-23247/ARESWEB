/* eslint-disable @typescript-eslint/no-explicit-any -- handler input validated by contract library */
import { OpenAPIHono } from "@hono/zod-openapi";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { AppEnv, ensureAdmin, ensureAuth, getSessionUser, rateLimitMiddleware } from "../middleware";
import { sendZulipMessage } from "../../utils/zulipSync";
import type { HonoContext } from "@shared/types/api";
import { 
  listBadgesRoute, 
  createBadgeRoute, 
  grantBadgeRoute, 
  revokeBadgeRoute, 
  deleteBadgeRoute, 
  leaderboardBadgeRoute 
} from "../../../shared/schemas/contracts/badgeContract";

export const badgesRouter = new OpenAPIHono<AppEnv>();

// Middlewares
badgesRouter.use("/", ensureAuth);
// WR-01 FIX: Standardize on /admin/* pattern (remove redundant /admin patterns)
badgesRouter.use("/admin/*", ensureAdmin);
badgesRouter.use("/admin/*", rateLimitMiddleware(15, 60));

badgesRouter.openapi(listBadgesRoute, async (c: HonoContext) => {
  try {
    const db = c.get("db") as Kysely<DB>;
    const results = await db
      .selectFrom("badges")
      .select(["id", "name", "description", "icon", "color_theme", "created_at"])
      .orderBy("created_at", "asc")
      .execute();

    const badges = results.map((b) => ({
      id: b.id as string,
      name: b.name,
      description: b.description || "",
      icon: b.icon || "Award",
      color_theme: b.color_theme || "ares-gold",
      created_at: String(b.created_at),
    }));

    return c.json({ badges }, 200 as any);
  } catch (e: unknown) {
    const err = e as Error;
    return c.json({ error: err.message || "Failed to fetch badges", code: "INTERNAL_SERVER_ERROR" }, 500 as any);
  }
});

badgesRouter.openapi(createBadgeRoute, async (c: HonoContext) => {
  try {
    const { id, name, description, icon, color_theme } = c.req.valid("json" as never) as any;
    const db = c.get("db") as Kysely<DB>;
    await db
      .insertInto("badges")
      .values({
        id,
        name,
        description,
        icon,
        color_theme,
      })
      .execute();
    return c.json({ success: true }, 200 as any);
  } catch (e: unknown) {
    const err = e as Error;
    return c.json({ error: err.message || "Failed to create badge", code: "INTERNAL_SERVER_ERROR" }, 500 as any);
  }
});

badgesRouter.openapi(grantBadgeRoute, async (c: HonoContext) => {
  try {
    const { userId, badgeId } = c.req.valid("json" as never) as any;
    const db = c.get("db") as Kysely<DB>;
    const user = await getSessionUser(c);
    const sessionId = user?.id || "system";

    await db
      .insertInto("user_badges")
      .values({
        user_id: userId,
        badge_id: badgeId,
        awarded_by: sessionId,
      })
      .execute();

    c.executionCtx.waitUntil(
      (async () => {
        try {
          const userProfile = await db
            .selectFrom("user_profiles")
            .select(["first_name", "last_name", "nickname"])
            .where("user_id", "=", userId)
            .executeTakeFirst();

          const badge = await db
            .selectFrom("badges")
            .select(["name", "icon"])
            .where("id", "=", badgeId)
            .executeTakeFirst();

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

    return c.json({ success: true }, 200 as any);
  } catch (e: unknown) {
    const err = e as Error;
    return c.json({ error: err.message || "Failed to award badge", code: "INTERNAL_SERVER_ERROR" }, 500 as any);
  }
});

badgesRouter.openapi(revokeBadgeRoute, async (c: HonoContext) => {
  try {
    const { userId, badgeId } = c.req.valid("param" as never) as any;
    const db = c.get("db") as Kysely<DB>;
    await db
      .deleteFrom("user_badges")
      .where("user_id", "=", userId)
      .where("badge_id", "=", badgeId)
      .execute();
    return c.json({ success: true }, 200 as any);
  } catch (e: unknown) {
    const err = e as Error;
    return c.json({ error: err.message || "Failed to revoke badge", code: "INTERNAL_SERVER_ERROR" }, 500 as any);
  }
});

badgesRouter.openapi(deleteBadgeRoute, async (c: HonoContext) => {
  try {
    const { id } = c.req.valid("param" as never) as any;
    const db = c.get("db") as Kysely<DB>;
    await db.deleteFrom("badges").where("id", "=", id).execute();
    return c.json({ success: true }, 200 as any);
  } catch (e: unknown) {
    const err = e as Error;
    return c.json({ error: err.message || "Failed to delete badge definition", code: "INTERNAL_SERVER_ERROR" }, 500 as any);
  }
});

badgesRouter.openapi(leaderboardBadgeRoute, async (c: HonoContext) => {
  try {
    const db = c.get("db") as Kysely<DB>;
    const results = await db
      .selectFrom("user_profiles as u")
      .innerJoin("user_badges as ub", "u.user_id", "ub.user_id")
      .select(["u.user_id", "u.nickname", "u.member_type", (eb) => eb.fn.count("ub.id").as("badge_count")])
      .where("u.show_on_about", "=", 1)
      .groupBy("u.user_id")
      .orderBy("badge_count", "desc")
      .orderBy("u.nickname", "asc")
      .limit(20)
      .execute();

    const leaderboard = results.map((r) => ({
      user_id: r.user_id as string,
      nickname: r.nickname as string | null,
      member_type: r.member_type as string | null,
      badge_count: Number(r.badge_count),
    }));

    return c.json({ leaderboard }, 200 as any);
  } catch (e: unknown) {
    const err = e as Error;
    return c.json({ error: err.message || "Failed to fetch leaderboard", code: "INTERNAL_SERVER_ERROR" }, 500 as any);
  }
});

export default badgesRouter;
