# next-firebase High-Fidelity Codebase & Architecture Audit Report

**Date:** June 7, 2026  
**Auditor:** Team ARES 23247 Lead Code Reviewer & Antigravity AI  
**Scope:** `next-firebase` Workspace (`/next-firebase/src/` Frontend React client, `/next-firebase/functions/` Express Cloud Functions backend, and Firestore/Storage Security Rules).

---

## 📊 1. Summary Scorecard

Below is the consolidated compliance scorecard evaluating the new Firebase website codebase against the ARES 12 Pillars of Excellence, compiled from our parallel audit:

| Pillar | Grade | Status | Critical Findings / Remarks |
| :--- | :---: | :---: | :--- |
| **1. Security 🔒** | **C+** | ⚠️ WARN | Hardcoded reCAPTCHA test site key; SSRF vulnerability in photo media proxy; lack of input schema validation; weak reCAPTCHA score checks. |
| **2. Privacy & Youth Protection 🛡️** | **B+** | ⚠️ WARN | Blog creator author field defaults to student's legal name (`displayName`) instead of `nickname`, risking minor PII leaks. |
| **3. Web Accessibility (WCAG) ♿** | **B+** | ⚠️ WARN | Checkbox selections for user interests lack semantic `<fieldset>` and `<legend>` wrapping context for screen readers. |
| **4. Style & Brand 🎨** | **C-** | ⚠️ WARN | Misuse of `ares-cyan` for action button backgrounds (Save Path, Load Path); WebGL visualizers use generic Tailwind colors; JoinPage uses generic Red-600 shadows. |
| **5. Code Efficiency ⚡** | **C+** | ⚠️ WARN | Missing Google Photos access token caching (quota risk); telemetry ingestion synchronously blocks the HTTP request execution thread. |
| **6. Refactoring Needs ♻️** | **C-** | ⚠️ WARN | Monolithic file bloat in `AresPlanner.tsx` (2,376 lines) and `WebGLReplayCanvas.tsx` (1,130 lines); copy-pasted orphan backend utilities in client folders. |
| **7. Code Portability 🚢** | **B-** | ⚠️ WARN | Server-only `firebase-admin` imported inside client-side `src/lib/vertex.ts`, creating browser compilation risks. |
| **8. Functionality ⚙️** | **A-** | ✅ PASS | Deterministic fallback handlers for offline AI modes; Firestore soft deletes configured correctly. Minor: missing category enum runtime checks. |
| **9. Testing Coverage 🧪** | **F** | ❌ FAIL | 0% test coverage for API routes and controllers; lack of Playwright E2E coverage for main planner canvas and form actions. |
| **10. Architecture 🏗️** | **B+** | ✅ PASS | Layout wrapper and child routing structured cleanly using `react-router-dom` in Next.js structure. |
| **11. DevOps & Hygiene 🧹** | **B** | ✅ PASS | Directories clean of temp/build files, but active `console.log` statements pollute production function logs. |
| **12. Scalability & Resilience 📈** | **B** | ✅ PASS | NT4 streaming uses rolling buffers to prevent memory bloat; synchronous execution blocks limit API response scalability. |

---

## 🔍 2. Detailed Findings

### 1. Security 🔒
*   **✅ Strengths**:
    *   Administrative gates (`ensureAuth`, `ensureAdmin`) protect sensitive backend routes.
    *   Firestore uses official Admin SDK query builders to prevent injection vulnerabilities.
    *   Timing Safe Equal comparison (`crypto.timingSafeEqual`) secures webhooks and profiles against timing leaks.
    *   Firestore `getUserEmail()` helper successfully uses CEL `if-then-else` syntax to run cleanly.
*   **⚠️ Findings**:
    *   **SEC-F01 (SSRF in Photo Proxy)**: The `/api/photos/picker/media-proxy` route accepts target URLs and fetches them directly without validating if the hostname matches authorized Google Photos domains.
    *   **SEC-F02 (Hardcoded reCAPTCHA Site Key)**: The public testing key `6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI` is hardcoded in `layout.tsx`, `join/page.tsx`, and `sponsors/page.tsx` instead of using environment configuration.
    *   **SEC-F03 (Mass Assignment in sync)**: `/api/profiles/sync` directly saves the destructured `profile` payload into Firestore (`set(profile, { merge: true })`) without filtering keys or schema validation.
    *   **SEC-F04 (Weak reCAPTCHA Check)**: Inquiries endpoint checks reCAPTCHA success but ignores the returned score, permitting automated bots.

