import { ApiError } from "../middleware/errorHandler";
import { QUERY_LIMITS } from "../utils/queryLimits";
import { sql } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";

import { eq, desc, asc, and, isNotNull, lt } from "drizzle-orm";

import { AppEnv, ensureAdmin, ensureAuth, getSessionUser, checkPersistentRateLimit, verifyTurnstile, emitNotification, notifyByRole, getSocialConfig, logAuditAction, getDb } from "../middleware";
import { edgeCacheMiddleware } from "../middleware/cache";
import { triggerBackgroundReindex } from "./ai/autoReindex";
import { sendZulipMessage } from "../../utils/zulipSync";
import { siteConfig } from "../../utils/site.config";
import { safeWaitUntil } from "../utils/safeWaitUntil";

import type { HonoContext } from "@shared/types/api";
import * as docsRoutes from "../../../shared/routes/docs";
import { z } from "zod";

// Infer response types from route schemas
type SearchDocsResponse = z.infer<typeof docsRoutes.searchDocsRoute.responses[200]["content"]["application/json"]["schema"]>;

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

// Type for doc with author info (from join query with camelCase aliases)
type DocWithAuthor = {
  slug: string;
  title: string | null;
  category: string | null;
  description: string | null;
  content: string | null;
  updatedAt: string | null;
  isPortfolio: number | null;
  isExecutiveSummary: number | null;
  isDeleted: number | null;
  status: string | null;
  revisionOf: string | null;
  displayInAreslib: number | null;
  displayInMathCorner: number | null;
  displayInScienceCorner: number | null;
  originalAuthorNickname?: string;
  originalAuthorAvatar?: string;
};

// Type for partial doc results (fallback queries with camelCase aliases)
type PartialDoc = {
  slug: string;
  title: string | null;
  category: string | null;
  sortOrder: number | null;
  description: string | null;
  isPortfolio: number | null;
  isExecutiveSummary: number | null;
  displayInAreslib: number | null;
  displayInMathCorner: number | null;
  displayInScienceCorner: number | null;
  isDeleted?: number;
  status?: string;
  revisionOf?: string | null;
};

