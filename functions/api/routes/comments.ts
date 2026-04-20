import { Hono } from "hono";
import { Bindings, getSessionUser, MAX_INPUT_LENGTHS } from "./_shared";

const commentsRouter = new Hono<{ Bindings: Bindings }>();

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
    await c.env.DB.prepare(
      "INSERT INTO comments (target_type, target_id, user_id, content) VALUES (?, ?, ?, ?)"
    ).bind(targetType, targetId, user.id, content.trim()).run();

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
    const existing = await c.env.DB.prepare("SELECT user_id FROM comments WHERE id = ? AND is_deleted = 0").bind(id).first();
    if (!existing) return c.json({ error: "Not found" }, 404);

    if (existing.user_id !== user.id && user.role !== "admin") {
      return c.json({ error: "Forbidden: You can only edit your own comments" }, 403);
    }

    await c.env.DB.prepare(
      "UPDATE comments SET content = ? WHERE id = ?"
    ).bind(content.trim(), id).run();

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
    const existing = await c.env.DB.prepare("SELECT user_id FROM comments WHERE id = ?").bind(id).first();
    if (!existing) return c.json({ error: "Not found" }, 404);

    if (existing.user_id !== user.id && user.role !== "admin") {
      return c.json({ error: "Forbidden" }, 403);
    }

    await c.env.DB.prepare("UPDATE comments SET is_deleted = 1 WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 comment delete error:", err);
    return c.json({ error: "Delete failed" }, 500);
  }
});

export default commentsRouter;