### 2. Privacy & Youth Protection 🛡️
*   **✅ Strengths**:
    *   Firestore document keys strictly map to user UIDs rather than plain text emails.
    *   Roster list filters parents, redacts college choices, and defaults to `"ARES Member"`.
    *   Sensitive youth details are encrypted using AES-GCM 256-bit.
*   **⚠️ Findings**:
    *   **YPP-F01 (Student Legal Name Leak)**: Blog creator defaults `author` to `displayName` (full name) instead of nickname, exposing minor PII.

### 3. Web Accessibility (WCAG) ♿
*   **✅ Strengths**:
    *   dedicated `SkipLink` bypass link mapped to `#main-content` in layout wrapper.
    *   Canvas components include `role="img"` with labels and arrow key time-scrubbing.
*   **⚠️ Findings**:
    *   **WCAG-F01 (Unstructured Checkbox Groups)**: Checkbox choices for Interests lack semantic `<fieldset>` and `<legend>` wrapping context for screen readers.

### 4. Style & Brand 🎨
*   **✅ Strengths**:
    *   Official palette variables mapped in `globals.css` with accessibility contrast adjustments.
    *   Geometric cuts implemented cleanly using border-radius variables.
*   **⚠️ Findings**:
    *   **BRD-F01 (Cyan Accents Mismatch)**: Save/Load buttons in `AresPlanner.tsx` and `aresplanner/page.tsx` use `bg-ares-cyan` instead of `bg-ares-red`.
    *   **BRD-F02 (Banned Canvas Colors)**: WebGL visualizers use generic Tailwind colors (Amber-500, Red-500, Blue-500) inline rather than ARES brand colors.
    *   **STY-F01 (Generic Red Shadows)**: `JoinPage.tsx` contains hardcoded red-600 shadows (`rgba(220, 38, 38, ...)`) violating color rules.

### 5. Code Efficiency ⚡
*   **✅ Strengths**:
    *   Efficient binary search matches coordinate playback times.
*   **⚠️ Findings**:
    *   **EFF-F01 (Uncached OAuth Token)**: `getGooglePhotosAccessToken` fetches a new token from Google on every request.
    *   **EFF-F02 (Synchronous Telemetry Ingestion)**: Ingestion route awaits Storage archiving, BigQuery, and Gemini sequentially, causing blocking user latency.

### 6. Refactoring Needs ♻️
*   **✅ Strengths**:
    *   API endpoints are cleanly isolated into sub-routers.
*   **⚠️ Findings**:
    *   **REF-F01 (Duplicate Orphan Files)**: Server utilities (`crypto.ts`, `firebase-admin.ts`, `googleAuth.ts`, etc.) are duplicated inside frontend `src/lib/` as completely unused orphan files.
    *   **REF-F02 (Component Bloat)**: `AresPlanner.tsx` (2376 lines) and `WebGLReplayCanvas.tsx` (1130 lines) are massive monolithic modules.

### 7. Code Portability 🚢
*   **✅ Strengths**:
    *   Configuration paths and ports decoupled via env variables.
*   **⚠️ Findings**:
    *   **POR-F01 (Boundary Violation)**: Node-specific `firebase-admin` imported inside client-side `src/lib/vertex.ts`.

### 9. Testing Coverage 🧪
*   **✅ Strengths**:
    *   Unit test configs define strict thresholds (`85%` line, `100%` function).
*   **⚠️ Findings**:
    *   **TST-F01 (Zero Integration Coverage)**: 0% test coverage for API routes, controllers, and Express middlewares. No Playwright E2E coverage for major interactive UI workflows.

---

## 📌 3. Findings Reference Table

