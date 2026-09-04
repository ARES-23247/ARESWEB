# September 4 website audit remediation

This change addresses A01–A06 from [the fresh audit](2026-09-04-fresh-website-audit.md). Changes are local and have not been deployed. The pre-existing webhook and deployment work remains intact.

## Changes and regression coverage

| Finding | Fix | Regression evidence |
| --- | --- | --- |
| A01: finance rules bypass | Deny direct reads and writes to `finance_transactions`. Public and admin/coach consumers already use API DTOs; all writes now require the validated API path. | Emulator matrix denies reads, queries, creates, edits, and hard deletes for admin, coach, mentor, and member clients. HTTP tests exercise admin/coach CRUD and archival, deny other roles and archived accounts, require App Check, and derive recorder identity from the token. |
| A02: deleted public content | Share lifecycle checks across direct content reads, content photo gateways, web metadata, RSS, and sitemap generation. Reject boolean/numeric deletion and unknown flag values. | HTTP API and web metadata tests use the same active/deleted fixtures. Media tests reject archived and malformed flags. The shared helper has a 100% line/function/branch coverage ratchet. |
| A03: ownerless draft takeover | An owner document may only be created when its content document did not exist before the atomic write and exists afterward. | Emulator tests cover posts, docs, and documents: standalone and atomic takeover attempts fail; atomic new draft + owner creation succeeds; owner edits succeed and other-member edits fail. |
| A04: destructive robot updates | Remove create-only defaults from the update schema. Persist only supplied fields, while allowing explicit empty optional fields and empty version arrays. | HTTP tests pass through authentication, schema parsing, and persistence; a name-only update preserves content, links, language, and versions. Explicit clearing works and empty/invalid updates fail. |
| A05: currency rejection | Validate decimal digits and calculate integer cents from whole/fractional parts; reject unsafe cent totals and invalid input types. Preserve the existing dollar-valued storage contract. | HTTP cases accept 0.29, 1.10, 19.99, whole dollars, and decimal strings; reject extra precision, nonpositive values, unsafe totals, objects, booleans, and non-finite representations. |
| A06: navigation disclosure mismatch | Make click/Enter/Space activation the sole mechanism for opening desktop disclosures. Closed content uses `hidden`; Escape closes and restores focus; moving focus outside closes the disclosure. Remove CSS-only hover/focus opening. | Component tests cover visibility, focus exit, Escape, and link activation. Browser regression covers tab order, Enter, click toggle, closed hover state, and Escape in desktop navigation across configured browser projects. |

## Compatibility and operational notes

- Legacy active content may still use `isDeleted: false` or omit the field, and older published content may omit approval metadata. These existing compatibility cases remain supported on direct reads. New content continues to use numeric `0/1`; malformed flags fail closed. Collection queries retain their existing explicit published/numeric-zero filters.
- Ownerless existing drafts cannot be claimed by browser clients. Publishers can continue their authorized editing workflows. If a member must own a legacy draft, an administrator should first verify authorship and perform a separately reviewed server-side ownership assignment. No blanket ownership backfill was performed.
- No data migration is required for the application and rules changes. Deployment must include both the Functions changes and Firestore rules. Production rules, records, secrets, and deployment state were not changed by this work.
- The original audit reproductions assert the former defective behavior. They are historical evidence, not post-fix regression tests. Use the maintained test suites below to verify the fixes.

## Test reliability

The BUZZLE match-completion test now scopes turn-button lookups to the turn-controls landmark and handoff dialog, avoiding repeated searches through the 217-cell board while still driving real game transitions and checking the final scoreboard and rematch behavior.

The analytics browser test waits for DOM readiness plus its existing UI assertions instead of waiting for the complete page load, which includes external font requests. Consent, persistence, mobile dimensions, and minimum button-height assertions remain in place. Test timeouts and coverage thresholds were not relaxed.

The initial full browser run passed 210 tests and failed the new dropdown test in the two WebKit projects. Diagnostics confirmed that this runtime moves focus from the trigger to Resources, skipping native links, with both Tab and Alt+Tab. The corrected test asserts that this focus exit closes the disclosure, reopens it, and focuses the link to test Escape. Chromium and Firefox retain the native Tab-to-link assertion. All five projects passed the focused rerun. No application elements or accessibility checks were removed to accommodate WebKit.

## Verification

Validation date: September 4, 2026. Baseline HEAD remains `444959221b5f94c59d5a979faff8f97119531e54`; these are uncommitted worktree changes. Node 24.19.0, pnpm 11.21.0, and Java 21.0.12 were used. The diff for all 12 pre-existing modified files matches the audit snapshot.

| Required check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed; lockfile unchanged |
| `pnpm run validate:agents` | Passed |
| `pnpm run check:route-security` | Passed |
| `pnpm run validate:functions-deploy-lock` | Passed |
| `pnpm run lint` | Passed, including after the browser test correction |
| `pnpm --filter functions lint` | Passed |
| `pnpm run typecheck` | Passed |
| `pnpm run test:coverage` | 1,224 tests in 231 files passed; 87.49% lines; ratchets passed |
| `pnpm --filter functions build` | Passed |
| `pnpm --filter functions test:coverage` | 893 tests in 74 files passed; 95.42% lines; ratchets passed |
| `pnpm run test:rules` | 33 tests in 2 files passed |
| `pnpm run build` | Passed |
| `node scripts/check-bundle-size.mjs` | All budgets passed |
| `pnpm run test:e2e -- --workers=2` | Final complete rerun: all 212 tests passed in 4.0 minutes, without retries |
| `pnpm audit --prod --audit-level=high` | No known vulnerabilities found |

Manual local-browser verification also confirmed that closed desktop links are absent from the accessibility tree, opening exposes the links, Tab reaches the first link with visible focus, and Escape removes the links and restores trigger focus. This is scoped verification of the changed interaction, not a WCAG conformance claim.

Detailed local logs are in `scratch/audit-fixes-2026-09-04/`, including `gate-summary.txt`, the initial gate logs, `e2e-final.log`, and browser rerun/diagnostic logs. Every required gate has a passing final result. `git diff --check` passed. No required check was skipped.
