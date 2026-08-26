import express from "express";
import { FieldPath } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin";
import { logger } from "../lib/logger";
import { ApiError } from "../middleware/errorHandler";
import { asyncHandler } from "../lib/utils";
import { readPublicArtifact, writePublicArtifact } from "../lib/publicArtifactCache";
import { distributedAnonymousQuota } from "../middleware/distributedQuota";

const router = express.Router();
const BASE_URL = "https://aresfirst.org";
const QUERY_PAGE_SIZE = 250;
const MAX_DOCUMENTS_PER_COLLECTION = 5_000;
const CACHE_CONTROL = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";
const SITEMAP_ARTIFACT_KEY = "sitemap";
const NON_PRODUCTION_RECORD_PATTERNS = [
  /(^|[-_])(e2e|fixture|wip)(?:$|[-_\d])/i,
  /(^|[-_])test(?:\d+)?(?:$|[-_])/i,
  /^event[-_]\d{13,}$/i,
  /^screen[-_]recording(?:$|[-_])/i,
] as const;

const STATIC_URLS = [
  { loc: `${BASE_URL}/`, changefreq: "daily", priority: "1.00" },
  { loc: `${BASE_URL}/about`, changefreq: "monthly", priority: "0.80" },
  { loc: `${BASE_URL}/academy`, changefreq: "weekly", priority: "0.80" },
  { loc: `${BASE_URL}/accessibility`, changefreq: "monthly", priority: "0.50" },
  { loc: `${BASE_URL}/brand`, changefreq: "monthly", priority: "0.50" },
  { loc: `${BASE_URL}/blog`, changefreq: "daily", priority: "0.80" },
  { loc: `${BASE_URL}/calendar`, changefreq: "weekly", priority: "0.70" },
  { loc: `${BASE_URL}/docs`, changefreq: "weekly", priority: "0.70" },
  { loc: `${BASE_URL}/finance`, changefreq: "monthly", priority: "0.60" },
  { loc: `${BASE_URL}/gallery`, changefreq: "weekly", priority: "0.70" },
  { loc: `${BASE_URL}/videos`, changefreq: "weekly", priority: "0.70" },
  { loc: `${BASE_URL}/join`, changefreq: "monthly", priority: "0.90" },
  { loc: `${BASE_URL}/leaderboard`, changefreq: "weekly", priority: "0.50" },
  { loc: `${BASE_URL}/location-morgantown`, changefreq: "monthly", priority: "0.60" },
  { loc: `${BASE_URL}/outreach`, changefreq: "weekly", priority: "0.80" },
  { loc: `${BASE_URL}/privacy`, changefreq: "monthly", priority: "0.50" },
  { loc: `${BASE_URL}/robotics-west-virginia`, changefreq: "monthly", priority: "0.70" },
  { loc: `${BASE_URL}/robots`, changefreq: "weekly", priority: "0.80" },
  { loc: `${BASE_URL}/seasons`, changefreq: "monthly", priority: "0.80" },
  { loc: `${BASE_URL}/sponsors`, changefreq: "monthly", priority: "0.80" },
  { loc: `${BASE_URL}/store`, changefreq: "monthly", priority: "0.60" },
  { loc: `${BASE_URL}/tournaments`, changefreq: "weekly", priority: "0.70" },
  { loc: `${BASE_URL}/tech-stack`, changefreq: "monthly", priority: "0.50" },
  { loc: `${BASE_URL}/terms`, changefreq: "monthly", priority: "0.50" }
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

interface SitemapCollectionQuery {
  collection: string;
  filters: ReadonlyArray<readonly [string, FirebaseFirestore.WhereFilterOp, unknown]>;
}

async function readCollectionPages({
  collection,
  filters,
}: SitemapCollectionQuery): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  let baseQuery: FirebaseFirestore.Query = adminDb.collection(collection);
  for (const [field, operator, value] of filters) {
    baseQuery = baseQuery.where(field, operator, value);
  }
  baseQuery = baseQuery.orderBy(FieldPath.documentId(), "asc");

  const documents: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  while (documents.length <= MAX_DOCUMENTS_PER_COLLECTION) {
    const remaining = MAX_DOCUMENTS_PER_COLLECTION + 1 - documents.length;
    const pageLimit = Math.min(QUERY_PAGE_SIZE, remaining);
    const pageQuery = cursor ? baseQuery.startAfter(cursor) : baseQuery;
    const snapshot = await pageQuery.limit(pageLimit).get();
    if (snapshot.docs.length === 0) break;

    documents.push(...snapshot.docs);
    cursor = snapshot.docs.at(-1);
    if (snapshot.docs.length < pageLimit) break;
  }

  if (documents.length > MAX_DOCUMENTS_PER_COLLECTION) {
    logger.warn("sitemap", "Published collection exceeds the sitemap safety cap", {
      collection,
      limit: MAX_DOCUMENTS_PER_COLLECTION,
    });
  }
  return documents.slice(0, MAX_DOCUMENTS_PER_COLLECTION);
}

