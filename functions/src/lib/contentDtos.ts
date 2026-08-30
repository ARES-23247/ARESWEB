import { publicLearningMetadata } from "./learningContent";

export type ContentLibrary = "academy" | "areslib";

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

function documentCore(
  id: string,
  data: Record<string, unknown>,
  library: ContentLibrary,
  includeContent: boolean,
) {
  return {
    slug: id,
    title: text(data.title, 200) || "Untitled Document",
    category: text(data.category, 120) || "General",
    sortOrder: sortOrder(data.sortOrder),
    description: text(data.description, 4_000),
    ...(includeContent ? { content: text(data.content, 750_000) } : {}),
    isPortfolio: flag(data.isPortfolio),
    isExecutiveSummary: flag(data.isExecutiveSummary),
    displayInAreslib: flag(data.displayInAreslib),
    displayInMathCorner: flag(data.displayInMathCorner),
    displayInScienceCorner: flag(data.displayInScienceCorner),
    updatedAt: text(data.updatedAt, 80) || undefined,
    ...publicLearningMetadata(data, library),
  };
}

export function publishedDocumentDto(
  id: string,
  data: Record<string, unknown>,
  library: ContentLibrary,
  includeContent: boolean,
) {
  return {
    ...documentCore(id, data, library, includeContent),
    status: "published",
    isDeleted: 0,
    original_authorNickname: text(data.original_authorNickname, 120) || undefined,
    original_authorAvatar: text(data.original_authorAvatar, 2_048) || undefined,
  };
}

export function reviewableDocumentDto(
  id: string,
  data: Record<string, unknown>,
  library: ContentLibrary,
) {
  return {
    ...documentCore(id, data, library, true),
    status: text(data.status, 40) || "draft",
    approvalStatus: text(data.approvalStatus, 40) || undefined,
    isDeleted: flag(data.isDeleted),
  };
}
