# Competition Operations Reliability Cycle

- Date: August 14, 2026
- Audited baseline: `a66cb2e7ed9e9c881b4f744497ed1a4fcfe63056`
- Branch: `codex/post-release-audit-20260814`
- Scope: scheduled inquiry retention, tournament and match APIs, tournament
  management UI, event-day match workflow, date rendering, and focused tests
- Worktree: implementation changes present; production still serves the audited
  baseline until the protected release workflow completes

## Outcome

This cycle confirmed and remediated four correctness or reliability defects and
completed two bounded competition-operations workflows. No authorization was
broadened, no production data was modified, and no secret was rotated. This is
a scoped result, not a claim that the complete application is defect-free,
secure in every configuration, or WCAG conformant.

## Confirmed findings and remediation

| ID     | Severity | Confidence | Evidence                                                                                                                                                                           | Impact                                                                                                                                                   | Remediation                                                                                                                                                                                                                                                                                             | Acceptance evidence                                                                                                                                                                                                                              |
| ------ | -------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| COP-01 | Medium   | High       | `functions/src/index.ts:98-145` previously caught a Firestore cleanup error and returned successfully.                                                                             | Failed inquiry-retention runs could suppress Functions failure telemetry and retries while stale encrypted PII remained.                                 | The daily job now has a bounded three-attempt retry policy and rethrows failures after redacted logging. The operations contract is documented at `docs/SECURITY_OPERATIONS.md:114-119`.                                                                                                                | `functions/src/__tests__/index.test.ts:74-98` verifies retry configuration and the cleanup failure test verifies rejection.                                                                                                                      |
| COP-02 | Medium   | High       | Tournament views constructed `Date` directly from stored `YYYY-MM-DD` strings. ECMAScript interprets that form as UTC, which can display the previous day in negative UTC offsets. | Event dates could be wrong for the team's local users.                                                                                                   | `src/lib/dateOnly.ts:1-30` validates the calendar value and constructs local date components; all tournament list/detail surfaces use it.                                                                                                                                                               | `src/test/dateOnly.test.ts:4-28` verifies local components, exact output, and malformed/impossible dates; the integrated tournament test expects April 29.                                                                                       |
| COP-03 | Medium   | High       | Add/edit/archive controls closed or cleared before API confirmation; new blank scores were converted to `0`; the old editor updated only scores and outcome.                       | A transient request failure could discard scouting notes or imply a false 0-0 result, and correcting teams or alliance data required recreating a match. | Match writes now await confirmed mutations and retain drafts/confirmation on failure. `TournamentMatchEditForm` edits the complete record. Blank new scores remain absent and deliberate score clearing sends `null`, validated by the backend schema at `functions/src/routes/tournaments.ts:115-130`. | `src/test/TournamentMatchEditForm.test.tsx` covers full edits, rejected saves, and score clearing; `src/test/Tournaments.test.tsx:464-514` covers failed-add draft retention and no fabricated score; the route suite verifies nullable updates. |
| COP-04 | Low      | High       | The tournament analytics copy said OPR was automatically calculated by ridge regression, while the live manager accepts manually entered OPR values.                               | Users could mistake recorded data for a computed metric.                                                                                                 | The detail copy now says OPR and outcomes are records saved by authorized administrators or coaches and recommends reviewing source/context.                                                                                                                                                            | The integrated tournament test rejects the former “automatically computed” claim.                                                                                                                                                                |

## Feature completion

### Event-day match summary

The authenticated tournament detail now derives checklist progress, recorded
win-loss-tie counts, and average scored-match points from the same bounded match
list already loaded for the page. `src/lib/tournamentStats.ts` is a pure utility;
it does not infer outcomes or scores that are not present. The summary is exposed
as a labeled section with a native progress element.

### Season and challenge context

The API already supported `seasonName` and `challengeName`, but tournament
administrators could not enter them and users could not see them. The management
form now captures the optional bounded values and the list/detail surfaces show
them. This completes an existing data contract rather than adding a new storage
boundary.

## Verification evidence

Completed before this report:

- frontend focused tests: 5 files, 26 tests passed;
- Functions focused tests: 2 files, 37 tests passed;
- frontend full coverage: 86 files, 481 tests passed;
- Functions full coverage: 45 files, 568 tests passed;
- root and Functions lint passed with zero warnings;
- root TypeScript and Functions build passed;
- production dependency audit reported no known high-severity vulnerability.

The complete Node 22 / Java 21 release gate, protected pull request, deployment,
and independent production verification remain required before these changes
are described as released.

## Residual risks and follow-up

- Match updates are last-write-wins. If simultaneous pit and stands editing
  becomes common, add an explicit record version/precondition instead of
  silently merging competing edits.
- OPR remains an administrator-maintained value. Importing official event data
  or calculating a reproducible metric requires a separate product decision,
  source contract, and tests.
- Manual keyboard, screen-reader, 200%/400% zoom, and narrow-screen checks remain
  required for the complete competition workflow before any accessibility
  conformance claim.
- The touched legacy files were normalized by the repository formatter, which
  increases textual diff size. The semantic additions remain scoped to the
  behavior and tests described above.
