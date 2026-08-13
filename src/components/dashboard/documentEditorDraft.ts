import type { DocRecord, DocRevision } from "@/hooks/useDocumentSync";

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
          defaultCategory === "Core Math"),
    displayInMathCorner: editDoc
      ? editDoc.displayInMathCorner === 1
      : variant === "docs" &&
        (defaultCategory === "AI 101" || defaultCategory === "Mathematics"),
    displayInScienceCorner: editDoc
      ? editDoc.displayInScienceCorner === 1
      : variant === "docs" && defaultCategory === "Physics",
    isPortfolio: editDoc?.isPortfolio === 1,
    isExecutiveSummary: editDoc?.isExecutiveSummary === 1,
    fileUrl: variant === "documents" ? editDoc?.fileUrl || "" : "",
    createdAt: variant === "documents" ? editDoc?.createdAt || date : "",
    author: variant === "blog" ? editDoc?.author || currentUserNickname : "",
    date: variant === "blog" ? editDoc?.date || date : "",
    thumbnail: variant === "blog" ? editDoc?.thumbnail || "" : "",
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

  if (variant === "documents") {
    payload.fileUrl = draft.fileUrl.trim();
    payload.createdAt = draft.createdAt;
  } else if (variant === "blog") {
    payload.author = draft.author.trim();
    payload.date = draft.date;
    payload.thumbnail = draft.thumbnail.trim();
  }
  return { slug, payload };
}
