import { typedHandler } from "../utils/handler";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { AppEnv, getSessionUser, MAX_INPUT_LENGTHS, getSocialConfig, persistentRateLimitMiddleware, ensureAuth, originIntegrityMiddleware, logAuditAction } from "../middleware";
import { sendZulipMessage, updateZulipMessage, deleteZulipMessage } from "../../utils/zulipSync";
import { emitNotification } from "../../utils/notifications";
import { listCommentsRoute, submitCommentRoute, updateCommentRoute, deleteCommentRoute } from "../../../shared/routes/comments";



export const commentsRouter = new OpenAPIHono<AppEnv>();

commentsRouter.use("/{targetType}/{targetId}", ensureAuth);

commentsRouter.use("/{id}", async (c, next) => {
  if (c.req.method === "PATCH" || c.req.method === "DELETE") return ensureAuth(c, next);
  return next();
});

// WR-11: Add origin integrity check to prevent CSRF attacks on state-changing operations
commentsRouter.use("/submit/*", originIntegrityMiddleware());
commentsRouter.use("/submit/*", persistentRateLimitMiddleware(10, 60));

commentsRouter.use("/{id}", (c, next) => {
  if (c.req.method === "POST" || c.req.method === "PUT" || c.req.method === "DELETE") {
    return persistentRateLimitMiddleware(10, 60)(c, next);
  }
  return next();
});

// Also apply origin integrity to update and delete operations
commentsRouter.use("/{id}", (c, next) => {
  if (c.req.method === "PATCH" || c.req.method === "DELETE" || c.req.method === "PUT") {
    return originIntegrityMiddleware()(c, next);
  }
  return next();
});

commentsRouter.openapi(listCommentsRoute, typedHandler<typeof listCommentsRoute>(async (c) => {
  const { targetType, targetId } = c.req.valid("param");
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

    return c.json({ 
      comments,
      authenticated: !!user,
      role: user?.role || null
    }, 200);
  } catch (e) {
    console.error("[Comments:List] Error", e);
    return c.json({ error: "Failed to fetch comments", code: "INTERNAL_SERVER_ERROR" }, 500);
  }
}));

commentsRouter.openapi(submitCommentRoute, typedHandler<typeof submitCommentRoute>(async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }
  if (user.role === "unverified") {
    return c.json({ error: "Verify your email to comment", code: "FORBIDDEN" }, 403);
  }

  const { targetType, targetId } = c.req.valid("param");
  const db = c.get("db") as Kysely<DB>;
  const body = c.req.valid("json");
  const rawContent = body.content;
  if (!rawContent) {
    return c.json({ error: "Comment content is required", code: "BAD_REQUEST" }, 400);
  }
  const content = rawContent.trim();

  if (!content) {
    return c.json({ error: "Comment content is required", code: "BAD_REQUEST" }, 400);
  }

  // CR-08: Check original length, not trimmed length, to prevent bypass
  if (rawContent.length > MAX_INPUT_LENGTHS.comment) {
    return c.json({
      error: `Comment exceeds ${MAX_INPUT_LENGTHS.comment} character limit`,
      code: "BAD_REQUEST"
    }, 400);
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

    return c.json({ success: true }, 200);
  } catch (e) {
    console.error("[Comments:Submit] Error", e);
    return c.json({ error: "Failed to submit comment", code: "INTERNAL_SERVER_ERROR" }, 500);
  }
}));

commentsRouter.openapi(updateCommentRoute, typedHandler<typeof updateCommentRoute>(async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  if (user.role === "unverified") return c.json({ error: "Unverified", code: "FORBIDDEN" }, 403);

  const { id } = c.req.valid("param");
  const db = c.get("db") as Kysely<DB>;
  const body = c.req.valid("json");
  const rawContent = body.content;
  const content = rawContent?.trim();

  if (!content) return c.json({ error: "Content is required", code: "BAD_REQUEST" }, 400);

  // CR-08: Check original length, not trimmed length, to prevent bypass
  if (rawContent && rawContent.length > MAX_INPUT_LENGTHS.comment) {
    return c.json({
      error: `Comment exceeds ${MAX_INPUT_LENGTHS.comment} character limit`,
      code: "BAD_REQUEST"
    }, 400);
  }

  try {
    const row = await db.selectFrom("comments").select(["user_id", "zulip_message_id"]).where("id", "=", id).executeTakeFirst();
    if (!row) return c.json({ error: "Comment not found", code: "NOT_FOUND" }, 404);
    
    const isOwner = row.user_id === user.id;
    const isModerator = user.role === "admin" || user.member_type === "mentor" || user.member_type === "coach";
    
    if (!isOwner && !isModerator) return c.json({ error: "Unauthorized to update this comment", code: "FORBIDDEN" }, 403);

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

    return c.json({ success: true }, 200);
  } catch (e) {
    console.error("[Comments:Update] Error", e);
    return c.json({ error: "Failed to update comment", code: "INTERNAL_SERVER_ERROR" }, 500);
  }
}));

commentsRouter.openapi(deleteCommentRoute, typedHandler<typeof deleteCommentRoute>(async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  if (user.role === "unverified") return c.json({ error: "Unverified", code: "FORBIDDEN" }, 403);

  const { id } = c.req.valid("param");
  const db = c.get("db") as Kysely<DB>;

  try {
    const row = await db.selectFrom("comments").select(["user_id", "zulip_message_id"]).where("id", "=", id).executeTakeFirst();
    if (!row) return c.json({ error: "Comment not found", code: "NOT_FOUND" }, 404);
    
    const isOwner = row.user_id === user.id;
    const isModerator = user.role === "admin" || user.member_type === "mentor" || user.member_type === "coach";
    
    if (!isOwner && !isModerator) return c.json({ error: "Unauthorized to delete this comment", code: "FORBIDDEN" }, 403);

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

    return c.json({ success: true }, 200);
  } catch (e) {
    console.error("[Comments:Delete] Error", e);
    return c.json({ error: "Failed to delete comment", code: "INTERNAL_SERVER_ERROR" }, 500);
  }
}));

export default commentsRouter;
