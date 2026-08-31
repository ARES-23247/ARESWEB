import { describe, expect, it } from "vitest";
import type { PublicDocument } from "@/lib/publicContentApi";
import {
  DEFAULT_LEARNING_FILTERS,
  filterLearningDocuments,
  learningFiltersToSearchParams,
  learningPathNavigation,
  learningTopics,
  parseLearningFilters,
  relatedLearningDocuments,
} from "@/lib/learningExperience";

function document(overrides: Partial<PublicDocument> & Pick<PublicDocument, "slug" | "title">): PublicDocument {
  return {
    learningSchemaVersion: 1,
    metadataStatus: "complete",
    subject: "robotics-engineering",
    topics: [],
    contentType: "lesson",
    level: "beginner",
    pathMemberships: [],
    prerequisites: [],
    objectives: [],
    platforms: ["web"],
    sourceReferences: [],
    safetyScope: "none",
    category: "Robotics",
    sortOrder: 0,
    description: "",
    status: "published",
    isDeleted: 0,
    isPortfolio: 0,
    isExecutiveSummary: 0,
    displayInAreslib: 0,
    displayInMathCorner: 0,
    displayInScienceCorner: 0,
    ...overrides,
  };
}

const docs = [
  document({
    slug: "robot-intent",
    title: "Robot Intent",
    topics: ["State management", "Safety"],
    estimatedMinutes: 15,
    pathMemberships: [{ pathId: "robotics-foundations", order: 1 }],
    platforms: ["web", "hardware-neutral"],
  }),
  document({
    slug: "safe-output",
    title: "Safe Output",
    topics: ["Safety", "Actuators"],
    contentType: "guided-lab",
    level: "intermediate",
    estimatedMinutes: 45,
    prerequisites: ["robot-intent"],
    pathMemberships: [{ pathId: "robotics-foundations", order: 2 }],
    platforms: ["simulator", "ftc"],
  }),
  document({
    slug: "mean-and-median",
    title: "Mean and Median",
    subject: "mathematics-data",
    category: "Mathematics",
    topics: ["Statistics"],
    estimatedMinutes: 30,
    pathMemberships: [{ pathId: "math-for-robotics", order: 1 }],
  }),
];

