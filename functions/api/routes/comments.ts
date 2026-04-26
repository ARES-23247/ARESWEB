import { Hono, Context } from "hono";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { AppEnv, getSessionUser, MAX_INPUT_LENGTHS, getSocialConfig, persistentRateLimitMiddleware, ensureAuth } from "../middleware";
import { sendZulipMessage, updateZulipMessage, deleteZulipMessage } from "../../utils/zulipSync";
import { emitNotification } from "../../utils/notifications";
import { initServer, createHonoEndpoints } from "ts-rest-hono";
import { commentContract } from "../../../shared/schemas/contracts/commentContract";

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
    } catch (e) {
      console.error("[Comments:List] Error", e);
      return { status: 500 as const, body: { error: "Failed to fetch comments" } as any };
    }
  },
  submit: async ({ params, body }: { params: any, body: any }, c: Context<AppEnv>) => {
    const user = await getSessionUser(c);
    if (!user) {
      return { status: 401 as const, body: { error: "Unauthorized" } as any };
    }
    if (user.role === "unverified") {
      return { status: 403 as const, body: { error: "Verify your email to comment" } as any };
    }

    const { targetType, targetId } = params;
    const db = c.get("db") as Kysely<DB>;
    const content = body.content.trim();

    if (!content) {
      return { status: 400 as const, body: { error: "Comment content is required" } as any };
    }
    if (content.length > MAX_INPUT_LENGTHS.comment) {
      return { status: 400 as const, body: { error: "Comment is too long" } as any };
    }

    try {
      const id = crypto.randomUUID();
      await db.insertInto("comments")
        .values({
          id,
          user_id: String(user.id),
          target_type: targetType,
          target_id: targetId,
          content,
          created_at: new Date().toISOString()
        } as any)
        .execute();

      const social = await getSocialConfig(c);
      const zulipStream = social.ZULIP_COMMENT_STREAM || "website-discussion";

      c.executionCtx.waitUntil((async () => {
        const msgId = await sendZulipMessage(
          social, 
          zulipStream, 
          `${targetType.toUpperCase()}: ${targetId}`, 
          `**${user.name || 'ARES Member'}** commented on ${targetType} \`${targetId}\`:\n\n${content}`
        );
        if (msgId) {
          await db.updateTable("comments").set({ zulip_message_id: String(msgId) }).where("id", "=", id as any).execute();
        }
      })().catch((err) => console.error("[Comments:ZulipSync] Error", err)));

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
            }).catch((err) => console.error("[Comments:Notification] Error", err)));
          }
        }
      }

      return { status: 200 as const, body: { success: true } as any };
    } catch (e) {
      console.error("[Comments:Submit] Error", e);
      return { status: 500 as const, body: { error: "Failed to submit comment" } as any };
    }
  },
  update: async ({ params, body }: { params: any, body: any }, c: Context<AppEnv>) => {
    const user = (await getSessionUser(c))!;
    if (user.role === "unverified") return { status: 403 as const, body: { error: "Unverified" } as any };

    const { id } = params;
    const db = c.get("db") as Kysely<DB>;
    const content = body.content?.trim();

    if (!content) return { status: 400 as const, body: { error: "Content is required" } as any };

    try {
      const row = await db.selectFrom("comments").select(["user_id", "zulip_message_id"]).where("id", "=", id).executeTakeFirst();
      if (!row) return { status: 404 as const, body: { error: "Comment not found" } as any };
      
      const isOwner = row.user_id === user.id;
      const isModerator = user.role === "admin" || user.member_type === "mentor" || user.member_type === "coach";
      
      if (!isOwner && !isModerator) return { status: 403 as const, body: { error: "Unauthorized to update this comment" } as any };

      await db.updateTable("comments")
        .set({ content })
        .where("id", "=", id as any)
        .execute();

      if (row.zulip_message_id) {
        c.executionCtx.waitUntil((async () => {
          const social = await getSocialConfig(c);
          await updateZulipMessage(social, String(row.zulip_message_id), `**${user.name}** (edited):\n\n${content}`)
            .catch((err) => console.error("[Comments:ZulipUpdate] Error", err));
        })());
      }

      return { status: 200 as const, body: { success: true } as any };
    } catch (e) {
      console.error("[Comments:Update] Error", e);
      return { status: 500 as const, body: { error: "Failed to update comment" } as any };
    }
  },
  delete: async ({ params }: { params: any }, c: Context<AppEnv>) => {
    const user = (await getSessionUser(c))!;
    if (user.role === "unverified") return { status: 403 as const, body: { error: "Unverified" } as any };

    const { id } = params;
    const db = c.get("db") as Kysely<DB>;

    try {
      const row = await db.selectFrom("comments").select(["user_id", "zulip_message_id"]).where("id", "=", id).executeTakeFirst();
      if (!row) return { status: 404 as const, body: { error: "Comment not found" } as any };
      
      const isOwner = row.user_id === user.id;
      const isModerator = user.role === "admin" || user.member_type === "mentor" || user.member_type === "coach";
      
      if (!isOwner && !isModerator) return { status: 403 as const, body: { error: "Unauthorized to delete this comment" } as any };

      await db.updateTable("comments")
        .set({ is_deleted: 1 })
        .where("id", "=", id as any)
        .execute();

      if (row.zulip_message_id) {
        c.executionCtx.waitUntil((async () => {
          const social = await getSocialConfig(c);
          await deleteZulipMessage(social, String(row.zulip_message_id))
            .catch((err) => console.error("[Comments:ZulipDelete] Error", err));
        })());
      }

      return { status: 200 as const, body: { success: true } as any };
    } catch (e) {
      console.error("[Comments:Delete] Error", e);
      return { status: 500 as const, body: { error: "Failed to delete comment" } as any };
    }
  },
};

const commentTsRestRouter = s.router(commentContract, commentHandlers as any);

commentsRouter.use("/:targetType/:targetId", async (c, next) => {
  if (c.req.method === "POST") return ensureAuth(c, next);
  return next();
});

commentsRouter.use("/:id", async (c, next) => {
  if (c.req.method === "PATCH" || c.req.method === "DELETE") return ensureAuth(c, next);
  return next();
});

commentsRouter.use("/submit/*", persistentRateLimitMiddleware(10, 60));
commentsRouter.use("/:id", (c, next) => {
  if (c.req.method === "POST" || c.req.method === "PUT" || c.req.method === "DELETE") {
    return persistentRateLimitMiddleware(10, 60)(c, next);
  }
  return next();
});

createHonoEndpoints(commentContract, commentTsRestRouter, commentsRouter);

export default commentsRouter;
