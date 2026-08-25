# Academy and ARESLib content audit — 2026-08-25

## Scope and evidence

- Audited ARESWEB commit: `ceac0c69` on clean `master` before this branch was created.
- Public inventory queried read-only from `/api/content/docs?library=academy` and `/api/content/docs?library=areslib` on 2026-08-25.
- Canonical robotics evidence: ARESLib release `v9.10.0` at commit `c7af7d2399815ffc3474a89e8dc08adfe31a534c`; clean FTC Starter `master` at commit `c9ab43d75e642031bf110c80004066e8607faf3e`.
- Excluded as documentation authority: active ARESLib/FRC feature branches and the dirty ARES Analytics worktree.
- No production content was changed during this audit.

## Public inventory

Academy exposes 23 published items in Mathematics, Statistics, Science of Climbing, and Science of Outdoor Sports. Those subjects are valuable and should be preserved. The current public set does not yet contain a robotics learning path.

ARESLib exposes seven items:

| Slug | Finding | Severity | Confidence |
| --- | --- | --- | --- |
| `e2e-test-quick-start` | Published empty E2E placeholder | Medium | High |
| `e2e-valid-slug-123` | Published test record | Medium | High |
| `montyhall` | Valid Academy statistics activity incorrectly duplicated into ARESLib | Low | High |
| `areslib-fundamentals` | Describes command/subsystem architecture rather than current Redux and cached-IO architecture | High | High |
| `autonomous-and-vision` | Overstates PathPlanner ownership and vision pose snapping | High | High |
| `telemetry-and-control` | Claims AdvantageKit/AdvantageScope/USB logging instead of current NT4 and local log service | High | High |
| `swerve-and-kinematics` | Presents season-specific SOTM claims as general ARESLib behavior | Medium | High |

Impact: students and mentors can learn incorrect architecture and operational behavior, while public test records reduce trust in the reference library.

Acceptance evidence for remediation:

1. Public ARESLib list contains no E2E/test placeholders and no Monty Hall duplicate.
2. The four preserved URLs render source-pinned replacements matching released ARESLib 9.10.0.
3. Each replacement exposes version, source URL, Git blob hash, platform, level, and safety scope.
4. Academy still renders all 23 existing non-robot items after metadata migration.
5. Robotics Foundations and FTC Starter appear as guided paths only after human review and publication.

## Prepared remediation

- `content/learning/catalog.json` contains 11 Academy curriculum drafts and four ARESLib replacement drafts.
- Every draft points at an exact clean/released commit and a Git blob hash.
- `content/learning/legacy-migration-plan.json` records bounded actions and preconditions.
- `content/learning/existing-content-path-plan.json` proposes metadata-only cross-links for reviewed mathematics and outdoor-STEM lessons. It records that the current public inventory has no Computing & AI lessons rather than inventing that path's content.
- `pnpm run content:validate` validates the catalog without connecting to Firebase.
- `pnpm run content:prepare` writes a draft-only import artifact under `build/`; it does not mutate Firestore.

Production execution remains a separate approval checkpoint.

## Release and migration execution update

The Academy architecture was released through PR #191 and squash-merged as
`248362cf5c9591cec0dbae0173907cfd8fc1760d`. All required pull-request and
post-merge checks passed, including Firebase rules, Playwright, CodeQL,
least-privilege deployment identity, deployed-surface verification, canonical
domain reachability, and the production App Check browser smoke test.

Before any content write, a consistent Firestore export completed successfully
at snapshot time `2026-08-25T13:29:00Z`:

```text
gs://aresfirst-portal-firestore-backups/academy-migration/2026-08-25T132900Z
```

The dedicated backup bucket has uniform bucket-level access, public-access
prevention, Google-managed encryption at rest, a seven-day retention floor, and
seven-day soft delete. The successful export recorded 352 completed documents.

Two bounded, transactional production batches were then applied and re-read:

| Batch | Result |
| --- | --- |
| `academy-cleanup-20260825-01` | Archived `e2e-test-quick-start` and `e2e-valid-slug-123`; preserved `montyhall` in Academy and removed only its ARESLib display flag. |
| `academy-stage-20260825-01` | Created the 11 new catalog documents as non-public `draft` records with `pending_approval`; no existing slug was overwritten. |

Each changed document has a deterministic revision and redacted audit record.
The ignored local rollback manifests contain only document paths and hashes;
restorable content remains in the private Firestore export.

Post-write public smoke evidence:

- Academy remained at 23 published documents.
- ARESLib now exposes four documents, with no test placeholders or Monty Hall
  duplicate.
- The two placeholder URLs return HTTP 404.
- `/academy/montyhall` returns HTTP 200.
- None of the 11 staged drafts appears through the public DTO API.

## Engineering review of staged material

This was an AI-assisted engineering accuracy review, not the required human
coach/mentor publication approval. The review used ARESLib release `v9.10.0`
at `c7af7d2399815ffc3474a89e8dc08adfe31a534c` and FTC Starter commit
`c9ab43d75e642031bf110c80004066e8607faf3e`. `content:verify` recomputed all
13 referenced Git blob hashes and validated 15 documents, seven legacy actions,
15 proposed cross-links, and four populated learning paths.

| Draft group | Documents | Result and representative code evidence |
| --- | ---: | --- |
| Robotics Foundations | 7 | Accurate at the pinned revisions. Repository ownership matches the workspace dependency graph; `AresRobot` reads registered subsystem sensors before writing outputs; `rootReducer`, immutable state, and `RobotClock` are present; NT4 uses port 5810; `LogManagerServer` uses port 5002; pose and heading contracts are CCW-positive. |
| FTC Starter | 4 | Accurate at the pinned starter revision. The project has four mecanum motors and one IMU, empty autonomous/mechanism catalogs, canonical `.ares` inputs, generated output under `TeamCode/build/generated/ares`, small checked-in TeleOp/Auto lifecycle adapters, and a blocked empty autonomous entry. The lessons preserve simulation-versus-hardware and mentor-supervision boundaries. |
| ARESLib reference replacements | 4 | Accurate at release 9.10.0. The ten-module build, Redux/season ownership, PathPlanner and delayed-vision contracts, canonical telemetry topics, offline log service, `.aresdrivetrain` topology, calibration provenance, cached feedback, neutral output, fault latching, and explicit neutral recovery are represented without claiming physical validation. |

No draft fabricates team hardware, student work, calibration evidence, or
physical test results. The active ARESLib and FRC feature branches were not used
as publication authority.

## Remaining approval boundary

The four source-pinned ARESLib replacements and the 15 metadata-only cross-links
remain unapplied. Before either phase can run, a coach or mentor must review the
specific slugs and provide a dated approval manifest as documented in
`docs/ACADEMY_CONTENT_OPERATIONS.md`. The migration runner rejects production
application without that manifest, exact live preconditions, the verified
backup URI, a unique batch ID, and a new rollback-manifest path.
