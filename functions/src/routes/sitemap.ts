import express from "express";
import { adminDb } from "../lib/firebase-admin";
import { asyncHandler } from "../lib/utils";
import { logger } from "../lib/logger";

const router = express.Router();

const STATIC_URLS = [
  { loc: "https://aresfirst.org/", changefreq: "daily", priority: "1.00" },
  { loc: "https://aresfirst.org/about", changefreq: "monthly", priority: "0.80" },
  { loc: "https://aresfirst.org/academy", changefreq: "weekly", priority: "0.80" },
  { loc: "https://aresfirst.org/accessibility", changefreq: "monthly", priority: "0.50" },
  { loc: "https://aresfirst.org/blog", changefreq: "daily", priority: "0.80" },
  { loc: "https://aresfirst.org/calendar", changefreq: "weekly", priority: "0.70" },
  { loc: "https://aresfirst.org/developer-api", changefreq: "monthly", priority: "0.60" },
  { loc: "https://aresfirst.org/finance", changefreq: "monthly", priority: "0.60" },
  { loc: "https://aresfirst.org/gallery", changefreq: "weekly", priority: "0.70" },
  { loc: "https://aresfirst.org/videos", changefreq: "weekly", priority: "0.70" },
  { loc: "https://aresfirst.org/join", changefreq: "monthly", priority: "0.90" },
  { loc: "https://aresfirst.org/leaderboard", changefreq: "weekly", priority: "0.70" },
  { loc: "https://aresfirst.org/location-morgantown", changefreq: "monthly", priority: "0.60" },
  { loc: "https://aresfirst.org/outreach", changefreq: "weekly", priority: "0.80" },
  { loc: "https://aresfirst.org/privacy", changefreq: "monthly", priority: "0.50" },
  { loc: "https://aresfirst.org/robots", changefreq: "weekly", priority: "0.80" },
  { loc: "https://aresfirst.org/seasons", changefreq: "monthly", priority: "0.80" },
  { loc: "https://aresfirst.org/sponsors", changefreq: "monthly", priority: "0.80" },
  { loc: "https://aresfirst.org/store", changefreq: "weekly", priority: "0.70" },
  { loc: "https://aresfirst.org/tech-stack", changefreq: "monthly", priority: "0.50" },
  { loc: "https://aresfirst.org/terms", changefreq: "monthly", priority: "0.50" }
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const handleSitemapRequest = asyncHandler(async (req, res) => {
  const urls: string[] = [];

  // 1. Add static URLs
  for (const item of STATIC_URLS) {
    urls.push(`  <url>
    <loc>${item.loc}</loc>
    <changefreq>${item.changefreq}</changefreq>
    <priority>${item.priority}</priority>
  </url>`);
  }

  // 2. Fetch blogs (posts collection)
  try {
    const postsSnap = await adminDb
      .collection("posts")
      .where("status", "==", "published")
      .where("isDeleted", "==", 0)
      .get();
    
    postsSnap.forEach((doc) => {
      const slug = escapeXml(doc.id);
      urls.push(`  <url>
    <loc>https://aresfirst.org/blog/${slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.60</priority>
  </url>`);
    });
  } catch (error) {
    logger.error("sitemap", "Error querying posts collection for sitemap", error);
  }

  // 3. Fetch robots (robots collection)
  try {
    const robotsSnap = await adminDb
      .collection("robots")
      .where("isDeleted", "==", 0)
      .get();
    
    robotsSnap.forEach((doc) => {
      const id = escapeXml(doc.id);
      urls.push(`  <url>
    <loc>https://aresfirst.org/robots/${id}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.60</priority>
  </url>`);
    });
  } catch (error) {
    logger.error("sitemap", "Error querying robots collection for sitemap", error);
  }

  // 4. Fetch academy (academy collection)
  try {
    const academySnap = await adminDb
      .collection("academy")
      .where("status", "==", "published")
      .where("isDeleted", "==", 0)
      .get();
    
    academySnap.forEach((doc) => {
      const slug = escapeXml(doc.id);
      urls.push(`  <url>
    <loc>https://aresfirst.org/academy/${slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.70</priority>
  </url>`);
    });
  } catch (error) {
    // Ignore if academy collection is not present/empty in some environments
  }

  // 5. Fetch docs (as fallback/additional tutorials)
  try {
    const docsSnap = await adminDb
      .collection("docs")
      .where("status", "==", "published")
      .where("isDeleted", "==", 0)
      .get();
    
    docsSnap.forEach((doc) => {
      const data = doc.data();
      const slug = escapeXml(doc.id);
      if (data.displayInMathCorner === 1 || data.displayInScienceCorner === 1) {
        urls.push(`  <url>
    <loc>https://aresfirst.org/academy/${slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.70</priority>
  </url>`);
      } else if (data.displayInAreslib === 1) {
        urls.push(`  <url>
    <loc>https://aresfirst.org/docs/${slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.70</priority>
  </url>`);
      }
    });
  } catch (error) {
    logger.error("sitemap", "Error querying docs collection for sitemap", error);
  }

  // 6. Fetch events (events collection)
  try {
    const eventsSnap = await adminDb
      .collection("events")
      .where("status", "==", "published")
      .where("isDeleted", "==", 0)
      .get();
    
    eventsSnap.forEach((doc) => {
      const id = escapeXml(doc.id);
      urls.push(`  <url>
    <loc>https://aresfirst.org/events/${id}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.60</priority>
  </url>`);
    });
  } catch (error) {
    logger.error("sitemap", "Error querying events collection for sitemap", error);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  res.setHeader("Content-Type", "application/xml");
  res.send(xml);
});

router.get("/", handleSitemapRequest);
router.get("/sitemap.xml", handleSitemapRequest);

export default router;
