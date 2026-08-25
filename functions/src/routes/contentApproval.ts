import { createHash } from "node:crypto";
import express, { type NextFunction, type Response } from "express";
import rateLimit from "express-rate-limit";
import { adminDb } from "../lib/firebase-admin";
import { publicLearningMetadata } from "../lib/learningContent";
import { asyncHandler } from "../lib/utils";
import { ensureTeamMember, type AuthenticatedRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";

const router = express.Router();
const CONTENT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,299}$/u;
const DIGEST = /^[a-f0-9]{64}$/u;
const PENDING_STATUSES = new Set(["draft", "pending", "pending_approval"]);
const APPROVER_ROLES = new Set(["admin", "coach", "mentor"]);
const REVIEW_FIELDS = [
  "title", "category", "sortOrder", "description", "content",
  "displayInAreslib", "displayInMathCorner", "displayInScienceCorner",
  "isPortfolio", "isExecutiveSummary", "learningSchemaVersion", "subject",
  "topics", "contentType", "level", "estimatedMinutes", "pathMemberships",
  "prerequisites", "objectives", "platforms", "sourceReferences",
  "appliesToVersion", "reviewedAt", "reviewedByLabel", "safetyScope",
  "status", "approvalStatus", "isDeleted", "updatedAt",
] as const;

type Library = "academy" | "areslib";

const approvalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many content review requests. Try again later." },
});

function library(value: unknown): Library {
  if (value === "academy" || value === "areslib") return value;
  throw new ApiError(400, "Choose the academy or areslib library.", "INVALID_LIBRARY");
}

function slug(value: unknown): string {
  if (typeof value !== "string" || !CONTENT_ID.test(value)) {
    throw new ApiError(400, "Invalid content identifier.", "INVALID_CONTENT_ID");
  }
  return value;
}

function canonical(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonical(entry)]));
  }
  return null;
}

export function contentReviewDigest(data: Record<string, unknown>): string {
  const reviewable = Object.fromEntries(REVIEW_FIELDS.map((field) => [field, data[field] ?? null]));
  return createHash("sha256").update(JSON.stringify(canonical(reviewable))).digest("hex");
}

function visibleInLibrary(data: Record<string, unknown>, requestedLibrary: Library): boolean {
  return requestedLibrary === "areslib"
    ? data.displayInAreslib === 1
    : data.displayInMathCorner === 1 || data.displayInScienceCorner === 1;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function validateReviewableDocument(data: Record<string, unknown>, requestedLibrary: Library): void {
  if (typeof data.title !== "string" || !data.title.trim() || data.title.length > 200
    || typeof data.category !== "string" || !data.category.trim() || data.category.length > 120
    || typeof data.content !== "string" || data.content.length > 750_000) {
    throw new ApiError(400, "The draft has invalid required content fields.", "INVALID_DRAFT");
  }
  if (data.isDeleted === 1 || data.isDeleted === true) {
    throw new ApiError(409, "Archived content cannot be approved.", "CONTENT_ARCHIVED");
  }
  if (!PENDING_STATUSES.has(String(data.status)) || data.approvalStatus === "approved") {
    throw new ApiError(409, "Only pending content can be approved.", "CONTENT_NOT_PENDING");
  }
  if (!visibleInLibrary(data, requestedLibrary)) {
    throw new ApiError(409, "The draft is not assigned to the requested library.", "LIBRARY_MISMATCH");
  }

  const normalized = publicLearningMetadata(data, requestedLibrary);
  const rawPaths = Array.isArray(data.pathMemberships) ? data.pathMemberships : [];
  const rawSources = Array.isArray(data.sourceReferences) ? data.sourceReferences : [];
  const rawPlatforms = Array.isArray(data.platforms) ? data.platforms : [];
  if (normalized.metadataStatus !== "complete"
    || rawPaths.length !== normalized.pathMemberships.length
    || rawSources.length !== normalized.sourceReferences.length
    || rawPlatforms.length !== normalized.platforms.length
    || !stringArray(data.prerequisites)
    || data.prerequisites.some((entry) => !CONTENT_ID.test(entry))) {
    throw new ApiError(400, "The draft learning metadata is incomplete or malformed.", "INVALID_LEARNING_METADATA");
  }
}

export function ensureContentApprover(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.authorizationRole || !APPROVER_ROLES.has(req.authorizationRole)) {
    next(new ApiError(403, "Content approval requires an admin, coach, or mentor role.", "APPROVER_REQUIRED"));
    return;
  }
  next();
}

router.use(approvalLimiter);

router.get(
  "/docs/:slug/review",
  ensureTeamMember,
  ensureContentApprover,
  asyncHandler(async (req, res) => {
    const contentSlug = slug(req.params.slug);
    const requestedLibrary = library(req.query.library);
    const snapshot = await adminDb.collection("docs").doc(contentSlug).get();
    if (!snapshot.exists) throw new ApiError(404, "Draft not found.", "CONTENT_NOT_FOUND");
    const data = snapshot.data() as Record<string, unknown>;
    validateReviewableDocument(data, requestedLibrary);
    res.set("Cache-Control", "private, no-store");
    res.json({
      review: {
        slug: contentSlug,
        title: typeof data.title === "string" ? data.title.slice(0, 200) : "",
        updatedAt: typeof data.updatedAt === "string" ? data.updatedAt.slice(0, 80) : "",
        library: requestedLibrary,
        digest: contentReviewDigest(data),
      },
    });
  }),
);

router.post(
  "/docs/:slug/approve",
  ensureTeamMember,
  ensureContentApprover,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const contentSlug = slug(req.params.slug);
    const requestedLibrary = library(req.body?.library);
    const expectedDigest = req.body?.digest;
    if (typeof expectedDigest !== "string" || !DIGEST.test(expectedDigest)) {
      throw new ApiError(400, "A valid review digest is required.", "INVALID_REVIEW_DIGEST");
    }
    const approvedAt = new Date().toISOString();
    const documentRef = adminDb.collection("docs").doc(contentSlug);
    const auditRef = adminDb.collection("content_approval_audit").doc();

    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(documentRef);
      if (!snapshot.exists) throw new ApiError(404, "Draft not found.", "CONTENT_NOT_FOUND");
      const data = snapshot.data() as Record<string, unknown>;
      validateReviewableDocument(data, requestedLibrary);
      const actualDigest = contentReviewDigest(data);
      if (actualDigest !== expectedDigest) {
        throw new ApiError(409, "The draft changed after review. Reload and review the latest version.", "STALE_REVIEW");
      }
      transaction.update(documentRef, {
        status: "published",
        approvalStatus: "approved",
        approvedAt,
        approvedByRole: req.authorizationRole,
        approvalDigest: actualDigest,
      });
      transaction.set(auditRef, {
        action: "content.approved",
        collection: "docs",
        contentId: contentSlug,
        library: requestedLibrary,
        digest: actualDigest,
        actorRole: req.authorizationRole,
        createdAt: approvedAt,
      });
    });

    res.json({ success: true, approved: true, slug: contentSlug, digest: expectedDigest });
  }),
);

export default router;
