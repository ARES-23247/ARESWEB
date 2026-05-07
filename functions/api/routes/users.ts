/* eslint-disable @typescript-eslint/no-explicit-any */
import { typedHandler } from "../utils/handler";
/* User management route handlers */
import { OpenAPIHono } from "@hono/zod-openapi";
import { eq, desc, lt } from "drizzle-orm";
import * as schema from "../../../src/db/schema";

import { AppEnv, ensureAdmin, logAuditAction, parsePagination } from "../middleware";
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

export const usersRouter = new OpenAPIHono<AppEnv>();

// CR-07 FIX: Apply authentication to all admin routes
usersRouter.use("/admin/*", ensureAdmin);

usersRouter.openapi(getUsersRoute, typedHandler<typeof getUsersRoute>(async (c) => {
  try {
    const db = c.get("db") as any;
    const { limit, cursor } = parsePagination(c, 50, 100);

    const results = await db.query.user.findMany({
      columns: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        userProfiles: {
          columns: {
            nickname: true,
            memberType: true,
          }
        }
      },
      orderBy: [desc(schema.user.createdAt)],
      limit: limit,
      where: cursor ? lt(schema.user.createdAt, Number(cursor)) : undefined
    });

    const users = results.map((u: any) => {
      const profile = u.userProfiles?.[0];
      return {
        id: String(u.id),
        name: u.name || null,
        email: u.email,
        emailVerified: !!u.emailVerified,
        image: u.image || null,
        role: String(u.role || "user"),
        createdAt:
          typeof u.createdAt === "number"
            ? u.createdAt
            : new Date(u.createdAt as string).getTime() || 0,
        updatedAt:
          typeof u.updatedAt === "number"
            ? u.updatedAt
            : new Date(u.updatedAt as string).getTime() || 0,
        nickname: profile?.nickname || null,
        member_type:
          (profile?.memberType as
            | "student"
            | "mentor"
            | "coach"
            | "parent"
            | "alumnus"
            | "alumni"
            | "sponsor"
            | "other") || null,
      };
    });

    const nextCursor =
      results.length === limit
        ? String(results[results.length - 1].createdAt)
        : null;

    return c.json({ users, nextCursor }, 200);
  } catch (e) {
    console.error("getUsers failed:", e);
    return c.json({ error: "Database error" }, 500);
  }
}));

usersRouter.openapi(adminDetailRoute, typedHandler<typeof adminDetailRoute>(async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = c.get("db") as any;
    
    const row = await db.query.user.findFirst({
      columns: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        userProfiles: {
          columns: {
            nickname: true,
            memberType: true,
          }
        }
      },
      where: eq(schema.user.id, id)
    });

    if (!row) return c.json({ error: "User not found" }, 404);

    const profile = row.userProfiles?.[0];

    return c.json(
      {
        user: {
          id: String(row.id),
          name: row.name || null,
          email: row.email,
          emailVerified: !!row.emailVerified,
          image: row.image || null,
          role: String(row.role || "user"),
          createdAt:
            typeof row.createdAt === "number"
              ? row.createdAt
              : new Date(row.createdAt as string).getTime(),
          updatedAt:
            typeof row.updatedAt === "number"
              ? row.updatedAt
              : new Date(row.updatedAt as string).getTime(),
          nickname: (profile?.nickname as string | null) || null,
          member_type: profile?.memberType as any,
        },
      },
      200
    );
  } catch (e) {
    console.error("adminDetail failed:", e);
    return c.json({ error: "Database error" }, 500);
  }
}));

