import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
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

  beforeAll(async () => {
    await validateLearningCatalog({ write: true });
    app = initializeApp({ projectId: project }, `learning-migration-${Date.now()}`);
    db = getFirestore(app);
    directory = mkdtempSync(join(tmpdir(), "ares-learning-emulator-"));
    const fixtures = {
      "e2e-test-quick-start": { title: "Quick Start Guide", category: "Getting Started", displayInAreslib: 1, status: "published", content: "empty test record" },
      "e2e-valid-slug-123": { title: "Test Document", category: "Test", displayInAreslib: 1, status: "published", content: "test record" },
      montyhall: { title: "Monty Hall Problem", displayInAreslib: 1, displayInMathCorner: 1, displayInScienceCorner: 0, status: "published", content: "statistics" },
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
    expect(cleanup).toMatchObject({ planned: 3, ready: 3, blocked: 0, applied: 3, verified: 3 });
    expect((await db.doc("docs/e2e-test-quick-start").get()).data()).toMatchObject({ isDeleted: 1 });
    expect((await db.doc("docs/montyhall").get()).data()).toMatchObject({ displayInAreslib: 0 });
    expect((await db.doc("docs/montyhall/revisions/academy_v1_cleanup_montyhall").get()).exists).toBe(true);
    expect((await db.doc("audit_logs/academy_v1_cleanup_montyhall").get()).data()).not.toHaveProperty("content");

    const stage = await runLearningMigration({
      ...base,
      phase: "stage-drafts",
      batchId: "stage-emulator",
      rollbackManifest: join(directory, "stage.json"),
    }, { db });
    expect(stage).toMatchObject({ planned: 11, ready: 11, blocked: 0, applied: 11, verified: 11 });
    const staged = (await db.doc("docs/ares-workspace-map").get()).data();
    expect(staged).toMatchObject({ status: "draft", approvalStatus: "pending_approval", academyMigrationPhase: "stage-drafts" });
    expect(staged).not.toHaveProperty("reviewedByLabel");
  });
});
