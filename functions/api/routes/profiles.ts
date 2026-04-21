import { Hono } from "hono";
import { AppEnv, Bindings, getSessionUser, sanitizeProfileForPublic } from "./_shared";
import { getAuth } from "../../utils/auth";
import { encrypt, decrypt } from "../../utils/crypto";


const profilesRouter = new Hono<AppEnv>();

// ── GET /me — fetch current user's full profile ───────────────
profilesRouter.get("/me", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    const profile = await c.env.DB.prepare(
      "SELECT p.user_id, p.first_name, p.last_name, p.nickname, p.phone, p.contact_email, p.show_email, p.show_phone, p.pronouns, p.grade_year, p.subteams, p.member_type, p.bio, p.favorite_food, p.dietary_restrictions, p.favorite_first_thing, p.fun_fact, p.colleges, p.employers, p.show_on_about, p.favorite_robot_mechanism, p.pre_match_superstition, p.leadership_role, p.rookie_year, p.tshirt_size, p.emergency_contact_name, p.emergency_contact_phone, p.parents_name, p.parents_email, p.students_name, p.students_email, u.image as avatar, p.updated_at FROM user_profiles p JOIN user u ON p.user_id = u.id WHERE p.user_id = ?"
    ).bind(user.id).first<Record<string, unknown>>();

    const { results: rawBadges } = await c.env.DB.prepare(
      `SELECT b.* FROM badges b
       JOIN user_badges ub ON b.id = ub.badge_id
       WHERE ub.user_id = ?
       ORDER BY ub.awarded_at DESC`
    ).bind(user.id).all();

    // Decrypt PII fields
    if (profile) {
      const secret = c.env.ENCRYPTION_SECRET;
      profile.emergency_contact_name = await decrypt(profile.emergency_contact_name as string, secret);
      profile.emergency_contact_phone = await decrypt(profile.emergency_contact_phone as string, secret);
      profile.phone = await decrypt(profile.phone as string, secret);
      profile.parents_name = await decrypt(profile.parents_name as string, secret);
      profile.parents_email = await decrypt(profile.parents_email as string, secret);
      profile.students_name = await decrypt(profile.students_name as string, secret);
      profile.students_email = await decrypt(profile.students_email as string, secret);
    }


    return c.json({
      ...(profile || {
        user_id: user.id,
        nickname: user.name || "",
        avatar: null,
        member_type: "student",
      }),
      badges: rawBadges || [],
      auth: { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role },
    });
  } catch (err) {
    console.error("D1 profile/me read error:", err);
    return c.json({ error: "Profile fetch failed" }, 500);
  }
});

// ── PUT /me — update current user's profile ──────────────────
profilesRouter.put("/me", async (c) => {
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
      parents_name, parents_email, students_name, students_email, favorite_food
    } = body;

    const dietaryStr = Array.isArray(dietary_restrictions)
      ? JSON.stringify(dietary_restrictions)
      : (dietary_restrictions || "[]");

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
      user.id,
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
    console.error("D1 profile/me write error:", err);
    return c.json({ error: "Profile update failed" }, 500);
  }
});

// ── PUT /avatar — update avatar image ─────────────────────────
profilesRouter.put("/avatar", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    const body = await c.req.json();
    const { image } = body;

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

// ── GET /:userId — public profile ─────────────────────────────
profilesRouter.get("/:userId", async (c) => {
  const userId = (c.req.param("userId") || "");
  try {
    const profile = await c.env.DB.prepare(
      `SELECT p.*, u.image as avatar, u.name 
       FROM user_profiles p 
       LEFT JOIN user u ON p.user_id = u.id 
       WHERE p.user_id = ?`
    ).bind(userId).first<Record<string, unknown>>();

    if (!profile) {
      console.warn(`[Profile API] 404 - User ID ${userId} not found in user_profiles table.`);
      return c.json({ error: "Profile not found" }, 404);
    }

    if (Number(profile.show_on_about || 0) !== 1) {
      console.info(`[Profile API] 403 - User ID ${userId} exists but has show_on_about=0.`);
      return c.json({ error: "This profile is private." }, 403);
    }

    const memberType = String(profile.member_type || "student");
    if (profile.phone) {
      profile.phone = await decrypt(profile.phone as string, c.env.ENCRYPTION_SECRET);
    }
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

export default profilesRouter;
