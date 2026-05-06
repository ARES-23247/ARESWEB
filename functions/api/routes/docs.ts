import { Kysely, sql } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { OpenAPIHono } from "@hono/zod-openapi";
import { AppEnv, ensureAdmin, ensureAuth, getSessionUser, checkPersistentRateLimit, verifyTurnstile, emitNotification, notifyByRole, getSocialConfig, logAuditAction } from "../middleware";
import { triggerBackgroundReindex } from "./ai/autoReindex";
import { sendZulipMessage } from "../../utils/zulipSync";
import { siteConfig } from "../../utils/site.config";
import type { HonoContext } from "@shared/types/api";
import type { SelectableRow } from "@shared/types/database";
import * as docsRoutes from "../../../shared/routes/docs";

export const docsRouter = new OpenAPIHono<AppEnv>();

// SEC-F01: Authenticated users can submit revisions via /admin/save
docsRouter.use("/admin/save", ensureAuth);

// SEC-F02: All other /admin paths require full admin privileges.
// We list them explicitly to avoid matching /admin/save.
const adminPrivilegedPaths = [
  "/admin/list",
  "/admin/:slug/detail",
  "/admin/:slug/sort",
  "/admin/:slug/history",
  "/admin/:slug/history/*",
  "/admin/:slug/approve",
  "/admin/:slug/reject",
  "/admin/:slug/undelete",
  "/admin/:slug/purge",
  "/admin/:slug" // deleteDoc
];

adminPrivilegedPaths.forEach(path => {
  docsRouter.use(path, ensureAdmin);
});

// SEC-Z01: Cache doc search results
const MAX_CACHE_SIZE = 100;

type DocSearchResult = {
  slug: string;
  title: string;
  category: string;
  description: string | null;
};

type DocSearchPayload = {
  results: Array<{
    slug: string;
    title: string;
    category: string;
    description: string | null;
    snippet: string;
  }>;
};

// Type for doc with author info (from join query)
type DocWithAuthor = SelectableRow<"docs"> & {
  original_author_nickname?: string;
  original_author_avatar?: string;
};

// Type for partial doc results (fallback queries for older schema)
type PartialDoc = Pick<SelectableRow<"docs">, "slug" | "title" | "category" | "sort_order" | "description" | "is_portfolio" | "is_executive_summary" | "display_in_areslib" | "display_in_math_corner" | "display_in_science_corner"> & {
  is_deleted?: number;
  status?: string;
  revision_of?: string | null;
};

type DocSearchCacheEntry = {
  data: { results: DocSearchResult[] };
  expiresAt: number;
};

const docSearchCache = new Map<string, DocSearchCacheEntry>();

function setCache(key: string, value: DocSearchCacheEntry) {
  if (docSearchCache.size >= MAX_CACHE_SIZE) {
    const firstKey = docSearchCache.keys().next().value;
    if (firstKey !== undefined) docSearchCache.delete(firstKey);
  }
  docSearchCache.set(key, value);
}

/**
 * Sanitize FTS query to prevent SQL injection via SQLite FTS syntax.
 * Allows alphanumeric, spaces, hyphens, and periods. Uses proper FTS5 phrase search.
 */
const sanitizeFtsQuery = (query: string): string => {
  // Allow only alphanumeric, spaces, hyphens, and periods
  const cleanQ = (query || "").replace(/[^\w\s-.]/g, "").trim();
  if (!cleanQ) return "";
  // Escape double quotes for FTS5 phrase search and use prefix search
  return `"${cleanQ.replace(/"/g, '""')}*`;
};

async function pruneDocHistory(c: HonoContext, slug: string, limit = 10) {
  try {
    const db = c.get("db") as Kysely<DB>;
    const results = await db.selectFrom("docs_history")
      .select("id")
      .where("slug", "=", slug)
      .orderBy("created_at", "desc")
      .offset(limit - 1)
      .limit(1)
      .execute();

    if (results.length > 0) {
      const oldestId = results[0].id;
      await db.deleteFrom("docs_history")
        .where("slug", "=", slug)
        .where("id", "<", oldestId)
        .execute();
    }
  } catch { /* ignore */ }
}