type DocSearchCacheEntry = {
  data: SearchDocsResponse;
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
docsRouter.openapi(docsRoutes.getDocsRoute, createTypedHandler(docsRoutes.getDocsRoute, async (c) => {
    const db = getDb(c);
    let results;
    try {
      results = await db.select({
        slug: schema.docs.slug,
        title: schema.docs.title,
        category: schema.docs.category,
        sortOrder: schema.docs.sortOrder,
        description: schema.docs.description,
        isPortfolio: schema.docs.isPortfolio,
        isExecutiveSummary: schema.docs.isExecutiveSummary,
        isDeleted: schema.docs.isDeleted,
        status: schema.docs.status,
        revisionOf: schema.docs.revisionOf,
        displayInAreslib: schema.docs.displayInAreslib,
        displayInMathCorner: schema.docs.displayInMathCorner,
        displayInScienceCorner: schema.docs.displayInScienceCorner,
        originalAuthorNickname: schema.userProfiles.nickname,
        originalAuthorAvatar: schema.user.image
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
        sortOrder: schema.docs.sortOrder,
        description: schema.docs.description,
        isPortfolio: schema.docs.isPortfolio,
        isExecutiveSummary: schema.docs.isExecutiveSummary,
        displayInAreslib: schema.docs.displayInAreslib,
        displayInMathCorner: schema.docs.displayInMathCorner,
        displayInScienceCorner: schema.docs.displayInScienceCorner,
        originalAuthorNickname: schema.userProfiles.nickname,
        originalAuthorAvatar: schema.user.image
      })
        .from(schema.docs)
        .leftJoin(schema.user, eq(schema.docs.cfEmail, schema.user.email))
        .leftJoin(schema.userProfiles, eq(schema.user.id, schema.userProfiles.userId))
        .orderBy(asc(schema.docs.category), asc(schema.docs.sortOrder))
        .all() as (DocWithAuthor | PartialDoc)[];
    }

    const docs = (results as (DocWithAuthor | PartialDoc)[]).map((d) => ({
      slug: String(d.slug),
      title: d.title ?? null,
      category: d.category ?? null,
      description: d.description ?? null,
      sortOrder: Number('sortOrder' in d ? d.sortOrder : 0),
      isPortfolio: Number(d.isPortfolio ?? 0),
      isExecutiveSummary: Number(d.isExecutiveSummary ?? 0),
      isDeleted: Number(d.isDeleted ?? 0),
      status: d.status ?? null,
      revisionOf: d.revisionOf ?? null,
      zulipStream: undefined,
      zulipTopic: undefined,
      displayInAreslib: Number(d.displayInAreslib ?? 0),
      displayInMathCorner: Number(d.displayInMathCorner ?? 0),
      displayInScienceCorner: Number(d.displayInScienceCorner ?? 0),
      originalAuthorNickname: ('originalAuthorNickname' in d ? d.originalAuthorNickname : undefined),
      originalAuthorAvatar: ('originalAuthorAvatar' in d ? d.originalAuthorAvatar : undefined)
    }));

    return c.json({ docs }, 200);
}));

// GET /docs/search - Search docs
docsRouter.openapi(docsRoutes.searchDocsRoute, createTypedHandler(docsRoutes.searchDocsRoute, async (c, { query }) => {
  const { q } = query;
  if (!q || q.length < 3) {
    return c.json({ results: [] }, 200);
  }

  // WR-18: Limit query length to prevent ReDoS via complex regex patterns
  if (q.length > 50) {
    throw new ApiError("Query too long (max 50 characters)", 400);
  }

    const now = Date.now();
    const cached = docSearchCache.get(q);
    if (cached && cached.expiresAt > now) {
      return c.json(cached.data, 200);
    }

    // Sanitize FTS query to prevent SQL injection
    const cleanQ = sanitizeFtsQuery(String(q));
    if (!cleanQ) {
      return c.json({ results: [] }, 200);
    }

    const db = getDb(c);
    const results = await db.run(sql<{ slug: string, title: string, category: string, description: string | null }>`
      SELECT f.slug, f.title, f.category, f.description
      FROM docs_fts f
      JOIN docs d ON f.slug = d.slug
      WHERE d.isDeleted = 0 AND d.status = 'published' AND f.docs_fts MATCH ${cleanQ}
      ORDER BY f.rank LIMIT ${QUERY_LIMITS.DEFAULT_PAGE}
    `);

    type SearchRow = { slug: unknown; title: unknown; category: unknown; description: string | null };
    const rows = (results as { rows?: Array<SearchRow> }).rows ?? [];
    const mapped = rows.map((row: SearchRow) => {
      return {
        slug: String(row.slug),
        title: String(row.title),
        category: String(row.category),
        description: row.description ?? null,
        snippet: String(row.description ?? "")
      };
    });

    const payload = { results: mapped };
    setCache(q, { data: payload, expiresAt: now + 60000 });
    return c.json(payload, 200);
}));

// GET /docs/admin/list - List all docs (admin view)
docsRouter.openapi(docsRoutes.adminListRoute, createTypedHandler(docsRoutes.adminListRoute, async (c) => {
    const db = getDb(c);
    let results;
    try {
      results = await db.select({
        slug: schema.docs.slug,
        title: schema.docs.title,
        category: schema.docs.category,
        sortOrder: schema.docs.sortOrder,
        description: schema.docs.description,
        isPortfolio: schema.docs.isPortfolio,
        isExecutiveSummary: schema.docs.isExecutiveSummary,
        isDeleted: schema.docs.isDeleted,
        status: schema.docs.status,
        revisionOf: schema.docs.revisionOf,
        displayInAreslib: schema.docs.displayInAreslib,
        displayInMathCorner: schema.docs.displayInMathCorner,
        displayInScienceCorner: schema.docs.displayInScienceCorner
      })
        .from(schema.docs)
        .orderBy(asc(schema.docs.category), asc(schema.docs.sortOrder))
        .all();
    } catch (_e) {
      results = await db.select({
        slug: schema.docs.slug,
        title: schema.docs.title,
        category: schema.docs.category,
        sortOrder: schema.docs.sortOrder,
        description: schema.docs.description,
        isPortfolio: schema.docs.isPortfolio,
        isExecutiveSummary: schema.docs.isExecutiveSummary,
        displayInAreslib: schema.docs.displayInAreslib,
        displayInMathCorner: schema.docs.displayInMathCorner,
        displayInScienceCorner: schema.docs.displayInScienceCorner
      })
        .from(schema.docs)
        .orderBy(asc(schema.docs.category), asc(schema.docs.sortOrder))
        .all() as PartialDoc[];
    }

    const docs = results.map((d) => ({
      ...d,
      title: d.title ?? "Untitled",
      category: d.category ?? "Uncategorized",
      description: d.description ?? null,
      sortOrder: Number(d.sortOrder ?? 0),
      isPortfolio: Number(d.isPortfolio ?? 0),
      isExecutiveSummary: Number(d.isExecutiveSummary ?? 0),
      isDeleted: Number(d.isDeleted ?? 0),
      status: d.status ?? null,
      revisionOf: d.revisionOf ?? null,
      zulipStream: undefined,
      zulipTopic: undefined,
      displayInAreslib: Number(d.displayInAreslib ?? 0),
      displayInMathCorner: Number(d.displayInMathCorner ?? 0),
      displayInScienceCorner: Number(d.displayInScienceCorner ?? 0)
    }));

    return c.json({ docs }, 200);
}));

// GET /docs/admin/{slug}/detail - Get doc detail (admin view)
docsRouter.openapi(docsRoutes.adminDetailRoute, createTypedHandler(docsRoutes.adminDetailRoute, async (c, { params }) => {
  const { slug } = params;
    const db = getDb(c);
    let row;
    try {
      row = await db.select({
        slug: schema.docs.slug,
        title: schema.docs.title,
        category: schema.docs.category,
        sortOrder: schema.docs.sortOrder,
        description: schema.docs.description,
        content: schema.docs.content,
        isPortfolio: schema.docs.isPortfolio,
        isExecutiveSummary: schema.docs.isExecutiveSummary,
        isDeleted: schema.docs.isDeleted,
        status: schema.docs.status,
        revisionOf: schema.docs.revisionOf,
        zulipStream: schema.docs.zulipStream,
        zulipTopic: schema.docs.zulipTopic,
        displayInAreslib: schema.docs.displayInAreslib,
        displayInMathCorner: schema.docs.displayInMathCorner,
        displayInScienceCorner: schema.docs.displayInScienceCorner
      })
        .from(schema.docs)
        .where(eq(schema.docs.slug, slug))
        .get();
    } catch (_e) {
      row = await db.select({
        slug: schema.docs.slug,
        title: schema.docs.title,
        category: schema.docs.category,
        sortOrder: schema.docs.sortOrder,
        description: schema.docs.description,
        content: schema.docs.content,
        isPortfolio: schema.docs.isPortfolio,
        isExecutiveSummary: schema.docs.isExecutiveSummary,
        displayInAreslib: schema.docs.displayInAreslib,
        displayInMathCorner: schema.docs.displayInMathCorner,
        displayInScienceCorner: schema.docs.displayInScienceCorner
      })
        .from(schema.docs)
        .where(eq(schema.docs.slug, slug))
        .get() as PartialDoc | undefined;
    }

    if (!row) {
      throw new ApiError("Doc not found", 404);
    }

    const doc = {
      slug: String(row.slug),
      title: row.title ?? null,
      category: row.category ?? null,
      description: row.description ?? null,
      content: ('content' in row && row.content) ? String(row.content) : null,
      sortOrder: Number(row.sortOrder ?? 0),
      isPortfolio: Number(row.isPortfolio ?? 0),
      isExecutiveSummary: Number(row.isExecutiveSummary ?? 0),
      isDeleted: Number(row.isDeleted ?? 0),
      status: ('status' in row ? row.status : null) ?? null,
      revisionOf: ('revisionOf' in row ? row.revisionOf : null) ?? null,
      zulipStream: ('zulipStream' in row ? row.zulipStream : null),
      zulipTopic: ('zulipTopic' in row ? row.zulipTopic : null),
      displayInAreslib: Number(row.displayInAreslib ?? 0),
      displayInMathCorner: Number(row.displayInMathCorner ?? 0),
      displayInScienceCorner: Number(row.displayInScienceCorner ?? 0)
    };

    return c.json({ doc }, 200);
}));

// GET /docs/{slug} - Get single doc with contributors
docsRouter.openapi(docsRoutes.getDocRoute, createTypedHandler(docsRoutes.getDocRoute, async (c, { params }) => {
  const { slug } = params;
    const db = getDb(c);
    let row;
    try {
      row = await db.select({
        slug: schema.docs.slug,
        title: schema.docs.title,
        category: schema.docs.category,
        description: schema.docs.description,
        content: schema.docs.content,
        updatedAt: schema.docs.updatedAt,
        isPortfolio: schema.docs.isPortfolio,
        isExecutiveSummary: schema.docs.isExecutiveSummary,
        isDeleted: schema.docs.isDeleted,
        status: schema.docs.status,
        revisionOf: schema.docs.revisionOf,
        zulipStream: schema.docs.zulipStream,
        zulipTopic: schema.docs.zulipTopic,
        displayInAreslib: schema.docs.displayInAreslib,
        displayInMathCorner: schema.docs.displayInMathCorner,
        displayInScienceCorner: schema.docs.displayInScienceCorner,
        originalAuthorNickname: schema.userProfiles.nickname,
        originalAuthorAvatar: schema.user.image
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
        updatedAt: schema.docs.updatedAt,
        isPortfolio: schema.docs.isPortfolio,
        isExecutiveSummary: schema.docs.isExecutiveSummary,
        displayInAreslib: schema.docs.displayInAreslib,
        displayInMathCorner: schema.docs.displayInMathCorner,
        displayInScienceCorner: schema.docs.displayInScienceCorner,
        originalAuthorNickname: schema.userProfiles.nickname,
        originalAuthorAvatar: schema.user.image
      })
        .from(schema.docs)
        .leftJoin(schema.user, eq(schema.docs.cfEmail, schema.user.email))
        .leftJoin(schema.userProfiles, eq(schema.user.id, schema.userProfiles.userId))
        .where(eq(schema.docs.slug, slug))
        .get() as DocWithAuthor | undefined;
    }

    if (!row) {
      throw new ApiError("Doc not found", 404);
    }

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

    const contributors = contributorRows.map((cnt) => ({
      nickname: cnt.nickname ?? null,
      avatar: cnt.avatar ?? null
    }));

    const doc = {
      slug: String(row.slug),
      title: row.title ?? null,
      category: row.category ?? null,
      description: row.description ?? null,
      content: row.content ?? null,
      sortOrder: 0,
      isPortfolio: Number(row.isPortfolio ?? 0),
      isExecutiveSummary: Number(row.isExecutiveSummary ?? 0),
      isDeleted: Number(row.isDeleted ?? 0),
      status: ('status' in row ? row.status : null) ?? null,
      revisionOf: ('revisionOf' in row ? row.revisionOf : null) ?? null,
      zulipStream: ('zulipStream' in row ? row.zulipStream : null),
      zulipTopic: ('zulipTopic' in row ? row.zulipTopic : null),
      displayInAreslib: Number(row.displayInAreslib ?? 0),
      displayInMathCorner: Number(row.displayInMathCorner ?? 0),
      displayInScienceCorner: Number(row.displayInScienceCorner ?? 0),
      updatedAt: row.updatedAt ?? undefined,
      originalAuthorNickname: row.originalAuthorNickname ?? undefined,
      originalAuthorAvatar: row.originalAuthorAvatar ?? undefined
    };

    return c.json({ doc, contributors }, 200);
}));

// DELETE /docs/admin/{slug} - Delete doc (soft delete)
docsRouter.openapi(docsRoutes.deleteDocRoute, createTypedHandler(docsRoutes.deleteDocRoute, async (c, { params }) => {
  const { slug } = params;
    const db = getDb(c);
    const existing = await db.select().from(schema.docs).where(eq(schema.docs.slug, slug)).get();
    if (!existing) {
      throw new ApiError("Doc not found", 404);
    }

    await db.update(schema.docs).set({ isDeleted: 1 }).where(eq(schema.docs.slug, slug)).run();
    c.executionCtx?.waitUntil?.(logAuditAction(c, "DELETE_DOC", "docs", slug, JSON.stringify(existing)));
    triggerBackgroundReindex(c.executionCtx, db, c.env.AI, c.env.VECTORIZE_DB);
    return c.json({ success: true }, 200);
}));

// POST /docs/admin/save - Save or update doc
docsRouter.openapi(docsRoutes.saveDocRoute, createTypedHandler(docsRoutes.saveDocRoute, async (c, { body }) => {
    const db = getDb(c);
    const { slug, title, category, sortOrder, description, content, isPortfolio, isExecutiveSummary, isDraft, displayInAreslib, displayInMathCorner, displayInScienceCorner } = body;
    const user = await getSessionUser(c);
    const email = user?.email || "anonymous_admin";

    if (!slug) {
      throw new ApiError("slug is required", 400);
    }

    const existing = await db.select({
      slug: schema.docs.slug,
      title: schema.docs.title,
      category: schema.docs.category,
      description: schema.docs.description,
      content: schema.docs.content,
      cfEmail: schema.docs.cfEmail,
      isPortfolio: schema.docs.isPortfolio,
      isExecutiveSummary: schema.docs.isExecutiveSummary
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
          description: existing.description ?? "",
          content: existing.content,
          authorEmail: existing.cfEmail ?? "unknown"
        })
        .run();
      safeWaitUntil(c.executionCtx, pruneDocHistory(c, slug, 10), "Failed to prune doc history");
    }

    if (user?.role !== "admin" && existing) {
      const revSlug = `${slug}-rev-${Math.random().toString(36).substring(2, 6)}`;
      await db.insert(schema.docs)
        .values({
          slug: revSlug,
          title: title ?? "",
          category: category ?? "",
          sortOrder: sortOrder ?? 0,
          description: description ?? "",
          content: content ?? "",
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
          zulipTopic: `Doc: ${title ?? "Untitled"}`
        })
        .run();

      safeWaitUntil(c.executionCtx, notifyByRole(c, ["admin", "coach", "mentor"], {
        title: "Ã°Å¸â€œÂ Doc Revision Pending",
        message: `"${title}" revised by ${email} needs admin approval.`,
        link: "/dashboard/manage_docs",
        external: true,
        priority: "medium"
      }), "Failed to send revision notification");

      return c.json({ success: true, slug: revSlug }, 200);
    }

    const status = isDraft ? "pending" : (user?.role === "admin" ? "published" : "pending");

    await db.insert(schema.docs)
      .values({
        slug,
        title: title ?? "",
        category: category ?? "",
        sortOrder: sortOrder ?? 0,
        description: description ?? "",
        content: content ?? "",
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
        zulipTopic: `Doc: ${title ?? "Untitled"}`
      })
      .onConflictDoUpdate({
        target: schema.docs.slug,
        set: {
          title: title ?? "",
          category: category ?? "",
          sortOrder: sortOrder ?? 0,
          description: description ?? "",
          content: content ?? "",
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
          zulipTopic: `Doc: ${title ?? "Untitled"}`
        }
      })
      .run();

    // Push snapshot to collaborative editor history
    if (content) {
      safeWaitUntil(c.executionCtx,
        db.insert(schema.documentHistory)
          .values({
            roomId: `doc_${slug}`,
            content: content,
            createdBy: email,
            /* removed createdAt string */
          })
          .run(),
        "Failed to save document history snapshot"
      );
    }

    if (status === "published") {
      const action = existing ? "updated" : "created";
      safeWaitUntil(c.executionCtx, (async () => {
        const socialConfig = await getSocialConfig(c);
        await sendZulipMessage(socialConfig, "engineering", `Doc: ${title}`, `Ã°Å¸â€œÂ **Doc ${action}:** [${title}](${siteConfig.urls.base}/docs/${slug}) (${category})`);
      })(), "Failed to send Zulip message for published doc");
    }

    if (status === "pending") {
      safeWaitUntil(c.executionCtx, notifyByRole(c, ["admin", "coach", "mentor"], {
        title: "Ã°Å¸â€œÂ Pending Document",
        message: `"${title}" submitted by ${email} needs review.`,
        link: "/dashboard/manage_docs",
        external: true,
        priority: "medium"
      }), "Failed to send pending document notification");
    }

    triggerBackgroundReindex(c.executionCtx, db, c.env.AI, c.env.VECTORIZE_DB);
    return c.json({ success: true, slug }, 200);
}));

