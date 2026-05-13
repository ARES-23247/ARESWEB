import { ApiError } from "../../middleware/errorHandler";
import { AppEnv, getSessionUser, getSocialConfig, logAuditAction, emitNotification, notifyByRole, getDb } from "../../middleware";
import { triggerBackgroundReindex } from "../ai/autoReindex";
import { sendZulipMessage } from "../../../utils/zulipSync";
import { siteConfig } from "../../../utils/site.config";
import { safeWaitUntil } from "../../utils/safeWaitUntil";
import {
    pruneDocHistory,
    schema, eq, and,
} from "./docHelpers";
import type { Context } from "hono";

type Ctx = Context<AppEnv>;

// ──── DELETE /docs/admin/:slug — Soft delete ────────────────────────────────

export async function handleDeleteDoc(c: Ctx) {
    const params = c.req.valid("param");
    const { slug } = params;
    const db = getDb(c);
    const existing = await db.select({ slug: schema.docs.slug, title: schema.docs.title }).from(schema.docs).where(eq(schema.docs.slug, slug)).get();
    if (!existing) {
        throw new ApiError("Doc not found", 404);
    }

    await db.update(schema.docs).set({ isDeleted: 1 }).where(eq(schema.docs.slug, slug)).run();
    c.executionCtx?.waitUntil?.(logAuditAction(c, "DELETE_DOC", "docs", slug, `Soft-deleted: ${existing.title ?? slug}`));
    triggerBackgroundReindex(c.executionCtx, db, c.env.AI, c.env.VECTORIZE_DB);
    return c.json({ success: true }, 200);
}

// ──── POST /docs/admin/save — Save/create doc ───────────────────────────────

export async function handleSaveDoc(c: Ctx) {
    const body = c.req.valid("json");
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
        const revSlug = `${slug}-rev-${crypto.randomUUID().substring(0, 8)}`;
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
            title: "📄 Doc Revision Pending",
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
            await sendZulipMessage(socialConfig, "engineering", `Doc: ${title}`, `📄 **Doc ${action}:** [${title}](${siteConfig.urls.base}/docs/${slug}) (${category})`);
        })(), "Failed to send Zulip message for published doc");
    }

    if (status === "pending") {
        safeWaitUntil(c.executionCtx, notifyByRole(c, ["admin", "coach", "mentor"], {
            title: "📄 Pending Document",
            message: `"${title}" submitted by ${email} needs review.`,
            link: "/dashboard/manage_docs",
            external: true,
            priority: "medium"
        }), "Failed to send pending document notification");
    }

    triggerBackgroundReindex(c.executionCtx, db, c.env.AI, c.env.VECTORIZE_DB);
    return c.json({ success: true, slug }, 200);
}

// ──── PATCH /docs/admin/:slug/sort — Update sort order ──────────────────────

export async function handleUpdateSort(c: Ctx) {
    const params = c.req.valid("param");
    const body = c.req.valid("json");
    const { slug } = params;
    const { sortOrder } = body;
    const db = getDb(c);
    await db.update(schema.docs).set({ sortOrder: sortOrder }).where(eq(schema.docs.slug, slug)).run();
    return c.json({ success: true }, 200);
}

// ──── POST /docs/admin/:slug/history/:id/restore — Restore history ──────────

export async function handleRestoreHistory(c: Ctx) {
    const params = c.req.valid("param");
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
}

// ──── PATCH /docs/admin/:slug/approve — Approve doc ─────────────────────────

export async function handleApproveDoc(c: Ctx) {
    const params = c.req.valid("param");
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
                description: original.description ?? "",
                content: original.content,
                authorEmail: original.cfEmail ?? "system"
            }).run();

            // 3. Update original document with revision content
            await db.update(schema.docs).set({
                title: doc.title,
                category: doc.category,
                description: doc.description,
                content: doc.content,
                updatedAt: new Date().toISOString(),
                isPortfolio: doc.isPortfolio,
                isExecutiveSummary: doc.isExecutiveSummary,
                displayInAreslib: doc.displayInAreslib,
                displayInMathCorner: doc.displayInMathCorner,
                displayInScienceCorner: doc.displayInScienceCorner,
            }).where(eq(schema.docs.slug, original.slug)).run();

            // 4. Delete the revision document
            await db.delete(schema.docs).where(eq(schema.docs.slug, slug)).run();

            safeWaitUntil(c.executionCtx, (async () => {
                const socialConfig = await getSocialConfig(c);
                await sendZulipMessage(socialConfig, "engineering", `Doc Approved: ${doc.title}`, `✅ **Revision Approved:** [${doc.title}](${siteConfig.urls.base}/docs/${original.slug})`);
            })(), "Failed to send Zulip message for approved revision");

            triggerBackgroundReindex(c.executionCtx, db, c.env.AI, c.env.VECTORIZE_DB);
            return c.json({ success: true }, 200);
        }
    }

    // Normal approval for a new document
    await db.update(schema.docs).set({ status: "published", updatedAt: new Date().toISOString() }).where(eq(schema.docs.slug, slug)).run();

    safeWaitUntil(c.executionCtx, (async () => {
        const socialConfig = await getSocialConfig(c);
        await sendZulipMessage(socialConfig, "engineering", `Doc Approved: ${doc.title}`, `✅ **Doc Approved:** [${doc.title}](${siteConfig.urls.base}/docs/${slug})`);
    })(), "Failed to send Zulip message for approved doc");

    triggerBackgroundReindex(c.executionCtx, db, c.env.AI, c.env.VECTORIZE_DB);
    return c.json({ success: true }, 200);
}

// ──── PATCH /docs/admin/:slug/reject — Reject doc ───────────────────────────

export async function handleRejectDoc(c: Ctx) {
    const params = c.req.valid("param");
    const body = c.req.valid("json");
    const { slug } = params;
    const { reason } = body;
    const db = getDb(c);
    const row = await db.select({
        slug: schema.docs.slug,
        status: schema.docs.status,
        revisionOf: schema.docs.revisionOf,
        cfEmail: schema.docs.cfEmail,
        title: schema.docs.title,
    }).from(schema.docs).where(eq(schema.docs.slug, slug)).get();
    if (!row) {
        throw new ApiError("Doc not found", 404);
    }

    await db.update(schema.docs).set({ status: "draft" }).where(eq(schema.docs.slug, slug)).run();

    if (row.cfEmail) {
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
}

// ──── PATCH /docs/admin/:slug/undelete — Restore soft-deleted ───────────────

export async function handleUndeleteDoc(c: Ctx) {
    const params = c.req.valid("param");
    const { slug } = params;
    const db = getDb(c);
    await db.update(schema.docs).set({ isDeleted: 0, status: "draft" }).where(eq(schema.docs.slug, slug)).run();
    return c.json({ success: true }, 200);
}

// ──── DELETE /docs/admin/:slug/purge — Hard delete ──────────────────────────

export async function handlePurgeDoc(c: Ctx) {
    const params = c.req.valid("param");
    const { slug } = params;
    const db = getDb(c);
    const doc = await db.select({ content: schema.docs.content })
        .from(schema.docs)
        .where(eq(schema.docs.slug, slug))
        .get();
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
    await db.delete(schema.docs).where(eq(schema.docs.slug, slug)).run();
    c.executionCtx?.waitUntil?.(db.delete(schema.docsHistory).where(eq(schema.docsHistory.slug, slug)).run());
    c.executionCtx?.waitUntil?.(logAuditAction(c, "PURGE_DOC", "docs", slug, "Permanently purged"));
    return c.json({ success: true }, 200);
}
