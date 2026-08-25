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

The current repository intentionally contains no production writer for this migration. Adding or running one requires separate authorization and Application Default Credentials in an approved operational environment; service-account keys must never be added to the repository.
