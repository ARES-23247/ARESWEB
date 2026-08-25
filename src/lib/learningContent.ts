export const LEARNING_SUBJECTS = [
  { id: "robotics-engineering", label: "Robotics & Engineering", description: "Robots, controls, hardware, design, and team engineering practice." },
  { id: "mathematics-data", label: "Mathematics & Data", description: "Mathematical reasoning, statistics, measurement, and data interpretation." },
  { id: "computing-ai", label: "Computing & AI", description: "Programming, machine learning, vision, and responsible use of computing." },
  { id: "physics-applied-science", label: "Physics & Applied Science", description: "Physics and science explored through robotics and outdoor activities." },
] as const;

export const LEARNING_CONTENT_TYPES = [
  { id: "lesson", label: "Lesson" },
  { id: "guided-lab", label: "Guided lab" },
  { id: "tutorial", label: "Tutorial" },
  { id: "reference", label: "Reference" },
  { id: "interactive", label: "Interactive" },
] as const;

export const LEARNING_LEVELS = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
] as const;

export const LEARNING_PLATFORMS = [
  { id: "web", label: "Web" },
  { id: "simulator", label: "Simulator" },
  { id: "ftc", label: "FTC" },
  { id: "frc", label: "FRC" },
  { id: "hardware-neutral", label: "Hardware neutral" },
] as const;

export const LEARNING_SAFETY_SCOPES = [
  { id: "none", label: "No physical hardware" },
  { id: "simulation-only", label: "Simulation only" },
  { id: "bench-testing", label: "Supervised bench testing" },
  { id: "physical-robot", label: "Physical robot safety required" },
] as const;

export const LEARNING_PATHS = [
  { id: "robotics-foundations", label: "Robotics Foundations", description: "Learn how robot software turns intent into safe, observable behavior." },
  { id: "ftc-robot-with-ares", label: "Build an FTC Robot with ARES", description: "Progress from the FTC starter project to a simulated and then supervised physical robot." },
  { id: "controls-localization-autonomous", label: "Controls, Localization & Autonomous", description: "Connect control loops, coordinates, sensing, localization, and autonomous routines." },
  { id: "math-for-robotics", label: "Math for Robotics", description: "Apply geometry, algebra, statistics, and measurement to robot problems." },
  { id: "ai-ml-foundations", label: "AI and Machine Learning Foundations", description: "Build a careful foundation for machine learning, vision, and generative AI." },
  { id: "applied-stem-outdoors", label: "Applied STEM in the Outdoors", description: "Use climbing and outdoor activities to investigate physics, data, and engineering." },
] as const;

export type LearningSubject = (typeof LEARNING_SUBJECTS)[number]["id"];
export type LearningContentType = (typeof LEARNING_CONTENT_TYPES)[number]["id"];
export type LearningLevel = (typeof LEARNING_LEVELS)[number]["id"];
export type LearningPlatform = (typeof LEARNING_PLATFORMS)[number]["id"];
export type LearningSafetyScope = (typeof LEARNING_SAFETY_SCOPES)[number]["id"];
export type LearningPathId = (typeof LEARNING_PATHS)[number]["id"];

export interface LearningPathMembership {
  pathId: LearningPathId;
  order: number;
}

export interface LearningSourceReference {
  label: string;
  url: string;
  repository?: string;
  revision?: string;
  path?: string;
  blobHash?: string;
}

export interface LearningMetadata {
  learningSchemaVersion: number;
  metadataStatus: "complete" | "legacy-inferred";
  subject: LearningSubject;
  topics: string[];
  contentType: LearningContentType;
  level: LearningLevel;
  estimatedMinutes?: number;
  pathMemberships: LearningPathMembership[];
  prerequisites: string[];
  objectives: string[];
  platforms: LearningPlatform[];
  sourceReferences: LearningSourceReference[];
  appliesToVersion?: string;
  reviewedAt?: string;
  reviewedByLabel?: string;
  safetyScope: LearningSafetyScope;
}

export function labelFor<T extends string>(
  items: readonly { id: T; label: string }[],
  id: T,
): string {
  return items.find((item) => item.id === id)?.label ?? id;
}

function hasId<T extends string>(items: readonly { id: T }[], value: unknown): value is T {
  return typeof value === "string" && items.some((item) => item.id === value);
}

function stringList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean))]
    .slice(0, maxItems);
}

