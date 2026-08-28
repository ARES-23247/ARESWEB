import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildLearningApprovalTemplate,
  buildLearningRollbackManifest,
  loadFirebase,
  main,
  parseLearningMigrationArgs,
  planLearningDocument,
  runLearningMigration,
  validateApprovalFile,
} from "./migrate-learning-content.mjs";

const tempDirectories = [];

function tempFiles({ documents = [], actions = [], links = [], refreshes = [] } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "ares-learning-migration-"));
  tempDirectories.push(directory);
  const files = {
    artifact: join(directory, "artifact.json"),
    legacyPlan: join(directory, "legacy.json"),
    crossLinkPlan: join(directory, "links.json"),
    refreshPlan: join(directory, "refresh.json"),
    approvalFile: join(directory, "approval.json"),
    rollbackManifest: join(directory, "rollback.json"),
  };
  writeFileSync(files.artifact, JSON.stringify({ catalogVersion: 1, documents }));
  writeFileSync(files.legacyPlan, JSON.stringify({ planVersion: 1, mode: "proposal-only", actions }));
  writeFileSync(files.crossLinkPlan, JSON.stringify({
    planVersion: 1,
    mode: "proposal-only",
    requiresHumanReview: true,
    documents: links,
  }));
  writeFileSync(files.refreshPlan, JSON.stringify({
    planVersion: 1,
    mode: "proposal-only",
    requiresHumanReview: true,
    documents: refreshes,
  }));
  return files;
}

function writeApproval(files, phase, approvedSlugs) {
  const artifact = JSON.parse(readFileSync(files.artifact, "utf8"));
  const legacyPlan = JSON.parse(readFileSync(files.legacyPlan, "utf8"));
  const crossLinkPlan = JSON.parse(readFileSync(files.crossLinkPlan, "utf8"));
  const refreshPlan = JSON.parse(readFileSync(files.refreshPlan, "utf8"));
  const template = buildLearningApprovalTemplate(phase, artifact, legacyPlan, crossLinkPlan, approvedSlugs, refreshPlan);
  const approval = {
    ...template,
    reviewedByLabel: "Lead Coach",
    reviewedAt: "2026-08-25",
  };
  writeFileSync(files.approvalFile, JSON.stringify(approval));
  return approval;
}

function snapshot(value) {
  return { exists: value !== undefined, data: () => value };
}

