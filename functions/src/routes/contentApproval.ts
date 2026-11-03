import { createHash } from "node:crypto";
import express, { type NextFunction, type Response } from "express";
import rateLimit from "express-rate-limit";
import { adminDb } from "../lib/firebase-admin";
import { reviewableDocumentDto } from "../lib/contentDtos";
import { publicLearningMetadata } from "../lib/learningContent";
import { asyncHandler } from "../lib/utils";
import { sendZulipApprovalQueueNotification } from "../lib/zulip";
import { ensureTeamMember, type AuthenticatedRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";

const router = express.Router();
const CONTENT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,299}$/u;
const DIGEST = /^[a-f0-9]{64}$/u;
const PENDING_STATUSES = new Set(["draft", "pending", "pending_approval"]);
const APPROVER_ROLES = new Set(["admin", "coach", "mentor"]);
const APPROVAL_NOTIFICATION_COLLECTIONS = new Set([
  "posts",
  "docs",
  "documents",
  "events",
  "locations",
  "event_locations",
] as const);
const DISCARDABLE_CONTENT_COLLECTIONS = new Set([
  "posts",
  "docs",
  "documents",
] as const);
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
type ApprovalNotificationCollection =
  | "posts"
  | "docs"
  | "documents"
  | "events"
  | "locations"
  | "event_locations";
type DiscardableContentCollection = "posts" | "docs" | "documents";

const approvalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many content review requests. Try again later." },
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function library(value: unknown): Library {
  if (value === "academy" || value === "areslib") return value;
  throw new ApiError(400, "Choose the academy or areslib library.", "INVALID_LIBRARY");
}

function notificationCollection(value: unknown): ApprovalNotificationCollection {
  if (
    typeof value === "string" &&
    APPROVAL_NOTIFICATION_COLLECTIONS.has(value as ApprovalNotificationCollection)
  ) {
    return value as ApprovalNotificationCollection;
  }
  throw new ApiError(400, "Choose a supported approval queue collection.", "INVALID_COLLECTION");
}

