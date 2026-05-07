import { typedHandler } from "../utils/handler";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { OpenAPIHono } from "@hono/zod-openapi";

import {
  AppEnv,
  getSessionUser,
  sanitizeProfileForPublic,
  persistentRateLimitMiddleware,
  rateLimitMiddleware,
  ensureAuth,
} from "../middleware";
import { getAuth } from "../../utils/auth";
import { edgeCacheMiddleware } from "../middleware/cache";
import { decrypt } from "../../utils/crypto";
import { upsertProfile } from "./_profileUtils";
import { z } from "zod";
import {

  getMeRoute,
  updateMeRoute,
  getTeamRosterRoute,
  getPublicProfileRoute,
  updateAvatarRoute,
  profileMeSchema,
  rosterMemberSchema,
} from "../../../shared/routes/profiles";


const profilesRouter = new OpenAPIHono<AppEnv>();

// ─── Middleware Configuration ─────────────────────────────────────────────
// Apply rate limiting to public routes
profilesRouter.use("/team-roster", rateLimitMiddleware(100, 60));
profilesRouter.use("/team-roster", edgeCacheMiddleware(300, 60));
profilesRouter.use("/:userId", rateLimitMiddleware(100, 60));
profilesRouter.use("/:userId", edgeCacheMiddleware(300, 60));
// Apply persistent rate limiting to write routes
profilesRouter.use("/update-me", persistentRateLimitMiddleware(10, 60));
profilesRouter.use("/avatar", persistentRateLimitMiddleware(15, 60));

// Input validation schema for profile updates
const updateUserProfileSchema = z
  .record(z.string(), z.union([z.string(), z.boolean(), z.array(z.string()), z.null()]).optional())
  .refine(
    (data) => {
      const MAX_BIO_LENGTH = 2000;
      const MAX_NAME_LENGTH = 100;
      const MAX_GENERAL_LENGTH = 500;

      if (typeof data.bio === "string" && data.bio.length > MAX_BIO_LENGTH) return false;
      if (typeof data.nickname === "string" && data.nickname.length > MAX_NAME_LENGTH) return false;
      if (typeof data.pronouns === "string" && data.pronouns.length > MAX_GENERAL_LENGTH) return false;
      if (typeof data.favorite_food === "string" && data.favorite_food.length > MAX_GENERAL_LENGTH) return false;
      if (typeof data.dietary_restrictions === "string" && data.dietary_restrictions.length > MAX_GENERAL_LENGTH) return false;
      if (typeof data.favorite_robot_mechanism === "string" && data.favorite_robot_mechanism.length > MAX_GENERAL_LENGTH) return false;
      if (typeof data.pre_match_superstition === "string" && data.pre_match_superstition.length > MAX_GENERAL_LENGTH) return false;
      if (typeof data.leadership_role === "string" && data.leadership_role.length > MAX_GENERAL_LENGTH) return false;

      return true;
    },
    { message: "One or more fields exceed maximum length" }
  );

// ─── Current User Routes ──────────────────────────────────────────────────

profilesRouter.use("/me", ensureAuth);
profilesRouter.use("/update-me", ensureAuth);
profilesRouter.use("/avatar", ensureAuth);

