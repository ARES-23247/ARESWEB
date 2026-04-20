import { Hono } from "hono";
import { Bindings, ensureAdmin, getSessionUser } from "./_shared";

const docsRouter = new Hono<{ Bindings: Bindings }>();

// ── GET /docs — list all docs grouped by category ─────────────────────
docsRouter.get("/docs", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT d.slug, d.title, d.category, d.sort_order, d.description, d.is_portfolio, d.is_executive_summary,
              p.nickname as original_author_nickname, u.image as original_author_avatar
       FROM docs d
       LEFT JOIN user u ON d.cf_email = u.email
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE d.is_deleted = 0 AND d.status = 'published' ORDER BY d.category, d.sort_order ASC`
    ).all();
    return c.json({ docs: results ?? [] });
  } catch (err) {
    console.error("D1 docs list error:", err);
    return c.json({ docs: [] });
  }
});

// ── GET /docs/search?q=keyword — full-text search ─────────────────────
docsRouter.get("/docs/search", async (c) => {
  const q = c.req.query("q");
  if (!q || q.length < 3) return c.json({ results: [] });
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT slug, title, category, description FROM docs WHERE is_deleted = 0 AND status = 'published' AND (title LIKE ? OR content LIKE ? OR description LIKE ?) ORDER BY category, sort_order ASC LIMIT 20"
    ).bind(`%${q}%`, `%${q}%`, `%${q}%`).all();

    const mapped = (results ?? []).map((r: Record<string, unknown>) => {
      let snippet = String(r.description || "");
      // eslint-disable-next-line security/detect-non-literal-regexp
      const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, "gi");
      snippet = snippet.replace(regex, "**$1**");

      return {
        slug: r.slug,
        title: r.title,
        category: r.category,
        description: r.description,
        snippet,
      };
    });
    return c.json({ results: mapped });
  } catch (err) {
    console.error("D1 docs search error:", err);
    return c.json({ results: [] });
  }
});

// ── POST /docs/:slug/feedback — Submit doc feedback ───────────────────
docsRouter.post("/docs/:slug/feedback", async (c) => {
  try {
    const slug = c.req.param("slug");
    const body = await c.req.json();
    const { isHelpful, comment } = body;

    // SEC-04: Validate comment length
    if (comment && typeof comment === "string" && comment.length > 2000) {
      return c.json({ error: "Comment too long" }, 400);
    }

    await c.env.DB.prepare(
      "INSERT INTO docs_feedback (slug, is_helpful, comment) VALUES (?, ?, ?)"
    ).bind(slug, isHelpful ? 1 : 0, comment || null).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 feedback error:", err);
    return c.json({ error: "Feedback failed" }, 500);
  }
});

// ── GET /docs/:slug — single doc page ─────────────────────────────────
docsRouter.get("/docs/:slug", async (c) => {
  const slug = c.req.param("slug");
  try {
    const row = await c.env.DB.prepare(
      `SELECT d.slug, d.title, d.category, d.description, d.content, d.updated_at, d.is_portfolio, d.is_executive_summary,
              p.nickname as original_author_nickname, u.image as original_author_avatar
       FROM docs d
       LEFT JOIN user u ON d.cf_email = u.email
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE d.slug = ? AND d.is_deleted = 0 AND d.status = 'published'`
    ).bind(slug).first();
    if (!row) return c.json({ error: "Doc not found" }, 404);

    // Fetch contributors from history
    const { results: historyKeys } = await c.env.DB.prepare(
      `SELECT DISTINCT h.author_email, p.nickname, u.image as avatar
       FROM docs_history h
       LEFT JOIN user u ON h.author_email = u.email
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE h.slug = ? AND h.author_email IS NOT NULL`
    ).bind(slug).all();

    return c.json({ 
      doc: row,
      contributors: historyKeys ?? []
    });
  } catch (err) {
    console.error("D1 doc read error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

docsRouter.get("/admin/docs", async (c) => {
  try {
    const limit = Math.min(Number(c.req.query("limit") || "100"), 500);
    const offset = Number(c.req.query("offset") || "0");
    const { results } = await c.env.DB.prepare(
      "SELECT slug, title, category, sort_order, description, is_portfolio, is_executive_summary, is_deleted, status, revision_of FROM docs ORDER BY category, sort_order ASC LIMIT ? OFFSET ?"
    ).bind(limit, offset).all();
    return c.json({ docs: results ?? [] });
  } catch (err) {
    console.error("D1 admin docs list error:", err);
    return c.json({ docs: [] });
  }
});

// ── GET /admin/docs/export-all — export all docs as JSON backup (admin) ──
docsRouter.get("/admin/docs/export-all", ensureAdmin, async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT slug, title, category, sort_order, description, content, is_portfolio, is_executive_summary, status FROM docs WHERE is_deleted = 0 OR is_deleted IS NULL ORDER BY category, sort_order`
    ).all();

    const backup = {
      exportedAt: new Date().toISOString(),
      version: "aresweb-docs-v1",
      count: results.length,
      docs: results,
    };

    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="aresweb-docs-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    console.error("Docs export error:", err);
    return c.json({ error: "Export failed" }, 500);
  }
});

