# ARES Academy robotics curriculum gap map

Audited: 2026-08-28

- ARESWEB baseline: `b4fe855e` on `master`; worktree was clean before the audit branch
- Audit branch: `codex/academy-robotics-curriculum-expansion`
- Baseline curriculum authority: ARES Robotics commit
  `1810d74e8f3b260116df68fd8c1b0854b2d61493`
- Current reviewed curriculum authority and ARES Robotics `origin/main`: commit
  `7cd2cf5f2ade0944214994b2e9ce5565d8a7608d`
- Current release identity: ARES `11.1.0`, FTC Starter `11.1.0`, FRC Starter
  `11.1.0`, and Robotics Studio `2.0.2`
- Scope: source curriculum, learning-path coverage, instructional depth,
  interactive-component reuse, source provenance, and authentic-media needs
- Excluded: production Firestore changes, publication, deployment, and physical
  robot validation

## Confirmed outcome

The production baseline improved reading level and navigation, but it is not a
complete robotics curriculum. At the start of this branch, the checked-in
catalog contained 22 documents, of which 18 were robot-related. Every baseline
document had fewer than 500 words, the median was about 330 words, and none used
a real photograph or annotated screenshot. Twenty lessons used one Mermaid
diagram as their only visual. Only 11 contained a clearly named hands-on
activity section.

Current bounded-phase status: the branch contains 53 catalog documents across
12 populated paths. Forty-two substantial lessons now implement instructional
contract version 2, and 58 approved interaction embeds appear in Academy
content. Thirty-nine of 48 planned identities are authored. Every required
robotics track has at least one entry point, but the architecture is not yet
complete. Authentic media and official sources remain blocked on 19 explicit
requests rather than being fabricated or remembered.

The baseline website lazy-loaded 52 React learning components. Forty-three were
standalone and nine require application context. Several standalone components
are plausible reuse candidates, including the swerve, elevator PID, flywheel
feedforward, brownout, state-machine, SysId, and robotics-kinematics labs. Their
presence does not prove they are suitable for Academy: each still needs a
content, accessibility, mobile, fidelity, and terminology review before it can
be embedded in a lesson.

## Findings

### ACADEMY-EXP-01 — High — confirmed — high confidence

Branch status: remediated. The authority now pins `439f2a36`, retains the
baseline commit as reviewed history, and remote validation recomputes all 27
referenced Git blob hashes. Two changed baseline source files received new
hashes; new lessons add further immutable references.

- Baseline evidence: `content/learning/catalog.json` pinned commit `1810d74e`,
  while a fresh fetch of ARES Robotics `main` resolved to `439f2a36`. Fifty-one
  files changed between those commits, including guided tuning, classroom
  guidance, starter archives, and release-transition documentation.
- Impact: new lessons could teach an obsolete source boundary or miss current
  workflows even while every old blob hash remains valid.
- Remediation: advance the reviewed curriculum authority only after inspecting
  the 51-file delta, then recompute every source URL and Git blob hash. Keep the
  older authority in the historical allowlist for already reviewed revisions.
- Acceptance: remote verification checks the current release identity and
  recomputes every source blob against the newly approved immutable commit.

### ACADEMY-EXP-02 — High — confirmed — high confidence

Branch status: partially remediated. Eight documents now pass the full
instructional contract. The remaining baseline robotics material still needs
the same depth review.

- Evidence: all 22 source documents are 272–413 words. The catalog contains
  four references, three tutorials, eleven guided labs, and four lessons.
- Impact: many 20–60 minute entries are short orientation notes rather than
  complete lessons with enough modeling, practice, feedback, and assessment.
- Remediation: introduce an instructional contract based on required learning
  elements rather than padding word count. A substantial lesson must include a
  purpose, prerequisites, vocabulary, worked example, purposeful visual,
  activity, checkpoints, troubleshooting, evidence artifact, assessment,
  extension, and next step.
- Acceptance: catalog validation checks the declared contract and the rendered
  lesson; a human reviewer follows representative activities without relying on
  hidden background knowledge.

### ACADEMY-EXP-03 — High — confirmed — high confidence

Branch status: partially remediated. All seven required tracks now have a
checked-in entry point, and the machine-readable plan defines all 48 intended
lessons. Most planned lessons remain unauthored.

- Evidence: the six populated paths contain 7, 8, 5, 3, 1, and 1 checked-in
  documents respectively. There are no coherent checked-in paths for mechanical
  design, electrical systems, FRC robot building, testing/debugging, competition
  operations, or capstones.
- Impact: a student cannot progress from beginner concepts to a complete
  simulated feature or a bounded physical-robot verification task.
- Remediation: replace the six-path ceiling with the sequenced architecture in
  `content/learning/robotics-curriculum-plan.json`, preserving the valuable math,
  AI, and outdoor material as supporting paths.
- Acceptance: every required track has an ordered beginner-to-capstone sequence,
  explicit prerequisites, FTC/FRC applicability, and a visible completion
  artifact.

### ACADEMY-EXP-04 — Medium — confirmed — high confidence

- Evidence: all 22 lessons lack photographs or annotated screenshots. A diagram
  is required, but its existence is currently treated as a quality proxy.
- Impact: students do not see authentic tools, wiring, mechanisms, robot parts,
  Studio screens, or evidence examples needed to connect text with practice.
- Remediation: maintain an authentic-media request list. Use approved team media
  or reproducible product screenshots; never fabricate team hardware, people, or
  results. Provide a truthful text/diagram alternative until approved media is
  available.
- Acceptance: each media item records origin, permission, alt text, caption, and
  the learning objective it supports. Missing media remains explicitly marked
  as missing during editorial review.

### ACADEMY-EXP-05 — Medium — confirmed — high confidence

Branch status: remediated at the framework boundary. The generated registry now
requires a separate `academyApproved` flag and fidelity label. Markdown,
Tiptap, and the editor picker refuse unreviewed simulations. Five purpose-built
components have passed the initial automated interaction review; additional
components still require individual review.

- Evidence: Markdown can embed any registered simulator tag, while the generated
  registry exposes only a `requiresContext` boolean. The renderer does not use
  that flag to prevent context-dependent components from being embedded without
  their provider.
- Impact: an editor can select a component that fails at runtime, is misleading
  outside its product context, or is inaccessible on touch, keyboard, narrow
  screens, or assistive technology.
- Remediation: define an Academy interaction contract with supported context,
  learning purpose, fidelity statement, text alternative, deterministic reset,
  and accessibility status. The editor and validator must allowlist only
  Academy-approved components.
- Acceptance: component tests cover keyboard, touch-equivalent controls,
  reduced motion, deterministic reset, text-equivalent results, and a narrow
  viewport. Academy rendering refuses components that have not passed review.

## Sequencing decision

Implementation proceeds in bounded phases:

1. **Foundation:** approve the current monorepo authority; validate a
   machine-readable curriculum and interaction contract; add authentic-media
   inventory support.