profilesRouter.openapi(getMeRoute, typedHandler<typeof getMeRoute>(async (c) => {
  const user = (await getSessionUser(c))!;
  const db = c.get("db") as Kysely<DB>;

  try {
    const profileRow = await db
      .selectFrom("user_profiles as p")
      .innerJoin("user as u", "p.user_id", "u.id")
      .select([
        "p.user_id",
        "p.nickname",
        "p.first_name",
        "p.last_name",
        "p.bio",
        "p.pronouns",
        "p.subteams",
        "p.member_type",
        "p.grade_year",
        "p.favorite_food",
        "p.dietary_restrictions",
        "p.favorite_first_thing",
        "p.fun_fact",
        "p.show_email",
        "p.contact_email",
        "p.show_phone",
        "p.phone",
        "p.show_on_about",
        "p.favorite_robot_mechanism",
        "p.pre_match_superstition",
        "p.leadership_role",
        "p.rookie_year",
        "p.colleges",
        "p.employers",
        "p.tshirt_size",
        "p.emergency_contact_name",
        "p.emergency_contact_phone",
        "p.parents_name",
        "p.parents_email",
        "p.students_name",
        "p.students_email",
        "u.image as avatar",
      ])
      .where("p.user_id", "=", user.id)
      .executeTakeFirst();

    const p: Record<string, unknown> = {
      ...(profileRow || {
        user_id: user.id,
        nickname: user.name || "",
        first_name: "",
        last_name: "",
        avatar: null,
        member_type: "student",
      }),
    };

    if (profileRow) {
      const secret = c.env.ENCRYPTION_SECRET;
      const safeDecrypt = async (val: string | null) => {
        if (!val) return null;
        try {
          return await decrypt(val as string, secret);
        } catch (err) {
          console.error("[Crypto] Decryption failed for field:", err);
          return "[Decryption Failed]";
        }
      };

      const [emergency_contact_name, emergency_contact_phone, phone, contact_email, parents_name, parents_email, students_name, students_email] =
        await Promise.all([
          safeDecrypt(p.emergency_contact_name as string | null),
          safeDecrypt(p.emergency_contact_phone as string | null),
          safeDecrypt(p.phone as string | null),
          safeDecrypt(p.contact_email as string | null),
          safeDecrypt(p.parents_name as string | null),
          safeDecrypt(p.parents_email as string | null),
          safeDecrypt(p.students_name as string | null),
          safeDecrypt(p.students_email as string | null),
        ]);

      p.emergency_contact_name = emergency_contact_name;
      p.emergency_contact_phone = emergency_contact_phone;
      p.phone = phone;
      p.contact_email = contact_email;
      p.parents_name = parents_name;
      p.parents_email = parents_email;
      p.students_name = students_name;
      p.students_email = students_email;
    }

    return c.json(
      {
        ...p,
        member_type: String(p.member_type || "student"),
        first_name: String(p.first_name || ""),
        last_name: String(p.last_name || ""),
        nickname: String(p.nickname || ""),
        auth: { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role },
      } as z.infer<typeof profileMeSchema>,
      200
    );
  } catch (err) {
    console.error("[Profile:Me] Error", err);
    return c.json({ error: "Failed to fetch your profile" }, 500);
  }
}));

profilesRouter.openapi(updateMeRoute, typedHandler<typeof updateMeRoute>(async (c) => {
  const user = (await getSessionUser(c))!;
  try {
    const body = c.req.valid("json");
    const validationResult = updateUserProfileSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        { error: "Invalid profile data: " + validationResult.error.issues.map((i) => i.message).join(", ") },
        400
      );
    }

    await upsertProfile(c, user.id, validationResult.data);
    return c.json({ success: true }, 200);
  } catch (e) {
    console.error("[Profile:UpdateMe] Error", e);
    return c.json({ error: "Failed to update profile" }, 500);
  }
}));

profilesRouter.openapi(updateAvatarRoute, typedHandler<typeof updateAvatarRoute>(async (c) => {
  try {
    const body = c.req.valid("json");
    const image = (body as { image?: string | null }).image;
    const auth = getAuth(c.env.DB, c.env, c.req.url);
    await auth.api.updateUser({ headers: c.req.raw.headers, body: { image: image || null } });
    return c.json({ success: true }, 200);
  } catch {
    return c.json({ error: "Avatar update failed" }, 500);
  }
}));

// ─── Public Routes ────────────────────────────────────────────────────────

profilesRouter.openapi(getTeamRosterRoute, typedHandler<typeof getTeamRosterRoute>(async (c) => {
  const db = c.get("db") as Kysely<DB>;
  try {
    const results = await db
      .selectFrom("user_profiles as p")
      .innerJoin("user as u", "p.user_id", "u.id")
      .where("p.show_on_about", "=", 1)
      .where("u.role", "!=", "unverified")
      .select([
        "p.user_id",
        "p.nickname",
        "p.bio",
        "p.pronouns",
        "p.subteams",
        "p.member_type",
        "p.favorite_first_thing",
        "p.fun_fact",
        "p.show_email",
        "p.contact_email",
        "p.favorite_robot_mechanism",
        "p.pre_match_superstition",
        "p.leadership_role",
        "p.rookie_year",
        "p.colleges",
        "p.employers",
        "u.image as avatar",
        "u.name",
        "u.role",
      ])
      .execute();

    const secret = c.env.ENCRYPTION_SECRET;
    const safeDecrypt = async (val: string | null) => {
      if (!val || !val.includes(":")) return val || null;
      try {
        return await decrypt(val, secret);
      } catch (err) {
        console.error("[Roster:Decrypt] Error", err);
        return null;
      }
    };

    const members = (
      await Promise.all(
        (results || []).map(async (r) => {
          const row = r as Record<string, unknown>;
          const memberType = String(row.member_type || "student").toLowerCase();

          if (row.contact_email && (memberType === "mentor" || memberType === "coach")) {
            row.contact_email = await safeDecrypt(row.contact_email as string | null);
          }

          const sanitized = sanitizeProfileForPublic(row, memberType);
          if (!sanitized) return null;

          return {
            ...sanitized,
            user_id: String(sanitized.user_id),
            nickname: sanitized.nickname || sanitized.name || "ARES Member",
            avatar: sanitized.avatar || null,
            member_type: memberType,
            subteams: Array.isArray(sanitized.subteams) ? sanitized.subteams : [],
            colleges: Array.isArray(sanitized.colleges) ? sanitized.colleges : [],
            employers: Array.isArray(sanitized.employers) ? sanitized.employers : [],
          };
        })
      )
    ).filter((m) => !!m);

    if (members.length === 0 && results.length > 0) {
      console.warn("[Roster] Results found but all members were filtered out or failed processing.");
    }

    return c.json({ members: members as z.infer<typeof rosterMemberSchema>[] }, 200);
  } catch (err) {
    console.error("[Profile:Roster] Error", err);
    return c.json({ error: "Failed to fetch team roster" }, 500);
  }
}));

