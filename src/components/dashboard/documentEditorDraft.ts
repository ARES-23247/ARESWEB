import type { DocRecord, DocRevision } from "@/hooks/useDocumentSync";
import { normalizeDocumentMedia, type ContentMediaCollection } from "@/lib/documentMedia";
import {
  normalizeLearningMetadata,
  type LearningContentType,
  type LearningLevel,
  type LearningPathMembership,
  type LearningPlatform,
  type LearningSafetyScope,
  type LearningSourceReference,
  type LearningSubject,
} from "@/lib/learningContent";

export type DocumentEditorVariant = "docs" | "documents" | "blog";

export interface DocumentEditorDraft {
  title: string;
  slug: string;
  category: string;
  customCategory: string;
  sortOrder: number;
  description: string;
  content: string;
  status: string;
  displayInAreslib: boolean;
  displayInMathCorner: boolean;
  displayInScienceCorner: boolean;
  isPortfolio: boolean;
  isExecutiveSummary: boolean;
  fileUrl: string;
  createdAt: string;
  author: string;
  date: string;
  thumbnail: string;
  subject: LearningSubject;
  topics: string[];
  contentType: LearningContentType;
  level: LearningLevel;
  estimatedMinutes: number;
  pathMemberships: LearningPathMembership[];
  prerequisites: string[];
  objectives: string[];
  platforms: LearningPlatform[];
  sourceReferences: LearningSourceReference[];
  appliesToVersion: string;
  reviewedAt: string;
  reviewedByLabel: string;
  safetyScope: LearningSafetyScope;
}

interface DraftContext {
  editDoc: DocRecord | null;
  categories: string[];
  defaultCategory: string;
  variant: DocumentEditorVariant;
  currentUserNickname: string;
  today?: string;
}

function currentDate(today?: string): string {
  return today || new Date().toISOString().split("T")[0];
}

export function createDocumentEditorDraft({
  editDoc,
  categories,
  defaultCategory,
  variant,
  currentUserNickname,
  today,
}: DraftContext): DocumentEditorDraft {
  const date = currentDate(today);
  const categoryIsCustom = Boolean(
    editDoc && variant === "docs" && !categories.includes(editDoc.category),
  );
  const learningMetadata = normalizeLearningMetadata(
    (editDoc ?? {}) as unknown as Record<string, unknown>,
    {
      category: editDoc?.category || defaultCategory,
      reference: Boolean(editDoc?.displayInAreslib)
        || defaultCategory === "Core Math & Control"
        || defaultCategory === "Architecture & Redux",
    },
  );

  return {
    title: editDoc?.title || "",
    slug: editDoc?.slug || "",
    category: categoryIsCustom
      ? "custom"
      : editDoc?.category || defaultCategory,
    customCategory: categoryIsCustom ? editDoc?.category || "" : "",
    sortOrder: editDoc?.sortOrder || 0,
    description: editDoc?.description || "",
    content: editDoc?.content || "",
    status: editDoc?.status || "draft",
    displayInAreslib: editDoc
      ? editDoc.displayInAreslib === 1
      : variant === "docs" &&
        (defaultCategory === "Core Math & Control" ||
          defaultCategory === "Core Math" ||
          defaultCategory === "Architecture & Redux"),
    displayInMathCorner: editDoc
      ? editDoc.displayInMathCorner === 1
      : variant === "docs" &&
        (defaultCategory === "AI 101" ||
          defaultCategory === "Mathematics" ||
          defaultCategory === "Mathematics & Data" ||
          defaultCategory === "Computing & AI"),
    displayInScienceCorner: editDoc
      ? editDoc.displayInScienceCorner === 1
      : variant === "docs" && (
        defaultCategory === "Physics"
        || defaultCategory === "Physics & Applied Science"
        || defaultCategory === "Robotics & Engineering"
      ),
    isPortfolio: editDoc?.isPortfolio === 1,
    isExecutiveSummary: editDoc?.isExecutiveSummary === 1,
    fileUrl: variant === "documents" ? editDoc?.fileUrl || "" : "",
    createdAt: variant === "documents" ? editDoc?.createdAt || date : "",
    author: variant === "blog" ? editDoc?.author || currentUserNickname : "",
    date: variant === "blog" ? editDoc?.date || date : "",
    thumbnail: variant === "blog" ? editDoc?.thumbnail || "" : "",
    subject: learningMetadata.subject,
    topics: learningMetadata.topics,
    contentType: learningMetadata.contentType,
    level: learningMetadata.level,
    estimatedMinutes: learningMetadata.estimatedMinutes || 30,
    pathMemberships: learningMetadata.pathMemberships,
    prerequisites: learningMetadata.prerequisites,
    objectives: learningMetadata.objectives,
    platforms: learningMetadata.platforms,
    sourceReferences: learningMetadata.sourceReferences,
    appliesToVersion: learningMetadata.appliesToVersion || "",
    reviewedAt: learningMetadata.reviewedAt?.slice(0, 10) || "",
    reviewedByLabel: learningMetadata.reviewedByLabel || "",
    safetyScope: learningMetadata.safetyScope,
  };
}

