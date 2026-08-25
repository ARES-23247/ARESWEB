import { describe, expect, it } from "vitest";
import type { DocRecord, DocRevision } from "@/hooks/useDocumentSync";
import {
  applyRevisionToDraft,
  buildDocumentSave,
  createDocumentEditorDraft,
  parseRecoveryDraft,
  restoreDocumentEditorDraft,
} from "@/components/dashboard/documentEditorDraft";

const savedDoc: DocRecord = {
  slug: "motion-guide",
  title: "Motion Guide",
  category: "Custom Control",
  sortOrder: 4,
  description: "Saved description",
  content: "Saved content",
  status: "published",
  isDeleted: 0,
  displayInAreslib: 1,
  displayInMathCorner: 0,
  displayInScienceCorner: 1,
  isPortfolio: 0,
  isExecutiveSummary: 1,
};

describe("documentEditorDraft", () => {
  it("creates variant-specific new and existing drafts", () => {
    const docs = createDocumentEditorDraft({
      editDoc: savedDoc,
      categories: ["guide"],
      defaultCategory: "guide",
      variant: "docs",
      currentUserNickname: "Mentor",
      today: "2026-08-13",
    });
    expect(docs).toMatchObject({
      slug: "motion-guide",
      category: "custom",
      customCategory: "Custom Control",
      displayInAreslib: true,
      displayInScienceCorner: true,
      isExecutiveSummary: true,
    });

    expect(
      createDocumentEditorDraft({
        editDoc: null,
        categories: [],
        defaultCategory: "Physics",
        variant: "docs",
        currentUserNickname: "Mentor",
        today: "2026-08-13",
      }),
    ).toMatchObject({ category: "Physics", displayInScienceCorner: true });

    expect(
      createDocumentEditorDraft({
        editDoc: null,
        categories: [],
        defaultCategory: "news",
        variant: "blog",
        currentUserNickname: "Mentor",
        today: "2026-08-13",
      }),
    ).toMatchObject({ author: "Mentor", date: "2026-08-13" });
  });

  it("validates and restores only typed recovery fields", () => {
    const base = createDocumentEditorDraft({
      editDoc: null,
      categories: [],
      defaultCategory: "manual",
      variant: "documents",
      currentUserNickname: "Mentor",
      today: "2026-08-13",
    });
    const recovery = parseRecoveryDraft({
      title: "Recovered",
      sortOrder: 8,
      isPortfolio: true,
      ignored: "not copied",
    });
    expect(restoreDocumentEditorDraft(base, recovery)).toMatchObject({
      title: "Recovered",
      category: "manual",
      createdAt: "2026-08-13",
      sortOrder: 8,
      isPortfolio: true,
    });
    expect(() => parseRecoveryDraft([])).toThrow("invalid format");
    expect(() => parseRecoveryDraft({ title: 42 })).toThrow("title is invalid");
    expect(() => parseRecoveryDraft({ sortOrder: Number.NaN })).toThrow(
      "sortOrder is invalid",
    );
  });

  it("applies revision fields without replacing the stable slug", () => {
    const current = createDocumentEditorDraft({
      editDoc: savedDoc,
      categories: ["guide"],
      defaultCategory: "guide",
      variant: "docs",
      currentUserNickname: "Mentor",
    });
    const revision: DocRevision = {
      id: "revision-1",
      title: "Earlier title",
      category: "guide",
      sortOrder: 2,
      description: "Earlier description",
      content: "Earlier content",
      status: "draft",
      displayInAreslib: 0,
      displayInMathCorner: 1,
      displayInScienceCorner: 0,
      isPortfolio: 1,
      isExecutiveSummary: 0,
      editedBy: "member",
      editedByName: "Member",
      editedByAvatar: "",
      timestamp: "2026-08-01T00:00:00Z",
    };
    expect(
      applyRevisionToDraft(current, revision, {
        categories: ["guide"],
        defaultCategory: "guide",
        variant: "docs",
      }),
    ).toMatchObject({
      slug: "motion-guide",
      title: "Earlier title",
      category: "guide",
      displayInMathCorner: true,
      isPortfolio: true,
    });
  });

  it("builds explicit payloads and rejects incomplete drafts", () => {
    const draft = createDocumentEditorDraft({
      editDoc: null,
      categories: [],
      defaultCategory: "manual",
      variant: "documents",
      currentUserNickname: "Mentor",
      today: "2026-08-13",
    });
    expect(buildDocumentSave(draft, "documents", "manual")).toEqual({
      error: "A title and URL slug are required.",
    });

    const result = buildDocumentSave(
      {
        ...draft,
        title: " Safety Manual ",
        slug: "safety-manual",
        fileUrl: " https://drive.google.com/file ",
      },
      "documents",
      "manual",
    );
    expect(result).toMatchObject({
      slug: "safety-manual",
      payload: {
        title: "Safety Manual",
        category: "manual",
        fileUrl: "https://drive.google.com/file",
        createdAt: "2026-08-13",
      },
    });

    expect(
      buildDocumentSave(
        { ...draft, title: "Guide", slug: "guide", category: "custom" },
        "docs",
        "manual",
      ),
    ).toEqual({ error: "Validation: specify a category before saving." });

    const learningDraft = createDocumentEditorDraft({
      editDoc: null,
      categories: ["Robotics & Engineering"],
      defaultCategory: "Robotics & Engineering",
      variant: "docs",
      currentUserNickname: "Mentor",
      today: "2026-08-25",
    });
    const learningResult = buildDocumentSave({
      ...learningDraft,
      title: "Robot State Flow",
      slug: "robot-state-flow",
      topics: ["Redux", "control flow"],
      pathMemberships: [{ pathId: "robotics-foundations", order: 2 }],
      platforms: ["simulator", "ftc"],
      sourceReferences: [{ label: "Released architecture guide", url: "https://github.com/ARES-23247/ARESLib-Kotlin", revision: "v9.3.6" }],
      appliesToVersion: "ARES 9.3.6",
      reviewedAt: "2026-08-25",
      reviewedByLabel: "ARES software mentor",
      safetyScope: "simulation-only",
    }, "docs", "Robotics & Engineering");
    expect(learningResult).toMatchObject({
      payload: {
        learningSchemaVersion: 1,
        subject: "robotics-engineering",
        topics: ["Redux", "control flow"],
        pathMemberships: [{ pathId: "robotics-foundations", order: 2 }],
        appliesToVersion: "ARES 9.3.6",
        safetyScope: "simulation-only",
      },
    });
    expect(buildDocumentSave({
      ...learningDraft,
      title: "Unsafe source",
      slug: "unsafe-source",
      sourceReferences: [{ label: "Bad", url: "http://example.com" }],
    }, "docs", "Robotics & Engineering")).toEqual({
      error: "Validation: every source needs a label and an HTTPS URL.",
    });
  });
});
