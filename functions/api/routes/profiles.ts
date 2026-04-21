import { Hono } from "hono";
import { Bindings, ensureAdmin, getSessionUser, sanitizeProfileForPublic } from "./_shared";
import { getAuth } from "../../utils/auth";

const profilesRouter = new Hono<{ Bindings: Bindings }>();

// ── GET /profile/me — fetch current user's full profile ───────────────
profilesRouter.get("/profile/me", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    const profile = await c.env.DB.prepare(
      "SELECT p.user_id, p.first_name, p.last_name, p.nickname, p.phone, p.contact_email, p.show_email, p.show_phone, p.pronouns, p.grade_year, p.subteams, p.member_type, p.bio, p.favorite_food, p.dietary_restrictions, p.favorite_first_thing, p.fun_fact, p.colleges, p.employers, p.show_on_about, p.favorite_robot_mechanism, p.pre_match_superstition, p.leadership_role, p.rookie_year, p.tshirt_size, p.emergency_contact_name, p.emergency_contact_phone, p.parents_name, p.parents_email, p.students_name, p.students_email, u.image as avatar, p.updated_at FROM user_profiles p JOIN user u ON p.user_id = u.id WHERE p.user_id = ?"
    ).bind(user.id).first();

    const { results: rawBadges } = await c.env.DB.prepare(
      `SELECT b.* FROM badges b
       JOIN user_badges ub ON b.id = ub.badge_id
       WHERE ub.user_id = ?
       ORDER BY ub.awarded_at DESC`
    ).bind(user.id).all();

    return c.json({
      ...(profile || {
        user_id: user.id,
        nickname: user.name || "",
        avatar: null,
        member_type: "student",
      }),
      badges: rawBadges || [],
      auth: { id: user.id, email: user.email, name: user.name, image: user.image },
    });
  } catch (err) {
    console.error("D1 profile/me read error:", err);
    return c.json({ error: "Profile fetch failed" }, 500);
  }
});

// ── PUT /profile/me — update current user's profile ──────────────────
profilesRouter.put("/profile/me", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    const body = await c.req.json();
    const {
      nickname, first_name, last_name, pronouns, phone, contact_email,
      bio, subteams, dietary_restrictions,
      show_on_about, show_email, show_phone,
      member_type, grade_year, colleges, employers,
      favorite_first_thing, fun_fact,
      favorite_robot_mechanism, pre_match_superstition,
      leadership_role, rookie_year, tshirt_size, emergency_contact_name, emergency_contact_phone,
      parents_name, parents_email, students_name, students_email
    } = body;

    const dietaryStr = Array.isArray(dietary_restrictions)
      ? JSON.stringify(dietary_restrictions)
      : (dietary_restrictions || "[]");

    const subteamsStr = Array.isArray(subteams) ? JSON.stringify(subteams) : (subteams || "[]");

    await c.env.DB.prepare(
      `INSERT INTO user_profiles (
        user_id, nickname, first_name, last_name, pronouns, phone, contact_email,
        bio, subteams, dietary_restrictions,
        show_on_about, show_email, show_phone,
        member_type, grade_year, colleges, employers,
        favorite_first_thing, fun_fact,
        favorite_robot_mechanism, pre_match_superstition,
        leadership_role, rookie_year, tshirt_size, emergency_contact_name, emergency_contact_phone,
        parents_name, parents_email, students_name, students_email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        students_email=excluded.students_email`
    ).bind(
      user.id,
      nickname || "", first_name || "", last_name || "", pronouns || "",
      phone || "", contact_email || "",
      bio || "", subteamsStr, dietaryStr,
      show_on_about ? 1 : 0, show_email ? 1 : 0, show_phone ? 1 : 0,
      member_type || "student", grade_year || "", colleges || "", employers || "",
      favorite_first_thing || "", fun_fact || "",
      favorite_robot_mechanism || "", pre_match_superstition || "",
      leadership_role || "", rookie_year || "",
      tshirt_size || "", emergency_contact_name || "", emergency_contact_phone || "",
      parents_name || "", parents_email || "", students_name || "", students_email || ""
    ).run();

    return c.json({ success: true });
  } catch (err) {
    console.error("D1 profile/me write error:", err);
    return c.json({ error: "Profile update failed" }, 500);
  }
});

// ── PUT /profile/avatar — update avatar image ─────────────────────────
profilesRouter.put("/profile/avatar", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    const body = await c.req.json();
    const { image } = body;

    // Update user.image in auth DB
    const auth = getAuth(c.env.DB, c.env, c.req.url);
    await auth.api.updateUser({ 
      headers: c.req.raw.headers,
      body: { image: image || null }
    });

    return c.json({ success: true });
  } catch (err) {
    console.error("Avatar update error:", err);
    return c.json({ error: "Avatar update failed" }, 500);
  }
});

