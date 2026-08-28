export const LEARNING_SUBJECTS = [
  "robotics-engineering",
  "mathematics-data",
  "computing-ai",
  "physics-applied-science",
] as const;

export const LEARNING_CONTENT_TYPES = [
  "lesson",
  "guided-lab",
  "tutorial",
  "reference",
  "interactive",
] as const;

export const LEARNING_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export const LEARNING_PLATFORMS = ["web", "simulator", "ftc", "frc", "hardware-neutral"] as const;
export const LEARNING_SAFETY_SCOPES = ["none", "simulation-only", "bench-testing", "physical-robot"] as const;
export const LEARNING_PATH_IDS = [
  "robotics-foundations",
  "ftc-robot-with-ares",
  "controls-localization-autonomous",
  "math-for-robotics",
  "ai-ml-foundations",
  "applied-stem-outdoors",
  "mechanical-design-fabrication",
  "electrical-systems-diagnostics",
  "programming-with-ares",
  "testing-debugging-commissioning",
  "competition-operations",
  "robotics-capstones",
] as const;

type LearningSubject = (typeof LEARNING_SUBJECTS)[number];
type LearningContentType = (typeof LEARNING_CONTENT_TYPES)[number];
type LearningLevel = (typeof LEARNING_LEVELS)[number];
type LearningPlatform = (typeof LEARNING_PLATFORMS)[number];
type LearningSafetyScope = (typeof LEARNING_SAFETY_SCOPES)[number];
type LearningPathId = (typeof LEARNING_PATH_IDS)[number];

export interface PublicPathMembership {
  pathId: LearningPathId;
  order: number;
}

export interface PublicSourceReference {
  label: string;
  url: string;
  repository?: string;
  revision?: string;
  path?: string;
  blobHash?: string;
}

export interface PublicLearningMetadata {
  learningSchemaVersion: number;
  metadataStatus: "complete" | "legacy-inferred";
  subject: LearningSubject;
  topics: string[];
  contentType: LearningContentType;
  level: LearningLevel;
  estimatedMinutes?: number;
  pathMemberships: PublicPathMembership[];
  prerequisites: string[];
  objectives: string[];
  platforms: LearningPlatform[];
  sourceReferences: PublicSourceReference[];
  appliesToVersion?: string;
  reviewedAt?: string;
  reviewedByLabel?: string;
  safetyScope: LearningSafetyScope;
}

function boundedText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

function textList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map((item) => boundedText(item, maxLength))
    .filter(Boolean))]
    .slice(0, maxItems);
}

function inferSubject(category: string, library: "academy" | "areslib"): LearningSubject {
  if (library === "areslib") return "robotics-engineering";
  const normalized = category.toLowerCase();
  if (normalized.includes("math") || /\b(?:statistics?|data)\b/u.test(normalized)) return "mathematics-data";
  if (normalized.includes("ai") || normalized.includes("neural") || normalized.includes("vision") || normalized.includes("learning")) {
    return "computing-ai";
  }
  if (normalized.includes("climb") || normalized.includes("outdoor") || normalized.includes("physics") || normalized.includes("science")) {
    return "physics-applied-science";
  }
  return "robotics-engineering";
}

function pathMemberships(value: unknown): PublicPathMembership[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: PublicPathMembership[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const pathId = enumValue(record.pathId, LEARNING_PATH_IDS, "robotics-foundations");
    if (record.pathId !== pathId || seen.has(pathId)) continue;
    const order = typeof record.order === "number" && Number.isFinite(record.order)
      ? Math.max(0, Math.min(10_000, Math.trunc(record.order)))
      : 0;
    seen.add(pathId);
    result.push({ pathId, order });
  }
  return result.sort((left, right) => left.order - right.order || left.pathId.localeCompare(right.pathId));
}

function safeHttpsUrl(value: unknown): string {
  const candidate = boundedText(value, 2_048);
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function sourceReferences(value: unknown): PublicSourceReference[] {
  if (!Array.isArray(value)) return [];
  const result: PublicSourceReference[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const label = boundedText(record.label, 120);
    const url = safeHttpsUrl(record.url);
    if (!label || !url) continue;
    const repository = boundedText(record.repository, 120);
    const revision = boundedText(record.revision, 120);
    const path = boundedText(record.path, 500);
    const blobHash = boundedText(record.blobHash, 64);
    result.push({
      label,
      url,
      ...(repository ? { repository } : {}),
      ...(revision ? { revision } : {}),
      ...(path ? { path } : {}),
      ...(/^[a-f0-9]{7,64}$/iu.test(blobHash) ? { blobHash } : {}),
    });
    if (result.length === 20) break;
  }
  return result;
}

export function publicLearningMetadata(
  data: Record<string, unknown>,
  library: "academy" | "areslib",
): PublicLearningMetadata {
  const category = boundedText(data.category, 120) || "General";
  const complete = data.learningSchemaVersion === 1
    && LEARNING_SUBJECTS.includes(data.subject as LearningSubject)
    && LEARNING_CONTENT_TYPES.includes(data.contentType as LearningContentType)
    && LEARNING_LEVELS.includes(data.level as LearningLevel)
    && LEARNING_SAFETY_SCOPES.includes(data.safetyScope as LearningSafetyScope);
  const minutes = typeof data.estimatedMinutes === "number" && Number.isFinite(data.estimatedMinutes)
    ? Math.max(1, Math.min(600, Math.trunc(data.estimatedMinutes)))
    : undefined;

  return {
    learningSchemaVersion: complete ? 1 : 0,
    metadataStatus: complete ? "complete" : "legacy-inferred",
    subject: enumValue(data.subject, LEARNING_SUBJECTS, inferSubject(category, library)),
    topics: textList(data.topics, 20, 80),
    contentType: enumValue(data.contentType, LEARNING_CONTENT_TYPES, library === "areslib" ? "reference" : "lesson"),
    level: enumValue(data.level, LEARNING_LEVELS, "beginner"),
    ...(minutes ? { estimatedMinutes: minutes } : {}),
    pathMemberships: pathMemberships(data.pathMemberships),
    prerequisites: textList(data.prerequisites, 20, 300),
    objectives: textList(data.objectives, 20, 500),
    platforms: textList(data.platforms, 5, 40)
      .filter((value): value is LearningPlatform => LEARNING_PLATFORMS.includes(value as LearningPlatform)),
    sourceReferences: sourceReferences(data.sourceReferences),
    ...(boundedText(data.appliesToVersion, 120) ? { appliesToVersion: boundedText(data.appliesToVersion, 120) } : {}),
    ...(boundedText(data.reviewedAt, 80) ? { reviewedAt: boundedText(data.reviewedAt, 80) } : {}),
    ...(boundedText(data.reviewedByLabel, 120) ? { reviewedByLabel: boundedText(data.reviewedByLabel, 120) } : {}),
    safetyScope: enumValue(data.safetyScope, LEARNING_SAFETY_SCOPES, "none"),
  };
}
