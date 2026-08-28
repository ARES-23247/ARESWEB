# Academy middle-school curriculum review

Reviewed: 2026-08-27

- Branch: `codex/academy-middle-school-curriculum`
- Source curriculum at start: 18 ARES Academy and ARESLib documents
- Source authority: immutable ARES Robotics monorepo commit
  `1810d74e8f3b260116df68fd8c1b0854b2d61493`
- Scope: readability, lesson structure, diagrams, non-robot STEM coverage,
  student-led verification language, source provenance, and migration safety
- Excluded: production Firestore writes, publication, and physical robot claims

## Outcome

The original catalog averaged an estimated grade 10.9, and 15 of 18 documents
were above grade 8.9. The revised 22-document catalog averages grade 5.7, with
no document above grade 8.9. Every lesson has short sections and at least one
code-native Mermaid diagram with a concise screen-reader summary.

Four new hardware-neutral lessons add rates and units, graph reading, camera
evidence, and an outdoor or sunny-window engineering experiment. They populate
all six declared learning paths without inventing team data, people, hardware,
or accomplishments.

No production data was changed. Existing published lessons remain protected by
title, status, version, and old-body hashes. New lessons remain drafts until the
website editorial approval and production migration are explicitly authorized.

## Confirmed findings and remediation

### ACADEMY-MS-01 — Medium — high confidence

- Evidence: the baseline readability report estimated grade 10.9 on average;
  15 of 18 lessons were above grade 8.9.
- Impact: middle-school students could need an adult to translate core steps or
  could miss a safety boundary hidden in dense language.
- Remediation: lessons now define key words, use short steps and checks, and
  retain exact technical names only where students need them.
- Acceptance: `pnpm run content:readability` reports every lesson at or below
  grade 8.9, and a student usability review remains required before publishing.

### ACADEMY-MS-02 — Medium — high confidence

- Evidence: only three baseline documents contained a flow visualization, and
  Mermaid diagrams were announced by syntax such as `flowchart LR`.
- Impact: process and ownership relationships were harder to scan, especially
  for visual learners, while assistive technology received a poor summary.
- Remediation: each lesson has a purposeful diagram. `MermaidDiagram` uses the
  first `%% aria:` comment as its text alternative while preserving an explicit
  component label as the highest-priority override.
- Acceptance: component tests cover comment summaries, explicit overrides,
  render failures, and oversized input.

### ACADEMY-MS-03 — Low — high confidence

- Evidence: the checked-in catalog populated only four of six learning paths
  and contained no new general middle-school activity.
- Impact: Academy looked like a robot setup manual rather than a broader STEM
  learning space.
- Remediation: four new no-robot lessons populate Math for Robotics, AI & ML
  Foundations, and Applied STEM in the Outdoors. Claims derive from pinned ARES
  measurement, telemetry, localization, and evidence contracts.
- Acceptance: catalog validation reports 22 documents across all six paths and
  remote verification recomputes every pinned source blob.

### ACADEMY-MS-04 — Medium — high confidence

- Evidence: earlier robot lessons and metadata used mentor-required or
  supervised language for functional checks.
- Impact: the curriculum conflicted with the team's student-led robot process.
- Remediation: robot verification now points students to the team's safety
  procedure. Required coach review is limited to website publication.
- Acceptance: the catalog validator rejects required mentor, coach, or adult
  language in FTC and FRC verification content.

## Human and production gates

1. Preview all 18 revised documents and four new lessons on desktop and mobile.
2. Ask at least one grade 6-8 student to follow representative lessons and
   record confusing words, missing steps, and diagram problems.
3. Generate separate approval manifests for `refresh-published` and
   `publish-drafts` only after that review.
4. Export affected Firestore records and dry-run both migration phases.
5. Obtain explicit production-write authorization before applying anything.

