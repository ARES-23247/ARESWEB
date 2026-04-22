import { Hono } from "hono";
import { AppEnv, getSessionUser, MAX_INPUT_LENGTHS, getSocialConfig, turnstileMiddleware, rateLimitMiddleware } from "../middleware";
import { sendZulipMessage, updateZulipMessage, deleteZulipMessage } from "../../utils/zulipSync";
import { emitNotification } from "../../utils/notifications";


const commentsRouter = new Hono<AppEnv>();

// ── GET /comments/:targetType/:targetId — list comments ────────────────
commentsRouter.get("/:targetType/:targetId", async (c) => {
  const targetType = (c.req.param("targetType") || "");
  const targetId = (c.req.param("targetId") || "");
  const user = await getSessionUser(c);

  try {
    const { results } = await c.env.DB.prepare(
      `SELECT c.*, p.nickname, u.image as avatar FROM comments c
       JOIN user_profiles p ON c.user_id = p.user_id
       JOIN user u ON c.user_id = u.id
       WHERE c.target_type = ? AND c.target_id = ? AND c.is_deleted = 0
       ORDER BY c.created_at ASC`
    ).bind(targetType, targetId).all();

    const mapped = (results || []).map((r: any) => ({
      id: r.id,
      content: r.content,
      created_at: r.created_at,
      updated_at: r.updated_at,
      user_id: r.user_id,
      nickname: r.nickname || "ARES Member",
      avatar: r.avatar,
      is_own: user ? user.id === r.user_id : false,
    }));

    return c.json({ 
      comments: mapped,
      authenticated: !!user,
      can_comment: user && user.role !== "unverified"
    });
  } catch (err) {
    console.error("D1 comments read error:", err);
    return c.json({ comments: [] }, 500);
  }
});

// ── POST /comments/:targetType/:targetId — create a comment ───────────
commentsRouter.post("/:targetType/:targetId", rateLimitMiddleware(10, 60), turnstileMiddleware(), async (c) => {
  const user = await getSessionUser(c);
  if (!user || user.role === "unverified") {
    return c.json({ error: "Forbidden: Your account is pending team verification." }, 403);
  }

  const targetType = (c.req.param("targetType") || "");
  const targetId = (c.req.param("targetId") || "");
  const body = await c.req.json();
  const content = (body.content || "").trim();

  if (!content) return c.json({ error: "Comment content cannot be empty" }, 400);
  if (content.length > MAX_INPUT_LENGTHS.comment) return c.json({ error: "Comment too long" }, 400);

  try {
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO comments (id, user_id, target_type, target_id, content) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, user.id, targetType, targetId, content).run();

    // ── Sync to Zulip ──
    const social = await getSocialConfig(c);
    const zulipStream = social.ZULIP_COMMENT_STREAM || "website-discussion";
    
    // Background Zulip sync
    c.executionCtx.waitUntil((async () => {
       const msgId = await sendZulipMessage(
         c.env, 
         zulipStream, 
         `${targetType.toUpperCase()}: ${targetId}`, 
         `**${user.name || 'User'}** commented on ${targetType} \`${targetId}\`:\n\n${content}`
       );
       if (msgId) {
         await c.env.DB.prepare("UPDATE comments SET zulip_message_id = ? WHERE id = ?").bind(msgId, id).run();
       }
    })().catch(err => console.error("[Comments] Zulip sync error:", err)));

    // ── Notifications ──
    // If it's a blog post, notify authors (unless they are the commenter)
    if (targetType === 'post') {
       const row = await c.env.DB.prepare("SELECT cf_email FROM posts WHERE slug = ?").bind(targetId).first<{cf_email: string}>();
       if (row?.cf_email && row.cf_email !== user.email) {
          const author = await c.env.DB.prepare("SELECT id FROM user WHERE email = ?").bind(row.cf_email).first<{id: string}>();
          if (author) {
            c.executionCtx.waitUntil(emitNotification(c, {
               userId: author.id,
               title: "New Comment",
               message: `${user.name || 'Someone'} commented on your post "${targetId}"`,
               link: `/blog/${targetId}`,
               priority: "medium"
            }));
          }
       }
    }

    return c.json({ success: true, id });
  } catch (err) {
    console.error("D1 comment create error:", err);
    return c.json({ error: "Comment creation failed" }, 500);
  }
});

// ── PUT /comments/:id — edit a comment ──────────────────────────────────
commentsRouter.put("/:id", rateLimitMiddleware(10, 60), async (c) => {
  const user = await getSessionUser(c);
  if (!user || user.role === "unverified") return c.json({ error: "Forbidden" }, 403);

  const id = (c.req.param("id") || "");
  const body = await c.req.json();
  const content = (body.content || "").trim();

  if (!content) return c.json({ error: "Comment content cannot be empty" }, 400);

  try {
    const row = await c.env.DB.prepare("SELECT user_id, zulip_message_id FROM comments WHERE id = ?").bind(id).first<{user_id: string, zulip_message_id: number}>();
    if (!row) return c.json({ error: "Comment not found" }, 404);
    if (row.user_id !== user.id && user.role !== "admin") return c.json({ error: "Forbidden" }, 403);

    await c.env.DB.prepare(
      "UPDATE comments SET content = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(content, id).run();

    if (row.zulip_message_id) {
       c.executionCtx.waitUntil(
         updateZulipMessage(c.env, row.zulip_message_id, `**${user.name}** (edited):\n\n${content}`)
           .catch(err => console.error("[Comments] Zulip update failed:", err))
       );
    }

    return c.json({ success: true });
  } catch (err) {
    console.error("D1 comment update error:", err);
    return c.json({ error: "Update failed" }, 500);
  }
});

// ── DELETE /comments/:id — delete a comment ──────────────────────────────
commentsRouter.delete("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user || user.role === "unverified") return c.json({ error: "Forbidden" }, 401);

  const id = (c.req.param("id") || "");

  try {
    const row = await c.env.DB.prepare("SELECT user_id, zulip_message_id FROM comments WHERE id = ?").bind(id).first<{user_id: string, zulip_message_id: number}>();
    if (!row) return c.json({ error: "Comment not found" }, 404);
    if (row.user_id !== user.id && user.role !== "admin") return c.json({ error: "Forbidden" }, 403);

    await c.env.DB.prepare(
      "UPDATE comments SET is_deleted = 1 WHERE id = ?"
    ).bind(id).run();

    if (row.zulip_message_id) {
       c.executionCtx.waitUntil(
         deleteZulipMessage(c.env, row.zulip_message_id)
           .catch(err => console.error("[Comments] Zulip delete failed:", err))
       );
    }

    return c.json({ success: true });
  } catch (err) {
    console.error("D1 comment delete error:", err);
    return c.json({ error: "Delete failed" }, 500);
  }
});

export default commentsRouter;
