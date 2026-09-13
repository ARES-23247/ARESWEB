# ARES 17.0.9 source comparison

Date: 2026-09-12. Source review for the authorized BIOBUZZ calculator release under the
standing ARES reference-refresh approval. This does not approve publication or migration
of production Academy documents.

Compared public Git objects in `ARES-23247/ARES-Robotics` from
`8746da0123eec428872375ee2703750d96724170` to
`7157ba16e415137a154c7d76facdabd2bfa3aa3d`. The latter immutable commit's
`release/ares-versions.properties` declares ARES and FTC/FRC starters 17.0.9,
Studio 7.0.10, and XRP/Lightbot 3.0.9. The comparison contains one commit and
27 changed paths; five intersect the catalog's 142 unique source references.
The isolated source clone comes from the official public repository; no unrelated
local robotics working-tree content is used as release evidence.

| Changed reference | Reviewed behavior and lesson treatment |
| --- | --- |
| `ARES-FTC/TeamCode/build.gradle` | Adds NIO core-library desugaring and Android startup instrumentation. Added the platform-compatibility distinction to subsystem authoring. Existing generator/ownership commands are unchanged. |
| `ARES-FTC/TeamCode/src/main/java/org/firstinspires/ftc/teamcode/opmodes/robot/AresDriveController.kt` | `driveWithGamepad` maps shaped robot-forward/left inputs to field X = negative left, field Y = forward, with blue mirroring. Corrected the driver-input lesson and distinguished the scalar lab and direct field API. The class-level KDoc still describes the old mapping; the executable branch and new `LightbotFieldDriveTest` support the corrected explanation. |
| `ARES-FTC/docs/examples/GUI_OWNED_LIGHTING.md` | Documents independent D-pad previous/next color controls and one change per press. Added these bindings and the explicit-Off distinction; source descriptor ownership and archived screenshot identity are preserved. New `LightbotLightControlsTest` supplies source-level corroboration. |
| `ARESLib-Kotlin/ftc-hardware/src/main/kotlin/com/areslib/ftc/FtcBaseRobot.kt` | Uses consumption time for sample freshness, preserves raw heading when invalidating IMU samples, marks validity explicitly, and retains Pinpoint angular velocity when selected. Added those boundaries to odometry; failover/recovery and physical-calibration guidance remain intact. |
| `release/ares-versions.properties` | Refresh versions, immutable URLs, Git blob hashes, source authority and curriculum-plan provenance together. |

All 142 referenced paths were resolved against the immutable commit; remote
validation independently recomputes their source blob hashes. Current version text
and unapproved release-candidate digests are regenerated together. Human-review
flags, published-document preconditions, and historical screenshots remain intact.
The newly inspected upstream test sources are evidence of their assertions, not a
claim that this website task ran the robotics repository's tests or physical hardware.

Reproduce with `pnpm run content:verify`, `pnpm run content:release-validate`,
and `pnpm run test:content-migration`; the protected CI gate runs those checks
again before merge. Production Academy publication is not part of this release.
