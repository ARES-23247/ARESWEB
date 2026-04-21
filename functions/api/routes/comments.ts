import { Hono } from "hono";
import { AppEnv, getSessionUser, MAX_INPUT_LENGTHS, getSocialConfig } from "./_shared";
import { sendZulipMessage, updateZulipMessage, deleteZulipMessage } from "../../utils/zulipSync";
import { emitNotification } from "../../utils/notifications";


const commentsRouter = new Hono<AppEnv>();

// ── GET /comments/:targetType/:targetId — list comments ───────────────
commentsRouter.get("/comments/:targetType/:targetId", async (c) => {
  const { targetType, targetId } = c.req.param();
  const user = await getSessionUser(c);

  try {
    if (!user || user.role === "unverified") {
      return c.json({ comments: [], authenticated: !!user, role: user?.role || null });
    }
    const { results } = await c.env.DB.prepare(
      `SELECT c.id, c.content, c.created_at, c.user_id,
              p.nickname, u.image as avatar
       FROM comments c
       JOIN user u ON c.user_id = u.id
       LEFT JOIN user_profiles p ON c.user_id = p.user_id
       WHERE c.target_type = ? AND c.target_id = ? AND c.is_deleted = 0
       ORDER BY c.created_at ASC`
    ).bind(targetType, targetId).all();

    const mapped = (results || []).map((r: Record<string, unknown>) => ({
      id: r.id,
      content: r.content,
      created_at: r.created_at,
      user_id: r.user_id,
      nickname: r.nickname || "ARES Member",
      avatar: r.avatar,
      is_own: user ? user.id === r.user_id : false,
    }));

    return c.json({ 
      comments: mapped,
      authenticated: !!user,
      role: user?.role || null
    });
  } catch (err) {
    console.error("D1 comments list error:", err);
    return c.json({ 
      comments: [],
      authenticated: !!user,
      role: user?.role || null
    });
  }
});

// ── POST /comments/:targetType/:targetId — create a comment ───────────
commentsRouter.post("/comments/:targetType/:targetId", async (c) => {
  const user = await getSessionUser(c);
  if (!user || user.role === "unverified") {
    return c.json({ error: "Forbidden: Your account is pending team verification." }, 403);
  }

  const { targetType, targetId } = c.req.param();
  const body = await c.req.json();
  const { content } = body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return c.json({ error: "Comment content is required" }, 400);
  }
  if (content.length > MAX_INPUT_LENGTHS.comment) {
    return c.json({ error: `Comment exceeds maximum length of ${MAX_INPUT_LENGTHS.comment} characters` }, 400);
  }

  try {
    const { id } = await c.env.DB.prepare(
      "INSERT INTO comments (target_type, target_id, user_id, content) VALUES (?, ?, ?, ?) RETURNING id"
    ).bind(targetType, targetId, user.id, content.trim()).first<{ id: number }>() || {};

    try {
      const social = await getSocialConfig(c);
      const stream = social.ZULIP_COMMENT_STREAM || "website-discussion";
      const topic = `${targetType}/${targetId}`;
      const prefix = `**${user.name || "ARES Member"}** commented:\n\n`;
      const zulipId = await sendZulipMessage(c.env, stream, topic, prefix + content.trim());
      
      if (zulipId && id) {
         await c.env.DB.prepare("UPDATE comments SET zulip_message_id = ? WHERE id = ?").bind(zulipId, id).run();
      }
    } catch (e) {
      console.error("[Comments] Zulip Sync Error", e);
    }

    // ── In-App Notification ──
    try {
      let authorEmail: string | null = null;
      let targetTitle: string | null = null;

      if (targetType === "blog" || targetType === "posts") {
        const row = await c.env.DB.prepare("SELECT cf_email, title FROM posts WHERE slug = ?").bind(targetId).first<{ cf_email: string, title: string }>();
        authorEmail = row?.cf_email || null;
        targetTitle = row?.title || null;
      } else if (targetType === "doc") {
        const row = await c.env.DB.prepare("SELECT cf_email, title FROM docs WHERE slug = ?").bind(targetId).first<{ cf_email: string, title: string }>();
        authorEmail = row?.cf_email || null;
        targetTitle = row?.title || null;
      } else if (targetType === "event") {
        const row = await c.env.DB.prepare("SELECT cf_email, title FROM events WHERE id = ?").bind(targetId).first<{ cf_email: string, title: string }>();
        authorEmail = row?.cf_email || null;
        targetTitle = row?.title || null;
      }

      if (authorEmail && authorEmail !== user.email) {
        const author = await c.env.DB.prepare("SELECT id FROM user WHERE email = ?").bind(authorEmail).first<{ id: string }>();
        if (author) {
          c.executionCtx.waitUntil(
            emitNotification(c, {
              userId: author.id,

              title: "New Comment",
              message: `${user.name || "Someone"} commented on "${targetTitle || targetId}"`,
              link: `/${targetType === "blog" ? "blog" : targetType === "doc" ? "docs" : "events"}/${targetId}`,
              priority: "medium"
            })
          );
        }
      }
    } catch (err) {
      console.error("[Comments] In-app notification failed:", err);
    }


    return c.json({ success: true });
  } catch (err) {
    console.error("D1 comment create error:", err);
    return c.json({ error: "Comment creation failed" }, 500);
  }
});

