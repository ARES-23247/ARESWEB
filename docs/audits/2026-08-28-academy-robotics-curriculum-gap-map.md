# ARES Academy robotics curriculum gap map

Audited: 2026-08-28

- ARESWEB baseline: `b4fe855e` on `master`; worktree was clean before the audit branch
- Audit branch: `codex/academy-robotics-curriculum-expansion`
- Baseline curriculum authority: ARES Robotics commit
  `1810d74e8f3b260116df68fd8c1b0854b2d61493`
- Current reviewed curriculum authority and ARES Robotics `origin/main`: commit
  `439f2a36855aa6d00010c0d4ada255511626d1af`
- Current release identity: ARES `11.0.0`, FTC Starter `11.0.0`, FRC Starter
  `11.0.0`, and Robotics Studio `2.0.0`
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

Current bounded-phase status: the branch contains 26 catalog documents across
12 populated paths. Eight substantial lessons now implement instructional
contract version 2, and nine approved interaction embeds appear in Academy
content. Every required robotics track has at least one entry point, but the
48-lesson architecture is not yet fully authored. Authentic media remains
blocked on the 19 explicit source requests rather than being fabricated.

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
