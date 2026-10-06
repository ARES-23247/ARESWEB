# October 3, 2026 audit remediation

Follow-up to the [October 3, 2026 fresh website audit](2026-10-03-fresh-website-audit.md). All seven findings (B01–B07) are fixed in source on branch `codex/fresh-audit-2026-10-03`. Each fix has a regression test that fails against the audited code. Production data, rules, secrets and deployment state were not changed by this work. Nothing was deployed.

## Fixes

| Finding | Change | Regression evidence |
| --- | --- | --- |
| B01 (Medium): member-writable event revisions | `events/{eventId}/revisions` is now read-only for authorized members. Client `create`, `update` and `delete` are denied for every role. The audited Calendar API (Admin SDK) remains the only writer. | Emulator test seeds a server-shaped revision. A member can read it by `getDoc` and by the dashboard's `orderBy("timestamp","desc")`/`limit(50)` query. Unauthenticated reads fail. Member and admin create, update and delete all fail. |
| B02 (Medium): anonymous Waggle Way traffic drained the shared game budget | Anonymous public reads and guest reports no longer charge the shared 500,000-unit monthly online-game budget. They have separate monthly calendar ceilings: 150,000 reads and 5,000 reports. Their existing per-IP hourly and global daily limits still apply. Member, proof and management routes still use the shared budget. | The route test checks that guest reads and reports never create the shared monthly quota document. With that document exhausted, `/gardens` still returns 200 and guest reports still reach the domain (404 for an unknown garden), while member `/mine` returns 429. The test failed against the audited router. |
| B03 (Medium): production dependency audit failed | pnpm overrides raise `@grpc/grpc-js` to 1.13.6 (web SDK Node build) and 1.14.5 (google-gax). They also raise `@fastify/busboy` to 3.2.1 or later, `brace-expansion` to 2.1.7 or later, `fast-uri` to 3.1.8 or later, `ip-address` to 10.7.1 or later and `dompurify` to 3.4.16 or later. The standalone Functions npm deploy lock has matching overrides. Each gRPC range stays on its existing minor line. | `pnpm audit --prod` reports no known vulnerabilities. `npm audit --omit=dev` in `functions/` reports 0 vulnerabilities. The deploy-lock check, rules tests (Node web SDK over gRPC) and full Functions suite pass. |
| B04 (Low): one client could hold the only BIOBUZZ room or exhaust admissions | Admission adds a per-address share of 120 requests/day and a project share of 400 requests/day. These stack with the existing 60/hour per-address and 4,000/month project limits. `create` also counts against 6/hour and 20/day per address. A create request reserves all budgets in one transaction, and Express mount matching covers `/create` path variants. A waiting private room expires after 90 seconds while it holds at most one player; the 180-second limit still applies to every waiting room. `infra/gcp/biobuzz-service.json` and its deployment validator record the limits. | The HTTP test runs six creates from one address and checks that the seventh, `create/` and `CREATE` all return 429. The same address can still queue, and other addresses can still queue and create. A seeded per-address daily share blocks only that address. The room test releases a lone private lobby at 90 seconds, frees capacity for public matchmaking, and keeps a lobby with a guest until 180 seconds. A contract-parity test checks code limits against the contract. Validator tests reject drift in the new fields. |
| B05 (Low): permissive rules on retired collections | `team_layouts`, `judge_access_codes`, `orders` and `chat_sessions` are deny-all for browser clients. Admin SDK access is unchanged. `user_profiles/{userId}/layouts` is unchanged. | Emulator test seeds each collection with rules disabled. Member and admin `getDoc`, collection `getDocs`, create, update and delete all fail. The existing owner test for `chat_sessions` now asserts denial. |
| B06 (Low): Firebase ID token sent to the BIOBUZZ origin | `authenticatedFetch` now attaches the Firebase ID token and App Check header only to this site's origin. That covers relative URLs, same-origin absolute URLs and `Request` objects. BIOBUZZ admission calls the simulator origin with plain `fetch` and the App Check header only. `Request` inputs now keep their own headers when no `init.headers` are given. | API tests check that same-origin absolute URLs get both credentials. Cross-origin, protocol-relative and `Request` inputs get neither, and no token is minted for them. The BIOBUZZ client test checks the App Check header is sent and `Authorization` never is. |
| B07 (Low): sitemap missing indexable routes | `STATIC_URLS` adds `/arcade`, `/buzzhex`, `/buzzle`, `/buzzle/word-tools`, `/buzzello`, `/pollen` and `/biobuzz/simulator`. `/waggle-way` and `/developer-api` remain excluded because they are noindex. | A parity test requires the server sitemap to list exactly the indexable prerendered routes, with no duplicates. It failed with the seven missing routes before the fix. The sitemap route test asserts that the new routes are present and the noindex routes are absent. |

