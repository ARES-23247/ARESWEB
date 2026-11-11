# Academy source refresh during the November 10 Championship rollout

The required remote provenance check (`pnpm run content:verify`) failed on pull requests `#329`–`#331` because the official `ARES-Robotics` `main` branch advanced from ARES 19.1.4 to ARES 20.0.3 after the catalog was last pinned. `master` had the same upstream drift. This refresh uses the standing maintenance approval in `AGENTS.md`. It updates repository source files and unapproved review-candidate digests only; it does not publish or migrate production Academy documents.

- Previous official source: `8294bd6de9663e4f9cecc86dbd6a64acc3ae36ee`, ARES 19.1.4 / Studio 7.0.65; FTC/FRC starters 19.1.5.
- New official source: [`e495c305b5250a3b0bb2527ca1b18fe773d0ec48`](https://github.com/ARES-23247/ARES-Robotics/commit/e495c305b5250a3b0bb2527ca1b18fe773d0ec48), ARES 20.0.3 / Studio 7.0.71; FTC/FRC starters 20.0.4.
- The source was obtained from an isolated clone of the official public `ARES-23247/ARES-Robotics` repository. No unrelated local monorepo edits were used.
- All 140 unique catalog source paths resolve at `e495c305b5250a3b0bb2527ca1b18fe773d0ec48` with zero missing or relocated paths, and `content:verify` verified every pinned Git blob hash against GitHub.

## Reviewed source changes

Only 7 of the 140 referenced files changed between `8294bd6d` and `e495c305`:

1. `release/ares-versions.properties` — bumps `aresVersion=20.0.3`, `studioVersion=7.0.71`, `ftcStarterVersion=20.0.4`, `frcStarterVersion=20.0.4`, `xrpStarterVersion=3.0.68`, `lightbotExampleVersion=3.0.73`, and `biobuzzExampleVersion=1.1.11`.
2. `ARES-FTC-Starter/README.md` — documents the FTC SDK 12.0, Gradle 9.1, and AGP 8.13.2 baseline (plus D8/R8 9.1.29 for Kotlin 2.4 metadata) and notes that SDK 12 distinguishes stationary singleton AprilTags from moving BIOBUZZ tag clusters (defaulting VisionPortal to targeting-only unless stationary tag IDs and camera mounting are reviewed).
3. `ARES-FRC/docs/OPERATIONS.md` — updates the documented Kotlin version from `2.4.10` to `2.4.21` (Java 17 target unchanged). No Academy lesson cited the patch number directly.
4. `ARESLib-Kotlin/ftc-hardware/src/main/kotlin/com/areslib/ftc/hardware/CachedHardware.kt` and `5. CachedHardwareContractTest.kt` — switches `CachedDcMotorEx` and `CachedServo` from Kotlin property overrides (`override var power` / `mode` / `direction` / `position`) to explicit SDK accessor methods (`override fun getPower()` / `setPower(...)`, `getMode()` / `setMode(...)`, `getDirection()` / `setDirection(...)`, `getPosition()` / `setPosition(...)`) while preserving identical caching, clamping, non-finite handling, hard-stop zero, and epsilon rules; `CachedServo` also invalidates its command cache on `setDirection` and `scaleRange` before delegation (covered by two new tests in `CachedHardwareContractTest`).
6. `ARESLib-Kotlin/codegen/src/main/kotlin/com/areslib/codegen/SubsystemGeneratedTestRenderer.kt` — refreshes `io.refresh()` and copies `io.feedbackTimestampMs` into `state` at each `RobotClock.useMockTime(...)` step in the generated homing-dwell mock test.
7. `.github/workflows/monorepo-ci.yml` — runs headless Studio consumer round-trip checks under `xvfb-run -a` and retains Studio unit test reports alongside consumer round-trip evidence.

## Bounded lesson corrections

Every lesson citing the 7 changed files was reviewed against `git diff 8294bd6d..e495c305`:

- **`content/learning/programming/04-cached-io.md`:** Updated the `CachedDcMotorEx` getter/setter snippets and `rg` search pattern from `override var power` (`get()` / `set(value)`) to `override fun getPower()` and `override fun setPower(value: Double)`, and noted in the `CachedServo` extension challenge that direction and range changes also clear the servo command cache. The seven-step motor trace and `<loopcachelab />` behavior remain unchanged.
- **`content/learning/controls/05-odometry-calibration.md` & `content/learning/programming/08-tests-parity.md`:** Updated the explicit `FTC SDK 11.1.0` version text to `FTC SDK 12.0.0` alongside the refreshed ARES 20.0.3 and Studio 7.0.71 version strings.
- All other referenced lessons remained accurate and received only automated ARES / Studio / Starter version and source-hash updates.

Catalog provenance, lesson version text, `robotics-curriculum-plan.json`, `source-authorities.json`, and all three bounded `release-candidate.json` review digests were refreshed together. Historical screenshot identities, batch membership, and human-review gates (`mode: "review-candidate"`, `requiresHumanReview: true`) are preserved.
