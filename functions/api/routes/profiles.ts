/* eslint-disable @typescript-eslint/no-explicit-any -- ts-rest handler input validated by contract library */
import { ServerInferRequest } from "../../../shared/types/api";
import { Hono } from "hono";
import { AppEnv, getSessionUser, sanitizeProfileForPublic, persistentRateLimitMiddleware, rateLimitMiddleware, ensureAuth, s } from "../middleware";
import { getAuth } from "../../utils/auth";
import { decrypt } from "../../utils/crypto";
import { upsertProfile } from "./_profileUtils";
import { createHonoEndpoints } from "ts-rest-hono";
import { profileContract, updateUserProfileSchema } from "../../../shared/schemas/contracts/userContract";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import type { HonoContext } from "@shared/types/api";


export const profilesRouter = new Hono<AppEnv>();


 
const profileHandlers: any = {
  getMe: async (_input: ServerInferRequest<typeof profileContract["getMe"]>, c: HonoContext) => {
    const user = (await getSessionUser(c))!;
    const db = c.get("db") as Kysely<DB>;

    try {
      const profileRow = await db.selectFrom("user_profiles as p")
        .innerJoin("user as u", "p.user_id", "u.id")
        .select([
          "p.user_id", "p.nickname", "p.first_name", "p.last_name", "p.bio", "p.pronouns", 
          "p.subteams", "p.member_type", "p.grade_year", "p.favorite_food", "p.dietary_restrictions",
          "p.favorite_first_thing", "p.fun_fact", "p.show_email", "p.contact_email", "p.show_phone", "p.phone",
          "p.show_on_about", "p.favorite_robot_mechanism", "p.pre_match_superstition", "p.leadership_role",
          "p.rookie_year", "p.colleges", "p.employers", "p.tshirt_size",
          "p.emergency_contact_name", "p.emergency_contact_phone", 
          "p.parents_name", "p.parents_email", "p.students_name", "p.students_email",
          "u.image as avatar"
        ])
        .where("p.user_id", "=", user.id)
        .executeTakeFirst();

      const p = { 
        ...(profileRow || {
          user_id: user.id,
          nickname: user.name || "",
          first_name: "",
          last_name: "",
          avatar: null,
          member_type: "student",
        })
      } as Record<string, unknown>;

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

        const [
          emergency_contact_name,
          emergency_contact_phone,
          phone,
          contact_email,
          parents_name,
          parents_email,
          students_name,
          students_email
        ] = await Promise.all([
          safeDecrypt(p.emergency_contact_name as string | null),
          safeDecrypt(p.emergency_contact_phone as string | null),
          safeDecrypt(p.phone as string | null),
          safeDecrypt(p.contact_email as string | null),
          safeDecrypt(p.parents_name as string | null),
          safeDecrypt(p.parents_email as string | null),
          safeDecrypt(p.students_name as string | null),
          safeDecrypt(p.students_email as string | null)
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

      return {
        status: 200 as const,
        body: {
          ...p,
          member_type: String(p.member_type || "student"),
          first_name: String(p.first_name || ""),
          last_name: String(p.last_name || ""),
          nickname: String(p.nickname || ""),
          auth: { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role }
        }
      };
    } catch (err) {
      console.error("[Profile:Me] Error", err);
      return { status: 500 as const, body: { error: "Failed to fetch your profile" } };
    }
  },
  updateMe: async (input: ServerInferRequest<typeof profileContract["updateMe"]>, c: HonoContext) => {
    const user = (await getSessionUser(c))!;
    try {
      // Validate input against schema before updating profile
      const validationResult = updateUserProfileSchema.safeParse(input.body);
      if (!validationResult.success) {
        return {
          status: 400 as const,
          body: {
            error: "Invalid profile data: " + validationResult.error.issues.map(i => i.message).join(", ")
          }
        };
      }

      await upsertProfile(c, user.id, validationResult.data);
      return { status: 200 as const, body: { success: true } };
    } catch (e) {
      console.error("[Profile:UpdateMe] Error", e);
      return { status: 500 as const, body: { error: "Failed to update profile" } };
    }
  },
  getTeamRoster: async (_input: ServerInferRequest<typeof profileContract["getTeamRoster"]>, c: HonoContext) => {
    const db = c.get("db") as Kysely<DB>;
    try {
      // SEC-F04: Only show verified users or those who have explicitly opted in via profile.
      // We allow 'user', 'admin', 'author'. We MUST exclude 'unverified' even if show_on_about is 1.
      const results = await db.selectFrom("user_profiles as p")
        .innerJoin("user as u", "p.user_id", "u.id")
        .where("p.show_on_about", "=", 1)
        .where("u.role", "!=", "unverified")
        .select([
          "p.user_id", "p.nickname", "p.bio", "p.pronouns", "p.subteams", "p.member_type",
          "p.favorite_first_thing", "p.fun_fact", "p.show_email", "p.contact_email",
          "p.favorite_robot_mechanism", "p.pre_match_superstition", "p.leadership_role",
          "p.rookie_year", "p.colleges", "p.employers",
          "u.image as avatar", "u.name", "u.role"
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

      const members = (await Promise.all((results || []).map(async (r) => {
        const row = r as Record<string, unknown>;
        const memberType = String(row.member_type || "student").toLowerCase();
        
        // Mentors/Coaches might have encrypted contact info
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
          employers: Array.isArray(sanitized.employers) ? sanitized.employers : []
        };
      }))).filter(m => !!m);

      if (members.length === 0 && results.length > 0) {
        console.warn("[Roster] Results found but all members were filtered out or failed processing.");
      }

      return { status: 200 as const, body: { members } };
    } catch (err) {
      console.error("[Profile:Roster] Error", err);
      return { status: 500 as const, body: { error: "Failed to fetch team roster" } };
    }
  },
  getPublicProfile: async (input: ServerInferRequest<typeof profileContract["getPublicProfile"]>, c: HonoContext) => {
    const { userId } = input.params;
    const db = c.get("db") as Kysely<DB>;
    try {
      const profileRow = await db.selectFrom("user_profiles as p")
        .leftJoin("user as u", "p.user_id", "u.id")
        .select([
          "p.user_id", "p.nickname", "p.bio", "p.pronouns", "p.subteams", "p.member_type",
          "p.favorite_first_thing", "p.fun_fact", "p.show_email", "p.contact_email",
          "p.show_phone", "p.phone", "p.show_on_about",
          "p.favorite_robot_mechanism", "p.pre_match_superstition", "p.leadership_role",
          "p.rookie_year", "p.colleges", "p.employers", "p.grade_year",
          "u.image as avatar", "u.name"
        ])
        .where("p.user_id", "=", userId)
        .executeTakeFirst();

      if (!profileRow) return { status: 404 as const, body: { error: "Profile not found" } };
      if (Number(profileRow.show_on_about || 0) !== 1) return { status: 403 as const, body: { error: "This profile is private." } };

      const memberType = String(profileRow.member_type || "student");
      const sanitized = sanitizeProfileForPublic(profileRow, memberType) as Record<string, unknown>;

      const requester = await getSessionUser(c);
      const isAdmin = requester?.role === "admin" || requester?.member_type === "coach" || requester?.member_type === "mentor";
      const isSelf = requester?.id === userId;

      if (isAdmin || isSelf) {
        const sensitive = await db.selectFrom("user_profiles")
          .select(["emergency_contact_name", "emergency_contact_phone", "dietary_restrictions", "tshirt_size", "phone", "contact_email", "parents_name", "parents_email", "students_name", "students_email"])
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

      const rawBadges = await db.selectFrom("badges as b")
        .innerJoin("user_badges as ub", "b.id", "ub.badge_id")
        .selectAll("b")
        .where("ub.user_id", "=", userId)
        .orderBy("ub.awarded_at", "desc")
        .execute();

       
      return { status: 200 as const, body: { profile: sanitized as any, badges: rawBadges as any[] } as any };
    } catch {
      return { status: 500 as const, body: { error: "Profile fetch failed" } };
    }
  }
};


const profileTsRestRouter = s.router(profileContract, profileHandlers as any);

profilesRouter.use("/me", ensureAuth);
profilesRouter.use("/update-me", ensureAuth);
profilesRouter.use("/avatar", ensureAuth);

createHonoEndpoints(
  profileContract,
  profileTsRestRouter,
  profilesRouter,
  {
    responseValidation: true,
    responseValidationErrorHandler: (err, _c) => {
      console.error('[Contract] Response validation failed:', err.cause);
      return { error: { message: 'Internal server error' }, status: 500 };
    }
  }
);

profilesRouter.use("/team-roster", rateLimitMiddleware(100, 60));
profilesRouter.use("/:userId", rateLimitMiddleware(100, 60));

profilesRouter.use("/update-me", persistentRateLimitMiddleware(10, 60));
profilesRouter.put("/avatar", persistentRateLimitMiddleware(15, 60), async (c: HonoContext) => {
  try {
    const body = await c.req.json();
    const { image } = body;
    const auth = getAuth(c.env.DB, c.env, c.req.url);
    await auth.api.updateUser({ headers: c.req.raw.headers, body: { image: image || null } });
    return c.json({ success: true });
  } catch {
    return c.json({ error: "Avatar update failed" }, 500);
  }
});

export default profilesRouter;


