import { describe, expect, it } from "vitest";
import { normalizeLearningMetadata } from "@/lib/learningContent";

describe("normalizeLearningMetadata", () => {
  it("infers only navigational metadata for legacy records", () => {
    expect(normalizeLearningMetadata({}, { category: "Science of Outdoor Sports" })).toMatchObject({
      learningSchemaVersion: 0,
      metadataStatus: "legacy-inferred",
      subject: "physics-applied-science",
      contentType: "lesson",
      sourceReferences: [],
    });
    expect(normalizeLearningMetadata({}, { category: "State Management", reference: true })).toMatchObject({
      subject: "robotics-engineering",
      contentType: "reference",
    });
  });

  it("normalizes persisted metadata and rejects unsafe source URLs", () => {
    expect(normalizeLearningMetadata({
      learningSchemaVersion: 1,
      subject: "robotics-engineering",
      contentType: "tutorial",
      level: "intermediate",
      safetyScope: "simulation-only",
      estimatedMinutes: 45.8,
      platforms: ["simulator", "invalid"],
      pathMemberships: [{ pathId: "robotics-foundations", order: 1.9 }, { pathId: "invalid", order: 2 }],
      sourceReferences: [
        { label: "Source", url: "https://example.com/guide", revision: "v1", blobHash: "c096b51711c57f37d8da7799ccfceb07c0b1d2b0" },
        { label: "Unsafe", url: "javascript:alert(1)" },
      ],
    })).toMatchObject({
      learningSchemaVersion: 1,
      metadataStatus: "complete",
      estimatedMinutes: 45,
      platforms: ["simulator"],
      pathMemberships: [{ pathId: "robotics-foundations", order: 1 }],
      sourceReferences: [{ label: "Source", url: "https://example.com/guide", revision: "v1", blobHash: "c096b51711c57f37d8da7799ccfceb07c0b1d2b0" }],
    });
  });
});
