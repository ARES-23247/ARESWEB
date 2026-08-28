import { describe, expect, it } from "vitest";
import {
  assertMiddleSchoolLearningQuality,
  assertStudentLedRobotVerificationLanguage,
  normalizeLearningMarkdown,
  parseAresVersions,
  registerPathOrder,
  resolveApprovedAuthority,
  validateSourceReference,
  validateSourceAuthorities,
} from "./validate-learning-catalog.mjs";

describe("learning catalog preparation", () => {
  it("normalizes Markdown line endings deterministically across operating systems", () => {
    expect(normalizeLearningMarkdown("  # Lesson\r\n\rBody\rMore\n  ")).toBe("# Lesson\n\nBody\nMore");
  });

  it("keeps robot verification student-led without weakening safety instructions", () => {
    expect(() => assertStudentLedRobotVerificationLanguage(
      "Students keep the robot disabled, use blocks, and verify the emergency stop before testing.",
      "safe-lesson",
    )).not.toThrow();
    expect(() => assertStudentLedRobotVerificationLanguage(
      "A mentor must verify the robot before students record evidence.",
      "mentor-gated-lesson",
    )).toThrow(/student-led/u);
    expect(() => assertStudentLedRobotVerificationLanguage(
      "Complete this commissioning activity with an experienced mentor.",
      "supervised-lesson",
    )).toThrow(/student-led/u);
  });

  it("requires readable, structured lessons with described diagrams", () => {
    const sentence = "Students test one small idea, record the result, and explain what changed.";
    const valid = `# Clear lesson\n\n${`${sentence} `.repeat(18)}\n\n## See the flow\n\n\`\`\`mermaid\n%% aria: A small input moves through one safe check to an output.\nflowchart LR\n  A --> B\n\`\`\`\n\n## Check your work\n\n${`${sentence} `.repeat(4)}`;
    expect(() => assertMiddleSchoolLearningQuality(valid, "clear-lesson")).not.toThrow();
    expect(() => assertMiddleSchoolLearningQuality(
      valid.replace("%% aria: A small input moves through one safe check to an output.\n", ""),
      "missing-summary",
    )).toThrow(/aria/u);
    expect(() => assertMiddleSchoolLearningQuality(
      valid.replace(`${sentence} `.repeat(18), "The institutionalization of incomprehensibility characterizes multidisciplinary implementations. ".repeat(22)),
      "hard-lesson",
    )).toThrow(/reading grade/u);
  });

  it("parses the monorepo version identity file and rejects ambiguous keys", () => {
    expect(parseAresVersions("# release identity\r\naresVersion=11.0.0\r\nstudioVersion=2.0.0\r\n")).toEqual({
      aresVersion: "11.0.0",
      studioVersion: "2.0.0",
    });
    expect(() => parseAresVersions("aresVersion=11.0.0\naresVersion=12.0.0")).toThrow(/Duplicate ARES version property/u);
    expect(() => parseAresVersions("not-a-property")).toThrow(/Invalid ARES version-property line/u);
  });

  it("accepts current and historical pins but rejects undeclared source identities", () => {
    const current = { revision: "v2.0.0", commit: "b".repeat(40) };
    const historical = { revision: "v1.0.0", commit: "a".repeat(40) };
    const authorities = validateSourceAuthorities({
      schemaVersion: 1,
      repositories: {
        example: { current, approved: [historical, current] },
      },
    });

    expect(resolveApprovedAuthority(authorities, "example", historical.revision, historical.commit)).toEqual(historical);
    expect(resolveApprovedAuthority(authorities, "example", current.revision, current.commit)).toEqual(current);
    expect(resolveApprovedAuthority(authorities, "example", "v3.0.0", "c".repeat(40))).toBeNull();
    expect(resolveApprovedAuthority(authorities, "unknown", current.revision, current.commit)).toBeNull();
  });

  it("requires the current source identity to be an approved immutable pin", () => {
    expect(() => validateSourceAuthorities({
      schemaVersion: 1,
      repositories: {
        example: {
          current: { revision: "v2.0.0", commit: "b".repeat(40) },
          approved: [{ revision: "v1.0.0", commit: "a".repeat(40) }],
        },
      },
    })).toThrow(/current authority must also be approved/u);
  });

  it("rejects mutable links and repositories outside the reviewed authority list", () => {
    const commit = "a".repeat(40);
    const authorities = validateSourceAuthorities({
      schemaVersion: 1,
      repositories: {
        example: {
          current: { revision: "v1.0.0", commit },
          approved: [{ revision: "v1.0.0", commit }],
        },
      },
    });
    const source = {
      label: "Example source",
      repository: "example",
      revision: "v1.0.0",
      path: "docs/lesson.md",
      blobHash: "b".repeat(40),
      url: `https://github.com/ARES-23247/example/blob/${commit}/docs/lesson.md`,
    };

    expect(validateSourceReference(source, "lesson", authorities)).toMatchObject({ current: true });
    expect(() => validateSourceReference({ ...source, url: "https://github.com/ARES-23247/example/blob/main/docs/lesson.md" }, "lesson", authorities)).toThrow(/full Git commit/u);
    expect(() => validateSourceReference({ ...source, repository: "unreviewed", url: `https://github.com/ARES-23247/unreviewed/blob/${commit}/docs/lesson.md` }, "lesson", authorities)).toThrow(/not an approved curriculum authority/u);
  });

  it("rejects two lessons assigned the same order in one learning path", () => {
    const orders = new Map();
    registerPathOrder(orders, "robotics-foundations", 1, "first");
    expect(() => registerPathOrder(orders, "robotics-foundations", 1, "second")).toThrow(/duplicates first/u);
    expect(() => registerPathOrder(orders, "another-path", 1, "second")).not.toThrow();
  });
});