export function parseRecoveryDraft(
  value: unknown,
): Partial<DocumentEditorDraft> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Stored draft has an invalid format.");
  }

  const source = value as Record<string, unknown>;
  const parsed: Partial<DocumentEditorDraft> = {};
  const stringFields = [
    "title",
    "slug",
    "category",
    "customCategory",
    "description",
    "content",
    "status",
    "fileUrl",
    "createdAt",
    "author",
    "date",
    "thumbnail",
  ] as const;
  const booleanFields = [
    "displayInAreslib",
    "displayInMathCorner",
    "displayInScienceCorner",
    "isPortfolio",
    "isExecutiveSummary",
  ] as const;
  const learningFields = [
    "subject",
    "topics",
    "contentType",
    "level",
    "estimatedMinutes",
    "pathMemberships",
    "prerequisites",
    "objectives",
    "platforms",
    "sourceReferences",
    "appliesToVersion",
    "reviewedAt",
    "reviewedByLabel",
    "safetyScope",
  ] as const;

  for (const field of stringFields) {
    if (source[field] !== undefined) {
      if (typeof source[field] !== "string")
        throw new Error(`Stored ${field} is invalid.`);
      parsed[field] = source[field];
    }
  }
  for (const field of booleanFields) {
    if (source[field] !== undefined) {
      if (typeof source[field] !== "boolean")
        throw new Error(`Stored ${field} is invalid.`);
      parsed[field] = source[field];
    }
  }
  if (source.sortOrder !== undefined) {
    if (
      typeof source.sortOrder !== "number" ||
      !Number.isFinite(source.sortOrder)
    ) {
      throw new Error("Stored sortOrder is invalid.");
    }
    parsed.sortOrder = source.sortOrder;
  }
  if (learningFields.some((field) => source[field] !== undefined)) {
    const normalized = normalizeLearningMetadata(source);
    Object.assign(parsed, {
      subject: normalized.subject,
      topics: normalized.topics,
      contentType: normalized.contentType,
      level: normalized.level,
      estimatedMinutes: normalized.estimatedMinutes || 30,
      pathMemberships: normalized.pathMemberships,
      prerequisites: normalized.prerequisites,
      objectives: normalized.objectives,
      platforms: normalized.platforms,
      sourceReferences: normalized.sourceReferences,
      appliesToVersion: normalized.appliesToVersion || "",
      reviewedAt: normalized.reviewedAt?.slice(0, 10) || "",
      reviewedByLabel: normalized.reviewedByLabel || "",
      safetyScope: normalized.safetyScope,
    });
  }
  return parsed;
}

export function restoreDocumentEditorDraft(
  base: DocumentEditorDraft,
  recovery: Partial<DocumentEditorDraft>,
): DocumentEditorDraft {
  return { ...base, ...recovery };
}

export function applyRevisionToDraft(
  current: DocumentEditorDraft,
  revision: DocRevision,
  context: Pick<DraftContext, "categories" | "defaultCategory" | "variant">,
): DocumentEditorDraft {
  const next = {
    ...current,
    title: revision.title,
    description: revision.description || "",
    content: revision.content || "",
    status: revision.status || "draft",
  };

  if (context.variant === "docs") {
    const knownCategory = context.categories.includes(revision.category);
    const learningMetadata = normalizeLearningMetadata(revision as unknown as Record<string, unknown>, {
      category: revision.category,
      reference: revision.displayInAreslib === 1,
    });
    return {
      ...next,
      category: knownCategory ? revision.category : "custom",
      customCategory: knownCategory ? "" : revision.category || "",
      sortOrder: revision.sortOrder || 0,
      displayInAreslib: revision.displayInAreslib === 1,
      displayInMathCorner: revision.displayInMathCorner === 1,
      displayInScienceCorner: revision.displayInScienceCorner === 1,
      isPortfolio: revision.isPortfolio === 1,
      isExecutiveSummary: revision.isExecutiveSummary === 1,
      subject: learningMetadata.subject,
      topics: learningMetadata.topics,
      contentType: learningMetadata.contentType,
      level: learningMetadata.level,
      estimatedMinutes: learningMetadata.estimatedMinutes || 30,
      pathMemberships: learningMetadata.pathMemberships,
      prerequisites: learningMetadata.prerequisites,
      objectives: learningMetadata.objectives,
      platforms: learningMetadata.platforms,
      sourceReferences: learningMetadata.sourceReferences,
      appliesToVersion: learningMetadata.appliesToVersion || "",
      reviewedAt: learningMetadata.reviewedAt?.slice(0, 10) || "",
      reviewedByLabel: learningMetadata.reviewedByLabel || "",
      safetyScope: learningMetadata.safetyScope,
    };
  }
  if (context.variant === "documents") {
    return {
      ...next,
      category: revision.category || context.defaultCategory,
      fileUrl: revision.fileUrl || "",
    };
  }
  return {
    ...next,
    author: revision.author || "",
    thumbnail: revision.thumbnail || "",
  };
}

