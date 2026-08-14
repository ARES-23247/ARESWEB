# Comprehensive Website & Repository Audit — 2026-08-14

## Scope and Execution Baseline

This audit reviewed the live architecture, security boundaries, client/server data contracts, accessibility, bundle performance, SEO configuration, test fidelity, and CI/CD delivery controls of the ARESWEB repository.

- **Audited Commit Base**: `603c8799` (`master`)
- **Execution Date**: 2026-08-14 (UTC) / 2026-08-13 (Local)
- **Toolchain Runtimes**: Node `22.13.1` (active fnm pinned line), pnpm `11.21.0`, OpenJDK `21.0.12 LTS`
- **Authoritative Gate Sequence Executed**:
  1. Shared agent skill mirroring & schema validation (`pnpm run validate:agents`)
  2. Root and Cloud Functions ESLint with zero warnings (`pnpm run lint`, `pnpm --filter functions lint`)
  3. TypeScript compilation & Cloud Functions build (`tsc --noEmit`, `pnpm --filter functions build`)
  4. Unit & integration test suites with V8 coverage (`pnpm run test:coverage`, `pnpm --filter functions test:coverage`)
  5. Firebase Emulator Suite Firestore and Storage security rules (`pnpm run test:rules`)
  6. Production Vite build & 22 prerendered static route shells (`pnpm run build`)
  7. Bundle size budget validation (`node scripts/check-bundle-size.mjs`)
  8. End-to-end multi-browser matrix across Chromium, Mobile Chromium, Firefox, and WebKit (`pnpm run test:e2e`)
  9. Production supply-chain dependency audit (`pnpm audit --prod --audit-level=high`)
  10. Deployment contract validation (`node scripts/verify-production-deployment.mjs --validate-contract`)

---

## Architecture & System Map

### 1. Client Application (`src/`)
- **Core Framework**: React 19.2.4 + React Router 7.18.2 with Vite 8.2.1 and TailwindCSS 4.3.3.
- **Routing Structure**: 22 prerendered public route shells (`/`, `/about`, `/academy`, `/blog`, `/calendar`, `/events/:id`, `/finance`, `/gallery`, `/join`, `/leaderboard`, `/robots`, `/robots/:id`, `/sponsors`, `/store`, `/tournaments`, etc.) and protected `/dashboard/*` routes nested within `DashboardLayout`.
- **State & Data Layer**: TanStack Query (`@tanstack/react-query`) for cached queries and mutation lifecycles; Zustand for localized layout state; Firebase Client SDK for direct auth context and realtime document sync.
- **Interactive Simulations**: Sandboxed WebGL/Three.js + Canvas physics engines in `src/sims/` running in iframe isolation with parent-child postMessage bounds.

### 2. Cloud Functions Backend (`functions/src/`)
- **Runtime**: Node 22 on Google Cloud Functions 2nd Generation with Express 5.2.1 and Firebase Admin 14.2.0 modular SDK.
- **Domain Routers**:
  - `public.ts` / `reference.ts`: Public tournament match results, calendar events, fleet telemetry, sitemaps, and public DTO transformations.
  - `profiles.ts` (split into `profileRoster`, `profileSync`, `profileAdmin`, `profileSelf`, `profileZulip`, `profileEmailRoster`): Identity verification, role-based member management, youth privacy masking, and Zulip stream synchronization.
  - `photos.ts` (`photosUpload`, `photosImport`, `photosAuth`): Authenticated upload token issuance, Google Drive sync, and derivative generation.
  - `ai.ts`: Vertex AI / Gemini integration with strict prompt bounds and rate limits.
  - `store.ts`: Square / payment availability guards and merchandise catalogs.
  - `webhooks.ts`: Signed external webhook processing.
- **Middleware Boundary**:
  - `appCheck.ts`: Validates App Check reCAPTCHA tokens on sensitive mutations.
  - `auth.ts`: Verifies Firebase ID tokens and resolves verified role records.
  - `distributedQuota.ts`: In-memory and Firestore-backed rate limiting.
  - `validation.ts`: Zod schema validation for strict payload validation.
  - `errorHandler.ts`: Centralized `asyncHandler` and `globalErrorHandler` catching unexpected exceptions and returning generic 500s.

---

## Audit Findings & Hardening Applied

### AUD-01 — Firebase Admin 14 Migration Alignment in Offline Backfill Tools
- **Severity**: Low
- **Confidence**: High
- **Evidence**: `functions/src/lib/firebase-admin.ts:46-49` and `scripts/backfill-photo-derivatives.mjs:86-90`
- **Finding**: Following the Firebase Admin 14 modular migration, `scripts/backfill-photo-derivatives.mjs` referenced the legacy `admin.firestore.FieldPath.documentId()` from `firebase.default`.
- **Remediation**: Exported `adminFieldPath = FieldPath` from the shared `functions/src/lib/firebase-admin.ts` wrapper and updated `scripts/backfill-photo-derivatives.mjs` to consume `adminFieldPath`.
- **Acceptance Test**: `scripts/backfill-photo-derivatives.test.mjs` (7/7 tests passing) and live execution contract validation.

### AUD-02 — PowerShell Array Splatting Handling in Workspace Runtime Wrapper
- **Severity**: Low
- **Confidence**: High
- **Evidence**: `scripts/with-supported-runtime.ps1:56-62`
- **Finding**: When PowerShell sliced a single trailing argument from `$Command[1..1]`, PowerShell unboxed the array into a scalar string. Splatting `@commandArguments` then expanded the string into individual character arguments, causing single-argument Node commands (such as `node scripts/check-bundle-size.mjs`) to fail.
- **Remediation**: Declared `[string[]]$commandArguments = if ($Command.Count -gt 1) { [string[]]$Command[1..($Command.Count - 1)] } else { @() }` so PowerShell splatting always treats command arguments as an array of discrete strings.
- **Acceptance Test**: Verified both single-argument (`node scripts/check-bundle-size.mjs`) and multi-argument (`pnpm run test:e2e`) invocations via `.\scripts\with-supported-runtime.ps1`.