// ── POST /admin/docs — create/update a doc (admin) ────────────────────
docsRouter.post("/admin/docs", async (c) => {
  try {
    const { slug, title, category, sortOrder, description, content, isPortfolio, isExecutiveSummary, isDraft } = await c.req.json();
    if (!slug || !title || !category || !content) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const user = await getSessionUser(c);
    const email = user?.email || "anonymous_admin";

    // Capture history before update
    const existing = await c.env.DB.prepare("SELECT slug, title, category, description, content, cf_email, is_portfolio, is_executive_summary FROM docs WHERE slug = ?").bind(slug).first();
    if (existing) {
       await c.env.DB.prepare(
         `INSERT INTO docs_history (slug, title, category, description, content, author_email)
          VALUES (?, ?, ?, ?, ?, ?)`
       ).bind(existing.slug, existing.title, existing.category, existing.description, existing.content, existing.cf_email || "unknown").run();
    }
    
    if (user?.role !== "admin" && existing) {
       // ── Shadow Revision Logic (Student Edits) ──
       const revSlug = `${slug}-rev-${Math.random().toString(36).substring(2, 6)}`;
       await c.env.DB.prepare(
        `INSERT INTO docs (slug, title, category, sort_order, description, content, cf_email, updated_at, is_portfolio, is_executive_summary, status, revision_of) 
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, 'pending', ?)`
       ).bind(revSlug, title, category, sortOrder || 0, description || "", content, email, isPortfolio ? 1 : 0, isExecutiveSummary ? 1 : 0, slug).run();
       
       return c.json({ success: true, slug: revSlug });
    }

    const status = isDraft ? "pending" : (user?.role === "admin" ? "published" : "pending");

    await c.env.DB.prepare(
      `INSERT OR REPLACE INTO docs (slug, title, category, sort_order, description, content, cf_email, updated_at, is_portfolio, is_executive_summary, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)`
    ).bind(slug, title, category, sortOrder || 0, description || "", content, email, isPortfolio ? 1 : 0, isExecutiveSummary ? 1 : 0, status).run();
    
    return c.json({ success: true, slug });
  } catch (err) {
    console.error("D1 doc write error:", err);
    return c.json({ error: "Write failed" }, 500);
  }
});

// ── DELETE /admin/docs/:slug — soft-delete (admin) ─────────────────────
docsRouter.delete("/admin/docs/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    await c.env.DB.prepare("UPDATE docs SET is_deleted = 1 WHERE slug = ?").bind(slug).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 soft-delete error (docs):", err);
    return c.json({ error: "Soft-delete failed" }, 500);
  }
});

// ── PATCH /admin/docs/:slug/undelete — restore (admin) ────────────────
docsRouter.patch("/admin/docs/:slug/undelete", async (c) => {
  try {
    const slug = c.req.param("slug");
    await c.env.DB.prepare("UPDATE docs SET is_deleted = 0 WHERE slug = ?").bind(slug).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 undelete error (docs):", err);
    return c.json({ error: "Undelete failed" }, 500);
  }
});

// ── DELETE /admin/docs/:slug/purge — PERMANENTLY delete (admin) ────────
docsRouter.delete("/admin/docs/:slug/purge", async (c) => {
  try {
    const slug = c.req.param("slug");
    await c.env.DB.prepare("DELETE FROM docs WHERE slug = ?").bind(slug).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 purge error (docs):", err);
    return c.json({ error: "Purge failed" }, 500);
  }
});

// ── PATCH /admin/docs/:slug/sort — update doc sort_order ───────────────
docsRouter.patch("/admin/docs/:slug/sort", async (c) => {
  try {
    const slug = c.req.param("slug");
    const { sortOrder } = await c.req.json();
    if (typeof sortOrder !== 'number') {
      return c.json({ error: "Invalid sortOrder" }, 400);
    }
    await c.env.DB.prepare("UPDATE docs SET sort_order = ? WHERE slug = ?").bind(sortOrder, slug).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 doc sort update error:", err);
    return c.json({ error: "Sort update failed" }, 500);
  }
});

