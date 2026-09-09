# Dependency and branch reconciliation — 2026-09-09

The owner requested reconciliation of all branches and repository cleanup after
reporting seven open Dependabot alerts. Integration started from protected
`master` commit `83b7717080dda6ddbc05090c88b15745e778bf6b` in an isolated worktree.
The only open PR was #269, whose approved Firestore alert documentation was
merged into this integration branch without conflicts.

## Dependency changes

| Package | Previous resolution | New resolution | Advisory |
| --- | --- | --- | --- |
| js-yaml | 4.3.1 | 4.3.2 | GHSA-2883-xcg3-v3hh |
| morgan | 1.11.0 | 1.12.0 | GHSA-jxfw-x594-9x9m |
| colord | 2.9.3 | 2.10.0 | GHSA-2wm5-q62r-hmrv |
| hono | 4.13.1 | 4.13.7 | GHSA-gqvv-2mrq-wpjv, GHSA-crvj-82cr-hjcx |
| csv-parse | 5.6.0 | 7.0.2 | GHSA-8cw4-87c7-c6xx |
| nanoid | 3.3.16 | 3.3.18 | GHSA-2v37-7h3g-55p8 |
| @opentelemetry/core (Pub/Sub) | 1.30.1 | 2.8.0 | GHSA-8988-4f7v-96qf |

The last two findings appeared in the full registry audit beyond the seven
alerts in the owner's screenshot. The lockfile also deduplicated an existing
express-rate-limit resolution to 8.7.0. The standalone Functions npm manifest
and lockfile are unchanged.

Firebase CLI's CSV dependency is overridden to the fixed major; its CommonJS
callback API remains available. The regression test parses quoted content and
duplicated `__proto__` columns while requiring an ordinary record prototype.
The Pub/Sub override is scoped to its OpenTelemetry dependency. Pub/Sub uses
the stable `W3CTraceContextPropagator` export; a regression test verifies trace
extraction and the fixed 180-entry inbound baggage bound.

### Remaining version-based advisory

`firebase-tools@15.29.0` still requires CommonJS `stream-json@1.x`. Its upstream
fixed 3.x major changes the API and module layout, so overriding it would break
the CLI. Keep `patches/stream-json@1.9.1.patch` and its pnpm integrity binding.
The patch backports the upstream default 1,024-level depth limit described in
[GHSA-528h-pc64-c93x](https://github.com/uhop/stream-json/security/advisories/GHSA-528h-pc64-c93x).
A regression test exercises Firebase CLI's actual parser and public Pick filter
with 1,050 nested objects and requires a depth-limit error. The existing custom
limit and invalid-option tests remain in place.

The full registry audit after these changes reports one moderate version-based
entry for stream-json and no other findings. This advisory remains visible;
it is not dismissed or excluded from audits. Remove the backport only when
Firebase CLI supports a compatible upstream-fixed dependency, with the CLI and
emulator tests passing. The current scope is a verified backport, not a claim
that the installed package version is upstream-fixed.

## Branch preservation and cleanup rules

- Every linked checkout was clean at inventory time. Preserve ignored local
  files and tooling caches; do not recursively delete retired worktrees.
- Before removing branch pointers, a complete Git bundle of all refs was
  created and verified under root `scratch/repository-cleanup-evidence/`.
- Old remote tips must be ancestors of master, or exactly match a merged PR's
  recorded source tip with its merge commit reachable from master.
- The closed flower-balance (#257) and Printables (#258) branch patches are
  present in the merged Arcade release (#259), verified with `git cherry`.
- The original `feat/pollenator-pile-up` tip is an ancestor of the exact source
  branch merged through #253. Re-merging its old files would restore obsolete
  ownership and bypass subsequent game fixes.
- Delete remote refs with explicit expected-tip leases. Preserve any branch
  that advances during this operation for a new review. Detach clean retired
  linked checkouts before deleting their proven-integrated local branches.
- Reconcile #269 through this release, preserve protected branch checks, and
  verify the resulting production workflow before reporting release completion.