profilesRouter.openapi(getPublicProfileRoute, typedHandler<typeof getPublicProfileRoute>(async (c) => {
  const { userId } = c.req.valid("param");
  const db = c.get("db") as Kysely<DB>;
  try {
    const profileRow = await db
      .selectFrom("user_profiles as p")
      .leftJoin("user as u", "p.user_id", "u.id")
      .select([
        "p.user_id",
        "p.nickname",
        "p.bio",
        "p.pronouns",
        "p.subteams",
        "p.member_type",
        "p.favorite_first_thing",
        "p.fun_fact",
        "p.show_email",
        "p.contact_email",
        "p.show_phone",
        "p.phone",
        "p.show_on_about",
        "p.favorite_robot_mechanism",
        "p.pre_match_superstition",
        "p.leadership_role",
        "p.rookie_year",
        "p.colleges",
        "p.employers",
        "p.grade_year",
        "u.image as avatar",
        "u.name",
      ])
      .where("p.user_id", "=", userId)
      .executeTakeFirst();

    if (!profileRow) return c.json({ error: "Profile not found" }, 404);
    if (Number(profileRow.show_on_about || 0) !== 1) return c.json({ error: "This profile is private." }, 403);

    const memberType = String(profileRow.member_type || "student");
    const sanitized: Record<string, unknown> = sanitizeProfileForPublic(profileRow, memberType);

    const requester = await getSessionUser(c);
    const isAdmin = requester?.role === "admin" || requester?.member_type === "coach" || requester?.member_type === "mentor";
    const isSelf = requester?.id === userId;

    if (isAdmin || isSelf) {
      const sensitive = await db
        .selectFrom("user_profiles")
        .select([
          "emergency_contact_name",
          "emergency_contact_phone",
          "dietary_restrictions",
          "tshirt_size",
          "phone",
          "contact_email",
          "parents_name",
          "parents_email",
          "students_name",
          "students_email",
        ])
        .where("user_id", "=", userId)
        .executeTakeFirst();

      if (sensitive) {
        const secret = c.env.ENCRYPTION_SECRET;
        sanitized.emergency_contact_name = await decrypt(sensitive.emergency_contact_name as string, secret);
        sanitized.emergency_contact_phone = await decrypt(sensitive.emergency_contact_phone as string, secret);
        sanitized.dietary_restrictions = sensitive.dietary_restrictions;
        sanitized.tshirt_size = sensitive.tshirt_size;
        sanitized.phone = await decrypt(sensitive.phone as string, secret);
        sanitized.contact_email = await decrypt(sensitive.contact_email as string, secret);
        sanitized.parents_name = await decrypt(sensitive.parents_name as string, secret);
        sanitized.parents_email = await decrypt(sensitive.parents_email as string, secret);
        sanitized.students_name = await decrypt(sensitive.students_name as string, secret);
        sanitized.students_email = await decrypt(sensitive.students_email as string, secret);
      }
    }

    const rawBadges = await db
      .selectFrom("badges as b")
      .innerJoin("user_badges as ub", "b.id", "ub.badge_id")
      .selectAll("b")
      .where("ub.user_id", "=", userId)
      .orderBy("ub.awarded_at", "desc")
      .execute();

    return c.json({ profile: sanitized, badges: rawBadges }, 200);
  } catch {
    return c.json({ error: "Profile fetch failed" }, 500);
  }
}));

export default profilesRouter;
