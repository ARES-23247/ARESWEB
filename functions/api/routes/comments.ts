import { autoResponseHandler, success, error } from "../utils/handler-v2";
import { OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import * as schema from "../../../src/db/schema";
import { AppEnv, getSessionUser, MAX_INPUT_LENGTHS, getSocialConfig, persistentRateLimitMiddleware, ensureAuth, originIntegrityMiddleware, logAuditAction, getDb } from "../middleware";
import { sendZulipMessage, updateZulipMessage, deleteZulipMessage } from "../../utils/zulipSync";
import { emitNotification } from "../../utils/notifications";
import { listCommentsRoute, submitCommentRoute, updateCommentRoute, deleteCommentRoute } from "../../../shared/routes/comments";
import { queryHelpers } from "@/db/query-helpers";



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

commentsRouter.openapi(listCommentsRoute, autoResponseHandler<typeof listCommentsRoute>(async (c, { params }) => {
  const { targetType, targetId } = params;
  const user = await getSessionUser(c);
  const db = getDb(c);

  const results = await queryHelpers.getCommentsWithUsers(db, targetType, targetId);

  const comments = results.map((r) => ({
    id: String(r.id),
    userId: String(r.userId),
    nickname: r.nickname || "ARES Member",
    avatar: r.avatar || null,
    content: String(r.content),
    createdAt: String(r.createdAt),
    updatedAt: String(r.createdAt)
  }));

  return success({
    comments,
    authenticated: !!user,
    role: user?.role || null
  });
}));

commentsRouter.openapi(submitCommentRoute, autoResponseHandler<typeof submitCommentRoute>(async (c, { params }) => {
  const user = await getSessionUser(c);
  if (!user) {
    return error({ error: "Unauthorized" }, 401);
  }
  if (user.role === "unverified") {
    return error({ error: "Verify your email to comment" }, 403);
  }

  const { targetType, targetId } = params;
  const db = getDb(c);
  const { content: rawContent } = c.req.valid("json") as { content: string };
  if (!rawContent) {
    return error({ error: "Comment content is required" }, 400);
  }
  const content = String(rawContent).trim();

  if (!content) {
    return error({ error: "Comment content is required" }, 400);
  }

  // CR-08: Check original length, not trimmed length, to prevent bypass
  if (rawContent.length > MAX_INPUT_LENGTHS.comment) {
    return error({ error: `Comment exceeds ${MAX_INPUT_LENGTHS.comment} character limit` }, 400);
  }

  const id = crypto.randomUUID();
  await db.insert(schema.comments)
    .values({
      id,
      userId: String(user.id),
      targetType: targetType,
      targetId: targetId,
      content,
      createdAt: new Date().toISOString()
    })
    .run();

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
      await db.update(schema.comments).set({ zulipMessageId: String(msgId) }).where(eq(schema.comments.id, id)).run();
    }
  })().catch((err: Error) => console.error("[Comments:ZulipSync] Error", err)));

  if (targetType === 'post') {
    const row = await db.select({ cf_email: schema.posts.cfEmail }).from(schema.posts).where(eq(schema.posts.slug, targetId)).get();
    if (row?.cf_email && row.cf_email !== user.email) {
      const author = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, row.cf_email)).get();
      if (author) {
        c.executionCtx.waitUntil(emitNotification(c, {
          userId: String(author.id),
          title: "New Comment",
          message: `${user.name || 'Someone'} commented on your post "${targetId}"`,
          link: `/blog/${targetId}`,
          priority: "medium"
        }).catch((err: Error) => console.error("[Comments:Notification] Error", err)));
      }
    }
  }

  return success({ success: true });
}));

commentsRouter.openapi(updateCommentRoute, autoResponseHandler<typeof updateCommentRoute>(async (c, { params }) => {
  const user = await getSessionUser(c);
  if (!user) return error({ error: "Unauthorized" }, 401);
  if (user.role === "unverified") return error({ error: "Unverified" }, 403);

  const { id } = params;
  const db = getDb(c);
  const { content: rawContent } = c.req.valid("json") as { content: string };
  const content = rawContent ? String(rawContent).trim() : undefined;

  if (!content) return error({ error: "Content is required" }, 400);

  // CR-08: Check original length, not trimmed length, to prevent bypass
  if (rawContent && String(rawContent).length > MAX_INPUT_LENGTHS.comment) {
    return error({ error: `Comment exceeds ${MAX_INPUT_LENGTHS.comment} character limit` }, 400);
  }

  const row = await db.select({
    user_id: schema.comments.userId,
    zulip_message_id: schema.comments.zulipMessageId
  }).from(schema.comments).where(eq(schema.comments.id, id)).get();
  if (!row) return error({ error: "Comment not found" }, 404);

  const isOwner = row.user_id === user.id;
  const isModerator = user.role === "admin" || user.memberType === "mentor" || user.memberType === "coach";

  if (!isOwner && !isModerator) return error({ error: "Unauthorized to update this comment" }, 403);

  await db.update(schema.comments)
    .set({ content })
    .where(eq(schema.comments.id, id))
    .run();

  // IN-08: Audit log comment updates
  c.executionCtx.waitUntil(logAuditAction(c, "UPDATE_COMMENT", "comments", id, `Updated comment ${id} by ${user.name}`));

  if (row.zulip_message_id) {
    c.executionCtx.waitUntil((async () => {
      const social = await getSocialConfig(c);
      await updateZulipMessage(social, String(row.zulip_message_id), `**${user.name}** (edited):\n\n${content}`)
        .catch((err: Error) => console.error("[Comments:ZulipUpdate] Error", err));
    })());
  }

  return success({ success: true });
}));

commentsRouter.openapi(deleteCommentRoute, autoResponseHandler<typeof deleteCommentRoute>(async (c, { params }) => {
  const user = await getSessionUser(c);
  if (!user) return error({ error: "Unauthorized" }, 401);
  if (user.role === "unverified") return error({ error: "Unverified" }, 403);

  const { id } = params;
  const db = getDb(c);

  const row = await db.select({
    user_id: schema.comments.userId,
    zulip_message_id: schema.comments.zulipMessageId
  }).from(schema.comments).where(eq(schema.comments.id, id)).get();
  if (!row) return error({ error: "Comment not found" }, 404);

  const isOwner = row.user_id === user.id;
  const isModerator = user.role === "admin" || user.memberType === "mentor" || user.memberType === "coach";

  if (!isOwner && !isModerator) return error({ error: "Unauthorized to delete this comment" }, 403);

  await db.update(schema.comments)
    .set({ isDeleted: 1 })
    .where(eq(schema.comments.id, id))
    .run();

  // IN-08: Audit log comment deletion
  c.executionCtx.waitUntil(logAuditAction(c, "DELETE_COMMENT", "comments", id, `Deleted comment ${id} by ${user.name}`));

  if (row.zulip_message_id) {
    c.executionCtx.waitUntil((async () => {
      const social = await getSocialConfig(c);
      await deleteZulipMessage(social, String(row.zulip_message_id))
        .catch((err: Error) => console.error("[Comments:ZulipDelete] Error", err));
    })());
  }

  return success({ success: true });
}));

export default commentsRouter;

