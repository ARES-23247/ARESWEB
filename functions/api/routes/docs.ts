/* eslint-disable @typescript-eslint/no-explicit-any */
import { typedHandler } from "../utils/handler";
import { sql } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";

import { eq, desc, asc, and, isNotNull, lt } from "drizzle-orm";

import { AppEnv, ensureAdmin, ensureAuth, getSessionUser, checkPersistentRateLimit, verifyTurnstile, emitNotification, notifyByRole, getSocialConfig, logAuditAction, getDb } from "../middleware";
import { edgeCacheMiddleware } from "../middleware/cache";
import { triggerBackgroundReindex } from "./ai/autoReindex";
import { sendZulipMessage } from "../../utils/zulipSync";
import { siteConfig } from "../../utils/site.config";
import type { HonoContext } from "@shared/types/api";
import * as docsRoutes from "../../../shared/routes/docs";

export const docsRouter = new OpenAPIHono<AppEnv>();

// Apply edge caching to public documentation routes (GET only, non-admin)
docsRouter.use("*", async (c, next) => {
  const path = c.req.path;
  if (c.req.method !== "GET" || path.includes("/admin/") || path.endsWith("/feedback")) {
    return next();
  }
  return edgeCacheMiddleware(180, 60, 300)(c, next);
});

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

