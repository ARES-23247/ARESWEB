import { Context } from "hono";
import { AppEnv, SessionUser } from "../api/middleware";
import { emitNotification } from "./notifications";

export interface PostHistoryRow {
  id: string;
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
  }
) {
  const suffix = Math.random().toString(36).substring(2, 6);
  const revSlug = `${originalSlug}-rev-${suffix}`;
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "2-digit" });

  await c.env.DB.prepare(
    `INSERT INTO posts (slug, title, author, date, thumbnail, snippet, ast, cf_email, status, revision_of, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).bind(
    revSlug,
    data.title,
    data.author || "ARES Team",
    dateStr,
    data.coverImageUrl || "",
    data.snippet,
    data.astStr,
    user.email,
    originalSlug,
    data.publishedAt || null
  ).run();

  return revSlug;
}

/**
 * Merges a shadow revision back into the original post.
 */
export async function approveAndMergeRevision(
  c: Context<AppEnv>,
  shadowSlug: string,
  originalSlug: string,
  row: { title: string; author: string; thumbnail: string; snippet: string; ast: string; cf_email: string }
) {
  // Update original
  await c.env.DB.prepare(
    "UPDATE posts SET title = ?, author = ?, thumbnail = ?, snippet = ?, ast = ?, status = 'published' WHERE slug = ?"
  ).bind(row.title, row.author || "ARES Team", row.thumbnail, row.snippet, row.ast, originalSlug).run();
  
  // Delete shadow
  await c.env.DB.prepare("DELETE FROM posts WHERE slug = ?").bind(shadowSlug).run();

  // Notify author
  if (row.cf_email) {
    const author = await c.env.DB.prepare("SELECT id FROM user WHERE email = ?").bind(row.cf_email).first<{ id: string }>();
    if (author) {
      c.executionCtx.waitUntil(emitNotification(c, {
        userId: author.id,
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
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT id FROM posts_history WHERE slug = ? ORDER BY created_at DESC LIMIT 1 OFFSET ?"
    ).bind(slug, limit - 1).all();

    if (results && results.length > 0) {
      const oldestId = (results[0] as { id: number }).id;
      await c.env.DB.prepare(
        "DELETE FROM posts_history WHERE slug = ? AND id < ?"
      ).bind(slug, oldestId).run();
    }
  } catch (err) {
    console.error("[PostHistory] Prune failed:", err);
  }
}

/**
 * Saves current post state to history table.
 */
export async function captureHistory(
  c: Context<AppEnv>,
  slug: string,
  data: { title: string; author: string; thumbnail: string; snippet: string; ast: string; cf_email: string }
) {
  await c.env.DB.prepare(
    "INSERT INTO posts_history (slug, title, author, thumbnail, snippet, ast, author_email) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(slug, data.title, data.author, data.thumbnail, data.snippet, data.ast, data.cf_email || "unknown").run();

  // EFF-N05: Prune old versions to prevent D1 bloat
  c.executionCtx.waitUntil(pruneHistory(c, slug, 10));
}

/**
 * Fetches history records for a post.
 */
export async function getPostHistory(c: Context<AppEnv>, slug: string) {
  const { results } = await c.env.DB.prepare(
    "SELECT id, title, author, author_email, created_at FROM posts_history WHERE slug = ? ORDER BY created_at DESC LIMIT 50"
  ).bind(slug).all();
  return results ?? [];
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
  const row = await c.env.DB.prepare(
    "SELECT title, author, thumbnail, snippet, ast FROM posts_history WHERE id = ? AND slug = ?"
  ).bind(id, slug).first<PostHistoryContent>();

  if (!row) return { success: false, error: "Version not found" };

  // Capture CURRENT as history before restoring
  const current = await c.env.DB.prepare(
    "SELECT slug, title, author, thumbnail, snippet, ast, cf_email FROM posts WHERE slug = ?"
  ).bind(slug).first<{ title: string; author: string; thumbnail: string; snippet: string; ast: string; cf_email: string }>();
  
  if (current) {
    await captureHistory(c, slug, current);
  }

  await c.env.DB.prepare(
    "UPDATE posts SET title = ?, author = ?, thumbnail = ?, snippet = ?, ast = ?, cf_email = ? WHERE slug = ?"
  ).bind(row.title, row.author, row.thumbnail, row.snippet, row.ast, restorerEmail, slug).run();

  return { success: true };
}

/**
 * Approves a pending post or shadow revision.
 */
export async function approvePost(c: Context<AppEnv>, slug: string) {
  type PostRow = { revision_of?: string; title: string; author: string; thumbnail: string; snippet: string; ast: string; cf_email: string };
  const row = await c.env.DB.prepare(
    "SELECT revision_of, title, author, thumbnail, snippet, ast, cf_email FROM posts WHERE slug = ?"
  ).bind(slug).first<PostRow>();

  if (!row) return { success: false, error: "Post not found" };

  if (row.revision_of) {
    await approveAndMergeRevision(c, slug, row.revision_of, row);
    return { success: true };
  }

  await c.env.DB.prepare("UPDATE posts SET status = 'published' WHERE slug = ?").bind(slug).run();

  // Notify original author
  if (row.cf_email) {
    const author = await c.env.DB.prepare("SELECT id FROM user WHERE email = ?").bind(row.cf_email).first<{ id: string }>();
    if (author) {
      c.executionCtx.waitUntil(emitNotification(c, {
        userId: author.id,
        title: "Post Approved",
        message: `Your post "${row.title}" has been published.`,
        link: `/blog/${slug}`,
        priority: "medium"
      }));
    }
  }

  return { success: true };
}
