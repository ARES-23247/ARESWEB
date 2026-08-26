# Academy Phase 3 controlled content launch

Audit window: 2026-08-25 EDT / 2026-08-26 UTC
Repository baseline: `564078c6ffdf433b0df3ecf952419bdb0fac8a30`
Working branch: `codex/academy-phase-3-content-launch`
Scope: three user-reviewed current-robot Academy tutorials only

## Outcome

The three authorized tutorials were rehearsed against the Firestore emulator,
backed up, staged, bound to one exact Lead Coach review digest, published, and
re-read from production. No other Academy body, status, or metadata was changed
by these two production batches.

Published slugs:

- `ftc-season-composition-and-safe-lifecycle`
- `ftc-driver-input-shaping-and-frames`
- `ftc-intake-io-fault-recovery`

Approval digest:
`c4d912d91cf442de36084ad278ae25900f44a54fb62939b38eafa3f391c700c4`

Public reviewer label: `Lead Coach`
Review date: 2026-08-25

## Backup and bounded writes

- Protected Firestore export:
  `gs://aresfirst-portal-firestore-backups/academy-migration/2026-08-26T012058Z`
- Export operation completed successfully with 451 documents. The bucket uses
  uniform access, enforced public-access prevention, seven-day retention, and
  seven-day soft delete.
- Stage batch: `academy-phase3-prod-stage-20260826-01`
- Publish batch: `academy-phase3-prod-publish-20260826-01`
- Each batch applied and re-read exactly three records.
- Every affected document has both a deterministic revision and a redacted
  `audit_logs` record. Audit records contain the slug, phase, changed fields,
  batch, backup URI, and—only for publication—the public reviewer label, review
  date, and digest. They do not contain lesson bodies or private reviewer data.
- A post-publication dry run reported `unchanged: 3`, `ready: 0`, `blocked: 0`,
  and `applied: 0`, demonstrating idempotence for this exact reviewed scope.

## Verification evidence

- Catalog validation passed for 18 source-controlled learning documents, four
  paths, and 15 cross-links.
- Remote provenance verification recomputed 16 pinned Git blob hashes and
  verified ARESLib v9.13.0 as the current authoritative release.
- Focused migration and catalog tests passed: 18 tests across two files.
- All three public detail DTOs returned HTTP 200 with complete learning
  metadata and source references. Internal migration metadata was absent from
  the DTOs; the deliberately public `reviewedByLabel` value was `Lead Coach`.
- Live Academy verification found the season-composition tutorial as lesson
  eight of the FTC robot path, with previous and related navigation, source and
  review provenance, local-progress controls, and no browser console errors.
- At a 390 by 844 viewport, the live lesson had no horizontal overflow and its
  heading, metadata, progress control, lesson body, and navigation remained
  available. This is a bounded responsive smoke test, not a claim of complete
  WCAG conformance.
- The full repository gate passed on Node 24.19.0, pnpm 11.21.0, and Java 21:
  agent configuration, route-security invariants, both linters, TypeScript,
  802 frontend tests with coverage, Functions build, 768 Functions tests with
  coverage, 30 Firebase rules tests, production build and prerendering, bundle
  budgets, all 111 Playwright cases across desktop/mobile/PWA projects, and a
  production dependency audit with no known vulnerabilities.

## Prior Academy migration status

Read-only audit inventory confirmed the earlier controlled phases are complete:

- eleven original Academy lessons: `academy-publish-20260825-01`;
- four ARESLib replacements: `academy-replacements-20260825-01`; and
- fifteen metadata-only cross-links: `academy-cross-links-20260825-01`.

Future work should create new, separately reviewed content rather than rerun
these completed migrations. Any content edit must return the document to pending
review and obtain a new exact-content approval digest before publication.