adminPrivilegedPaths.forEach((path: string) => {
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

// Type for doc with author info (from join query with snake_case aliases)
type DocWithAuthor = {
  slug: string;
  title: string | null;
  category: string | null;
  description: string | null;
  content: string | null;
  updated_at: string | null;
  is_portfolio: number | null;
  is_executive_summary: number | null;
  is_deleted: number | null;
  status: string | null;
  revision_of: string | null;
  display_in_areslib: number | null;
  display_in_math_corner: number | null;
  display_in_science_corner: number | null;
  original_author_nickname?: string;
  original_author_avatar?: string;
};

// Type for partial doc results (fallback queries with snake_case aliases)
type PartialDoc = {
  slug: string;
  title: string | null;
  category: string | null;
  sort_order: number | null;
  description: string | null;
  is_portfolio: number | null;
  is_executive_summary: number | null;
  display_in_areslib: number | null;
  display_in_math_corner: number | null;
  display_in_science_corner: number | null;
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
    const db = getDb(c);
    const results = await db.select({ id: schema.docsHistory.id })
      .from(schema.docsHistory)
      .where(eq(schema.docsHistory.slug, slug))
      .orderBy(desc(schema.docsHistory.createdAt))
      .limit(1)
      .offset(limit - 1)
      .all();

    if (results.length > 0) {
      const oldestId = results[0].id;
      await db.delete(schema.docsHistory)
        .where(and(
          eq(schema.docsHistory.slug, slug),
          lt(schema.docsHistory.id, oldestId)
        ))
        .run();
    }
  } catch { /* ignore */ }
}

// GET /docs - List all public docs
docsRouter.openapi(docsRoutes.getDocsRoute, typedHandler<typeof docsRoutes.getDocsRoute>(async (c) => {
  try {
    const db = getDb(c);
    let results;
    try {
      results = await db.select({
        slug: schema.docs.slug,
        title: schema.docs.title,
        category: schema.docs.category,
        sort_order: schema.docs.sortOrder,
        description: schema.docs.description,
        is_portfolio: schema.docs.isPortfolio,
        is_executive_summary: schema.docs.isExecutiveSummary,
        is_deleted: schema.docs.isDeleted,
        status: schema.docs.status,
        revision_of: schema.docs.revisionOf,
        display_in_areslib: schema.docs.displayInAreslib,
        display_in_math_corner: schema.docs.displayInMathCorner,
        display_in_science_corner: schema.docs.displayInScienceCorner,
        original_author_nickname: schema.userProfiles.nickname,
        original_author_avatar: schema.user.image
      })
        .from(schema.docs)
        .leftJoin(schema.user, eq(schema.docs.cfEmail, schema.user.email))
        .leftJoin(schema.userProfiles, eq(schema.user.id, schema.userProfiles.userId))
        .where(and(
          eq(schema.docs.isDeleted, 0),
          eq(schema.docs.status, "published")
        ))
        .orderBy(asc(schema.docs.category), asc(schema.docs.sortOrder))
        .all();
    } catch (_e) {
      results = await db.select({
        slug: schema.docs.slug,
        title: schema.docs.title,
        category: schema.docs.category,
        sort_order: schema.docs.sortOrder,
        description: schema.docs.description,
        is_portfolio: schema.docs.isPortfolio,
        is_executive_summary: schema.docs.isExecutiveSummary,
        display_in_areslib: schema.docs.displayInAreslib,
        display_in_math_corner: schema.docs.displayInMathCorner,
        display_in_science_corner: schema.docs.displayInScienceCorner,
        original_author_nickname: schema.userProfiles.nickname,
        original_author_avatar: schema.user.image
      })
        .from(schema.docs)
        .leftJoin(schema.user, eq(schema.docs.cfEmail, schema.user.email))
        .leftJoin(schema.userProfiles, eq(schema.user.id, schema.userProfiles.userId))
        .orderBy(asc(schema.docs.category), asc(schema.docs.sortOrder))
        .all() as (DocWithAuthor | PartialDoc)[];
    }

    const docs = results.map((d: DocWithAuthor | PartialDoc) => ({
      ...d,
      sort_order: Number(d.sort_order || 0),
      is_portfolio: Number(d.is_portfolio || 0),
      is_executive_summary: Number(d.is_executive_summary || 0),
      is_deleted: Number(d.is_deleted ?? 0),
      display_in_areslib: Number(d.display_in_areslib || 0),
      display_in_math_corner: Number(d.display_in_math_corner || 0),
      display_in_science_corner: Number(d.display_in_science_corner || 0),
      original_author_nickname: ('original_author_nickname' in d ? d.original_author_nickname : undefined) || undefined,
      original_author_avatar: ('original_author_avatar' in d ? d.original_author_avatar : undefined) || undefined
    }));

    return c.json({ docs } as any, 200 as any);
  } catch (e) {
    console.error("[Docs:List] Error", e);
    return c.json({ error: "Failed to fetch documents" } as any, 500 as any);
  }
}));

// GET /docs/search - Search docs
docsRouter.openapi(docsRoutes.searchDocsRoute, typedHandler<typeof docsRoutes.searchDocsRoute>(async (c) => {
  const { q } = c.req.valid("query");
  if (!q || q.length < 3) return c.json({ results: [] } as any, 200 as any);

  // WR-18: Limit query length to prevent ReDoS via complex regex patterns
  if (q.length > 50) {
    return c.json({ error: "Query too long (max 50 characters)" } as any, 400 as any);
  }

  try {
    const now = Date.now();
    const cached = docSearchCache.get(q);
    if (cached && cached.expiresAt > now) return c.json(cached.data, 200);

    // Sanitize FTS query to prevent SQL injection
    const cleanQ = sanitizeFtsQuery(String(q));
    if (!cleanQ) return c.json({ results: [] } as any, 200 as any);

    const db = getDb(c);
    const results = await db.run(sql<{ slug: string, title: string, category: string, description: string | null }>`
      SELECT f.slug, f.title, f.category, f.description
      FROM docs_fts f
      JOIN docs d ON f.slug = d.slug
      WHERE d.is_deleted = 0 AND d.status = 'published' AND f.docs_fts MATCH ${cleanQ}
      ORDER BY f.rank LIMIT 20
    `);

    const mapped = ((results as { rows?: Array<{ slug: string; title: string; category: string; description: string | null }> }).rows ?? []).map((row: { slug: unknown; title: unknown; category: unknown; description: string | null }) => {
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
    return c.json(payload as any, 200 as any);
  } catch (e) {
    console.error("[Docs:Search] Error", e);
    return c.json({ error: "Search failed" } as any, 500 as any);
  }
}));

// GET /docs/admin/list - List all docs (admin view)
docsRouter.openapi(docsRoutes.adminListRoute, typedHandler<typeof docsRoutes.adminListRoute>(async (c) => {
  try {
    const db = getDb(c);
    let results;
    try {
      results = await db.select({
        slug: schema.docs.slug,
        title: schema.docs.title,
        category: schema.docs.category,
        sort_order: schema.docs.sortOrder,
        description: schema.docs.description,
        is_portfolio: schema.docs.isPortfolio,
        is_executive_summary: schema.docs.isExecutiveSummary,
        is_deleted: schema.docs.isDeleted,
        status: schema.docs.status,
        revision_of: schema.docs.revisionOf,
        display_in_areslib: schema.docs.displayInAreslib,
        display_in_math_corner: schema.docs.displayInMathCorner,
        display_in_science_corner: schema.docs.displayInScienceCorner
      })
        .from(schema.docs)
        .orderBy(asc(schema.docs.category), asc(schema.docs.sortOrder))
        .all();
    } catch (_e) {
      results = await db.select({
        slug: schema.docs.slug,
        title: schema.docs.title,
        category: schema.docs.category,
        sort_order: schema.docs.sortOrder,
        description: schema.docs.description,
        is_portfolio: schema.docs.isPortfolio,
        is_executive_summary: schema.docs.isExecutiveSummary,
        display_in_areslib: schema.docs.displayInAreslib,
        display_in_math_corner: schema.docs.displayInMathCorner,
        display_in_science_corner: schema.docs.displayInScienceCorner
      })
        .from(schema.docs)
        .orderBy(asc(schema.docs.category), asc(schema.docs.sortOrder))
        .all() as PartialDoc[];
    }

    const docs = results.map((d: PartialDoc) => ({
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

    return c.json({ docs } as any, 200 as any);
  } catch (e) {
    console.error("[Docs:AdminList] Error", e);
    return c.json({ error: "Failed to fetch docs" } as any, 500 as any);
  }
}));

// GET /docs/admin/{slug}/detail - Get doc detail (admin view)
docsRouter.openapi(docsRoutes.adminDetailRoute, typedHandler<typeof docsRoutes.adminDetailRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  try {
    const db = getDb(c);
    let row;
    try {
      row = await db.select({
        slug: schema.docs.slug,
        title: schema.docs.title,
        category: schema.docs.category,
        sort_order: schema.docs.sortOrder,
        description: schema.docs.description,
        content: schema.docs.content,
        is_portfolio: schema.docs.isPortfolio,
        is_executive_summary: schema.docs.isExecutiveSummary,
        is_deleted: schema.docs.isDeleted,
        status: schema.docs.status,
        revision_of: schema.docs.revisionOf,
        zulip_stream: schema.docs.zulipStream,
        zulip_topic: schema.docs.zulipTopic,
        display_in_areslib: schema.docs.displayInAreslib,
        display_in_math_corner: schema.docs.displayInMathCorner,
        display_in_science_corner: schema.docs.displayInScienceCorner
      })
        .from(schema.docs)
        .where(eq(schema.docs.slug, slug))
        .get();
    } catch (_e) {
      row = await db.select({
        slug: schema.docs.slug,
        title: schema.docs.title,
        category: schema.docs.category,
        sort_order: schema.docs.sortOrder,
        description: schema.docs.description,
        content: schema.docs.content,
        is_portfolio: schema.docs.isPortfolio,
        is_executive_summary: schema.docs.isExecutiveSummary,
        display_in_areslib: schema.docs.displayInAreslib,
        display_in_math_corner: schema.docs.displayInMathCorner,
        display_in_science_corner: schema.docs.displayInScienceCorner
      })
        .from(schema.docs)
        .where(eq(schema.docs.slug, slug))
        .get() as PartialDoc | undefined;
    }

    if (!row) return c.json({ error: "Doc not found" } as any, 404 as any);

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
    } as any, 200 as any);
  } catch (e) {
    console.error("[Docs:AdminDetail] Error", e);
    return c.json({ error: "Database error" } as any, 500 as any);
  }
}));

// GET /docs/{slug} - Get single doc with contributors
docsRouter.openapi(docsRoutes.getDocRoute, typedHandler<typeof docsRoutes.getDocRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  try {
    const db = getDb(c);
    let row;
    try {
      row = await db.select({
        slug: schema.docs.slug,
        title: schema.docs.title,
        category: schema.docs.category,
        description: schema.docs.description,
        content: schema.docs.content,
        updated_at: schema.docs.updatedAt,
        is_portfolio: schema.docs.isPortfolio,
        is_executive_summary: schema.docs.isExecutiveSummary,
        is_deleted: schema.docs.isDeleted,
        status: schema.docs.status,
        revision_of: schema.docs.revisionOf,
        zulip_stream: schema.docs.zulipStream,
        zulip_topic: schema.docs.zulipTopic,
        display_in_areslib: schema.docs.displayInAreslib,
        display_in_math_corner: schema.docs.displayInMathCorner,
        display_in_science_corner: schema.docs.displayInScienceCorner,
        original_author_nickname: schema.userProfiles.nickname,
        original_author_avatar: schema.user.image
      })
        .from(schema.docs)
        .leftJoin(schema.user, eq(schema.docs.cfEmail, schema.user.email))
        .leftJoin(schema.userProfiles, eq(schema.user.id, schema.userProfiles.userId))
        .where(and(
          eq(schema.docs.slug, slug),
          eq(schema.docs.isDeleted, 0),
          eq(schema.docs.status, "published")
        ))
        .get();
    } catch (_e) {
      row = await db.select({
        slug: schema.docs.slug,
        title: schema.docs.title,
        category: schema.docs.category,
        description: schema.docs.description,
        content: schema.docs.content,
        updated_at: schema.docs.updatedAt,
        is_portfolio: schema.docs.isPortfolio,
        is_executive_summary: schema.docs.isExecutiveSummary,
        display_in_areslib: schema.docs.displayInAreslib,
        display_in_math_corner: schema.docs.displayInMathCorner,
        display_in_science_corner: schema.docs.displayInScienceCorner,
        original_author_nickname: schema.userProfiles.nickname,
        original_author_avatar: schema.user.image
      })
        .from(schema.docs)
        .leftJoin(schema.user, eq(schema.docs.cfEmail, schema.user.email))
        .leftJoin(schema.userProfiles, eq(schema.user.id, schema.userProfiles.userId))
        .where(eq(schema.docs.slug, slug))
        .get() as DocWithAuthor | undefined;
    }

    if (!row) return c.json({ error: "Doc not found" } as any, 404 as any);

    const contributorRows = await db.select({
      nickname: schema.userProfiles.nickname,
      avatar: schema.user.image
    })
      .from(schema.docsHistory)
      .leftJoin(schema.user, eq(schema.docsHistory.authorEmail, schema.user.email))
      .leftJoin(schema.userProfiles, eq(schema.user.id, schema.userProfiles.userId))
      .where(and(
        eq(schema.docsHistory.slug, slug),
        isNotNull(schema.docsHistory.authorEmail)
      ))
      .all();

    const contributors = contributorRows.map((cnt: { nickname: string | null; avatar: string | null }) => ({
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
    } as any, 200 as any);
  } catch (e) {
    console.error("[Docs:Detail] Error", e);
    return c.json({ error: "Failed to fetch document detail" } as any, 500 as any);
  }
}));

// DELETE /docs/admin/{slug} - Delete doc (soft delete)
docsRouter.openapi(docsRoutes.deleteDocRoute, typedHandler<typeof docsRoutes.deleteDocRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  try {
    const db = getDb(c);
    const existing = await db.select().from(schema.docs).where(eq(schema.docs.slug, slug)).get();
    if (!existing) return c.json({ error: "Doc not found" } as any, 404 as any);

    await db.update(schema.docs).set({ isDeleted: 1 }).where(eq(schema.docs.slug, slug)).run();
    c.executionCtx?.waitUntil?.(logAuditAction(c, "DELETE_DOC", "docs", slug, JSON.stringify(existing)));
    triggerBackgroundReindex(c.executionCtx, db, c.env.AI as any, c.env.VECTORIZE_DB as any);
    return c.json({ success: true } as any, 200 as any);
  } catch (e) {
    console.error("[Docs:Delete] Error", e);
    return c.json({ error: "Delete failed" } as any, 500 as any);
  }
}));