// ── PUT /comments/:id — edit a comment ──────────────────────────────────
commentsRouter.put("/comments/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user || user.role === "unverified") return c.json({ error: "Forbidden" }, 403);

  const id = c.req.param("id");
  const body = await c.req.json();
  const { content } = body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return c.json({ error: "Comment content is required" }, 400);
  }
  if (content.length > MAX_INPUT_LENGTHS.comment) {
    return c.json({ error: `Comment exceeds maximum length of ${MAX_INPUT_LENGTHS.comment} characters` }, 400);
  }

  try {
    const existing = await c.env.DB.prepare("SELECT user_id, name as user_name, zulip_message_id FROM comments c JOIN user u ON c.user_id = u.id WHERE c.id = ? AND c.is_deleted = 0").bind(id).first<{ user_id: string, user_name: string, zulip_message_id: string }>();
    if (!existing) return c.json({ error: "Not found" }, 404);

    if (existing.user_id !== user.id && user.role !== "admin") {
      return c.json({ error: "Forbidden: You can only edit your own comments" }, 403);
    }

    await c.env.DB.prepare(
      "UPDATE comments SET content = ? WHERE id = ?"
    ).bind(content.trim(), id).run();

    if (existing.zulip_message_id) {
       const prefix = `**${existing.user_name || "ARES Member"}** commented (edited):\n\n`;
       c.executionCtx.waitUntil(updateZulipMessage(c.env, existing.zulip_message_id, prefix + content.trim()));
    }

    return c.json({ success: true });
  } catch (err) {
    console.error("D1 comment edit error:", err);
    return c.json({ error: "Edit failed" }, 500);
  }
});

// ── DELETE /comments/:id — soft-delete a comment ────────────────────────
commentsRouter.delete("/comments/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    const id = c.req.param("id");
    const existing = await c.env.DB.prepare("SELECT user_id, zulip_message_id FROM comments WHERE id = ?").bind(id).first<{ user_id: string, zulip_message_id: string }>();
    if (!existing) return c.json({ error: "Not found" }, 404);

    if (existing.user_id !== user.id && user.role !== "admin") {
      return c.json({ error: "Forbidden" }, 403);
    }

    await c.env.DB.prepare("UPDATE comments SET is_deleted = 1 WHERE id = ?").bind(id).run();
    
    if (existing.zulip_message_id) {
       c.executionCtx.waitUntil(deleteZulipMessage(c.env, existing.zulip_message_id));
    }
    
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 comment delete error:", err);
    return c.json({ error: "Delete failed" }, 500);
  }
});

export default commentsRouter;
