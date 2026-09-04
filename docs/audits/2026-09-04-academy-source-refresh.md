# Academy source refresh for the audit release

The owner approved this refresh after PR #251's required remote provenance check
reported that the source monorepo had advanced beyond the catalog. This review
compares immutable public commits, not the unrelated dirty monorepo worktree.

- Previous authority: `bf87251aa9bef26105024371ab4bf7696d9e685e`, ARES 15.0.4,
  Studio 5.0.6, FTC/FRC starters 15.0.5.
- New authority: `5d9433ee407b1ae32614659dee0120946830ca72`, ARES 16.0.1,
  Studio 6.0.1, FTC/FRC starters 16.0.1. GitHub `main` matched this commit at review.
- Of 142 unique referenced paths, 132 have unchanged blobs and 10 changed.
  There are 244 references across 68 catalog documents. No referenced path is missing.

## Changed-source review

| Source | Relevant change and lesson treatment |
| --- | --- |
| `.github/workflows/monorepo-ci.yml`, `build.ps1`, `README.md` | Add the Python-native XRP starter and its checks. The workspace map now distinguishes six Gradle products from XRP. Its existing FTC/FRC exercise remains scoped to those platforms. |
| `release/ares-versions.properties` | Update current version text from the immutable manifest; no assumption that historical screenshots were recaptured. |
| `RobotProjectTemplateService.kt` | Separate archive and runtime versions and add XRP league selection. Existing FTC project-identity guidance still describes the validated staging and metadata path. |
| `SubsystemDocument.kt`, `SubsystemValidation.kt` | Add XRP Python factories, hardware and measurement types, and platform-specific validation. Existing FTC/FRC lesson guidance remains valid; new XRP-only capabilities are not presented as FTC/FRC features. |
| `SubsystemHardwareScaffolding.kt`, `SubsystemFtcIoRenderer.kt` | Add XRP-specific connections and measurements and reject XRP-only types in FTC generation. Existing FTC sensor-refresh, unit, and snapshot guidance remains applicable. |
| `SubsystemVerificationContract.kt` | Make behavior checks conditional on declared actuators, feedback, control loops, and homing/current requirements. Update the parity lesson's table, checklist, and exercise instead of retaining the obsolete six-unconditional-check claim. Compile evidence and physical evidence remain distinct. |

Seventeen lessons reference at least one changed source. They cover workspace
ownership, code-first subsystems, parity tests, PID, motion profiles, odometry,
sensor fusion, vision, FTC project identity, subsystem safety, release validation,
wiring, sensors, buses, hardware diagnostics, and the subsystem and physical
commissioning capstones. Unchanged technical source blobs support the remaining
existing guidance; this refresh adds no new curriculum track or hardware claim.

Screenshot labels and captions now explicitly describe archived Studio images.
Their existing `studio-3.1.1` assets and source blob hashes are preserved.

## Review and deployment boundaries

The catalog, source authority, curriculum plan, version text, and review-candidate
digests are refreshed together. The candidate retains `requiresHumanReview: true`
and `mode: review-candidate`; batch membership and production preconditions are
unchanged. This does not approve or execute Academy Firestore publication or
migration. The deployment continues to use the protected website release workflow.

The repository guide now records owner-approved standing permission for future
verified source/version refreshes during requested maintenance or release work.
It preserves sandbox controls, protected CI, and separate production-content review.

Remote provenance verification recomputed all 142 unique Git blob hashes and
verified the current version manifest. Release validation passed for all three
unapproved batches; all 55 content/migration tests passed. Shared agent discovery
and `git diff --check` passed. The exact release commit must also pass the
protected GitHub checks. Logs are under `scratch/audit-fixes-2026-09-04/`.