// POST /docs/admin/save - Save or update doc
docsRouter.openapi(docsRoutes.saveDocRoute, typedHandler<typeof docsRoutes.saveDocRoute>(async (c) => {
  try {
    const db = getDb(c);
    const { slug, title, category, sortOrder, description, content, isPortfolio, isExecutiveSummary, isDraft, displayInAreslib, displayInMathCorner, displayInScienceCorner } = c.req.valid("json");
    const user = await getSessionUser(c);
    const email = user?.email || "anonymous_admin";

    if (!slug) {
      return c.json({ error: "slug is required" } as any, 400 as any);
    }

    const existing = await db.select({
      slug: schema.docs.slug,
      title: schema.docs.title,
      category: schema.docs.category,
      description: schema.docs.description,
      content: schema.docs.content,
      cf_email: schema.docs.cfEmail,
      is_portfolio: schema.docs.isPortfolio,
      is_executive_summary: schema.docs.isExecutiveSummary
    })
      .from(schema.docs)
      .where(eq(schema.docs.slug, slug))
      .get();

    if (existing) {
      await db.insert(schema.docsHistory)
        .values({
          slug: String(existing.slug),
          title: existing.title,
          category: existing.category,
          description: existing.description || "",
          content: existing.content,
          authorEmail: existing.cf_email || "unknown"
        })
        .run();
      c.executionCtx.waitUntil(pruneDocHistory(c, slug, 10));
    }

    if (user?.role !== "admin" && existing) {
      const revSlug = `${slug}-rev-${Math.random().toString(36).substring(2, 6)}`;
      await db.insert(schema.docs)
        .values({
          slug: revSlug,
          title: title || "",
          category: category || "",
          sortOrder: sortOrder || 0,
          description: description || "",
          content: content || "",
          cfEmail: email,
          updatedAt: new Date().toISOString(),
          isPortfolio: isPortfolio ? 1 : 0,
          isExecutiveSummary: isExecutiveSummary ? 1 : 0,
          displayInAreslib: displayInAreslib ? 1 : 0,
          displayInMathCorner: displayInMathCorner ? 1 : 0,
          displayInScienceCorner: displayInScienceCorner ? 1 : 0,
          status: "pending",
          revisionOf: slug,
          zulipStream: "documents",
          zulipTopic: `Doc: ${title || "Untitled"}`
        } as any)
        .run();

      c.executionCtx.waitUntil(notifyByRole(c, ["admin", "coach", "mentor"], {
        title: "📝 Doc Revision Pending",
        message: `"${title}" revised by ${email} needs admin approval.`,
        link: "/dashboard/manage_docs",
        external: true,
        priority: "medium"
      }));

      return c.json({ success: true, slug: revSlug } as any, 200 as any);
    }

    const status = isDraft ? "pending" : (user?.role === "admin" ? "published" : "pending");

    await db.insert(schema.docs)
      .values({
        slug,
        title: title || "",
        category: category || "",
        sortOrder: sortOrder || 0,
        description: description || "",
        content: content || "",
        cfEmail: email,
        updatedAt: new Date().toISOString(),
        isPortfolio: isPortfolio ? 1 : 0,
        isExecutiveSummary: isExecutiveSummary ? 1 : 0,
        displayInAreslib: displayInAreslib ? 1 : 0,
        displayInMathCorner: displayInMathCorner ? 1 : 0,
        displayInScienceCorner: displayInScienceCorner ? 1 : 0,
        status,
        contentDraft: null,
        zulipStream: "documents",
        zulipTopic: `Doc: ${title || "Untitled"}`
      } as any)
      .onConflictDoUpdate({
        target: schema.docs.slug,
        set: {
          title: title || "",
          category: category || "",
          sortOrder: sortOrder || 0,
          description: description || "",
          content: content || "",
          cfEmail: email,
          updatedAt: new Date().toISOString(),
          isPortfolio: isPortfolio ? 1 : 0,
          isExecutiveSummary: isExecutiveSummary ? 1 : 0,
          displayInAreslib: displayInAreslib ? 1 : 0,
          displayInMathCorner: displayInMathCorner ? 1 : 0,
          displayInScienceCorner: displayInScienceCorner ? 1 : 0,
          status,
          contentDraft: null,
          zulipStream: "documents",
          zulipTopic: `Doc: ${title || "Untitled"}`
        } as any
      })
      .run();

    // Push snapshot to collaborative editor history
    if (content) {
      c.executionCtx.waitUntil(
        db.insert(schema.documentHistory)
          .values({
            roomId: `doc_${slug}`,
            content: content,
            createdBy: email,
            createdAt: new Date().toISOString() as any
          })
          .run()
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

    triggerBackgroundReindex(c.executionCtx, db, c.env.AI, c.env.VECTORIZE_DB);
    return c.json({ success: true, slug } as any, 200 as any);
  } catch (e) {
    console.error("[Docs:Save] Error", e);
    return c.json({ error: "Write failed" } as any, 500 as any);
  }
}));

// PATCH /docs/admin/{slug}/sort - Update doc sort order
docsRouter.openapi(docsRoutes.updateSortRoute, typedHandler<typeof docsRoutes.updateSortRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  const { sortOrder } = c.req.valid("json");
  try {
    const db = getDb(c);
    await db.update(schema.docs).set({ sortOrder: sortOrder }).where(eq(schema.docs.slug, slug)).run();
    return c.json({ success: true } as any, 200 as any);
  } catch (e) {
    console.error("[Docs:Sort] Error", e);
    return c.json({ error: "Sort update failed" } as any, 500 as any);
  }
}));

