import { Hono } from "hono";
import { AppEnv, ensureAdmin, rateLimitMiddleware  } from "../middleware";
import { upsertProfile } from "./_profileUtils";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const usersRouter = new Hono<AppEnv>();

// All routes here are admin-only
usersRouter.use("/*", ensureAdmin);

// ── GET / — list all users ────────────────────
usersRouter.get("/", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT u.id, u.name, u.image, u.role, u.createdAt,
              p.nickname, p.member_type
       FROM user u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       ORDER BY u.createdAt DESC`
    ).all();
    return c.json({ users: results || [] });
  } catch (err) {
    console.error("D1 admin users error:", err);
    return c.json({ users: [] }, 500);
  }
});

// ── PATCH /:id — update user role or type ────
const patchUserSchema = z.object({
  role: z.enum(["admin", "author", "user", "unverified"]).optional(),
  member_type: z.enum(["student", "coach", "mentor", "parent", "alumni"]).optional()
});

usersRouter.patch("/:id", rateLimitMiddleware(15, 60), zValidator("json", patchUserSchema), async (c) => {
  try {
    const id = (c.req.param("id") || "");
    const { role, member_type } = c.req.valid("json");

    if (role) {
      await c.env.DB.prepare("UPDATE user SET role = ? WHERE id = ?").bind(role, id).run();
    }
    if (member_type) {
      await c.env.DB.prepare(
        "INSERT INTO user_profiles (user_id, member_type) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET member_type = excluded.member_type"
      ).bind(id, member_type).run();
    }

    return c.json({ success: true });
  } catch (err) {
    console.error("D1 admin user patch error:", err);
    return c.json({ error: "User update failed" }, 500);
  }
});

// ── GET /:id — admin detail view ─────────────
usersRouter.get("/:id", async (c) => {
  try {
    const userId = (c.req.param("id") || "");
    const profile = await c.env.DB.prepare(
      `SELECT u.*, p.*, u.image as avatar 
       FROM user u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE u.id = ?`
    ).bind(userId).first<Record<string, unknown>>();

    if (!profile) return c.json({ error: "User not found" }, 404);
    
    const { decrypt } = await import("../../utils/crypto");
    const secret = c.env.ENCRYPTION_SECRET;
    
    const p = { ...profile };
    p.emergency_contact_name = await decrypt(p.emergency_contact_name as string, secret);
    p.emergency_contact_phone = await decrypt(p.emergency_contact_phone as string, secret);
    p.phone = await decrypt(p.phone as string, secret);
    p.contact_email = await decrypt(p.contact_email as string, secret);
    p.parents_name = await decrypt(p.parents_name as string, secret);
    p.parents_email = await decrypt(p.parents_email as string, secret);
    p.students_name = await decrypt(p.students_name as string, secret);
    p.students_email = await decrypt(p.students_email as string, secret);

    return c.json({ user: p });
  } catch (err) {
    console.error("D1 admin user detail error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

// ── PUT /:id — admin profile override ──────────
usersRouter.put("/:id", rateLimitMiddleware(15, 60), async (c) => {
  try {
    const userId = (c.req.param("id") || "");
    const body = await c.req.json();

    await upsertProfile(c, userId, body);

    return c.json({ success: true });
  } catch (err) {
    console.error("D1 admin user profile update error:", err);
    return c.json({ error: "Profile update failed" }, 500);
  }
});

// ── DELETE /:id — delete user ────────────────
usersRouter.delete("/:id", async (c) => {
  try {
    const id = (c.req.param("id") || "");
    
    // Cascade delete all related user data
    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM comments WHERE user_id = ?").bind(id),
      c.env.DB.prepare("DELETE FROM event_signups WHERE user_id = ?").bind(id),
      c.env.DB.prepare("DELETE FROM user_badges WHERE user_id = ?").bind(id),
      c.env.DB.prepare("DELETE FROM user_profiles WHERE user_id = ?").bind(id),
      c.env.DB.prepare("DELETE FROM session WHERE userId = ?").bind(id),
      c.env.DB.prepare("DELETE FROM account WHERE userId = ?").bind(id),
      c.env.DB.prepare("DELETE FROM user WHERE id = ?").bind(id),
    ]);
    
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 admin user delete error:", err);
    return c.json({ error: "User delete failed" }, 500);
  }
});

export default usersRouter;
