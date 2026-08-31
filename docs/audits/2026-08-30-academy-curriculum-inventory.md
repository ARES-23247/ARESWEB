# ARES Academy curriculum inventory and continuation decision

Date: 2026-08-30

ARESWEB branch: `codex/areslib-reference-learning-depth`

Audited ARESWEB commit: `0c59494fe407c11c2f190217ddc881c73bf78fcb`

ARESWEB worktree: three in-progress simulator-lesson files plus this report

Previous curriculum authority: ARES Robotics `f02737aed343241f702b386e12f10bb3f158ec65`

Current fetched authority: ARES Robotics `099e5188f35c639d49e78a3c80309841e91920fa`

Validation runtime: Node 24.18.0, pnpm 11.21.0, Java 21.0.12

## Decision

Continuing is worthwhile, but additional broad lesson creation is not the best
next use of effort. The curriculum already has enough breadth for a complete
beginner-to-advanced robotics program. The next release should be a bounded
stabilization and media-curation release, followed by maintenance triggered by
ARES releases or reviewed team evidence.

Do not add another general robotics track before this branch is reviewed and
released. The strongest remaining work is:

1. refresh every catalog authority and version statement to ARES 13.0.0 and
   Studio 3.1.1 at commit `099e5188`;
2. privacy-review the seven authentic Studio 3.1.1 screenshots and place only
   the five safe artifacts into the existing simulator, subsystem, autonomous,
   field, and run-review lessons with useful alt text and captions;
3. reconcile the 20 tracked evidence gaps, closing only those supported by
   current official sources or user-approved team artifacts;
4. complete the in-progress simulator evidence correction, run the full gate,
   and release the current branch before starting another content batch; and
5. switch from continuous expansion to periodic accuracy, usability, and
   source-drift review.

## Current inventory

| Measure | Current evidence |
| --- | ---: |
| Catalog documents | 68 |
| Beginner / intermediate / advanced | 22 / 35 / 11 |
| Guided labs / lessons / tutorials / references | 54 / 4 / 2 / 8 |
| Populated learning paths | 14 |
| Planned robotics tracks | 7 |
| Planned robotics lesson identities | 50 |
| Estimated learning time | 5,310 minutes (88.5 hours) |
| Markdown words | about 97,000 |
| Pinned source references | 244 across all 68 documents |
| Reviewed interaction embeds | 90, using 49 distinct interactions |
| Documents with Mermaid diagrams | 68 |
| Authentic image embeds | 6 placements using 5 unique images (up from 0 at inventory start) |
| Tracked evidence/source gaps | 20: 19 missing, 1 partially supported |
| Current branch delta from `origin/master` | 70 commits; 162 files; +17,359 / -3,198 lines |

The reading-level check reports an estimated average grade of 6.9. No lesson is
above grade 8.9. One FRC inspection lesson is grade 8.3, which is inside the
requested 6th-8th-grade target after allowing for unavoidable technical terms,
but it remains a useful manual-review candidate.

All 68 documents have at least one bounded source reference. Path coverage is
substantial: Robotics Foundations has 7 lessons, FTC has 9, FRC has 12,
Programming has 10, Controls has 12, Mechanical has 8, Electrical has 7,
Competition Operations has 6, Capstones has 5, and the ARESLib reference has 8.

## What is already strong

- Search and filter state covers text, subject, level, content type, path,
  platform, topic, duration, and local progress in
  `src/lib/learningExperience.ts:19-101`.
- Path ordering, prerequisite status, related lessons, and previous/next lesson
  navigation are implemented in `src/lib/learningExperience.ts:108-240` and
  rendered in `src/app/academy/page.tsx:505-635`.
- No-login progress is explicit and truthful, including the browser-storage
  fallback, in `src/app/academy/page.tsx:505-527`.
- The website-post approval boundary includes an exact saved-version preview in
  `src/components/dashboard/DocumentApprovalReviewDialog.tsx:64-96`.
