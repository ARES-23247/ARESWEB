/**
 * Blog Syndication, Taxonomy, Reading Time, and Navigation Helpers
 *
 * Provides utilities for:
 * - Category taxonomy filtering
 * - Reading-time calculation based on word count
 * - Markdown heading extraction for Table of Contents
 * - Social quote formatting
 * - RSS 2.0 and Atom 1.0 XML syndication generation
 */

import { siteConfig } from "./site-config";

export const BLOG_CATEGORIES = [
  "All",
  "Engineering",
  "Software",
  "Outreach",
  "Business",
  "Competitions",
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

export const BLOG_CATEGORY_ITEMS: readonly Exclude<BlogCategory, "All">[] = [
  "Engineering",
  "Software",
  "Outreach",
  "Business",
  "Competitions",
] as const;

export interface BlogPostFeedItem {
  slug: string;
  title: string;
  snippet?: string;
  content?: string;
  date?: string;
  author?: string;
  thumbnail?: string;
  category?: string;
}

export interface ReadingTimeResult {
  minutes: number;
  words: number;
  text: string;
  timeRequiredIso: string;
}

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export interface FeedGenerationOptions {
  posts: BlogPostFeedItem[];
  siteUrl?: string;
  title?: string;
  description?: string;
  feedUrl?: string;
  updated?: string;
}

/**
 * Filter a list of posts by category taxonomy.
 * "All" returns all posts unconditionally.
 */
export function filterPostsByCategory<T extends { category?: string }>(
  posts: T[],
  category?: string | null,
): T[] {
  if (!Array.isArray(posts)) return [];
  if (!category || category.trim().toLowerCase() === "all") {
    return posts;
  }
  const targetCategory = category.trim().toLowerCase();
  return posts.filter(
    (post) => post.category && post.category.trim().toLowerCase() === targetCategory,
  );
}

/**
 * Strips markdown and HTML formatting to count words and estimate reading time.
 * Default reading speed is 200 words per minute.
 */
export function calculateReadingTime(
  content?: string | null,
  wordsPerMinute: number = 200,
): ReadingTimeResult {
  if (!content || typeof content !== "string") {
    return {
      minutes: 1,
      words: 0,
      text: "1 min read",
      timeRequiredIso: "PT1M",
    };
  }

  // Strip code blocks, HTML tags, markdown links, images, headings, and formatting
  const sanitized = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^[#>-]+\s+/gm, "")
    .replace(/[*_~]/g, " ")
    .trim();

  const words = sanitized ? sanitized.split(/\s+/).filter(Boolean).length : 0;
  const effectiveWpm = wordsPerMinute > 0 ? wordsPerMinute : 200;
  const minutes = Math.max(1, Math.ceil(words / effectiveWpm));

  return {
    minutes,
    words,
    text: `${minutes} min read`,
    timeRequiredIso: `PT${minutes}M`,
  };
}

/**
 * Convert heading text into a URL-friendly anchor slug.
 */
export function slugifyHeading(text?: string | null): string {
  if (!text || typeof text !== "string") return "heading";
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "heading";
}

/**
 * Extract H2 and H3 headings from markdown text for Table of Contents generation.
 * Handles duplicate heading titles by appending a sequential suffix.
 */
export function extractTableOfContents(markdown?: string | null): TocItem[] {
  if (!markdown || typeof markdown !== "string") return [];

  // Remove code blocks first so `#` in code blocks is not parsed as a heading
  const cleanedMarkdown = markdown.replace(/```[\s\S]*?```/g, "");

  const headingRegex = /^(#{2,4})\s+(.+)$/gm;
  const items: TocItem[] = [];
  const slugCounts = new Map<string, number>();

  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(cleanedMarkdown)) !== null) {
    const hashes = match[1];
    const rawHeading = match[2].trim();
    const level = hashes.length;

    // Clean inline markdown links, bold, code from the heading text
    const cleanText = rawHeading
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*`_~]/g, "")
      .trim();

    if (!cleanText) continue;

    const baseSlug = slugifyHeading(cleanText);
    const count = slugCounts.get(baseSlug) || 0;
    slugCounts.set(baseSlug, count + 1);

    const id = count === 0 ? baseSlug : `${baseSlug}-${count}`;

    items.push({
      id,
      text: cleanText,
      level,
    });
  }

  return items;
}

/**
 * Format a quote snippet for clipboard copying and social sharing.
 */
export function formatQuoteForSharing(
  quote?: string | null,
  postTitle?: string,
  postUrl?: string,
): string {
  if (!quote || typeof quote !== "string") return "";

  // Clean markdown blockquote syntax and excess whitespace
  const cleanQuote = quote
    .replace(/^>\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanQuote) return "";

  const attributionParts: string[] = [];
  if (postTitle && postTitle.trim()) {
    attributionParts.push(`"${postTitle.trim()}"`);
  }
  if (postUrl && postUrl.trim()) {
    attributionParts.push(postUrl.trim());
  }

  const attribution = attributionParts.length > 0 ? ` — ${attributionParts.join(" | ")}` : "";
  return `"${cleanQuote}"${attribution}`;
}

/**
 * Escape XML special characters.
 */
export function escapeXml(str?: string | null): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Convert arbitrary date string or timestamp to RFC 822 format (for RSS 2.0).
 */
function toRfc822Date(dateString?: string): string {
  if (dateString) {
    const timestamp = Date.parse(dateString);
    if (!isNaN(timestamp)) {
      return new Date(timestamp).toUTCString();
    }
  }
  return new Date().toUTCString();
}

/**
 * Convert arbitrary date string or timestamp to ISO 8601 format (for Atom 1.0).
 */
function toIsoDate(dateString?: string): string {
  if (dateString) {
    const timestamp = Date.parse(dateString);
    if (!isNaN(timestamp)) {
      return new Date(timestamp).toISOString();
    }
  }
  return new Date().toISOString();
}

/**
 * Generate standard RSS 2.0 XML syndication feed.
 */
export function generateRssFeed(options: FeedGenerationOptions): string {
  const siteUrl = options.siteUrl || siteConfig.urls.base;
  const title = options.title || "ARES 23247 Team Blog";
  const description =
    options.description ||
    "Technical updates, mechanical designs, code breakdowns, and outreach reflections from ARES 23247.";
  const feedUrl = options.feedUrl || `${siteUrl}/rss.xml`;
  const lastBuildDate = toRfc822Date(options.updated);

  const itemsXml = (options.posts || [])
    .map((post) => {
      const postUrl = `${siteUrl}/blog/${encodeURIComponent(post.slug)}`;
      const pubDate = toRfc822Date(post.date);
      const postSnippet = post.snippet || post.content?.slice(0, 300) || "";
      const categoryTag = post.category
        ? `\n      <category>${escapeXml(post.category)}</category>`
        : "";
      const authorTag = post.author
        ? `\n      <author>${escapeXml(siteConfig.contact.email)} (${escapeXml(post.author)})</author>`
        : `\n      <author>${escapeXml(siteConfig.contact.email)} (ARES 23247)</author>`;

      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(postUrl)}</link>
      <guid isPermaLink="true">${escapeXml(postUrl)}</guid>
      <pubDate>${pubDate}</pubDate>${authorTag}${categoryTag}
      <description>${escapeXml(postSnippet)}</description>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(`${siteUrl}/blog`)}</link>
    <description>${escapeXml(description)}</description>
    <language>en-US</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`;
}

/**
 * Generate standard Atom 1.0 XML syndication feed.
 */
export function generateAtomFeed(options: FeedGenerationOptions): string {
  const siteUrl = options.siteUrl || siteConfig.urls.base;
  const title = options.title || "ARES 23247 Team Blog";
  const subtitle =
    options.description ||
    "Technical updates, mechanical designs, code breakdowns, and outreach reflections from ARES 23247.";
  const feedUrl = options.feedUrl || `${siteUrl}/atom.xml`;
  const blogUrl = `${siteUrl}/blog`;
  const feedUpdated = toIsoDate(options.updated);

  const entriesXml = (options.posts || [])
    .map((post) => {
      const postUrl = `${siteUrl}/blog/${encodeURIComponent(post.slug)}`;
      const postUpdated = toIsoDate(post.date);
      const postSummary = post.snippet || post.content?.slice(0, 300) || "";
      const authorName = post.author || "ARES 23247";
      const categoryTag = post.category
        ? `\n    <category term="${escapeXml(post.category)}" />`
        : "";

      return `  <entry>
    <title>${escapeXml(post.title)}</title>
    <id>${escapeXml(postUrl)}</id>
    <link href="${escapeXml(postUrl)}" rel="alternate" />
    <updated>${postUpdated}</updated>
    <author>
      <name>${escapeXml(authorName)}</name>
    </author>${categoryTag}
    <summary>${escapeXml(postSummary)}</summary>
  </entry>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(title)}</title>
  <subtitle>${escapeXml(subtitle)}</subtitle>
  <id>${escapeXml(blogUrl)}</id>
  <updated>${feedUpdated}</updated>
  <link href="${escapeXml(blogUrl)}" rel="alternate" />
  <link href="${escapeXml(feedUrl)}" rel="self" />
${entriesXml}
</feed>`;
}
