import type { PublicDocument } from "@/lib/publicContentApi";
import {
  LEARNING_CONTENT_TYPES,
  LEARNING_LEVELS,
  LEARNING_PATHS,
  LEARNING_PLATFORMS,
  LEARNING_SUBJECTS,
  type LearningContentType,
  type LearningLevel,
  type LearningPathId,
  type LearningPlatform,
  type LearningSubject,
} from "@/lib/learningContent";

export type LearningDuration = "all" | "15" | "30" | "60";
export type LearningFilterValue<T extends string> = "all" | T;

export interface LearningFilters {
  search: string;
  subject: LearningFilterValue<LearningSubject>;
  level: LearningFilterValue<LearningLevel>;
  contentType: LearningFilterValue<LearningContentType>;
  pathId: LearningFilterValue<LearningPathId>;
  platform: LearningFilterValue<LearningPlatform>;
  topic: string;
  duration: LearningDuration;
}

export interface LearningPathNavigation {
  pathId: LearningPathId | null;
  documents: PublicDocument[];
  position: number;
  previous: PublicDocument | null;
  next: PublicDocument | null;
}

export const DEFAULT_LEARNING_FILTERS: LearningFilters = {
  search: "",
  subject: "all",
  level: "all",
  contentType: "all",
  pathId: "all",
  platform: "all",
  topic: "all",
  duration: "all",
};

const SAFE_TOPIC = /^[\p{L}\p{N}][\p{L}\p{N} .+&/_-]{0,79}$/u;

function allowed<T extends string>(
  value: string | null,
  options: readonly { id: T }[],
): LearningFilterValue<T> {
  return value && options.some((option) => option.id === value)
    ? value as T
    : "all";
}

export function parseLearningFilters(searchParams: URLSearchParams): LearningFilters {
  const rawSearch = searchParams.get("search")?.trim().slice(0, 120) ?? "";
  const rawTopic = searchParams.get("topic")?.trim().slice(0, 80) ?? "all";
  const rawDuration = searchParams.get("duration");
  return {
    search: rawSearch,
    subject: allowed(searchParams.get("subject"), LEARNING_SUBJECTS),
    level: allowed(searchParams.get("level"), LEARNING_LEVELS),
    contentType: allowed(searchParams.get("type"), LEARNING_CONTENT_TYPES),
    pathId: allowed(searchParams.get("path"), LEARNING_PATHS),
    platform: allowed(searchParams.get("platform"), LEARNING_PLATFORMS),
    topic: rawTopic === "all" || SAFE_TOPIC.test(rawTopic) ? rawTopic : "all",
    duration: rawDuration === "15" || rawDuration === "30" || rawDuration === "60"
      ? rawDuration
      : "all",
  };
}

export function learningFiltersToSearchParams(filters: LearningFilters): URLSearchParams {
  const result = new URLSearchParams();
  if (filters.search) result.set("search", filters.search.slice(0, 120));
  if (filters.subject !== "all") result.set("subject", filters.subject);
  if (filters.level !== "all") result.set("level", filters.level);
  if (filters.contentType !== "all") result.set("type", filters.contentType);
  if (filters.pathId !== "all") result.set("path", filters.pathId);
  if (filters.platform !== "all") result.set("platform", filters.platform);
  if (filters.topic !== "all" && SAFE_TOPIC.test(filters.topic)) result.set("topic", filters.topic);
  if (filters.duration !== "all") result.set("duration", filters.duration);
  return result;
}

export function orderedPathDocuments(
  documents: PublicDocument[],
  pathId: LearningPathId,
): PublicDocument[] {
  return documents
    .filter((document) => document.pathMemberships.some((membership) => membership.pathId === pathId))
    .toSorted((left, right) => {
      const leftOrder = left.pathMemberships.find((membership) => membership.pathId === pathId)?.order
        ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.pathMemberships.find((membership) => membership.pathId === pathId)?.order
        ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.title.localeCompare(right.title);
    });
}

export function learningTopics(documents: PublicDocument[]): string[] {
  return [...new Set(documents.flatMap((document) => document.topics.map((topic) => topic.trim()).filter(Boolean)))]
    .toSorted((left, right) => left.localeCompare(right))
    .slice(0, 100);
}