// PATCH /docs/admin/{slug}/sort - Update doc sort order
docsRouter.openapi(docsRoutes.updateSortRoute, createTypedHandler(docsRoutes.updateSortRoute, async (c, { params, body }) => {
  const { slug } = params;
  const { sortOrder } = body;
    const db = getDb(c);
    await db.update(schema.docs).set({ sortOrder: sortOrder }).where(eq(schema.docs.slug, slug)).run();
    return c.json({ success: true }, 200);
}));

// POST /docs/{slug}/feedback - Submit doc feedback
docsRouter.openapi(docsRoutes.submitFeedbackRoute, createTypedHandler(docsRoutes.submitFeedbackRoute, async (c, { params, body }) => {
  const { slug } = params;
  const { isHelpful, comment, turnstileToken } = body;
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  const ua = c.req.header("User-Agent") ?? "unknown";
  const db = getDb(c);
  if (!(await checkPersistentRateLimit(db, `feedback:${ip}`, ua, 10, 60))) {
    throw new ApiError("Too many requests", 429);
  }

  const valid = await verifyTurnstile(turnstileToken ?? "", c.env.TURNSTILE_SECRET_KEY, ip);
  if (!valid) {
    throw new ApiError("Security verification failed", 403);
  }

  if (comment && comment.length > 2000) {
    throw new ApiError("Comment too long", 400);
  }

    await db.insert(schema.docsFeedback).values({ slug, isHelpful: isHelpful ? 1 : 0, comment: comment ?? null }).run();
    return c.json({ success: true }, 200);
}));

