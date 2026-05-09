import { typedHandler } from "../utils/handler";
import { ApiError } from "../middleware/errorHandler";
import { eq, desc, sql, and } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";

import {
  AppEnv,
  getSessionUser,
  sanitizeProfileForPublic,
  persistentRateLimitMiddleware,
  rateLimitMiddleware,
  ensureAuth,
  getDb,
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
  getPublicProfileByIdRoute,
  getPublicProfileRoute,
  updateAvatarRoute,
  profileMeSchema,
  rosterMemberSchema,
  MemberTypeEnum,
} from "../../../shared/routes/profiles";


const profilesRouter = new OpenAPIHono<AppEnv>();


// Apply edge caching to public GET routes only
// SECURITY: Never cache user-specific endpoints as this causes session bleeding
// CACHEABLE: /public/:userId (truly public, same data for all viewers)
// NOT CACHEABLE: /me (varies by authenticated user), /:userId (varies by requester's role)
profilesRouter.use("*", async (c, next) => {
  const path = c.req.path;
  if (c.req.method !== "GET") return next();

  // Skip caching for admin-only routes
  if (path.includes("/admin/") || path.includes("/signups") || path.includes("/history")) {
    return next();
  }

  // /me is user-specific (varies by authenticated user) - never cache
  if (path.includes("/me")) {
    return next();
  }

  // /public/:userId is truly public (same data for all viewers) - cache it
  if (path.startsWith("/public/")) {
    return edgeCacheMiddleware(180, 60, 300)(c, next);
  }

  // Legacy /:userId route varies by requester (admin/self see more data) - don't cache
  // We detect this by checking if path doesn't start with /public/ and doesn't match other routes
  if (path.match(/^\/[^/]+$/) && !path.startsWith("/team-roster") && !path.startsWith("/public/")) {
    return next();
  }

  // Only cache truly public, non-user-specific routes
  return edgeCacheMiddleware(180, 60, 300)(c, next);
});

// ─── Middleware Configuration ─────────────────────────────────────────────
// Apply rate limiting to public routes
profilesRouter.use("/team-roster", rateLimitMiddleware(100, 60));

profilesRouter.use("/:userId", rateLimitMiddleware(100, 60));

// Apply persistent rate limiting to write routes
profilesRouter.use("/update-me", persistentRateLimitMiddleware(10, 60));
profilesRouter.use("/avatar", persistentRateLimitMiddleware(15, 60));

