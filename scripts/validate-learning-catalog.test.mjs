import { describe, expect, it } from "vitest";
import {
  assertAresLibReferenceContract,
  assertMiddleSchoolLearningQuality,
  assertSubstantialLessonContract,
  assertStudentLedRobotVerificationLanguage,
  normalizeLearningMarkdown,
  parseAresVersions,
  registerPathOrder,
  validateLearningPathAllowlistContract,
  validateLearningPathContract,
  validateLocalLearningImageReferences,
  resolveApprovedAuthority,
  validateSourceReference,
  validateSourceAuthorities,
  validateRoboticsCurriculumPlan,
  validateAcademySimRegistry,
  validateCurriculumSourceRequests,
} from "./validate-learning-catalog.mjs";

describe("learning catalog preparation", () => {
  it("keeps frontend, Functions, and catalog learning-path allowlists aligned", () => {
    const frontend = `export const LEARNING_PATHS = [
      { id: "robotics-foundations", label: "Foundations" },
      { id: "ftc-robot-with-ares", label: "FTC" },
    ] as const;`;
    const functions = `export const LEARNING_PATH_IDS = [
      "robotics-foundations",
      "ftc-robot-with-ares",
    ] as const;`;

    expect(() => validateLearningPathAllowlistContract(frontend, functions))
      .toThrow(/Catalog PATH_IDS must exactly match/u);
    expect(() => validateLearningPathAllowlistContract(
      frontend,
      functions.replace("ftc-robot-with-ares", "frc-robot-with-ares"),
    )).toThrow(/Functions LEARNING_PATH_IDS must exactly match/u);
  });

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

  it("accepts only the current pin and rejects undeclared source identities", () => {
    const current = { revision: "v2.0.0", commit: "b".repeat(40) };
    const historical = { revision: "v1.0.0", commit: "a".repeat(40) };
    const authorities = validateSourceAuthorities({
      schemaVersion: 1,
      mode: "current-only",
      repositories: {
        example: { current, approved: [current] },
      },
    });

    expect(resolveApprovedAuthority(authorities, "example", historical.revision, historical.commit)).toBeNull();
    expect(resolveApprovedAuthority(authorities, "example", current.revision, current.commit)).toEqual(current);
    expect(resolveApprovedAuthority(authorities, "example", "v3.0.0", "c".repeat(40))).toBeNull();
    expect(resolveApprovedAuthority(authorities, "unknown", current.revision, current.commit)).toBeNull();
  });

  it("requires the current source identity to be an approved immutable pin", () => {
    expect(() => validateSourceAuthorities({
      schemaVersion: 1,
      mode: "current-only",
      repositories: {
        example: {
          current: { revision: "v2.0.0", commit: "b".repeat(40) },
          approved: [{ revision: "v1.0.0", commit: "a".repeat(40) }],
        },
      },
    })).toThrow(/current authority must also be approved/u);
  });

  it("requires accessible, bounded local Academy image references", () => {
    expect(validateLocalLearningImageReferences(
      "![Studio dashboard showing the project cards](/academy/studio-3.1.1/dashboard.png)",
      "studio-tour",
    )).toEqual([{
      alt: "Studio dashboard showing the project cards",
      pathname: "/academy/studio-3.1.1/dashboard.png",
      url: "/academy/studio-3.1.1/dashboard.png",
    }]);
    expect(() => validateLocalLearningImageReferences(
      "![](/academy/studio-3.1.1/dashboard.png)",
      "missing-alt",
    )).toThrow(/descriptive alt text/u);
    expect(() => validateLocalLearningImageReferences(
      "![Unsafe image path](/academy/../private.png)",
      "unsafe-path",
    )).toThrow(/must not traverse/u);
    expect(() => validateLocalLearningImageReferences(
      "![Wrong public directory](/images/studio.png)",
      "wrong-directory",
    )).toThrow(/public \/academy\//u);
  });

  it("rejects historical approvals and policies that are not current-only", () => {
    const current = { revision: "v2.0.0", commit: "b".repeat(40) };
    const historical = { revision: "v1.0.0", commit: "a".repeat(40) };
    expect(() => validateSourceAuthorities({
      schemaVersion: 1,
      mode: "current-only",
      repositories: {
        example: { current, approved: [historical, current] },
      },
    })).toThrow(/exactly one approved authority/u);
    expect(() => validateSourceAuthorities({
      schemaVersion: 1,
      mode: "historical-and-current",
      repositories: {
        example: { current, approved: [current] },
      },
    })).toThrow(/current-only mode/u);
  });

  it("rejects mutable links and repositories outside the reviewed authority list", () => {
    const commit = "a".repeat(40);
    const authorities = validateSourceAuthorities({
      schemaVersion: 1,
      mode: "current-only",
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

  it("requires a self-contained learning path to be contiguous and prerequisite ordered", () => {
    const catalog = { documents: [
      { slug: "start", prerequisites: [], pathMemberships: [{ pathId: "frc-robot-with-ares", order: 1 }] },
      { slug: "finish", prerequisites: ["start"], pathMemberships: [{ pathId: "frc-robot-with-ares", order: 2 }] },
    ] };
    expect(validateLearningPathContract(catalog, "frc-robot-with-ares", {
      minimumDocuments: 2,
      requireSelfContained: true,
    })).toEqual({ documents: 2, slugs: ["start", "finish"] });
    expect(() => validateLearningPathContract({ documents: [
      catalog.documents[0],
      { ...catalog.documents[1], pathMemberships: [{ pathId: "frc-robot-with-ares", order: 3 }] },
    ] }, "frc-robot-with-ares", { requireSelfContained: true })).toThrow(/contiguous path order 2/u);
    expect(() => validateLearningPathContract({ documents: [
      catalog.documents[0],
      { ...catalog.documents[1], prerequisites: ["outside"] },
    ] }, "frc-robot-with-ares", { requireSelfContained: true })).toThrow(/must appear earlier/u);
  });

  it("measures substantial lesson structure instead of relying on word count alone", () => {
    const sentence = "Students change one value, record the result, and explain the pattern in clear words.";
    const sections = [
      "Purpose and prerequisites",
      "Vocabulary",
      "Worked example",
      "Visual model",
      "Hands-on activity",
      "Checkpoints",
      "Troubleshooting",
      "Evidence artifact",
      "Short assessment",
      "Extension challenge",
      "Related and next",
    ];
    const valid = `# Full lesson\n\n${sections.map((section) =>
      `## ${section}\n\n${`${sentence} `.repeat(7)}`).join("\n\n")}`;
    expect(() => assertSubstantialLessonContract(valid, "full-lesson")).not.toThrow();
    expect(() => assertSubstantialLessonContract(
      valid.replace("## Troubleshooting", "## More words"),
      "missing-support",
    )).toThrow(/missing the Troubleshooting section/u);
  });

  it("keeps every ARESLib reference on the substantial learning contract", () => {
    expect(() => assertAresLibReferenceContract({
      slug: "deep-reference",
      contentFile: "areslib-reference/deep-reference.md",
      instructionalContractVersion: 2,
    })).not.toThrow();
    expect(() => assertAresLibReferenceContract({
      slug: "thin-reference",
      contentFile: "areslib-reference/thin-reference.md",
      instructionalContractVersion: 1,
    })).toThrow(/instructionalContractVersion 2/u);
    expect(() => assertAresLibReferenceContract({
      slug: "academy-lesson",
      contentFile: "robotics-foundations/academy-lesson.md",
      instructionalContractVersion: 1,
    })).not.toThrow();
  });

  it("ratchets the robotics expansion and validates existing-lesson interaction targets", () => {
    const lesson = (index) => ({
      id: `lesson-${index}`,
      title: `Lesson ${index}`,
      level: "beginner",
      interaction: index === 1 ? "ratio-explorer" : null,
      sourceGap: null,
    });
    const trackIds = [
      "mechanical-design-fabrication",
      "electrical-systems-diagnostics",
      "programming-with-ares",
      "controls-localization-autonomy",
      "testing-debugging-commissioning",
      "competition-operations",
      "robotics-capstones",
    ];
    const plan = {
      planVersion: 1,
      mode: "proposal-only",
      requiresHumanReview: true,
      minimumPlannedLessons: 48,
      sourceAuthority: {
        repository: "ARES-Robotics",
        commit: "a".repeat(40),
        aresVersion: "11.0.0",
        studioVersion: "2.0.0",
      },
      instructionalContract: {
        targetReadingGrades: [6, 8],
        requiredElements: ["purpose", "activity"],
        studentLedRobotVerification: true,
        websitePublicationRequiresLeadCoachReview: true,
      },
      interactionContract: {
        requiredEvidence: ["keyboard-operation"],
        forbiddenClaims: ["physical-hardware-validation"],
      },
      mediaContract: {
        authenticOnly: true,
        requiredMetadata: ["origin"],
        missingMediaBehavior: "record a truthful request",
      },
      tracks: trackIds.map((id, trackIndex) => ({
        id,
        pathId: id === "controls-localization-autonomy" ? "controls-localization-autonomous" : id,
        label: id,
        sourceRoots: [`docs/${id}.md`],
        lessons: Array.from({ length: trackIndex === 0 ? 12 : 6 }, (_, lessonIndex) =>
          lesson((trackIndex * 12) + lessonIndex)),
      })),
      existingLessonInteractionCandidates: [{
        slug: "existing-lesson",
        interaction: "ratio-explorer",
        purpose: "compare inputs and outputs",
      }],
    };
    const catalog = { documents: [{ slug: "existing-lesson" }] };

    expect(validateRoboticsCurriculumPlan(plan, catalog)).toEqual({
      tracks: 7,
      lessons: 48,
      existingInteractionCandidates: 1,
    });
    expect(() => validateRoboticsCurriculumPlan({ ...plan, minimumPlannedLessons: 47 }, catalog))
      .toThrow(/48-lesson expansion floor/u);
    expect(() => validateRoboticsCurriculumPlan({
      ...plan,
      existingLessonInteractionCandidates: [{ ...plan.existingLessonInteractionCandidates[0], slug: "missing" }],
    }, catalog)).toThrow(/absent from catalog/u);
    expect(() => validateRoboticsCurriculumPlan({
      ...plan,
      tracks: plan.tracks.map((track, index) => index === 1
        ? { ...track, lessons: [{ ...track.lessons[0], id: plan.tracks[0].lessons[0].id }] }
        : track),
    }, catalog)).toThrow(/duplicates lesson/u);
  });

  it("allows only standalone simulations with declared fidelity into Academy lessons", () => {
    expect(validateAcademySimRegistry({ simulators: [
      { id: "ratioExplorer", academyApproved: true, requiresContext: false, fidelity: "conceptual" },
      { id: "fieldRuntime", academyApproved: false, requiresContext: true, fidelity: null },
    ] }).approvedTags).toEqual(new Set(["ratioexplorer"]));
    expect(() => validateAcademySimRegistry({ simulators: [
      { id: "unsafeRuntime", academyApproved: true, requiresContext: true, fidelity: "code-derived" },
    ] })).toThrow(/cannot require application context/u);
    expect(() => validateAcademySimRegistry({ simulators: [
      { id: "unclearModel", academyApproved: true, requiresContext: false, fidelity: null },
    ] })).toThrow(/declared fidelity/u);
  });

  it("tracks every curriculum source gap without claiming it is already fulfilled", () => {
    const curriculumPlan = { tracks: [{ lessons: [
      { id: "needs-photo", sourceGap: "authentic team photo required" },
      { id: "complete-source", sourceGap: null },
    ] }] };
    const sourceRequests = {
      schemaVersion: 2,
      mode: "proposal-only",
      requests: [{
        lessonId: "needs-photo",
        requestType: "authentic-media",
        need: "authentic team photo required",
        status: "requested",
        acceptance: "An approved team photo supports the lesson objective.",
        review: {
          reviewedAt: "2026-08-30",
          evidenceState: "missing",
          remainingBlockers: ["approved-team-artifact"],
          evidence: [],
          note: "No approved team photo is available in the reviewed source set.",
        },
      }],
    };
    expect(validateCurriculumSourceRequests(sourceRequests, curriculumPlan)).toEqual({ requests: 1 });
    expect(() => validateCurriculumSourceRequests({ ...sourceRequests, requests: [] }, curriculumPlan))
      .toThrow(/has no tracked request/u);
    expect(() => validateCurriculumSourceRequests({
      ...sourceRequests,
      requests: [{ ...sourceRequests.requests[0], status: "fulfilled" }],
    }, curriculumPlan)).toThrow(/must remain requested/u);
    expect(() => validateCurriculumSourceRequests({
      ...sourceRequests,
      requests: [{
        ...sourceRequests.requests[0],
        review: { ...sourceRequests.requests[0].review, evidenceState: "partial" },
      }],
    }, curriculumPlan)).toThrow(/partial evidence requires/u);
    expect(() => validateCurriculumSourceRequests({
      ...sourceRequests,
      requests: [{
        ...sourceRequests.requests[0],
        review: {
          ...sourceRequests.requests[0].review,
          remainingBlockers: ["approved-team-artifact", "approved-team-artifact"],
        },
      }],
    }, curriculumPlan)).toThrow(/must not contain duplicates/u);
  });
});