export function isSitemapRecordIndexable(
  id: string,
  data: Record<string, unknown> = {},
): boolean {
  if (!id || data.searchIndexable === false) return false;
  return !NON_PRODUCTION_RECORD_PATTERNS.some((pattern) => pattern.test(id));
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

function renderSitemap(entries: Iterable<SitemapEntry>): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Array.from(entries, renderEntry).join("\n")}\n</urlset>`;
}

const STATIC_SITEMAP = renderSitemap(STATIC_URLS);

/** Expensive source scan used only by the scheduled artifact refresher. */
export async function buildSitemapXml(): Promise<string> {
  let snapshots;

  try {
    snapshots = await Promise.all([
      readCollectionPages({
        collection: "posts",
        filters: [["status", "==", "published"], ["isDeleted", "==", 0]],
      }),
      readCollectionPages({
        collection: "robots",
        filters: [["isDeleted", "==", 0]],
      }),
      readCollectionPages({
        collection: "docs",
        filters: [["status", "==", "published"], ["isDeleted", "==", 0]],
      }),
      readCollectionPages({
        collection: "events",
        filters: [["status", "==", "published"], ["isDeleted", "==", 0]],
      }),
    ]);
  } catch (error) {
    logger.error("sitemap", "Unable to build the sitemap from published content", error);
    throw new ApiError(503, "Sitemap is temporarily unavailable.", "SITEMAP_QUERY_FAILED");
  }

  const entries = new Map<string, SitemapEntry>();
  const addEntry = (entry: SitemapEntry) => entries.set(entry.loc, entry);

  STATIC_URLS.forEach(addEntry);

  const [postsSnap, robotsSnap, docsSnap, eventsSnap] = snapshots;

  postsSnap.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>;
    if (!isSitemapRecordIndexable(doc.id, data)) return;
    // Match the syndication gate: posts with explicit approval metadata must
    // be approved to be sitemap-visible (legacy records predate approvals).
    if (data.approvalStatus !== undefined && data.approvalStatus !== "approved") return;
    addEntry({
      loc: `${BASE_URL}/blog/${encodeURIComponent(doc.id)}`,
      changefreq: "weekly",
      priority: "0.60",
      lastmod: getLastModified(data)
    });
  });

  robotsSnap.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>;
    if (!isSitemapRecordIndexable(doc.id, data)) return;
    addEntry({
      loc: `${BASE_URL}/robots/${encodeURIComponent(doc.id)}`,
      changefreq: "weekly",
      priority: "0.60",
      lastmod: getLastModified(data)
    });
  });

  docsSnap.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>;
    if (!isSitemapRecordIndexable(doc.id, data)) return;
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
    if (!isSitemapRecordIndexable(doc.id, data)) return;
    addEntry({
      loc: `${BASE_URL}/events/${encodeURIComponent(doc.id)}`,
      changefreq: "weekly",
      priority: "0.60",
      lastmod: getLastModified(data)
    });
  });

  return renderSitemap(entries.values());
}

/** Precomputes the durable sitemap served by every public request instance. */
export async function refreshSitemapArtifact(): Promise<void> {
  const xml = await buildSitemapXml();
  await writePublicArtifact(SITEMAP_ARTIFACT_KEY, xml, "application/xml; charset=utf-8");
  logger.info("sitemap", "Durable sitemap artifact refreshed", {
    artifactBytes: Buffer.byteLength(xml, "utf8"),
  });
}

const handleSitemapRequest = asyncHandler(async (req, res) => {
  const artifact = await readPublicArtifact(SITEMAP_ARTIFACT_KEY);
  const etag = artifact?.etag ?? 'W/"static-sitemap-fallback-v1"';

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", CACHE_CONTROL);
  res.setHeader("ETag", etag);
  if (req.get("If-None-Match") === etag) {
    res.status(304).end();
    return;
  }
  // A missing/corrupt durable artifact must not let an anonymous request trigger
  // the expensive source scan. The scheduled refresher repairs it; meanwhile
  // crawlers receive the truthful static route inventory.
  res.send(artifact?.body ?? STATIC_SITEMAP);
});

router.use(distributedAnonymousQuota({
  scope: "public-sitemap",
  limit: 120,
  windowMs: 15 * 60 * 1000,
}));
router.get("/", handleSitemapRequest);
router.get("/sitemap.xml", handleSitemapRequest);

export default router;