// GET /docs - List all public docs
docsRouter.openapi(docsRoutes.getDocsRoute, async (c: any) => {
  try {
    const db = c.get("db") as Kysely<DB>;
    let results;
    try {
      results = await db.selectFrom("docs")
        .leftJoin("user as u", "docs.cf_email", "u.email")
        .leftJoin("user_profiles as p", "u.id", "p.user_id")
        .select([
          "docs.slug",
          "docs.title",
          "docs.category",
          "docs.sort_order",
          "docs.description",
          "docs.is_portfolio",
          "docs.is_executive_summary",
          "docs.is_deleted",
          "docs.status",
          "docs.revision_of",
          "docs.display_in_areslib",
          "docs.display_in_math_corner",
          "docs.display_in_science_corner",
          "p.nickname as original_author_nickname",
          "u.image as original_author_avatar"
        ])
        .where("docs.is_deleted", "=", 0)
        .where("docs.status", "=", "published")
        .orderBy("docs.category")
        .orderBy("docs.sort_order", "asc")
        .execute();
    } catch (_e) {
      results = await db.selectFrom("docs")
        .leftJoin("user as u", "docs.cf_email", "u.email")
        .leftJoin("user_profiles as p", "u.id", "p.user_id")
        .select([
          "docs.slug",
          "docs.title",
          "docs.category",
          "docs.sort_order",
          "docs.description",
          "docs.is_portfolio",
          "docs.is_executive_summary",
          "docs.display_in_areslib",
          "docs.display_in_math_corner",
          "docs.display_in_science_corner",
          "p.nickname as original_author_nickname",
          "u.image as original_author_avatar"
        ])
        .orderBy("docs.category")
        .orderBy("docs.sort_order", "asc")
        .execute() as DocWithAuthor[];
    }

    const docs = results.map(d => ({
      ...d,
      sort_order: Number(d.sort_order || 0),
      is_portfolio: Number(d.is_portfolio || 0),
      is_executive_summary: Number(d.is_executive_summary || 0),
      is_deleted: Number(d.is_deleted || 0),
      display_in_areslib: Number(d.display_in_areslib || 0),
      display_in_math_corner: Number(d.display_in_math_corner || 0),
      display_in_science_corner: Number(d.display_in_science_corner || 0),
      original_author_nickname: d.original_author_nickname || undefined,
      original_author_avatar: d.original_author_avatar || undefined
    }));

    return c.json({ docs }, 200 as any);
  } catch (e) {
    console.error("[Docs:List] Error", e);
    return c.json({ error: "Failed to fetch documents" }, 500 as any);
  }
});

// GET /docs/search - Search docs
docsRouter.openapi(docsRoutes.searchDocsRoute, async (c: any) => {
  const { q } = c.req.valid("query");
  if (!q || q.length < 3) return c.json({ results: [] }, 200 as any);

  // WR-18: Limit query length to prevent ReDoS via complex regex patterns
  if (q.length > 50) {
    return c.json({ error: "Query too long (max 50 characters)" }, 400 as any);
  }

  try {
    const now = Date.now();
    const cached = docSearchCache.get(q);
    if (cached && cached.expiresAt > now) return c.json(cached.data, 200);

    // Sanitize FTS query to prevent SQL injection
    const cleanQ = sanitizeFtsQuery(String(q));
    if (!cleanQ) return c.json({ results: [] }, 200 as any);

    const db = c.get("db") as Kysely<DB>;
    const results = await sql<{ slug: string, title: string, category: string, description: string | null }>`
      SELECT f.slug, f.title, f.category, f.description
      FROM docs_fts f
      JOIN docs d ON f.slug = d.slug
      WHERE d.is_deleted = 0 AND d.status = 'published' AND f.docs_fts MATCH ${cleanQ}
      ORDER BY f.rank LIMIT 20
    `.execute(db);

    const mapped = (results.rows ?? []).map((row) => {
      return {
        slug: String(row.slug),
        title: String(row.title),
        category: String(row.category),
        description: row.description || null,
        snippet: String(row.description || "")
      };
    });

    const payload: DocSearchPayload = { results: mapped };
    setCache(q, { data: payload, expiresAt: now + 60000 });
    return c.json(payload, 200);
  } catch (e) {
    console.error("[Docs:Search] Error", e);
    return c.json({ error: "Search failed" }, 500 as any);
  }
});