describe("learning experience utilities", () => {
  it("allowlists URL-backed filters and round-trips supported values", () => {
    const parsed = parseLearningFilters(new URLSearchParams(
      "search=robot&subject=robotics-engineering&level=beginner&type=lesson&path=robotics-foundations&platform=ftc&topic=Safety&duration=30&progress=not-started",
    ));
    expect(parsed).toMatchObject({
      search: "robot",
      subject: "robotics-engineering",
      level: "beginner",
      contentType: "lesson",
      pathId: "robotics-foundations",
      platform: "ftc",
      topic: "Safety",
      duration: "30",
      progress: "not-started",
    });
    expect(parseLearningFilters(learningFiltersToSearchParams(parsed))).toEqual(parsed);
  });

  it("drops malformed, unknown, and reserved query values", () => {
    const parsed = parseLearningFilters(new URLSearchParams(
      "subject=private&type=%3Cscript%3E&path=unknown&topic=%3Cimg%3E&duration=999&progress=unknown&q=overlay",
    ));
    expect(parsed).toEqual(DEFAULT_LEARNING_FILTERS);
  });

  it("filters by metadata and orders a selected path", () => {
    expect(filterLearningDocuments(docs, {
      ...DEFAULT_LEARNING_FILTERS,
      search: "actuator",
      pathId: "robotics-foundations",
      platform: "ftc",
      duration: "60",
    }).map((item) => item.slug)).toEqual(["safe-output"]);

    expect(filterLearningDocuments([...docs].reverse(), {
      ...DEFAULT_LEARNING_FILTERS,
      pathId: "robotics-foundations",
    }).map((item) => item.slug)).toEqual(["robot-intent", "safe-output"]);

    expect(filterLearningDocuments(docs, {
      ...DEFAULT_LEARNING_FILTERS,
      topic: "safety",
    }).map((item) => item.slug)).toEqual(["robot-intent", "safe-output"]);
  });

  it("filters local completion without sending progress to an account", () => {
    const completed = new Set(["robot-intent"]);
    expect(filterLearningDocuments(docs, {
      ...DEFAULT_LEARNING_FILTERS,
      progress: "completed",
    }, completed).map((item) => item.slug)).toEqual(["robot-intent"]);

    expect(filterLearningDocuments(docs, {
      ...DEFAULT_LEARNING_FILTERS,
      progress: "not-started",
    }, completed).map((item) => item.slug)).toEqual(["mean-and-median", "safe-output"]);
  });

  it("derives bounded topics and path-aware previous/next navigation", () => {
    expect(learningTopics(docs)).toEqual(["Actuators", "Safety", "State management", "Statistics"]);
    expect(learningPathNavigation(docs, "safe-output", "robotics-foundations")).toMatchObject({
      pathId: "robotics-foundations",
      position: 1,
      previous: { slug: "robot-intent" },
      next: null,
    });
    expect(learningPathNavigation(docs, "missing", null)).toMatchObject({ position: -1, documents: [] });

    const pathless = document({ slug: "pathless", title: "Pathless", category: "Zoology", sortOrder: 2 });
    const earlier = document({ slug: "earlier", title: "Earlier", category: "Algebra", sortOrder: 1 });
    expect(learningPathNavigation([pathless, earlier], "pathless", null)).toMatchObject({
      pathId: null,
      position: 1,
      previous: { slug: "earlier" },
    });

    const multiPath = document({
      slug: "multi-path",
      title: "Multi Path",
      pathMemberships: [
        { pathId: "math-for-robotics", order: 1 },
        { pathId: "ai-ml-foundations", order: 1 },
      ],
    });
    expect(learningPathNavigation([multiPath], "multi-path", null).pathId).toBe("ai-ml-foundations");
  });

  it("keeps FRC path filtering and next-lesson navigation available", () => {
    const frcStart = document({
      slug: "frc-start",
      title: "FRC Start",
      pathMemberships: [{ pathId: "frc-robot-with-ares", order: 1 }],
      platforms: ["frc"],
    });
    const frcNext = document({
      slug: "frc-next",
      title: "FRC Next",
      prerequisites: ["frc-start"],
      pathMemberships: [{ pathId: "frc-robot-with-ares", order: 2 }],
      platforms: ["frc"],
    });
    const filters = parseLearningFilters(new URLSearchParams("path=frc-robot-with-ares&platform=frc"));

    expect(filterLearningDocuments([frcNext, frcStart, ...docs], filters).map((item) => item.slug))
      .toEqual(["frc-start", "frc-next"]);
    expect(learningPathNavigation([frcNext, frcStart], "frc-start", "frc-robot-with-ares"))
      .toMatchObject({
        pathId: "frc-robot-with-ares",
        position: 0,
        previous: null,
        next: { slug: "frc-next" },
      });
  });

  it("ranks prerequisites and shared path/topic relationships without returning the current lesson", () => {
    expect(relatedLearningDocuments(docs, "robot-intent", 2).map((item) => item.slug))
      .toEqual(["safe-output"]);
    expect(relatedLearningDocuments(docs, "missing")).toEqual([]);

    const current = document({ slug: "current", title: "Current", subject: "mathematics-data" });
    const alpha = document({ slug: "alpha", title: "Alpha", subject: "mathematics-data" });
    const beta = document({ slug: "beta", title: "Beta", subject: "mathematics-data" });
    expect(relatedLearningDocuments([current, beta, alpha], "current", 8).map((item) => item.slug))
      .toEqual(["alpha", "beta"]);
    expect(relatedLearningDocuments([current, alpha], "current", 0)).toEqual([]);
  });
});
