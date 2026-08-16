# Comprehensive Website Audit — 2026-08-15

## Scope and environment

- Baseline commit: `a92362da2f2f3e887872e467d6592da6270981bb` (`test(ci): add mobile WebKit coverage (#118)`), branch `master`. The audit began from a clean worktree; B2 is the only production remediation associated with this report.
- Runtime: Node v24.13.0 (see Finding A1), pnpm 11.21.0, OpenJDK 21.0.12 (emulators).
- Audit date: 2026-08-15. Reviewer: automated agent audit per `aresweb-comprehensive-audit` skill.

## Commands executed (all exit 0)

| Gate | Result |
| --- | --- |
| `pnpm run validate:agents` | Pass |
| `pnpm run lint` / `pnpm --filter functions lint` | Pass (`--max-warnings=0`) |
| `pnpm exec tsc --noEmit` | Pass |
| `pnpm run test:coverage` (frontend) | Pass, thresholds met |
| `pnpm --filter functions build` | Pass |
| `pnpm --filter functions test:coverage` | Pass, 47 files / 592 tests |
| `pnpm run test:rules` (emulator) | Pass, 20/20 |
| `pnpm run build` | Pass (22 prerendered route shells) |
| `node scripts/check-bundle-size.mjs` | Pass, all six budgets |
| `pnpm run test:e2e` | Pass, 80/80 across chromium, firefox, webkit, mobile-chromium, mobile-webkit |
| `pnpm audit --prod --audit-level=high` | No known vulnerabilities |

After the B2 remediation, `pnpm run test:rules` passed 20/20 again and
`pnpm run lint` passed with zero warnings.

## Areas inspected (evidence-based)

- **Firestore rules** (`firestore.rules`): authorization fails closed on unknown roles, archived
  users, and missing `authorized_users` docs; public reads gated on
  `status == "published" && isDeleted == 0` for posts/docs/documents/seasons/awards;
  inquiries, profiles, settings, videos, imported photos are server-only; task and comment
  writes are shape- and size-bounded; comment edits restricted to author.
- **Storage rules** (`storage.rules`): all writes denied except bounded content-manager uploads
  to `editor/uploads/**` (<5 MB, image content types); public reads limited to events photos,
  blog, gallery, editor uploads.
- **Cloud Functions middleware**: `apiApp.ts` enforces CORS allow-list (with PR-preview
  pattern), 300 req/15 min global limit, App Check enforcement on browser mutations with
  emulator/test bypass; the 12 MB photo-upload body is parsed only after auth and distributed
  quota. `auth.ts` verifies ID tokens server-side and normalizes legacy roles.
  `errorHandler.ts` logs server-side and returns generic 5xx with safe streaming-response
  handling. Webhooks use SHA-256 + `timingSafeEqual` token comparison (`webhooks.ts:130-148`).
- **DTOs**: `robots.ts` returns an explicit bounded DTO with URL allow-listing (Onshape only)
  and strict zod write schemas; frontend consumes the API (`src/app/robots/api.ts`), not raw
  documents.
- **Sandboxing**: all iframe sandbox attributes use opaque origins;
  `allow-scripts` is never combined with `allow-same-origin`
  (`src/components/editor/SimPreviewFrame.tsx:434`, `src/app/robots/[id]/page.tsx:158,172`,
  `src/app/videos/page.tsx:247`, `src/components/docs/DocsMarkdownRenderer.tsx:221`).
- **CI/CD** (`.github/workflows/ci.yml`): production auth uses the repository-restricted
  Workload Identity Federation provider (`projects/.../workloadIdentityPools/aresweb-github/
  providers/github-production`, line 271); `id-token: write` only on the deploy job; secrets
  declared per function group in `functionConfig.ts` secret bindings.
- **SEO/PWA**: prerendered public shells, canonical meta, sitemap routes, PWA service worker
  precache generated.

No confirmed security, privacy, or correctness defects were found in the audited commit.
The findings below are environment observations and technical-debt risks, not confirmed
defects.

## Findings

### A1. Audit executed on Node 24 while engines pin the Node 22 line — Low / Confirmed

- **Evidence**: `package.json` `engines.node: ">=22.13.0 <23"`; local runtime `v24.13.0`;
  `pnpm audit` printed "Unsupported engine" warnings for root and `functions`.
- **Impact**: Verification results in this report were produced on an unpinned runtime;
  Cloud Functions deploy builds and local behavior could diverge from validated results.
- **Remediation**: Re-run the verification gate on Node 22.13+ before release handoffs
  (e.g., `nvm use 22` or a pinned CI/devcontainer toolchain).
- **Acceptance test**: `node -v` reports `v22.x` and `pnpm install --frozen-lockfile` emits
  no engine warnings.

### B1. `functions/src/routes/simulations.ts` coverage below the 85% standard — Low / Confirmed (debt)

- **Evidence**: functions coverage report at commit `a92362da`: simulations.ts 69.51% lines,
  77.78% functions; suite passes because `functions/vitest.config.mts` ratchets global
  baselines to lines 65 / functions 82.
- **Impact**: The simulations route handles user-authored code; its error and rejection
  branches (lines ~70, 196, 201–238) are the least-exercised trust-boundary code in the
  package.
- **Remediation**: Add unit tests for the uncovered rejection paths and raise the file above
  85% lines / 100% functions, per the AGENTS.md rule that new API routes meet the full
  standard.
- **Acceptance test**: `pnpm --filter functions test:coverage` reports simulations.ts
  ≥85% lines and 100% functions.

### B2. Public raw Firestore read of `robots` bypasses DTO normalization — Low / Inference

- **Evidence**: `firestore.rules:280` allows unauthenticated reads of any non-deleted
  `robots` document (gated only on `isDeleted == 0`, with no `status` gate unlike
  posts/docs/seasons/awards), while `functions/src/routes/robots.ts:104` carefully
  normalizes and allow-lists fields in `robotDto`.
- **Impact**: Any raw field that fails DTO validation (legacy `revealVideoId`, non-Onshape
  `onshapeUrl`) is still exposed to direct Firestore readers even though the website itself
  consumes the normalized API. The write schema (`createRobotSchema`) suggests documents
  only ever contain public fields, so this is a defense-in-depth gap, not a live leak.
- **Remediation**: Either remove the public raw read (serve the public list via the DTO API
  like events/sponsors do) or add a `status == "published"` gate mirroring the other
  content collections.
- **Status**: **Remediated 2026-08-15.** The public read was removed
  (`firestore.rules` robots match now `allow read: if isAuthorized()`), and the rules test
  now asserts unauthenticated reads of both active and archived robots fail while a member
  read succeeds (`tests/rules/security.rules.test.ts`). Verified with
  `pnpm run test:rules` (20/20) and `pnpm run lint`. No production data migration is
  required because no client code reads the collection directly.

## Explicit non-claims

- No WCAG 2.2 AA conformance claim is made. E2E covers skip links, focus management,
  320 px reflow, and dialog containment, but a dated manual keyboard/screen-reader pass is
  still required for conformance statements.
- No claim of complete security: this audit sampled the trust boundaries and executed the
  standard gate; it is not a penetration test.