// Input validation schema for profile updates
const updateUserProfileSchema = z
  .record(z.string(), z.any())
  .refine((data) => {
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
  const db = getDb(c);

    const profileRow = await db
      .select({
        userId: schema.userProfiles.userId,
        nickname: schema.userProfiles.nickname,
        firstName: schema.userProfiles.firstName,
        lastName: schema.userProfiles.lastName,
        bio: schema.userProfiles.bio,
        pronouns: schema.userProfiles.pronouns,
        subteams: schema.userProfiles.subteams,
        memberType: schema.userProfiles.memberType,
        gradeYear: schema.userProfiles.gradeYear,
        favoriteFood: schema.userProfiles.favoriteFood,
        dietaryRestrictions: schema.userProfiles.dietaryRestrictions,
        favoriteFirstThing: schema.userProfiles.favoriteFirstThing,
        funFact: schema.userProfiles.funFact,
        showEmail: schema.userProfiles.showEmail,
        contactEmail: schema.userProfiles.contactEmail,
        showPhone: schema.userProfiles.showPhone,
        phone: schema.userProfiles.phone,
        showOnAbout: schema.userProfiles.showOnAbout,
        favoriteRobotMechanism: schema.userProfiles.favoriteRobotMechanism,
        preMatchSuperstition: schema.userProfiles.preMatchSuperstition,
        leadershipRole: schema.userProfiles.leadershipRole,
        rookieYear: schema.userProfiles.rookieYear,
        colleges: schema.userProfiles.colleges,
        employers: schema.userProfiles.employers,
        tshirtSize: schema.userProfiles.tshirtSize,
        emergencyContactName: schema.userProfiles.emergencyContactName,
        emergencyContactPhone: schema.userProfiles.emergencyContactPhone,
        parentsName: schema.userProfiles.parentsName,
        parentsEmail: schema.userProfiles.parentsEmail,
        studentsName: schema.userProfiles.studentsName,
        studentsEmail: schema.userProfiles.studentsEmail,
        avatar: schema.user.image
      })
      .from(schema.userProfiles)
      .innerJoin(schema.user, eq(schema.userProfiles.userId, schema.user.id))
      .where(eq(schema.userProfiles.userId, user.id))
      .get();

    const p: Record<string, unknown> = {
      ...(profileRow || {
        userId: user.id,
        nickname: user.name || "",
        firstName: "",
        lastName: "",
        avatar: null,
        memberType: "student",
      }),
    };

    if (profileRow) {
      const secret = c.env.ENCRYPTION_SECRET;
      // W3A-SEC-03: Check for encryption marker before attempting decryption
      // Encrypted values have format "salt_hex:iv_hex:ciphertext_hex"
      const safeDecrypt = async (val: string | null) => {
        if (!val || !val.includes(":")) return val || null;
        try {
          return await decrypt(val as string, secret);
        } catch (err) {
          console.error("[Crypto] Decryption failed for field:", err);
          return "[Decryption Failed]";
        }
      };

      const [emergencyContactName, emergencyContactPhone, phone, contactEmail, parentsName, parentsEmail, studentsName, studentsEmail] =
        await Promise.all([
          safeDecrypt(p.emergencyContactName as string | null),
          safeDecrypt(p.emergencyContactPhone as string | null),
          safeDecrypt(p.phone as string | null),
          safeDecrypt(p.contactEmail as string | null),
          safeDecrypt(p.parentsName as string | null),
          safeDecrypt(p.parentsEmail as string | null),
          safeDecrypt(p.studentsName as string | null),
          safeDecrypt(p.studentsEmail as string | null),
        ]);

      p.emergencyContactName = emergencyContactName;
      p.emergencyContactPhone = emergencyContactPhone;
      p.phone = phone;
      p.contactEmail = contactEmail;
      p.parentsName = parentsName;
      p.parentsEmail = parentsEmail;
      p.studentsName = studentsName;
      p.studentsEmail = studentsEmail;
    }

    const response = c.json(
      {
        ...p,
        member_type: String(p.memberType || "student"),
        first_name: String(p.firstName || ""),
        last_name: String(p.lastName || ""),
        nickname: String(p.nickname || ""),
        auth: { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role },
      } as z.infer<typeof profileMeSchema>,
      200
    );
    // SECURITY: Never cache user-specific responses
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
}));

profilesRouter.openapi(updateMeRoute, typedHandler<typeof updateMeRoute>(async (c) => {
  const user = (await getSessionUser(c))!;
    const body = c.req.valid("json");
    const validationResult = updateUserProfileSchema.safeParse(body);
    if (!validationResult.success) {
      throw new ApiError(`Invalid profile data: ${validationResult.error.message}`, 400);
    }

    await upsertProfile(c, user.id, validationResult.data);
    return c.json({ success: true }, 200);
}));

profilesRouter.openapi(updateAvatarRoute, typedHandler<typeof updateAvatarRoute>(async (c) => {
    const body = c.req.valid("json");
    const image = (body as { image?: string | null }).image;
    const auth = getAuth(c.env.DB, c.env, c.req.url);
    await auth.api.updateUser({ headers: c.req.raw.headers, body: { image: image || null } });
    return c.json({ success: true }, 200);
}));

// ─── Public Routes ────────────────────────────────────────────────────────

