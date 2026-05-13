import { ApiError } from "../../middleware/errorHandler";
import { AppEnv, getDb, checkPersistentRateLimit, verifyTurnstile } from "../../middleware";
import type { RouteResponse } from "@shared/types/api";
import * as docsRoutes from "../../../../shared/routes/docs";
import {
    type DocWithAuthor,
    type PartialDoc,
    sanitizeFtsQuery,
    setCache,
    getCache,
    tiptapToMarkdown,
    schema, eq, desc, asc, and, isNotNull, sql, QUERY_LIMITS,
} from "./docHelpers";
import type { Context } from "hono";

type Ctx = Context<AppEnv>;

// ──── GET /docs — List all public docs ──────────────────────────────────────

export async function handleGetDocs(c: Ctx) {
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
        zulipStream: null,
        zulipTopic: null,
        displayInAreslib: Number(d.displayInAreslib ?? 0),
        displayInMathCorner: Number(d.displayInMathCorner ?? 0),
        displayInScienceCorner: Number(d.displayInScienceCorner ?? 0),
        originalAuthorNickname: ('originalAuthorNickname' in d ? d.originalAuthorNickname : null),
        originalAuthorAvatar: ('originalAuthorAvatar' in d ? d.originalAuthorAvatar : null)
    }));

    return c.json({ docs: docs as RouteResponse<typeof docsRoutes.getDocsRoute>["docs"] }, 200);
}

// ──── GET /docs/search — FTS search ─────────────────────────────────────────

export async function handleSearchDocs(c: Ctx) {
    const query = c.req.valid("query");
    const { q } = query;
    if (!q || q.length < 3) {
        return c.json({ results: [] }, 200);
    }

    // WR-18: Limit query length to prevent ReDoS via complex regex patterns
    if (q.length > 50) {
        throw new ApiError("Query too long (max 50 characters)", 400);
    }

    const now = Date.now();
    const cached = getCache(q);
    if (cached && cached.expiresAt > now) {
        return c.json(cached.data as RouteResponse<typeof docsRoutes.searchDocsRoute>, 200);
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
    return c.json(payload as RouteResponse<typeof docsRoutes.searchDocsRoute>, 200);
}

// ──── GET /docs/admin/list — Admin list all ─────────────────────────────────

export async function handleAdminList(c: Ctx) {
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
        zulipStream: null,
        zulipTopic: null,
        displayInAreslib: Number(d.displayInAreslib ?? 0),
        displayInMathCorner: Number(d.displayInMathCorner ?? 0),
        displayInScienceCorner: Number(d.displayInScienceCorner ?? 0),
        originalAuthorNickname: null,
        originalAuthorAvatar: null
    }));

    return c.json({ docs: docs as RouteResponse<typeof docsRoutes.adminListRoute>["docs"] }, 200);
}

// ──── GET /docs/admin/:slug/detail — Admin detail ───────────────────────────

export async function handleAdminDetail(c: Ctx) {
    const params = c.req.valid("param");
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

    return c.json({ doc: doc as RouteResponse<typeof docsRoutes.adminDetailRoute>["doc"] }, 200);
}

// ──── GET /docs/:slug — Public single doc ───────────────────────────────────

export async function handleGetDoc(c: Ctx) {
    const params = c.req.valid("param");
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
        originalAuthorNickname: row.originalAuthorNickname ?? null,
        originalAuthorAvatar: row.originalAuthorAvatar ?? null
    };

    return c.json({
        doc: doc as RouteResponse<typeof docsRoutes.getDocRoute>["doc"],
        contributors: contributors as RouteResponse<typeof docsRoutes.getDocRoute>["contributors"]
    }, 200);
}

// ──── GET /docs/admin/:slug/history — History ───────────────────────────────

export async function handleGetHistory(c: Ctx) {
    const params = c.req.valid("param");
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

    return c.json({ history: history as RouteResponse<typeof docsRoutes.getHistoryRoute>["history"] }, 200);
}

// ──── POST /docs/:slug/feedback — Submit Feedback ───────────────────────────

export async function handleSubmitFeedback(c: Ctx) {
    const params = c.req.valid("param");
    const body = c.req.valid("json");
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
}

// ──── GET /docs/admin/export — Export all docs ──────────────────────────────

export async function handleExportAllDocs(c: Ctx) {
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
        zulipStream: row.zulipStream ?? null,
        zulipTopic: row.zulipTopic ?? null,
        displayInAreslib: Number(row.displayInAreslib ?? 0),
        displayInMathCorner: Number(row.displayInMathCorner ?? 0),
        displayInScienceCorner: Number(row.displayInScienceCorner ?? 0),
        updatedAt: row.updatedAt ?? undefined,
        originalAuthorNickname: null,
        originalAuthorAvatar: null
    }));
    return c.json({ docs: docs as RouteResponse<typeof docsRoutes.exportAllDocsRoute>["docs"] }, 200);
}

// ──── GET /docs/admin/export/:slug — Export single doc ──────────────────────

export async function handleExportSingleDoc(c: Ctx) {
    const params = c.req.valid("param");
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
}
