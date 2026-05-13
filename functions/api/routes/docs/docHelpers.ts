import { ApiError } from "../../middleware/errorHandler";
import { sql } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import { eq, desc, asc, and, isNotNull, lt } from "drizzle-orm";
import { QUERY_LIMITS } from "../../utils/queryLimits";
import type { HonoContext } from "@shared/types/api";
import { getDb } from "../../middleware";

// ──── Types ─────────────────────────────────────────────────────────────────

/** Doc with author info (from join query with camelCase aliases) */
export type DocWithAuthor = {
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

/** Partial doc results (fallback queries with camelCase aliases) */
export type PartialDoc = {
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
    data: unknown; // Using unknown for cache internal data to avoid circular complexity
    expiresAt: number;
};

// ──── Search Cache ──────────────────────────────────────────────────────────

// SEC-Z01: Cache doc search results
const MAX_CACHE_SIZE = 100;
const docSearchCache = new Map<string, DocSearchCacheEntry>();

export function setCache(key: string, value: DocSearchCacheEntry) {
    // EFF-F03: Probabilistic TTL sweep (~5% of writes) to evict stale entries
    if (Math.random() < 0.05) {
        const now = Date.now();
        for (const [k, v] of docSearchCache) {
            if (v.expiresAt <= now) docSearchCache.delete(k);
        }
    }
    if (docSearchCache.size >= MAX_CACHE_SIZE) {
        const firstKey = docSearchCache.keys().next().value;
        if (firstKey !== undefined) docSearchCache.delete(firstKey);
    }
    docSearchCache.set(key, value);
}

export function getCache(key: string): DocSearchCacheEntry | undefined {
    return docSearchCache.get(key);
}

// ──── Utilities ─────────────────────────────────────────────────────────────

/**
 * Sanitize FTS query to prevent SQL injection via SQLite FTS syntax.
 * Allows alphanumeric, spaces, hyphens, and periods. Uses proper FTS5 phrase search.
 * SECURITY: Limits query length to prevent abuse and ReDoS attacks.
 */
export const sanitizeFtsQuery = (query: string): string => {
    // SECURITY: Limit query length to prevent abuse and ReDoS attacks
    if (query.length > 100) {
        throw new ApiError("Search query too long (max 100 characters)", 400);
    }

    // Allow only alphanumeric, spaces, hyphens, and periods
    const cleanQ = (query || "").replace(/[^\w\s-.]/g, "").trim();
    if (!cleanQ) return "";

    // SECURITY: Proper FTS5 phrase search with escaped quotes
    return `"${cleanQ.replace(/"/g, '""')}*`;
};

export async function pruneDocHistory(c: HonoContext, slug: string, limit = 10) {
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
    } catch (err) {
        console.error("[Docs:PruneHistory] Failed to prune history for slug:", slug, err);
    }
}

// ──── Tiptap → Markdown Conversion ─────────────────────────────────────────

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

export function tiptapToMarkdown(node: TipTapNode | TipTapTextNode): string {
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

// Re-export drizzle + schema for handler modules
export { sql, eq, desc, asc, and, isNotNull, schema, QUERY_LIMITS };
