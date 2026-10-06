import { describe, expect, it } from "vitest";
import { migrateCurrentSourcePaths, replaceCurrentVersionText } from "./refresh-learning-source-authority.mjs";

describe("learning source authority refresh", () => {
  it("tracks product versions separately when starter and shared releases diverge", () => {
    const previous = {
      aresVersion: "14.0.0",
      studioVersion: "4.0.0",
      ftcStarterVersion: "14.0.0",
      frcStarterVersion: "14.0.0",
    };
    const next = {
      aresVersion: "14.0.0",
      studioVersion: "4.0.1",
      ftcStarterVersion: "14.0.1",
      frcStarterVersion: "14.0.1",
    };

    expect(
      replaceCurrentVersionText(
        "ARES 14.0.0; ARES FTC 14.0.0; ARES-FRC 14.0.0; Studio 4.0.0",
        previous,
        next,
      ),
    ).toBe(
      "ARES 14.0.0; ARES FTC 14.0.1; ARES-FRC 14.0.1; Studio 4.0.1",
    );
  });

  it("repairs a partially refreshed product version using the shared-version fallback", () => {
    const previous = {
      aresVersion: "14.0.0",
      studioVersion: "4.0.1",
      ftcStarterVersion: "14.0.1",
      frcStarterVersion: "14.0.1",
    };

    expect(
      replaceCurrentVersionText(
        "ARES FTC 14.0.0 and ARES FRC 14.0.0",
        previous,
        previous,
      ),
    ).toBe("ARES FTC 14.0.1 and ARES FRC 14.0.1");
  });

  it("migrates relocated ARES 19 sources exactly once", () => {
    const commit = "a".repeat(40);
    const source = [
      `"path": "RELEASE_TRANSITION.md"`,
      `https://github.com/ARES-23247/ARES-Robotics/blob/${commit}/RELEASE_TRANSITION.md`,
      "ARESLib-Kotlin/core/src/main/kotlin/com/areslib/hardware/actuator/ServoIO.kt",
      "ARESLib-Kotlin/core/src/main/kotlin/com/areslib/hardware/sensor/DistanceSensorIO.kt",
      "ARESLib-Kotlin/core/src/main/kotlin/com/areslib/tuning/TypedTuningConsumer.kt",
      "ARESLib-Kotlin/core/src/main/kotlin/com/areslib/hardware/sensor/MultizoneDistanceSensorIO.kt",
    ].join("\n");
    const expected = [
      `"path": "docs/milestones/RELEASE_TRANSITION.md"`,
      `https://github.com/ARES-23247/ARES-Robotics/blob/${commit}/docs/milestones/RELEASE_TRANSITION.md`,
      "ARESLib-Kotlin/core/src/main/kotlin/com/areslib/hardware/actuator/MotorIO.kt",
      "ARESLib-Kotlin/core/src/main/kotlin/com/areslib/hardware/sensor/MultizoneDistanceSensorIO.kt",
      "ARESLib-Kotlin/core/src/main/kotlin/com/areslib/tuning/TypedTuningRuntime.kt",
      "ARESLib-Kotlin/core/src/main/kotlin/com/areslib/hardware/sensor/MultizoneDistanceSensorIO.kt",
    ].join("\n");
    expect(migrateCurrentSourcePaths(source)).toBe(expected);
    expect(migrateCurrentSourcePaths(expected)).toBe(expected);
  });
});
