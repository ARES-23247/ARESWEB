import { Hono } from "hono";
import { Bindings, ensureAdmin } from "./_shared";

const usersRouter = new Hono<{ Bindings: Bindings }>();

// All routes here are admin-only
usersRouter.use("/*", ensureAdmin);

// ── GET / — list all users ────────────────────
usersRouter.get("/", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT u.id, u.name, u.email, u.image, u.role, u.createdAt,
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
usersRouter.patch("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { role, member_type } = body;

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

// ── DELETE /:id — delete user ────────────────
usersRouter.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    
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
