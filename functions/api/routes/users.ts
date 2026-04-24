import { Hono, Context } from "hono";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { userContract } from "../../../src/schemas/contracts/userContract";
import { AppEnv, ensureAdmin, logAuditAction } from "../middleware";
import { upsertProfile } from "./_profileUtils";
import { Kysely } from "kysely";
import { DB } from "../../../src/schemas/database";

const s = initServer<AppEnv>();
export const usersRouter = new Hono<AppEnv>();

const userHandlers = {
  getUsers: async ({ query }: { query: any }, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const { limit = 50, offset = 0 } = query;
      const results = await db.selectFrom("user as u")
        .leftJoin("user_profiles as p", "u.id", "p.user_id")
        .select([
          "u.id", "u.name", "u.email", "u.emailVerified", "u.image", "u.role", "u.createdAt", "u.updatedAt",
          "p.nickname", "p.member_type"
        ])
        .orderBy("u.createdAt", "desc")
        .limit(limit || 50)
        .offset(offset || 0)
        .execute();

      const users = results.map((u) => {
        const isStudent = u.member_type === "student" || u.role === "user";
        const maskedEmail = isStudent 
          ? u.email.replace(/(.{2})(.*)(?=@)/, (_, a, b) => `${a}${"*".repeat(b.length)}`)
          : u.email;

        return {
          id: String(u.id),
          name: u.name || null,
          email: maskedEmail,
          emailVerified: !!u.emailVerified,
          image: u.image || null,
          role: u.role || "user",
          createdAt: Number(u.createdAt),
          updatedAt: Number(u.updatedAt),
          nickname: u.nickname || null,
          member_type: u.member_type || null
        };
      });

      return { status: 200 as const, body: { users } as any };
    } catch (_err) {
      return { status: 500 as const, body: { error: "Database error" } as any };
    }
  },
  adminDetail: async ({ params }: { params: any }, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const row = await db.selectFrom("user as u")
        .leftJoin("user_profiles as p", "u.id", "p.user_id")
        .select([
          "u.id", "u.name", "u.email", "u.emailVerified", "u.image", "u.role", "u.createdAt", "u.updatedAt",
          "p.nickname", "p.member_type"
        ])
        .where("u.id", "=", params.id)
        .executeTakeFirst();

      if (!row) return { status: 404 as const, body: { error: "User not found" } as any };

      return { 
        status: 200 as const, 
        body: { 
          user: {
            id: String(row.id),
            name: row.name || null,
            email: row.email,
            emailVerified: !!row.emailVerified,
            image: row.image || null,
            role: row.role || "user",
            createdAt: Number(row.createdAt),
            updatedAt: Number(row.updatedAt),
            nickname: row.nickname || null,
            member_type: row.member_type || null
          }
        } as any
      };
    } catch (_err) {
      return { status: 500 as const, body: { error: "Database error" } as any };
    }
  },
  patchUser: async ({ params, body }: { params: any, body: any }, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const { role, member_type } = body;

      if (role) {
        await db.updateTable("user").set({ role }).where("id", "=", params.id).execute();
        await db.deleteFrom("session").where("userId", "=", params.id).execute();
      }
      if (member_type) {
        await db.insertInto("user_profiles")
          .values({ user_id: params.id, member_type })
          .onConflict((oc) => oc.column("user_id").doUpdateSet({ member_type }))
          .execute();
      }

      c.executionCtx.waitUntil(logAuditAction(c, "PATCH_USER", "user", params.id, `Updated user ${params.id}: role=${role}, type=${member_type}`));

      return { status: 200 as const, body: { success: true } as any };
    } catch (_err) {
      return { status: 500 as const, body: { error: "Update failed" } as any };
    }
  },
  updateUserProfile: async ({ params, body }: { params: any, body: any }, c: Context<AppEnv>) => {
    try {
      await upsertProfile(c as any, params.id, body as any);
      return { status: 200 as const, body: { success: true } as any };
    } catch (_err) {
      return { status: 500 as const, body: { error: "Profile update failed" } as any };
    }
  },
  deleteUser: async ({ params }: { params: any }, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const id = params.id;
      
      await db.deleteFrom("comments").where("user_id", "=", id).execute();
      await db.deleteFrom("event_signups").where("user_id", "=", id).execute();
      await db.deleteFrom("user_badges").where("user_id", "=", id).execute();
      await db.deleteFrom("user_profiles").where("user_id", "=", id).execute();
      await db.deleteFrom("session").where("userId", "=", id).execute();
      await db.deleteFrom("account").where("userId", "=", id).execute();
      await db.deleteFrom("user").where("id", "=", id).execute();

      c.executionCtx.waitUntil(logAuditAction(c, "DELETE_USER", "user", id, `Deleted user ${id}`));

      return { status: 200 as const, body: { success: true } as any };
    } catch (_err) {
      return { status: 500 as const, body: { error: "Delete failed" } as any };
    }
  },
};

const userTsRestRouter = s.router(userContract, userHandlers as any);

usersRouter.use("/*", ensureAdmin);

createHonoEndpoints(userContract, userTsRestRouter, usersRouter);

export default usersRouter;