2. **Upgrade existing lessons:** deepen the 18 robot lessons and embed approved
   interactions where they improve an objective.
3. **Mechanical and electrical:** create the missing physical-systems paths
   before expecting students to author complete robot behavior.
4. **Programming and controls:** progress from beginner Kotlin and Redux through
   subsystem/superstructure authoring, control loops, localization, autonomous,
   and vision.
5. **Evidence and operations:** add testing, troubleshooting, commissioning,
   FTC/FRC competition operations, and progressive capstones.
6. **Human review:** conduct grade 6–8 usability review, authentic-media review,
   and Lead Coach publication review. Physical claims require recorded physical
   evidence; simulator success remains labeled as simulator-only.

No phase may weaken the existing backup, exact-precondition, approval, or
production-authorization gates.

## First bounded implementation evidence

Implemented on the audit branch:

- 26 catalog documents across 12 populated paths;
- eight substantial version-2 lessons, including four new robotics drafts;
- five purpose-built Academy-approved interactions and nine total embeds;
- a generated allowlist that prevents arbitrary registered simulations from
  executing inside Academy content;
- a 48-lesson, seven-track curriculum architecture and 19 explicit source or
  media requests; and
- migration support for review artifacts up to 100 documents while preserving
  the 25-change cap for every approval and write phase.

Automated evidence on 2026-08-28:

- 27 remote source blobs recomputed against ARES Robotics commit `439f2a36`;
- frontend coverage: 154 files and 848 tests passed;
- Functions coverage: 66 files and 798 tests passed;
- Firebase rules/emulator: 31 tests passed;
- learning migration: 25 tests passed;
- Playwright: 116 tests passed;
- route-security inventory: 99 mutation routes passed;
- production build, prerendering, and all bundle budgets passed; and
- production dependency audit reported no known vulnerabilities.

Open evidence limits:

- 42 of the 48 planned track lessons are not yet authored to the full contract;
- authentic team photographs and screenshots remain unavailable for the 19
  tracked requests;
- automated component tests do not replace a student usability session or a
  manual assistive-technology review; and
- no draft was staged, published, migrated, pushed, or deployed during this
  bounded phase. No physical robot behavior was tested.

## Second bounded implementation evidence

The controls batch upgraded `robot-coordinate-contracts` to instructional
contract version 2 and added the code-derived Coordinate Transform Lab. The
lesson now teaches the ARES 11 robot-to-field rotation with explicit axis,
angle, display-boundary, and physical-fidelity limits. The interaction uses
native range controls, a live text result, deterministic reset, responsive
layout, and no animation.

Focused evidence:

- catalog validation reports 10 approved embeds;
- estimated reading grade is 5.6 with 787 prose words and a 17-word longest
  sentence;
- coordinate math, renderer security, and catalog contract tests all pass; and
- frontend TypeScript validation passes.

## Third bounded implementation evidence

The first controls-model batch adds `controls-motor-model-feedforward` at the
previously open third position in Controls, Localization & Autonomous. It uses
the source-pinned ARES typed-tuning and Studio guided-experiment contracts, but
keeps every response value explicitly conceptual. The shared Control Response
Lab is also embedded in the existing telemetry-reading lesson as an optional
graph exercise. This reuse has a different prompt and does not make a motor or
hardware claim.

Focused evidence on 2026-08-28:

- catalog validation reports 27 documents, 12 existing-lesson interaction
  upgrade candidates, and 12 approved embeds;
- all 29 pinned source blobs were recomputed against ARES Robotics commit
  `439f2a36`, and the published monorepo version line still matches;
- the new lesson has 943 prose words, estimated grade 5.8, and a 20-word
  longest sentence;
- the response calculation, native controls, numeric table, deterministic
  reset, renderer security, and catalog contract tests pass; and
- frontend TypeScript validation passes.

This batch reduces the unauthored full-contract track count from 41 to 40. It
does not test a physical robot, stage or publish a draft, write production data,
push a branch, or deploy the website.

## Fourth bounded implementation evidence

The feedback batch adds `controls-pid` and reuses the Control Response Lab with
P-, I-, and D-focused trial prompts. The interaction now includes a bounded
integral term and preserves its invented-plant warning. Controls path positions
were shifted as a group so PID comes before telemetry/logging, autonomous, and
the season driver-frame application.

During remote verification, the provenance gate detected ARES Robotics 11.1.0
and Studio 2.0.1 at commit `65351a27`. Review of the 11.0.0-to-11.1.0 source
diff found new simulator fault-timeline and Studio project-editing APIs plus
product-name corrections in several documentation files. The two tuning sources
used by the feedforward and PID lessons did not change. The catalog therefore
records 11.1.0/2.0.1 as the current authority while retaining the 41 exact
11.0.0 source references as approved historical pins. Those pins must be
repointed only when each affected lesson receives a source and wording review.

Focused evidence on 2026-08-28:

- catalog validation reports 28 documents and 13 approved embeds;
- the PID lesson has 919 prose words, estimated grade 6.2, and a 25-word
  longest sentence;
- all 29 unique source blobs were recomputed, and the current release metadata
  matches ARES 11.1.0, Studio 2.0.1, and both 11.1.0 starters;
- deterministic response, output bound, integral behavior, reset, renderer
  security, catalog contract, TypeScript, and lint checks pass; and
- the unauthored full-contract track count is now 39 of 48.

No draft was staged or published, no production data was written, and no branch
was pushed or deployed during this batch.

## Fifth bounded implementation evidence

The motion-planning batch adds `controls-motion-profiles` and the Academy-only
Motion Profile Lab. The model implements the rest-to-rest triangular and
trapezoidal cases derived from ARESLib's bounded profile contract. The full
lesson separates planned setpoints from measured mechanism behavior. The
existing FTC autonomous tutorial reuses the lab only to preview bounded
references before its real routine validation and Local Simulator steps.

Focused evidence on 2026-08-28:

- catalog validation reports 29 documents and 15 approved embeds;
- the new lesson has 872 prose words, estimated grade 8.0, and a 19-word
  longest sentence;
- all 31 unique source blobs were recomputed, including current ARES 11.1.0
  `TrapezoidProfile` and Studio 2.0.1 `MotionProfileLabCard` sources;
- tests cover triangular and trapezoidal shapes, finite positive input checks,
  velocity bounds, final rest state, native controls, text table, reset, and
  visible physical-fidelity limits;
- renderer security, catalog contract, TypeScript, and lint checks pass; and
- the unauthored full-contract track count is now 38 of 48.

The web model does not load an ARES routine or prove traction, current, load,
backlash, collision clearance, feedback tracking, or any physical robot limit.
No draft was staged or published, no production data was written, and no branch
was pushed or deployed during this batch.

## Sixth bounded implementation evidence

The localization batch adds `controls-odometry` and the Academy-only Odometry
Calibration Error Lab. The lesson uses ARES 11.1.0 coordinate, estimator, and
calibration contracts to teach independent truth, repeated routes, distance
scale, and heading bias. The existing coordinate lesson reuses the lab only
after its frame-transform activity. Both locations state that the model is not
the ARES estimator.