// GET /docs/admin/list - List all docs (admin view)
docsRouter.openapi(docsRoutes.adminListRoute, async (c: any) => {
  try {
    const db = c.get("db") as Kysely<DB>;
    let results;
    try {
      results = await db.selectFrom("docs")
        .select(["slug", "title", "category", "sort_order", "description", "is_portfolio", "is_executive_summary", "is_deleted", "status", "revision_of", "display_in_areslib", "display_in_math_corner", "display_in_science_corner"])
        .orderBy("category")
        .orderBy("sort_order", "asc")
        .execute();
    } catch (_e) {
      results = await db.selectFrom("docs")
        .select(["slug", "title", "category", "sort_order", "description", "is_portfolio", "is_executive_summary", "display_in_areslib", "display_in_math_corner", "display_in_science_corner"])
        .orderBy("category")
        .orderBy("sort_order", "asc")
        .execute() as PartialDoc[];
    }

    const docs = results.map(d => ({
      ...d,
      title: d.title || "Untitled",
      category: d.category || "Uncategorized",
      sort_order: Number(d.sort_order || 0),
      is_portfolio: Number(d.is_portfolio || 0),
      is_executive_summary: Number(d.is_executive_summary || 0),
      is_deleted: Number(d.is_deleted ?? 0),
      display_in_areslib: Number(d.display_in_areslib || 0),
      display_in_math_corner: Number(d.display_in_math_corner || 0),
      display_in_science_corner: Number(d.display_in_science_corner || 0)
    }));

    return c.json({ docs }, 200 as any);
  } catch (e) {
    console.error("[Docs:AdminList] Error", e);
    return c.json({ error: "Failed to fetch docs" }, 500 as any);
  }
});

// GET /docs/admin/{slug}/detail - Get doc detail (admin view)
docsRouter.openapi(docsRoutes.adminDetailRoute, async (c: any) => {
  const { slug } = c.req.valid("param");
  try {
    const db = c.get("db") as Kysely<DB>;
    let row;
    try {
      row = await db.selectFrom("docs")
        .select(["slug", "title", "category", "sort_order", "description", "content", "is_portfolio", "is_executive_summary", "is_deleted", "status", "revision_of", "zulip_stream", "zulip_topic", "display_in_areslib", "display_in_math_corner", "display_in_science_corner"])
        .where("slug", "=", slug)
        .executeTakeFirst();
    } catch (_e) {
      row = await db.selectFrom("docs")
        .select(["slug", "title", "category", "sort_order", "description", "content", "is_portfolio", "is_executive_summary", "display_in_areslib", "display_in_math_corner", "display_in_science_corner"])
        .where("slug", "=", slug)
        .executeTakeFirst() as PartialDoc | undefined;
    }

    if (!row) return c.json({ error: "Doc not found" }, 404 as any);

    return c.json({
      doc: {
        ...row,
        sort_order: Number(row.sort_order || 0),
        is_portfolio: Number(row.is_portfolio || 0),
        is_executive_summary: Number(row.is_executive_summary || 0),
        is_deleted: Number(row.is_deleted || 0),
        display_in_areslib: Number(row.display_in_areslib || 0),
        display_in_math_corner: Number(row.display_in_math_corner || 0),
        display_in_science_corner: Number(row.display_in_science_corner || 0)
      }
    }, 200 as any);
  } catch (e) {
    console.error("[Docs:AdminDetail] Error", e);
    return c.json({ error: "Database error" }, 500 as any);
  }
});

