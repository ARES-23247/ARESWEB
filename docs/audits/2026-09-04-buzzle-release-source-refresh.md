# Academy source refresh during the BUZZLE release

PR #252's remote provenance gate found a newer official release. The owner had
approved this website deployment and granted standing approval in `AGENTS.md`
for verified ARES reference refreshes, including major versions.

- Previous public authority: `5d9433ee407b1ae32614659dee0120946830ca72`
  (ARES 16.0.1, Studio 6.0.1, FTC/FRC starters 16.0.1).
- Reviewed public authority: `0f9e2e5dc35f35e506bd70ad89705f6ccc1a7d62`
  (ARES 17.0.1, Studio 7.0.1, FTC/FRC starters 17.0.1).
- The GitHub `main` commit and immutable `release/ares-versions.properties`
  agree. A separate bare clone of the official repository supplied source
  evidence; unrelated local monorepo work was not used.
- All 142 unique catalog paths exist. Six referenced blobs changed and 136
  stayed identical. Sixteen lessons reference at least one changed source.

## Source comparison and lesson treatment

| Changed source | Verified behavior and treatment |
| --- | --- |
| `release/ares-versions.properties` | Refresh current release text, immutable source links, catalog blob hashes, source authority and curriculum plan together. Historical screenshot assets and their identities remain unchanged. |
| `ARESLib-Kotlin/core/src/main/kotlin/com/areslib/Store.kt` | Subscriber notification captures a volatile array instead of indexing a changing copy-on-write list. Duplicate registrations remain independent, and removal is idempotent. Add this detail to the Redux lesson; the input-to-output ownership guidance remains valid. |
| `ARESLib-Kotlin/core/src/main/kotlin/com/areslib/sequencer/TaskExecutor.kt` | Suspension and preemption propagate timeout suspension; suspended preemption preserves charged execution time. Update the sequence lesson and reference. |
| `ARESLib-Kotlin/core/src/main/kotlin/com/areslib/sequencer/TaskGroupDispatcher.kt` | Built-in group timeout suspension descends into children. This is distinct from forwarding hardware-neutralizing `pause`/`resume` actions, so preserve that existing warning. |
| `ARESLib-Kotlin/core/src/main/kotlin/com/areslib/sequencer/Task.kt` | Path-event timeout origins shift across suspension. Followed `Task.setTimeoutSuspended` in `TaskTimeoutManager.kt` at the same immutable commit to verify that resumption does not start queued-child watchdogs. |
| `ARES-Analytics/docs/OPERATIONS.md` | Add the documented closed-session database/WAL backup and incompatible-schema recovery boundary to post-match evidence preservation. XRP identity/fingerprint requirements add no new lesson scope. |

## Verification and boundaries

Remote provenance validation recomputed all 142 pinned Git blob hashes and
verified the current version manifest. Catalog preparation and readability
checks passed. All three review-candidate batches validated and all 55
content/migration tests passed. The exact release commit remains subject to the
protected website CI gate, security analysis and production workflow.

The candidate remains `mode: review-candidate` with `requiresHumanReview: true`.
Only source identity and proposed review digests changed; batch membership and
production content preconditions are preserved. No Academy Firestore publication,
content migration, secret rotation, robot deployment or hardware test occurred.
This review inspects Kotlin source; it does not claim execution of the monorepo's
Kotlin tests. The game feature's full local test evidence remains documented in
`docs/BUZZLE_WORD_HELP.md`.

Comparison artifacts are recorded locally under `scratch/buzzle-physical/` as
`source-review.json` and `source-changes.patch`.
