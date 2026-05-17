import { Context } from "hono";
import { AppEnv, SessionUser, getSocialConfig } from "../api/middleware";
import { emitNotification } from "./notifications";
import { dispatchSocials } from "./socialSync";
import { eq, desc, and, lt } from "drizzle-orm";
import * as schema from "../../src/db/schema";

export interface PostHistoryRow {
  id: number;
  title: string;
  author: string;
  authorEmail: string;
  createdAt: string;
}

export interface PostHistoryContent {
  title: string;
  author: string;
  thumbnail: string;
  snippet: string;
  ast: string;
  seasonId?: string;
}

/**
 * Creates a shadow revision for a post when a student edits it.
 */
export async function createShadowRevision(
  c: Context<AppEnv>,
  originalSlug: string,
  user: SessionUser,
  data: {
    title: string;
    author?: string;
    thumbnail?: string;
    snippet: string;
    astStr: string;
    publishedAt?: string;
    seasonId?: string | number;
  }
) {
  const db = c.get("db");
  const suffix = crypto.randomUUID().split('-')[0].substring(0, 4);
  const revSlug = `${originalSlug}-rev-${suffix}`;
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "2-digit" });

  await db.insert(schema.posts)
    .values({
      slug: revSlug,
      title: data.title,
      author: data.author || "ARES Team",
      date: dateStr,
      thumbnail: data.thumbnail || "",
      snippet: data.snippet,
      ast: data.astStr,
      cfEmail: user.email,
      status: 'pending',
      revisionOf: originalSlug,
      publishedAt: data.publishedAt || null,
      seasonId: data.seasonId ? Number(data.seasonId) : null
    })
    .execute();

  return revSlug;
}

/**
 * Merges a shadow revision back into the original post.
 */
export async function approveAndMergeRevision(
  c: Context<AppEnv>,
  shadowSlug: string,
  originalSlug: string,
  row: { title: string | null; author: string | null; thumbnail: string | null; snippet: string | null; ast: string | null; cfEmail: string | null; seasonId?: string | number | null }
) {
  const db = c.get("db");

  // Update original
  await db.update(schema.posts)
    .set({
      title: row.title || "Untitled",
      author: row.author || "ARES Team",
      thumbnail: row.thumbnail || "",
      snippet: row.snippet || "",
      ast: row.ast || "",
      status: 'published',
      seasonId: row.seasonId ? Number(row.seasonId) : null
    })
    .where(eq(schema.posts.slug, originalSlug))
    .execute();
  
  // Delete shadow
  await db.delete(schema.posts).where(eq(schema.posts.slug, shadowSlug)).run();

  // Notify author
  if (row.cfEmail) {
    const author = await db.select({ id: schema.user.id }).from(schema.user)
      .where(eq(schema.user.email, row.cfEmail))
      .get();
    
    if (author) {
      c.executionCtx.waitUntil(emitNotification(c, {
        userId: String(author.id),
        title: "Post Merged",
        message: `Your changes to "${row.title}" have been approved and published.`,
        link: `/blog/${originalSlug}`,
        priority: "medium"
      }));
    }
  }
}

/**
 * Prunes old history records, keeping only the last N versions.
 */
export async function pruneHistory(c: Context<AppEnv>, slug: string, limit = 10) {
  const db = c.get("db");
  try {
    const historyRows = await db.select({ id: schema.postsHistory.id }).from(schema.postsHistory)
      .where(eq(schema.postsHistory.slug, slug))
      .orderBy(desc(schema.postsHistory.createdAt))
      .all();
      
    if (historyRows.length > limit) {
      const oldestToKeep = historyRows[limit - 1];
      if (oldestToKeep) {
        await db.delete(schema.postsHistory)
          .where(and(
            eq(schema.postsHistory.slug, slug),
            lt(schema.postsHistory.id, oldestToKeep.id)
          ))
          .run();
      }
    }
  } catch (e) {
    console.error("[PostHistory] Prune failed for slug:", slug, e);
  }
}

/**
 * Saves current post state to history table.
 */
export async function captureHistory(
  c: Context<AppEnv>,
  slug: string,
  data: { title: string | null; author: string | null; thumbnail: string | null; snippet: string | null; ast: string | null; cfEmail: string | null; seasonId?: string | number | null }
) {
  const db = c.get("db");
  await db.insert(schema.postsHistory)
    .values({
      slug,
      title: data.title || "Untitled",
      author: data.author || "Unknown",
      thumbnail: data.thumbnail || "",
      snippet: data.snippet || "",
      ast: data.ast || "",
      authorEmail: data.cfEmail || "unknown",
      seasonId: data.seasonId ? Number(data.seasonId) : null
    })
    .execute();

  // EFF-N05: Prune old versions to prevent D1 bloat
  c.executionCtx.waitUntil(pruneHistory(c, slug, 10));
}

/**
 * Fetches history records for a post.
 */
