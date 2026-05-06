/* eslint-disable @typescript-eslint/no-explicit-any -- ts-rest handler input validated by contract library */
import { ServerInferRequest } from "../../../shared/types/api";
import { Hono } from "hono";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { AppEnv, getSessionUser, MAX_INPUT_LENGTHS, getSocialConfig, persistentRateLimitMiddleware, ensureAuth, originIntegrityMiddleware, logAuditAction, s } from "../middleware";
import { sendZulipMessage, updateZulipMessage, deleteZulipMessage } from "../../utils/zulipSync";
import { emitNotification } from "../../utils/notifications";
import { createHonoEndpoints } from "ts-rest-hono";
import { commentContract } from "../../../shared/schemas/contracts/commentContract";

import type { HonoContext } from "@shared/types/api";


export const commentsRouter = new Hono<AppEnv>();



const commentHandlers = {

  list: async (input: ServerInferRequest<typeof commentContract["list"]>, c: HonoContext) => {
    const { targetType, targetId } = input.params;
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
        }
      };
    } catch (e) {
      console.error("[Comments:List] Error", e);
      return { status: 500 as const, body: { error: "Failed to fetch comments" } };
    }
  },
  submit: async (input: ServerInferRequest<typeof commentContract["submit"]>, c: HonoContext) => {
    const user = await getSessionUser(c);
    if (!user) {
      return { status: 401 as const, body: { error: "Unauthorized" } };
    }
    if (user.role === "unverified") {
      return { status: 403 as const, body: { error: "Verify your email to comment" } };
    }

    const { targetType, targetId } = input.params;
    const db = c.get("db") as Kysely<DB>;
    const rawContent = input.body.content;
    if (!rawContent) {
      return { status: 400 as const, body: { error: "Comment content is required" } };
    }
    const content = rawContent.trim();

    if (!content) {
      return { status: 400 as const, body: { error: "Comment content is required" } };
    }

    // CR-08: Check original length, not trimmed length, to prevent bypass
    if (rawContent.length > MAX_INPUT_LENGTHS.comment) {
      return {
        status: 400 as const,
        body: {
          error: `Comment exceeds ${MAX_INPUT_LENGTHS.comment} character limit`
        }
      };
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
        })
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
          await db.updateTable("comments").set({ zulip_message_id: String(msgId) }).where("id", "=", id).execute();
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

      return { status: 200 as const, body: { success: true } };
    } catch (e) {
      console.error("[Comments:Submit] Error", e);
      return { status: 500 as const, body: { error: "Failed to submit comment" } };
    }
  },
  update: async (input: ServerInferRequest<typeof commentContract["update"]>, c: HonoContext) => {
    const user = await getSessionUser(c);
    if (!user) return { status: 401 as const, body: { error: "Unauthorized" } };
    if (user.role === "unverified") return { status: 403 as const, body: { error: "Unverified" } };

    const { id } = input.params;
    const db = c.get("db") as Kysely<DB>;
    const rawContent = input.body.content;
    const content = rawContent?.trim();

    if (!content) return { status: 400 as const, body: { error: "Content is required" } };

    // CR-08: Check original length, not trimmed length, to prevent bypass
    if (rawContent && rawContent.length > MAX_INPUT_LENGTHS.comment) {
      return {
        status: 400 as const,
        body: {
          error: `Comment exceeds ${MAX_INPUT_LENGTHS.comment} character limit`
        }
      };
    }

    try {
      const row = await db.selectFrom("comments").select(["user_id", "zulip_message_id"]).where("id", "=", id).executeTakeFirst();
      if (!row) return { status: 404 as const, body: { error: "Comment not found" } };
      
      const isOwner = row.user_id === user.id;
      const isModerator = user.role === "admin" || user.member_type === "mentor" || user.member_type === "coach";
      
      if (!isOwner && !isModerator) return { status: 403 as const, body: { error: "Unauthorized to update this comment" } };

      await db.updateTable("comments")
        .set({ content })
        .where("id", "=", id)
        .execute();

      // IN-08: Audit log comment updates
      c.executionCtx.waitUntil(logAuditAction(c, "UPDATE_COMMENT", "comments", id, `Updated comment ${id} by ${user.name}`));

      if (row.zulip_message_id) {
        c.executionCtx.waitUntil((async () => {
          const social = await getSocialConfig(c);
          await updateZulipMessage(social, String(row.zulip_message_id), `**${user.name}** (edited):\n\n${content}`)
            .catch((err) => console.error("[Comments:ZulipUpdate] Error", err));
        })());
      }

      return { status: 200 as const, body: { success: true } };
    } catch (e) {
      console.error("[Comments:Update] Error", e);
      return { status: 500 as const, body: { error: "Failed to update comment" } };
    }
  },
  delete: async (input: ServerInferRequest<typeof commentContract["delete"]>, c: HonoContext) => {
    const user = await getSessionUser(c);
    if (!user) return { status: 401 as const, body: { error: "Unauthorized" } };
    if (user.role === "unverified") return { status: 403 as const, body: { error: "Unverified" } };

    const { id } = input.params;
    const db = c.get("db") as Kysely<DB>;

    try {
      const row = await db.selectFrom("comments").select(["user_id", "zulip_message_id"]).where("id", "=", id).executeTakeFirst();
      if (!row) return { status: 404 as const, body: { error: "Comment not found" } };
      
      const isOwner = row.user_id === user.id;
      const isModerator = user.role === "admin" || user.member_type === "mentor" || user.member_type === "coach";
      
      if (!isOwner && !isModerator) return { status: 403 as const, body: { error: "Unauthorized to delete this comment" } };

      await db.updateTable("comments")
        .set({ is_deleted: 1 })
        .where("id", "=", id)
        .execute();

      // IN-08: Audit log comment deletion
      c.executionCtx.waitUntil(logAuditAction(c, "DELETE_COMMENT", "comments", id, `Deleted comment ${id} by ${user.name}`));

      if (row.zulip_message_id) {
        c.executionCtx.waitUntil((async () => {
          const social = await getSocialConfig(c);
          await deleteZulipMessage(social, String(row.zulip_message_id))
            .catch((err) => console.error("[Comments:ZulipDelete] Error", err));
        })());
      }

      return { status: 200 as const, body: { success: true } };
    } catch (e) {
      console.error("[Comments:Delete] Error", e);
      return { status: 500 as const, body: { error: "Failed to delete comment" } };
    }
  },
};