Focused evidence on 2026-08-28:

- catalog validation reports 30 documents and 17 approved embeds;
- the new lesson has 830 prose words, estimated grade 7.4, and a 23-word
  longest sentence;
- all 34 unique source blobs were recomputed against the recorded authorities;
- tests cover zero-error truth, distance-scale error, heading bias, invalid
  inputs, native controls, a text-equivalent table, reset, and visible fidelity
  limits;
- the catalog's student-led robot-verification language gate passes for the FTC
  and FRC lesson scope;
- renderer security, catalog contract, TypeScript, and lint checks pass; and
- the unauthored full-contract track count is now 37 of 48.

The model omits wheel slip, curved motion, covariance, timestamps, delayed
vision, sensor noise, and physical robot behavior. A future physical calibration
still needs independently surveyed truth and student-run repeated routes. No
draft was staged or published, no production data was written, and no branch
was pushed or deployed during this batch.

## Seventh bounded implementation evidence

The uncertainty batch adds `controls-sensor-fusion` and `controls-vision`. Both
reuse the Academy-only Sensor Fusion Uncertainty Lab with different questions.
The first lesson studies inverse-variance weighting and independent truth. The
second studies AprilTag quality, capture time, bounds, innovation checks, and
visible rejection reasons. The existing beginner camera-evidence lesson reuses
the lab only as an optional decision exercise.

Focused evidence on 2026-08-28:

- catalog validation reports 32 documents and 20 approved embeds;
- sensor fusion has 699 prose words at estimated grade 8.5;
- vision rejection has 739 prose words at estimated grade 8.6;
- all 36 unique source blobs were recomputed, including the current ARES vision
  measurement and outlier-filter implementations;
- tests cover inverse-variance weighting, high-ambiguity rejection, invalid
  uncertainty, native controls, text-equivalent data, reset, and visible model
  limits;
- renderer security, catalog contract, TypeScript, and lint checks pass; and
- the unauthored full-contract track count is now 35 of 48.

The shared model is a one-dimensional weighted average with one rejection rule.
It does not reproduce the ARES EKF, field bounds, timestamps, tag geometry,
history replay, or physical camera behavior. Authentic camera screenshots and
student-run surveyed trials remain subject to the media/evidence request ledger.
No draft was staged or published, no production data was written, and no branch
was pushed or deployed during this batch.

## Eighth bounded implementation evidence

The autonomous-routine batch upgrades the existing
`ftc-starter-first-autonomous` tutorial instead of creating a duplicate lesson.
It now satisfies the full instructional contract and embeds two approved
interactions. The new Autonomous Path Clearance Lab teaches how a robot radius
and margin can block a straight concept path. The existing Motion Profile Lab
remains the separate model for bounded speed and acceleration.

Focused evidence on 2026-08-28:

- catalog validation reports 32 documents and 21 approved embeds;
- the upgraded tutorial has 890 prose words, estimated grade 6.5, and a
  15-word longest sentence;
- the exact curriculum-plan comparison now finds 15 authored identities and
  33 remaining full-contract lesson identities out of 48;
- the routine guide, generated FTC adapter, and path evaluator are pinned to
  ARES Robotics commit `65351a27` and the 11.1.0/2.0.1 version line;
- all 37 unique pinned source blobs were recomputed against their recorded
  authorities;
- tests cover blocked and clear paths, invalid inputs, native controls, a text
  table, deterministic reset, renderer security, and the catalog contract; and
- frontend TypeScript and local provenance validation pass.

The clearance lab uses one invented 5 m by 3 m field, one straight segment,
one circular obstacle, and a center-line radius check. It does not parse an
`.aresroutine`, sample an ARES path, use a costmap, model the full footprint,
check chained segments, execute code, or validate a physical route. The real
ARES evaluator continuously samples path segments against occupied costmap
cells, fails closed on invalid or out-of-bounds data, and reports richer
clearance and density evidence.

No draft was staged or published, no production data was written, and no branch
was pushed or deployed during this batch.

## Ninth bounded implementation evidence

The first programming batch upgrades the existing `robot-input-to-output`
tutorial instead of adding the plan's parallel input/state/output page. The
lesson now satisfies the full instructional contract and embeds the approved
Robot Input-to-Output Flow Tracer. Students can compare a driver request with a
sensor observation, step through the loop, and read the same data without a
diagram.

Focused evidence on 2026-08-28:

- catalog validation reports 32 documents, 13 existing-lesson interaction
  candidates, and 22 approved embeds;
- the upgraded tutorial has 837 prose words, estimated grade 6.3, and an
  18-word longest sentence;
- the exact curriculum-plan comparison finds 15 authored identities and
  33 remaining full-contract lesson identities out of 48;
- all 40 unique pinned blobs were recomputed, including the reviewed ARES Store
  and FTC cached-hardware boundaries;
- tests cover bounded stage selection, both scenarios, native step controls,
  deterministic reset, visible fidelity limits, renderer security, and the
  catalog contract; and
- frontend TypeScript, lint, readability, and provenance checks pass.

The local ARES checkout was observed on unfinished refactor branch
`codex/studio-project-session-refactor` at `3d10f63a`, with tracked architecture
removals and untracked replacement starters. That tree was not accepted as a
new curriculum authority. This batch remains pinned to the reviewed 11.1.0 /
Studio 2.0.1 snapshot at `65351a27` until the replacement architecture is
complete and reviewed.

The flow tracer is fixed teaching content. It does not inspect a project,
dispatch an action, read a device, run the scheduler, command hardware, or
prove loop timing. No draft was staged or published, no production data was
written, and no branch was pushed or deployed during this batch.

## Tenth bounded implementation evidence

The GUI-subsystem batch upgrades the existing
`ftc-gui-owned-indicator-lights` tutorial rather than adding a second generic
descriptor page. It now satisfies the full instructional contract and embeds
the Subsystem Descriptor Independence Lab. The activity connects the real
Lightbot descriptor's two targets, two direct loops, and zero safe outputs to a
bounded concept preview.

Focused evidence on 2026-08-28:

- catalog validation reports 32 documents, 14 existing-lesson interaction
  candidates, and 23 approved embeds;
- the upgraded tutorial has 842 prose words, estimated grade 7.5, and a
  19-word longest sentence;
- the exact curriculum-plan comparison finds 16 authored identities and
  32 remaining full-contract lesson identities out of 48;
- all 41 unique pinned blobs were recomputed, including the Lightbot guide,
  canonical indicator descriptor, and subsystem DSL;
- the first focused test exposed an unstable slider name caused by a live
  output inside its label; the control now has a stable explicit name;
- tests cover independent channels, safe-off output, invalid input, native
  controls, text results, deterministic reset, fidelity limits, renderer
  security, and the catalog contract; and
- frontend TypeScript, lint, readability, and provenance checks pass.

