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

`content:validate` performs deterministic offline schema and commit-pinning checks. `content:verify` additionally downloads the exact pinned public source files and recomputes their Git blob hashes; CI runs this stronger check. The prepared artifact is `build/learning-content-import.json`. Every generated record remains `draft` with `approvalStatus: pending_approval`. None of these commands imports data or authenticates to Google Cloud.

## Legacy migration sequence

1. Export `docs`, their `revisions` subcollections, and affected ownership/audit records to an encrypted administrative backup.
2. Re-query the public API and compare every action with the preconditions in `content/learning/legacy-migration-plan.json`. Stop on any mismatch.
3. Load the exported data and prepared drafts into the Firebase Emulator Suite.
4. Apply the proposed archive/display/replacement actions in bounded batches in the emulator.
5. Verify old URLs, rendering, links, interactive components, search, subjects, learning paths, mobile reflow, keyboard use, and public DTO minimization.
6. Have a coach or mentor review each source-pinned draft. Record a public reviewer label and date only after that review occurs.
7. Obtain explicit approval immediately before any production write.
8. Apply one bounded production batch with checkpoints and write revision records before replacing existing content.
9. Re-read every affected document and smoke-test the public Academy and ARESLib routes.
10. Keep the backup until the production verification window closes.

## Bounded migration runner

`pnpm run content:migrate` is dry-run-only unless `--apply` is present. An apply
requires an exact project confirmation, a unique batch ID, a new ignored
rollback-manifest path, and the verified backup URI entered twice. The runner
uses Application Default Credentials; service-account keys must never be added
to the repository.

The supported phases are intentionally separate:

- `cleanup` archives the two reviewed test placeholders and removes Monty Hall
  from ARESLib while preserving its Academy publication.
- `stage-drafts` creates only the 11 new catalog slugs as `draft` and
  `pending_approval`. It never overwrites an existing slug.
- `publish-drafts` publishes only explicitly approved staged catalog drafts and
  refuses the batch if any reviewed content field changed after staging.
- `replacements` replaces only explicitly approved legacy ARESLib slugs.
- `cross-links` changes only explicitly approved existing-lesson metadata.

`publish-drafts`, `replacements`, and `cross-links` require a human
coach/mentor approval JSON whose `phase` matches the requested operation:

```json
{
  "version": 1,
  "phase": "replacements",
  "reviewedByLabel": "Public reviewer label",
  "reviewedAt": "YYYY-MM-DD",
  "approvedSlugs": ["reviewed-slug"]
}
```

Every phase re-reads exact preconditions inside one bounded transaction, writes
a deterministic revision and redacted audit record per changed document, adds
migration/checkpoint metadata, and re-reads the committed records. Repeating a
completed phase is a no-op. Production cleanup example (use the actual verified
URI and a fresh manifest path):

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