// POST /docs/{slug}/feedback - Submit doc feedback
docsRouter.openapi(docsRoutes.submitFeedbackRoute, typedHandler<typeof docsRoutes.submitFeedbackRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  const { isHelpful, comment, turnstileToken } = c.req.valid("json");
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  const ua = c.req.header("User-Agent") || "unknown";
  const db = getDb(c);
  if (!(await checkPersistentRateLimit(db, `feedback:${ip}`, ua, 10, 60))) return c.json({ error: "Too many submissions" } as any, 429 as any);

  const valid = await verifyTurnstile(turnstileToken || "", c.env.TURNSTILE_SECRET_KEY, ip);
  if (!valid) return c.json({ error: "Security verification failed" } as any, 403 as any);

  if (comment && comment.length > 2000) return c.json({ error: "Comment too long" } as any, 400 as any);

  try {
    const db = getDb(c);
    await db.insert(schema.docsFeedback).values({ slug, isHelpful: isHelpful ? 1 : 0, comment: comment || null }).run();
    return c.json({ success: true } as any, 200 as any);
  } catch (e) {
    console.error("[Docs:Feedback] Error", e);
    return c.json({ error: "Feedback failed" } as any, 500 as any);
  }
}));

// GET /docs/admin/{slug}/history - Get doc history
docsRouter.openapi(docsRoutes.getHistoryRoute, typedHandler<typeof docsRoutes.getHistoryRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  try {
    const db = getDb(c);
    const results = await db.select({
      id: schema.docsHistory.id,
      slug: schema.docsHistory.slug,
      title: schema.docsHistory.title,
      category: schema.docsHistory.category,
      description: schema.docsHistory.description,
      author_email: schema.docsHistory.authorEmail,
      created_at: schema.docsHistory.createdAt
    })
      .from(schema.docsHistory)
      .where(eq(schema.docsHistory.slug, slug))
      .orderBy(desc(schema.docsHistory.createdAt))
      .limit(50)
      .all();

    const history = results.map((h: { id: number | string; slug: string; title: string | null; category: string | null; description: string | null; author_email: string | null; created_at: string | null }) => ({
      ...h,
      id: Number(h.id)
    }));

    return c.json({ history } as any, 200 as any);
  } catch (e) {
    console.error("[Docs:History] Error", e);
    return c.json({ error: "Failed to fetch history" } as any, 500 as any);
  }
}));

