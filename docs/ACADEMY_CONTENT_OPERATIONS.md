# Academy content operations

## Boundaries

The runtime website reads approved, published Firestore documents through explicit public DTOs. Files under `content/learning/` are review and migration sources only; they are never bundled as pretend live team content.

Do not publish from an active robot feature branch, a dirty worktree, or an unpinned source URL. Use a released tag or exact clean commit plus the Git blob hash. Simulation material must state what physical behavior remains unverified.

## Local validation and preparation

```powershell
pnpm run content:validate
pnpm run content:verify
pnpm run content:prepare
```

`content:validate` performs deterministic offline schema, reviewed source-authority, unique path-order, published-refresh, immutable commit-pinning, student-led robot-verification language, and middle-school readability checks. Every lesson must include clear sections and at least one code-native Mermaid diagram with a useful `%% aria:` summary. `content:readability` reports the estimated grade, word count, sentence average, and longest sentence. The estimate catches regressions but does not replace a student usability review.

Substantial curriculum entries declare `instructionalContractVersion: 2`. The
validator then requires purpose and prerequisites, vocabulary, a worked example,
a purposeful visual, hands-on activity, checkpoints, troubleshooting, an
evidence artifact, assessment, extension, and related/next navigation. Academy
interactive tags execute only when their generated registry entry is explicitly
approved and labeled `conceptual` or `code-derived`; other registered simulations
render a truthful unavailable-for-Academy note.

`content:verify` additionally downloads the exact pinned public source files, recomputes their Git blob hashes, and fails when the catalog's ARES, Studio, or starter version differs from the authoritative monorepo version file; CI runs this stronger check. The prepared artifact is `build/learning-content-import.json`. Every generated record remains `draft` with `approvalStatus: pending_approval`. None of these commands imports data or authenticates to Google Cloud.

Preparation normalizes Markdown line endings to LF so the staged record and its
review digest are identical on Windows, Linux, and CI.

## Legacy migration sequence

1. Export `docs`, their `revisions` subcollections, and affected ownership/audit records to an encrypted administrative backup.
2. Re-query the public API and compare every action with the preconditions in `content/learning/legacy-migration-plan.json`. Stop on any mismatch.
3. Load the exported data and prepared drafts into the Firebase Emulator Suite.
4. Apply the proposed archive/display/replacement actions in bounded batches in the emulator.
5. Verify old URLs, rendering, links, interactive components, search, subjects, learning paths, mobile reflow, keyboard use, and public DTO minimization.
6. Have a coach review each source-pinned website draft. Record a public reviewer label and date only after that review occurs. This editorial gate does not require mentor approval for student robot verification.
7. Obtain explicit approval immediately before any production write.
8. Apply one bounded production batch with checkpoints and write revision records before replacing existing content.
9. Re-read every affected document and smoke-test the public Academy and ARESLib routes.
10. Keep the backup until the production verification window closes.

Use [`ACADEMY_HUMAN_REVIEW.md`](ACADEMY_HUMAN_REVIEW.md) for the exact review
queue, protected preview links, replacement source files, cross-link proposals,
and acceptance checklist. The reviewer must list exceptions rather than approve
content they did not inspect.

## Bounded migration runner

`pnpm run content:migrate` is dry-run-only unless `--apply` is present. An apply
requires an exact project confirmation, a unique batch ID, a new ignored
rollback-manifest path, and the verified backup URI entered twice. The runner
uses Application Default Credentials; service-account keys must never be added
to the repository.

The supported phases are intentionally separate:

- `cleanup` archives the two reviewed test placeholders and removes Monty Hall
  from ARESLib while preserving its Academy publication.
- `stage-drafts` creates only new catalog slugs as `draft` and
  `pending_approval`; slugs listed for published refresh are excluded. It never
  overwrites an existing slug. Use
  `--stage-slugs slug-one,slug-two` for a bounded subset when other catalog
  lessons already exist or are published. A prepared review artifact may hold
  up to 100 documents, but every migration phase and approval remains capped at
  25 changes. Split a larger curriculum release into separately reviewed
  batches.
- `publish-drafts` publishes only explicitly approved staged catalog drafts and
  refuses the batch if any reviewed content field changed after staging.
- `refresh-published` updates only explicitly approved existing published
  lessons. It refuses each lesson unless its old title, version, publication
  state, and normalized Markdown SHA-256 still match
  `published-refresh-plan.json`, preventing an editorial change from being
  overwritten by a stale migration.
- `replacements` replaces only explicitly approved legacy ARESLib slugs.
- `cross-links` changes only explicitly approved existing-lesson metadata.

`publish-drafts`, `refresh-published`, `replacements`, and `cross-links` require a human
coach/mentor approval JSON whose `phase` and `reviewDigest` match the exact
requested operation. Generate the full-scope template before review:

```powershell
pnpm run content:approval -- --project aresfirst-portal --phase publish-drafts
pnpm run content:approval -- --project aresfirst-portal --phase refresh-published
pnpm run content:approval -- --project aresfirst-portal --phase replacements
pnpm run content:approval -- --project aresfirst-portal --phase cross-links
```

For a partial review, append `--approved-slugs slug-one,slug-two`. Copy the
generated template to an ignored administrative location, then fill in the
reviewer label and date only after that exact scope is reviewed:

```json
{
  "version": 1,
  "phase": "replacements",
  "reviewDigest": "64-character digest generated for this exact scope",
  "reviewedByLabel": "Public reviewer label",
  "reviewedAt": "YYYY-MM-DD",
  "approvedSlugs": ["reviewed-slug"]
}
```

The runner recomputes the digest from the exact source-pinned content,
replacement preconditions, and cross-link metadata. It refuses a stale approval
if any reviewed field, source, slug set, or proposal changes afterward. Review
dates must be real, non-future calendar dates. Approval-gated audit records store
the public reviewer label, review date, and digest for durable traceability; they
do not copy lesson bodies or private reviewer data.

Every phase re-reads exact preconditions inside one bounded transaction, writes
a deterministic revision and redacted audit record per changed document, adds
migration/checkpoint metadata, and re-reads the committed records. Repeating a
completed phase is a no-op. A later reviewed curriculum generation must advance
the runner's migration version before approval templates are generated. Revision
and audit IDs include that version, so a new generation preserves earlier
snapshots instead of colliding with or overwriting them. Production cleanup
example (use the actual verified URI and a fresh manifest path):

```powershell
pnpm run content:migrate -- --project aresfirst-portal --phase cleanup
pnpm run content:migrate -- --project aresfirst-portal --phase cleanup --apply `
  --confirm-project aresfirst-portal `
  --batch-id academy-cleanup-YYYYMMDD `
  --backup-uri gs://aresfirst-portal-firestore-backups/academy-migration/<snapshot> `
  --confirm-backup-uri gs://aresfirst-portal-firestore-backups/academy-migration/<snapshot> `
  --rollback-manifest academy-migration-backups/<batch>.json
```

The local manifest contains paths and hashes, not lesson bodies or PII. The
restorable data remains in the private, retention-protected Firestore export.
