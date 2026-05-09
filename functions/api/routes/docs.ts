import { typedHandler } from "../utils/handler";
import { QUERY_LIMITS } from "../utils/queryLimits";
import { ApiError } from "../middleware/errorHandler";
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
type GetDocsResponse = z.infer<typeof docsRoutes.getDocsRoute.responses[200]["content"]["application/json"]["schema"]>;
type AdminDetailResponse = z.infer<typeof docsRoutes.adminDetailRoute.responses[200]["content"]["application/json"]["schema"]>;
type GetDocResponse = z.infer<typeof docsRoutes.getDocRoute.responses[200]["content"]["application/json"]["schema"]>;
type SearchDocsResponse = z.infer<typeof docsRoutes.searchDocsRoute.responses[200]["content"]["application/json"]["schema"]>;
type GetHistoryResponse = z.infer<typeof docsRoutes.getHistoryRoute.responses[200]["content"]["application/json"]["schema"]>;
type ExportAllDocsResponse = z.infer<typeof docsRoutes.exportAllDocsRoute.responses[200]["content"]["application/json"]["schema"]>;

// Infer request types from route schemas
type SaveDocRequest = z.infer<typeof docsRoutes.saveDocRoute.request["body"]["content"]["application/json"]["schema"]>;
type UpdateSortRequest = z.infer<typeof docsRoutes.updateSortRoute.request["body"]["content"]["application/json"]["schema"]>;
type SubmitFeedbackRequest = z.infer<typeof docsRoutes.submitFeedbackRoute.request["body"]["content"]["application/json"]["schema"]>;
type RejectDocRequest = z.infer<typeof docsRoutes.rejectDocRoute.request["body"]["content"]["application/json"]["schema"]>;

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
docsRouter.openapi(docsRoutes.getDocsRoute, typedHandler<typeof docsRoutes.getDocsRoute>(async (c) => {
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

    const docs = (results as (DocWithAuthor | PartialDoc)[]).map((d) => ({
      slug: String(d.slug),
      title: d.title ?? null,
      category: d.category ?? null,
      description: d.description ?? null,
      sort_order: Number('sort_order' in d ? d.sort_order : 0),
      is_portfolio: Number(d.is_portfolio ?? 0),
      is_executive_summary: Number(d.is_executive_summary ?? 0),
      is_deleted: Number(d.is_deleted ?? 0),
      status: d.status ?? null,
      revision_of: d.revision_of ?? null,
      zulip_stream: undefined,
      zulip_topic: undefined,
      display_in_areslib: Number(d.display_in_areslib ?? 0),
      display_in_math_corner: Number(d.display_in_math_corner ?? 0),
      display_in_science_corner: Number(d.display_in_science_corner ?? 0),
      original_author_nickname: ('original_author_nickname' in d ? d.original_author_nickname : undefined),
      original_author_avatar: ('original_author_avatar' in d ? d.original_author_avatar : undefined)
    }));

    const response = { docs } as GetDocsResponse;
    return c.json(response satisfies GetDocsResponse, 200);
}));