// PATCH /docs/admin/{slug}/history/{id}/restore - Restore doc from history
docsRouter.openapi(docsRoutes.restoreHistoryRoute, typedHandler<typeof docsRoutes.restoreHistoryRoute>(async (c) => {
  const { slug, id } = c.req.valid("param");
  try {
    const db = getDb(c);
    const row = await db.select({
      title: schema.docsHistory.title,
      category: schema.docsHistory.category,
      description: schema.docsHistory.description,
      content: schema.docsHistory.content
    })
      .from(schema.docsHistory)
      .where(and(
        eq(schema.docsHistory.id, Number(id)),
        eq(schema.docsHistory.slug, slug)
      ))
      .get();

    if (!row) return c.json({ error: "Version not found" } as any, 404 as any);

    const user = await getSessionUser(c);
    const email = user?.email || "anonymous_admin";

    const current = await db.select({
      slug: schema.docs.slug,
      title: schema.docs.title,
      category: schema.docs.category,
      description: schema.docs.description,
      content: schema.docs.content,
      cf_email: schema.docs.cfEmail
    })
      .from(schema.docs)
      .where(eq(schema.docs.slug, slug))
      .get();

    if (current) {
      await db.insert(schema.docsHistory)
        .values({
          slug: String(current.slug),
          title: current.title,
          category: current.category,
          description: current.description || "",
          content: current.content,
          authorEmail: current.cf_email || "unknown"
        })
        .run();
      c.executionCtx.waitUntil(pruneDocHistory(c, slug, 10));
    }

    await db.update(schema.docs)
      .set({
        title: row.title || "",
        category: row.category || "",
        description: row.description,
        content: row.content || "",
        cfEmail: email,
        updatedAt: new Date().toISOString()
      })
      .where(eq(schema.docs.slug, slug))
      .run();

    return c.json({ success: true } as any, 200 as any);
  } catch (e) {
    console.error("[Docs:Restore] Error", e);
    return c.json({ error: "Restore failed" } as any, 500 as any);
  }
}));

