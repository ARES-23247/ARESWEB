---
name: aresweb-comprehensive-audit
description: Enforces a championship-grade codebase audit protocol covering 12 pillars of excellence. This high-fidelity protocol combines rigorous technical checklists with executive-level reporting standards.
---

# ARESWEB High-Fidelity Audit Protocol

You are the **Lead Code Reviewer for Team ARES 23247**. When asked to audit a file, component, or system, you MUST evaluate it against these 12 pillars. Do not blindly approve code; search for discrepancies and enforce championship-grade engineering standards.

## 🏗️ Current Architecture Reference

- **Frontend**: Vite + React 18 + TypeScript, Tailwind CSS, Zustand state management
- **Backend**: Firebase Cloud Functions (2nd gen) + Express routers
- **Database**: Cloud Firestore with `firestore.rules` security rules
- **Auth**: Firebase Auth with ID token verification via `ensureAuth`/`ensureAdmin`/`ensureTeamMember` middleware
- **Error Handling**: `asyncHandler` wrapper + `throw ApiError(status, message)` pattern → `globalErrorHandler`
- **Logging**: `logger.info/warn/error(tag, message, data?)` from `functions/src/lib/logger.ts`
- **Auth Type**: `AuthenticatedRequest.user` typed as `DecodedIdToken` (from `firebase-admin/auth`)
- **Testing**: Vitest (unit, frontend + backend), no E2E suite yet
- **Hosting**: Firebase Hosting with Cloud Functions for API routes at `/api/*`

### Key Backend Patterns
```
functions/src/
├── index.ts              # Express app, mounts 12 sub-routers under /api/*
├── middleware/
│   ├── auth.ts           # ensureAuth, ensureAdmin, ensureTeamMember, AuthenticatedRequest
│   └── errorHandler.ts   # ApiError class, globalErrorHandler
├── lib/
│   ├── logger.ts         # Structured logging utility (replaces raw console.log)
│   ├── utils.ts          # asyncHandler wrapper
│   ├── firebase-admin.ts # adminAuth, adminDb, adminStorage exports
│   └── ...
└── routes/               # 12 Express router files + __tests__/
```

## 📋 The 12 Pillars of Excellence

### 1. Security 🔒
- **Authentication & Authorization:** Are protected API routes secured with `ensureAuth` or `ensureAdmin`? Are direct client requests to Firestore protected by strict validation in `firestore.rules`?
- **Injection Prevention:** Are database queries using standard Firestore/BigQuery query builders rather than template string concatenation?
- **Validation:** Are incoming payloads validated with TypeScript type guards and `AuthenticatedRequest` typing before execution? Is `user` typed as `DecodedIdToken` (never `any`)?
- **DoS Hardening:** Verify Google reCAPTCHA v3 or Firebase App Check on public forms, write rate limits on Express endpoints, and caching to minimize database reads.
- **Fail-Closed Logic:** Ensure verification utilities (like reCAPTCHA verify) return `false` on network errors, never `true`.
- **Firestore Rules Integrity:** No duplicate `match` blocks for the same collection. Admin-only collections use `hasRole('admin')`, not `isAuthorized()`.

### 2. Privacy & Youth Protection 🛡️
- **YPP & COPPA Compliance:** (Reference `aresweb-youth-data-protection`). Does the code leak student PII (email, phone, address, full name)? Ensure emails are never used as document keys in Firestore paths.
- **Cryptography:** Are sensitive fields encrypted before database insertion and successfully decrypted before retrieval?
- **Payload Minimization:** Is the API returning unnecessary database fields? Use DTOs or clean maps to enforce strict payload boundaries.

### 3. Web Accessibility (WCAG) ♿
- **Compliance:** Audit for WCAG 2.1 AA (Reference `aresweb-web-accessibility`). Check for 4.5:1 contrast ratios and keyboard navigability.
- **Semantic HTML:** Ensure buttons are `<button>`, links are `<a>`. Use proper ARIA attributes on interactive canvas components.
- **SkipLink:** Verify `<main id="main-content">` exists in layout wrappers and the `SkipLink` component targets it.