function discardableCollection(value: unknown): DiscardableContentCollection {
  if (
    typeof value === "string" &&
    DISCARDABLE_CONTENT_COLLECTIONS.has(value as DiscardableContentCollection)
  ) {
    return value as DiscardableContentCollection;
  }
  throw new ApiError(400, "Choose a supported content collection.", "INVALID_COLLECTION");
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
  const isPendingDoc =
    PENDING_STATUSES.has(String(data.status)) ||
    data.approvalStatus === "pending_approval";
  if (!isPendingDoc || data.approvalStatus === "approved") {
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

function approvalNotificationRouteMetadata(
  requestedCollection: ApprovalNotificationCollection,
  data: Record<string, unknown>,
): { section: string; dashboardPath: string } {
  switch (requestedCollection) {
    case "posts":
      return { section: "Blog Posts", dashboardPath: "/dashboard/blog?tab=pending" };
    case "docs":
      return data.displayInAreslib === 1
        ? { section: "ARESLib Reference", dashboardPath: "/dashboard/areslib" }
        : { section: "Academy Curriculum", dashboardPath: "/dashboard/academy" };
    case "documents":
      return { section: "Cloud Resources", dashboardPath: "/dashboard/documents" };
    case "events":
      return { section: "Calendar Events", dashboardPath: "/dashboard/events" };
    case "locations":
    case "event_locations":
      return { section: "Calendar Venues", dashboardPath: "/dashboard/events" };
  }
}

router.use(approvalLimiter);

router.post(
  "/notify-pending",
  ensureTeamMember,
  asyncHandler(async (req, res) => {
    const requestedCollection = notificationCollection(req.body?.collection);
    const firestoreCollection =
      requestedCollection === "event_locations" ? "locations" : requestedCollection;
    const contentId = slug(req.body?.contentId);
    const snapshot = await adminDb.collection(firestoreCollection).doc(contentId).get();
    if (!snapshot.exists) {
      throw new ApiError(404, "Pending record not found.", "CONTENT_NOT_FOUND");
    }
    const data = snapshot.data() as Record<string, unknown>;
    if (data.isDeleted === 1 || data.isDeleted === true) {
      throw new ApiError(409, "Archived content cannot trigger a review notification.", "CONTENT_ARCHIVED");
    }
    const isPending =
      PENDING_STATUSES.has(String(data.status)) ||
      PENDING_STATUSES.has(String(data.approvalStatus)) ||
      Boolean(data.pendingEdit);
    if (!isPending) {
      throw new ApiError(409, "Only pending content can trigger an approval notification.", "CONTENT_NOT_PENDING");
    }
    const { section, dashboardPath } = approvalNotificationRouteMetadata(requestedCollection, data);
    const rawTitle =
      typeof data.title === "string" && data.title.trim()
        ? data.title.trim()
        : typeof data.name === "string" && data.name.trim()
          ? data.name.trim()
          : contentId;
    const rawAuthor =
      typeof data.author === "string" && data.author.trim()
        ? data.author.trim()
        : typeof data.original_authorNickname === "string" && data.original_authorNickname.trim()
          ? data.original_authorNickname.trim()
          : undefined;
    const delivered = await sendZulipApprovalQueueNotification({
      section,
      title: rawTitle.slice(0, 160),
      contentId,
      authorLabel: rawAuthor ? rawAuthor.slice(0, 80) : undefined,
      dashboardPath,
      isStagedEdit: Boolean(data.publishedSnapshot || data.pendingEdit),
    });

    res.json({
      success: true,
      delivered,
      collection: requestedCollection,
      contentId,
    });
  }),
);

router.post(
  "/discard-pending",
  ensureTeamMember,
  ensureContentApprover,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const requestedCollection = discardableCollection(req.body?.collection);
    const contentId = slug(req.body?.contentId);
    const discardedAt = new Date().toISOString();
    const documentRef = adminDb.collection(requestedCollection).doc(contentId);
    const auditRef = adminDb.collection("content_approval_audit").doc();

    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(documentRef);
      if (!snapshot.exists) {
        throw new ApiError(404, "Content record not found.", "CONTENT_NOT_FOUND");
      }
      const data = snapshot.data() as Record<string, unknown>;
      if (data.isDeleted === 1 || data.isDeleted === true) {
        throw new ApiError(409, "Archived content cannot be modified.", "CONTENT_ARCHIVED");
      }
      if (data.approvalStatus !== "pending_approval" || !isPlainObject(data.publishedSnapshot)) {
        throw new ApiError(409, "No staged pending edit to discard.", "NO_STAGED_EDIT");
      }
      const { publishedSnapshot: _nested, id: _id, ...restoredFields } = data.publishedSnapshot;
      transaction.update(documentRef, {
        ...restoredFields,
        status: "published",
        approvalStatus: "approved",
        isDeleted: 0,
        publishedSnapshot: null,
        updatedAt: discardedAt,
      });
      transaction.set(auditRef, {
        action: "content.pending_edit_discarded",
        collection: requestedCollection,
        contentId,
        actorRole: req.authorizationRole,
        createdAt: discardedAt,
      });
    });

    res.json({
      success: true,
      discarded: true,
      collection: requestedCollection,
      contentId,
    });
  }),
);

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
    const publishedSnapshot = isPlainObject(data.publishedSnapshot)
      ? reviewableDocumentDto(
          contentSlug,
          { ...data, ...data.publishedSnapshot, status: "published", approvalStatus: "approved" },
          requestedLibrary,
        )
      : null;
    res.set("Cache-Control", "private, no-store");
    res.json({
      review: {
        slug: contentSlug,
        title: typeof data.title === "string" ? data.title.slice(0, 200) : "",
        updatedAt: typeof data.updatedAt === "string" ? data.updatedAt.slice(0, 80) : "",
        library: requestedLibrary,
        digest: contentReviewDigest(data),
        document: reviewableDocumentDto(contentSlug, data, requestedLibrary),
        ...(publishedSnapshot ? { publishedSnapshot } : {}),
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
        ...(isPlainObject(data.publishedSnapshot) ? { publishedSnapshot: null } : {}),
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
