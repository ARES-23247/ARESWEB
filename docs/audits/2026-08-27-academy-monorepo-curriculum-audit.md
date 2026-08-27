# Academy monorepo curriculum audit

Audited: 2026-08-27

- ARESWEB base commit: `d187bd92` (`master` was clean before the audit branch)
- Audit branch: `codex/academy-monorepo-refresh`
- Authoritative robotics source: `ARES-23247/ARES-Robotics`
- Robotics source commit: `1810d74e8f3b260116df68fd8c1b0854b2d61493`
- Main-branch evidence: Monorepo CI, Analytics Validation, autonomous-contract verification, and
  CodeQL all passed for the merge; no `ARES-Robotics` tag or GitHub release existed at audit time
- Scope: the 18 robotics-focused Academy/ARESLib source documents, their provenance validator,
  bounded migration controls, the homepage product link, and public Studio naming
- Excluded: production Firestore writes, physical robot validation, and publication of ARES 11 or
  Studio 2 artifacts

## Outcome

The split-repository curriculum model was no longer truthful after the ARES Robotics monorepo
merge. The local review sources now use immutable monorepo links and verified Git blob hashes, the
content reflects the schema/model/compiler and authoring-model boundaries, and the production
migration runner has an approval-gated in-place refresh phase that refuses to overwrite a lesson
whose old body changed.

No production data was changed. The reviewed files remain migration sources until a coach approves
their rendered content and the operator separately obtains authorization for the production write.

## Findings and remediation

### ACADEMY-MONO-01 — Medium — confirmed — high confidence

- Evidence: `content/learning/catalog.json` and all 18 robotics entries pinned the former
  `ARESLib-Kotlin`, `ARES-FTC-Starter`, or `ARES-FTC` repositories and versions. The current source
  is the `ARES-Robotics` monorepo at `1810d74e`.
- Impact: readers could follow obsolete repository boundaries, open stale sources, and learn a
  release identity that does not describe the current schema-4 source line.
- Remediation: every source reference now declares `ARES-Robotics`, the immutable merge commit, the
  full component path, and the independently computed Git blob hash. Catalog provenance records
  ARES/starter `11.0.0` and Studio `2.0.0` without claiming those artifacts were physically tested.
- Acceptance test: `node scripts/validate-learning-catalog.mjs --verify-remote` downloads all 22
  distinct sources, recomputes their blob hashes, and compares the catalog versions with
  `ARES-Robotics/main/release/ares-versions.properties`.

### ACADEMY-MONO-02 — Medium — confirmed — high confidence

- Evidence: `robotics-foundations/01-ares-workspace.md`, `areslib-fundamentals.md`, and the starter
  lessons described separate source repositories and omitted `project-schema`, `project-model`,
  `project-compiler`, `simulation-foundation`, `frc-runtime`, schema-4 ownership modes, and the
  standalone-project boundary.
- Impact: contributors could edit a public mirror or generated file, put behavior in the wrong
  build, or assume Studio reverse-engineers arbitrary Kotlin.
- Remediation: the lessons now distinguish source-monorepo ownership from isolated Gradle/runtime
  boundaries, describe the canonical `.ares` → model → compiler IR → generated artifact flow, and
  explain `GUI_OWNED`, `CODE_FIRST`, and `HYBRID` ownership.
- Acceptance test: human review must trace one proposed change to its owning directory/build and
  distinguish a canonical document, user-owned extension, generated output, and public mirror.

### ACADEMY-MONO-03 — High — confirmed — high confidence

- Evidence: `current-robot/03-intake-fault-recovery.md` referenced
  `TeamCode/.../hardware/FtcIntakeIO.kt`, which is absent from the merged Lightbot source. The
  authoritative current example is `.ares/subsystems/indicator-lights.aressubsystem` plus
  `docs/examples/GUI_OWNED_LIGHTING.md`.
- Impact: the public tutorial claimed current hardware and failure behavior that no longer exists,
  which is especially misleading for students and physical-robot work.
- Remediation: the obsolete lesson is proposed for exact-precondition archival. A new,
  independently reviewed `ftc-gui-owned-indicator-lights` draft teaches the current descriptor,
  generated Redux/lifecycle path, safe-off output, simulator evidence, and physical-validation
  boundary.
- Acceptance test: the old slug archives only if its exact live identity still matches; the new
  slug stages and publishes only through separate human-approved phases.

### ACADEMY-MONO-04 — Medium — confirmed — high confidence

- Evidence: the existing migration runner could create new drafts or apply special legacy
  replacements, but it could not safely refresh the 17 already-published catalog lessons.
- Impact: a bulk rewrite risked overwriting coach edits, while manual edits would lose the catalog's
  immutable provenance and repeatable review digest.
- Remediation: `refresh-published` is approval-gated and bounded to 25 records. Each proposal binds
  the reviewed new content to exact old title/version/status preconditions and a normalized old-body
  SHA-256. Transactional rechecks, revision records, redacted audits, backup confirmation, rollback
  manifests, and post-write verification remain mandatory.
- Acceptance test: migration tests prove a matching body is ready and a one-line later coach edit
  blocks with `content` reported as the mismatched field.

### ACADEMY-MONO-05 — Low — confirmed — high confidence

- Evidence: `src/app/page.tsx` still called the product “ARES Analytics” and linked to the retired
  component repository URL.
- Impact: public product identity and source navigation disagreed with the monorepo.
- Remediation: the public section, privacy/terms references, and branding test now use “ARES
  Robotics Studio”; the source link targets `ARES-Robotics/tree/main/ARES-Analytics`.
- Acceptance test: the home branding test queries the new accessible heading and the source link is
  covered by normal UI review.

## Remaining human and operational gates

1. Render and review the 17 refreshed lessons and the new indicator-light lesson as Lead Coach.
2. Generate approval manifests for `refresh-published` and the new draft only after that review.
3. Export the affected Firestore records and verify the private backup URI.
4. Dry-run `cleanup`, `stage-drafts`, `refresh-published`, and `publish-drafts`; investigate any
   precondition mismatch rather than weakening it.
5. Request explicit production-write approval immediately before applying those phases.
6. Smoke-test public Academy paths, related-lesson navigation, narrow screens, keyboard use, and
   source links after publication.

Compilation and simulation remain software evidence only; none of this audit validates physical
wiring, calibration, safe enablement, or robot behavior.