The interaction is an invented two-channel preview. It does not load or
validate an `.aressubsystem`, generate Kotlin, run Redux, call an FTC adapter,
reproduce PWM color, detect a failed write, or prove physical wiring and
safe-off behavior. No draft was staged or published, no production data was
written, and no branch was pushed or deployed during this batch.

## Eleventh bounded implementation evidence

The cached-I/O batch adds `programming-io-caching` and the Academy-only Cached
Output Decision Lab. The lesson connects one-read-per-loop ownership, cached
getters, checked output writes, redundant-write thresholds, and explicit zero
stops. It remains separate from the upgraded input-to-output overview so each
page has one primary interaction and a clear learning purpose.

Focused evidence on 2026-08-28:

- catalog validation reports 33 documents and 24 approved embeds;
- the new lesson has 820 prose words, estimated grade 6.1, and an 18-word
  longest sentence;
- the exact curriculum-plan comparison finds 17 authored identities and
  31 remaining full-contract lesson identities out of 48;
- all 42 unique pinned blobs were recomputed, including architecture,
  `CachedHardware.kt`, and the SDK-free `MotorIO` contract;
- tests cover changed, redundant, and hard-stop writes, invalid input, native
  controls, text results, loop-order disclosure, reset, fidelity limits,
  renderer security, and the catalog contract; and
- frontend TypeScript, lint, readability, and provenance checks pass.

The lab models one output comparison with lesson-only values. It does not read
hardware, model the first-write sentinel, validate FTC SDK ranges, run a robot
loop, measure bus traffic, or prove that a device stops. No draft was staged or
published, no production data was written, and no branch was pushed or deployed
during this batch.

## Twelfth bounded implementation evidence

The beginner-programming batch adds `programming-kotlin-basics` and the
Academy-only Kotlin Expression Values Lab. It also places the upgraded
`robot-input-to-output` tutorial at order 2 in the existing Programming with
ARES path, so the new lesson leads into the stronger existing material instead
of creating a parallel curriculum.

Focused evidence on 2026-08-28:

- catalog validation reports 34 documents, 14 existing-lesson interaction
  candidates, and 25 approved embeds;
- the new lesson has 703 prose words, estimated grade 5.3, and a 19-word
  longest sentence;
- the exact curriculum-plan comparison finds 18 authored identities and
  30 remaining full-contract lesson identities out of 48;
- all 43 unique pinned blobs were recomputed, including
  `StudentOnboardingTest.kt` and the synchronous ARES `Store`;
- tests cover deterministic expression evaluation, invalid numeric inputs,
  native number controls, the evaluation-order disclosure, reset, fidelity
  limits, renderer security, and the catalog contract; and
- frontend TypeScript, lint, readability, and provenance checks pass.

The expression lab evaluates one fixed arithmetic rule. It does not parse,
compile, or execute Kotlin; inspect ARES source; check units or overflow; change
state; or command hardware. No draft was staged or published, no production
data was written, and no branch was pushed or deployed during this batch.

## Thirteenth bounded implementation evidence

The subsystem-authoring batch adds `programming-code-subsystem` and the
Academy-only Subsystem Ownership Decision Lab. It builds on the existing
GUI-owned indicator-light tutorial. Students compare a generated starter,
hybrid registration, and hand-authored code without being told that one path
fits every mechanism.

Focused evidence on 2026-08-28:

- catalog validation reports 35 documents, 14 existing-lesson interaction
  candidates, and 26 approved embeds;
- the new lesson has 916 prose words, estimated grade 7.4, and a 20-word
  longest sentence;
- the exact curriculum-plan comparison finds 19 authored identities and
  29 remaining full-contract lesson identities out of 48;
- all 45 unique pinned blobs were recomputed, including the FTC authoring
  guide, shared subsystem DSL, and hand-authored subsystem prototype;
- tests cover all three bounded recommendations, native checkboxes, the
  ownership table, deterministic reset, fidelity limits, renderer security,
  and the catalog contract; and
- frontend TypeScript, lint, readability, and provenance checks pass.

The ownership lab uses two questions to suggest a first review path. It does
not inspect Kotlin, validate a descriptor, identify hazards, generate files,
run tests, prove mock/hardware parity, or approve physical operation. No draft
was staged or published, no production data was written, and no branch was
pushed or deployed during this batch.

## Fourteenth bounded implementation evidence

The superstructure batch upgrades the existing
`ftc-season-composition-and-safe-lifecycle` tutorial rather than creating the
plan's parallel `programming-superstructure` page. It now connects FTC setup
and latched frame failure with ordered superstructure policy, health fallbacks,
transient postures, measured guards, and complete target preflight.

Focused evidence on 2026-08-28:

- catalog validation reports 35 documents, 15 existing-lesson interaction
  candidates, and 27 approved embeds;
- the upgraded lesson has 875 prose words, estimated grade 6.6, and an 18-word
  longest sentence;
- the exact curriculum-plan comparison finds 20 authored identities and
  28 remaining full-contract lesson identities out of 48;
- all 46 unique pinned blobs were recomputed, including the reviewed FTC
  composition root and generated superstructure runtime contract;
- tests cover disabled and health precedence, transient-posture entry,
  measured-guard blocking and release, native controls, deterministic stepping
  and reset, the evaluation-order disclosure, fidelity limits, renderer
  security, and the catalog contract; and
- frontend TypeScript, lint, readability, and provenance checks pass.

The state lab is an invented three-posture coordinator. It does not parse an
ARES document, bind real fields, preflight or dispatch catalog tasks, model
time and debounce, inspect physical clearance, run hardware, or prove safe
motion. No draft was staged or published, no production data was written, and
no branch was pushed or deployed during this batch.

## Fifteenth bounded implementation evidence

The programming-parity batch adds `programming-tests-parity` and the
Academy-only Adapter Parity Evidence Lab. It completes the planned Programming
with ARES path without duplicating the existing beginner evidence-level lesson.
The new page focuses narrowly on running the same contract case against a
platform test boundary and a simulated adapter.

Focused evidence on 2026-08-28:

- catalog validation reports 36 documents, 15 existing-lesson interaction
  candidates, and 28 approved embeds;
- the new lesson has 871 prose words, estimated grade 6.6, and a 24-word
  longest sentence;
- the exact curriculum-plan comparison finds 21 authored identities and
  27 remaining full-contract lesson identities out of 48;
- all 49 unique pinned blobs were recomputed, including the generated
  verification contract, simulation-device contract, and FTC simulator parity
  test;
- tests cover incomplete, aligned, shared-failure, and mismatch findings;
  native selects; expected-result changes; deterministic reset; the evidence
  disclosure; fidelity limits; renderer security; and the catalog contract;
  and
- frontend TypeScript, lint, readability, and provenance checks pass.

The parity lab records invented labels. It does not run Gradle, load adapters,
inspect test XML, control a clock, inject faults, compare real outputs, connect
to a robot, or prove physical behavior. No draft was staged or published, no
production data was written, and no branch was pushed or deployed during this
batch.

## Sixteenth bounded implementation evidence