- The catalog validator requires source provenance and enforces student-led
  robot verification language in
  `scripts/validate-learning-catalog.mjs:289-295,527-537`.
- Every current lesson has a Mermaid visual model and an interactive activity is
  embedded where the instructional contract calls for one.

## Confirmed findings

### ACAD-INV-01 — Current source authority is stale

- Severity: high for release readiness
- Confidence: high
- Evidence: `content/learning/catalog.json:4-9` declares Studio 3.1.0 and ARES
  commit `f02737ae`. `pnpm run content:verify` failed because current ARES main
  declares Studio 3.1.1. A fresh fetch resolves main to `099e5188`.
- Impact: the source-drift gate correctly blocks release. Continuing to add
  lessons on the older authority would multiply refresh work and could preserve
  stale Studio behavior or screenshots.
- Remediation: run the guarded source-authority refresh against `099e5188`, then
  manually review the three-commit product diff and every changed lesson.
- Acceptance test: `pnpm run content:validate`, `pnpm run content:readability`,
  and `pnpm run content:verify` all pass against ARES main 3.1.1.

### ACAD-INV-02 — Authentic visual media is the largest instructional gap

- Severity: medium
- Confidence: high
- Evidence: all 68 lesson files contain a Mermaid block, but the inventory found
  zero Markdown or HTML image embeds. Nine open requests explicitly need
  authentic media in `content/learning/curriculum-source-requests.json:5-15,21-22`.
  ARES Studio 3.1.1 now provides seven source-owned screenshots under
  `ARES-Analytics/docs/media/3.1.1/`.
- Impact: students receive strong text, diagrams, and conceptual interactions,
  but few concrete views of the actual tools they must use. More prose has lower
  value than showing the real workflow.
- Remediation: inspect the seven screenshots for PII, credentials, private
  paths, and truthful state; then reuse them in existing lessons with concise
  captions and task-focused alternative text. Do not fabricate team hardware
  photos or annotations.
- Acceptance test: the selected lessons render responsive images at 320 px and
  200% zoom, retain useful text alternatives, disclose what each screenshot
  does and does not prove, and pass the content and browser suites.

### ACAD-INV-03 — Twenty gaps require evidence, not autonomous invention

- Severity: medium
- Confidence: high
- Evidence: the machine-readable plan and request register contain 20 matching
  gaps. They include nine authentic-media needs, five official-reference needs,
  two team-process reviews, three mixed needs, and one physical-evidence need.
- Impact: an unrestricted content loop is now more likely to add unsupported
  claims or substitute generic examples for real team evidence.
- Remediation: classify each request as newly fulfillable, still externally
  blocked, or no longer needed. Preserve the two 2027 inspection requests until
  FIRST publishes the season checklists. Ask the team for artifacts only when a
  request cannot be satisfied from reviewed public sources.
- Acceptance test: every request has a dated status and evidence link; closed
  requests point to the exact lesson and artifact; blocked requests retain their
  reason without placeholder content.

### ACAD-INV-04 — The unreleased branch is already too large for more expansion

- Severity: high for change-management risk
- Confidence: high
- Evidence: `git rev-list --count origin/master..HEAD` reports 70 commits, and
  `git diff --shortstat origin/master...HEAD` reports 162 files changed with
  17,359 insertions and 3,198 deletions.
- Impact: another broad curriculum batch would make review, rollback, migration,
  and regression attribution harder. Green tests do not replace human review of
  nearly 100,000 words or student-facing instructional judgment.
- Remediation: stop scope growth, finish the source refresh and media curation as
  one bounded release, review the branch, and use the normal migration and
  deployment approval process.
- Acceptance test: the release diff is reviewed, the complete ARESWEB gate
  passes, the branch is pushed only with explicit approval, and production data
  changes remain separately guarded.

### ACAD-INV-05 — First-simulation interaction crossed the stated boundary

