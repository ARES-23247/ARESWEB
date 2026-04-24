import { Hono, Context } from "hono";
import { Kysely } from "kysely";
import { DB } from "../../../src/schemas/database";
import { AppEnv, getSessionUser, MAX_INPUT_LENGTHS, getSocialConfig } from "../middleware";
import { sendZulipMessage, updateZulipMessage, deleteZulipMessage } from "../../utils/zulipSync";
import { emitNotification } from "../../utils/notifications";
import { initServer, createHonoEndpoints } from "ts-rest-hono";
import { commentContract } from "../../../src/schemas/contracts/commentContract";

const s = initServer<AppEnv>();
export const commentsRouter = new Hono<AppEnv>();

const commentHandlers = {
  list: async ({ params }: { params: any }, c: Context<AppEnv>) => {
    const { targetType, targetId } = params;
    const user = await getSessionUser(c);
    const db = c.get("db") as Kysely<DB>;

    try {
      const results = await db.selectFrom("comments as c")
        .innerJoin("user_profiles as p", "c.user_id", "p.user_id")
        .innerJoin("user as u", "c.user_id", "u.id")
        .select([
          "c.id", "c.user_id", "c.content", "c.created_at",
          "p.nickname", "u.image as avatar"
        ])
        .where("c.target_type", "=", targetType)
        .where("c.target_id", "=", targetId)
        .where("c.is_deleted", "=", 0)
        .orderBy("c.created_at", "asc")
        .execute();

      const comments = results.map((r) => ({
        id: String(r.id),
        user_id: String(r.user_id),
        nickname: r.nickname || "ARES Member",
        avatar: r.avatar || null,
        content: String(r.content),
        created_at: String(r.created_at),
        updated_at: String(r.created_at)
      }));

      return { 
        status: 200 as const, 
        body: { 
          comments,
          authenticated: !!user,
          role: user?.role || null
        } as any
      };
    } catch {
      return { status: 200 as const, body: { comments: [], authenticated: !!user, role: user?.role || null } as any };
    }
  },
  submit: async ({ params, body }: { params: any, body: any }, c: Context<AppEnv>) => {
    const user = await getSessionUser(c);
    if (!user || user.role === "unverified") {
      return { status: 200 as const, body: { success: false } as any };
    }

    const { targetType, targetId } = params;
    const db = c.get("db") as Kysely<DB>;
    const content = body.content.trim();

    if (!content || content.length > MAX_INPUT_LENGTHS.comment) {
      return { status: 200 as const, body: { success: false } as any };
    }

    try {
      const result = await db.insertInto("comments")
        .values({
          user_id: String(user.id),
          target_type: targetType,
          target_id: targetId,
          content,
          created_at: new Date().toISOString()
        } as any)
        .executeTakeFirst();

      const insertedId = result.numInsertedOrUpdatedRows ? (result as any).insertId : null;

      const social = await getSocialConfig(c);
      const zulipStream = social.ZULIP_COMMENT_STREAM || "website-discussion";

      c.executionCtx.waitUntil((async () => {
        const msgId = await sendZulipMessage(
          c.env, 
          zulipStream, 
          `${targetType.toUpperCase()}: ${targetId}`, 
          `**${user.name || 'ARES Member'}** commented on ${targetType} \`${targetId}\`:\n\n${content}`
        );
        if (msgId && insertedId) {
          await db.updateTable("comments").set({ zulip_message_id: String(msgId) }).where("id", "=", insertedId as any).execute();
        }
      })().catch(() => {}));

      if (targetType === 'post') {
        const row = await db.selectFrom("posts").select("cf_email").where("slug", "=", targetId).executeTakeFirst();
        if (row?.cf_email && row.cf_email !== user.email) {
          const author = await db.selectFrom("user").select("id").where("email", "=", row.cf_email).executeTakeFirst();
          if (author) {
            c.executionCtx.waitUntil(emitNotification(c, {
              userId: String(author.id),
              title: "New Comment",
              message: `${user.name || 'Someone'} commented on your post "${targetId}"`,
              link: `/blog/${targetId}`,
              priority: "medium"
            }));
          }
        }
      }

      return { status: 200 as const, body: { success: true } as any };
    } catch {
      return { status: 200 as const, body: { success: false } as any };
    }
  },
  update: async ({ params, body }: { params: any, body: any }, c: Context<AppEnv>) => {
    const user = await getSessionUser(c);
    if (!user || user.role === "unverified") return { status: 200 as const, body: { success: false } as any };

    const { id } = params;
    const db = c.get("db") as Kysely<DB>;
    const content = body.content.trim();

    if (!content) return { status: 200 as const, body: { success: false } as any };

    try {
      const row = await db.selectFrom("comments").select(["user_id", "zulip_message_id"]).where("id", "=", id).executeTakeFirst();
      if (!row) return { status: 200 as const, body: { success: false } as any };
      if (row.user_id !== user.id && user.role !== "admin") return { status: 200 as const, body: { success: false } as any };

      await db.updateTable("comments")
        .set({ content })
        .where("id", "=", id as any)
        .execute();

      if (row.zulip_message_id) {
        c.executionCtx.waitUntil(
          updateZulipMessage(c.env, String(row.zulip_message_id), `**${user.name}** (edited):\n\n${content}`)
            .catch(() => {})
        );
      }

      return { status: 200 as const, body: { success: true } as any };
    } catch {
      return { status: 200 as const, body: { success: false } as any };
    }
  },
  delete: async ({ params }: { params: any }, c: Context<AppEnv>) => {
    const user = await getSessionUser(c);
    if (!user || user.role === "unverified") return { status: 200 as const, body: { success: false } as any };

    const { id } = params;
    const db = c.get("db") as Kysely<DB>;

    try {
      const row = await db.selectFrom("comments").select(["user_id", "zulip_message_id"]).where("id", "=", id).executeTakeFirst();
      if (!row) return { status: 200 as const, body: { success: false } as any };
      if (row.user_id !== user.id && user.role !== "admin") return { status: 200 as const, body: { success: false } as any };

      await db.updateTable("comments")
        .set({ is_deleted: 1 })
        .where("id", "=", id as any)
        .execute();

      if (row.zulip_message_id) {
        c.executionCtx.waitUntil(
          deleteZulipMessage(c.env, String(row.zulip_message_id))
            .catch(() => {})
        );
      }

      return { status: 200 as const, body: { success: true } as any };
    } catch {
      return { status: 200 as const, body: { success: false } as any };
    }
  },
};

const commentTsRestRouter = s.router(commentContract, commentHandlers as any);

createHonoEndpoints(commentContract, commentTsRestRouter, commentsRouter);

export default commentsRouter;