The drivetrain batch adds `mechanical-drivetrains` and the Academy-only
Drivetrain Starting-Point Lab. It keeps the existing advanced
`swerve-and-kinematics` reference as the detailed follow-up instead of turning
that narrower page into a generic chooser.

Focused evidence on 2026-08-28:

- catalog validation reports 37 documents, 15 existing-lesson interaction
  candidates, and 29 approved embeds;
- the new lesson has 841 prose words, estimated grade 7.6, and a 24-word
  longest sentence;
- the exact curriculum-plan comparison finds 22 authored identities and
  26 remaining full-contract lesson identities out of 48;
- all 51 unique pinned blobs were recomputed, including the reviewed drivebase
  authoring contract and Drivebase Builder workflow;
- the first focused test exposed that selected-detail text intentionally also
  appears in the comparison table; the assertion now verifies both accessible
  copies instead of assuming text is unique;
- tests cover all four starting points, text-equivalent topology and motion,
  native selection and evidence checks, the comparison table, deterministic
  reset, fidelity limits, renderer security, and the catalog contract; and
- frontend TypeScript, lint, readability, and provenance checks pass.

The lab is a source-backed reference card. It does not choose a drivebase,
measure geometry, solve wheel commands, inspect a document, validate vendor
data, run simulation, command hardware, or prove safe motion. No draft was
staged or published, no production data was written, and no branch was pushed
or deployed during this batch.

## Seventeenth bounded implementation evidence

The sensor batch adds `electrical-sensors` and the Academy-only Sensor Signal
Evidence Lab. The lesson compares sensor jobs in prose, then narrows its
interaction to one distance sample so the model can state honest limits.

Focused evidence on 2026-08-28:

- catalog validation reports 38 documents, 15 existing-lesson interaction
  candidates, and 30 approved embeds;
- the new lesson has 874 prose words, estimated grade 6.4, and a 25-word
  longest sentence;
- the exact curriculum-plan comparison finds 23 authored identities and
  25 remaining full-contract lesson identities out of 48;
- all 53 unique pinned blobs were recomputed, including the distance-sensor
  I/O contract, shared simulation-device health contract, and hardware topology
  models;
- tests cover finite values, configuration identity, every health class used by
  the lab, freshness, range, invalid age bounds, native controls, visible
  reasons, disclosure, deterministic reset, fidelity limits, renderer security,
  and the catalog contract; and
- frontend TypeScript, lint, readability, and provenance checks pass.

The signal lab uses invented distance data. It does not read or discover a
sensor, validate a device range, model noise or target surfaces, select
hardware, run a robot loop, command an actuator, or prove physical sensing. No
draft was staged or published, no production data was written, and no branch
was pushed or deployed during this batch.

## Eighteenth bounded implementation evidence

The device-identity batch adds `electrical-buses-addresses` and the
Academy-only Bus and Address Troubleshooter. It follows the existing sensor
lesson instead of duplicating that page's signal-health model. The new lesson
uses a complete connection record to show why a number alone is not a device
identity.

Focused evidence on 2026-08-28:

- catalog validation reports 39 documents, 15 existing-lesson interaction
  candidates, and 31 approved embeds;
- the new lesson has 1,030 prose words, estimated grade 7.2, and a 28-word
  longest sentence;
- the exact curriculum-plan comparison finds 25 authored identities and
  23 remaining full-contract lesson identities out of 48;
- all 55 unique pinned source URLs were remotely recomputed, including
  the topology model, subsystem connection schema, and Studio cross-subsystem
  collision review;
- tests cover full duplicates, different types, different buses, different
  numbers, bus-label normalization, invalid numbers, native controls, visible
  reasons, disclosure, deterministic reset, fidelity limits, renderer
  security, and the catalog contract; and
- frontend TypeScript, lint, local catalog validation, and readability checks
  pass.

The troubleshooter compares two invented records. It does not scan an ARES
project, discover hardware, validate current vendor or competition ranges,
inspect wiring or termination, connect to a robot, or prove physical identity.
No draft was staged or published, no production data was written, and no branch
was pushed or deployed during this batch.

## Nineteenth bounded implementation evidence

The commissioning batch upgrades the existing
`ftc-starter-physical-commissioning` lesson and embeds the Academy-only
Commissioning Boundary Checklist. It does not add a duplicate FTC commissioning
page. The upgraded lesson also joins the testing, debugging, and commissioning
path while retaining its FTC starter path.

Focused evidence on 2026-08-28:

- catalog validation still reports 39 documents and 15 existing-lesson
  interaction candidates, while approved embeds increase to 32;
- the upgraded lesson has 1,034 prose words, estimated grade 8.0, and a 23-word
  longest sentence;
- the exact curriculum-plan comparison remains at 25 authored identities and
  23 remaining full-contract lesson identities out of 48;
- all 57 unique pinned source URLs were remotely recomputed, including the
  current FTC physical-commissioning guide, guided commissioning evidence
  boundaries, and Hardware Setup inventory review;
- tests cover the ordered evidence gates, stop-readiness failure, unexpected
  result override, native checkboxes, live next actions, deterministic reset,
  fidelity limits, renderer security, and the catalog contract; and
- frontend TypeScript, lint, local catalog validation, readability, and focused
  Academy tests pass.

The checklist trusts student-entered boxes. It does not run tests, inspect an
inventory, verify the safety setup, connect to hardware, authorize motion,
command an actuator, or prove physical behavior. No draft was staged or
published, no production data was written, and no branch was pushed or deployed
during this batch.

## Twentieth bounded implementation evidence

The vision-interaction batch adds the Academy-only Vision Evidence Rejection
Lab to three existing pages: the beginner camera lesson, the ARES autonomous
and vision reference, and the advanced controls vision lesson. It replaces the
generic Sensor Fusion Lab in the two pages where a vision-specific checklist is
more accurate and adds the missing interaction to the reference page.

Focused evidence on 2026-08-28:

- catalog validation remains at 39 documents and 15 existing-lesson
  interaction candidates, while approved embeds increase to 33;
- the edited pages remain within the grade target: 6.4 for the beginner camera
  page, 7.6 for the ARES reference, and 8.4 for the advanced controls lesson;
- the exact curriculum-plan comparison remains at 25 authored identities and
  23 remaining full-contract lesson identities out of 48;
- the previously recomputed 57 pinned source URLs are unchanged by this batch;
- tests cover all six rejection reasons, ordered first-failure reporting,
  native checkboxes, live reasons, deterministic reset, fidelity limits,
  renderer security, and the catalog contract; and
- frontend TypeScript, lint, local catalog validation, readability, and focused
  Academy tests pass.

The lab switches represent named review stages. They do not process an image,
solve an AprilTag pose, calculate ambiguity or innovation, model latency, run
the estimator, connect to a camera, or prove field position. No draft was
staged or published, no production data was written, and no branch was pushed
or deployed during this batch.

## Twenty-first bounded implementation evidence

