import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  let stageSlugs;
  let refreshPlanFile;

  beforeAll(async () => {
    const catalog = await validateLearningCatalog({ write: true });
    if (catalog.stageableDocuments < 1) throw new Error("Learning catalog has no stageable documents.");
    const preparedCatalog = JSON.parse(readFileSync(
      new URL("../../build/learning-content-import.json", import.meta.url),
      "utf8",
    ));
    const legacyPlan = JSON.parse(readFileSync(
      new URL("../../content/learning/legacy-migration-plan.json", import.meta.url),
      "utf8",
    ));
    const refreshPlan = JSON.parse(readFileSync(
      new URL("../../content/learning/published-refresh-plan.json", import.meta.url),
      "utf8",
    ));
    const excludedStageSlugs = new Set([
      ...legacyPlan.actions
        .filter((action) => action.action === "replace-from-catalog-after-review")
        .map((action) => action.catalogSlug),
      ...refreshPlan.documents.map((document) => document.slug),
    ]);
    stageSlugs = preparedCatalog.documents
      .map((document) => document.slug)
      .filter((slug) => !excludedStageSlugs.has(slug))
      .slice(0, 25);
    if (stageSlugs.length < 1) throw new Error("Learning catalog has no bounded staging batch.");
    const indicatorDesired = preparedCatalog.documents.find(
      (document) => document.slug === "ftc-gui-owned-indicator-lights",
    )?.data;
    if (!indicatorDesired) throw new Error("Indicator-light lesson is missing from the prepared catalog.");
    const indicatorPreviousContent = `${indicatorDesired.content.trim()}\n\n` +
      "A mentor must approve the real-light check before students may record evidence.\n";
    app = initializeApp({ projectId: project }, `learning-migration-${Date.now()}`);
    db = getFirestore(app);
    directory = mkdtempSync(join(tmpdir(), "ares-learning-emulator-"));
    refreshPlanFile = join(directory, "refresh-plan.json");
    writeFileSync(refreshPlanFile, JSON.stringify({
      planVersion: 1,
      mode: "proposal-only",
      requiresHumanReview: true,
      documents: [{
        slug: "ftc-gui-owned-indicator-lights",
        preconditions: {
          title: indicatorDesired.title,
          status: "published",
          appliesToVersion: indicatorDesired.appliesToVersion,
        },
        contentSha256: createHash("sha256").update(indicatorPreviousContent.trim()).digest("hex"),
      }],
    }));
    const fixtures = {
      "e2e-test-quick-start": { title: "Quick Start Guide", category: "Getting Started", displayInAreslib: 1, status: "published", content: "empty test record" },
      "e2e-valid-slug-123": { title: "Test Document", category: "Test", displayInAreslib: 1, status: "published", content: "test record" },
      montyhall: { title: "Monty Hall Problem", displayInAreslib: 1, displayInMathCorner: 1, displayInScienceCorner: 0, status: "published", content: "statistics" },
      "ftc-intake-io-fault-recovery": { title: "Design an FTC Intake Boundary That Recovers Neutral First", status: "published", isDeleted: 0, content: "retired intake lesson" },
      "ftc-gui-owned-indicator-lights": {
        ...indicatorDesired,
        content: indicatorPreviousContent,
        status: "published",
        approvalStatus: "approved",
      },
    };
    await Promise.all(Object.entries(fixtures).map(([slug, value]) => db.doc(`docs/${slug}`).set(value)));
  });

  afterAll(async () => {
    if (!db || !app || !directory) return;
    await db.recursiveDelete(db.collection("docs"));
    await db.recursiveDelete(db.collection("audit_logs"));
    await deleteApp(app);
    rmSync(directory, { recursive: true, force: true });
  });

  it("applies cleanup and refreshes an already-published lesson without restaging it", async () => {
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
    expect((await db.doc("docs/montyhall/revisions/academy_v3_cleanup_montyhall").get()).exists).toBe(true);
    expect((await db.doc("audit_logs/academy_v3_cleanup_montyhall").get()).data()).not.toHaveProperty("content");

    const stage = await runLearningMigration({
      ...base,
      phase: "stage-drafts",
      stageSlugs,
      batchId: "stage-emulator",
      rollbackManifest: join(directory, "stage.json"),
    }, { db });
    expect(stage).toMatchObject({
      planned: stageSlugs.length,
      ready: stageSlugs.length,
      blocked: 0,
      applied: stageSlugs.length,
      verified: stageSlugs.length,
    });
    const unchangedPublished = (await db.doc("docs/ftc-gui-owned-indicator-lights").get()).data();
    expect(unchangedPublished).toMatchObject({ status: "published", approvalStatus: "approved" });
    expect(unchangedPublished).not.toHaveProperty("academyMigrationPhase");

    const approvalFile = join(directory, "refresh-approval.json");
    const preparedApproval = await runLearningMigration({
      project,
      apply: false,
      prepareApproval: true,
      approvedSlugs: "ftc-gui-owned-indicator-lights",
      phase: "refresh-published",
      refreshPlan: refreshPlanFile,
    });
    writeFileSync(approvalFile, JSON.stringify({
      ...preparedApproval.template,
      reviewedByLabel: "Emulator Coach",
      reviewedAt: "2026-08-25",
    }));
    const refresh = await runLearningMigration({
      ...base,
      phase: "refresh-published",
      refreshPlan: refreshPlanFile,
      approvalFile,
      batchId: "refresh-emulator",
      rollbackManifest: join(directory, "refresh.json"),
    }, { db });
    expect(refresh).toMatchObject({ planned: 1, ready: 1, blocked: 0, applied: 1, verified: 1 });
    const refreshed = (await db.doc("docs/ftc-gui-owned-indicator-lights").get()).data();
    expect(refreshed).toMatchObject({
      status: "published",
      approvalStatus: "approved",
      reviewedByLabel: "Emulator Coach",
      academyMigrationPhase: "refresh-published",
    });
    expect(refreshed.content).toContain("Students may verify the real lights using the team's normal safety procedure");
    expect(refreshed.content).not.toContain("a mentor must");
    expect((await db.doc("audit_logs/academy_v3_refresh-published_ftc-gui-owned-indicator-lights").get()).data()).toMatchObject({
      reviewDigest: preparedApproval.template.reviewDigest,
      reviewedAt: "2026-08-25",
      reviewedByLabel: "Emulator Coach",
    });
  });
});
