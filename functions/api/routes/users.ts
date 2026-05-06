/* User management route handlers */
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
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

type AppRouteHandler<T extends RouteConfig> = RouteHandler<T, AppEnv>;

export const usersRouter = new OpenAPIHono<AppEnv>();

// CR-07 FIX: Apply authentication to all admin routes
usersRouter.use("/admin/*", ensureAdmin);

usersRouter.openapi(getUsersRoute, (async (c) => {
  try {
    const db = c.get("db") as Kysely<DB>;
    const { limit, cursor } = parsePagination(c, 50, 100);

    let dbQuery = db
      .selectFrom("user as u")
      .leftJoin("user_profiles as p", "u.id", "p.user_id")
      .select([
        "u.id",
        "u.name",
        "u.email",
        "u.emailVerified",
        "u.image",
        "u.role",
        "u.createdAt",
        "u.updatedAt",
        "p.nickname",
        "p.member_type",
      ])
      .orderBy("u.createdAt", "desc")
      .limit(limit);

    if (cursor) {
      dbQuery = dbQuery.where("u.createdAt", "<", Number(cursor));
    }

    const results = await dbQuery.execute();

    const users = results.map((u) => {
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
        nickname: u.nickname || null,
        member_type:
          (u.member_type as
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
  } catch {
    return c.json({ error: "Database error" }, 500);
  }
}) as AppRouteHandler<typeof getUsersRoute>);

usersRouter.openapi(adminDetailRoute, (async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = c.get("db") as Kysely<DB>;
    const row = await db
      .selectFrom("user as u")
      .leftJoin("user_profiles as p", "u.id", "p.user_id")
      .select([
        "u.id",
        "u.name",
        "u.email",
        "u.emailVerified",
        "u.image",
        "u.role",
        "u.createdAt",
        "u.updatedAt",
        "p.nickname",
        "p.member_type",
      ])
      .where("u.id", "=", id)
      .executeTakeFirst();

    if (!row) return c.json({ error: "User not found" }, 404);

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
          nickname: (row.nickname as string | null) || null,
          member_type: row.member_type as string | null,
        },
      },
      200
    );
  } catch {
    return c.json({ error: "Database error" }, 500);
  }
}) as AppRouteHandler<typeof adminDetailRoute>);

usersRouter.openapi(patchUserRoute, (async (c) => {
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

    const db = c.get("db") as Kysely<DB>;

    if (role) {
      await db
        .updateTable("user")
        .set({ role })
        .where("id", "=", id)
        .execute();
      // Invalidate all sessions for the user to force re-auth with new role
      await db.deleteFrom("session").where("userId", "=", id).execute();
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
      const existing = await db
        .selectFrom("user_profiles")
        .select("user_id")
        .where("user_id", "=", id)
        .executeTakeFirst();

      if (existing) {
        await db
          .updateTable("user_profiles")
          .set({ member_type })
          .where("user_id", "=", id)
          .execute();
      } else {
        await db
          .insertInto("user_profiles")
          .values({ user_id: id, member_type })
          .execute();
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
}) as AppRouteHandler<typeof patchUserRoute>);

usersRouter.openapi(updateUserProfileRoute, (async (c) => {
  try {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    await upsertProfile(c, id, body as Record<string, unknown>);
    return c.json({ success: true }, 200);
  } catch {
    return c.json({ error: "Profile update failed" }, 500);
  }
}) as AppRouteHandler<typeof updateUserProfileRoute>);

usersRouter.openapi(adminGetProfileRoute, (async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = c.get("db") as Kysely<DB>;
    const user = await db
      .selectFrom("user")
      .select(["id", "name", "email", "image", "role"])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!user) return c.json({ error: "User not found" }, 404);

    const profileRow = await db
      .selectFrom("user_profiles as p")
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
      ])
      .where("p.user_id", "=", id)
      .executeTakeFirst();

    const p = {
      ...(profileRow || {
        user_id: user.id,
        nickname: user.name || "",
        first_name: "",
        last_name: "",
        member_type: "student",
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
        emergency_contact_name,
        emergency_contact_phone,
        phone,
        contact_email,
        parents_name,
        parents_email,
        students_name,
        students_email,
      ] = await Promise.all([
        safeDecrypt(p.emergency_contact_name),
        safeDecrypt(p.emergency_contact_phone),
        safeDecrypt(p.phone),
        safeDecrypt(p.contact_email),
        safeDecrypt(p.parents_name),
        safeDecrypt(p.parents_email),
        safeDecrypt(p.students_name),
        safeDecrypt(p.students_email),
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
        profile: {
          ...p,
          member_type: String(p.member_type || "student"),
          first_name: String(p.first_name || ""),
          last_name: String(p.last_name || ""),
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
}) as AppRouteHandler<typeof adminGetProfileRoute>);

usersRouter.openapi(deleteUserRoute, (async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = c.get("db") as Kysely<DB>;

    // Atomicity Fix: Delete all related records in parallel, then the user
    await Promise.all([
      db.deleteFrom("comments").where("user_id", "=", id).execute(),
      db.deleteFrom("event_signups").where("user_id", "=", id).execute(),
      db.deleteFrom("user_badges").where("user_id", "=", id).execute(),
      db.deleteFrom("user_profiles").where("user_id", "=", id).execute(),
      db.deleteFrom("session").where("userId", "=", id).execute(),
      db.deleteFrom("account").where("userId", "=", id).execute(),
    ]);

    await db.deleteFrom("user").where("id", "=", id).execute();

    c.executionCtx.waitUntil(
      logAuditAction(c, "DELETE_USER", "user", id, `Deleted user ${id}`)
    );

    return c.json({ success: true }, 200);
  } catch (e: unknown) {
    console.error("Delete user failed:", e);
    return c.json({ error: "Delete failed" }, 500);
  }
}) as AppRouteHandler<typeof deleteUserRoute>);

export default usersRouter;
