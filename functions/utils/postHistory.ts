/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context } from "hono";
import { AppEnv, SessionUser, getSocialConfig } from "../api/middleware";
import { emitNotification } from "./notifications";
import { dispatchSocials } from "./socialSync";

export interface PostHistoryRow {
  id: number;
  title: string;
  author: string;
  author_email: string;
  created_at: string;
}

export interface PostHistoryContent {
  title: string;
  author: string;
  thumbnail: string;
  snippet: string;
  ast: string;
  season_id?: string;
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
    coverImageUrl?: string;
    snippet: string;
    astStr: string;
    publishedAt?: string;
    seasonId?: string;
  }
) {
  const db = c.get("db");
  const suffix = Math.random().toString(36).substring(2, 6);
  const revSlug = `${originalSlug}-rev-${suffix}`;
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "2-digit" });

  await db.insertInto("posts")
    .values({
      slug: revSlug,
      title: data.title,
      author: data.author || "ARES Team",
      date: dateStr,
      thumbnail: data.coverImageUrl || "",
      snippet: data.snippet,
      ast: data.astStr,
      cf_email: user.email,
      status: 'pending',
      revision_of: originalSlug,
      published_at: data.publishedAt || "" as any,
      season_id: data.seasonId || "" as any
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
  row: { title: string; author: string; thumbnail: string; snippet: string; ast: string; cf_email: string; season_id?: string }
) {
  const db = c.get("db");

  // Update original
  await db.updateTable("posts")
    .set({
      title: row.title as string,
      author: row.author || "ARES Team",
      thumbnail: row.thumbnail,
      snippet: row.snippet,
      ast: row.ast,
      status: 'published',
      season_id: row.season_id || "" as any
    })
    .where("slug", "=", originalSlug)
    .execute();
  
  // Delete shadow
  await db.deleteFrom("posts").where("slug", "=", shadowSlug).execute();

  // Notify author
  if (row.cf_email) {
    const author = await db.selectFrom("user")
      .select("id")
      .where("email", "=", row.cf_email)
      .executeTakeFirst();
    
    if (author) {
      c.executionCtx.waitUntil(emitNotification(c, {
        userId: author.id as string,
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
    const oldestToKeep = await db.selectFrom("posts_history")
      .select("id")
      .where("slug", "=", slug)
      .orderBy("created_at", "desc")
      .offset(limit - 1)
      .limit(1)
      .executeTakeFirst();

    if (oldestToKeep) {
      await db.deleteFrom("posts_history")
        .where("slug", "=", slug)
        .where("id", "<", oldestToKeep.id)
        .execute();
    }
    } catch {
      // ignore
    }
}

/**
 * Saves current post state to history table.
 */
export async function captureHistory(
  c: Context<AppEnv>,
  slug: string,
  data: { title: string; author: string; thumbnail: string; snippet: string; ast: string; cf_email: string; season_id?: string }
) {
  const db = c.get("db");
  await db.insertInto("posts_history")
    .values({
      slug,
      title: data.title,
      author: data.author,
      thumbnail: data.thumbnail,
      snippet: data.snippet,
      ast: data.ast,
      author_email: data.cf_email || "unknown",
      season_id: data.season_id || "" as any
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
  const results = await db.selectFrom("posts_history")
    .select(["id", "title", "author", "author_email", "created_at", "season_id"])
    .where("slug", "=", slug)
    .orderBy("created_at", "desc")
    .limit(50)
    .execute();
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
  const row = await db.selectFrom("posts_history")
    .select(["title", "author", "thumbnail", "snippet", "ast", "season_id"])
    .where("id", "=", Number(id))
    .where("slug", "=", slug)
    .executeTakeFirst();

  if (!row) return { success: false, error: "Version not found" };

  // Capture CURRENT as history before restoring
  const current = await db.selectFrom("posts")
    .select(["slug", "title", "author", "thumbnail", "snippet", "ast", "cf_email", "season_id"])
    .where("slug", "=", slug)
    .executeTakeFirst();
  
  if (current) {
    // @ts-expect-error -- kysely types and manual casting
    await captureHistory(c, slug, current);
  }

  await db.updateTable("posts")
    .set({
      title: row.title as string,
      author: row.author,
      thumbnail: row.thumbnail,
      snippet: row.snippet,
      ast: row.ast,
      cf_email: restorerEmail,
      season_id: row.season_id || "" as any
    })
    .where("slug", "=", slug)
    .execute();

  return { success: true };
}

/**
 * Approves a pending post or shadow revision.
 */
export async function approvePost(c: Context<AppEnv>, slug: string) {
  const db = c.get("db");
  const row = await db.selectFrom("posts")
    .select(["revision_of", "title", "author", "thumbnail", "snippet", "ast", "cf_email", "season_id"])
    .where("slug", "=", slug)
    .executeTakeFirst();

  if (!row) return { success: false, error: "Post not found" };

  if (row.revision_of) {
    // @ts-expect-error -- kysely types and manual casting
    await approveAndMergeRevision(c, slug, row.revision_of, row);
    return { success: true, warnings: [] };
  }

  await db.updateTable("posts")
    .set({ status: 'published' })
    .where("slug", "=", slug)
    .execute();

  const warnings: string[] = [];

  // Social Syndication upon approval
  const socialConfig = await getSocialConfig(c);
  const baseUrl = new URL(c.req.url).origin;

  c.executionCtx.waitUntil(
    dispatchSocials(
      c.env.DB,
      {
        title: row.title as string,
        url: `${baseUrl}/blog/${slug}`,
        snippet: (row.snippet || "Read the latest engineering update from ARES 23247!") as string,
        coverImageUrl: (row.thumbnail || "/gallery_1.png") as string,
        baseUrl: baseUrl
      },
      socialConfig
    ).catch(err => console.error("[Approve] Social dispatch failed:", err))
  );

  // Notify original author
  if (row.cf_email) {
    const author = await db.selectFrom("user")
      .select("id")
      .where("email", "=", row.cf_email)
      .executeTakeFirst();

    if (author) {
      c.executionCtx.waitUntil(
        emitNotification(c, {
          userId: author.id as string,
          title: "Post Approved",
          message: `Your post "${row.title}" has been published.`,
          link: `/blog/${slug}`,
          priority: "medium"
        }).catch(err => console.error("[Approve] Author notification failed:", err))
      );
    }
  }

  return { success: true, warnings };
}