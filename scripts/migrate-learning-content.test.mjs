import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildLearningRollbackManifest,
  loadFirebase,
  main,
  parseLearningMigrationArgs,
  planLearningDocument,
  runLearningMigration,
  validateApprovalFile,
} from "./migrate-learning-content.mjs";

const tempDirectories = [];

function tempFiles({ documents = [], actions = [], links = [] } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "ares-learning-migration-"));
  tempDirectories.push(directory);
  const files = {
    artifact: join(directory, "artifact.json"),
    legacyPlan: join(directory, "legacy.json"),
    crossLinkPlan: join(directory, "links.json"),
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
  return files;
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
  });

  it("validates bounded human approval manifests without inventing approval", () => {
    expect(validateApprovalFile({
      version: 1,
      phase: "replacements",
      reviewedByLabel: "Lead Coach",
      reviewedAt: "2026-08-25",
      approvedSlugs: ["areslib-fundamentals"],
    }, "replacements")).toEqual({
      reviewedByLabel: "Lead Coach",
      reviewedAt: "2026-08-25",
      approvedSlugs: ["areslib-fundamentals"],
    });
    expect(() => validateApprovalFile({}, "replacements")).toThrow(/version/u);
    expect(() => validateApprovalFile({ version: 1, phase: "replacements", reviewedByLabel: "", reviewedAt: "today", approvedSlugs: [] }, "replacements")).toThrow(/reviewer/u);
    expect(() => validateApprovalFile({ version: 1, phase: "replacements", reviewedByLabel: "Coach", reviewedAt: "today", approvedSlugs: ["valid"] }, "replacements")).toThrow(/date/u);
    expect(() => validateApprovalFile({ version: 1, phase: "replacements", reviewedByLabel: "Coach", reviewedAt: "2026-08-25", approvedSlugs: ["same", "same"] }, "replacements")).toThrow(/unique/u);
  });

  it("classifies ready, blocked, and idempotently unchanged documents", () => {
    const update = { slug: "lesson", kind: "update", preconditions: { title: "Before" }, desired: { status: "draft" } };
    expect(planLearningDocument(update, snapshot({ title: "Before", status: "published" }), "cleanup")).toMatchObject({ state: "ready", changedFields: ["status"] });
    expect(planLearningDocument(update, snapshot({ title: "Changed" }), "cleanup").state).toBe("blocked");
    expect(planLearningDocument({ slug: "new", kind: "create", preconditions: null, desired: { status: "draft" } }, snapshot(undefined), "stage-drafts").state).toBe("ready");
    expect(planLearningDocument({ slug: "new", kind: "create", preconditions: null, desired: { status: "draft" } }, snapshot({ status: "other" }), "stage-drafts").state).toBe("blocked");
    expect(planLearningDocument(update, snapshot({
      title: "Changed",
      status: "draft",
      academyMigrationVersion: 1,
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
    expect(store.records.get("docs/test-doc/revisions/academy_v1_cleanup_test-doc")).toMatchObject({
      content: "public lesson",
      migrationAction: "pre-migration-snapshot",
    });
    expect(store.records.get("audit_logs/academy_v1_cleanup_test-doc")).not.toHaveProperty("content");
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
    writeFileSync(files.approvalFile, JSON.stringify({
      version: 1,
      phase: "replacements",
      reviewedByLabel: "Lead Coach",
      reviewedAt: "2026-08-25",
      approvedSlugs: ["replacement"],
    }));
    const replacementResult = await runLearningMigration({
      ...files,
      apply: false,
      project: "aresweb-ci",
      phase: "replacements",
    }, { db: store.db });
    expect(replacementResult).toMatchObject({ planned: 1, ready: 1, blocked: 0 });

    writeFileSync(files.approvalFile, JSON.stringify({
      version: 1,
      phase: "cross-links",
      reviewedByLabel: "Lead Coach",
      reviewedAt: "2026-08-25",
      approvedSlugs: ["math-lesson"],
    }));
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
      approvedSlugs: ["outside-plan"],
    }));
    await expect(runLearningMigration({ ...files, apply: false, project: "aresweb-ci", phase: "cross-links" }, { db: store.db }))
      .rejects.toThrow(/outside the reviewed plan/u);
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
    ], { db: store.db }, output);
    expect(output.log).toHaveBeenCalledWith(expect.stringContaining('"mode": "dry-run"'));
    expect(output.error).not.toHaveBeenCalled();

    await main(["--project", "bad", "--phase", "cleanup"], { db: store.db }, output);
    expect(output.error).toHaveBeenCalled();
    process.exitCode = 0;
  });
});
