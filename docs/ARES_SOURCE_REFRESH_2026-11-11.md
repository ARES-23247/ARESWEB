# Academy source refresh during PR #336 validation (November 11)

The required remote provenance check (`pnpm run content:verify`) failed on pull request `#336` because the official `ARES-Robotics` `main` branch advanced from ARES 20.0.3 to ARES 20.0.6 after `master` was last refreshed. This refresh uses the standing maintenance approval in `AGENTS.md`. It updates repository source files and unapproved review-candidate digests only; it does not publish or migrate production Academy documents.

- Previous official source: [`e495c305b5250a3b0bb2527ca1b18fe773d0ec48`](https://github.com/ARES-23247/ARES-Robotics/commit/e495c305b5250a3b0bb2527ca1b18fe773d0ec48), ARES 20.0.3 / Studio 7.0.71; FTC/FRC starters 20.0.4.
- New official source: [`b58656596bec2f6e3b44b5470c80108dc647fe1c`](https://github.com/ARES-23247/ARES-Robotics/commit/b58656596bec2f6e3b44b5470c80108dc647fe1c), ARES 20.0.6 / Studio 7.0.73; FTC/FRC starters 20.0.6.
- All release metadata and blob hashes were read directly from the immutable public Git commit `b58656596bec2f6e3b44b5470c80108dc647fe1c` fetched from `https://github.com/ARES-23247/ARES-Robotics.git` (`origin/main`), verified against the GitHub API and raw content endpoints. No local monorepo working-tree edits were used.
- All 140 unique catalog source paths resolve at `b58656596bec2f6e3b44b5470c80108dc647fe1c` with zero missing or relocated paths, and `content:verify` verified every pinned Git blob hash against GitHub.

## Reviewed source changes (`e495c305..b5865659`)

19 of the 140 referenced files changed across the upstream merge (`#114`):

1. `release/ares-versions.properties` — bumps `aresVersion=20.0.6`, `studioVersion=7.0.73`, `ftcStarterVersion=20.0.6`, `frcStarterVersion=20.0.6`, `xrpStarterVersion=3.0.70`, `lightbotExampleVersion=3.0.75`, and `biobuzzExampleVersion=1.1.13`.
2. `ARESLib-Kotlin/core/src/main/kotlin/com/areslib/Store.kt`, `PoseEstimatorRuntime.kt`, and `DriveReducer.kt` — extracts `DEFAULT_STORE_ROOT_REDUCER` and `reduceDriveHardwareUpdate` / `reducePoseUpdate` so 50 Hz drive and pose dispatches on the default root reducer run through a single-pass allocation-free fast path (`reduceDefault`) while preserving identical two-pass Redux and estimator semantics.
3. `ARESLib-Kotlin/core/src/main/kotlin/com/areslib/control/feedback/PIDController.kt` — adds optional dual-bandwidth proportional gain scheduling (`largeErrorKp`, `gainScheduleThreshold`, `configureGainSchedule`), disabled by default (`Double.NaN`), returning neutral and resetting state if gain scheduling is configured with non-finite values or a non-positive threshold.
4. `ARESLib-Kotlin/core/src/main/kotlin/com/areslib/math/estimation/PoseEstimator.kt` and `VisionMahalanobisFilter.kt` — adds optional `observeHeading: Boolean = true` (default `true`; also triggered by `+Infinity` heading std-dev) for 2-DOF planar `(x, y)` vision EKF updates via `PoseEstimatorVision2D.solveKalmanGainAndJosephCovariance` while preserving existing Store MegaTag2 defaults (`1.0e6` heading std-dev and `9.21` 2D NIS threshold).
5. `ARESLib-Kotlin/core/src/main/kotlin/com/areslib/sequencer/RobotSequence.kt` and `TaskExecutor.kt` — adds declarative `.aresroutine`-aligned builder overloads (`together`, `firstToFinish`, `waitSeconds`, `step`, `namedCommand(String)`, state-derived `dispatch`, and block `deadline(main, companions)`), plus `suspendWithActions(state)` and `resumeWithActions(state)` on `TaskExecutor` (built-in task groups still do not forward `pause`/`resume` to nested children).
6. `ARESLib-Kotlin/ftc-hardware/src/main/kotlin/com/areslib/ftc/drivetrain/PinpointIO.kt` and `PinpointIOTest.kt` — validates finite mounting/resolution constructor arguments, marks backward observation timestamps implausible, zeroes cached velocities on read failures and pose resets, and sets `timestampMs = 0L` and `motionMeasurementsValid = false` on untrusted `PoseUpdate` emissions.
7. `ARESLib-Kotlin/ftc-hardware/src/main/kotlin/com/areslib/ftc/telemetry/FtcTelemetryManager.kt` — passes `flush = false` to `publisher.publish(...)` on intermediate frame publishes and defers `estimatedPose` formatting into the existing 250 ms local Driver Station snapshot gate.
8. `ARES-FTC/TeamCode/src/main/java/org/firstinspires/ftc/teamcode/opmodes/AresRobot.kt`, `ARES-FRC/src/main/kotlin/org/aresfirst/marvin/ARESRobot.kt`, and `ARESRobotTimedBehaviorRegressionTest.kt` — registers generated subsystems implementing `TypedTuningConsumer` with `TuningManager`, closes already-created subsystems if partial registration throws, and gates FRC scheme stick drive when Studio remote drive is active.
9. `ARESLib-Kotlin/codegen/src/main/kotlin/com/areslib/codegen/SubsystemFtcIoRenderer.kt`, `SubsystemGeneratedTestRenderer.kt`, and `SubsystemValidation.kt` — tracks `HomeOffsetNative` on homed FTC motors, applies actuator inversion to the generated neutral-output assertion, and adds `SubsystemSchema.formatValidationReport`.
10. `ARES-Analytics/app/src/main/kotlin/com/ares/analytics/service/ReplayEngineService.kt` — stores replay frame timestamps in a primitive `LongArray`, reuses unchanged frame maps across sub-sample playhead steps, and adds `clearSession()` while preserving exact/held/missing replay semantics.

## Bounded lesson corrections

Every lesson citing the 19 changed files was reviewed against `git diff e495c305..b5865659`:

- **`content/learning/controls/05-odometry-calibration.md`:** Noted that Pinpoint jump validation requires non-decreasing sample time and that untrusted packets clear motion-validity flags and emit timestamp `0` alongside retaining the last trusted pose.
- **`content/learning/programming/07-safe-task-sequences.md`:** Noted `suspendWithActions(state)` and `resumeWithActions(state)` for callers collecting the active root task's pause/resume actions while keeping the nested group `pause`/`resume` non-forwarding boundary explicit.
- **`content/learning/controls/03-pid-evidence.md`:** Added optional gain-schedule threshold validity to the zero-return troubleshooting check.
- All other referenced lessons remained accurate and received automated ARES 20.0.6 / Studio 7.0.73 / Starter 20.0.6 version and source-hash updates.

Catalog provenance, lesson version text, `robotics-curriculum-plan.json`, `source-authorities.json`, and all three bounded `release-candidate.json` review digests were refreshed together. Historical screenshot identities, batch membership, and human-review gates (`mode: "review-candidate"`, `requiresHumanReview: true`) are preserved.
