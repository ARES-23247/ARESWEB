import { Hono } from "hono";
import { Context } from "hono";
import { AppEnv, ensureAdmin, ensureAuth, getSessionUser, parsePagination, checkRateLimit, verifyTurnstile, createContentLifecycleRouter, rateLimitMiddleware, persistentRateLimitMiddleware } from "../middleware";
import { siteConfig } from "../../utils/site.config";
import { sendZulipMessage } from "../../utils/zulipSync";
import { emitNotification, notifyByRole } from "../../utils/notifications";


const docsRouter = new Hono<AppEnv>();


// ── GET /list — list all docs (admin) ──────────────────────
// Static route must be BEFORE /:slug
docsRouter.get("/list", ensureAdmin, async (c) => {
  try {
    const { limit, offset } = parsePagination(c, 100, 500);
    const { results } = await c.env.DB.prepare(
      "SELECT slug, title, category, sort_order, description, is_portfolio, is_executive_summary, is_deleted, status, revision_of FROM docs ORDER BY category, sort_order ASC LIMIT ? OFFSET ?"
    ).bind(limit, offset).all();
    return c.json({ docs: results ?? [] });
  } catch (err) {
    console.error("D1 admin docs list error:", err);
    return c.json({ docs: [] });
  }
});

// ── GET /export-all — export all docs (admin) ─────────────────
docsRouter.get("/export-all", ensureAdmin, async (c) => {
  try {
    // PII-S01: Refactor backup to only export documentation content, not infrastructure secrets.
    const { results } = await c.env.DB.prepare(
      `SELECT slug, title, category, sort_order, description, content, is_portfolio, is_executive_summary, status 
       FROM docs 
       WHERE is_deleted = 0 OR is_deleted IS NULL 
       ORDER BY category, sort_order`
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

// SEC-Z01: Cache doc search results with bounded size to prevent OOM
const MAX_CACHE_SIZE = 100;
const docSearchCache = new Map<string, { data: unknown; expiresAt: number }>();

function setCache(key: string, value: { data: unknown; expiresAt: number }) {
  if (docSearchCache.size >= MAX_CACHE_SIZE) {
    const firstKey = docSearchCache.keys().next().value;
    if (firstKey !== undefined) docSearchCache.delete(firstKey);
  }
  docSearchCache.set(key, value);
}

docsRouter.get("/search", persistentRateLimitMiddleware(10, 60), async (c) => {
  const q = c.req.query("q");
  if (!q || q.length < 3) return c.json({ results: [] });
  try {
    const safeQ = q.replace(/"/g, '""');

    const now = Date.now();
    const cached = docSearchCache.get(safeQ);
    if (cached && cached.expiresAt > now) {
      return c.json(cached.data);
    }

    const { results } = await c.env.DB.prepare(
      `SELECT f.slug, f.title, f.category, f.description FROM docs_fts f JOIN docs d ON f.slug = d.slug WHERE d.is_deleted = 0 AND d.status = 'published' AND f.docs_fts MATCH ? ORDER BY f.rank LIMIT 20`
    ).bind(`"${safeQ}"*`).all();

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
    const payload = { results: mapped };
    setCache(safeQ, { data: payload, expiresAt: now + 60000 });
    return c.json(payload);
  } catch (err) {
    console.error("D1 docs search error:", err);
    return c.json({ error: "Search failed" }, 500);
  }
});

// ── GET /docs — list all docs grouped by category ─────────────────────
docsRouter.get("/", persistentRateLimitMiddleware(10, 60), async (c) => {
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

// ── GET /:slug/detail — single doc (admin, no status filter) ──────
docsRouter.get("/:slug/detail", ensureAdmin, async (c) => {
  const slug = (c.req.param("slug") || "");
  try {
    const row = await c.env.DB.prepare(
      "SELECT slug, title, category, sort_order, description, content, is_portfolio, is_executive_summary, is_deleted, status, revision_of FROM docs WHERE slug = ?"
    ).bind(slug).first();

    if (!row) return c.json({ error: "Doc not found" }, 404);
    return c.json({ doc: row });
  } catch (err) {
    console.error("D1 admin doc detail error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

// ── GET /:slug/history — list doc history (authorized) ──────────
docsRouter.get("/:slug/history", ensureAuth, async (c) => {
  try {
    const slug = (c.req.param("slug") || "");
    const { results } = await c.env.DB.prepare(
      "SELECT id, title, category, description, created_at FROM docs_history WHERE slug = ? ORDER BY created_at DESC LIMIT 50"
    ).bind(slug).all();
    return c.json({ history: results ?? [] });
  } catch (err) {
    console.error("D1 doc history error:", err);
    return c.json({ history: [] });
  }
});

// ── GET /docs/:slug — single doc page ─────────────────────────────────
docsRouter.get("/:slug", async (c) => {
  const slug = (c.req.param("slug") || "");
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
    // PII-F02: Exclude raw emails from contributor list
    const { results: historyKeys } = await c.env.DB.prepare(
      `SELECT DISTINCT p.nickname, u.image as avatar
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

// ── POST /docs/:slug/feedback — Submit doc feedback ───────────────────
docsRouter.post("/:slug/feedback", async (c) => {
  // SEC-DoW: Unauthenticated D1 write — enforce strict per-IP write limit
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  if (!checkRateLimit(`feedback:${ip}`, 10, 60)) {
    return c.json({ error: "Too many submissions" }, 429);
  }

  try {
    const slug = (c.req.param("slug") || "");
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid request payload (malformed JSON or FormData)" }, 400);
    }
    const { isHelpful, comment, turnstileToken } = body;

    // SEC-DoW: Verify Turnstile challenge before D1 write
    const valid = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET_KEY, ip);
    if (!valid) {
      return c.json({ error: "Security verification failed" }, 403);
    }

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

/**
 * Prunes old doc history records, keeping only the last N versions.
 */
async function pruneDocHistory(c: Context<AppEnv>, slug: string, limit = 10) {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT id FROM docs_history WHERE slug = ? ORDER BY created_at DESC LIMIT 1 OFFSET ?"
    ).bind(slug, limit - 1).all();

    if (results && results.length > 0) {
      const oldestId = (results[0] as { id: number }).id;
      await c.env.DB.prepare(
        "DELETE FROM docs_history WHERE slug = ? AND id < ?"
      ).bind(slug, oldestId).run();
    }
  } catch (err) {
    console.error("[DocsHistory] Prune failed:", err);
  }
}

// ── POST /save — create/update a doc (auth required) ────────────────────
docsRouter.post("/save", ensureAuth, rateLimitMiddleware(15, 60), async (c) => {
  return handleDocSave(c);
});

async function handleDocSave(c: Context<AppEnv>) {
  try {
    let json;
    try {
      json = await c.req.json();
    } catch {
      return c.json({ error: "Invalid request payload (malformed JSON or FormData)" }, 400);
    }
    const { slug, title, category, sortOrder, description, content, isPortfolio, isExecutiveSummary, isDraft } = json;
    if (!slug || !title || !category || !content) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const user = await getSessionUser(c);
    const email = user?.email || "anonymous_admin";

    // Capture history before update
    interface DocsRowLegacy {
      slug: string;
      title: string;
      category: string;
      description: string;
      content: string;
      cf_email: string;
      is_portfolio: number;
      is_executive_summary: number;
    }
    const existing = await c.env.DB.prepare("SELECT slug, title, category, description, content, cf_email, is_portfolio, is_executive_summary FROM docs WHERE slug = ?").bind(slug).first<DocsRowLegacy>();
    
    if (existing) {
       await c.env.DB.prepare(
         `INSERT INTO docs_history (slug, title, category, description, content, author_email)
          VALUES (?, ?, ?, ?, ?, ?)`
       ).bind(existing.slug, existing.title, existing.category, existing.description, existing.content, existing.cf_email || "unknown").run();
       
       // EFF-N05: Prune old versions to prevent D1 bloat
       c.executionCtx.waitUntil(pruneDocHistory(c, slug, 10));
    }
    
    if (user?.role !== "admin" && existing) {
       // ── Shadow Revision Logic (Student Edits) ──
       const revSlug = `${slug}-rev-${Math.random().toString(36).substring(2, 6)}`;
       await c.env.DB.prepare(
        `INSERT INTO docs (slug, title, category, sort_order, description, content, cf_email, updated_at, is_portfolio, is_executive_summary, status, revision_of) 
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, 'pending', ?)`
       ).bind(revSlug, title, category, sortOrder || 0, description || "", content, email, isPortfolio ? 1 : 0, isExecutiveSummary ? 1 : 0, slug).run();
       
       c.executionCtx.waitUntil(
         notifyByRole(c, ["admin", "coach", "mentor"], {
           title: "📝 Doc Revision Pending",
           message: `"${title}" revised by ${email} needs admin approval.`,
           link: "/dashboard",
           external: true,
           priority: "medium"
         }).catch(err => console.error("[Docs] Admin revision notification failed:", err))
       );
       return c.json({ success: true, slug: revSlug });
    }

    const status = isDraft ? "pending" : (user?.role === "admin" ? "published" : "pending");

    await c.env.DB.prepare(
      `INSERT OR REPLACE INTO docs (slug, title, category, sort_order, description, content, cf_email, updated_at, is_portfolio, is_executive_summary, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)`
    ).bind(slug, title, category, sortOrder || 0, description || "", content, email, isPortfolio ? 1 : 0, isExecutiveSummary ? 1 : 0, status).run();
    
    // ── Zulip Doc Notification ──
    if (status === "published") {
      try {
        const action = existing ? "updated" : "created";
        c.executionCtx.waitUntil(
          sendZulipMessage(
            c.env,
            "engineering",
            "Engineering Docs",
            `📝 **Doc ${action}:** [${title}](${siteConfig.urls.base}/docs/${slug}) (${category})`
          ).catch(err => console.error("[Docs] Zulip notification failed:", err))
        );
      } catch { /* ignore */ }
    }

    // ── Notify admins and mentors of pending content ──
    if (status === "pending") {
      c.executionCtx.waitUntil(
        notifyByRole(c, ["admin", "coach", "mentor"], {
          title: "📝 Pending Document",
          message: `"${title}" submitted by ${email} needs review.`,
          link: "/dashboard",
          external: true,
          priority: "medium"
        }).catch(err => console.error("[Docs] Admin notification failed:", err))
      );
    }

    return c.json({ success: true, slug });
  } catch (err) {
    console.error("D1 doc write error:", err);
    return c.json({ error: "Write failed" }, 500);
  }
}

// ── PATCH /:slug/sort — update sort order (admin) ───────────────
docsRouter.patch("/:slug/sort", ensureAdmin, rateLimitMiddleware(15, 60), async (c) => {
  const slug = (c.req.param("slug") || "");
  let json;
  try {
    json = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request payload (malformed JSON or FormData)" }, 400);
  }
  const { sortOrder } = json;
  if (typeof sortOrder !== 'number') {
    return c.json({ error: "Invalid sortOrder" }, 400);
  }
  await c.env.DB.prepare("UPDATE docs SET sort_order = ? WHERE slug = ?").bind(sortOrder, slug).run();
  return c.json({ success: true });
});

// ── Generic Lifecycle Operations ──────────────────────────────────
docsRouter.route("/", createContentLifecycleRouter("docs", {
  onApprove: async (c, slug) => {
    // Merge logic
    type DocRow = { revision_of?: string; title: string; category: string; sort_order: number; description: string; content: string; is_portfolio: number; is_executive_summary: number; cf_email: string };
    const row = await c.env.DB.prepare("SELECT revision_of, title, category, sort_order, description, content, is_portfolio, is_executive_summary, cf_email FROM docs WHERE slug = ?").bind(slug).first<DocRow>();
    if (!row) return;

    if (row.revision_of) {
      await c.env.DB.batch([
        c.env.DB.prepare(
          "UPDATE docs SET title = ?, category = ?, sort_order = ?, description = ?, content = ?, is_portfolio = ?, is_executive_summary = ?, status = 'published', updated_at = datetime('now') WHERE slug = ?"
        ).bind(row.title, row.category, row.sort_order, row.description, row.content, row.is_portfolio ? 1 : 0, row.is_executive_summary ? 1 : 0, row.revision_of),
        c.env.DB.prepare("DELETE FROM docs WHERE slug = ?").bind(slug)
      ]);

      if (row.cf_email) {
        const author = await c.env.DB.prepare("SELECT id FROM user WHERE email = ?").bind(row.cf_email).first<{ id: string }>();
        if (author) {
          c.executionCtx.waitUntil(emitNotification(c, {
            userId: author.id,
            title: "Doc Merged",
            message: `Your changes to document "${row.title}" have been approved and published.`,
            link: `/docs/${row.revision_of}`,
            priority: "medium"
          }));
        }
      }
      return true;
    } else {
      if (row.cf_email) {
        const author = await c.env.DB.prepare("SELECT id FROM user WHERE email = ?").bind(row.cf_email).first<{ id: string }>();
        if (author) {
          c.executionCtx.waitUntil(emitNotification(c, {
            userId: author.id,
            title: "Doc Approved",
            message: `Your technical document "${row.title}" has been published.`,
            link: `/docs/${slug}`,
            priority: "medium"
          }));
        }
      }
      try {
        c.executionCtx.waitUntil(
          sendZulipMessage(
            c.env,
            "content-review",
            "Approvals",
            `✅ **Doc approved:** [${slug}](${siteConfig.urls.base}/docs/${slug})`
          ).catch(err => console.error("[Docs] Zulip approval notification failed:", err))
        );
      } catch { /* ignore */ }
    }
  },
  onReject: async (c, slug, reason) => {
    const row = await c.env.DB.prepare("SELECT title, cf_email FROM docs WHERE slug = ?").bind(slug).first<{ title: string, cf_email: string }>();
    if (row?.cf_email) {
      const author = await c.env.DB.prepare("SELECT id FROM user WHERE email = ?").bind(row.cf_email).first<{ id: string }>();
      if (author) {
        c.executionCtx.waitUntil(emitNotification(c, {
          userId: author.id,
          title: "Doc Rejected",
          message: `Your technical document "${row.title}" was rejected${reason ? `: "${reason}"` : "."}`,
          link: "/dashboard?tab=docs",
          priority: "high"
        }));
      }
    }
  }
}, "slug"));


// ── PATCH /:slug/history/:id/restore — restore from history (admin) ──
docsRouter.patch("/:slug/history/:id/restore", ensureAdmin, rateLimitMiddleware(15, 60), async (c) => {
  try {
    const slug = (c.req.param("slug") || "");
    const id = (c.req.param("id") || "");
    
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
        
        c.executionCtx.waitUntil(pruneDocHistory(c, slug, 10));
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