profilesRouter.openapi(getTeamRosterRoute, typedHandler<typeof getTeamRosterRoute>(async (c) => {
  const db = getDb(c);
    const results = await db
      .select({
        userId: schema.userProfiles.userId,
        nickname: schema.userProfiles.nickname,
        bio: schema.userProfiles.bio,
        pronouns: schema.userProfiles.pronouns,
        subteams: schema.userProfiles.subteams,
        memberType: schema.userProfiles.memberType,
        favoriteFirstThing: schema.userProfiles.favoriteFirstThing,
        funFact: schema.userProfiles.funFact,
        showEmail: schema.userProfiles.showEmail,
        contactEmail: schema.userProfiles.contactEmail,
        favoriteRobotMechanism: schema.userProfiles.favoriteRobotMechanism,
        preMatchSuperstition: schema.userProfiles.preMatchSuperstition,
        leadershipRole: schema.userProfiles.leadershipRole,
        rookieYear: schema.userProfiles.rookieYear,
        colleges: schema.userProfiles.colleges,
        employers: schema.userProfiles.employers,
        avatar: schema.user.image,
        name: schema.user.name,
        role: schema.user.role
      })
      .from(schema.userProfiles)
      .innerJoin(schema.user, eq(schema.userProfiles.userId, schema.user.id))
      .where(and(
        eq(schema.userProfiles.showOnAbout, 1),
        sql`${schema.user.role} != 'unverified'`
      ))
      .all();

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
          const memberType = String(row.memberType || "student").toLowerCase();

          if (row.contactEmail && (memberType === "mentor" || memberType === "coach")) {
            row.contactEmail = await safeDecrypt(row.contactEmail as string | null);
          }

          // Convert back to snake_case for the sanitizer function
          const sanitized = sanitizeProfileForPublic({
            user_id: row.userId,
            nickname: row.nickname,
            bio: row.bio,
            pronouns: row.pronouns,
            subteams: row.subteams,
            member_type: row.memberType,
            favorite_first_thing: row.favoriteFirstThing,
            fun_fact: row.funFact,
            show_email: row.showEmail,
            contact_email: row.contactEmail,
            favorite_robot_mechanism: row.favoriteRobotMechanism,
            pre_match_superstition: row.preMatchSuperstition,
            leadership_role: row.leadershipRole,
            rookie_year: row.rookieYear,
            colleges: row.colleges,
            employers: row.employers,
            avatar: row.avatar,
            name: row.name,
            role: row.role
          }, memberType);
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
}));

