import { Hono, Context } from "hono";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { userContract } from "../../../shared/schemas/contracts/userContract";
import { AppEnv, ensureAdmin, logAuditAction, parsePagination } from "../middleware";
import { upsertProfile } from "./_profileUtils";
import { decrypt } from "../../utils/crypto";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";

const s = initServer<AppEnv>();
export const usersRouter = new Hono<AppEnv>();

const userHandlers = {
  getUsers: async ({ query: _query }: { query: any }, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const { limit, offset } = parsePagination(c, 50, 100);
      const results = await db.selectFrom("user as u")
        .leftJoin("user_profiles as p", "u.id", "p.user_id")
        .select([
          "u.id", "u.name", "u.email", "u.emailVerified", "u.image", "u.role", "u.createdAt", "u.updatedAt",
          "p.nickname", "p.member_type"
        ])
        .orderBy("u.createdAt", "desc")
        .limit(limit)
        .offset(offset)
        .execute();

      const users = results.map((u) => {
        return {
          id: String(u.id),
          name: u.name || null,
          email: u.email,
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
    } catch {
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
    } catch {
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
        const existing = await db.selectFrom("user_profiles")
          .select("user_id")
          .where("user_id", "=", params.id)
          .executeTakeFirst();
        
        if (existing) {
          await db.updateTable("user_profiles")
            .set({ member_type })
            .where("user_id", "=", params.id)
            .execute();
        } else {
          await db.insertInto("user_profiles")
            .values({ user_id: params.id, member_type })
            .execute();
        }
      }

      c.executionCtx.waitUntil(logAuditAction(c, "PATCH_USER", "user", params.id, `Updated user ${params.id}: role=${role}, type=${member_type}`));

      return { status: 200 as const, body: { success: true } as any };
    } catch (e: any) {
      console.error("patchUser failed:", e);
      return { status: 500 as const, body: { error: "Update failed: " + (e.message || "Unknown error") } as any };
    }
  },
  updateUserProfile: async ({ params, body }: { params: any, body: any }, c: Context<AppEnv>) => {
    try {
      await upsertProfile(c as any, params.id, body as any);
      return { status: 200 as const, body: { success: true } as any };
    } catch {
      return { status: 500 as const, body: { error: "Profile update failed" } as any };
    }
  },
  adminGetProfile: async ({ params }: { params: any }, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await db.selectFrom("user").select(["id", "name", "email", "image", "role"]).where("id", "=", params.id).executeTakeFirst();
      if (!user) return { status: 404 as const, body: { error: "User not found" } as any };

      const profileRow = await db.selectFrom("user_profiles as p")
        .select([
          "p.user_id", "p.nickname", "p.first_name", "p.last_name", "p.bio", "p.pronouns", 
          "p.subteams", "p.member_type", "p.grade_year", "p.favorite_food", "p.dietary_restrictions",
          "p.favorite_first_thing", "p.fun_fact", "p.show_email", "p.contact_email", "p.show_phone", "p.phone",
          "p.show_on_about", "p.favorite_robot_mechanism", "p.pre_match_superstition", "p.leadership_role",
          "p.rookie_year", "p.colleges", "p.employers", "p.tshirt_size",
          "p.emergency_contact_name", "p.emergency_contact_phone", 
          "p.parents_name", "p.parents_email", "p.students_name", "p.students_email"
        ])
        .where("p.user_id", "=", params.id)
        .executeTakeFirst();

      const p = { 
        ...(profileRow || {
          user_id: user.id,
          nickname: user.name || "",
          first_name: "",
          last_name: "",
          member_type: "student",
        })
      } as Record<string, unknown>;

      if (profileRow) {
        const secret = c.env.ENCRYPTION_SECRET;
        const safeDecrypt = async (val: any) => {
          if (!val) return null;
          try {
            return await decrypt(val as string, secret);
          } catch (err) {
            console.error("[Crypto] Decryption failed for field:", err);
            return "[Decryption Failed]";
          }
        };

        const [
          emergency_contact_name, emergency_contact_phone, phone, contact_email,
          parents_name, parents_email, students_name, students_email
        ] = await Promise.all([
          safeDecrypt(p.emergency_contact_name), safeDecrypt(p.emergency_contact_phone),
          safeDecrypt(p.phone), safeDecrypt(p.contact_email),
          safeDecrypt(p.parents_name), safeDecrypt(p.parents_email),
          safeDecrypt(p.students_name), safeDecrypt(p.students_email)
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
          profile: {
            ...p,
            member_type: String(p.member_type || "student"),
            first_name: String(p.first_name || ""),
            last_name: String(p.last_name || ""),
            nickname: String(p.nickname || ""),
            auth: { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role }
          }
        } as any
      };
    } catch (err) {
      console.error("[Admin:GetProfile] Error", err);
      return { status: 500 as const, body: { error: "Failed to fetch user profile" } as any };
    }
  },
  deleteUser: async ({ params }: { params: any }, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const id = params.id;
      
      // Atomicity Fix: Delete all related records in parallel, then the user
      await Promise.all([
        db.deleteFrom("comments").where("user_id", "=", id).execute(),
        db.deleteFrom("event_signups").where("user_id", "=", id).execute(),
        db.deleteFrom("user_badges").where("user_id", "=", id).execute(),
        db.deleteFrom("user_profiles").where("user_id", "=", id).execute(),
        db.deleteFrom("session").where("userId", "=", id).execute(),
        db.deleteFrom("account").where("userId", "=", id).execute()
      ]);
      
      await db.deleteFrom("user").where("id", "=", id).execute();

      c.executionCtx.waitUntil(logAuditAction(c, "DELETE_USER", "user", id, `Deleted user ${id}`));

      return { status: 200 as const, body: { success: true } as any };
    } catch (e: any) {
      console.error("Delete user failed:", e);
      return { status: 500 as const, body: { error: "Delete failed" } as any };
    }
  },
};

const userTsRestRouter = s.router(userContract, userHandlers as any);

usersRouter.use("/*", ensureAdmin);

createHonoEndpoints(userContract, userTsRestRouter, usersRouter);

export default usersRouter;