### 4. Style & Brand 🎨
- **Aesthetic Enforcement:** (Reference `aresweb-brand-enforcement`). Adhere strictly to the ARES color palette (`ares-red`, `ares-gold`).
- **Typography:** Ensure `League Spartan` and `Inter` are used via established utility classes.

### 5. Code Efficiency ⚡
- **Query Optimization:** Can Firestore reads be minimized using `.limit()`, `.where()` server-side filtering, or caching? Flag any unbounded `.get()` calls without `.limit()`.
- **Render Cycles:** Use `react-hook-form` for complex editors. Use virtualization for long lists.
- **State Management:** Use **Zustand** (`useUIStore`) for global UI state.

### 6. Refactoring Needs ♻️
- **Component Bloat:** Any `.tsx` file over 500 lines should be decomposed into focused sub-components and custom hooks. Flag files exceeding this threshold.
- **DRY Violations:** Use shared utilities and standard API wrappers.

### 7. Code Portability 🚢
- **Path Resolution:** APIs should use relative routing and environment variables.
- **Boundary Integrity:** Prevent backend files from importing from `src/` (frontend) and vice-versa.

### 8. Functionality ⚙️
- **Error Handling Architecture:** All route handlers MUST use `asyncHandler` wrapper + `throw ApiError(status, message)`. Manual `try/catch` with `res.status().json()` is NOT acceptable — errors must bubble to `globalErrorHandler`.
- **Failure Exposure:** Are exceptions properly surfaced to admins but masked for users? (Reference `aresweb-failure-exposure`).
- **Logging:** All backend logging MUST use the `logger.*` utility from `lib/logger.ts`. Raw `console.log` is NOT acceptable in production routes.

### 9. Testing Coverage 🧪
- **Vital Pathways:** Have essential DOM trees been proven through Playwright E2E suites?
- **Unit Assurances:** Do helper functions/routes include Vitest coverage? Backend routes should have test files in `routes/__tests__/`.
- **Mocking Integrity:** Are tests using proper mocks for Firebase Admin SDK and authentication states?

### 10. Architecture 🏗️
- **Middleware Flow:** Are global middlewares (CORS, Auth, Rate Limit) executing in the correct sequence in `index.ts`?
- **Router Registration:** All API routes should be mounted in `index.ts` under `/api/*` with appropriate auth middleware.

### 11. DevOps & Hygiene 🧹
- **Cleanliness:** Ensure no scratch/temp files are in the production path. No legacy audit reports at the repo root.
- **Log Noise:** No raw `console.log` statements in production code — use `logger.*` exclusively.
- **Type Safety:** `AuthenticatedRequest.user` must be typed as `DecodedIdToken`, never `any`. Route handlers should use `AuthenticatedRequest`, not `req: any`.

### 12. Scalability & Resilience 📈
- **Async Execution:** Ensure long-running tasks (image imports, AI generation) do not block primary user requests. Use background Cloud Functions or `res.json()` before heavy processing.
- **Pagination:** Bulk read endpoints should use Firestore `.limit()` and cursor-based pagination.

***

# 📝 Execution & Formatting Rules

Every audit MUST include:

1.  **Header:** Date, Auditor Name, Scope (File or Platform).
2.  **Summary Scorecard Table:** Column 1: Pillar | Column 2: Grade (A-F) | Column 3: Critical Item summary.
3.  **Sectioned Detail:** Use `✅ Strengths` and `⚠️ Findings` for EACH pillar.
4.  **Findings Table:** For pillars with issues, provide a table:
    | ID | Severity | Finding | Location |
    | :--- | :--- | :--- | :--- |
    | TAG-F01 | [HIGH] | Detailed description of the flaw | filename:line |
5.  **Roadmap to Compliance:** A prioritized list of `🔴 Must Fix`, `🟡 Should Fix`, and `🟢 Backlog`.
