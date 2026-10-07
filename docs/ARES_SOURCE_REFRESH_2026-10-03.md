# Academy source refresh during the October 3 release

The required remote provenance check for PR #296 failed because the official ARES-Robotics release line moved from ARES 17.0.9 to ARES 19.1.4 after the catalog was last pinned. Master had the same failure. This refresh uses the standing maintenance approval in AGENTS.md. It changes source files and unapproved review digests only. It does not publish or migrate production documents.

- Previous official source: `7157ba16e415137a154c7d76facdabd2bfa3aa3d`, ARES 17.0.9 / Studio 7.0.10; FTC/FRC starters 17.0.9.
- New official source: [`8294bd6de9663e4f9cecc86dbd6a64acc3ae36ee`](https://github.com/ARES-23247/ARES-Robotics/commit/8294bd6de9663e4f9cecc86dbd6a64acc3ae36ee), ARES 19.1.4 / Studio 7.0.65; FTC/FRC starters 19.1.5. The commit was still the head of `main` when this record was written.
- The source came from the official public repository, cloned in isolation. No unrelated local monorepo edits were used.
- All 140 unique catalog source paths resolve at the new commit, and `content:verify` recomputed every pinned blob hash. Across 51 lessons, 77 referenced files changed and 4 moved. The 4 moves are recorded as exact migrations in `scripts/refresh-learning-source-authority.mjs`, with a unit test that each applies once:
  - `RELEASE_TRANSITION.md` → `docs/milestones/RELEASE_TRANSITION.md`
  - `ServoIO.kt` → `MotorIO.kt`
  - `DistanceSensorIO.kt` → `MultizoneDistanceSensorIO.kt`
  - `TypedTuningConsumer.kt` → `TypedTuningRuntime.kt`

  The moved interfaces are still declared, unchanged, in their new files. Two lessons ended up citing the same file twice, so each pair was merged into one reference with a combined label.

## Lesson corrections

Every affected lesson was reviewed against `git diff` between the two commits. Only claims that became inaccurate were corrected, and only with facts verified at the new commit. Lessons whose only change was the release manifest kept just the automated version text.

- **Kotlin basics:** `InputMath.applyDeadband` now checks the axis and deadband first and returns zero for invalid values. The boundary is now inclusive, and the old denominator guard is gone. The excerpt, trace, diagram, and objectives match.
- **Cached I/O:** `CachedDcMotorEx` now uses a command flag instead of the `-10` sentinel. It clamps power, turns non-finite requests into zero, rejects an invalid epsilon, and clears the cache on mode, direction, and OpMode reset.
- **Redux basics:** `X_BRAKE` now zeroes velocities and clears locks. A joystick intent turns heading hold with no target back into teleop.
- **Feedforward:** the `.ares` drivebase now uses normalized coefficients. The source search names follow the renamed functions.
- **PID evidence:** the header now documents derivative on measurement. Invalid input resets controller state, and anti-windup follows the stored-integral direction.
- **Sensor fusion and vision rejection:** the Store uses camera-reported standard deviations unchanged and scales only values the camera did not report.
- **SysId tuning:** callers now pass a current reading. Missing or invalid current stops the routine, and so does at least 40 A for 200 ms by default. This is still not full physical protection.
- **Typed tuning:** the robot reports the nonce and result together in one acknowledgement.
- **Development and release validation:** normal builds resolve releases through Maven Central and the ARES GitHub Maven repository.
- **FTC Driver Station telemetry:** one latest-snapshot slot replaces the three-entry queue.
- **Driver input frames:** any non-finite axis clears all prior smoothing.
- **FRC mode handoffs:** the Gradle test filter now uses the test's real package, `org.aresfirst.marvin`. This was already wrong at the previous commit.
- **FRC inspection and pit:** the offset procedure includes the new step to update the canonical tuning profile and calibration evidence before rebuilding.

Three code-derived classroom tracers were updated to match their lessons: the deadband function lab, the cached-motor trace, and the driver input curve lab. Each keeps an explicit model-limit note, and its unit tests cover the new branches. No robot or physical-test evidence was invented.

The other reviewed changes are refactors or additions that leave the lessons' narrow claims intact. Examples include moved model types, new validation, new documentation sections, and over-speed braking in `TrapezoidProfile`. Some optional completeness items are left for human review: the newer vision runtime rejection reasons, and the `TuningManager.kt` acknowledgement publisher, which is not cited separately.

Catalog source hashes, version text, curriculum provenance, the affected objectives, and all three bounded review-candidate digests are refreshed together. Existing human-review requirements, batch membership, and historical screenshot identities are preserved. The candidate stays in `review-candidate` mode with `requiresHumanReview: true`.