// GET /docs/admin/{slug}/history - Get doc history
docsRouter.openapi(docsRoutes.getHistoryRoute, createTypedHandler(docsRoutes.getHistoryRoute, async (c, { params }) => {
  const { slug } = params;
    const db = getDb(c);
    const results = await db.select({
      id: schema.docsHistory.id,
      slug: schema.docsHistory.slug,
      title: schema.docsHistory.title,
      category: schema.docsHistory.category,
      description: schema.docsHistory.description,
      authorEmail: schema.docsHistory.authorEmail,
      createdAt: schema.docsHistory.createdAt
    })
      .from(schema.docsHistory)
      .where(eq(schema.docsHistory.slug, slug))
      .orderBy(desc(schema.docsHistory.createdAt))
      .limit(50)
      .all();

    const history = results.map((h) => ({
      ...h,
      id: Number(h.id),
      createdAt: h.createdAt ?? "" // Ensure createdAt is never null
    }));

    return c.json({ history }, 200);
}));

// PATCH /docs/admin/{slug}/history/{id}/restore - Restore doc from history
docsRouter.openapi(docsRoutes.restoreHistoryRoute, createTypedHandler(docsRoutes.restoreHistoryRoute, async (c, { params }) => {
  const { slug, id } = params;
    const db = getDb(c);
    const row = await db.select().from(schema.docsHistory).where(
      and(eq(schema.docsHistory.slug, slug), eq(schema.docsHistory.id, id))
    ).get();

    if (!row) {
      throw new ApiError("Version not found", 404);
    }

    // Get current doc for reference
    const currentDoc = await db.select().from(schema.docs).where(eq(schema.docs.slug, slug)).get();

    // Create a history entry for current state before restoring
    if (currentDoc && currentDoc.content) {
      await db.insert(schema.docsHistory).values({
        slug: slug,
        title: currentDoc.title ?? "",
        category: currentDoc.category ?? "",
        description: currentDoc.description,
        content: currentDoc.content,
        authorEmail: "system@ares.local", // Or infer from currentDoc if it had updatedBy
      }).run();
    }

    // Restore the content
    await db.update(schema.docs).set({
      content: row.content ?? "",
    }).where(eq(schema.docs.slug, slug)).run();

    return c.json({ success: true }, 200);
}));