// POST /docs/admin/{slug}/approve - Approve doc
docsRouter.openapi(docsRoutes.approveDocRoute, typedHandler<typeof docsRoutes.approveDocRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  try {
    const db = getDb(c);
    const row = await db.select({
      revision_of: schema.docs.revisionOf,
      title: schema.docs.title,
      category: schema.docs.category,
      sort_order: schema.docs.sortOrder,
      description: schema.docs.description,
      content: schema.docs.content,
      is_portfolio: schema.docs.isPortfolio,
      is_executive_summary: schema.docs.isExecutiveSummary,
      cf_email: schema.docs.cfEmail
    })
      .from(schema.docs)
      .where(eq(schema.docs.slug, slug))
      .get();
    if (!row) return c.json({ error: "Doc not found" } as any, 404 as any);

    if (row.revision_of) {
      await db.update(schema.docs)
        .set({
          title: row.title,
          category: row.category,
          sortOrder: row.sort_order,
          description: row.description,
          content: row.content,
          isPortfolio: row.is_portfolio,
          isExecutiveSummary: row.is_executive_summary,
          status: "published",
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.docs.slug, row.revision_of))
        .run();
      await db.delete(schema.docs).where(eq(schema.docs.slug, slug)).run();

      c.executionCtx.waitUntil((async () => {
        const socialConfig = await getSocialConfig(c);
        await sendZulipMessage(socialConfig, "engineering", `Doc: ${row.title}`, `📝 **Doc updated:** [${row.title}](${siteConfig.urls.base}/docs/${row.revision_of}) (${row.category})`);
      })());

      if (row.cf_email) {
        const author = await db.select({ id: schema.user.id })
          .from(schema.user)
          .where(eq(schema.user.email, row.cf_email))
          .get();
        if (author) await emitNotification(c, { userId: String(author.id), title: "Doc Merged", message: `Your changes to document "${row.title}" have been approved.`, link: `/docs/${row.revision_of}`, priority: "medium" });
      }
    } else {
      await db.update(schema.docs).set({ status: "published" }).where(eq(schema.docs.slug, slug)).run();

      c.executionCtx.waitUntil((async () => {
        const socialConfig = await getSocialConfig(c);
        await sendZulipMessage(socialConfig, "engineering", `Doc: ${row.title}`, `📝 **Doc created:** [${row.title}](${siteConfig.urls.base}/docs/${slug}) (${row.category})`);
      })());

      if (row.cf_email) {
        const author = await db.select({ id: schema.user.id })
          .from(schema.user)
          .where(eq(schema.user.email, row.cf_email))
          .get();
        if (author) await emitNotification(c, { userId: String(author.id), title: "Doc Approved", message: `Your document "${row.title}" has been published.`, link: `/docs/${slug}`, priority: "medium" });
      }
    }
    return c.json({ success: true } as any, 200 as any);
  } catch (e) {
    console.error("[Docs:Approve] Error", e);
    return c.json({ error: "Approve failed" } as any, 500 as any);
  }
}));

