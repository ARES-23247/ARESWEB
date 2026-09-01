import type { DocRecord } from "@/hooks/useDocumentSync";
import { normalizeLearningMetadata } from "@/lib/learningContent";

type BufferChannelOutcome =
  | "submitted"
  | "already-submitted"
  | "failed"
  | "not-connected"
  | "unavailable";

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
  bufferChannels?: unknown;
}

export interface DocumentationApprovalReview {
  digest: string;
  library: "academy" | "areslib";
  document: DocRecord;
}

const BUFFER_CHANNEL_LABELS = {
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "X",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isFlag(value: unknown): value is 0 | 1 {
  return value === 0 || value === 1;
}

export function parseDocumentationApprovalReview(
  value: unknown,
): DocumentationApprovalReview | null {
  if (!isRecord(value) || !isRecord(value.review)) return null;
  const review = value.review;
  const document = review.document;
  if (
    typeof review.digest !== "string" ||
    !/^[a-f0-9]{64}$/u.test(review.digest) ||
    (review.library !== "academy" && review.library !== "areslib") ||
    typeof review.slug !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,299}$/u.test(review.slug) ||
    !isRecord(document) ||
    document.slug !== review.slug ||
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
  )
    return null;

  const metadata = normalizeLearningMetadata(document, {
    category: document.category,
    reference: review.library === "areslib",
  });
  if (metadata.metadataStatus !== "complete") return null;

  return {
    digest: review.digest,
    library: review.library,
    document: {
      slug: review.slug,
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
    },
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

  const bufferChannels = isRecord(payload.bufferChannels)
    ? payload.bufferChannels
    : null;
  if (bufferChannels) {
    for (const [service, label] of Object.entries(BUFFER_CHANNEL_LABELS)) {
      const outcome = bufferChannels[service];
      const detailByOutcome: Record<BufferChannelOutcome, string> = {
        submitted: "Submitted immediately via Buffer",
        "already-submitted": "Already submitted via Buffer",
        failed: "Buffer rejected the submission",
        "not-connected": "Not connected in Buffer",
        unavailable: "Buffer was unavailable",
      };
      if (typeof outcome === "string" && outcome in detailByOutcome) {
        const typedOutcome = outcome as BufferChannelOutcome;
        details.push({
          label,
          detail: detailByOutcome[typedOutcome],
          ok:
            typedOutcome === "submitted" ||
            typedOutcome === "already-submitted",
        });
      }
    }
  } else if (typeof syndication.buffer === "boolean") {
    for (const label of Object.values(BUFFER_CHANNEL_LABELS)) {
      details.push({
        label,
        detail: syndication.buffer
          ? "Previously accepted by Buffer; platform status unavailable"
          : "Not submitted through Buffer",
        ok: syndication.buffer,
      });
    }
  }

  return details;
}