// GET /docs/search - Search docs
docsRouter.openapi(docsRoutes.searchDocsRoute, typedHandler<typeof docsRoutes.searchDocsRoute>(async (c) => {
  const { q } = c.req.valid("query");
  if (!q || q.length < 3) {
    const emptyResponse: SearchDocsResponse = { results: [] };
    return c.json(emptyResponse, 200);
  }

  // WR-18: Limit query length to prevent ReDoS via complex regex patterns
  if (q.length > 50) {
    throw new ApiError("Query too long (max 50 characters)", 400, "VALIDATION_ERROR");
  }

    const now = Date.now();
    const cached = docSearchCache.get(q);
    if (cached && cached.expiresAt > now) {
      return c.json(cached.data satisfies SearchDocsResponse, 200);
    }

    // Sanitize FTS query to prevent SQL injection
    const cleanQ = sanitizeFtsQuery(String(q));
    if (!cleanQ) {
      const emptyResponse: SearchDocsResponse = { results: [] };
      return c.json(emptyResponse, 200);
    }

    const db = getDb(c);
    const results = await db.run(sql<{ slug: string, title: string, category: string, description: string | null }>`
      SELECT f.slug, f.title, f.category, f.description
      FROM docs_fts f
      JOIN docs d ON f.slug = d.slug
      WHERE d.is_deleted = 0 AND d.status = 'published' AND f.docs_fts MATCH ${cleanQ}
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

    const payload: SearchDocsResponse = { results: mapped };
    setCache(q, { data: payload, expiresAt: now + 60000 });
    return c.json(payload, 200);
}));

// GET /docs/admin/list - List all docs (admin view)
docsRouter.openapi(docsRoutes.adminListRoute, typedHandler<typeof docsRoutes.adminListRoute>(async (c) => {
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

    const docs = results.map((d) => ({
      ...d,
      title: d.title ?? "Untitled",
      category: d.category ?? "Uncategorized",
      description: d.description ?? null,
      sort_order: Number(d.sort_order ?? 0),
      is_portfolio: Number(d.is_portfolio ?? 0),
      is_executive_summary: Number(d.is_executive_summary ?? 0),
      is_deleted: Number(d.is_deleted ?? 0),
      status: d.status ?? null,
      revision_of: d.revision_of ?? null,
      zulip_stream: undefined,
      zulip_topic: undefined,
      display_in_areslib: Number(d.display_in_areslib ?? 0),
      display_in_math_corner: Number(d.display_in_math_corner ?? 0),
      display_in_science_corner: Number(d.display_in_science_corner ?? 0)
    }));

    const response: GetDocsResponse = { docs };
    return c.json(response, 200);
}));

// GET /docs/admin/{slug}/detail - Get doc detail (admin view)
docsRouter.openapi(docsRoutes.adminDetailRoute, typedHandler<typeof docsRoutes.adminDetailRoute>(async (c) => {
  const { slug } = c.req.valid("param");
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

    if (!row) {
      throw new ApiError("Doc", 404, "NOT_FOUND");
    }

    const doc = {
      slug: String(row.slug),
      title: row.title ?? null,
      category: row.category ?? null,
      description: row.description ?? null,
      content: ('content' in row && row.content) ? String(row.content) : null,
      sort_order: Number(row.sort_order ?? 0),
      is_portfolio: Number(row.is_portfolio ?? 0),
      is_executive_summary: Number(row.is_executive_summary ?? 0),
      is_deleted: Number(row.is_deleted ?? 0),
      status: ('status' in row ? row.status : null) ?? null,
      revision_of: ('revision_of' in row ? row.revision_of : null) ?? null,
      zulip_stream: ('zulip_stream' in row ? row.zulip_stream : null),
      zulip_topic: ('zulip_topic' in row ? row.zulip_topic : null),
      display_in_areslib: Number(row.display_in_areslib ?? 0),
      display_in_math_corner: Number(row.display_in_math_corner ?? 0),
      display_in_science_corner: Number(row.display_in_science_corner ?? 0)
    };

    const response: AdminDetailResponse = { doc };
    return c.json(response, 200);
}));

// GET /docs/{slug} - Get single doc with contributors
docsRouter.openapi(docsRoutes.getDocRoute, typedHandler<typeof docsRoutes.getDocRoute>(async (c) => {
  const { slug } = c.req.valid("param");
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

    if (!row) {
      throw new ApiError("Doc", 404, "NOT_FOUND");
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
      sort_order: 0,
      is_portfolio: Number(row.is_portfolio ?? 0),
      is_executive_summary: Number(row.is_executive_summary ?? 0),
      is_deleted: Number(row.is_deleted ?? 0),
      status: ('status' in row ? row.status : null) ?? null,
      revision_of: ('revision_of' in row ? row.revision_of : null) ?? null,
      zulip_stream: ('zulip_stream' in row ? row.zulip_stream : null),
      zulip_topic: ('zulip_topic' in row ? row.zulip_topic : null),
      display_in_areslib: Number(row.display_in_areslib ?? 0),
      display_in_math_corner: Number(row.display_in_math_corner ?? 0),
      display_in_science_corner: Number(row.display_in_science_corner ?? 0),
      updated_at: row.updated_at ?? undefined,
      original_author_nickname: row.original_author_nickname ?? undefined,
      original_author_avatar: row.original_author_avatar ?? undefined
    };

    const response: GetDocResponse = { doc, contributors };
    return c.json(response, 200);
}));

// DELETE /docs/admin/{slug} - Delete doc (soft delete)
docsRouter.openapi(docsRoutes.deleteDocRoute, typedHandler<typeof docsRoutes.deleteDocRoute>(async (c) => {
  const { slug } = c.req.valid("param");
    const db = getDb(c);
    const existing = await db.select().from(schema.docs).where(eq(schema.docs.slug, slug)).get();
    if (!existing) {
      throw new ApiError("Doc", 404, "NOT_FOUND");
    }

    await db.update(schema.docs).set({ isDeleted: 1 }).where(eq(schema.docs.slug, slug)).run();
    c.executionCtx?.waitUntil?.(logAuditAction(c, "DELETE_DOC", "docs", slug, JSON.stringify(existing)));
    triggerBackgroundReindex(c.executionCtx, db, c.env.AI, c.env.VECTORIZE_DB);
    return c.json({ success: true }, 200);
}));

// POST /docs/admin/save - Save or update doc
docsRouter.openapi(docsRoutes.saveDocRoute, typedHandler<typeof docsRoutes.saveDocRoute>(async (c) => {
    const db = getDb(c);
    const body = c.req.valid("json") as SaveDocRequest;
    const { slug, title, category, sortOrder, description, content, isPortfolio, isExecutiveSummary, isDraft, displayInAreslib, displayInMathCorner, displayInScienceCorner } = body;
    const user = await getSessionUser(c);
    const email = user?.email || "anonymous_admin";

    if (!slug) {
      throw new ApiError("slug is required", 400, "VALIDATION_ERROR");
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
          description: existing.description ?? "",
          content: existing.content,
          authorEmail: existing.cf_email ?? "unknown"
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
        title: "📝 Doc Revision Pending",
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
        await sendZulipMessage(socialConfig, "engineering", `Doc: ${title}`, `📝 **Doc ${action}:** [${title}](${siteConfig.urls.base}/docs/${slug}) (${category})`);
      })(), "Failed to send Zulip message for published doc");
    }

    if (status === "pending") {
      safeWaitUntil(c.executionCtx, notifyByRole(c, ["admin", "coach", "mentor"], {
        title: "📝 Pending Document",
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
docsRouter.openapi(docsRoutes.updateSortRoute, typedHandler<typeof docsRoutes.updateSortRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  const { sortOrder } = c.req.valid("json") as UpdateSortRequest;
    const db = getDb(c);
    await db.update(schema.docs).set({ sortOrder: sortOrder }).where(eq(schema.docs.slug, slug)).run();
    return c.json({ success: true }, 200);
}));

// POST /docs/{slug}/feedback - Submit doc feedback
docsRouter.openapi(docsRoutes.submitFeedbackRoute, typedHandler<typeof docsRoutes.submitFeedbackRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  const { isHelpful, comment, turnstileToken } = c.req.valid("json") as SubmitFeedbackRequest;
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  const ua = c.req.header("User-Agent") ?? "unknown";
  const db = getDb(c);
  if (!(await checkPersistentRateLimit(db, `feedback:${ip}`, ua, 10, 60))) throw new ApiError("Too many requests", 429, "RATE_LIMIT_EXCEEDED");

  const valid = await verifyTurnstile(turnstileToken ?? "", c.env.TURNSTILE_SECRET_KEY, ip);
  if (!valid) {
    throw new ApiError("Security verification failed", 403);
  }

  if (comment && comment.length > 2000) {
    throw new ApiError("Comment too long", 400, "VALIDATION_ERROR");
  }

    await db.insert(schema.docsFeedback).values({ slug, isHelpful: isHelpful ? 1 : 0, comment: comment ?? null }).run();
    return c.json({ success: true }, 200);
}));

// GET /docs/admin/{slug}/history - Get doc history
docsRouter.openapi(docsRoutes.getHistoryRoute, typedHandler<typeof docsRoutes.getHistoryRoute>(async (c) => {
  const { slug } = c.req.valid("param");
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

    const history = results.map((h) => ({
      ...h,
      id: Number(h.id)
    }));

    const response = { history } as GetHistoryResponse;
    return c.json(response, 200);
}));

// PATCH /docs/admin/{slug}/history/{id}/restore - Restore doc from history
docsRouter.openapi(docsRoutes.restoreHistoryRoute, typedHandler<typeof docsRoutes.restoreHistoryRoute>(async (c) => {
  const { slug, id } = c.req.valid("param");
    const db = getDb(c);
    const row = await db.select().from(schema.docsHistory).where(
      and(eq(schema.docsHistory.slug, slug), eq(schema.docsHistory.id, id))
    ).get();

    if (!row) {
      throw new ApiError("Version", 404, "NOT_FOUND");
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
docsRouter.openapi(docsRoutes.approveDocRoute, typedHandler<typeof docsRoutes.approveDocRoute>(async (c) => {
  const { slug } = c.req.valid("param");
    const db = getDb(c);

    // First, verify the doc exists and is pending
    const doc = await db.select().from(schema.docs).where(eq(schema.docs.slug, slug)).get();

    if (!doc) {
      throw new ApiError("Document", 404, "NOT_FOUND");
    }

    if (doc.status !== "pending") {
      throw new ApiError("Document is not pending approval", 400, "VALIDATION_ERROR");
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
docsRouter.openapi(docsRoutes.rejectDocRoute, typedHandler<typeof docsRoutes.rejectDocRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  const { reason } = c.req.valid("json") as RejectDocRequest;
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
docsRouter.openapi(docsRoutes.undeleteDocRoute, typedHandler<typeof docsRoutes.undeleteDocRoute>(async (c) => {
  const { slug } = c.req.valid("param");
    const db = getDb(c);
    await db.update(schema.docs).set({ isDeleted: 0, status: "draft" }).where(eq(schema.docs.slug, slug)).run();
    return c.json({ success: true }, 200);
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
        c.executionCtx?.waitUntil?.(c.env.ARES_STORAGE.delete(key).catch((err) => {
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
    throw new ApiError("Purge failed", 500, "INTERNAL_SERVER_ERROR");
  }
}));

// Export all docs as JSON
docsRouter.openapi(docsRoutes.exportAllDocsRoute, typedHandler<typeof docsRoutes.exportAllDocsRoute>(async (c) => {
    const db = getDb(c);
    const results = await db.select().from(schema.docs).orderBy(desc(schema.docs.updatedAt)).all();
    const docs = results.map(row => ({
        ...row,
        title: row.title ?? null,
        category: row.category ?? null,
        description: row.description ?? null,
        content: row.content ?? null,
        sort_order: Number(row.sortOrder ?? 0),
        is_portfolio: Number(row.isPortfolio ?? 0),
        is_executive_summary: Number(row.isExecutiveSummary ?? 0),
        is_deleted: Number(row.isDeleted ?? 0),
        status: row.status ?? null,
        revision_of: row.revisionOf ?? null,
        zulip_stream: row.zulipStream ?? undefined,
        zulip_topic: row.zulipTopic ?? undefined,
        display_in_areslib: Number(row.displayInAreslib ?? 0),
        display_in_math_corner: Number(row.displayInMathCorner ?? 0),
        display_in_science_corner: Number(row.displayInScienceCorner ?? 0),
        updated_at: row.updatedAt ?? undefined,
        original_author_nickname: undefined,
        original_author_avatar: undefined
    }));
    const response: ExportAllDocsResponse = { docs };
    return c.json(response, 200);
}));

// Export single doc as Markdown
docsRouter.openapi(docsRoutes.exportSingleDocRoute, typedHandler<typeof docsRoutes.exportSingleDocRoute>(async (c) => {
  const { slug } = c.req.valid("param");
    const db = getDb(c);
    const doc = await db.select({
      title: schema.docs.title,
      content: schema.docs.content,
      category: schema.docs.category,
    }).from(schema.docs).where(eq(schema.docs.slug, slug)).get();

    if (!doc) {
      throw new ApiError("Doc not found", 404, "NOT_FOUND");
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