The driver-input batch upgrades the existing
`ftc-driver-input-shaping-and-frames` tutorial and embeds the Academy-only FTC
Driver Input Curve Lab. It adds the missing interactive trace to the existing
source-backed page instead of creating a duplicate controls lesson.

Focused evidence on 2026-08-28:

- catalog validation remains at 39 documents and 15 existing-lesson
  interaction candidates, while approved embeds increase to 34;
- the upgraded lesson has 805 prose words, estimated grade 6.8, and a 21-word
  longest sentence;
- the exact curriculum-plan comparison remains at 25 authored identities and
  23 remaining full-contract lesson identities out of 48;
- all 58 unique pinned source URLs were remotely recomputed, including the
  current FTC controller and its focused test suite;
- the first UI test correctly exposed duplicate text for the smoothing and
  final values; the assertion now verifies both accessible copies;
- tests cover the pinned calculation order, clamp, deadband, fallback,
  smoothing, blue field mirroring, robot-relative behavior, native controls,
  deterministic reset, fidelity limits, renderer security, and catalog
  contract; and
- frontend TypeScript, lint, local catalog validation, readability, provenance,
  and focused Academy tests pass.

The lab calculates one translation axis for one step. It does not read a
gamepad, advance repeated timed loops, shape rotation separately, use robot
heading, run drivetrain kinematics, connect to a robot, or prove driving
behavior. No draft was staged or published, no production data was written,
and no branch was pushed or deployed during this batch.

## Twenty-second bounded implementation evidence

The measurement batch adds `mechanical-measurement-design-notebook` as the
start of the Mechanical Design and Fabrication path. It deliberately does not
add an interaction where a paper or local digital notebook, a real object, and
independent repetition provide the more useful student activity.

Focused evidence on 2026-08-28:

- catalog validation increases to 40 documents, with 15 existing-lesson
  interaction candidates and 34 approved embeds;
- the new lesson has 955 prose words, estimated grade 7.0, and a 25-word
  longest sentence;
- the exact curriculum-plan comparison finds 26 authored identities and
  22 remaining full-contract lesson identities out of 48;
- the lesson reuses two of the 58 already recomputed pinned source URLs: the
  current Hardware Setup workflow and drivetrain geometry contract;
- focused tests cover page rendering, catalog validation, navigation metadata,
  readability, and the instructional contract; and
- frontend TypeScript and local catalog validation pass.

The lesson does not select a physical tool, tolerance, or league limit. It
does not fabricate a team photograph; the authentic measurement-photo request
remains open. No draft was staged or published, no production data was written,
and no branch was pushed or deployed during this batch.

## Twenty-third bounded implementation evidence

The topology-diagnostic batch adds `electrical-hardware-map-diagnostics` and
the Academy-only Hardware Topology Diagnostic. It also moves the existing
sensor and bus lessons to their final planned positions and moves the three
authored mechanical lessons to their final planned positions. This leaves
intentional path gaps for the source-gated lessons instead of creating later
order collisions.

Focused evidence on 2026-08-28:

- catalog validation increases to 41 documents, with 15 existing-lesson
  interaction candidates and 35 approved embeds;
- the new lesson has 906 prose words, estimated grade 7.7, and a 28-word
  longest sentence;
- the exact curriculum-plan comparison finds 27 authored identities and
  21 remaining full-contract lesson identities out of 48;
- the lesson reuses three of the 58 already recomputed current source URLs:
  Hardware Setup, topology models, and subsystem connection/startup policy;
- tests cover every represented boundary, ordered first-failure reporting,
  native checkboxes, live results, deterministic reset, fidelity limits,
  renderer security, and the catalog contract; and
- frontend TypeScript, lint, local catalog validation, readability, and focused
  Academy tests pass.

The lab uses self-reported checks. It does not open a project, scan a hardware
map, connect to a controller, read power or wiring, poll a sensor, write an
actuator, identify a root cause, or prove a device works. The authentic Studio
diagnostic screenshot request remains open. No draft was staged or published,
no production data was written, and no branch was pushed or deployed during
this batch.

## Twenty-fourth bounded implementation evidence

The log-replay batch adds `testing-logs-replay` and the Academy-only Log
Comparison Lab. It places the existing telemetry reference first in the path,
keeps the simulation-limits lesson second, and reserves later positions for
fault-tree and system-identification lessons.

Focused evidence on 2026-08-28:

- catalog validation increases to 42 documents, with 15 existing-lesson
  interaction candidates and 36 approved embeds;
- the new lesson has 841 prose words, estimated grade 8.0, and a 28-word
  longest sentence;
- the exact curriculum-plan comparison finds 28 authored identities and
  20 remaining full-contract lesson identities out of 48;
- all 61 unique pinned source URLs were remotely recomputed, including Guided
  Run Review, Deterministic Replay, and the Academy Practice Pack;
- tests cover timestamp and shared-event alignment, unit-bearing signal
  choices, native controls, live results, deterministic reset, fidelity
  limits, renderer security, and the catalog contract; and
- frontend TypeScript, lint, local catalog validation, readability, provenance,
  and 34 focused Academy tests pass.

The lab compares two fixed invented runs. It does not import logs, verify their
provenance, infer a cause, prove a fault, or replace review in Studio or another
real log tool. No draft was staged or published, no production data was
written, and no branch was pushed or deployed during this batch.

## Twenty-fifth bounded implementation evidence

The fault-isolation batch adds `testing-fault-tree` and the Academy-only Fault
Tree Isolation Lab. The same interaction replaces the text-only fault-tree
extension in the existing hardware-map diagnostic, where it directly advances
that lesson's evidence-isolation objective.

Focused evidence on 2026-08-28:

- catalog validation increases to 43 documents, with 15 existing-lesson
  interaction candidates and 38 approved embeds;
- the new lesson has 891 prose words, estimated grade 6.7, and a 26-word
  longest sentence;
- the exact curriculum-plan comparison finds 29 authored identities and
  19 remaining full-contract lesson identities out of 48;
- all 64 unique pinned source URLs were remotely recomputed, including current
  guided-diagnosis, FTC troubleshooting, and pit-operations boundaries;
- tests cover evidence ordering, competing explanations, native controls, live
  results, deterministic reset, fidelity limits, reuse in the existing lesson,
  renderer security, and the catalog contract; and
- frontend TypeScript, lint, local catalog validation, readability, provenance,
  and 38 focused Academy tests pass.

The lab uses one invented symptom and self-reported evidence. It does not read
robot state, inspect wiring or power, move a mechanism, verify a sensor,
identify a root cause, authorize output, or prove a repair. No draft was staged
or published, no production data was written, and no branch was pushed or
deployed during this batch.

## Twenty-sixth bounded implementation evidence

The tuning batch adds `testing-sysid-tuning` and the Academy-only One-Change
Tuning Experiment Lab. The same interaction is embedded in the existing PID
lesson, where threshold-based classification reinforces its controlled-trial
and evidence-artifact objectives. The older generic SysId canvas remains
unapproved and is not embedded in curriculum content.