function fakeFirestore(initial = {}) {
  const records = new Map(Object.entries(initial).map(([path, value]) => [path, structuredClone(value)]));
  const ref = (path) => ({
    path,
    get: async () => snapshot(records.get(path)),
  });
  const transaction = {
    get: async (document) => snapshot(records.get(document.path)),
    set(document, value, options = {}) {
      records.set(document.path, options.merge
        ? { ...(records.get(document.path) ?? {}), ...structuredClone(value) }
        : structuredClone(value));
    },
    create(document, value) {
      if (records.has(document.path)) throw new Error("already exists");
      records.set(document.path, structuredClone(value));
    },
  };
  return {
    records,
    db: {
      doc: ref,
      runTransaction: async (callback) => callback(transaction),
    },
  };
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("learning content migration", () => {
  it("parses dry runs and requires explicit production or emulator write confirmations", () => {
    expect(parseLearningMigrationArgs(["--", "--project", "aresweb-ci", "--phase", "cleanup"])).toMatchObject({
      apply: false,
      project: "aresweb-ci",
      phase: "cleanup",
    });
    expect(() => parseLearningMigrationArgs(["--project", "bad", "--phase", "cleanup"])).toThrow(/project/u);
    expect(() => parseLearningMigrationArgs(["--project", "aresweb-ci", "--phase", "unknown"])).toThrow(/phase/u);
    expect(() => parseLearningMigrationArgs(["--project", "aresweb-ci", "--phase", "cleanup", "--wat"])).toThrow(/Unknown/u);
    expect(() => parseLearningMigrationArgs(["--project", "aresweb-ci", "--phase", "cleanup", "--artifact"])).toThrow(/requires/u);

    const writeArgs = [
      "--project", "aresweb-ci", "--phase", "cleanup", "--apply",
      "--confirm-project", "aresweb-ci", "--batch-id", "emulator-batch",
      "--rollback-manifest", "scratch/rollback.json",
      "--backup-uri", "emulator://verified-fixture",
      "--confirm-backup-uri", "emulator://verified-fixture",
    ];
    expect(parseLearningMigrationArgs(writeArgs, { FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" })).toMatchObject({ apply: true });
    expect(() => parseLearningMigrationArgs(writeArgs, {})).toThrow(/backup URI/u);
    expect(() => parseLearningMigrationArgs(writeArgs.slice(0, -2), { FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" })).toThrow(/backup URI/u);
    expect(() => parseLearningMigrationArgs([
      "--project", "aresfirst-portal", "--phase", "cleanup", "--apply",
      "--confirm-project", "wrong-project", "--batch-id", "batch", "--rollback-manifest", "scratch/new.json",
      "--backup-uri", "gs://aresfirst-portal-firestore-backups/academy-migration/2026-08-25T132900Z",
      "--confirm-backup-uri", "gs://aresfirst-portal-firestore-backups/academy-migration/2026-08-25T132900Z",
    ], {})).toThrow(/confirm-project/u);
    expect(() => parseLearningMigrationArgs(["--project", "aresweb-ci", "--phase", "replacements"])).toThrow(/approval-file/u);
    expect(() => parseLearningMigrationArgs(["--project", "aresweb-ci", "--phase", "publish-drafts"])).toThrow(/approval-file/u);
    expect(() => parseLearningMigrationArgs(["--project", "aresweb-ci", "--phase", "refresh-published"])).toThrow(/approval-file/u);
    expect(parseLearningMigrationArgs(["--project", "aresweb-ci", "--phase", "publish-drafts", "--prepare-approval"])).toMatchObject({
      prepareApproval: true,
      phase: "publish-drafts",
    });
    expect(() => parseLearningMigrationArgs(["--project", "aresweb-ci", "--phase", "cleanup", "--prepare-approval"])).toThrow(/approval-gated/u);
    expect(() => parseLearningMigrationArgs([
      "--project", "aresweb-ci", "--phase", "publish-drafts", "--prepare-approval", "--approval-file", "approval.json",
    ])).toThrow(/cannot be combined/u);
    expect(parseLearningMigrationArgs([
      "--project", "aresweb-ci", "--phase", "stage-drafts", "--stage-slugs", "second, first",
    ])).toMatchObject({ stageSlugs: ["second", "first"] });
    expect(() => parseLearningMigrationArgs([
      "--project", "aresweb-ci", "--phase", "cleanup", "--stage-slugs", "first",
    ])).toThrow(/only valid with stage-drafts/u);
    expect(() => parseLearningMigrationArgs([
      "--project", "aresweb-ci", "--phase", "stage-drafts", "--stage-slugs", "same,same",
    ])).toThrow(/unique safe slugs/u);
  });

  it("validates bounded human approval manifests without inventing approval", () => {
    expect(validateApprovalFile({
      version: 1,
      phase: "replacements",
      reviewedByLabel: "Lead Coach",
      reviewedAt: "2026-08-25",
      reviewDigest: "a".repeat(64),
      approvedSlugs: ["areslib-fundamentals"],
    }, "replacements")).toEqual({
      reviewedByLabel: "Lead Coach",
      reviewedAt: "2026-08-25",
      reviewDigest: "a".repeat(64),
      approvedSlugs: ["areslib-fundamentals"],
    });
    expect(() => validateApprovalFile({}, "replacements")).toThrow(/version/u);
    expect(() => validateApprovalFile({ version: 1, phase: "replacements", reviewedByLabel: "", reviewedAt: "today", approvedSlugs: [] }, "replacements")).toThrow(/reviewer/u);
    expect(() => validateApprovalFile({ version: 1, phase: "replacements", reviewedByLabel: "Coach", reviewedAt: "today", approvedSlugs: ["valid"] }, "replacements")).toThrow(/date/u);
    expect(() => validateApprovalFile({ version: 1, phase: "replacements", reviewedByLabel: "Coach", reviewedAt: "2026-02-30", reviewDigest: "a".repeat(64), approvedSlugs: ["valid"] }, "replacements")).toThrow(/calendar date/u);
    expect(() => validateApprovalFile({ version: 1, phase: "replacements", reviewedByLabel: "Coach", reviewedAt: "2026-08-26", reviewDigest: "a".repeat(64), approvedSlugs: ["valid"] }, "replacements", new Date("2026-08-25T12:00:00Z"))).toThrow(/future/u);
    expect(() => validateApprovalFile({ version: 1, phase: "replacements", reviewedByLabel: "Coach", reviewedAt: "2026-08-25", reviewDigest: "bad", approvedSlugs: ["valid"] }, "replacements")).toThrow(/digest/u);
    expect(() => validateApprovalFile({ version: 1, phase: "replacements", reviewedByLabel: "Coach", reviewedAt: "2026-08-25", reviewDigest: "a".repeat(64), approvedSlugs: ["same", "same"] }, "replacements")).toThrow(/unique/u);
  });

  it("classifies ready, blocked, and idempotently unchanged documents", () => {
    const update = { slug: "lesson", kind: "update", preconditions: { title: "Before" }, desired: { status: "draft" } };
    expect(planLearningDocument(update, snapshot({ title: "Before", status: "published" }), "cleanup")).toMatchObject({ state: "ready", changedFields: ["status"] });
    expect(planLearningDocument(update, snapshot({ title: "Changed" }), "cleanup")).toMatchObject({
      state: "blocked",
      blockedReason: "precondition-mismatch",
      changedFields: ["title"],
    });
    expect(planLearningDocument({ slug: "new", kind: "create", preconditions: null, desired: { status: "draft" } }, snapshot(undefined), "stage-drafts").state).toBe("ready");
    expect(planLearningDocument({ slug: "new", kind: "create", preconditions: null, desired: { status: "draft" } }, snapshot({ status: "other" }), "stage-drafts")).toMatchObject({
      state: "blocked",
      blockedReason: "slug-already-exists",
      changedFields: ["status"],
    });
    expect(planLearningDocument(update, snapshot({
      title: "Changed",
      status: "draft",
      academyMigrationVersion: 2,
      academyMigrationPhase: "cleanup",
    }), "cleanup").state).toBe("unchanged");
  });

  it("applies cleanup atomically, records pre-change revisions, and emits content-free rollback metadata", async () => {
    const files = tempFiles({
      actions: [
        { slug: "test-doc", action: "archive", preconditions: { title: "Test", status: "published", displayInAreslib: 1 } },
        { slug: "monty", action: "remove-from-areslib", preconditions: { title: "Monty", status: "published", displayInAreslib: 1 } },
      ],
    });
    const store = fakeFirestore({
      "docs/test-doc": { title: "Test", status: "published", displayInAreslib: 1, content: "public lesson" },
      "docs/monty": { title: "Monty", status: "published", displayInAreslib: 1, content: "statistics" },
    });
    const options = {
      ...files,
      apply: true,
      project: "aresweb-ci",
      phase: "cleanup",
      batchId: "emulator-batch",
      backupUri: "emulator://verified-fixture",
    };
    const result = await runLearningMigration(options, { db: store.db });
    expect(result).toMatchObject({ planned: 2, ready: 2, blocked: 0, applied: 2, verified: 2 });
    expect(store.records.get("docs/test-doc")).toMatchObject({ isDeleted: 1, academyMigrationPhase: "cleanup" });
    expect(store.records.get("docs/monty")).toMatchObject({ displayInAreslib: 0, academyMigrationPhase: "cleanup" });
    expect(store.records.get("docs/test-doc/revisions/academy_v2_cleanup_test-doc")).toMatchObject({
      content: "public lesson",
      migrationAction: "pre-migration-snapshot",
    });
    expect(store.records.get("audit_logs/academy_v2_cleanup_test-doc")).not.toHaveProperty("content");
    const manifestText = readFileSync(files.rollbackManifest, "utf8");
    expect(manifestText).not.toContain("public lesson");
    const manifest = JSON.parse(manifestText);
    expect(manifest.backupUri).toBe("emulator://verified-fixture");
    expect(manifest.entries[0]).toMatchObject({ documentPath: "docs/test-doc" });

    const rerun = await runLearningMigration({ ...options, rollbackManifest: join(files.rollbackManifest, "unused") }, { db: store.db });
    expect(rerun).toMatchObject({ ready: 0, unchanged: 2, applied: 0 });
  });

  it("stages only brand-new pending drafts and blocks unexpected slug collisions", async () => {
    const draft = { title: "New lesson", status: "draft", approvalStatus: "pending_approval", content: "review me" };
    const replacement = { title: "Replacement", status: "draft", approvalStatus: "pending_approval", content: "review replacement" };
    const files = tempFiles({
      documents: [{ slug: "new-lesson", data: draft }, { slug: "replacement", data: replacement }],
      actions: [{
        slug: "replacement",
        catalogSlug: "replacement",
        action: "replace-from-catalog-after-review",
        reason: "old content",
        preconditions: { title: "Old", status: "published" },
      }],
    });
    const store = fakeFirestore({ "docs/new-lesson": { title: "Collision", status: "draft" } });
    const result = await runLearningMigration({
      ...files,
      apply: false,
      project: "aresweb-ci",
      phase: "stage-drafts",
    }, { db: store.db });
    expect(result).toMatchObject({ planned: 1, ready: 0, blocked: 1, blockedSlugs: ["new-lesson"] });
  });

  it("stages only the explicitly selected subset without touching existing catalog drafts", async () => {
    const draft = { title: "Lesson", status: "draft", approvalStatus: "pending_approval", content: "review me" };
    const files = tempFiles({
      documents: [
        { slug: "already-published", data: { ...draft, title: "Published" } },
        { slug: "selected-draft", data: { ...draft, title: "Selected" } },
      ],
    });
    const store = fakeFirestore({
      "docs/already-published": { title: "Published", status: "published", approvalStatus: "approved" },
    });
    const result = await runLearningMigration({
      ...files,
      apply: false,
      project: "aresweb-ci",
      phase: "stage-drafts",
      stageSlugs: ["selected-draft"],
    }, { db: store.db });
    expect(result).toMatchObject({ planned: 1, ready: 1, blocked: 0, readySlugs: ["selected-draft"] });

    await expect(runLearningMigration({
      ...files,
      apply: false,
      project: "aresweb-ci",
      phase: "stage-drafts",
      stageSlugs: ["outside-catalog"],
    }, { db: store.db })).rejects.toThrow(/outside the stageable catalog/u);
  });

  it("builds a bounded rollback manifest from hashes and paths", () => {
    const manifest = buildLearningRollbackManifest({
      project: "aresweb-ci",
      phase: "cleanup",
      batchId: "batch",
      backupUri: "emulator://verified-fixture",
    }, [{
      slug: "lesson",
      kind: "update",
      current: { content: "not copied" },
      desired: { isDeleted: 1 },
      changedFields: ["isDeleted"],
    }], "2026-08-25T00:00:00.000Z");
    expect(manifest.entries[0]).toMatchObject({ documentPath: "docs/lesson", changedFields: ["isDeleted"] });
    expect(JSON.stringify(manifest)).not.toContain("not copied");
  });

  it("gates replacements and cross-links through their exact approval files", async () => {
    const replacement = { title: "Reviewed replacement", status: "draft", approvalStatus: "pending_approval", content: "reviewed" };
    const files = tempFiles({
      documents: [{ slug: "replacement", data: replacement }],
      actions: [{
        slug: "replacement",
        catalogSlug: "replacement",
        action: "replace-from-catalog-after-review",
        reason: "stale",
        preconditions: { title: "Old", status: "published", displayInAreslib: 1 },
      }],
      links: [{
        slug: "math-lesson",
        subject: "mathematics-data",
        pathMemberships: [{ pathId: "math-for-robotics", order: 1 }],
        preconditions: { title: "Math", status: "published", displayInMathCorner: 1 },
      }],
    });
    const store = fakeFirestore({
      "docs/replacement": { title: "Old", status: "published", displayInAreslib: 1 },
      "docs/math-lesson": { title: "Math", status: "published", displayInMathCorner: 1 },
    });
    writeApproval(files, "replacements", ["replacement"]);
    const replacementResult = await runLearningMigration({
      ...files,
      apply: false,
      project: "aresweb-ci",
      phase: "replacements",
    }, { db: store.db });
    expect(replacementResult).toMatchObject({ planned: 1, ready: 1, blocked: 0 });

    writeApproval(files, "cross-links", ["math-lesson"]);
    const linkResult = await runLearningMigration({
      ...files,
      apply: false,
      project: "aresweb-ci",
      phase: "cross-links",
    }, { db: store.db });
    expect(linkResult).toMatchObject({ planned: 1, ready: 1, blocked: 0 });

    writeFileSync(files.approvalFile, JSON.stringify({
      version: 1,
      phase: "cross-links",
      reviewedByLabel: "Lead Coach",
      reviewedAt: "2026-08-25",
      reviewDigest: "a".repeat(64),
      approvedSlugs: ["outside-plan"],
    }));
    await expect(runLearningMigration({ ...files, apply: false, project: "aresweb-ci", phase: "cross-links" }, { db: store.db }))
      .rejects.toThrow(/outside the reviewed plan/u);
  });

  it("publishes only approved staged drafts whose reviewed content is unchanged", async () => {
    const draft = { title: "Reviewed lesson", status: "draft", approvalStatus: "pending_approval", content: "reviewed" };
    const files = tempFiles({
      documents: [
        { slug: "new-lesson", data: draft },
        { slug: "published-refresh", data: { ...draft, title: "Published refresh" } },
      ],
      refreshes: [{
        slug: "published-refresh",
        preconditions: { title: "Published refresh", status: "published" },
        contentSha256: createHash("sha256").update("old body").digest("hex"),
      }],
    });
    const approval = writeApproval(files, "publish-drafts", ["new-lesson"]);
    const store = fakeFirestore({
      "docs/new-lesson": {
        ...draft,
        academyMigrationVersion: 2,
        academyMigrationPhase: "stage-drafts",
        academyMigrationBatch: "stage-emulator",
      },
    });
    const result = await runLearningMigration({
      ...files,
      apply: false,
      project: "aresweb-ci",
      phase: "publish-drafts",
    }, { db: store.db });
    expect(result).toMatchObject({ planned: 1, ready: 1, blocked: 0, reviewDigest: approval.reviewDigest });

    const changedArtifact = JSON.parse(readFileSync(files.artifact, "utf8"));
    changedArtifact.documents[0].data.content = "changed after approval";
    writeFileSync(files.artifact, JSON.stringify(changedArtifact));
    await expect(runLearningMigration({
      ...files,
      apply: false,
      project: "aresweb-ci",
      phase: "publish-drafts",
    }, { db: store.db })).rejects.toThrow(/review digest/u);
    changedArtifact.documents[0].data.content = draft.content;
    writeFileSync(files.artifact, JSON.stringify(changedArtifact));

    store.records.set("docs/new-lesson", {
      ...store.records.get("docs/new-lesson"),
      content: "changed after review",
    });
    const changed = await runLearningMigration({
      ...files,
      apply: false,
      project: "aresweb-ci",
      phase: "publish-drafts",
    }, { db: store.db });
    expect(changed).toMatchObject({ planned: 1, ready: 0, blocked: 1, blockedSlugs: ["new-lesson"] });
  });

  it("refreshes approved published lessons only when the old body hash still matches", async () => {
    const oldBody = "# Existing lesson\n\nOld reviewed content.";
    const refreshed = {
      title: "Existing lesson",
      status: "draft",
      approvalStatus: "pending_approval",
      content: "# Existing lesson\n\nARES 11 monorepo content.",
    };
    const files = tempFiles({
      documents: [{ slug: "existing-lesson", data: refreshed }],
      refreshes: [{
        slug: "existing-lesson",
        preconditions: { title: "Existing lesson", status: "published", appliesToVersion: "ARES 10.1.0" },
        contentSha256: createHash("sha256").update(oldBody).digest("hex"),
      }],
    });
    const approval = writeApproval(files, "refresh-published", ["existing-lesson"]);
    const store = fakeFirestore({
      "docs/existing-lesson": {
        title: "Existing lesson",
        status: "published",
        appliesToVersion: "ARES 10.1.0",
        content: oldBody,
      },
    });
    const options = { ...files, apply: false, project: "aresweb-ci", phase: "refresh-published" };
    const ready = await runLearningMigration(options, { db: store.db });
    expect(ready).toMatchObject({ planned: 1, ready: 1, blocked: 0, reviewDigest: approval.reviewDigest });

    store.records.get("docs/existing-lesson").content = `${oldBody}\nCoach edit`;
    const blocked = await runLearningMigration(options, { db: store.db });
    expect(blocked).toMatchObject({ ready: 0, blocked: 1, blockedDetails: [{ slug: "existing-lesson", fields: ["content"] }] });
  });

  it("prepares a content-bound approval template without connecting to Firestore", async () => {
    const draft = { title: "Review me", status: "draft", approvalStatus: "pending_approval", content: "exact body" };
    const files = tempFiles({
      documents: [
        { slug: "review-me", data: draft },
        { slug: "review-too", data: { ...draft, title: "Review too" } },
        { slug: "replacement", data: { ...draft, title: "Replacement" } },
      ],
      actions: [{
        slug: "replacement",
        catalogSlug: "replacement",
        action: "replace-from-catalog-after-review",
        reason: "stale",
        preconditions: { title: "Old", status: "published" },
      }],
    });
    const result = await runLearningMigration({
      ...files,
      apply: false,
      prepareApproval: true,
      approvedSlugs: "review-too, review-me",
      project: "aresweb-ci",
      phase: "publish-drafts",
    });
    expect(result).toMatchObject({
      mode: "approval-template",
      template: {
        version: 1,
        phase: "publish-drafts",
        reviewedByLabel: "",
        reviewedAt: "",
        approvedSlugs: ["review-too", "review-me"],
      },
    });
    expect(result.template.reviewDigest).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("loads a named Admin app and exposes a testable CLI boundary", async () => {
    const first = loadFirebase("aresweb-cli-unit");
    const second = loadFirebase("aresweb-cli-unit");
    expect(first.db).toBe(second.db);

    const files = tempFiles();
    const store = fakeFirestore();
    const output = { log: vi.fn(), error: vi.fn() };
    process.exitCode = 0;
    await main([
      "--project", "aresweb-ci",
      "--phase", "cleanup",
      "--artifact", files.artifact,
      "--legacy-plan", files.legacyPlan,
      "--cross-link-plan", files.crossLinkPlan,
      "--refresh-plan", files.refreshPlan,
    ], { db: store.db }, output);
    expect(output.log).toHaveBeenCalledWith(expect.stringContaining('"mode": "dry-run"'));
    expect(output.error).not.toHaveBeenCalled();

    await main(["--project", "bad", "--phase", "cleanup"], { db: store.db }, output);
    expect(output.error).toHaveBeenCalled();
    process.exitCode = 0;
  });
});
