import express from "express";
import rateLimit from "express-rate-limit";
import { adminDb } from "../lib/firebase-admin";
import { asyncHandler } from "../lib/utils";
import { toPlainText } from "../lib/contentFormatters";

const router = express.Router();

router.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: { error: "Too many feed requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

router.get(
  ["/feed.xml", "/rss.xml", "/feed"],
  asyncHandler(async (_req, res) => {
    const siteUrl = "https://aresfirst.org";
    const snapshot = await adminDb
      .collection("posts")
      .where("isDeleted", "==", 0)
      .where("status", "==", "published")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const itemsXml: string[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const slug = doc.id;
      const title = typeof data.title === "string" ? data.title : "Untitled Post";
      const rawDescription = typeof data.snippet === "string" ? data.snippet : (typeof data.content === "string" ? data.content : "");
      const description = toPlainText(rawDescription, 400);
      const postUrl = `${siteUrl}/blog/${encodeURIComponent(slug)}`;
      const pubDate = data.createdAt ? new Date(data.createdAt).toUTCString() : new Date().toUTCString();
      const author = typeof data.author === "string" ? data.author : "ARES 23247 Team";

      itemsXml.push(`
    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(postUrl)}</link>
      <guid isPermaLink="true">${escapeXml(postUrl)}</guid>
      <description>${escapeXml(description)}</description>
      <author>${escapeXml(author)}</author>
      <pubDate>${pubDate}</pubDate>
    </item>`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>ARES 23247 Engineering Blog</title>
    <link>${siteUrl}/blog</link>
    <description>Latest robotics updates, competition recaps, and technical articles from ARES 23247.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/api/feed.xml" rel="self" type="application/rss+xml"/>
    ${itemsXml.join("")}
  </channel>
</rss>`;

    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=1800, s-maxage=3600");
    res.send(xml.trim());
  }),
);

export default router;