// POST /docs/admin/{slug}/approve - Approve doc
docsRouter.openapi(docsRoutes.approveDocRoute, createTypedHandler(docsRoutes.approveDocRoute, async (c, { params }) => {
  const { slug } = params;
    const db = getDb(c);

    // First, verify the doc exists and is pending
    const doc = await db.select().from(schema.docs).where(eq(schema.docs.slug, slug)).get();

    if (!doc) {
      throw new ApiError("Document not found", 404);
    }

    if (doc.status !== "pending") {
      throw new ApiError("Document is not pending approval", 400);
    }

    // If this is a revision of an existing doc, we need to merge the changes
    if (doc.revisionOf) {
      // 1. Get the original document
      const original = await db.select().from(schema.docs).where(eq(schema.docs.slug, doc.revisionOf)).get();

      if (original) {
        // 2. Save original content to history
        await db.insert(schema.docsHistory).values({
          slug: original.slug,
          title: original.title,
          category: original.category,
          description: original.description,
          content: original.content,
          authorEmail: doc.cfEmail,
        }).run();

        // 3. Update original doc with new content and metadata
        await db.update(schema.docs).set({
          content: doc.content,
          title: doc.title,
          category: doc.category,
          description: doc.description,
          updatedAt: new Date().toISOString(),
        }).where(eq(schema.docs.slug, original.slug)).run();

        // 4. Delete the revision draft
        await db.delete(schema.docs).where(eq(schema.docs.slug, slug)).run();

        return c.json({ success: true }, 200);
      }
    }
    return c.json({ success: true }, 200);
}));

