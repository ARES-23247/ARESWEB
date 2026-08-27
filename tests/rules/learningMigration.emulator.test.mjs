import { createRequire } from "node:module";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runLearningMigration } from "../../scripts/migrate-learning-content.mjs";
import { validateLearningCatalog } from "../../scripts/validate-learning-catalog.mjs";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const project = "aresweb-learning-migration-ci";
const requireFromFunctions = createRequire(new URL("../../functions/package.json", import.meta.url));
const { deleteApp, initializeApp } = requireFromFunctions("firebase-admin/app");
const { getFirestore } = requireFromFunctions("firebase-admin/firestore");

describe.skipIf(!emulatorHost)("learning migration (Firestore emulator)", () => {
  let app;
  let db;
  let directory;
  let stageableDocuments;

  beforeAll(async () => {
    const catalog = await validateLearningCatalog({ write: true });
    stageableDocuments = catalog.stageableDocuments;
    app = initializeApp({ projectId: project }, `learning-migration-${Date.now()}`);
    db = getFirestore(app);
    directory = mkdtempSync(join(tmpdir(), "ares-learning-emulator-"));
    const fixtures = {
      "e2e-test-quick-start": { title: "Quick Start Guide", category: "Getting Started", displayInAreslib: 1, status: "published", content: "empty test record" },
      "e2e-valid-slug-123": { title: "Test Document", category: "Test", displayInAreslib: 1, status: "published", content: "test record" },
      montyhall: { title: "Monty Hall Problem", displayInAreslib: 1, displayInMathCorner: 1, displayInScienceCorner: 0, status: "published", content: "statistics" },
      "ftc-intake-io-fault-recovery": { title: "Design an FTC Intake Boundary That Recovers Neutral First", status: "published", isDeleted: 0, content: "retired intake lesson" },
    };
    await Promise.all(Object.entries(fixtures).map(([slug, value]) => db.doc(`docs/${slug}`).set(value)));
  });

  afterAll(async () => {
    await db.recursiveDelete(db.collection("docs"));
    await db.recursiveDelete(db.collection("audit_logs"));
    await deleteApp(app);
    rmSync(directory, { recursive: true, force: true });
  });

  it("applies and verifies cleanup, then stages only new pending drafts", async () => {
    const base = {
      project,
      apply: true,
      backupUri: "emulator://verified-fixture",
    };
    const cleanup = await runLearningMigration({
      ...base,
      phase: "cleanup",
      batchId: "cleanup-emulator",
      rollbackManifest: join(directory, "cleanup.json"),
    }, { db });
    expect(cleanup).toMatchObject({ planned: 4, ready: 4, blocked: 0, applied: 4, verified: 4 });
    expect((await db.doc("docs/e2e-test-quick-start").get()).data()).toMatchObject({ isDeleted: 1 });
    expect((await db.doc("docs/montyhall").get()).data()).toMatchObject({ displayInAreslib: 0 });
    expect((await db.doc("docs/ftc-intake-io-fault-recovery").get()).data()).toMatchObject({ isDeleted: 1 });
    expect((await db.doc("docs/montyhall/revisions/academy_v1_cleanup_montyhall").get()).exists).toBe(true);
    expect((await db.doc("audit_logs/academy_v1_cleanup_montyhall").get()).data()).not.toHaveProperty("content");

    const stage = await runLearningMigration({
      ...base,
      phase: "stage-drafts",
      batchId: "stage-emulator",
      rollbackManifest: join(directory, "stage.json"),
    }, { db });
    expect(stage).toMatchObject({
      planned: stageableDocuments,
      ready: stageableDocuments,
      blocked: 0,
      applied: stageableDocuments,
      verified: stageableDocuments,
    });
    const staged = (await db.doc("docs/ftc-gui-owned-indicator-lights").get()).data();
    expect(staged).toMatchObject({ status: "draft", approvalStatus: "pending_approval", academyMigrationPhase: "stage-drafts" });
    expect(staged).not.toHaveProperty("reviewedByLabel");

    const approvalFile = join(directory, "publish-approval.json");
    const preparedApproval = await runLearningMigration({
      project,
      apply: false,
      prepareApproval: true,
      approvedSlugs: "ftc-gui-owned-indicator-lights",
      phase: "publish-drafts",
    });
    writeFileSync(approvalFile, JSON.stringify({
      ...preparedApproval.template,
      reviewedByLabel: "Emulator Coach",
      reviewedAt: "2026-08-25",
    }));
    const publish = await runLearningMigration({
      ...base,
      phase: "publish-drafts",
      approvalFile,
      batchId: "publish-emulator",
      rollbackManifest: join(directory, "publish.json"),
    }, { db });
    expect(publish).toMatchObject({ planned: 1, ready: 1, blocked: 0, applied: 1, verified: 1 });
    expect((await db.doc("docs/ftc-gui-owned-indicator-lights").get()).data()).toMatchObject({
      status: "published",
      approvalStatus: "approved",
      reviewedByLabel: "Emulator Coach",
      academyMigrationPhase: "publish-drafts",
    });
    expect((await db.doc("audit_logs/academy_v1_publish-drafts_ftc-gui-owned-indicator-lights").get()).data()).toMatchObject({
      reviewDigest: preparedApproval.template.reviewDigest,
      reviewedAt: "2026-08-25",
      reviewedByLabel: "Emulator Coach",
    });
  });
});