// ─── Truly Public Profile (cacheable, no auth) ─────────────────────────────
// This endpoint is CDN-cacheable because it NEVER varies by the requester.
// Used for public pages, about page, member cards.
profilesRouter.openapi(getPublicProfileByIdRoute, typedHandler<typeof getPublicProfileByIdRoute>(async (c) => {
  const { userId } = c.req.valid("param");
  const db = getDb(c);

  const profileRow = await db
    .select({
      userId: schema.userProfiles.userId,
      nickname: schema.userProfiles.nickname,
      bio: schema.userProfiles.bio,
      pronouns: schema.userProfiles.pronouns,
      subteams: schema.userProfiles.subteams,
      memberType: schema.userProfiles.memberType,
      favoriteFirstThing: schema.userProfiles.favoriteFirstThing,
      funFact: schema.userProfiles.funFact,
      showEmail: schema.userProfiles.showEmail,
      contactEmail: schema.userProfiles.contactEmail,
      showPhone: schema.userProfiles.showPhone,
      phone: schema.userProfiles.phone,
      showOnAbout: schema.userProfiles.showOnAbout,
      favoriteRobotMechanism: schema.userProfiles.favoriteRobotMechanism,
      preMatchSuperstition: schema.userProfiles.preMatchSuperstition,
      leadershipRole: schema.userProfiles.leadershipRole,
      rookieYear: schema.userProfiles.rookieYear,
      colleges: schema.userProfiles.colleges,
      employers: schema.userProfiles.employers,
      gradeYear: schema.userProfiles.gradeYear,
      avatar: schema.user.image,
      name: schema.user.name,
      role: schema.user.role,
    })
    .from(schema.userProfiles)
    .leftJoin(schema.user, eq(schema.userProfiles.userId, schema.user.id))
    .where(eq(schema.userProfiles.userId, userId))
    .get();

  if (!profileRow) {
    throw new ApiError("Profile not found", 404);
  }

  // Respect user's privacy preference
  if (Number(profileRow.showOnAbout || 0) !== 1) {
    throw new ApiError("This profile is private.", 403);
  }

  const memberType = String(profileRow.memberType || "student");

  // Parse JSON arrays for subteams, colleges, employers
  const safeJSONParse = (val: unknown): unknown[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
      try { return JSON.parse(val); }
      catch { return []; }
    }
    return [];
  };

  const subteams = safeJSONParse(profileRow.subteams);
  const colleges = safeJSONParse(profileRow.colleges);
  const employers = safeJSONParse(profileRow.employers);

  // Build public-safe response using the same sanitization logic
  const publicProfile: z.infer<typeof rosterMemberSchema> = {
    user_id: profileRow.userId,
    nickname: profileRow.nickname || undefined,
    avatar: profileRow.avatar || undefined,
    pronouns: profileRow.pronouns || undefined,
    subteams: subteams as string[],
    member_type: memberType as z.infer<typeof MemberTypeEnum>,
    bio: profileRow.bio || undefined,
    fun_fact: profileRow.funFact || undefined,
    favorite_first_thing: profileRow.favoriteFirstThing || undefined,
    colleges: colleges as unknown[],
    employers: employers as unknown[],
    name: profileRow.name || undefined,
    role: profileRow.role || undefined,
    show_on_about: Number(profileRow.showOnAbout || 0) === 1,
    favorite_robot_mechanism: profileRow.favoriteRobotMechanism || undefined,
    pre_match_superstition: profileRow.preMatchSuperstition || undefined,
    leadership_role: profileRow.leadershipRole || undefined,
    rookie_year: profileRow.rookieYear ? String(profileRow.rookieYear) : undefined,
    favorite_food: undefined,
    grade_year: profileRow.gradeYear || undefined,
    // Mentors/coaches: show email/phone ONLY if they opted in
    email: (memberType === "mentor" || memberType === "coach") && Number(profileRow.showEmail || 0) === 1
      ? (profileRow.contactEmail || undefined)
      : undefined,
    phone: (memberType === "mentor" || memberType === "coach") && Number(profileRow.showPhone || 0) === 1
      ? (profileRow.phone || undefined)
      : undefined,
    show_email: Number(profileRow.showEmail || 0) === 1,
    show_phone: Number(profileRow.showPhone || 0) === 1,
    contact_email: undefined,
  };

  const response = c.json(publicProfile, 200);
  // CACHEABLE: This endpoint is safe to cache because it:
  // 1. Never varies by requester (no auth check)
  // 2. Always returns the same data for a given userId
  // 3. Only contains public-safe information
  response.headers.set("Cache-Control", "public, max-age=300, s-maxage=600, stale-while-revalidate=300");
  return response;
}));