Focused evidence on 2026-08-28:

- catalog validation increases to 44 documents, with 15 existing-lesson
  interaction candidates and 40 approved embeds;
- the new lesson has 882 prose words, estimated grade 8.6, and a 25-word
  longest sentence;
- the exact curriculum-plan comparison finds 30 authored identities and
  18 remaining full-contract lesson identities out of 48;
- all 66 unique pinned source URLs were remotely recomputed, including current
  guided-tuning, typed-profile, and commissioning boundaries;
- tests cover improvement, regression, inconclusive and blocked results,
  direction, confounding, native controls, live results, reset, fidelity limits,
  reuse in the existing PID lesson, renderer security, and catalog contract;
  and
- frontend TypeScript, lint, local catalog validation, readability, provenance,
  and 34 focused Academy tests pass.

The lab uses invented numbers. It does not run SysId, fit a motor model,
connect to Studio, apply a parameter, control a simulator or robot, prove
causation, certify safety, or promote a tuning profile. No draft was staged or
published, no production data was written, and no branch was pushed or deployed
during this batch.

## Twenty-seventh bounded implementation evidence

The capstone batch adds `capstone-subsystem` and the Academy-only Capstone
Evidence Board. The same board is embedded in the existing simulated-mechanism
capstone because both projects require claim-labeled packets with visible
limits; the subsystem lesson adds its more detailed contract in prose.

Focused evidence on 2026-08-28:

- catalog validation increases to 45 documents, with 15 existing-lesson
  interaction candidates and 42 approved embeds;
- the new lesson has 974 prose words, estimated grade 8.4, and a 22-word
  longest sentence;
- the exact curriculum-plan comparison finds 31 authored identities and
  17 remaining full-contract lesson identities out of 48;
- all 67 unique pinned source URLs were remotely recomputed, including current
  FTC authoring, Studio builder, and ARESLib subsystem contracts;
- tests cover ordered missing evidence, all-section readiness, native checks,
  live results, reset, fidelity limits, reuse in the existing capstone,
  renderer security, and the catalog contract; and
- frontend TypeScript, lint, local catalog validation, readability, provenance,
  and 34 focused Academy tests pass.

The board uses self-reported boxes. It does not inspect a project, verify source
links, run tests, review student work, approve website publication, authorize
physical operation, or prove a capstone claim. No draft was staged or
published, no production data was written, and no branch was pushed or deployed
during this batch.

## Twenty-eighth bounded implementation evidence

The autonomous capstone adds `capstone-autonomous-mission`. It reuses the
approved Autonomous Path Clearance Lab, Motion Profile Lab, and Capstone
Evidence Board because those interactions directly cover footprint, bounded
motion, and claim-labeled packet objectives without a duplicate model.

Focused evidence on 2026-08-28:

- catalog validation increases to 46 documents, with 15 existing-lesson
  interaction candidates and 45 approved embeds;
- the new lesson has 907 prose words, estimated grade 7.1, and a 24-word
  longest sentence;
- the exact curriculum-plan comparison finds 32 authored identities and
  16 remaining full-contract lesson identities out of 48;
- all 69 unique pinned source URLs were remotely recomputed, including current
  Studio, FTC, and FRC routine and simulation contracts;
- tests cover all three secure embeds, navigation, renderer security,
  instructional depth, readability, and the catalog contract; and
- frontend TypeScript, local catalog validation, readability, provenance, and
  30 focused Academy tests pass.

The lesson does not create or inspect a project, save a routine, generate code,
run Local Sim, deploy, command hardware, or prove physical clearance. No draft
was staged or published, no production data was written, and no branch was
pushed or deployed during this batch.

## Twenty-ninth bounded implementation evidence

The physical commissioning capstone adds `capstone-physical-commissioning`.
It reuses the approved Commissioning Boundary Checklist and Capstone Evidence
Board while leaving the authentic student physical-evidence request open.

Focused evidence on 2026-08-28:

- catalog validation increases to 47 documents, with 15 existing-lesson
  interaction candidates and 47 approved embeds;
- the new lesson has 854 prose words, estimated grade 8.6, and a 22-word
  longest sentence;
- the exact curriculum-plan comparison finds 33 authored identities and
  15 remaining full-contract lesson identities out of 48;
- all 70 unique pinned source URLs were remotely recomputed, including current
  Studio evidence levels and FTC/FRC starter hardware-review procedures;
- tests cover both secure embeds, navigation, renderer security,
  instructional depth, readability, and the catalog contract; and
- frontend TypeScript, local catalog validation, readability, provenance, and
  30 focused Academy tests pass.

The lesson contains no claimed physical result. Its checklists cannot inspect a
robot, authorize motion, verify student evidence, or prove a feature. The
authentic physical-evidence request remains open. No draft was staged or
published, no production data was written, and no branch was pushed or deployed
during this batch.

## Thirtieth bounded implementation evidence

The readiness batch adds `capstone-competition-readiness`, completing the five
planned capstone identities. It reuses the Capstone Evidence Board and adds a
draft team rubric while leaving authentic boundary evidence and team review
open. Stale curriculum-plan language was corrected so students and the team own
robot-process verification; the Lead Coach gate applies only to website posts.

Focused evidence on 2026-08-28:

- catalog validation increases to 48 documents, with 15 existing-lesson
  interaction candidates and 48 approved embeds;
- the new lesson has 952 prose words, estimated grade 7.5, and a 20-word
  longest sentence;
- the exact curriculum-plan comparison finds 34 authored identities and
  14 remaining full-contract lesson identities out of 48;
- all 71 unique pinned source URLs were remotely recomputed, including current
  FRC operations, ARESLib pit operations, and FTC commissioning boundaries;
- tests cover secure embed rendering, navigation, instructional depth,
  readability, student-led verification language, and the catalog contract;
  and
- frontend TypeScript, local catalog validation, readability, provenance, and
  30 focused Academy tests pass.

The rubric is a draft and the lesson claims no event readiness. It does not
inspect evidence, approve a team process, replace official rules, authorize
operation, or prove a claim. Authentic evidence and team review remain open.
No draft was staged or published, no production data was written, and no branch
was pushed or deployed during this batch.

## Thirty-first bounded implementation evidence

The mechanical-mechanism batch adds `mechanical-mechanisms` and the approved
Mechanism Motion Explorer. The interaction is also reused as an optional
application in the existing gear-ratio lesson. The new lesson uses a described
diagram while leaving the authentic team mechanism-image request open.

Focused evidence on 2026-08-28:

- catalog validation increases to 49 documents, with 15 existing-lesson
  interaction candidates and 50 approved embeds;
- the new lesson has 960 prose words, estimated grade 6.4, and a 22-word
  longest sentence;
- the exact curriculum-plan comparison finds 35 authored identities and
  13 remaining full-contract lesson identities out of 48;
- all 72 unique pinned source URLs were remotely recomputed, including current
  FTC and FRC subsystem-authoring guides and the Studio builder contract;