export function filterLearningDocuments(
  documents: PublicDocument[],
  filters: LearningFilters,
): PublicDocument[] {
  const normalizedSearch = filters.search.toLocaleLowerCase();
  const maxMinutes = filters.duration === "all" ? null : Number(filters.duration);
  const matches = documents.filter((document) => {
    if (filters.subject !== "all" && document.subject !== filters.subject) return false;
    if (filters.level !== "all" && document.level !== filters.level) return false;
    if (filters.contentType !== "all" && document.contentType !== filters.contentType) return false;
    if (filters.platform !== "all" && !document.platforms.includes(filters.platform)) return false;
    if (filters.pathId !== "all" && !document.pathMemberships.some((membership) => membership.pathId === filters.pathId)) return false;
    if (filters.topic !== "all" && !document.topics.some((topic) => topic.toLocaleLowerCase() === filters.topic.toLocaleLowerCase())) return false;
    if (maxMinutes !== null && (!document.estimatedMinutes || document.estimatedMinutes > maxMinutes)) return false;
    if (!normalizedSearch) return true;
    return [
      document.title,
      document.description,
      document.category,
      ...document.topics,
      ...document.objectives,
      ...document.prerequisites,
    ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
  });
  if (filters.pathId !== "all") return orderedPathDocuments(matches, filters.pathId);
  return matches.toSorted((left, right) =>
    left.category.localeCompare(right.category)
    || left.sortOrder - right.sortOrder
    || left.title.localeCompare(right.title));
}

function defaultPathFor(document: PublicDocument): LearningPathId | null {
  return document.pathMemberships
    .toSorted((left, right) => left.order - right.order || left.pathId.localeCompare(right.pathId))[0]
    ?.pathId ?? null;
}

export function learningPathNavigation(
  documents: PublicDocument[],
  currentSlug: string,
  requestedPath: LearningPathId | null,
): LearningPathNavigation {
  const current = documents.find((document) => document.slug === currentSlug);
  if (!current) return { pathId: null, documents: [], position: -1, previous: null, next: null };
  const pathId = requestedPath
    && current.pathMemberships.some((membership) => membership.pathId === requestedPath)
    ? requestedPath
    : defaultPathFor(current);
  const sequence = pathId
    ? orderedPathDocuments(documents, pathId)
    : documents.toSorted((left, right) =>
      left.category.localeCompare(right.category)
      || left.sortOrder - right.sortOrder
      || left.title.localeCompare(right.title));
  const position = sequence.findIndex((document) => document.slug === currentSlug);
  return {
    pathId,
    documents: sequence,
    position,
    previous: position > 0 ? sequence[position - 1] : null,
    next: position >= 0 && position < sequence.length - 1 ? sequence[position + 1] : null,
  };
}

export function relatedLearningDocuments(
  documents: PublicDocument[],
  currentSlug: string,
  limit = 3,
): PublicDocument[] {
  const current = documents.find((document) => document.slug === currentSlug);
  if (!current || limit < 1) return [];
  const currentPaths = new Set(current.pathMemberships.map((membership) => membership.pathId));
  const currentTopics = new Set(current.topics.map((topic) => topic.toLocaleLowerCase()));
  return documents
    .filter((document) => document.slug !== currentSlug)
    .map((document) => {
      let score = 0;
      if (document.prerequisites.includes(currentSlug) || current.prerequisites.includes(document.slug)) score += 100;
      score += document.pathMemberships.filter((membership) => currentPaths.has(membership.pathId)).length * 30;
      score += document.topics.filter((topic) => currentTopics.has(topic.toLocaleLowerCase())).length * 8;
      if (document.subject === current.subject) score += 4;
      if (document.contentType === current.contentType) score += 2;
      if (document.level === current.level) score += 1;
      return { document, score };
    })
    // Matching only on broad format/level is not enough to call two lessons
    // related. Require at least a shared subject or a stronger curriculum link.
    .filter(({ score }) => score >= 4)
    .toSorted((left, right) => right.score - left.score || left.document.title.localeCompare(right.document.title))
    .slice(0, Math.min(limit, 6))
    .map(({ document }) => document);
}