profilesRouter.openapi(getPublicProfileRoute, typedHandler<typeof getPublicProfileRoute>(async (c) => {
  const { userId } = c.req.valid("param");
  const db = getDb(c);
    const profileRow = await db
      .select({
        userId: schema.userProfiles.userId,
        nickname: schema.userProfiles.nickname,
        bio: schema.userProfiles.bio,
        pronouns: schema.userProfiles.pronouns,
        subteams: schema.userProfiles.subteams,
        memberType: schema.userProfiles.memberType,
        favoriteFirstThing: schema.userProfiles.favoriteFirstThing,
        funFact: schema.userProfiles.funFact,
        showEmail: schema.userProfiles.showEmail,
        contactEmail: schema.userProfiles.contactEmail,
        showPhone: schema.userProfiles.showPhone,
        phone: schema.userProfiles.phone,
        showOnAbout: schema.userProfiles.showOnAbout,
        favoriteRobotMechanism: schema.userProfiles.favoriteRobotMechanism,
        preMatchSuperstition: schema.userProfiles.preMatchSuperstition,
        leadershipRole: schema.userProfiles.leadershipRole,
        rookieYear: schema.userProfiles.rookieYear,
        colleges: schema.userProfiles.colleges,
        employers: schema.userProfiles.employers,
        gradeYear: schema.userProfiles.gradeYear,
        avatar: schema.user.image,
        name: schema.user.name
      })
      .from(schema.userProfiles)
      .leftJoin(schema.user, eq(schema.userProfiles.userId, schema.user.id))
      .where(eq(schema.userProfiles.userId, userId))
      .get();

    if (!profileRow) throw new ApiError("Profile not found", 404);
    if (Number(profileRow.showOnAbout || 0) !== 1) throw new ApiError("This profile is private.", 403);

    const memberType = String(profileRow.memberType || "student");
    // Convert camelCase to snake_case for the sanitizer function
    const sanitized: Record<string, unknown> = sanitizeProfileForPublic({
      user_id: profileRow.userId,
      nickname: profileRow.nickname,
      bio: profileRow.bio,
      pronouns: profileRow.pronouns,
      subteams: profileRow.subteams,
      member_type: profileRow.memberType,
      favorite_first_thing: profileRow.favoriteFirstThing,
      fun_fact: profileRow.funFact,
      show_email: profileRow.showEmail,
      contact_email: profileRow.contactEmail,
      show_phone: profileRow.showPhone,
      phone: profileRow.phone,
      show_on_about: profileRow.showOnAbout,
      favorite_robot_mechanism: profileRow.favoriteRobotMechanism,
      pre_match_superstition: profileRow.preMatchSuperstition,
      leadership_role: profileRow.leadershipRole,
      rookie_year: profileRow.rookieYear,
      colleges: profileRow.colleges,
      employers: profileRow.employers,
      grade_year: profileRow.gradeYear,
      avatar: profileRow.avatar,
      name: profileRow.name
    }, memberType);

    const requester = await getSessionUser(c);
    const isAdmin = requester?.role === "admin" || requester?.member_type === "coach" || requester?.member_type === "mentor";
    const isSelf = requester?.id === userId;

    if (isAdmin || isSelf) {
      const sensitive = await db
        .select({
          emergencyContactName: schema.userProfiles.emergencyContactName,
          emergencyContactPhone: schema.userProfiles.emergencyContactPhone,
          dietaryRestrictions: schema.userProfiles.dietaryRestrictions,
          tshirtSize: schema.userProfiles.tshirtSize,
          phone: schema.userProfiles.phone,
          contactEmail: schema.userProfiles.contactEmail,
          parentsName: schema.userProfiles.parentsName,
          parentsEmail: schema.userProfiles.parentsEmail,
          studentsName: schema.userProfiles.studentsName,
          studentsEmail: schema.userProfiles.studentsEmail
        })
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.userId, userId))
        .get();

      if (sensitive) {
        const secret = c.env.ENCRYPTION_SECRET;
        // W3A-SEC-03: Helper to safely decrypt only if data has encryption marker
        const safeDecryptValue = async (val: string | null): Promise<string | null> => {
          if (!val || !val.includes(":")) return val || null;
          try {
            return await decrypt(val, secret);
          } catch (err) {
            console.error("[Profile:Decrypt] Error", err);
            return null;
          }
        };

        sanitized.emergency_contact_name = await safeDecryptValue(sensitive.emergencyContactName as string | null);
        sanitized.emergency_contact_phone = await safeDecryptValue(sensitive.emergencyContactPhone as string | null);
        sanitized.dietary_restrictions = sensitive.dietaryRestrictions;
        sanitized.tshirt_size = sensitive.tshirtSize;
        sanitized.phone = await safeDecryptValue(sensitive.phone as string | null);
        sanitized.contact_email = await safeDecryptValue(sensitive.contactEmail as string | null);
        sanitized.parents_name = await safeDecryptValue(sensitive.parentsName as string | null);
        sanitized.parents_email = await safeDecryptValue(sensitive.parentsEmail as string | null);
        sanitized.students_name = await safeDecryptValue(sensitive.studentsName as string | null);
        sanitized.students_email = await safeDecryptValue(sensitive.studentsEmail as string | null);
      }
    }

    const rawBadges = await db
      .select({
        id: schema.badges.id,
        name: schema.badges.name,
        description: schema.badges.description,
        icon: schema.badges.icon,
        colorTheme: schema.badges.colorTheme,
        createdAt: schema.badges.createdAt
      })
      .from(schema.badges)
      .innerJoin(schema.userBadges, eq(schema.badges.id, schema.userBadges.badgeId))
      .where(eq(schema.userBadges.userId, userId))
      .orderBy(desc(schema.userBadges.awardedAt))
      .all();

    return c.json({ profile: sanitized, badges: rawBadges }, 200);
}));

export default profilesRouter;
