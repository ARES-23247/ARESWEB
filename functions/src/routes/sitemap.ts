import express from "express";
import { adminDb } from "../lib/firebase-admin";
import { logger } from "../lib/logger";
import { ApiError } from "../middleware/errorHandler";
import { asyncHandler } from "../lib/utils";

const router = express.Router();
const BASE_URL = "https://aresfirst.org";
const MAX_DOCUMENTS_PER_COLLECTION = 500;
const CACHE_CONTROL = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

const STATIC_URLS = [
  { loc: `${BASE_URL}/`, changefreq: "daily", priority: "1.00" },
  { loc: `${BASE_URL}/about`, changefreq: "monthly", priority: "0.80" },
  { loc: `${BASE_URL}/academy`, changefreq: "weekly", priority: "0.80" },
  { loc: `${BASE_URL}/accessibility`, changefreq: "monthly", priority: "0.50" },
  { loc: `${BASE_URL}/blog`, changefreq: "daily", priority: "0.80" },
  { loc: `${BASE_URL}/calendar`, changefreq: "weekly", priority: "0.70" },
  { loc: `${BASE_URL}/developer-api`, changefreq: "monthly", priority: "0.60" },
  { loc: `${BASE_URL}/finance`, changefreq: "monthly", priority: "0.60" },
  { loc: `${BASE_URL}/gallery`, changefreq: "weekly", priority: "0.70" },
  { loc: `${BASE_URL}/videos`, changefreq: "weekly", priority: "0.70" },
  { loc: `${BASE_URL}/join`, changefreq: "monthly", priority: "0.90" },
  { loc: `${BASE_URL}/leaderboard`, changefreq: "weekly", priority: "0.70" },
  { loc: `${BASE_URL}/location-morgantown`, changefreq: "monthly", priority: "0.60" },
  { loc: `${BASE_URL}/outreach`, changefreq: "weekly", priority: "0.80" },
  { loc: `${BASE_URL}/privacy`, changefreq: "monthly", priority: "0.50" },
  { loc: `${BASE_URL}/robots`, changefreq: "weekly", priority: "0.80" },
  { loc: `${BASE_URL}/seasons`, changefreq: "monthly", priority: "0.80" },
  { loc: `${BASE_URL}/sponsors`, changefreq: "monthly", priority: "0.80" },
  { loc: `${BASE_URL}/store`, changefreq: "weekly", priority: "0.70" },
  { loc: `${BASE_URL}/tech-stack`, changefreq: "monthly", priority: "0.50" },
  { loc: `${BASE_URL}/terms`, changefreq: "monthly", priority: "0.50" },
  { loc: `${BASE_URL}/tournaments`, changefreq: "weekly", priority: "0.70" }
] as const;

interface SitemapEntry {
  loc: string;
  changefreq: "daily" | "weekly" | "monthly";
  priority: string;
  lastmod?: string;
}

interface FirestoreTimestampLike {
  toDate: () => Date;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function normalizeLastModified(value: unknown): string | undefined {
  let candidate: unknown = value;

  if (
    typeof candidate === "object" &&
    candidate !== null &&
    "toDate" in candidate &&
    typeof (candidate as FirestoreTimestampLike).toDate === "function"
  ) {
    try {
      candidate = (candidate as FirestoreTimestampLike).toDate();
    } catch {
      return undefined;
    }
  }

  if (!(typeof candidate === "string" || candidate instanceof Date)) {
    return undefined;
  }

  const parsed = candidate instanceof Date ? candidate : new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function getLastModified(data: Record<string, unknown>): string | undefined {
  return normalizeLastModified(
    data.updatedAt ?? data.publishedAt ?? data.datePublished ?? data.date
  );
}

function renderEntry(entry: SitemapEntry): string {
  const lastmod = entry.lastmod ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "";
  return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>${lastmod}\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`;
}

const handleSitemapRequest = asyncHandler(async (_req, res) => {
  let snapshots;

  try {
    snapshots = await Promise.all([
      adminDb.collection("posts")
        .where("status", "==", "published")
        .where("isDeleted", "==", 0)
        .limit(MAX_DOCUMENTS_PER_COLLECTION)
        .get(),
      adminDb.collection("robots")
        .where("isDeleted", "==", 0)
        .limit(MAX_DOCUMENTS_PER_COLLECTION)
        .get(),
      adminDb.collection("academy")
        .where("status", "==", "published")
        .where("isDeleted", "==", 0)
        .limit(MAX_DOCUMENTS_PER_COLLECTION)
        .get(),
      adminDb.collection("docs")
        .where("status", "==", "published")
        .where("isDeleted", "==", 0)
        .limit(MAX_DOCUMENTS_PER_COLLECTION)
        .get(),
      adminDb.collection("events")
        .where("status", "==", "published")
        .where("isDeleted", "==", 0)
        .limit(MAX_DOCUMENTS_PER_COLLECTION)
        .get()
    ]);
  } catch (error) {
    logger.error("sitemap", "Unable to build the sitemap from published content", error);
    throw new ApiError(503, "Sitemap is temporarily unavailable.", "SITEMAP_QUERY_FAILED");
  }

  const entries = new Map<string, SitemapEntry>();
  const addEntry = (entry: SitemapEntry) => entries.set(entry.loc, entry);

  STATIC_URLS.forEach(addEntry);

  const [postsSnap, robotsSnap, academySnap, docsSnap, eventsSnap] = snapshots;

  postsSnap.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>;
    addEntry({
      loc: `${BASE_URL}/blog/${encodeURIComponent(doc.id)}`,
      changefreq: "weekly",
      priority: "0.60",
      lastmod: getLastModified(data)
    });
  });

  robotsSnap.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>;
    addEntry({
      loc: `${BASE_URL}/robots/${encodeURIComponent(doc.id)}`,
      changefreq: "weekly",
      priority: "0.60",
      lastmod: getLastModified(data)
    });
  });

  academySnap.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>;
    addEntry({
      loc: `${BASE_URL}/academy/${encodeURIComponent(doc.id)}`,
      changefreq: "weekly",
      priority: "0.70",
      lastmod: getLastModified(data)
    });
  });

  docsSnap.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const path = data.displayInMathCorner === 1 || data.displayInScienceCorner === 1
      ? "academy"
      : data.displayInAreslib === 1
        ? "docs"
        : null;

    if (path) {
      addEntry({
        loc: `${BASE_URL}/${path}/${encodeURIComponent(doc.id)}`,
        changefreq: "weekly",
        priority: "0.70",
        lastmod: getLastModified(data)
      });
    }
  });

  eventsSnap.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>;
    addEntry({
      loc: `${BASE_URL}/events/${encodeURIComponent(doc.id)}`,
      changefreq: "weekly",
      priority: "0.60",
      lastmod: getLastModified(data)
    });
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Array.from(entries.values(), renderEntry).join("\n")}\n</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", CACHE_CONTROL);
  res.send(xml);
});

router.get("/", handleSitemapRequest);
router.get("/sitemap.xml", handleSitemapRequest);

export default router;
