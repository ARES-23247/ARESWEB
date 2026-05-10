import { ApiError } from "../middleware/errorHandler";
/* User management route handlers */
import { OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import * as schema from "../../../src/db/schema";

import { AppEnv, ensureAdmin, logAuditAction, parsePagination, getDb } from "../middleware";
import { upsertProfile } from "./_profileUtils";
import { decrypt } from "../../utils/crypto";
import {
  getUsersRoute,
  adminDetailRoute,
  patchUserRoute,
  updateUserProfileRoute,
  adminGetProfileRoute,
  deleteUserRoute,
  UserRoleEnum,
  MemberTypeEnum,
} from "../../../shared/routes/users";
import { queryHelpers } from "@/db/query-helpers";

export const usersRouter = new OpenAPIHono<AppEnv>();

// CR-07 FIX: Apply authentication to all admin routes
usersRouter.use("/admin/*", ensureAdmin);

usersRouter.openapi(getUsersRoute, async (c) => {
    const db = getDb(c);
    const { limit, cursor } = parsePagination(c, 50, 100);

    // Use query helper for users with profiles
    const results = await queryHelpers.getUsersWithProfiles(db, limit + 1, cursor || undefined);

    // Determine if there's a next page
    const hasNextPage = results.length > limit;
    const usersData = hasNextPage ? results.slice(0, limit) : results;

    const users = usersData.map((u) => ({
      id: String(u.id),
      name: u.name || null,
      email: u.email,
      emailVerified: !!u.emailVerified,
      image: u.image || null,
      role: String(u.role || "user"),
      createdAt:
        u.createdAt instanceof Date
          ? u.createdAt.getTime()
          : typeof u.createdAt === "number"
          ? u.createdAt
          : new Date(u.createdAt as unknown as string).getTime() || 0,
      updatedAt:
        u.updatedAt instanceof Date
          ? u.updatedAt.getTime()
          : typeof u.updatedAt === "number"
          ? u.updatedAt
          : new Date(u.updatedAt as unknown as string).getTime() || 0,
      nickname: u.nickname || null,
      memberType: (u.memberType as
        | "student"
        | "mentor"
        | "coach"
        | "parent"
        | "alumnus"
        | "alumni"
        | "sponsor"
        | "other" | null) || null,
    }));

    const nextCursor =
      hasNextPage && usersData.length > 0
        ? String(usersData[usersData.length - 1].createdAt instanceof Date
          ? usersData[usersData.length - 1].createdAt.getTime()
          : usersData[usersData.length - 1].createdAt)
        : null;

    // Response boundary: Drizzle return type diverges from Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json({ users, nextCursor } as any, 200);
});

usersRouter.openapi(adminDetailRoute, async (c) => {
    const params = c.req.valid("param");
    const { id } = params;
    const db = getDb(c);
    
    // Manual left join to get user with profile
    const row = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        emailVerified: schema.user.emailVerified,
        image: schema.user.image,
        role: schema.user.role,
        createdAt: schema.user.createdAt,
        updatedAt: schema.user.updatedAt,
        nickname: schema.userProfiles.nickname,
        memberType: schema.userProfiles.memberType,
      })
      .from(schema.user)
      .leftJoin(schema.userProfiles, eq(schema.user.id, schema.userProfiles.userId))
      .where(eq(schema.user.id, id))
      .limit(1);

    if (!row || row.length === 0) throw new ApiError("User not found", 404);

    const user = row[0];

    return c.json(
      {
        user: {
          id: String(user.id),
          name: user.name || null,
          email: user.email,
          emailVerified: !!user.emailVerified,
          image: user.image || null,
          role: String(user.role || "user"),
          createdAt:
            user.createdAt instanceof Date
              ? user.createdAt.getTime()
              : typeof user.createdAt === "number"
              ? user.createdAt
              : new Date(user.createdAt as unknown as string).getTime(),
          updatedAt:
            user.updatedAt instanceof Date
              ? user.updatedAt.getTime()
              : typeof user.updatedAt === "number"
              ? user.updatedAt
              : new Date(user.updatedAt as unknown as string).getTime(),
          nickname: user.nickname || null,
          memberType: user.memberType as "student" | "parent" | "mentor" | "coach" | "sponsor" | "alumnus" | "alumni" | "other" | null,
        },
      // Response boundary: Drizzle return type diverges from Zod schema
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      200
    );
});

