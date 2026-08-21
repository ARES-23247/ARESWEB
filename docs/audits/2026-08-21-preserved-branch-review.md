# Preserved branch review

**Date:** 2026-08-21

**Baseline:** `0a681a9d8e7c20368b712a624c90f7ae7f0998ab` (`master`)

**Reviewed branches:**

- `codex/oauth-homepage-exact-identity` at `a652020744d69990b4f867fcd142b1ed43feb75e`
- `content/blog-archive` at `27af9c53129a2715ede02a435b84f61bc76e625b`

**Worktree:** clean before review; the accepted social-link rebuild was made on
`codex/social-link-housekeeping-20260821`.

## Disposition

### Reject and remove the attendance/notebook feature branch

The branch is not safe to merge or rebase onto the current application. The
homepage identity patch was already incorporated independently. The remaining
attendance and notebook implementation violates current data, privacy,
truthfulness, and error-state boundaries.

| Severity | Confidence | Evidence | Impact | Required remediation and acceptance test |
| --- | --- | --- | --- | --- |
| High | Confirmed | `9fe45089:src/hooks/dashboard/useAttendanceAnalytics.ts:35,78-90,252-285` | A browser reads every event and then every signup subcollection, exposes youth attendance/name/role data to the client, accepts obsolete `lead` authorization, and writes attendance directly from UI code. The query is unbounded and N+1. | Rebuild behind an authenticated admin/coach API with explicit DTOs, current-role allowlists, App Check, pagination, aggregate queries, equivalent Firestore rules, and full allow/deny emulator tests. |
| High | Confirmed | `9fe45089:src/app/notebook/page.tsx:57-110` and `9fe45089:src/app/notebook/[slug]/page.tsx:38-78` | Production route modules contain invented engineering records, people, measurements, and claims for test/E2E mode. Public Firestore failures are also converted into an empty catalog. | Use external test fixtures and approved published records only. A failed public query must render an explicit retryable error. Tests must prove no fabricated record is bundled and distinguish empty, denied, unavailable, and not-found states. |
| Medium | Confirmed | `9fe45089:src/app/dashboard/attendance/page.tsx` | Attendance rankings label students as gold/silver/bronze or “at risk” and export names and participation metrics without a documented need, retention policy, or adult-approved privacy workflow. | Obtain an explicit team policy and data-minimization design before implementation. Test that only authorized adults can retrieve the minimum required fields and that exports are deliberate and auditable. |

One small footer change was reconsidered rather than copied. Live public metadata
confirmed the current Instagram account is `aresftc23247`, not the branch's
empty `ares23247` profile. The branch did identify the correct Facebook page ID.
Current `master` now centralizes the independently verified full destinations
and includes regression tests.

### Preserve the blog archive without merging it

`content/blog-archive` contains one unpublished technical article, source SVGs,
rendered images, and author notes. It does not change application runtime code
and has no open pull request. The article includes dated cross-repository line
counts and implementation claims that must be reverified against all four live
repositories before publication. Keeping this explicitly named archival branch
avoids adding unpublished content and roughly 300 KB of duplicate rendered
assets to the website repository's active history.

## Verification performed

- compared each remaining branch and patch identity against current `master`;
- inspected every unique commit and changed-file inventory;
- traced attendance reads, writes, role checks, error handling, and embedded
  fixtures;
- checked current route/config consumers before classifying code as superseded;
- verified the candidate social destinations through public HTTP responses and
  profile metadata;
- added focused footer and structured-data regression tests for the accepted
  rebuild;
- root and Functions lint, TypeScript, runtime, and agent validation passed;
- frontend coverage passed with 124 files and 680 tests;
- Functions coverage passed with 57 files and 717 tests;
- Firestore and Storage rules passed 24 emulator tests;
- the production build and bundle budgets passed;
- Playwright passed all 95 tests across the five configured browser/device
  projects;
- the production dependency audit reported no known vulnerabilities.

No production data, Firebase configuration, secret, or deployment was changed
during this review.
