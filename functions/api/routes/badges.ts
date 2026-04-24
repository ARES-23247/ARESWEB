import { Hono } from "hono";
import { Kysely } from "kysely";
import { DB } from "../../../src/schemas/database";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { badgeContract } from "../../../src/schemas/contracts/badgeContract";
import { AppEnv, ensureAdmin, getSessionUser, rateLimitMiddleware } from "../middleware";
import { sendZulipMessage } from "../../utils/zulipSync";

const s = initServer<AppEnv>();
const badgesRouter = new Hono<AppEnv>();

const badgesTsRestRouter = s.router(badgeContract, {
  list: async (_, c) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const results = await db.selectFrom("badges")
        .selectAll()
        .orderBy("created_at", "asc")
        .execute();
      
      const badges = results.map(b => ({
        id: b.id,
        name: b.name,
        description: b.description || "",
        icon: b.icon || "Award",
        color_theme: b.color_theme || "ares-gold",
        created_at: String(b.created_at)
      }));

      return { status: 200, body: { badges } };
    } catch (_err) {
      return { status: 500, body: { error: "Failed to fetch badges" } };
    }
  },
  create: async ({ body }, c) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      await db.insertInto("badges")
        .values({
          id: body.id,
          name: body.name,
          description: body.description,
          icon: body.icon,
          color_theme: body.color_theme,
        })
        .execute();
      return { status: 200, body: { success: true } };
    } catch (_err) {
      return { status: 500, body: { error: "Failed to create badge" } };
    }
  },
  grant: async ({ body }, c) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      const sessionId = user?.id || "system";

      await db.insertInto("user_badges")
        .values({
          user_id: body.userId,
          badge_id: body.badgeId,
          awarded_by: sessionId,
        })
        .execute();

      c.executionCtx.waitUntil((async () => {
        try {
          const userProfile = await db.selectFrom("user_profiles")
            .select(["first_name", "last_name", "nickname"])
            .where("user_id", "=", body.userId)
            .executeTakeFirst();
          
          const badge = await db.selectFrom("badges")
            .select(["name", "icon"])
            .where("id", "=", body.badgeId)
            .executeTakeFirst();
          
          if (userProfile && badge) {
            const userName = userProfile.nickname || userProfile.first_name || "A team member";
            const icon = badge.icon === "Trophy" ? "🏆" : badge.icon === "Crown" ? "👑" : badge.icon === "Star" ? "⭐" : "🏅";
            
            await sendZulipMessage(
              c.env,
              "general",
              "Achievements",
              `${icon} **${userName}** was just awarded the **${badge.name}** badge!`
            );
          }
        } catch { /* ignore */ }
      })());

      return { status: 200, body: { success: true } };
    } catch (_err) {
      return { status: 500, body: { error: "Failed to award badge" } };
    }
  },
  revoke: async ({ params }, c) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      await db.deleteFrom("user_badges")
        .where("user_id", "=", params.userId)
        .where("badge_id", "=", params.badgeId)
        .execute();
      return { status: 200, body: { success: true } };
    } catch (_err) {
      return { status: 500, body: { error: "Failed to revoke badge" } };
    }
  },
  delete: async ({ params }, c) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      await db.deleteFrom("badges")
        .where("id", "=", params.id)
        .execute();
      return { status: 200, body: { success: true } };
    } catch (_err) {
      return { status: 500, body: { error: "Failed to delete badge definition" } };
    }
  },
});



// Middlewares
badgesRouter.use("/admin/*", ensureAdmin);
badgesRouter.use("/admin", ensureAdmin);
badgesRouter.use("/admin/*", rateLimitMiddleware(15, 60));
badgesRouter.use("/admin", rateLimitMiddleware(15, 60));

// Public Leaderboard
badgesRouter.get("/leaderboard", async (c) => {
  try {
    const db = c.get("db") as Kysely<DB>;
    const results = await db.selectFrom("user_profiles as u")
      .innerJoin("user_badges as ub", "u.user_id", "ub.user_id")
      .select(["u.user_id", "u.nickname", "u.member_type", (eb) => eb.fn.count("ub.id").as("badge_count")])
      .where("u.show_on_about", "=", 1)
      .groupBy("u.user_id")
      .orderBy("badge_count", "desc")
      .orderBy("u.nickname", "asc")
      .limit(20)
      .execute();
    return c.json({ leaderboard: results });
  } catch (_err) {
    return c.json({ leaderboard: [] }, 500);
  }
});


createHonoEndpoints(badgeContract, badgesTsRestRouter, badgesRouter);
export default badgesRouter;
