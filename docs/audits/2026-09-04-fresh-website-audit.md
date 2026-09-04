# Fresh ARESWEB website audit — September 4, 2026

Follow-up: [local remediation and verification](2026-09-04-audit-remediation.md). The findings and results below describe the original audited state.

## Result

Six confirmed defects: **two high severity and four medium severity**. Prioritize the finance rules bypass and the deleted-content disclosure, then repair draft ownership, robot updates, currency validation, and desktop navigation. These findings come from current source and new reproductions, not previous audit reports.

This is a broad repository audit with targeted live UI inspection, not a claim of complete security or WCAG conformance. Production prevalence of malformed or ownerless records was not measured. No production records were edited, no forms submitted, and no deployment performed. Application source was left unchanged.

## Audited state and method

- Date: September 4, 2026, America/New_York.
- HEAD: `444959221b5f94c59d5a979faff8f97119531e54`.
- Branch: `codex/dependency-security-hardening`.
- Worktree: dirty before the audit. Existing modifications were included in the review and preserved: `docs/API_AUTHENTICATION.md`, `docs/ONSHAPE_ZULIP_INTEGRATION.md`, `docs/SECURITY_OPERATIONS.md`, `functions/src/__tests__/apiApp.test.ts`, `functions/src/__tests__/index.test.ts`, `functions/src/apiApp.ts`, `functions/src/functionConfig.ts`, `functions/src/routes/__tests__/webhooks.test.ts`, `functions/src/routes/webhooks.ts`, `infra/gcp/production-deployment.json`, `scripts/check-route-security.mjs`, and `scripts/verify-production-deployment.test.mjs`.
- Snapshot: `scratch/audit-2026-09-04/pre-existing-changes.patch`, SHA-256 `4DD8DD62E3A3CCC39BB59074BC5AD60A59C5A1C6079D15AE9DDCDE41A60BDB44`.
- Runtime: Node `24.19.0`, pnpm `11.21.0`, Microsoft OpenJDK `21.0.12`.
- Evidence directory: `scratch/audit-2026-09-04/`. Scratch logs and reproduction scripts are local working artifacts; the steps below also describe how to reproduce each finding.
- Reviewed active route declarations, API mounts, authorization/App Check/error middleware, Firestore and Storage rules, selected public DTOs and administrative writes, simulation sandboxing, navigation/forms, build/SEO/PWA configuration, public assets, and the production workflow. Source inventory under `src`, `functions/src`, `public`, and `e2e` contains 825 files; this is not a claim that every line was manually reviewed.
- Live inspection: [homepage](https://aresfirst.org/) and [join page](https://aresfirst.org/join), desktop and 390 × 844 mobile viewport. The browser had an existing admin session and a pending PWA update. These observations are not proof that the deployed version equals the audited worktree. No private roster or inquiry contents were collected.
- API reproductions use freshly compiled handlers with an in-memory Firestore stub. They verify DTO/schema/handler behavior, not the complete HTTP authentication chain. Rule reproductions use actual Firestore rules in a localhost emulator under `demo-aresweb-fresh-audit`, with synthetic identities and records only.

## Confirmed findings

### A01 — High: Firestore bypasses the finance API's role, validation, and retention controls

**Confidence:** high; reproduced against the emulator.

**Evidence:** `firestore.rules:517–519` permits mentors to read and write `finance_transactions`; `write` includes permanent deletion. In contrast, `functions/src/routes/finance.ts:161` and `:187` require `ensureAdmin` for the administrative API, and `src/app/dashboard/finance/page.tsx:67` restricts management to admins/coaches. The page explicitly promises admin-only receipt links at `:147`. The API archives records instead of deleting them at `functions/src/routes/finance.ts:206–229`.

**Trigger and impact:** an active mentor can use the Firestore SDK directly to read receipt URLs, change amounts or recorder identity without validation, and permanently delete ledger records. Admins/coaches also bypass server validation through direct writes. UI restrictions and API authorization do not protect this alternate data path.

**Reproduction:** seed a mentor authorization and a ledger entry containing a synthetic receipt URL. As that mentor, read the entry, update its amount to `-1000000` and `recordedBy` to another string, then delete it. All operations succeeded under the current rules. Output: `reproduce-rules.log`.

**Remediation:** deny direct client ledger writes and route all changes through the API. Deny raw reads, or restrict them to the exact intended admin/coach role set if there is a documented remaining client workflow. Preserve server-owned recorder identity and archival semantics.

**Acceptance test:** emulator tests deny mentor receipt reads and all direct create/update/delete operations; HTTP tests verify admin/coach create, edit, archive, restore, and validation failures. A mentor remains unable to use administrative API routes.

### A02 — High: Direct public content endpoints return boolean-deleted records

**Confidence:** high for code behavior; existence of affected production documents is unknown.

**Evidence:** `functions/src/routes/content.ts:27–30` rejects only `isDeleted === 1`. The predicate controls blog detail at `:75–86` and document detail at `:111–123`. By comparison, `functions/src/webRendering.ts:88` rejects both numeric and boolean deletion flags. Collection listings query numeric zero and can therefore hide the same record that its direct API URL reveals.

**Trigger and impact:** a record with `status: "published"`, approved status, and `isDeleted: true` remains available through `/api/content/posts/:slug` or `/api/content/docs/:slug?library=academy`. Archiving represented by a boolean does not withdraw its content from public access. This can disclose withdrawn blog or learning content even while its web route returns 404.

**Reproduction:** return a synthetic approved published record with `isDeleted: true` from the Firestore stub. Both detail handlers return its full content successfully. The document DTO additionally represents it as `isDeleted: 0` through `functions/src/lib/contentDtos.ts:51`.

**Remediation:** centralize publication/deletion checks across list, detail, rendering, media, and feed boundaries. At minimum reject both boolean `true` and numeric `1`; explicitly decide how missing or malformed flags should be treated and migrate legacy records through a reviewed operation.

**Acceptance test:** blog and document detail endpoints return 404 for both supported deleted forms; approved active records remain readable. Exercise the HTTP route and rendering boundary with the same fixtures.

### A03 — Medium: Members can claim existing drafts that lack an ownership record

**Confidence:** high; reproduced against the emulator. The number of ownerless production drafts is unknown.

**Evidence:** `firestore.rules:218–231` permits creating `content_owners` if the content exists after the operation; it does not require that the content did not already exist before the operation. The new owner then satisfies `isContentOwner` at `:48–51` and the member update checks at `:70–77`. The ordinary editor checks new-slug conflicts in `src/hooks/useDocumentSync.ts:333–337`, but that client check does not constrain a direct SDK request.

**Trigger and impact:** a member creates a previously absent owner record for another author's legacy or server-created draft, then edits or archives it. Existing ownership records cannot be overwritten, and this reproduction does not bypass publication approval; the defect concerns ownerless existing content.

**Reproduction:** seed `posts/audit-ownerless` as a draft without `content_owners/posts__audit-ownerless`. A different member creates that owner record naming themselves, then updates the draft title. Both writes succeeded. Output: `reproduce-rules.log`.

**Remediation:** allow client owner creation only alongside creation of a previously nonexistent content document. Assign or repair ownership for existing content through a server-authorized workflow. Apply the invariant consistently to posts, docs, and documents.

**Acceptance test:** an atomic new draft + owner transaction succeeds; claiming an existing ownerless draft fails; editing another member's draft fails; the legitimate owner can still edit pending content.

### A04 — Medium: Partial robot updates erase omitted metadata and version history

**Confidence:** high; reproduced through the installed schema and compiled handler.

**Evidence:** defaults are defined in `functions/src/routes/robots.ts:47–79`. `updateRobotSchema` derives from the create schema with `.partial()` at `:82–91`. `functions/src/middleware/validation.ts:14` replaces the request body with parsed output; `functions/src/routes/robots.ts:222–228` writes all of it to Firestore.

**Trigger and impact:** an accepted name-only update such as `{ "name": "Renamed" }` generates empty defaults for programming language, video and CAD links, mechanism, content, and `versions`. The subsequent update clears those existing values and the version history. The current frontend generally sends a complete editor record, which reduces exposure through that UI, but the API explicitly accepts partial updates.

**Reproduction:** parse a name-only update with the installed Zod version and pass the result to the handler with a synthetic existing robot. The captured write contains `programmingLanguage: ""`, `content: ""`, and `versions: []`, among other fields. The current tests check partial-update acceptance but do not assert preservation of omitted fields (`functions/src/routes/__tests__/robots.test.ts:94–99`).

**Remediation:** use an update schema without create-time defaults, or persist only explicitly supplied validated fields. Permit intentional clearing of optional fields without treating an entirely absent update as valid.

**Acceptance test:** name-only updates preserve every omitted field and version; explicit optional-field clearing works; empty requests are rejected. Test the validation middleware plus handler, not only the last handler with an unparsed body.

### A05 — Medium: Valid currency amounts fail validation due to floating-point equality

**Confidence:** high; reproduced through the compiled finance handler.

**Evidence:** `functions/src/routes/finance.ts:120–122` requires `Math.round(amount * 100) === amount * 100`.

**Trigger and impact:** normal two-decimal values such as `0.29`, `1.10`, and `19.99` fail with HTTP 400 because binary floating-point multiplication does not always yield an exact integer. An admin or coach cannot reliably record legitimate transactions.

**Reproduction:** invoke the create/update handler separately with those amounts, a valid date, and a synthetic description. Each returns a 400 validation error before writing.

**Remediation:** validate a decimal currency representation and convert to integer cents with explicit bounds, or apply a carefully bounded numeric tolerance before storing cents. Continue rejecting non-finite values, nonpositive amounts, and excess decimal precision.

**Acceptance test:** accept `0.29`, `1.10`, `19.99`, and ordinary whole-dollar values; reject `10.999`, zero, negative/non-finite values, and amounts outside the intended business bounds.

### A06 — Medium: Desktop dropdown visibility disagrees with its accessible expanded state

**Confidence:** high; confirmed in live UI and source.

**Evidence:** `src/components/navigation/NavDropdown.tsx:26` sets `aria-expanded` from React state, while `:40–42` separately opens menus through CSS hover/focus-within and hides them only with opacity/pointer events. Their links remain mounted and focusable. `src/components/Navbar.tsx:100–110` handles Escape by resetting React state, which cannot override the focus-within visibility rule.

**Trigger and impact:** the accessibility tree exposes Team and Resources child links while the buttons say collapsed. After activating Team and pressing Escape, the button reports collapsed but the menu stays visible while focus remains within it. A DOM inspection measured menu opacity `1` and link `tabIndex: 0` in that state. Screen-reader users receive misleading state, and keyboard users cannot reliably dismiss the overlay with Escape.

**Remediation:** control visual visibility and accessibility state from one mechanism. Remove closed content from focus/navigation with conditional rendering or appropriate hidden/inert handling. Implement hover/focus opening through the same state, and make Escape dismiss the menu while restoring focus coherently.

**Acceptance test:** in desktop browser tests, closed menus contain no reachable child links, `aria-expanded` matches actual visibility for pointer and keyboard use, Escape closes the menu while preserving sensible focus, and re-opening works. Preserve the working mobile dialog behavior.

## Verification

The initial sandbox prevented child-process creation (`spawn EPERM`) for Vitest, Vite, Playwright, and Java, and blocked registry access. These environmental failures were retried with the necessary permissions; they are not counted as application defects. The first locked install also stopped because a non-interactive pnpm invocation could not proceed; the interactive retry succeeded without dependency changes.

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed on retry; already up to date |
| `pnpm run validate:agents` | Passed |
| `pnpm run check:route-security` | Passed |
| `pnpm run validate:functions-deploy-lock` | Passed |
| `pnpm run lint` | Passed |
| `pnpm --filter functions lint` | Passed |
| `pnpm run typecheck` | Passed |
| `pnpm run test:coverage` | First executable run: 1,221 passed, one BUZZLE timeout. Full rerun with `-- --maxWorkers=2`: all 1,222 tests / 230 files passed; 87.49% lines, 83.6% functions on the configured coverage scope |
| `pnpm --filter functions build` | Passed |
| `pnpm --filter functions test:coverage` | 840 tests across 72 files passed; 95.42% lines, 98.04% functions |
| `pnpm run test:rules` | 31 tests across two files passed |
| `pnpm run build` | Passed, including static prerender |
| `node scripts/check-bundle-size.mjs` | Passed against fresh production build |
| `pnpm run test:e2e -- --workers=2` | 206 / 207 passed; mobile WebKit analytics test timed out at 45 seconds. The focused rerun below passed; the original full-suite run remains recorded as failed |
| `pnpm audit --prod --audit-level=high` | Passed; registry reported no known vulnerabilities |
| Security observability / deployment / game static contracts | Passed |
| `pnpm run test:content-migration` | 55 tests across five files passed |
| New isolated rule/API reproductions | All five backend findings reproduced |

The focused browser retry was `pnpm run test:e2e -- --project=mobile-webkit --workers=1 --grep "analytics choices" --trace=on`: one test passed in a 16.4-second run. The frontend retry was `pnpm run test:coverage -- --maxWorkers=2`: all tests and coverage thresholds passed. Both initial timeouts are intermittent observations with unresolved root causes, not confirmed product defects or proof of resource contention. They should be tracked for test reliability; neither was hidden by changing assertions or timeouts. The complete E2E suite was not rerun a second time.

An exploratory `node --test scripts/verify-production-deployment.test.mjs` invocation used the wrong runner for this Vitest file. Its failure is not a repository defect; the configured `pnpm run test:content-migration` suite subsequently passed, including that file.

The bundle gate measured 230,642 bytes gzip for initial JavaScript, 24,386 for initial CSS, 1,425,516 for total route JavaScript, and 2,786,498 for editor runtime JavaScript. All configured budgets passed. Academy interaction JavaScript was 92,073 bytes gzip against a 95,000-byte budget; this is limited headroom, not a budget violation. These are build measurements, not live Core Web Vitals.

## Coverage, strengths, and limits

| Area | Evidence and conclusion |
| --- | --- |
| Architecture and routes | Active source uses Vite/React 19/React Router, six API app groupings (public, core, media, drive, communications, game), Firebase Hosting, Firestore, private Storage gateways, dynamic web metadata rendering, and a bounded Cloud Run game service. Contracts validate 11 Functions and 15 health checks. |
| Authentication and privacy | Server middleware checks active authorized-user roles; public content generally crosses explicit DTO boundaries. Inquiry name, email, and metadata are encrypted before storage. User profiles are denied direct Firestore access. A01–A03 identify concrete exceptions to otherwise useful boundaries. |
| Uploads and simulations | Large photo routes apply authentication and quota middleware before the application-level body parser. Storage rules deny direct browser access to managed media. Simulation iframe uses `sandbox="allow-scripts"` and checks sender window identity. Cloud infrastructure buffering, Storage App Check deployment state, and exhaustive sandbox abuse were not independently tested. |
| Public UX and truthfulness | Store/leaderboard code uses unavailable or unranked states instead of invented catalog entries. Navigation points to the configured Printables profile rather than fabricating model inventory. No fabricated team dataset was confirmed in the sampled paths. Hardware-access and program claims on the join page still need team provenance; source text alone cannot establish their real-world truth. |
| Accessibility | Live mobile navigation moved focus to its close button, isolated background content in the accessibility tree, closed with Escape, and restored focus to the menu trigger. Join fields had programmatic labels. A06 affects desktop dropdowns. No comprehensive assistive-technology, contrast, zoom, or conformance certification was performed. |
| SEO and crawl behavior | Reviewed canonical metadata, static prerender, dynamic route rejection, robots/sitemap handling, and dashboard noindex headers. Publication checks diverge as A02 shows. Search engine indexing and production crawl coverage were not measured. |
| Test fidelity | Existing rule tests pass despite A01 and A03. The robot test checks partial schema acceptance without checking preservation; finance handler tests do not cover representative floating-point edge cases. Public-route E2E deliberately supplies API fixtures, so it does not verify live backend data or production authorization. |
| Delivery | Workflow pins actions to commit SHAs, uses WIF, builds release artifacts, validates runtime/invoker contracts, and deploys behind a production environment. Actual GitHub branch protections, environment approvals, cloud IAM, secrets, and deployed invoker state were not queried. A local contract pass does not prove live configuration. |
| Maintainability and dead code | Duplicated publication predicates and create-schema defaults reused for updates directly contribute to findings. No assets or code were declared orphaned or removed; exhaustive dynamic-reference analysis was outside this pass. |

## Reproduction commands and follow-through

From the repository root, after building Functions:

```text
node scratch/audit-2026-09-04/reproduce-api.mjs
pnpm exec firebase emulators:exec --project demo-aresweb-fresh-audit --only firestore "node scratch/audit-2026-09-04/reproduce-rules.mjs"
```

The scripts use synthetic records only. Their successful assertions establish the defective behavior; they are not regression tests asserting the desired secure behavior. Convert each acceptance test above into the relevant maintained suite when fixing it.

For a fix handoff, rerun the full repository verification gate and the new regression cases. Any production ownership backfill or deletion-flag normalization requires a separate reviewed migration and explicit approval. No such operation was attempted during this audit.