// POST /docs/admin/{slug}/reject - Reject doc
docsRouter.openapi(docsRoutes.rejectDocRoute, typedHandler<typeof docsRoutes.rejectDocRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  const { reason } = c.req.valid("json");
  try {
    const db = getDb(c);
    const row = await db.select({
      title: schema.docs.title,
      cf_email: schema.docs.cfEmail
    })
      .from(schema.docs)
      .where(eq(schema.docs.slug, slug))
      .get();
    await db.update(schema.docs).set({ status: "rejected" }).where(eq(schema.docs.slug, slug)).run();
    if (row?.cf_email) {
      const author = await db.select({ id: schema.user.id })
        .from(schema.user)
        .where(eq(schema.user.email, row.cf_email))
        .get();
      if (author) await emitNotification(c, { userId: String(author.id), title: "Doc Rejected", message: `Your document "${row.title}" was rejected${reason ? `: "${reason}"` : "."}`, link: "/dashboard/manage_docs", priority: "high" });
    }
    return c.json({ success: true } as any, 200 as any);
  } catch (e) {
    console.error("[Docs:Reject] Error", e);
    return c.json({ error: "Reject failed" } as any, 500 as any);
  }
}));

// POST /docs/admin/{slug}/undelete - Undelete doc
docsRouter.openapi(docsRoutes.undeleteDocRoute, typedHandler<typeof docsRoutes.undeleteDocRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  try {
    const db = getDb(c);
    await db.update(schema.docs).set({ isDeleted: 0, status: "draft" }).where(eq(schema.docs.slug, slug)).run();
    return c.json({ success: true } as any, 200 as any);
  } catch (e) {
    console.error("[Docs:Undelete] Error", e);
    return c.json({ error: "Undelete failed" } as any, 500 as any);
  }
}));

