import { Hono } from "hono";
import { AppEnv, ensureAdmin, getSessionUser, rateLimitMiddleware  } from "../middleware";
import { sendZulipMessage } from "../../utils/zulipSync";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const badgesRouter = new Hono<AppEnv>();

// ── GET /badges — list ALL available badges ────────────────────────
badgesRouter.get("/", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT id, name, description, icon, color_theme, created_at FROM badges ORDER BY created_at ASC"
    ).all();
    return c.json({ badges: results || [] });
  } catch (err) {
    console.error("Failed to fetch badges", err);
    return c.json({ badges: [] }, 500);
  }
});

// ── POST /save — Create a badge class (admin) ────────────────────────
const badgeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  color_theme: z.string().optional()
});

badgesRouter.post("/save", ensureAdmin, rateLimitMiddleware(15, 60), zValidator("json", badgeSchema), async (c) => {
  try {
    const { id, name, description, icon, color_theme } = c.req.valid("json");

    await c.env.DB.prepare(
      "INSERT INTO badges (id, name, description, icon, color_theme) VALUES (?, ?, ?, ?, ?)"
    ).bind(
      id, name, description || "", icon || "Award", color_theme || "ares-gold"
    ).run();

    return c.json({ success: true, id });
  } catch (err) {
    console.error("Failed to create badge", err);
    return c.json({ error: "Failed to create badge" }, 500);
  }
});

// ── POST /users/:userId/award — Award a badge (admin) ──────────────────
const awardBadgeSchema = z.object({
  badge_id: z.string().min(1)
});

badgesRouter.post("/users/:userId/award", ensureAdmin, rateLimitMiddleware(15, 60), zValidator("json", awardBadgeSchema), async (c) => {
  try {
    const userId = (c.req.param("userId") || "");
    const { badge_id } = c.req.valid("json");
    const user = await getSessionUser(c);
    const sessionId = user?.id || "system";

    await c.env.DB.prepare(
      "INSERT INTO user_badges (user_id, badge_id, awarded_by) VALUES (?, ?, ?)"
    ).bind(userId, badge_id, sessionId).run();

    // Broadcast to Zulip asynchronously
    c.executionCtx.waitUntil((async () => {
      try {
        const [userRes, badgeRes] = await Promise.all([
          c.env.DB.prepare("SELECT first_name, last_name, nickname FROM user_profiles WHERE user_id = ?").bind(userId).first<{first_name: string, last_name: string, nickname: string}>(),
          c.env.DB.prepare("SELECT name, icon FROM badges WHERE id = ?").bind(badge_id).first<{name: string, icon: string}>()
        ]);
        
        if (userRes && badgeRes) {
          const userName = userRes.nickname || userRes.first_name || "A team member";
          const badgeName = badgeRes.name;
          const icon = badgeRes.icon === "Trophy" ? "🏆" : badgeRes.icon === "Crown" ? "👑" : badgeRes.icon === "Star" ? "⭐" : "🏅";
          
          await sendZulipMessage(
            c.env,
            "general", // Broadcast gamification to the whole team in general
            "Achievements",
            `${icon} **${userName}** was just awarded the **${badgeName}** badge! \n\nCheck out the updated [ARES Leaderboard](${c.env.ZULIP_URL ? new URL("/leaderboard", c.env.ZULIP_URL.replace("zulipchat", "pages.dev")).href : "https://aresfirst.org/leaderboard"}).`
          );
        }
      } catch (err) {
        console.error("Zulip gamification sync failed", err);
      }
    })());

    return c.json({ success: true });
  } catch (err) {
    console.error("Failed to award badge", err);
    return c.json({ error: "Failed to award badge (maybe already awarded?)" }, 500);
  }
});

// ── DELETE /users/:userId/:badgeId/revoke — Revoke a badge (admin) ──────
badgesRouter.delete("/users/:userId/:badgeId/revoke", ensureAdmin, rateLimitMiddleware(15, 60), async (c) => {
  try {
    const userId = (c.req.param("userId") || "");
    const badgeId = (c.req.param("badgeId") || "");

    await c.env.DB.prepare(
      "DELETE FROM user_badges WHERE user_id = ? AND badge_id = ?"
    ).bind(userId, badgeId).run();

    return c.json({ success: true });
  } catch (err) {
    console.error("Failed to revoke badge", err);
    return c.json({ error: "Failed to revoke badge" }, 500);
  }
});

// ── GET /leaderboard — Public Leaderboard ─────────────────────────────
badgesRouter.get("/leaderboard", async (c) => {
  try {
    // PII-04: Only expose nickname publicly, never first_name/last_name
    const { results } = await c.env.DB.prepare(`
      SELECT u.user_id, u.nickname, u.member_type, 
             COUNT(ub.id) as badge_count
      FROM user_profiles u
      JOIN user_badges ub ON u.user_id = ub.user_id
      WHERE u.show_on_about = 1
      GROUP BY u.user_id
      ORDER BY badge_count DESC, u.nickname ASC
      LIMIT 20
    `).all();
    
    return c.json({ leaderboard: results || [] });
  } catch (err) {
    console.error("Failed to fetch leaderboard", err);
    return c.json({ leaderboard: [] }, 500);
  }
});

export default badgesRouter;
