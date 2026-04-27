import { Hono } from "hono";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { badgeContract } from "../../../shared/schemas/contracts/badgeContract";
import { AppEnv, ensureAdmin, ensureAuth, getSessionUser, rateLimitMiddleware } from "../middleware";
import { sendZulipMessage } from "../../utils/zulipSync";

const s = initServer<AppEnv>();

const badgesTsRestRouterObj: any = {
  list: async (_input: any, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const results = await db
        .selectFrom("badges")
        .select(["id", "name", "description", "icon", "color_theme", "created_at"])
        .orderBy("created_at", "asc")
        .execute();

      const badges = results.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description || "",
        icon: b.icon || "Award",
        color_theme: b.color_theme || "ares-gold",
        created_at: String(b.created_at),
      }));

      return { status: 200 as const, body: { badges } };
    } catch (e: unknown) {
      const err = e as Error;
      return { status: 500 as const, body: { error: err.message || "Failed to fetch badges" } };
    }
  },
  create: async (input: any, c: any) => {
    try {
      const { body } = input;
      const db = c.get("db") as Kysely<DB>;
      await db
        .insertInto("badges")
        .values({
          id: body.id,
          name: body.name,
          description: body.description,
          icon: body.icon,
          color_theme: body.color_theme,
        })
        .execute();
      return { status: 200 as const, body: { success: true } };
    } catch (e: unknown) {
      const err = e as Error;
      return { status: 500 as const, body: { error: err.message || "Failed to create badge" } };
    }
  },
  grant: async (input: any, c: any) => {
    try {
      const { body } = input;
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      const sessionId = user?.id || "system";

      await db
        .insertInto("user_badges")
        .values({
          user_id: body.userId,
          badge_id: body.badgeId,
          awarded_by: sessionId,
        })
        .execute();

      c.executionCtx.waitUntil(
        (async () => {
          try {
            const userProfile = await db
              .selectFrom("user_profiles")
              .select(["first_name", "last_name", "nickname"])
              .where("user_id", "=", body.userId)
              .executeTakeFirst();

            const badge = await db
              .selectFrom("badges")
              .select(["name", "icon"])
              .where("id", "=", body.badgeId)
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

      return { status: 200 as const, body: { success: true } };
    } catch (e: unknown) {
      const err = e as Error;
      return { status: 500 as const, body: { error: err.message || "Failed to award badge" } };
    }
  },
  revoke: async (input: any, c: any) => {
    try {
      const { params } = input;
      const db = c.get("db") as Kysely<DB>;
      await db
        .deleteFrom("user_badges")
        .where("user_id", "=", params.userId)
        .where("badge_id", "=", params.badgeId)
        .execute();
      return { status: 200 as const, body: { success: true } };
    } catch (e: unknown) {
      const err = e as Error;
      return { status: 500 as const, body: { error: err.message || "Failed to revoke badge" } };
    }
  },
  delete: async (input: any, c: any) => {
    try {
      const { params } = input;
      const db = c.get("db") as Kysely<DB>;
      await db.deleteFrom("badges").where("id", "=", params.id).execute();
      return { status: 200 as const, body: { success: true } };
    } catch (e: unknown) {
      const err = e as Error;
      return { status: 500 as const, body: { error: err.message || "Failed to delete badge definition" } };
    }
  },
  leaderboard: async (_input: any, c: any) => {
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

      return { status: 200 as const, body: { leaderboard } };
    } catch (e: unknown) {
      const err = e as Error;
      return { status: 500 as const, body: { error: err.message || "Failed to fetch leaderboard" } };
    }
  },
};

const badgesTsRestRouter = s.router(badgeContract, badgesTsRestRouterObj);
export const badgesRouter = new Hono<AppEnv>();

// Middlewares
badgesRouter.use("/", ensureAuth);
badgesRouter.use("/admin/*", ensureAdmin);
badgesRouter.use("/admin", ensureAdmin);
badgesRouter.use("/admin/*", rateLimitMiddleware(15, 60));
badgesRouter.use("/admin", rateLimitMiddleware(15, 60));

createHonoEndpoints(badgeContract, badgesTsRestRouter, badgesRouter);

export default badgesRouter;