// GET /docs/{slug} - Get single doc with contributors
docsRouter.openapi(docsRoutes.getDocRoute, async (c: any) => {
  const { slug } = c.req.valid("param");
  try {
    const db = c.get("db") as Kysely<DB>;
    let row;
    try {
      row = await db.selectFrom("docs")
        .leftJoin("user as u", "docs.cf_email", "u.email")
        .leftJoin("user_profiles as p", "u.id", "p.user_id")
        .select([
          "docs.slug",
          "docs.title",
          "docs.category",
          "docs.description",
          "docs.content",
          "docs.updated_at",
          "docs.is_portfolio",
          "docs.is_executive_summary",
          "docs.is_deleted",
          "docs.status",
          "docs.revision_of",
          "docs.zulip_stream",
          "docs.zulip_topic",
          "docs.display_in_areslib",
          "docs.display_in_math_corner",
          "docs.display_in_science_corner",
          "p.nickname as original_author_nickname",
          "u.image as original_author_avatar"
        ])
        .where("docs.slug", "=", slug)
        .where("docs.is_deleted", "=", 0)
        .where("docs.status", "=", "published")
        .executeTakeFirst();
    } catch (_e) {
      row = await db.selectFrom("docs")
        .leftJoin("user as u", "docs.cf_email", "u.email")
        .leftJoin("user_profiles as p", "u.id", "p.user_id")
        .select([
          "docs.slug",
          "docs.title",
          "docs.category",
          "docs.description",
          "docs.content",
          "docs.updated_at",
          "docs.is_portfolio",
          "docs.is_executive_summary",
          "docs.display_in_areslib",
          "docs.display_in_math_corner",
          "docs.display_in_science_corner",
          "p.nickname as original_author_nickname",
          "u.image as original_author_avatar"
        ])
        .where("docs.slug", "=", slug)
        .executeTakeFirst() as DocWithAuthor | undefined;
    }

    if (!row) return c.json({ error: "Doc not found" }, 404 as any);

    const contributorRows = await db.selectFrom("docs_history as h")
      .leftJoin("user as u", "h.author_email", "u.email")
      .leftJoin("user_profiles as p", "u.id", "p.user_id")
      .select([
        "p.nickname",
        "u.image as avatar"
      ])
      .distinct()
      .where("h.slug", "=", slug)
      .where("h.author_email", "is not", null)
      .execute();

    const contributors = contributorRows.map(cnt => ({
      nickname: cnt.nickname || null,
      avatar: cnt.avatar || null
    }));

    return c.json({
      doc: {
        ...row,
        is_portfolio: Number(row.is_portfolio || 0),
        is_executive_summary: Number(row.is_executive_summary || 0),
        is_deleted: Number(row.is_deleted || 0),
        display_in_areslib: Number(row.display_in_areslib || 0),
        display_in_math_corner: Number(row.display_in_math_corner || 0),
        display_in_science_corner: Number(row.display_in_science_corner || 0),
        updated_at: row.updated_at || undefined,
        original_author_nickname: row.original_author_nickname || undefined,
        original_author_avatar: row.original_author_avatar || undefined
      },
      contributors
    }, 200 as any);
  } catch (e) {
    console.error("[Docs:Detail] Error", e);
    return c.json({ error: "Failed to fetch document detail" }, 500 as any);
  }
});

// DELETE /docs/admin/{slug} - Delete doc (soft delete)
docsRouter.openapi(docsRoutes.deleteDocRoute, async (c: any) => {
  const { slug } = c.req.valid("param");
  try {
    const db = c.get("db") as Kysely<DB>;
    const existing = await db.selectFrom("docs").selectAll().where("slug", "=", slug).executeTakeFirst();
    if (!existing) return c.json({ error: "Doc not found" }, 404 as any);

    await db.updateTable("docs").set({ is_deleted: 1 }).where("slug", "=", slug).execute();
    c.executionCtx?.waitUntil?.(logAuditAction(c, "DELETE_DOC", "docs", slug, JSON.stringify(existing)));
    triggerBackgroundReindex(c.executionCtx, c.get("db"), (c.env.AI as { run: (model: string, input: unknown) => Promise<unknown> }), c.env.VECTORIZE_DB);
    return c.json({ success: true }, 200 as any);
  } catch (e) {
    console.error("[Docs:Delete] Error", e);
    return c.json({ error: "Delete failed" }, 500 as any);
  }
});