usersRouter.openapi(patchUserRoute, async (c) => {
    const params = c.req.valid("param");
    const body = c.req.valid("json");
    // Defense-in-depth: Re-validate admin authorization for sensitive role changes
    const sessionUser = c.get("sessionUser") as
      | { id: string; role: string }
      | undefined;
    if (!sessionUser || sessionUser.role !== "admin") {
      throw new ApiError("Forbidden: Admin required", 403);
    }

    const { id } = params;

    // Validate role and memberType against enums
    const { role, memberType } = body;

    if (role && !UserRoleEnum.safeParse(role).success) {
      throw new ApiError("Invalid role value", 400);
    }

    if (memberType && !MemberTypeEnum.safeParse(memberType).success) {
      throw new ApiError("Invalid memberType value", 400);
    }

    const db = getDb(c);

    if (role) {
      await db
        .update(schema.user)
        .set({ role })
        .where(eq(schema.user.id, id));
      // Invalidate all sessions for the user to force re-auth with new role
      await db.delete(schema.session).where(eq(schema.session.userId, id));
      // IN-08: Audit log role changes
      c.executionCtx.waitUntil(
        logAuditAction(c, "UPDATE_ROLE", "user", id, `Changed role to ${role}`)
      );
    }
    // WR-14: Document session invalidation behavior
    // Note: memberType changes do NOT invalidate sessions currently.
    // This is intentional as memberType is less security-critical than role.
    // If this changes, add session deletion here similar to role changes above.
    if (memberType) {
      const existing = await db
        .select({ userId: schema.userProfiles.userId })
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.userId, id))
        .limit(1);

      if (existing && existing.length > 0) {
        await db
          .update(schema.userProfiles)
          .set({ memberType: memberType })
          .where(eq(schema.userProfiles.userId, id));
      } else {
        await db
          .insert(schema.userProfiles)
          .values({ userId: id, memberType: memberType });
      }
    }

    c.executionCtx.waitUntil(
      logAuditAction(
        c,
        "PATCH_USER",
        "user",
        id,
        `Updated user ${id}: role=${role}, type=${memberType}`
      )
    );

    // Response boundary: Drizzle return type diverges from Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json({ success: true } as any, 200);
});

usersRouter.openapi(updateUserProfileRoute, async (c) => {
    const params = c.req.valid("param");
    const body = c.req.valid("json");
    const { id } = params;
    await upsertProfile(c, id, body);
    // Response boundary: Drizzle return type diverges from Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json({ success: true } as any, 200);
});

usersRouter.openapi(adminGetProfileRoute, async (c) => {
    const params = c.req.valid("param");
    const { id } = params;
    const db = getDb(c);

    // Get user
    const userResult = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        image: schema.user.image,
        role: schema.user.role,
      })
      .from(schema.user)
      .where(eq(schema.user.id, id))
      .limit(1);

    const user = userResult?.[0];
    if (!user) throw new ApiError("User not found", 404);

    // Get profile
    const profileResult = await db
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
      })
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, id))
      .limit(1);

    const profileRow = profileResult?.[0];

    const p = {
      ...(profileRow || {
        userId: user.id,
        nickname: user.name || "",
        firstName: "",
        lastName: "",
        memberType: "student",
      }),
    } as Record<string, unknown>;

    if (profileRow) {
      const secret = c.env.ENCRYPTION_SECRET;
      const safeDecrypt = async (val: unknown) => {
        if (!val) return null;
        try {
          return await decrypt(val as string, secret);
        } catch (err) {
          console.error("[Crypto] Decryption failed for field:", err);
          return "[Decryption Failed]";
        }
      };

      const [
        emergencyContactName,
        emergencyContactPhone,
        phone,
        contactEmail,
        parentsName,
        parentsEmail,
        studentsName,
        studentsEmail,
      ] = await Promise.all([
        safeDecrypt(p.emergencyContactName),
        safeDecrypt(p.emergencyContactPhone),
        safeDecrypt(p.phone),
        safeDecrypt(p.contactEmail),
        safeDecrypt(p.parentsName),
        safeDecrypt(p.parentsEmail),
        safeDecrypt(p.studentsName),
        safeDecrypt(p.studentsEmail),
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

    return c.json(
      {
        profile: {
          ...p,
          memberType: String(p.memberType || "student"),
          firstName: String(p.firstName || ""),
          lastName: String(p.lastName || ""),
          nickname: String(p.nickname || ""),
          auth: {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: String(user.role || "user"),
          },
        } as Record<string, unknown>,
      // Response boundary: Drizzle return type diverges from Zod schema
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      200
    );
});

usersRouter.openapi(deleteUserRoute, async (c) => {
    const params = c.req.valid("param");
    const { id } = params;
    const db = getDb(c);

    // Atomicity Fix: Delete all related records in parallel, then the user
    await Promise.all([
      db.delete(schema.comments).where(eq(schema.comments.userId, id)),
      db.delete(schema.eventSignups).where(eq(schema.eventSignups.userId, id)),
      db.delete(schema.userBadges).where(eq(schema.userBadges.userId, id)),
      db.delete(schema.userProfiles).where(eq(schema.userProfiles.userId, id)),
      db.delete(schema.session).where(eq(schema.session.userId, id)),
      db.delete(schema.account).where(eq(schema.account.userId, id)),
    ]);

    await db.delete(schema.user).where(eq(schema.user.id, id));

    c.executionCtx.waitUntil(
      logAuditAction(c, "DELETE_USER", "user", id, `Deleted user ${id}`)
    );

    // Response boundary: Drizzle return type diverges from Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json({ success: true } as any, 200);
});

export default usersRouter;