// POST /docs/admin/{slug}/purge - Permanently delete doc
docsRouter.openapi(docsRoutes.purgeDocRoute, typedHandler<typeof docsRoutes.purgeDocRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  try {
    const db = getDb(c);

    // 1. Fetch content to find embedded assets
    const doc = await db.select({ content: schema.docs.content })
      .from(schema.docs)
      .where(eq(schema.docs.slug, slug))
      .get();

    // 2. Physical R2 Cleanup (Regex search for internal asset URLs)
    if (doc?.content && c.env.ARES_STORAGE) {
      const assetRegex = /https:\/\/ares-media\.[^/]+\/([^"'\s)]+)/g;
      let match;
      while ((match = assetRegex.exec(doc.content)) !== null) {
        const key = match[1];
        c.executionCtx?.waitUntil?.(c.env.ARES_STORAGE.delete(key).catch(() => {}));
      }
    }

    await db.delete(schema.docs).where(eq(schema.docs.slug, slug)).run();
    c.executionCtx?.waitUntil?.(db.delete(schema.docsHistory).where(eq(schema.docsHistory.slug, slug)).run());
    c.executionCtx?.waitUntil?.(logAuditAction(c, "PURGE_DOC", "docs", slug, JSON.stringify(doc)));

    return c.json({ success: true } as any, 200 as any);
  } catch (_e) {
    return c.json({ error: "Purge failed" } as any, 500 as any);
  }
}));

// Export all docs as JSON
docsRouter.openapi(docsRoutes.exportAllDocsRoute, typedHandler<typeof docsRoutes.exportAllDocsRoute>(async (c) => {
  try {
    const db = getDb(c);
    const docs = await db.select().from(schema.docs).orderBy(desc(schema.docs.updatedAt)).all();
    return c.json({ docs } as any, 200 as any);
  } catch (_e) {
    return c.json({ error: "Export failed" } as any, 500 as any);
  }
}));

// Export single doc as Markdown
docsRouter.get("/admin/:slug/export", async (c) => {
  try {
    const { slug } = c.req.param();
    const db = getDb(c);
    const doc = await db.select({
      title: schema.docs.title,
      content: schema.docs.content,
      category: schema.docs.category,
    }).from(schema.docs).where(eq(schema.docs.slug, slug)).get();

    if (!doc) {
      return c.json({ error: "Doc not found" }, 404);
    }

    // Convert Tiptap JSON to Markdown if needed
    let markdownContent = doc.content || "";
    try {
      const parsed = JSON.parse(doc.content);
      if (parsed.type === "doc") {
        // Simple Tiptap to Markdown conversion
        markdownContent = tiptapToMarkdown(parsed);
      }
    } catch {
      // Content is already plain text or Markdown
    }

    const markdown = `# ${doc.title || slug}\n\n**Category:** ${doc.category || "General"}\n\n${markdownContent}`;
    return c.text(markdown, 200, { "Content-Type": "text/plain; charset=utf-8" });
  } catch (_e) {
    return c.json({ error: "Export failed" }, 500);
  }
});

// TipTap node types
interface TipTapTextNode {
  type: "text";
  text?: string;
}

interface TipTapAttributes {
  level?: number;
  [key: string]: unknown;
}

interface TipTapNode {
  type: string;
  text?: string;
  attrs?: TipTapAttributes;
  content?: TipTapNode[];
}

// Simple Tiptap JSON to Markdown converter
function tiptapToMarkdown(node: TipTapNode | TipTapTextNode): string {
  if (!node) return "";

  if (node.type === "text") {
    return node.text || "";
  }

  const content = (node as TipTapNode).content || [];
  let result = "";

  for (const child of content) {
    const childText = tiptapToMarkdown(child);
    switch (child.type) {
      case "paragraph":
        result += childText + "\n\n";
        break;
      case "heading": {
        const level = "#".repeat(child.attrs?.level || 1);
        result += `${level} ${childText}\n\n`;
        break;
      }
      case "bulletList":
        result += childText.split("\n").map((line: string) => line ? `- ${line}` : "").join("\n") + "\n\n";
        break;
      case "orderedList":
        result += childText.split("\n").map((line: string, i: number) => line ? `${i + 1}. ${line}` : "").join("\n") + "\n\n";
        break;
      case "listItem":
        result += childText + "\n";
        break;
      case "bold":
        result += `**${childText}**`;
        break;
      case "italic":
        result += `*${childText}*`;
        break;
      case "codeBlock":
        result += `\`\`\`\n${childText}\n\`\`\`\n\n`;
        break;
      default:
        result += childText;
    }
  }

  return result;
}

export default docsRouter;