| ID | Severity | Finding | Location |
| :--- | :--- | :--- | :--- |
| **SEC-F01** | 🔴 **HIGH** | SSRF vulnerability in photo media proxy allows fetching arbitrary hosts. | `functions/src/routes/photos.ts:459` |
| **SEC-F02** | 🔴 **HIGH** | Hardcoded reCAPTCHA v3 public test key instead of environment-bound site key. | `src/app/layout.tsx:39`, `src/app/join/page.tsx:88`, `src/app/sponsors/page.tsx:151` |
| **YPP-F01** | 🔴 **HIGH** | Blog author defaults to user legal name (`displayName`) instead of `nickname`. | `src/app/dashboard/blog/page.tsx:132` |
| **BRD-F01** | 🔴 **HIGH** | Save and Load buttons use `ares-cyan` background instead of brand-primary `bg-ares-red`. | `src/components/AresPlanner.tsx:2252`, `src/app/aresplanner/page.tsx:606` |
| **TST-F01** | 🔴 **HIGH** | Extreme Vitest gaps; routes and middlewares have 0% test coverage. | `functions/src/routes/*`, `functions/src/middleware/*` |
| **SEC-F03** | 🟡 **MEDIUM** | Lack of Zod schema validation in `/sync` allows arbitrary profile property injections. | `functions/src/routes/profiles.ts:61` |
| **SEC-F04** | 🟡 **MEDIUM** | Weak reCAPTCHA v3 check ignores score, permitting bots with valid tokens. | `functions/src/routes/inquiries.ts:59` |
| **EFF-F01** | 🟡 **MEDIUM** | Missing Google Photos access token caching results in duplicate network roundtrips. | `functions/src/lib/googleAuth.ts:16` |
| **EFF-F02** | 🟡 **MEDIUM** | Telemetry ingestion synchronously awaits Storage, BigQuery, and Gemini analysis in request path. | `functions/src/routes/upload.ts:118` |
| **REF-F01** | 🟡 **MEDIUM** | Duplicated backend-only modules exist inside the frontend `src/lib/` folder as orphan files. | `src/lib/` (multiple files) |
| **POR-F01** | 🟡 **MEDIUM** | Boundary violation: Node.js-only `firebase-admin` imported inside client-side `src/lib/vertex.ts`. | `src/lib/vertex.ts:2` |
| **WCAG-F01** | 🟡 **MEDIUM** | Checkbox choices for Interests lack semantic `<fieldset>` and `<legend>` wrapping context. | `src/app/join/page.tsx:365` |
| **BRD-F02** | 🟡 **MEDIUM** | WebGL 2D/3D visualizers use generic Tailwind colors instead of ARES theme colors. | `src/app/dashboard/scope/components/WebGLReplayCanvas.tsx` |
| **DEV-F01** | 🟢 **LOW** | Production execution paths contain debug console.log statements. | Multiple files (`WebGLReplayCanvas.tsx`, `scope/page.tsx`, `nt4Client.ts`) |
| **STY-F01** | 🟢 **LOW** | Hardcoded generic Red-600 shadows (`rgba(220,38,38,...)`) violate brand palette rules. | `src/app/join/page.tsx` |

---

## 🚀 4. Roadmap to Compliance

### 🔴 Must Fix (High Priority / Security / YPP / WCAG / Test Breaks)
1.  **Resolve SSRF**: Add hostname/domain validation in `src/routes/photos.ts` (media-proxy) to ensure URL matches only authorized Google Photo API hosts.
2.  **reCAPTCHA Site Key**: Bind `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` to environment configs instead of hardcoding the Google test key.
3.  **YPP Blog Author**: Modify `dashboard/blog/page.tsx` line 132 to query the user profile database for `nickname` instead of falling back directly to `user.displayName`.
4.  **Color Guidelines Mismatch**: Refactor "Save Path to Cloud" and "Load Path" buttons from `bg-ares-cyan` to `bg-ares-red` or `bg-ares-gold`.
5.  **Expand Test Suite**: Write Vitest integration tests for auth middlewares and routes using MSW to mock Google, Zulip, and Vertex endpoints.

### 🟡 Should Fix (Performance / Refactoring / Brand Mismatches)
1.  **Add Token Caching**: Implement in-memory caching for Google Photos access tokens inside `googleAuth.ts`, checking the expiration timestamp before requesting a new token.
2.  **Remove Duplicated Frontend Modules**: Delete `src/lib/firebase-admin.ts`, `src/lib/vertex.ts`, `src/lib/zulip.ts`, and other orphaned duplicate files in the frontend repository to preserve boundary integrity.
3.  **Introduce Zod Schema Validation**: Use a schema parsing library to validate request payloads (e.g. `profile` in `/sync`, `matchData` in `/match-analysis`).
4.  **Visualizer Colors**: Update 2D and 3D canvas colors in `WebGLReplayCanvas.tsx` to map exactly to the ARES color tokens (`0xC00000` for Red, `0xFFB81C` for Gold, `0xCD7F32` for Bronze).
5.  **Semantic fieldsets**: Wrap checkbox blocks in a `<fieldset>` with `<legend>` descriptions for proper screen reader accessibility.

### 🟢 Backlog (Refactoring / DevOps Hygiene)
1.  **Asynchronous Telemetry Ingestion**: Decouple the upload route from GCS, BigQuery, and Gemini. Make the `/api/upload` endpoint save metadata to Firestore and return an immediate `200 OK`, offloading heavy tasks to Cloud Tasks/triggers.
2.  **Console Statements**: Clean up debug logs in NT4 client and CSV files.
3.  **Correct brand color shadows**: Replace `rgba(220,38,38,...)` colors in `JoinPage.tsx` with the official ARES red `rgba(192,0,0,...)` class weights.