// POST /docs/admin/save - Save or update doc
docsRouter.openapi(docsRoutes.saveDocRoute, async (c: any) => {
  try {
    const db = c.get("db") as Kysely<DB>;
    const { slug, title, category, sortOrder, description, content, isPortfolio, isExecutiveSummary, isDraft, displayInAreslib, displayInMathCorner, displayInScienceCorner } = c.req.valid("json");
    const user = await getSessionUser(c);
    const email = user?.email || "anonymous_admin";

    if (!slug) {
      return c.json({ error: "slug is required" }, 400 as any);
    }

    const existing = await db.selectFrom("docs")
      .select(["slug", "title", "category", "description", "content", "cf_email", "is_portfolio", "is_executive_summary"])
      .where("slug", "=", slug)
      .executeTakeFirst();

    if (existing) {
      await db.insertInto("docs_history")
        .values({
          slug: String(existing.slug),
          title: existing.title,
          category: existing.category,
          description: existing.description || "",
          content: existing.content,
          author_email: existing.cf_email || "unknown"
        })
        .execute();
      c.executionCtx.waitUntil(pruneDocHistory(c, slug, 10));
    }

    if (user?.role !== "admin" && existing) {
      const revSlug = `${slug}-rev-${Math.random().toString(36).substring(2, 6)}`;
      await db.insertInto("docs")
        .values({
          slug: revSlug,
          title: title || "",
          category: category || "",
          sort_order: sortOrder || 0,
          description: description || "",
          content: content || "",
          cf_email: email,
          updated_at: new Date().toISOString(),
          is_portfolio: isPortfolio ? 1 : 0,
          is_executive_summary: isExecutiveSummary ? 1 : 0,
          display_in_areslib: displayInAreslib ? 1 : 0,
          display_in_math_corner: displayInMathCorner ? 1 : 0,
          display_in_science_corner: displayInScienceCorner ? 1 : 0,
          status: "pending",
          revision_of: slug,
          zulip_stream: "documents",
          zulip_topic: `Doc: ${title || "Untitled"}`
        })
        .execute();

      c.executionCtx.waitUntil(notifyByRole(c, ["admin", "coach", "mentor"], {
        title: "📝 Doc Revision Pending",
        message: `"${title}" revised by ${email} needs admin approval.`,
        link: "/dashboard/manage_docs",
        external: true,
        priority: "medium"
      }));

      return c.json({ success: true, slug: revSlug }, 200 as any);
    }

    const status = isDraft ? "pending" : (user?.role === "admin" ? "published" : "pending");

    await db.insertInto("docs")
      .values({
        slug,
        title: title || "",
        category: category || "",
        sort_order: sortOrder || 0,
        description: description || "",
        content: content || "",
        cf_email: email,
        updated_at: new Date().toISOString(),
        is_portfolio: isPortfolio ? 1 : 0,
        is_executive_summary: isExecutiveSummary ? 1 : 0,
        display_in_areslib: displayInAreslib ? 1 : 0,
        display_in_math_corner: displayInMathCorner ? 1 : 0,
        display_in_science_corner: displayInScienceCorner ? 1 : 0,
        status,
        content_draft: null,
        zulip_stream: "documents",
        zulip_topic: `Doc: ${title || "Untitled"}`
      })
      .onConflict((oc) => oc.column("slug").doUpdateSet({
        title: title || "",
        category: category || "",
        sort_order: sortOrder || 0,
        description: description || "",
        content: content || "",
        cf_email: email,
        updated_at: new Date().toISOString(),
        is_portfolio: isPortfolio ? 1 : 0,
        is_executive_summary: isExecutiveSummary ? 1 : 0,
        display_in_areslib: displayInAreslib ? 1 : 0,
        display_in_math_corner: displayInMathCorner ? 1 : 0,
        display_in_science_corner: displayInScienceCorner ? 1 : 0,
        status,
        content_draft: null,
        zulip_stream: "documents",
        zulip_topic: `Doc: ${title || "Untitled"}`
      }))
      .execute();

    // Push snapshot to collaborative editor history
    if (content) {
      c.executionCtx.waitUntil(
        db.insertInto("document_history")
          .values({
            room_id: `doc_${slug}`,
            content: content,
            created_by: email,
            created_at: new Date().toISOString()
          })
          .execute()
      );
    }

    if (status === "published") {
      const action = existing ? "updated" : "created";
      c.executionCtx.waitUntil((async () => {
        const socialConfig = await getSocialConfig(c);
        await sendZulipMessage(socialConfig, "engineering", `Doc: ${title}`, `📝 **Doc ${action}:** [${title}](${siteConfig.urls.base}/docs/${slug}) (${category})`);
      })());
    }

    if (status === "pending") {
      c.executionCtx.waitUntil(notifyByRole(c, ["admin", "coach", "mentor"], {
        title: "📝 Pending Document",
        message: `"${title}" submitted by ${email} needs review.`,
        link: "/dashboard/manage_docs",
        external: true,
        priority: "medium"
      }));
    }

    triggerBackgroundReindex(c.executionCtx, c.get("db"), c.env.AI, c.env.VECTORIZE_DB);
    return c.json({ success: true, slug }, 200 as any);
  } catch (e) {
    console.error("[Docs:Save] Error", e);
    return c.json({ error: "Write failed" }, 500 as any);
  }
});