- Severity: medium
- Confidence: high
- Evidence: committed
  `content/learning/robotics-foundations/03-first-ftc-simulation.md` embedded the
  physical `commissioningchecklistlab` even though the lesson keeps Live Robot
  unselected. The current working-tree correction uses the existing
  `evidencelevelscenarios` interaction and adds the current FTC simulator owner
  and five evidence checkpoints.
- Impact: the old interaction could make a beginner think a simulator exercise
  should advance toward physical motion rather than stop at a bounded simulator
  claim.
- Remediation: keep the simulator-only evidence interaction and validate it in
  all configured desktop/mobile browser projects.
- Acceptance test: the focused 320 px Academy test completes all three evidence
  scenarios, reports 3/3 supported, states the model limit, and has no horizontal
  overflow.

## Commands and evidence executed

- catalog/path/source/media inventory through PowerShell and checked-in JSON;
- `git fetch origin --prune` in the ARES monorepo;
- `git diff f02737ae..099e5188` for the authority change;
- `pnpm run content:validate` — passed after gap reconciliation: 68 documents,
  90 interaction embeds, 244 references;
- `pnpm run content:readability` — passed: average grade 6.9, no lesson above 8.9;
- inventory-time `pnpm run content:verify` — failed as designed on Studio 3.1.0
  versus 3.1.1;
- post-refresh `pnpm run content:verify` — passed: 142 unique remote blobs and
  all 243 references verified at ARES `099e5188`, Studio 3.1.1;
- focused Vitest — passed: 25 renderer-security and catalog-validator tests;
- focused Playwright — passed in Chromium, Firefox, WebKit, mobile Chromium,
  and mobile WebKit at 320 px, including the authentic image and bounded
  simulator evidence interaction;
- branch/worktree/runtime inventory and `git diff --check`.

The complete ARESWEB gate passed after stabilization: agent configuration,
route security, Functions lock validation, frontend and Functions lint,
TypeScript, 1,082 frontend tests, 807 Functions tests, 31 Firebase rules tests,
production build, bundle budgets, 151 Playwright tests across the configured
desktop/mobile projects, and the production dependency audit. No curriculum
data was migrated, and nothing was pushed or deployed.

## Stabilization outcome

The inventory recommendation was applied in the current worktree without
expanding curriculum scope:

- catalog and lesson authorities now point to immutable ARES commit `099e5188`
  and Studio 3.1.1;
- five exact source-owned Studio screenshots were retained; `simulator.png` and
  `controller-mapping.png` were excluded because they visibly expose a local
  Windows user path;
- the five retained images have upstream Git-blob provenance, task-focused alt
  text, captions that state their evidence limits, and responsive browser
  coverage;
- the validator now rejects missing local Academy image files, empty or weak
  alt text, path traversal, and images outside the bounded public Academy
  directory; and
- the renderer's sanitization schema now preserves safe image alt text. The
  focused browser test exposed this pre-existing omission before release.

The 20 tracked evidence gaps remain open unless their exact acceptance criteria
are met. The five screenshots strengthen existing lessons but do not justify
closing requests for physical team photographs, future-season FIRST material,
or human-reviewed team procedures.

## Evidence-gap review

Every open request now has a dated, machine-validated review that distinguishes
missing evidence from partial support and identifies the remaining blocker.
Nineteen requests remain missing and one is partial. No request is marked
fulfilled or removed merely because a nearby artifact exists.

The partial request is `capstone-subsystem`. The exact Studio 3.1.1 Indicator
lights builder screenshot now appears in the capstone with its immutable source
reference. It supports the descriptor and ownership discussion, but it does not
show the generated preview categories required by the acceptance criterion.

Remaining blocker occurrences are: eight approved team artifacts, six current
official references, three current-season releases, two current product
screenshots, three physical student evidence sets, and four team process
reviews. A request may have more than one blocker. These counts explain why
further autonomous prose would not close the remaining gaps.