// ── GET /profile/:userId — public profile ─────────────────────────────
profilesRouter.get("/profile/:userId", async (c) => {
  const userId = c.req.param("userId");
  try {
    const profile = await c.env.DB.prepare(
      `SELECT p.*, u.image as avatar, u.name 
       FROM user_profiles p 
       LEFT JOIN user u ON p.user_id = u.id 
       WHERE p.user_id = ?`
    ).bind(userId).first<any>();

    if (!profile) {
      console.warn(`[Profile API] 404 - User ID ${userId} not found in user_profiles table.`);
      return c.json({ error: "Profile not found" }, 404);
    }

    if (Number(profile.show_on_about || 0) !== 1) {
      console.info(`[Profile API] 403 - User ID ${userId} exists but has show_on_about=0.`);
      return c.json({ error: "This profile is private." }, 403);
    }

    const memberType = String(profile.member_type || "student");
    const sanitized = sanitizeProfileForPublic(profile as Record<string, unknown>, memberType);

    const { results: rawBadges } = await c.env.DB.prepare(
      `SELECT b.* FROM badges b
       JOIN user_badges ub ON b.id = ub.badge_id
       WHERE ub.user_id = ?
       ORDER BY ub.awarded_at DESC`
    ).bind(userId).all();

    return c.json({ profile: sanitized, badges: rawBadges || [] });
  } catch (err) {
    console.error("D1 public profile error:", err);
    return c.json({ error: "Profile fetch failed" }, 500);
  }
});

// ── GET /team-roster — about page roster ──────────────────────────────
profilesRouter.get("/team-roster", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT p.user_id, p.nickname, p.bio, p.pronouns, p.subteams, p.member_type,
              p.favorite_first_thing, p.fun_fact, p.show_email, p.contact_email,
              p.favorite_robot_mechanism, p.pre_match_superstition, p.leadership_role,
              p.rookie_year, p.colleges, p.employers,
              u.image as avatar, u.name
       FROM user_profiles p
       JOIN user u ON p.user_id = u.id
       WHERE p.show_on_about = 1 AND u.role NOT IN ('unverified')`
    ).all();

    const sanitized = (results || []).map((r: Record<string, unknown>) => {
      const memberType = String(r.member_type || "student");
      return sanitizeProfileForPublic(r, memberType);
    });

    return c.json({ members: sanitized });
  } catch (err) {
    console.error("D1 team roster error:", err);
    return c.json({ members: [] });
  }
});

// ── GET /logistics/summary — aggregated logistics for event planning ──
profilesRouter.get("/logistics/summary", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Only admin/parent/coach/mentor can see logistics
  const isManagement = user.role === "admin" || ["parent", "coach", "mentor"].includes(user.member_type);
  if (!isManagement) return c.json({ error: "Forbidden" }, 403);

  try {
    const { results } = await c.env.DB.prepare(
      `SELECT p.dietary_restrictions, p.tshirt_size, p.member_type, u.name
       FROM user_profiles p
       JOIN user u ON p.user_id = u.id
       WHERE u.role NOT IN ('unverified')`
    ).all();

    const summary: Record<string, number> = {};
    const tshirtSummary: Record<string, number> = {};
    const memberCounts: Record<string, number> = {};
    const totalMembers = results.length;

    for (const r of results as { dietary_restrictions?: string; tshirt_size?: string; member_type?: string; name?: string }[]) {
      const mt = r.member_type || "student";
      memberCounts[mt] = (memberCounts[mt] || 0) + 1;

      if (r.tshirt_size) {
        tshirtSummary[r.tshirt_size] = (tshirtSummary[r.tshirt_size] || 0) + 1;
      }

      try {
        const restrictions = JSON.parse(r.dietary_restrictions || "[]") as string[];
        for (const dr of restrictions) {
          summary[dr] = (summary[dr] || 0) + 1;
        }
      } catch { /* ignore */ }
    }

    return c.json({
      totalCount: totalMembers,
      memberCounts,
      dietary: summary,
      tshirts: tshirtSummary,
    });
  } catch (err) {
    console.error("D1 logistics summary error:", err);
    return c.json({ error: "Logistics fetch failed" }, 500);
  }
});

// ── GET /admin/users — list all users (admin only) ────────────────────
profilesRouter.get("/admin/users", ensureAdmin, async (c) => {
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

// ── PATCH /admin/users/:id — update user role or type (admin only) ────
profilesRouter.patch("/admin/users/:id", ensureAdmin, async (c) => {
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

// ── DELETE /admin/users/:id — delete user (admin only) ────────────────
profilesRouter.delete("/admin/users/:id", ensureAdmin, async (c) => {
  try {
    const id = c.req.param("id");
    
    // GAP-03: Cascade delete all related user data
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

export default profilesRouter;
