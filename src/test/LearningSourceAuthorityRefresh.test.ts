import { describe, expect, it } from "vitest";
import {
  migrateCurrentSourcePaths,
  parseVersionProperties,
  refreshCatalogText,
  replaceCurrentVersionText,
} from "../../scripts/refresh-learning-source-authority.mjs";

const previous = {
  aresVersion: "11.1.0",
  studioVersion: "2.0.3",
  ftcStarterVersion: "11.1.0",
  frcStarterVersion: "11.1.0",
};

const next = {
  aresVersion: "12.0.0",
  studioVersion: "3.0.0",
  ftcStarterVersion: "12.0.0",
  frcStarterVersion: "12.0.0",
};

describe("learning source-authority refresh", () => {
  it("parses the required release versions while allowing non-version metadata", () => {
    expect(parseVersionProperties(`
      aresVersion=12.0.0
      studioVersion=3.0.0
      ftcStarterVersion=12.0.0
      frcStarterVersion=12.0.0
      githubMavenRepository=https://example.test/maven
    `)).toMatchObject(next);
    expect(() => parseVersionProperties("aresVersion=12.0.0")).toThrow(
      "Missing release version property",
    );
    expect(() => parseVersionProperties("bad line")).toThrow(
      "Invalid release version line",
    );
  });

  it("updates current ARES labels without changing the FTC SDK version", () => {
    expect(replaceCurrentVersionText(
      "ARES 11.1.0, ARES-FTC 11.1.0, Studio 2.0.3, FTC SDK 11.1.0",
      previous,
      next,
    )).toBe("ARES 12.0.0, ARES-FTC 12.0.0, Studio 3.0.0, FTC SDK 11.1.0");
  });

  it("moves retired source references to their current monorepo boundary", () => {
    expect(migrateCurrentSourcePaths([
      "Canonical hardware topology models: ARESLib-Kotlin/core/src/main/kotlin/com/areslib/hardware/TopologyModels.kt",
      "ARES path safety evaluator: ARESLib-Kotlin/core/src/main/kotlin/com/areslib/pathing/PathSafetyEvaluator.kt",
      "ARES-FRC/src/main/kotlin/com/areslib/frc/ARESRobot.kt",
      "ARES-FRC/src/main/kotlin/com/areslib/frc/FrcMechanismCommissioningController.kt",
      "ARES-FRC/src/test/kotlin/com/areslib/frc/ARESRobotTimedBehaviorRegressionTest.kt",
    ].join("\n"))).toBe([
      "Canonical hardware topology wire schema: ARESLib-Kotlin/telemetry-schema/src/main/kotlin/com/areslib/telemetry/schema/HardwareTopology.kt",
      "ARES autonomous path task builder: ARESLib-Kotlin/core/src/main/kotlin/com/areslib/pathing/AutoBuilder.kt",
      "ARES-FRC/src/main/kotlin/org/aresfirst/marvin/ARESRobot.kt",
      "ARES-FRC/src/main/kotlin/org/aresfirst/marvin/FrcMechanismCommissioningController.kt",
      "ARES-FRC/src/test/kotlin/org/aresfirst/marvin/ARESRobotTimedBehaviorRegressionTest.kt",
    ].join("\n"));
  });

  it("refreshes provenance, URLs, revisions, versions, and blob identities", () => {
    const oldCommit = "1".repeat(40);
    const newCommit = "2".repeat(40);
    const newBlob = "3".repeat(40);
    const source = JSON.stringify({
      generatedFrom: {
        sourceRevision: "ares-11.1.0-studio-2.0.3",
        sourceCommit: oldCommit,
        ...previous,
      },
      documents: [{
        description: "Current ARES 11.1.0 and Studio 2.0.3 lesson",
        sourceReferences: [{
          url: `https://github.com/ARES-23247/ARES-Robotics/blob/${oldCommit}/path/file.kt`,
          revision: "ares-11.1.0-studio-2.0.3",
          path: "path/file.kt",
          blobHash: "4".repeat(40),
        }],
      }],
    }, null, 2);
    const refreshed = JSON.parse(refreshCatalogText(source, {
      commit: newCommit,
      revision: "ares-12.0.0-studio-3.0.0",
      versions: next,
    }, new Map([["path/file.kt", newBlob]])));

    expect(refreshed.generatedFrom).toMatchObject({
      sourceCommit: newCommit,
      sourceRevision: "ares-12.0.0-studio-3.0.0",
      ...next,
    });
    expect(refreshed.documents[0].description).toBe(
      "Current ARES 12.0.0 and Studio 3.0.0 lesson",
    );
    expect(refreshed.documents[0].sourceReferences[0]).toMatchObject({
      url: `https://github.com/ARES-23247/ARES-Robotics/blob/${newCommit}/path/file.kt`,
      revision: "ares-12.0.0-studio-3.0.0",
      blobHash: newBlob,
    });
    expect(() => refreshCatalogText(source, {
      commit: newCommit,
      revision: "ares-12.0.0-studio-3.0.0",
      versions: next,
    }, new Map())).toThrow("No Git blob was resolved");
  });
});