usersRouter.openapi(patchUserRoute, typedHandler<typeof patchUserRoute>(async (c) => {
  try {
    // Defense-in-depth: Re-validate admin authorization for sensitive role changes
    const sessionUser = c.get("sessionUser") as
      | { id: string; role: string }
      | undefined;
    if (!sessionUser || sessionUser.role !== "admin") {
      return c.json({ error: "Forbidden: Admin required" }, 403);
    }

    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    // Validate role and member_type against enums
    const { role, member_type } = body as {
      role?: string;
      member_type?: string;
    };

    if (role && !UserRoleEnum.safeParse(role).success) {
      return c.json({ error: "Invalid role value" }, 400);
    }

    if (member_type && !MemberTypeEnum.safeParse(member_type).success) {
      return c.json({ error: "Invalid member_type value" }, 400);
    }

    const db = c.get("db") as any;

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
    // Note: member_type changes do NOT invalidate sessions currently.
    // This is intentional as member_type is less security-critical than role.
    // If this changes, add session deletion here similar to role changes above.
    if (member_type) {
      const existing = await db.query.userProfiles.findFirst({
        columns: { userId: true },
        where: eq(schema.userProfiles.userId, id)
      });

      if (existing) {
        await db
          .update(schema.userProfiles)
          .set({ memberType: member_type })
          .where(eq(schema.userProfiles.userId, id));
      } else {
        await db
          .insert(schema.userProfiles)
          .values({ userId: id, memberType: member_type });
      }
    }

    c.executionCtx.waitUntil(
      logAuditAction(
        c,
        "PATCH_USER",
        "user",
        id,
        `Updated user ${id}: role=${role}, type=${member_type}`
      )
    );

    return c.json({ success: true }, 200);
  } catch (e: unknown) {
    console.error("patchUser failed:", e);
    return c.json(
      { error: "Update failed: " + (e instanceof Error ? e.message : "Unknown error") },
      500
    );
  }
}));

usersRouter.openapi(updateUserProfileRoute, typedHandler<typeof updateUserProfileRoute>(async (c) => {
  try {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    await upsertProfile(c, id, body as Record<string, unknown>);
    return c.json({ success: true }, 200);
  } catch {
    return c.json({ error: "Profile update failed" }, 500);
  }
}));

usersRouter.openapi(adminGetProfileRoute, typedHandler<typeof adminGetProfileRoute>(async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = c.get("db") as any;
    
    const user = await db.query.user.findFirst({
      columns: { id: true, name: true, email: true, image: true, role: true },
      where: eq(schema.user.id, id)
    });
    
    if (!user) return c.json({ error: "User not found" }, 404);

    const profileRow = await db.query.userProfiles.findFirst({
      columns: {
        userId: true,
        nickname: true,
        firstName: true,
        lastName: true,
        bio: true,
        pronouns: true,
        subteams: true,
        memberType: true,
        gradeYear: true,
        favoriteFood: true,
        dietaryRestrictions: true,
        favoriteFirstThing: true,
        funFact: true,
        showEmail: true,
        contactEmail: true,
        showPhone: true,
        phone: true,
        showOnAbout: true,
        favoriteRobotMechanism: true,
        preMatchSuperstition: true,
        leadershipRole: true,
        rookieYear: true,
        colleges: true,
        employers: true,
        tshirtSize: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        parentsName: true,
        parentsEmail: true,
        studentsName: true,
        studentsEmail: true,
      },
      where: eq(schema.userProfiles.userId, id)
    });

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
          member_type: String(p.memberType || "student"),
          first_name: String(p.firstName || ""),
          last_name: String(p.lastName || ""),
          nickname: String(p.nickname || ""),
          auth: {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: String(user.role || "user"),
          },
        } as Record<string, unknown>,
      },
      200
    );
  } catch (err) {
    console.error("[Admin:GetProfile] Error", err);
    return c.json({ error: "Failed to fetch user profile" }, 500);
  }
}));

usersRouter.openapi(deleteUserRoute, typedHandler<typeof deleteUserRoute>(async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = c.get("db") as any;

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

    return c.json({ success: true }, 200);
  } catch (e: unknown) {
    console.error("Delete user failed:", e);
    return c.json({ error: "Delete failed" }, 500);
  }
}));

export default usersRouter;
