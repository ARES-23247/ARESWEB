import { describe, expect, it } from "vitest";
import { publicLearningMetadata } from "../learningContent";

describe("publicLearningMetadata", () => {
  it("marks legacy records as inferred without inventing review or source provenance", () => {
    expect(publicLearningMetadata({ category: "Neural Networks" }, "academy")).toEqual({
      learningSchemaVersion: 0,
      metadataStatus: "legacy-inferred",
      subject: "computing-ai",
      topics: [],
      contentType: "lesson",
      level: "beginner",
      pathMemberships: [],
      prerequisites: [],
      objectives: [],
      platforms: [],
      sourceReferences: [],
      safetyScope: "none",
    });
    expect(publicLearningMetadata({ category: "Mathematics" }, "academy").subject).toBe("mathematics-data");
    expect(publicLearningMetadata({ category: "Science of Climbing" }, "academy").subject).toBe("physics-applied-science");
    expect(publicLearningMetadata({ category: "Controls" }, "areslib")).toMatchObject({
      subject: "robotics-engineering",
      contentType: "reference",
    });
  });

  it("returns bounded, allowlisted metadata and public HTTPS source references", () => {
    const metadata = publicLearningMetadata({
      learningSchemaVersion: 1,
      subject: "robotics-engineering",
      topics: [" Redux ", "Redux", "control flow", 42],
      contentType: "guided-lab",
      level: "intermediate",
      estimatedMinutes: 900,
      pathMemberships: [
        { pathId: "robotics-foundations", order: 2.8 },
        { pathId: "robotics-foundations", order: 1 },
        { pathId: "not-real", order: 3 },
        { pathId: "ftc-robot-with-ares", order: -4 },
      ],
      prerequisites: ["workspace-introduction"],
      objectives: ["Trace one Redux control cycle."],
      platforms: ["simulator", "ftc", "unknown"],
      sourceReferences: [
        { label: "Released guide", url: "https://github.com/ARES-23247/ARESLib-Kotlin", repository: "ARESLib-Kotlin", revision: "v9.3.6", blobHash: "c096b51711c57f37d8da7799ccfceb07c0b1d2b0" },
        { label: "Unsafe", url: "javascript:alert(1)" },
        { label: "Malformed", url: "not a url" },
      ],
      appliesToVersion: " ARES 9.3.6 ",
      reviewedAt: "2026-08-25",
      reviewedByLabel: "ARES software mentor",
      safetyScope: "simulation-only",
    }, "academy");

    expect(metadata).toMatchObject({
      learningSchemaVersion: 1,
      metadataStatus: "complete",
      estimatedMinutes: 600,
      topics: ["Redux", "control flow"],
      platforms: ["simulator", "ftc"],
      pathMemberships: [
        { pathId: "ftc-robot-with-ares", order: 0 },
        { pathId: "robotics-foundations", order: 2 },
      ],
      appliesToVersion: "ARES 9.3.6",
      safetyScope: "simulation-only",
    });
    expect(metadata.sourceReferences).toEqual([expect.objectContaining({
      label: "Released guide",
      revision: "v9.3.6",
      blobHash: "c096b51711c57f37d8da7799ccfceb07c0b1d2b0",
    })]);
  });
});