## Compatibility and operational notes

- **Release scope.** Deploy the Firestore rules, Functions (API and game service) and the BIOBUZZ Cloud Run service together through the protected release workflow. No data migration is required.
- **Retired collections.** Existing documents in these collections become reachable only through the Admin SDK. A future feature must ship a validated schema and new tests before reopening client access.
- **Waggle Way quota documents.** The new monthly ceilings use new quota scopes, so they start at zero after deployment. Existing shared-budget documents keep their counts; anonymous traffic simply stops adding to them.
- **BIOBUZZ address limits.** These limits count client IP addresses, as resolved behind the single trusted Cloud Run proxy hop. They are fairness bounds, not identity guarantees: users behind a shared network share one allowance. A lone private host now has 90 seconds to bring in a second player or start a bot match.
- **Cross-origin `authenticatedFetch` calls.** These calls now receive no Firebase credentials. Every current caller either uses relative `/api` paths or fetches public URLs that need no credentials. BIOBUZZ attaches App Check explicitly.
- **Test timeout.** The 300-request Waggle Way auth-limiter test now has an explicit 30-second timeout. It timed out at the 5-second default under full-gate load. Its assertions are unchanged.

## Verification

Validation date: October 3, 2026, on commit `e51f051d` (code fixes; the docs-only commit follows). Toolchain: Node 24.18.0, pnpm 11.21.0, OpenJDK 21.0.12.

| Required check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed |
| `pnpm run validate:agents` | Passed |
| `pnpm run check:route-security` | Passed |
| `pnpm run validate:functions-deploy-lock` | Passed |
| `pnpm run test:release-tooling` | 20 tests passed |
| `pnpm run lint` | Passed |
| `pnpm --filter functions lint` | Passed |
| `pnpm run typecheck` | Passed |
| `pnpm run test:coverage` | 2,007 tests in 296 files passed, 91.52% lines; ratchets passed |
| `pnpm --filter functions build` | Passed |
| `pnpm --filter functions test:coverage` | 1,033 tests in 85 files passed, 95.72% lines; ratchets passed |
| `pnpm run test:rules` | 37 tests in 2 files passed |
| `pnpm run build` | Passed |
| `node scripts/check-bundle-size.mjs` | All budgets passed |
| `pnpm run test:e2e -- --workers=3` | 647 of 648 passed; see note below |
| `pnpm audit --prod --audit-level=high` | No known vulnerabilities found |
| `npm audit --omit=dev --audit-level=high` (in `functions/`) | 0 vulnerabilities |

**E2E note.** One test failed in the full run: `biobuzzSimulator.spec.ts:210` (Firefox), "BIOBUZZ separates Aim from Shoot and keeps intake toggled". After one shot, the local-practice inventory stayed at 1/4 instead of the expected 2/4 for the full 10-second wait. The test exercises the local simulator only. None of these changes touch the simulator's engine or input paths; the online admission client is not used in local practice. In isolated reruns, all nine BIOBUZZ simulator specs passed in Firefox, and that test passed four more times with `--repeat-each=4 --workers=2`. No timeout, assertion or retry setting was changed.

Logs are in the Git-ignored directory `scratch/remediation-2026-10-03/`: `gate-summary.txt` and `gate/*.log`.

## Release follow-ups (October 6, 2026)

The first PR run failed two required gates for reasons outside these fixes. Both are resolved on the PR branch:

- **Academy provenance.** The official ARES-Robotics line moved to ARES 19.1.4 / Studio 7.0.65, and the remote provenance check failed on master as well. The refresh under the standing approval is recorded in [ARES_SOURCE_REFRESH_2026-10-03.md](../ARES_SOURCE_REFRESH_2026-10-03.md).
- **Production dependency audit.** After B03, new advisories were published for `proxy-addr` (critical), `sharp`, and `@modelcontextprotocol/sdk`. Patched versions are pinned through workspace overrides and the standalone Functions npm overrides and lock. Both audits report no vulnerabilities.

A full local unit-coverage run also showed a load-dependent race in `WaggleWayCommunity.test.tsx`: the heading takes focus in a passive effect after it renders. The test now waits for that focus. The assertion is unchanged, and the test passed five isolated reruns plus a full coverage run.