function inferredSubject(category: string): LearningSubject {
  const normalized = category.toLowerCase();
  if (normalized.includes("math") || /\b(?:statistics?|data)\b/u.test(normalized)) return "mathematics-data";
  if (["ai", "neural", "vision", "learning"].some((term) => normalized.includes(term))) return "computing-ai";
  if (["climb", "outdoor", "physics", "science"].some((term) => normalized.includes(term))) return "physics-applied-science";
  return "robotics-engineering";
}

export function normalizeLearningMetadata(
  data: Record<string, unknown>,
  options: { category?: string; reference?: boolean } = {},
): LearningMetadata {
  const complete = data.learningSchemaVersion === 1
    && hasId(LEARNING_SUBJECTS, data.subject)
    && hasId(LEARNING_CONTENT_TYPES, data.contentType)
    && hasId(LEARNING_LEVELS, data.level)
    && hasId(LEARNING_SAFETY_SCOPES, data.safetyScope);
  const estimatedMinutes = typeof data.estimatedMinutes === "number" && Number.isFinite(data.estimatedMinutes)
    ? Math.max(1, Math.min(600, Math.trunc(data.estimatedMinutes)))
    : undefined;
  const pathMemberships = Array.isArray(data.pathMemberships)
    ? data.pathMemberships.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      if (!hasId(LEARNING_PATHS, record.pathId)) return [];
      return [{
        pathId: record.pathId,
        order: typeof record.order === "number" && Number.isFinite(record.order)
          ? Math.max(0, Math.min(10_000, Math.trunc(record.order)))
          : 0,
      }];
    }).slice(0, LEARNING_PATHS.length)
    : [];
  const sourceReferences = Array.isArray(data.sourceReferences)
    ? data.sourceReferences.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      if (typeof record.label !== "string" || typeof record.url !== "string") return [];
      try {
        const url = new URL(record.url);
        if (url.protocol !== "https:") return [];
        return [{
          label: record.label.trim().slice(0, 120),
          url: url.toString(),
          ...(typeof record.repository === "string" && record.repository.trim() ? { repository: record.repository.trim().slice(0, 120) } : {}),
          ...(typeof record.revision === "string" && record.revision.trim() ? { revision: record.revision.trim().slice(0, 120) } : {}),
          ...(typeof record.path === "string" && record.path.trim() ? { path: record.path.trim().slice(0, 500) } : {}),
          ...(typeof record.blobHash === "string" && /^[a-f0-9]{7,64}$/i.test(record.blobHash.trim()) ? { blobHash: record.blobHash.trim() } : {}),
        }];
      } catch {
        return [];
      }
    }).filter((item) => item.label).slice(0, 20)
    : [];

  return {
    learningSchemaVersion: complete ? 1 : 0,
    metadataStatus: complete ? "complete" : "legacy-inferred",
    subject: hasId(LEARNING_SUBJECTS, data.subject) ? data.subject : inferredSubject(options.category ?? ""),
    topics: stringList(data.topics, 20, 80),
    contentType: hasId(LEARNING_CONTENT_TYPES, data.contentType) ? data.contentType : options.reference ? "reference" : "lesson",
    level: hasId(LEARNING_LEVELS, data.level) ? data.level : "beginner",
    ...(estimatedMinutes ? { estimatedMinutes } : {}),
    pathMemberships,
    prerequisites: stringList(data.prerequisites, 20, 300),
    objectives: stringList(data.objectives, 20, 500),
    platforms: stringList(data.platforms, 5, 40).filter((value): value is LearningPlatform => hasId(LEARNING_PLATFORMS, value)),
    sourceReferences,
    ...(typeof data.appliesToVersion === "string" && data.appliesToVersion.trim() ? { appliesToVersion: data.appliesToVersion.trim().slice(0, 120) } : {}),
    ...(typeof data.reviewedAt === "string" && data.reviewedAt.trim() ? { reviewedAt: data.reviewedAt.trim().slice(0, 80) } : {}),
    ...(typeof data.reviewedByLabel === "string" && data.reviewedByLabel.trim() ? { reviewedByLabel: data.reviewedByLabel.trim().slice(0, 120) } : {}),
    safetyScope: hasId(LEARNING_SAFETY_SCOPES, data.safetyScope) ? data.safetyScope : "none",
  };
}
