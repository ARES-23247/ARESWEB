# Academy curriculum release-review manifest

Date: 2026-08-31

Candidate branch: `codex/areslib-reference-learning-depth`

Core curriculum implementation baseline: `01582f8a`. The mechanical
source-authority refresh to the release below is part of this review candidate.

Source authority: ARES Robotics
`8b002d539df84ad1407e81fcc8cc5a70bd4456a4`, ARES 13.0.1, Studio 3.1.2

Production project: `aresfirst-portal`

## Release decision boundary

This branch is ready for human review, not automatic publication. It contains
68 prepared learning documents, 90 reviewed interaction placements, 244 pinned
source references, and 20 explicitly tracked evidence gaps. The prepared
records remain drafts with `approvalStatus: pending_approval`.

The exact machine-readable counterpart to this report is
`content/learning/release-candidate.json`. CI regenerates the prepared artifact
and refuses source-authority, slug-partition, refresh-scope, or review-digest
drift before this candidate can be merged.

No approval template in this document is an approval. The displayed digests
only fingerprint the current exact content and slug scopes. A Lead Coach must
review the rendered current candidate and then provide a public reviewer label
and real review date. Production backup, deployment, and every Firestore write
still require the owner's explicit authorization immediately before execution.

Compared with `origin/master` at review time, the candidate changes 184 files
with 19,193 insertions and 3,339 deletions. The curriculum portion is 55 files
with 7,189 insertions and 1,948 deletions. Do not add another content batch
before this candidate is reviewed and released.

## Exact proposed production scopes

### New-draft batch A — construction and ARES programming

Count: 25 (the migration maximum)

Candidate review digest:
`f4e55a3028fead6c7bf847f593b68b0d1bc418ff08d8eda82159bd401da6158a`

- `development-testing-and-release-validation`
- `electrical-battery-protection`
- `electrical-buses-addresses`
- `electrical-hardware-map-diagnostics`
- `electrical-motors-servos`
- `electrical-sensors`
- `electrical-voltage-current-power`
- `electrical-wiring-connectors`
- `frc-mode-handoffs-and-safe-recovery`
- `mechanical-cad-fabrication`
- `mechanical-drivetrains`
- `mechanical-fasteners`
- `mechanical-gears-sprockets-belts`
- `mechanical-measurement-design-notebook`
- `mechanical-mechanisms`
- `mechanical-structure-load-paths`
- `mechanical-tools-safe-work`
- `programming-code-subsystem`
- `programming-io-caching`
- `programming-kotlin-basics`
- `programming-safe-task-sequences`
- `programming-tests-parity`
- `sequencing-and-resources`
- `subsystems-ownership-and-safety`
- `typed-tuning-and-safe-experiments`

### New-draft batch B — controls, testing, competition, and capstones

Count: 21

Candidate review digest:
`f20591249b577c19569cf2d3792182c7b762d7a81ba137787fa6ca06624b255d`

- `capstone-autonomous-mission`
- `capstone-competition-readiness`
- `capstone-physical-commissioning`
- `capstone-simulated-mechanism`
- `capstone-subsystem`
- `competition-drive-team`
- `competition-frc-inspection-pit`
- `competition-ftc-inspection-pit`
- `competition-post-match`
- `competition-scouting`
- `competition-strategy`
- `controls-motion-profiles`
- `controls-motor-model-feedforward`
- `controls-odometry`
- `controls-pid`
- `controls-sensor-fusion`
- `controls-vision`
- `ftc-driver-station-telemetry`
- `testing-fault-tree`
- `testing-logs-replay`
- `testing-sysid-tuning`

### Guarded published refresh

Count: 22 (one bounded phase)

Candidate review digest:
`a63678bc03b93228b5abcdf634ff39ca7d62d22651a0719a683a8cdfd1940143`

- `ares-workspace-map`
- `areslib-fundamentals`
- `autonomous-and-vision`
- `camera-evidence-and-uncertainty`
- `ftc-driver-input-shaping-and-frames`
- `ftc-gui-owned-indicator-lights`
- `ftc-season-composition-and-safe-lifecycle`
- `ftc-starter-controller-bindings`
- `ftc-starter-first-autonomous`
- `ftc-starter-physical-commissioning`
- `ftc-starter-project-identity`
- `measure-test-and-improve`
- `rates-units-and-motion`
- `read-a-telemetry-graph`
- `redux-state-actions-reducers`
- `robot-coordinate-contracts`
- `robot-input-to-output`
- `run-first-ftc-simulation`
- `simulation-is-not-hardware-validation`
- `swerve-and-kinematics`
- `telemetry-and-control`
- `telemetry-and-local-logs`

Every refresh retains the exact current production title, publication state,
old version, and normalized Markdown hash as a precondition. A mismatch blocks
that record rather than overwriting a newer edit.

### Cleanup dry-run scope

Count: 4

