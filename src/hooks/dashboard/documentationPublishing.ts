import type { DocRecord } from "@/hooks/useDocumentSync";
import { normalizeLearningMetadata } from "@/lib/learningContent";

export interface SyndicationChannelDetail {
  label: string;
  detail: string;
  ok: boolean;
}

export interface SyndicationResponse {
  success?: unknown;
  pending?: unknown;
  alreadySyndicated?: unknown;
  syndication?: unknown;
}

export interface DocumentationApprovalReview {
  digest: string;
  library: "academy" | "areslib";
  document: DocRecord;
  publishedSnapshot?: DocRecord;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isFlag(value: unknown): value is 0 | 1 {
  return value === 0 || value === 1;
}

function parseReviewDocRecord(
  slug: string,
  library: "academy" | "areslib",
  document: unknown,
  requireCompleteMetadata: boolean,
): DocRecord | null {
  if (
    !isRecord(document) ||
    document.slug !== slug ||
    typeof document.title !== "string" ||
    document.title.length > 200 ||
    typeof document.category !== "string" ||
    document.category.length > 120 ||
    typeof document.description !== "string" ||
    document.description.length > 4_000 ||
    typeof document.content !== "string" ||
    document.content.length > 750_000 ||
    typeof document.status !== "string" ||
    typeof document.sortOrder !== "number" ||
    !Number.isFinite(document.sortOrder) ||
    !isFlag(document.isDeleted) ||
    !isFlag(document.displayInAreslib) ||
    !isFlag(document.displayInMathCorner) ||
    !isFlag(document.displayInScienceCorner) ||
    !isFlag(document.isPortfolio) ||
    !isFlag(document.isExecutiveSummary)
  ) {
    return null;
  }

  const metadata = normalizeLearningMetadata(document, {
    category: document.category,
    reference: library === "areslib",
  });
  if (requireCompleteMetadata && metadata.metadataStatus !== "complete") {
    return null;
  }

  return {
    slug,
    title: document.title,
    category: document.category,
    description: document.description,
    content: document.content,
    status: document.status,
    sortOrder: Math.trunc(document.sortOrder),
    isDeleted: document.isDeleted,
    displayInAreslib: document.displayInAreslib,
    displayInMathCorner: document.displayInMathCorner,
    displayInScienceCorner: document.displayInScienceCorner,
    isPortfolio: document.isPortfolio,
    isExecutiveSummary: document.isExecutiveSummary,
    ...(typeof document.approvalStatus === "string"
      ? { approvalStatus: document.approvalStatus }
      : {}),
    ...(typeof document.updatedAt === "string"
      ? { updatedAt: document.updatedAt }
      : {}),
    ...metadata,
  };
}

export function parseDocumentationApprovalReview(
  value: unknown,
): DocumentationApprovalReview | null {
  if (!isRecord(value) || !isRecord(value.review)) return null;
  const review = value.review;
  if (
    typeof review.digest !== "string" ||
    !/^[a-f0-9]{64}$/u.test(review.digest) ||
    (review.library !== "academy" && review.library !== "areslib") ||
    typeof review.slug !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,299}$/u.test(review.slug)
  ) {
    return null;
  }

  const parsedDoc = parseReviewDocRecord(
    review.slug,
    review.library,
    review.document,
    true,
  );
  if (!parsedDoc) return null;

  const parsedPublishedSnapshot = isRecord(review.publishedSnapshot)
    ? parseReviewDocRecord(
        review.slug,
        review.library,
        review.publishedSnapshot,
        false,
      )
    : null;

  return {
    digest: review.digest,
    library: review.library,
    document: parsedDoc,
    ...(parsedPublishedSnapshot ? { publishedSnapshot: parsedPublishedSnapshot } : {}),
  };
}

export function syndicationChannelDetails(
  payload: SyndicationResponse,
): SyndicationChannelDetail[] {
  const details: SyndicationChannelDetail[] = [];
  const syndication = isRecord(payload.syndication)
    ? payload.syndication
    : {};

  if (typeof syndication.zulip === "boolean") {
    details.push({
      label: "Zulip",
      detail: syndication.zulip ? "Delivered" : "Not delivered",
      ok: syndication.zulip,
    });
  }
  if (typeof syndication.bluesky === "boolean") {
    details.push({
      label: "Bluesky",
      detail: syndication.bluesky ? "Delivered" : "Not delivered",
      ok: syndication.bluesky,
    });
  }

  return details;
}
