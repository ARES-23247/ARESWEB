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