// POST /docs/admin/{slug}/reject - Reject doc
docsRouter.openapi(docsRoutes.rejectDocRoute, createTypedHandler(docsRoutes.rejectDocRoute, async (c, { params, body }) => {
  const { slug } = params;
  const { reason } = body;
    const db = getDb(c);
    const row = await db.select({
      title: schema.docs.title,
      cfEmail: schema.docs.cfEmail
    })
      .from(schema.docs)
      .where(eq(schema.docs.slug, slug))
      .get();
    await db.update(schema.docs).set({ status: "rejected" }).where(eq(schema.docs.slug, slug)).run();
    if (row?.cfEmail) {
      const author = await db.select({ id: schema.user.id })
        .from(schema.user)
        .where(eq(schema.user.email, row.cfEmail))
        .get();
      if (author) {
        await emitNotification(c, {
          userId: String(author.id),
          title: "Doc Rejected",
          message: `Your document "${row.title}" was rejected${reason ? `: "${reason}"` : "."}`,
          link: "/dashboard/manage_docs",
          priority: "high"
        });
      }
    }
    return c.json({ success: true }, 200);
}));

// POST /docs/admin/{slug}/undelete - Undelete doc
docsRouter.openapi(docsRoutes.undeleteDocRoute, createTypedHandler(docsRoutes.undeleteDocRoute, async (c, { params }) => {
  const { slug } = params;
    const db = getDb(c);
    await db.update(schema.docs).set({ isDeleted: 0, status: "draft" }).where(eq(schema.docs.slug, slug)).run();
    return c.json({ success: true }, 200);
}));