export async function getPostHistory(c: Context<AppEnv>, slug: string) {
  const db = c.get("db");
  const results = await db.select({
      id: schema.postsHistory.id,
      title: schema.postsHistory.title,
      author: schema.postsHistory.author,
      authorEmail: schema.postsHistory.authorEmail,
      createdAt: schema.postsHistory.createdAt,
      seasonId: schema.postsHistory.seasonId
    }).from(schema.postsHistory)
    .where(eq(schema.postsHistory.slug, slug))
    .orderBy(desc(schema.postsHistory.createdAt))
    .limit(50)
    .all();
  return results || [];
}

/**
 * Restores a post from a historical record.
 */
export async function restorePostFromHistory(
  c: Context<AppEnv>,
  slug: string,
  id: string,
  restorerEmail: string
) {
  const db = c.get("db");
  const row = await db.select({
      title: schema.postsHistory.title,
      author: schema.postsHistory.author,
      thumbnail: schema.postsHistory.thumbnail,
      snippet: schema.postsHistory.snippet,
      ast: schema.postsHistory.ast,
      seasonId: schema.postsHistory.seasonId
    }).from(schema.postsHistory)
    .where(and(
      eq(schema.postsHistory.id, Number(id)),
      eq(schema.postsHistory.slug, slug)
    ))
    .get();

  if (!row) return { success: false, error: "Version not found" };

  // Capture CURRENT as history before restoring
  const current = await db.select({
      slug: schema.posts.slug,
      title: schema.posts.title,
      author: schema.posts.author,
      thumbnail: schema.posts.thumbnail,
      snippet: schema.posts.snippet,
      ast: schema.posts.ast,
      cfEmail: schema.posts.cfEmail,
      seasonId: schema.posts.seasonId
    }).from(schema.posts)
    .where(eq(schema.posts.slug, slug))
    .get();
  
  if (current) {
    await captureHistory(c, slug, current);
  }

  await db.update(schema.posts)
    .set({
      title: row.title as string,
      author: row.author,
      thumbnail: row.thumbnail,
      snippet: row.snippet,
      ast: row.ast,
      cfEmail: restorerEmail,
      seasonId: row.seasonId ? Number(row.seasonId) : null
    })
    .where(eq(schema.posts.slug, slug))
    .execute();

  return { success: true };
}

/**
 * Approves a pending post or shadow revision.
 */
export async function approvePost(c: Context<AppEnv>, slug: string) {
  const db = c.get("db");
  const row = await db.select({
      revisionOf: schema.posts.revisionOf,
      title: schema.posts.title,
      author: schema.posts.author,
      thumbnail: schema.posts.thumbnail,
      snippet: schema.posts.snippet,
      ast: schema.posts.ast,
      cfEmail: schema.posts.cfEmail,
      seasonId: schema.posts.seasonId
    }).from(schema.posts)
    .where(eq(schema.posts.slug, slug))
    .get();

  if (!row) return { success: false, error: "Post not found" };

  if (row.revisionOf) {
    await approveAndMergeRevision(c, slug, row.revisionOf, row);
    return { success: true, warnings: [] };
  }

  await db.update(schema.posts)
    .set({ status: 'published' })
    .where(eq(schema.posts.slug, slug))
    .execute();

  const warnings: string[] = [];

  // Social Syndication upon approval
  const socialConfig = await getSocialConfig(c);
  const baseUrl = new URL(c.req.url).origin;

  c.executionCtx.waitUntil(
    dispatchSocials(
      c.get("db"),
      {
        title: row.title as string,
        url: `${baseUrl}/blog/${slug}`,
        snippet: (row.snippet || "Read the latest engineering update from ARES 23247!") as string,
        thumbnail: (row.thumbnail || "/gallery_1.png") as string,
        baseUrl: baseUrl
      },
      socialConfig
    ).catch((err: unknown) => console.error("[Approve] Social dispatch failed:", err))
  );

  // Initialize Zulip Thread
  import("./zulipSync").then(({ sendZulipMessage }) => {
    c.executionCtx.waitUntil(
      sendZulipMessage(
        socialConfig,
        "announcements",
        `Blog: ${row.title}`,
        `ðŸš€ **New Blog Post Published:** [${row.title}](${baseUrl}/blog/${slug})\n\n${row.snippet?.substring(0, 300) || ""}`
      ).catch((err: unknown) => console.error("[Approve] Zulip thread creation failed:", err))
    );
  }).catch((e: unknown) => console.error("[Approve] Zulip module import failed:", e));

  // Notify original author
  if (row.cfEmail) {
    const author = await db.select({ id: schema.user.id }).from(schema.user)
      .where(eq(schema.user.email, row.cfEmail))
      .get();

    if (author) {
      c.executionCtx.waitUntil(
        emitNotification(c, {
          userId: String(author.id),
          title: "Post Approved",
          message: `Your post "${row.title}" has been published.`,
          link: `/blog/${slug}`,
          priority: "medium"
        }).catch((err: unknown) => console.error("[Approve] Author notification failed:", err))
      );
    }
  }

  return { success: true, warnings };
}

