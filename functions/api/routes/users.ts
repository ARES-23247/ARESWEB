import { Hono } from "hono";
import { Bindings, ensureAdmin } from "./_shared";
import { encrypt } from "../../utils/crypto";

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

// ── PUT /:id — admin profile override ──────────
usersRouter.put("/:id", async (c) => {
  try {
    const userId = c.req.param("id");
    const body = await c.req.json();
    const {
      nickname, first_name, last_name, pronouns, phone, contact_email,
      bio, subteams, dietary_restrictions,
      show_on_about, show_email, show_phone,
      member_type, grade_year, colleges, employers,
      favorite_first_thing, fun_fact,
      favorite_robot_mechanism, pre_match_superstition,
      leadership_role, rookie_year, tshirt_size, emergency_contact_name, emergency_contact_phone,
      parents_name, parents_email, students_name, students_email, favorite_food
    } = body;

    const dietaryStr = Array.isArray(dietary_restrictions) ? JSON.stringify(dietary_restrictions) : (dietary_restrictions || "[]");
    const subteamsStr = Array.isArray(subteams) ? JSON.stringify(subteams) : (subteams || "[]");

    const secret = c.env.ENCRYPTION_SECRET;
    const encryptedName = await encrypt(emergency_contact_name || "", secret);
    const encryptedPhone = await encrypt(emergency_contact_phone || "", secret);
    const encryptedUserPhone = await encrypt(phone || "", secret);
    const encryptedParentsName = await encrypt(parents_name || "", secret);
    const encryptedParentsEmail = await encrypt(parents_email || "", secret);
    const encryptedStudentsName = await encrypt(students_name || "", secret);
    const encryptedStudentsEmail = await encrypt(students_email || "", secret);

    await c.env.DB.prepare(
      `INSERT INTO user_profiles (
        user_id, nickname, first_name, last_name, pronouns, phone, contact_email,
        bio, subteams, dietary_restrictions,
        show_on_about, show_email, show_phone,
        member_type, grade_year, colleges, employers,
        favorite_first_thing, fun_fact,
        favorite_robot_mechanism, pre_match_superstition,
        leadership_role, rookie_year, tshirt_size, emergency_contact_name, emergency_contact_phone,
        parents_name, parents_email, students_name, students_email, favorite_food
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        nickname=excluded.nickname, first_name=excluded.first_name, last_name=excluded.last_name,
        pronouns=excluded.pronouns, phone=excluded.phone, contact_email=excluded.contact_email,
        bio=excluded.bio, subteams=excluded.subteams, dietary_restrictions=excluded.dietary_restrictions,
        show_on_about=excluded.show_on_about, show_email=excluded.show_email, show_phone=excluded.show_phone,
        member_type=excluded.member_type, grade_year=excluded.grade_year, colleges=excluded.colleges,
        employers=excluded.employers, favorite_first_thing=excluded.favorite_first_thing,
        fun_fact=excluded.fun_fact,
        favorite_robot_mechanism=excluded.favorite_robot_mechanism,
        pre_match_superstition=excluded.pre_match_superstition,
        leadership_role=excluded.leadership_role, rookie_year=excluded.rookie_year,
        tshirt_size=excluded.tshirt_size,
        emergency_contact_name=excluded.emergency_contact_name,
        emergency_contact_phone=excluded.emergency_contact_phone,
        parents_name=excluded.parents_name,
        parents_email=excluded.parents_email,
        students_name=excluded.students_name,
        students_email=excluded.students_email,
        favorite_food=excluded.favorite_food`
    ).bind(
      userId,
      nickname || "", first_name || "", last_name || "", pronouns || "",
      encryptedUserPhone, contact_email || "",
      bio || "", subteamsStr, dietaryStr,
      show_on_about ? 1 : 0, show_email ? 1 : 0, show_phone ? 1 : 0,
      member_type || "student", grade_year || "", colleges || "", employers || "",
      favorite_first_thing || "", fun_fact || "",
      favorite_robot_mechanism || "", pre_match_superstition || "",
      leadership_role || "", rookie_year || "",
      tshirt_size || "", encryptedName, encryptedPhone,
      encryptedParentsName, encryptedParentsEmail, encryptedStudentsName, encryptedStudentsEmail,
      favorite_food || ""
    ).run();

    return c.json({ success: true });
  } catch (err) {
    console.error("D1 admin user profile update error:", err);
    return c.json({ error: "Profile update failed" }, 500);
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
