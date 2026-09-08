# ARES 17.0.2 source comparison

Date: 2026-09-08. This records an agent source comparison, not approval to publish Academy content.

The CI source gate detected that the official release advanced beyond the catalog. The comparison
uses only public Git objects from `ARES-23247/ARES-Robotics`, from
`0975b30e65f20998030eb091c8cd82142feb7fb9` to
`8746da0123eec428872375ee2703750d96724170`. The latter commit's
`release/ares-versions.properties` declares ARES and FTC/FRC starters 17.0.2, Studio 7.0.3,
and XRP/Lightbot 3.0.2. No unrelated local robotics edits were used.

Nine of the catalog's 142 unique referenced source paths changed:

| Referenced source | Reviewed change and curriculum treatment |
| --- | --- |
| `.github/workflows/monorepo-ci.yml` | Shared scope resolver, selected Studio modules, and final result check. Clarified scoped CI in the development reference. |
| `README.md` | Affected product/consumer CI selection and conditional packaging. Existing ownership guidance remains accurate. |
| `release/ares-versions.properties` | Updated versions and immutable provenance together. |
| `ARESLib-Kotlin/core/src/main/kotlin/com/areslib/control/feedback/PIDController.kt` | Continuous-input derivative wraps measurement changes; added that distinction to the PID lesson. |
| `ARESLib-Kotlin/core/src/main/kotlin/com/areslib/math/InputMath.kt` | Joystick-vector invalid-input handling is stricter. The Kotlin lesson teaches the unchanged `applyDeadband` function, so its worked example is preserved. |
| `ARESLib-Kotlin/core/src/main/kotlin/com/areslib/math/estimation/PoseEstimator.kt` | History copying visits active slots and preserves the last accepted vision timestamp. Existing immutable-state/history ownership guidance remains accurate. |
| `ARESLib-Kotlin/core/src/main/kotlin/com/areslib/math/estimation/VisionMahalanobisFilter.kt` | Rejects older accepted-vision capture order and non-finite values; computes NIS with Cholesky whitening before inversion. Updated vision/fusion timing limits and rejection meanings. |
| `ARESLib-Kotlin/docs/math-and-coordinate-contracts.md` | Documents capture ordering, continuous PID, wheel/odometry constraints, and sampled trajectory limits. Added the sampled-jerk boundary to the motion-profile lesson. |
| `ARESLib-Kotlin/ftc-hardware/src/main/kotlin/com/areslib/ftc/calibration/FtcMecanumCalibrationController.kt` | Track-width payload includes wheelbase; linear payload records encoder ticks. Added the payload distinction to the SysId lesson. |

Catalog pins and blob hashes, current source authority, version text, curriculum plan, and
unapproved release-candidate digests are refreshed together. Existing screenshot identities,
published-content preconditions, and human-review requirements are preserved. This change does
not publish or migrate production Academy documents.

Reproduce the source verification with `pnpm run content:verify` and validate candidate digests
with `pnpm run content:release-validate`. The source-refresh script reads the immutable commit
from a clone of the official repository; remote verification independently checks source bytes.
