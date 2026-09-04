import express from "express";
import { hasPublicContentLifecycle } from "../lib/contentVisibility";
import rateLimit from "express-rate-limit";
import { adminDb } from "../lib/firebase-admin";
import { toPlainText } from "../lib/contentFormatters";
import { asyncHandler } from "../lib/utils";
import { distributedAnonymousQuota } from "../middleware/distributedQuota";

const router = express.Router();
const SITE_ORIGIN = "https://aresfirst.org";
const CACHE_CONTROL =
  "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

router.use(
  rateLimit({
    windowMs: 15 * 60 * 1_000,
    max: 300,
    message: { error: "Too many feed requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
router.use(distributedAnonymousQuota({
  scope: "public-feed",
  limit: 300,
  windowMs: 15 * 60 * 1000,
}));

function xmlText(value: string): string {
  return value
    .replace(
      /[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu,
      " ",
    )
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&apos;");
}

interface TimestampLike {
  toDate: () => Date;
}

function feedDate(...values: unknown[]): Date | null {
  for (const value of values) {
    let candidate: Date | null = null;
    try {
      if (value instanceof Date) candidate = value;
      else if (
        value &&
        typeof value === "object" &&
        typeof (value as Partial<TimestampLike>).toDate === "function"
      ) {
        candidate = (value as TimestampLike).toDate();
      } else if (typeof value === "string" || typeof value === "number") {
        candidate = new Date(value);
      }
    } catch {
      candidate = null;
    }

    if (candidate && Number.isFinite(candidate.getTime())) return candidate;
  }
  return null;
}

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const snapshot = await adminDb
      .collection("posts")
      .where("isDeleted", "==", 0)
      .where("status", "==", "published")
      .orderBy("date", "desc")
      .limit(50)
      .get();

    // Match the syndication gate: a published post must also be approved when
    // approval metadata exists (legacy records predate the approval workflow).
    const approvedDocs = snapshot.docs.filter((document) => hasPublicContentLifecycle(document.data()));
    const itemDates: Date[] = [];
    const itemsXml = approvedDocs.map((document) => {
      const data = document.data() as Record<string, unknown>;
      const title =
        typeof data.title === "string" && data.title.trim()
          ? data.title.trim()
          : "Untitled Post";
      const description = toPlainText(data.snippet ?? data.content ?? "", 400);
      const postUrl = `${SITE_ORIGIN}/blog/${encodeURIComponent(document.id)}`;
      const publishedAt = feedDate(data.approvedAt, data.date, data.createdAt);
      if (publishedAt) itemDates.push(publishedAt);
      const author =
        typeof data.author === "string" && data.author.trim()
          ? data.author.trim()
          : "ARES 23247 Team";

      return `
    <item>
      <title>${xmlText(title)}</title>
      <link>${xmlText(postUrl)}</link>
      <guid isPermaLink="true">${xmlText(postUrl)}</guid>
      <description>${xmlText(description)}</description>
      <dc:creator>${xmlText(author)}</dc:creator>${
        publishedAt
          ? `\n      <pubDate>${publishedAt.toUTCString()}</pubDate>`
          : ""
      }
    </item>`;
    });

    const lastBuildDate = itemDates.length
      ? new Date(Math.max(...itemDates.map((date) => date.getTime())))
      : new Date();
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>ARES 23247 Engineering Blog</title>
    <link>${SITE_ORIGIN}/blog</link>
    <description>Latest robotics updates, competition recaps, and technical articles from ARES 23247.</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_ORIGIN}/feed.xml" rel="self" type="application/rss+xml"/>
    ${itemsXml.join("")}
  </channel>
</rss>`;

    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.setHeader("Cache-Control", CACHE_CONTROL);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(xml.trim());
  }),
);

export default router;
