import { Hono } from "hono";
import { AppEnv, getSessionUser, sanitizeProfileForPublic, rateLimitMiddleware } from "../middleware";
import { getAuth } from "../../utils/auth";
import { decrypt } from "../../utils/crypto";
import { upsertProfile } from "./_profileUtils";
import { initServer, createHonoEndpoints } from "ts-rest-hono";
import { RecursiveRouterObj } from "@ts-rest/hono";
import { profileContract } from "../../../src/schemas/contracts/userContract";

const s = initServer<AppEnv>();
const profilesRouter = new Hono<AppEnv>();

const profileHandlers: RecursiveRouterObj<typeof profileContract, AppEnv> = {
  getMe: async (_, c) => {
    const user = await getSessionUser(c);
    if (!user) return { status: 200, body: { auth: null, member_type: "student", first_name: "", last_name: "", nickname: "" } as any };

    const db = c.get("db");

    try {
      const profileRow = await db.selectFrom("user_profiles as p")
        .innerJoin("user as u", "p.user_id", "u.id")
        .selectAll("p")
        .select("u.image as avatar")
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
        p.emergency_contact_name = await decrypt(p.emergency_contact_name as string, secret);
        p.emergency_contact_phone = await decrypt(p.emergency_contact_phone as string, secret);
        p.phone = await decrypt(p.phone as string, secret);
        p.contact_email = await decrypt(p.contact_email as string, secret);
        p.parents_name = await decrypt(p.parents_name as string, secret);
        p.parents_email = await decrypt(p.parents_email as string, secret);
        p.students_name = await decrypt(p.students_name as string, secret);
        p.students_email = await decrypt(p.students_email as string, secret);
      }

      return { 
        status: 200, 
        body: {
          ...p,
          member_type: String(p.member_type || "student"),
          first_name: String(p.first_name || ""),
          last_name: String(p.last_name || ""),
          nickname: String(p.nickname || ""),
          auth: { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role }
        } as any
      };
    } catch (_err) {
      return { status: 200, body: { auth: null, member_type: "student", first_name: "", last_name: "", nickname: "" } as any };
    }
  },
  updateMe: async ({ body }, c) => {
    const user = await getSessionUser(c);
    if (!user) return { status: 200, body: { success: false } };
    try {
      await upsertProfile(c as any, user.id, body);
      return { status: 200, body: { success: true } };
    } catch (_err) {
      return { status: 200, body: { success: false } };
    }
  },
  getTeamRoster: async (_, c) => {
    const db = c.get("db");
    try {
      const results = await db.selectFrom("user_profiles as p")
        .innerJoin("user as u", "p.user_id", "u.id")
        .where("p.show_on_about", "=", 1)
        .where("u.role", "!=", "unverified")
        .select([
          "p.user_id", "p.nickname", "p.bio", "p.pronouns", "p.subteams", "p.member_type",
          "p.favorite_first_thing", "p.fun_fact", "p.show_email", "p.contact_email",
          "p.favorite_robot_mechanism", "p.pre_match_superstition", "p.leadership_role",
          "p.rookie_year", "p.colleges", "p.employers",
          "u.image as avatar", "u.name"
        ])
        .execute();

      const members = await Promise.all((results || []).map(async (r) => {
        const row = r as Record<string, unknown>;
        const memberType = String(row.member_type || "student");
        if (row.contact_email && (memberType === "mentor" || memberType === "coach")) {
          row.contact_email = await decrypt(row.contact_email as string, c.env.ENCRYPTION_SECRET);
        }
        const sanitized = sanitizeProfileForPublic(row, memberType);
        return {
          ...sanitized,
          user_id: String(sanitized.user_id),
          nickname: sanitized.nickname || null,
          avatar: sanitized.avatar || null,
          member_type: String(sanitized.member_type || "student"),
          subteams: Array.isArray(sanitized.subteams) ? sanitized.subteams : [],
          colleges: Array.isArray(sanitized.colleges) ? sanitized.colleges : [],
          employers: Array.isArray(sanitized.employers) ? sanitized.employers : []
        };
      }));

      return { status: 200, body: { members: members as any[] } };
    } catch (_err) {
      return { status: 200, body: { members: [] } };
    }
  },
  getPublicProfile: async ({ params }, c) => {
    const { userId } = params;
    const db = c.get("db");
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

      if (!profileRow) return { status: 404, body: { error: "Profile not found" } };
      if (Number(profileRow.show_on_about || 0) !== 1) return { status: 403, body: { error: "This profile is private." } };

      const memberType = String(profileRow.member_type || "student");
      const sanitized = sanitizeProfileForPublic(profileRow as any, memberType) as Record<string, unknown>;

      const requester = await getSessionUser(c);
      const isAdmin = requester?.role === "admin" || requester?.role === "author" || requester?.member_type === "coach" || requester?.member_type === "mentor";
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

      return { status: 200, body: { profile: sanitized as any, badges: rawBadges as any[] } };
    } catch (_err) {
      return { status: 500, body: { error: "Profile fetch failed" } };
    }
  },
};

const profileTsRestRouter = s.router(profileContract, profileHandlers);
createHonoEndpoints(profileContract, profileTsRestRouter, profilesRouter);

profilesRouter.put("/avatar", rateLimitMiddleware(15, 60), async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  try {
    const body = await c.req.json();
    const { image } = body;
    const auth = getAuth(c.env.DB, c.env, c.req.url);
    await auth.api.updateUser({ headers: c.req.raw.headers, body: { image: image || null } });
    return c.json({ success: true });
  } catch (_err) {
    return c.json({ error: "Avatar update failed" }, 500);
  }
});

export default profilesRouter;