// POST /docs/admin/{slug}/purge - Permanently delete doc
docsRouter.openapi(docsRoutes.purgeDocRoute, createTypedHandler(docsRoutes.purgeDocRoute, async (c, { params }) => {
  const { slug } = params;
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
        c.executionCtx?.waitUntil?.(c.env.ARES_STORAGE.delete(key).catch((err: unknown) => {
          console.error(`Failed to delete R2 asset ${key}:`, err);
        }));
      }
    }

    // 3. Database Cleanup
    // SQLite enforces foreign keys if PRAGMA foreign_keys = ON is set
    // But Cloudflare D1 doesn't consistently apply ON DELETE CASCADE, so we manually clean up
    await db.delete(schema.docs).where(eq(schema.docs.slug, slug)).run();
    c.executionCtx?.waitUntil?.(db.delete(schema.docsHistory).where(eq(schema.docsHistory.slug, slug)).run());
    c.executionCtx?.waitUntil?.(logAuditAction(c, "PURGE_DOC", "docs", slug, JSON.stringify(doc)));

    return c.json({ success: true }, 200);
  } catch (_e) {
    throw new ApiError("Purge failed", 500);
  }
}));

// Export all docs as JSON
docsRouter.openapi(docsRoutes.exportAllDocsRoute, createTypedHandler(docsRoutes.exportAllDocsRoute, async (c) => {
    const db = getDb(c);
    const results = await db.select().from(schema.docs).orderBy(desc(schema.docs.updatedAt)).all();
    const docs = results.map(row => ({
        ...row,
        title: row.title ?? null,
        category: row.category ?? null,
        description: row.description ?? null,
        content: row.content ?? null,
        sortOrder: Number(row.sortOrder ?? 0),
        isPortfolio: Number(row.isPortfolio ?? 0),
        isExecutiveSummary: Number(row.isExecutiveSummary ?? 0),
        isDeleted: Number(row.isDeleted ?? 0),
        status: row.status ?? null,
        revisionOf: row.revisionOf ?? null,
        zulipStream: row.zulipStream ?? undefined,
        zulipTopic: row.zulipTopic ?? undefined,
        displayInAreslib: Number(row.displayInAreslib ?? 0),
        displayInMathCorner: Number(row.displayInMathCorner ?? 0),
        displayInScienceCorner: Number(row.displayInScienceCorner ?? 0),
        updatedAt: row.updatedAt ?? undefined,
        originalAuthorNickname: undefined,
        originalAuthorAvatar: undefined
    }));
    return c.json({ docs }, 200);
}));

// Export single doc as Markdown
docsRouter.openapi(docsRoutes.exportSingleDocRoute, createTypedHandler(docsRoutes.exportSingleDocRoute, async (c, { params }) => {
  const { slug } = params;
    const db = getDb(c);
    const doc = await db.select({
      title: schema.docs.title,
      content: schema.docs.content,
      category: schema.docs.category,
    }).from(schema.docs).where(eq(schema.docs.slug, slug)).get();

    if (!doc) {
      throw new ApiError("Doc not found", 404);
    }

    // Convert Tiptap JSON to Markdown if needed
    let markdownContent = doc.content ?? "";
    try {
      const parsed = JSON.parse(doc.content ?? "");
      if (parsed.type === "doc") {
        // Simple Tiptap to Markdown conversion
        markdownContent = tiptapToMarkdown(parsed);
      }
    } catch {
      // Content is already plain text or Markdown
    }

    const markdown = `# ${doc.title ?? slug}\n\n**Category:** ${doc.category ?? "General"}\n\n${markdownContent}`;
    return c.text(markdown, 200, { "Content-Type": "text/plain; charset=utf-8" });
}));

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





