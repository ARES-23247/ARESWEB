import express from "express";
import { adminDb } from "../lib/firebase-admin";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import { publicLearningMetadata } from "../lib/learningContent";

const router = express.Router();

type PublicLibrary = "academy" | "areslib";

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function flag(value: unknown): number {
  return value === 1 ? 1 : 0;
}

function sortOrder(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : 0;
}

function safeContentId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,299}$/u.test(value)) {
    throw new ApiError(400, "Invalid published content identifier.");
  }
  return value;
}

function requestedLibrary(value: unknown): PublicLibrary {
  if (value === "academy" || value === "areslib") return value;
  throw new ApiError(400, "Choose the academy or areslib library.");
}

function isPublished(data: Record<string, unknown>): boolean {
  return data.status === "published"
    && data.isDeleted !== 1
    && (data.approvalStatus === undefined || data.approvalStatus === "approved");
}

function isVisibleInLibrary(data: Record<string, unknown>, library: PublicLibrary): boolean {
  if (!isPublished(data)) return false;
  return library === "areslib"
    ? data.displayInAreslib === 1
    : data.displayInMathCorner === 1 || data.displayInScienceCorner === 1;
}

function postDto(id: string, data: Record<string, unknown>, includeContent: boolean) {
  const rawSnippet = text(data.snippet, 5_000) || text(data.content, 5_000);
  return {
    slug: id,
    title: text(data.title, 200) || "Untitled Post",
    date: text(data.date, 80),
    snippet: rawSnippet,
    thumbnail: text(data.thumbnail, 4_096),
    author: text(data.author, 120) || "ARES Member",
    authorAvatar: text(data.authorAvatar, 2_048),
    ...(includeContent
      ? { content: text(data.content, 750_000) || rawSnippet }
      : {}),
  };
}

function documentDto(
  id: string,
  data: Record<string, unknown>,
  library: PublicLibrary,
  includeContent: boolean,
) {
  return {
    slug: id,
    title: text(data.title, 200) || "Untitled Document",
    category: text(data.category, 120) || "General",
    sortOrder: sortOrder(data.sortOrder),
    description: text(data.description, 4_000),
    ...(includeContent ? { content: text(data.content, 750_000) } : {}),
    status: "published",
    isDeleted: 0,
    isPortfolio: flag(data.isPortfolio),
    isExecutiveSummary: flag(data.isExecutiveSummary),
    displayInAreslib: flag(data.displayInAreslib),
    displayInMathCorner: flag(data.displayInMathCorner),
    displayInScienceCorner: flag(data.displayInScienceCorner),
    updatedAt: text(data.updatedAt, 80) || undefined,
    original_authorNickname: text(data.original_authorNickname, 120) || undefined,
    original_authorAvatar: text(data.original_authorAvatar, 2_048) || undefined,
    ...publicLearningMetadata(data, library),
  };
}

// GET /api/content/posts - bounded published blog summary DTOs.
router.get(
  "/posts",
  asyncHandler(async (_req, res) => {
    const snapshot = await adminDb.collection("posts")
      .where("status", "==", "published")
      .where("isDeleted", "==", 0)
      .orderBy("date", "desc")
      .limit(100)
      .get();
    const posts = snapshot.docs
      .filter((document) => isPublished(document.data()))
      .slice(0, 50)
      .map((document) => postDto(document.id, document.data(), false));
    res.json({ posts });
  }),
);

// GET /api/content/posts/:slug - one published blog detail DTO.
router.get(
  "/posts/:slug",
  asyncHandler(async (req, res) => {
    const slug = safeContentId(req.params.slug);
    const snapshot = await adminDb.collection("posts").doc(slug).get();
    const data = (snapshot.data() || {}) as Record<string, unknown>;
    if (!snapshot.exists || !isPublished(data)) {
      throw new ApiError(404, "Published blog post not found.", "CONTENT_NOT_FOUND");
    }
    res.json({ post: postDto(slug, data, true) });
  }),
);

// GET /api/content/docs?library=academy|areslib - published document DTOs.
router.get(
  "/docs",
  asyncHandler(async (req, res) => {
    const library = requestedLibrary(req.query.library);
    const snapshot = await adminDb.collection("docs")
      .where("status", "==", "published")
      .where("isDeleted", "==", 0)
      .limit(250)
      .get();
    const documents = snapshot.docs
      .filter((document) => isVisibleInLibrary(document.data(), library))
      .slice(0, 200)
      .map((document) => documentDto(document.id, document.data(), library, false))
      .sort((left, right) =>
        left.category.localeCompare(right.category)
        || left.sortOrder - right.sortOrder
        || left.title.localeCompare(right.title));
    res.json({ documents });
  }),
);

// GET /api/content/docs/:slug?library=academy|areslib - one published document DTO.
router.get(
  "/docs/:slug",
  asyncHandler(async (req, res) => {
    const slug = safeContentId(req.params.slug);
    const library = requestedLibrary(req.query.library);
    const snapshot = await adminDb.collection("docs").doc(slug).get();
    const data = (snapshot.data() || {}) as Record<string, unknown>;
    if (!snapshot.exists || !isVisibleInLibrary(data, library)) {
      throw new ApiError(404, "Published document not found.", "CONTENT_NOT_FOUND");
    }
    res.json({ document: documentDto(slug, data, library, true) });
  }),
);

export default router;