// PATCH /docs/admin/{slug}/sort - Update doc sort order
docsRouter.openapi(docsRoutes.updateSortRoute, async (c: any) => {
  const { slug } = c.req.valid("param");
  const { sortOrder } = c.req.valid("json");
  try {
    const db = c.get("db") as Kysely<DB>;
    await db.updateTable("docs").set({ sort_order: sortOrder }).where("slug", "=", slug).execute();
    return c.json({ success: true }, 200 as any);
  } catch (e) {
    console.error("[Docs:Sort] Error", e);
    return c.json({ error: "Sort update failed" }, 500 as any);
  }
});

// POST /docs/{slug}/feedback - Submit doc feedback
docsRouter.openapi(docsRoutes.submitFeedbackRoute, async (c: any) => {
  const { slug } = c.req.valid("param");
  const { isHelpful, comment, turnstileToken } = c.req.valid("json");
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  const ua = c.req.header("User-Agent") || "unknown";
  if (!(await checkPersistentRateLimit(c.get("db") as Kysely<DB>, `feedback:${ip}`, ua, 10, 60))) return c.json({ error: "Too many submissions" }, 429);

  const valid = await verifyTurnstile(turnstileToken || "", c.env.TURNSTILE_SECRET_KEY, ip);
  if (!valid) return c.json({ error: "Security verification failed" }, 403);

  if (comment && comment.length > 2000) return c.json({ error: "Comment too long" }, 400 as any);

  try {
    const db = c.get("db") as Kysely<DB>;
    await db.insertInto("docs_feedback").values({ slug, is_helpful: isHelpful ? 1 : 0, comment: comment || null }).execute();
    return c.json({ success: true }, 200 as any);
  } catch (e) {
    console.error("[Docs:Feedback] Error", e);
    return c.json({ error: "Feedback failed" }, 500 as any);
  }
});