export function buildDocumentSave(
  draft: DocumentEditorDraft,
  variant: DocumentEditorVariant,
  defaultCategory: string,
): { slug: string; payload: Omit<DocRecord, "slug"> } | { error: string } {
  const slug = draft.slug.trim();
  if (!draft.title.trim() || !slug)
    return { error: "A title and URL slug are required." };

  let category = draft.category || defaultCategory || "General";
  if (variant === "docs") {
    category =
      draft.category === "custom"
        ? draft.customCategory.trim()
        : draft.category;
    if (!category)
      return { error: "Validation: specify a category before saving." };
    if (!Number.isFinite(draft.estimatedMinutes) || draft.estimatedMinutes < 1 || draft.estimatedMinutes > 600) {
      return { error: "Validation: estimated time must be between 1 and 600 minutes." };
    }
    if (draft.prerequisites.some((slugValue) => !/^[A-Za-z0-9][A-Za-z0-9_-]{0,299}$/.test(slugValue))) {
      return { error: "Validation: every prerequisite must be a valid lesson slug." };
    }
    if (new Set(draft.pathMemberships.map((item) => item.pathId)).size !== draft.pathMemberships.length) {
      return { error: "Validation: a learning path can only be assigned once." };
    }
    for (const source of draft.sourceReferences) {
      try {
        if (!source.label.trim() || new URL(source.url).protocol !== "https:") {
          return { error: "Validation: every source needs a label and an HTTPS URL." };
        }
        if (source.blobHash && !/^[a-f0-9]{7,64}$/i.test(source.blobHash)) {
          return { error: "Validation: source hashes must be hexadecimal Git object hashes." };
        }
      } catch {
        return { error: "Validation: every source needs a label and an HTTPS URL." };
      }
    }
  }

  const payload: Omit<DocRecord, "slug"> = {
    title: draft.title.trim(),
    category,
    sortOrder: Number(draft.sortOrder) || 0,
    description: draft.description.trim(),
    content: draft.content.trim(),
    status: draft.status,
    isDeleted: 0,
    displayInAreslib: draft.displayInAreslib ? 1 : 0,
    displayInMathCorner: draft.displayInMathCorner ? 1 : 0,
    displayInScienceCorner: draft.displayInScienceCorner ? 1 : 0,
    isPortfolio: draft.isPortfolio ? 1 : 0,
    isExecutiveSummary: draft.isExecutiveSummary ? 1 : 0,
    updatedAt: new Date().toISOString(),
  };

  if (variant === "docs") {
    const normalizedLearning = normalizeLearningMetadata({
      ...draft,
      learningSchemaVersion: 1,
    } as unknown as Record<string, unknown>, {
      category,
      reference: draft.displayInAreslib,
    });
    Object.assign(payload, {
      learningSchemaVersion: 1,
      subject: normalizedLearning.subject,
      topics: normalizedLearning.topics,
      contentType: normalizedLearning.contentType,
      level: normalizedLearning.level,
      estimatedMinutes: normalizedLearning.estimatedMinutes || 30,
      pathMemberships: normalizedLearning.pathMemberships,
      prerequisites: normalizedLearning.prerequisites,
      objectives: normalizedLearning.objectives,
      platforms: normalizedLearning.platforms,
      sourceReferences: normalizedLearning.sourceReferences,
      ...(normalizedLearning.appliesToVersion ? { appliesToVersion: normalizedLearning.appliesToVersion } : {}),
      ...(normalizedLearning.reviewedAt ? { reviewedAt: normalizedLearning.reviewedAt } : {}),
      ...(normalizedLearning.reviewedByLabel ? { reviewedByLabel: normalizedLearning.reviewedByLabel } : {}),
      safetyScope: normalizedLearning.safetyScope,
    });
  } else if (variant === "documents") {
    payload.fileUrl = draft.fileUrl.trim();
    payload.createdAt = draft.createdAt;
  } else if (variant === "blog") {
    payload.author = draft.author.trim();
    payload.date = draft.date;
    payload.thumbnail = draft.thumbnail.trim();
  }
  const mediaCollection: ContentMediaCollection =
    variant === "blog" ? "posts" : variant === "documents" ? "documents" : "docs";
  const media = normalizeDocumentMedia(
    payload.content,
    payload.thumbnail || "",
    mediaCollection,
    slug,
  );
  if ("error" in media) return media;
  payload.content = media.content;
  if (variant === "blog") payload.thumbnail = media.thumbnail;
  payload.mediaPhotoIds = media.mediaPhotoIds;
  return { slug, payload };
}