// ── PATCH /admin/docs/:slug/approve — approve pending doc (admin) ─────
docsRouter.patch("/admin/docs/:slug/approve", async (c) => {
  try {
    const user = await getSessionUser(c);
    if (user?.role !== "admin") return c.json({ error: "Unauthorized" }, 401);
    const slug = c.req.param("slug");

    type DocRow = { revision_of?: string; title: string; category: string; sort_order: number; description: string; content: string; is_portfolio: number; is_executive_summary: number };
    const row = await c.env.DB.prepare("SELECT revision_of, title, category, sort_order, description, content, is_portfolio, is_executive_summary FROM docs WHERE slug = ?").bind(slug).first<DocRow>();

    if (row && row.revision_of) {
      await c.env.DB.prepare(
        "UPDATE docs SET title = ?, category = ?, sort_order = ?, description = ?, content = ?, is_portfolio = ?, is_executive_summary = ?, status = 'published', updated_at = datetime('now') WHERE slug = ?"
      ).bind(row.title, row.category, row.sort_order, row.description, row.content, row.is_portfolio ? 1 : 0, row.is_executive_summary ? 1 : 0, row.revision_of).run();
      await c.env.DB.prepare("DELETE FROM docs WHERE slug = ?").bind(slug).run();
      return c.json({ success: true });
    }

    await c.env.DB.prepare("UPDATE docs SET status = 'published' WHERE slug = ?").bind(slug).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 approve error (docs):", err);
    return c.json({ error: "Approval failed" }, 500);
  }
});

// ── PATCH /admin/docs/:slug/reject — reject pending doc (admin) ─────
docsRouter.patch("/admin/docs/:slug/reject", async (c) => {
  try {
    const user = await getSessionUser(c);
    if (user?.role !== "admin") return c.json({ error: "Unauthorized" }, 401);
    const slug = c.req.param("slug");
    const body = await c.req.json().catch(() => ({})) as { reason?: string };
    
    await c.env.DB.prepare(
      "UPDATE docs SET status = 'rejected' WHERE slug = ?"
    ).bind(slug).run();

    return c.json({ success: true, reason: body.reason || "No reason provided" });
  } catch (err) {
    console.error("D1 reject error (docs):", err);
    return c.json({ error: "Rejection failed" }, 500);
  }
});

// ── GET /admin/docs/:slug/history — list doc history (admin) ──────────
docsRouter.get("/admin/docs/:slug/history", async (c) => {
  try {
    const slug = c.req.param("slug");
    const { results } = await c.env.DB.prepare(
      "SELECT id, title, category, description, author_email, created_at FROM docs_history WHERE slug = ? ORDER BY created_at DESC LIMIT 50"
    ).bind(slug).all();
    return c.json({ history: results ?? [] });
  } catch (err) {
    console.error("D1 doc history error:", err);
    return c.json({ history: [] });
  }
});

// ── PATCH /admin/docs/:slug/history/:id/restore — restore from history (admin) ──
docsRouter.patch("/admin/docs/:slug/history/:id/restore", ensureAdmin, async (c) => {
  try {
    const slug = c.req.param("slug");
    const id = c.req.param("id");
    
    interface DocHistoryRestoreRow {
      title: string;
      category: string;
      description: string;
      content: string;
    }
    const row = await c.env.DB.prepare(
      "SELECT title, category, description, content FROM docs_history WHERE id = ? AND slug = ?"
    ).bind(id, slug).first<DocHistoryRestoreRow>();

    if (!row) return c.json({ error: "Version not found" }, 404);

    const user = await getSessionUser(c);
    const email = user?.email || "anonymous_admin";

    // Capture CURRENT as history before restoring
    interface DocCurrentRow {
      slug: string;
      title: string;
      category: string;
      description: string;
      content: string;
      cf_email: string;
    }
    const current = await c.env.DB.prepare("SELECT slug, title, category, description, content, cf_email FROM docs WHERE slug = ?").bind(slug).first<DocCurrentRow>();
    if (current) {
        await c.env.DB.prepare(
          "INSERT INTO docs_history (slug, title, category, description, content, author_email) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(current.slug, current.title, current.category, current.description, current.content, current.cf_email || "unknown").run();
    }

    await c.env.DB.prepare(
      "UPDATE docs SET title = ?, category = ?, description = ?, content = ?, cf_email = ?, updated_at = datetime('now') WHERE slug = ?"
    ).bind(row.title, row.category, row.description, row.content, email, slug).run();

    return c.json({ success: true });
  } catch (err) {
    console.error("D1 doc restore error:", err);
    return c.json({ error: "Restore failed" }, 500);
  }
});

export default docsRouter;