// GET /docs/admin/{slug}/history - Get doc history
docsRouter.openapi(docsRoutes.getHistoryRoute, async (c: any) => {
  const { slug } = c.req.valid("param");
  try {
    const db = c.get("db") as Kysely<DB>;
    const results = await db.selectFrom("docs_history")
      .select(["id", "slug", "title", "category", "description", "author_email", "created_at"])
      .where("slug", "=", slug)
      .orderBy("created_at", "desc")
      .limit(50)
      .execute();

    const history = results.map(h => ({
      ...h,
      id: Number(h.id)
    }));

    return c.json({ history }, 200 as any);
  } catch (e) {
    console.error("[Docs:History] Error", e);
    return c.json({ error: "Failed to fetch history" }, 500 as any);
  }
});

// PATCH /docs/admin/{slug}/history/{id}/restore - Restore doc from history
docsRouter.openapi(docsRoutes.restoreHistoryRoute, async (c: any) => {
  const { slug, id } = c.req.valid("param");
  try {
    const db = c.get("db") as Kysely<DB>;
    const row = await db.selectFrom("docs_history")
      .select(["title", "category", "description", "content"])
      .where("id", "=", Number(id))
      .where("slug", "=", slug)
      .executeTakeFirst();

    if (!row) return c.json({ error: "Version not found" }, 404 as any);

    const user = await getSessionUser(c);
    const email = user?.email || "anonymous_admin";

    const current = await db.selectFrom("docs")
      .select(["slug", "title", "category", "description", "content", "cf_email"])
      .where("slug", "=", slug)
      .executeTakeFirst();

    if (current) {
      await db.insertInto("docs_history")
        .values({
          slug: String(current.slug),
          title: current.title,
          category: current.category,
          description: current.description || "",
          content: current.content,
          author_email: current.cf_email || "unknown"
        })
        .execute();
      c.executionCtx.waitUntil(pruneDocHistory(c, slug, 10));
    }

    await db.updateTable("docs")
      .set({
        title: row.title || "",
        category: row.category || "",
        description: row.description,
        content: row.content || "",
        cf_email: email,
        updated_at: new Date().toISOString()
      })
      .where("slug", "=", slug)
      .execute();

    return c.json({ success: true }, 200 as any);
  } catch (e) {
    console.error("[Docs:Restore] Error", e);
    return c.json({ error: "Restore failed" }, 500 as any);
  }
});

// POST /docs/admin/{slug}/approve - Approve doc
docsRouter.openapi(docsRoutes.approveDocRoute, async (c: any) => {
  const { slug } = c.req.valid("param");
  try {
    const db = c.get("db") as Kysely<DB>;
    const row = await db.selectFrom("docs").select(["revision_of", "title", "category", "sort_order", "description", "content", "is_portfolio", "is_executive_summary", "cf_email"]).where("slug", "=", slug).executeTakeFirst();
    if (!row) return c.json({ error: "Doc not found" }, 404 as any);

    if (row.revision_of) {
      await db.updateTable("docs")
        .set({ title: row.title, category: row.category, sort_order: row.sort_order, description: row.description, content: row.content, is_portfolio: row.is_portfolio, is_executive_summary: row.is_executive_summary, status: "published", updated_at: new Date().toISOString() })
        .where("slug", "=", row.revision_of)
        .execute();
      await db.deleteFrom("docs").where("slug", "=", slug).execute();

      c.executionCtx.waitUntil((async () => {
        const socialConfig = await getSocialConfig(c);
        await sendZulipMessage(socialConfig, "engineering", `Doc: ${row.title}`, `📝 **Doc updated:** [${row.title}](${siteConfig.urls.base}/docs/${row.revision_of}) (${row.category})`);
      })());

      if (row.cf_email) {
        const author = await db.selectFrom("user").select("id").where("email", "=", row.cf_email).executeTakeFirst();
        if (author) await emitNotification(c, { userId: String(author.id), title: "Doc Merged", message: `Your changes to document "${row.title}" have been approved.`, link: `/docs/${row.revision_of}`, priority: "medium" });
      }
    } else {
      await db.updateTable("docs").set({ status: "published" }).where("slug", "=", slug).execute();

      c.executionCtx.waitUntil((async () => {
        const socialConfig = await getSocialConfig(c);
        await sendZulipMessage(socialConfig, "engineering", `Doc: ${row.title}`, `📝 **Doc created:** [${row.title}](${siteConfig.urls.base}/docs/${slug}) (${row.category})`);
      })());

      if (row.cf_email) {
        const author = await db.selectFrom("user").select("id").where("email", "=", row.cf_email).executeTakeFirst();
        if (author) await emitNotification(c, { userId: String(author.id), title: "Doc Approved", message: `Your document "${row.title}" has been published.`, link: `/docs/${slug}`, priority: "medium" });
      }
    }
    return c.json({ success: true }, 200 as any);
  } catch (e) {
    console.error("[Docs:Approve] Error", e);
    return c.json({ error: "Approve failed" }, 500 as any);
  }
});