const commentTsRestRouter = s.router(commentContract, commentHandlers as any);

commentsRouter.use("/:targetType/:targetId", ensureAuth);

commentsRouter.use("/:id", async (c, next) => {
  if (c.req.method === "PATCH" || c.req.method === "DELETE") return ensureAuth(c, next);
  return next();
});

// WR-11: Add origin integrity check to prevent CSRF attacks on state-changing operations
commentsRouter.use("/submit/*", originIntegrityMiddleware());
commentsRouter.use("/submit/*", persistentRateLimitMiddleware(10, 60));

commentsRouter.use("/:id", (c, next) => {
  if (c.req.method === "POST" || c.req.method === "PUT" || c.req.method === "DELETE") {
    return persistentRateLimitMiddleware(10, 60)(c, next);
  }
  return next();
});

// Also apply origin integrity to update and delete operations
commentsRouter.use("/:id", (c, next) => {
  if (c.req.method === "PATCH" || c.req.method === "DELETE" || c.req.method === "PUT") {
    return originIntegrityMiddleware()(c, next);
  }
  return next();
});

createHonoEndpoints(
  commentContract,
  commentTsRestRouter,
  commentsRouter,
  {
    responseValidation: true,
    responseValidationErrorHandler: (err, _c) => {
      console.error('[Contract] Response validation failed:', err.cause);
      return { error: { message: 'Internal server error' }, status: 500 };
    }
  }
);

export default commentsRouter;