### AUD-03 — Playwright Parallel Test Execution Timeout Hardening
- **Severity**: Low
- **Confidence**: High
- **Evidence**: `playwright.config.ts:8-12` and `e2e/email-roster.spec.ts:50-58`
- **Finding**: Under high parallel worker load across 4 browser engines (52 test instances), Firefox occasionally exceeded Playwright's default 5,000ms assertion timeout while waiting for a code-split dashboard route. Extending only the overall test timeout did not change that assertion deadline.
- **Remediation**: Configured a 45,000ms overall test timeout and a separate 10,000ms assertion timeout in `playwright.config.ts`. Assertions still fail on missing behavior while allowing bounded headroom for parallel browser startup and route loading.
- **Acceptance Test**: The complete parallel Playwright matrix passed 52/52 test instances across Chromium, Mobile Chromium, Firefox, and WebKit in 47.2s after the separate assertion timeout was added.

### AUD-04 — JSDOM Comprehensive Profile Page Test Execution Timeout
- **Severity**: Low
- **Confidence**: High
- **Evidence**: `src/test/DashboardProfilePage.test.tsx:218-378`
- **Finding**: The comprehensive multi-tab profile page unit test simulates dozens of user interactions and form state changes across 5 sub-tabs in JSDOM, occasionally reaching Vitest's default 5,000ms test timeout.
- **Remediation**: Configured explicit 15,000ms timeout parameter on the long-running integration test.
- **Acceptance Test**: `src/test/DashboardProfilePage.test.tsx` (6/6 tests passing in 5.1s).

---

## Domain Verification Results

### 1. Zero-Trust Security & Data Privacy
- **Client Document Read Isolation**: Firestore rules require `isDeleted != 1` and `isPublished == true` on public reads.
- **PII Protection**: Inquiry submissions and member identities (email, phone, student contact) are encrypted or restricted to admin/coach roles. Email roster tools only export BCC lists via authorized API endpoints and do not render raw emails in the DOM.
- **Simulation Sandbox**: `src/sims/` components run within iframe containers with sandboxing policies avoiding `allow-same-origin` alongside `allow-scripts`.
- **Credential Controls Inspected**: No plaintext credentials were found in the active source and configuration inspected during this audit. Cloud Functions and CI use Workload Identity Federation with Application Default Credentials. This bounded inspection is not a certification of the complete repository history.

### 2. Web Accessibility (Automated WCAG 2.2 AA Evidence)
- **Keyboard Navigation**: Skip links (`#main-content`), focus traps in mobile navigation dialogs and modals, and roving tabIndex across complex widgets (e.g. interactive meander components, task boards).
- **ARIA Semantics & Status Announcements**: Live regions (`role="status"`, `aria-live="polite"`) used for asynchronous operations (saving drafts, copy confirmations, clipboard actions).
- **Color Contrast**: Passed contrast token tests ensuring text on dark obsidian backgrounds adheres to AA ratio standards.
- **Manual Validation Status**: The dated NVDA, VoiceOver, forced-colors, zoom/reflow, touch, and nested-dialog checks in `docs/audits/2026-08-12-manual-accessibility-checklist.md` remain pending. Automated results alone do not establish WCAG conformance.

### 3. Performance & Asset Delivery
- **Route Splitting & Bundle Budgets**:
  - Initial JS: 710.7 KB raw / 223.3 KB gzip (budget: 1,300 KB / 400 KB) — **PASS**
  - Initial CSS: 161.4 KB raw / 21.2 KB gzip (budget: 200 KB / 30 KB) — **PASS**
  - Largest Lazy JS (`vendor-three`): 559.8 KB raw / 140.3 KB gzip (budget: 3,000 KB / 800 KB) — **PASS**
  - Total Route JS: 4.49 MB raw / 1.31 MB gzip (budget: 8.0 MB / 2.2 MB) — **PASS**
  - Editor Runtime JS: 14.52 MB raw / 3.44 MB gzip (budget: 15.0 MB / 3.6 MB) — **PASS**
- **Static Prerendering**: 22 public route shells prerendered at build time for fast initial paint and search engine crawling.

### 4. SEO & Metadata
- Canonical tags, Open Graph meta tags, Twitter card tags, and dynamic titles configured via `react-helmet-async` with automated tests in `src/test/SEO.test.tsx`.
- Public routes indexed in `/sitemap.xml` and `/robots.txt`.

### 5. Test Coverage & Verification Metrics
- **Frontend Test Suite**: 77 test files, 435 tests passing (100%).
- **Functions Test Suite**: 43 test files, 540 tests passing (100%).
  - Statements: 93.25%
  - Branches: 82.20%
  - Functions: 98.24%
  - Lines: 94.69%
- **Security Rules Suite**: 18 test cases running against local Firestore and Storage emulators (100% passing).
- **Playwright E2E**: 52 tests running across 4 browser profiles (100% passing).

---

## Conclusion & Health Verdict

At the audited commit, the recorded static-analysis, unit, integration, emulator, build, bundle-budget, browser, and production dependency-audit gates passed. These results provide bounded evidence for the reviewed code and commands; they do not establish total security or WCAG conformance. The manual accessibility checklist remains outstanding, and future changes require the same verification gate before release.