// POST /docs/admin/{slug}/reject - Reject doc
docsRouter.openapi(docsRoutes.rejectDocRoute, async (c: any) => {
  const { slug } = c.req.valid("param");
  const { reason } = c.req.valid("json");
  try {
    const db = c.get("db") as Kysely<DB>;
    const row = await db.selectFrom("docs").select(["title", "cf_email"]).where("slug", "=", slug).executeTakeFirst();
    await db.updateTable("docs").set({ status: "rejected" }).where("slug", "=", slug).execute();
    if (row?.cf_email) {
      const author = await db.selectFrom("user").select("id").where("email", "=", row.cf_email).executeTakeFirst();
      if (author) await emitNotification(c, { userId: String(author.id), title: "Doc Rejected", message: `Your document "${row.title}" was rejected${reason ? `: "${reason}"` : "."}`, link: "/dashboard/manage_docs", priority: "high" });
    }
    return c.json({ success: true }, 200 as any);
  } catch (e) {
    console.error("[Docs:Reject] Error", e);
    return c.json({ error: "Reject failed" }, 500 as any);
  }
});

// POST /docs/admin/{slug}/undelete - Undelete doc
docsRouter.openapi(docsRoutes.undeleteDocRoute, async (c: any) => {
  const { slug } = c.req.valid("param");
  try {
    const db = c.get("db") as Kysely<DB>;
    await db.updateTable("docs").set({ is_deleted: 0, status: "draft" }).where("slug", "=", slug).execute();
    return c.json({ success: true }, 200 as any);
  } catch (e) {
    console.error("[Docs:Undelete] Error", e);
    return c.json({ error: "Undelete failed" }, 500 as any);
  }
});

// POST /docs/admin/{slug}/purge - Permanently delete doc
docsRouter.openapi(docsRoutes.purgeDocRoute, async (c: any) => {
  const { slug } = c.req.valid("param");
  try {
    const db = c.get("db") as Kysely<DB>;

    // 1. Fetch content to find embedded assets
    const doc = await db.selectFrom("docs")
      .select("content")
      .where("slug", "=", slug)
      .executeTakeFirst();

    // 2. Physical R2 Cleanup (Regex search for internal asset URLs)
    if (doc?.content && c.env.ARES_STORAGE) {
      const assetRegex = /https:\/\/ares-media\.[^/]+\/([^"'\s)]+)/g;
      let match;
      while ((match = assetRegex.exec(doc.content)) !== null) {
        const key = match[1];
        c.executionCtx?.waitUntil?.(c.env.ARES_STORAGE.delete(key).catch(() => {}));
      }
    }

    await db.deleteFrom("docs").where("slug", "=", slug).execute();
    c.executionCtx?.waitUntil?.(db.deleteFrom("docs_history").where("slug", "=", slug).execute());
    c.executionCtx?.waitUntil?.(logAuditAction(c, "PURGE_DOC", "docs", slug, JSON.stringify(doc)));

    return c.json({ success: true }, 200 as any);
  } catch (_e) {
    return c.json({ error: "Purge failed" }, 500 as any);
  }
});

export default docsRouter;
