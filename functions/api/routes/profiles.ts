import { Hono } from "hono";
import { AppEnv, getSessionUser, sanitizeProfileForPublic } from "./_shared";
import { getAuth } from "../../utils/auth";
import { decrypt } from "../../utils/crypto";
import { upsertProfile } from "./_profileUtils";


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
      profile.contact_email = await decrypt(profile.contact_email as string, secret);
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
    await upsertProfile(c, user.id, body);
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
    const sanitized = sanitizeProfileForPublic(profile as Record<string, unknown>, memberType) as Record<string, unknown>;

    // If requester is an admin/leader or the user themselves, decrypt and append internal records
    const requester = await getSessionUser(c);
    const isAdmin = requester?.role === "admin" || requester?.role === "author" || requester?.member_type === "coach" || requester?.member_type === "mentor";
    const isSelf = requester?.id === userId;

    if (isAdmin || isSelf) {
      const secret = c.env.ENCRYPTION_SECRET;
      sanitized.emergency_contact_name = await decrypt(profile.emergency_contact_name as string, secret);
      sanitized.emergency_contact_phone = await decrypt(profile.emergency_contact_phone as string, secret);
      sanitized.dietary_restrictions = profile.dietary_restrictions;
      sanitized.tshirt_size = profile.tshirt_size;
    }

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