- tests cover arm, elevator, and roller calculations; invalid inputs; native
  controls; live results; reset; fidelity limits; secure rendering; navigation;
  instructional depth; readability; and the catalog contract; and
- frontend TypeScript, focused lint, local catalog validation, readability,
  provenance, and 39 focused Academy tests pass. Targeted interaction coverage
  is 100% for statements, functions, and lines, with 93.75% branch coverage.

The explorer uses ideal ratio and circumference math. It does not solve linkage
geometry, model gravity or load, choose hardware, inspect limits or clearance,
command a simulator or robot, or prove safe motion. No authentic team photo was
invented, and the tracked media request remains open. No draft was staged or
published, no production data was written, and no branch was pushed or deployed
during this batch.

## Thirty-second bounded implementation evidence

The CAD/fabrication batch adds `mechanical-cad-fabrication` and the approved
Tolerance Stack Lab. The interaction is also reused as an optional application
in the existing measurement lesson. The new lesson uses a described diagram
while leaving the paired authentic team CAD and fabricated-part request open.

Focused evidence on 2026-08-28:

- catalog validation increases to 50 documents, with 15 existing-lesson
  interaction candidates and 52 approved embeds;
- the new lesson has 985 prose words, estimated grade 6.8, and a 21-word
  longest sentence;
- the exact curriculum-plan comparison finds 36 authored identities and
  12 remaining full-contract lesson identities out of 48;
- all 72 unique pinned source URLs were remotely recomputed, including current
  Studio geometry, provenance, and hardware-evidence contracts;
- tests cover passing and failing ranges; empty, non-finite, negative, and
  reversed inputs; native controls; live results; reset; fidelity limits;
  secure rendering; navigation; instructional depth; readability; and the
  catalog contract; and
- frontend TypeScript, focused lint, local catalog validation, readability,
  provenance, and 39 focused Academy tests pass. Targeted interaction coverage
  is 100% for statements, functions, and lines, with 95% branch coverage.

The lab adds independent plus-or-minus lengths along one direction. It does not
check hole position, angle, fit type, fastener play, process capability,
material behavior, load, or measurement error. It cannot approve a CAD model,
fabrication process, or real part. No team CAD or part image was invented, and
the tracked media request remains open. No draft was staged or published, no
production data was written, and no branch was pushed or deployed during this
batch.

## Thirty-third bounded implementation evidence

The electrical-protection batch adds `electrical-battery-protection` and the
approved Brownout State Sandbox. The interaction is also reused as an optional
application in the existing voltage/current lesson. League-specific battery,
wire, breaker, and fuse values remain blocked on current official sources.

The remote gate detected a concurrent Studio 2.0.2 release at `7cd2cf5f`.
Review of its four commits found Drive synchronization, team integrations,
updater packaging, starter archives, and release metadata changes. None of the
75 unique files pinned by current lessons changed. The catalog authority now
records ARES 11.1.0 / Studio 2.0.2 while preserving all 2.0.1 links as reviewed
historical pins.

Focused evidence on 2026-08-28:

- catalog validation increases to 51 documents, with 15 existing-lesson
  interaction candidates and 54 approved embeds;
- the new lesson has 1,017 prose words, estimated grade 7.3, and a 23-word
  longest sentence;
- the exact curriculum-plan comparison finds 37 authored identities and
  11 remaining full-contract lesson identities out of 48;
- all 75 unique pinned source URLs were remotely recomputed, including the
  ARES brownout, current-budget, and shared power-manager contracts;
- tests cover healthy, warning, critical, and hysteresis transitions; invalid
  voltage and configuration; native controls; live results; reset; fidelity
  limits; secure rendering; navigation; instructional depth; readability; and
  the catalog contract; and
- frontend TypeScript, focused lint, local catalog validation, readability,
  provenance, and 40 focused Academy tests pass. Targeted interaction coverage
  is 100% for statements, functions, and lines, with 93.75% branch coverage.

The sandbox performs one source-pinned state-machine step. It does not read a
battery, estimate current, model internal resistance, size a breaker or fuse,
command a motor, or prove protection. The official FTC/FRC electrical-rule
request remains open. No draft was staged or published, no production data was
written, and no branch was pushed or deployed during this batch.

## Thirty-fourth bounded implementation evidence

The wiring batch adds `electrical-wiring-connectors` and the approved Wiring
Plan Diagnostic Lab. The interaction is also reused as an optional branch in
the existing hardware-map diagnostic. Authentic team wiring photos and current
component or league ratings remain open source requests.

Focused evidence on 2026-08-28:

- catalog validation increases to 52 documents, with 15 existing-lesson
  interaction candidates and 56 approved embeds;
- the new lesson has 995 prose words, estimated grade 7.8, and a 21-word
  longest sentence;
- the exact curriculum-plan comparison finds 38 authored identities and
  10 remaining full-contract lesson identities out of 48;
- all 78 unique pinned source URLs were remotely recomputed, including current
  Studio 2.0.2 inventory, topology, and subsystem-connection contracts;
- tests cover ordered missing evidence, complete paper records, native checks,
  live results, reset, fidelity limits, secure rendering, navigation,
  instructional depth, readability, and the catalog contract; and
- frontend TypeScript, focused lint, local catalog validation, readability,
  provenance, and 39 focused Academy tests pass. Targeted interaction coverage
  is 100% for statements, branches, functions, and lines.

The lab uses self-reported checks. It does not read a diagram, inspect a wire,
identify a connector, verify polarity, find damage, measure continuity, choose
a conductor or protection rating, energize a circuit, or prove correct wiring.
The authentic media request remains open. No draft was staged or published, no
production data was written, and no branch was pushed or deployed during this
batch.

## Thirty-fifth bounded implementation evidence

The actuator batch adds `electrical-motors-servos` and the approved Motor and
Servo Evidence Sorter. The interaction is also reused as an optional extension
in the existing mechanism lesson. Approved manufacturer specifications remain
an open source request, so the lesson teaches comparison evidence without
inventing ratings or selecting a product.

Focused evidence on 2026-08-28:

- catalog validation increases to 53 documents, with 15 existing-lesson
  interaction candidates and 58 approved embeds;
- the new lesson has 1,040 prose words, estimated grade 6.9, and a 22-word
  longest sentence;
- the exact curriculum-plan comparison finds 39 authored identities and
  9 remaining full-contract lesson identities out of 48;
- all 81 unique pinned source URLs were remotely recomputed, including the
  current ARES 11.1.0 motor and servo contracts and FTC authoring guide;
- 40 focused rendering, navigation, content, readability, security, and
  interaction tests pass; and
- frontend TypeScript, focused lint, local catalog validation, readability,
  and remote provenance pass. Targeted interaction coverage is 100% for
  statements, branches, functions, and lines.

The sorter reads only student selections. It does not inspect requirements,
verify manufacturer specifications, calculate load, heat, current, life, or
strength, choose a product, command hardware, or approve physical operation.
No draft was staged or published, no production data was written, and no branch
was pushed or deployed during this batch.