- `e2e-test-quick-start`
- `e2e-valid-slug-123`
- `ftc-intake-io-fault-recovery`
- `montyhall`

The first production action is a read-only cleanup dry run. Some of these may
already be unchanged from an earlier release. Apply only the exact remaining
ready actions after reviewing that output and obtaining fresh authorization.

## Phases deliberately excluded from this release

- Do not rerun `replacements` by default. The prior controlled launch records
  all four historical ARESLib replacements as complete. Those same four slugs
  now appear in the 22-document guarded refresh with their current titles and
  content hashes. The old replacement preconditions intentionally describe the
  pre-replacement pages and are not the right path for this update.
- Do not rerun `cross-links` by default. The prior controlled launch records all
  15 metadata proposals as complete, and
  `existing-content-path-plan.json` has not changed since commit `de4e0faf`.
- If a read-only production audit contradicts either completion record, stop
  and prepare a separate repair proposal. Do not broaden this release ad hoc.

## Evidence gaps during review

Nineteen tracked requests remain `missing` and one remains `partial`. They ask
for approved team media, future-season FIRST material, physical student
evidence, current product screenshots, or team-process review. Their presence
does not authorize invented examples or unsupported claims. A lesson may be
approved only if its present diagram/text alternative is truthful and the open
request remains visible in the editorial register. Human review may defer any
slug without blocking the rest of its batch; regenerate a smaller digest for
the exact approved subset.

## Review and release order

1. Freeze curriculum changes at the candidate baseline. Re-run
   `content:validate`, `content:readability`, `content:verify`, and the complete
   ARESWEB gate.
2. Review the application diff and all rendered lessons. Reviewers must check
   age suitability, student authority, safety boundaries, image provenance,
   keyboard/touch behavior, narrow-screen layout, and the evidence limitation
   stated by every interaction.
3. Regenerate `build/learning-content-import.json`. Regenerate the three exact
   approval templates above; any digest change invalidates this manifest's
   fingerprints and requires another review.
4. Merge and deploy the application code first. New interaction registry and
   renderer support must be live before documents containing those tags can be
   published. Verify public Academy and ARESLib routes before touching data.
5. Create and verify a protected Firestore export. Record its exact `gs://` URI
   and retention controls outside the repository.
6. Run read-only production dry runs for cleanup, new-draft batch A, new-draft
   batch B, and the 22-document refresh. Stop on every blocked precondition.
7. Obtain explicit production-write authorization. Stage only the reviewed new
   slugs in two batches, using fresh batch IDs and unused rollback manifests.
8. Re-read the staged drafts through the protected editor preview. Complete the
   exact Lead Coach approval files only after that review.
9. Publish batch A and batch B separately. Verify each batch before starting the
   next one. Then apply the separately reviewed 22-document refresh.
10. Apply only cleanup actions that remain ready in the reviewed dry run.
11. Verify document and revision counts, audit records, public DTO
    minimization, search/filter behavior, path ordering, previous/next links,
    local no-login progress, responsive images, interactions, and 320 px mobile
    reflow. Confirm internal migration fields do not appear in public DTOs.
12. Keep the backup, rollback manifests, prior deployment revision, and branch
    until the verification window closes. Branch cleanup is a separate final
    action after production is proven healthy.

## Rollback checkpoints

- Application rollback: retain the prior Hosting and Functions revisions. If
  code verification fails, roll back before any curriculum write.
- Data rollback: every applied phase must use a distinct ignored rollback
  manifest and the same verified backup URI. Never reuse a batch ID or manifest.
- Partial failure: stop after the current transaction. Do not continue to the
  next phase. Re-read affected records and dry-run the matching rollback plan.
- Approval rollback: content edits after review invalidate the digest. Generate
  a new template and repeat review; never edit a digest by hand.

## Validation already completed for this candidate

- 68 catalog documents, 14 populated paths, and 20 tracked evidence gaps;
- 244 exact source references and 142 recomputed Git blob hashes;
- average estimated reading grade 6.9, with no lesson over 8.9;
- 90 reviewed interaction placements within aggregate and per-interaction
  bundle budgets;
- 1,090 frontend tests, 807 Functions tests, and 31 Firebase rules tests;
- 151 Playwright tests across Chromium, mobile Chromium, mobile WebKit,
  Firefox, WebKit, and the production PWA path;
- lint, TypeScript, Functions build, production build, prerendering, and
  dependency audit; and
- exact local approval-template generation for both new-draft batches and the
  guarded refresh.

The remote-version guard caught the coordinated ARES 13.0.1 / Studio 3.1.2
release during this review. The candidate was refreshed to its exact main
commit, all 142 referenced paths resolved there, and the three review digests
were regenerated. This is the intended maintenance loop; it is not a reason to
resume broad lesson expansion.

No production data was read or changed while preparing this manifest. Nothing
was pushed, merged, deployed, staged, approved, or published.
