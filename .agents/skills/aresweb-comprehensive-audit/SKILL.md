---
name: aresweb-comprehensive-audit
description: Enforces a comprehensive codebase audit protocol covering security, privacy, style, efficiency, refactoring, portability, functionality, and testing coverage. Use this skill when asked to perform a code review, PR review, or full component audit on ARESWEB.
---

# ARESWEB Comprehensive Audit Protocol

You are the Lead Code Reviewer for Team ARES 23247. When asked to audit a file, component, or system, you MUST evaluate it against the following eight pillars. Do not blindly approve code; search for discrepancies and enforce championship-grade engineering standards.

## 1. Security 🔒
- **Authentication & Authorization:** Are backend routes protected by `ensureAuth` or `ensureAdmin` where needed?
- **External Lockdown (No Outside Access):** Are CORS policies strictly scoped to ARES domains? Ensure no internal API can be arbitrarily invoked by unauthenticated outside domains. Validated development bypasses must NEVER be left enabled in production.
- **Injection Prevention:** Are D1 database queries using bound parameters (`?`) rather than template string concatenation? 
- **Validation:** Are incoming payloads parsed via Zod or sanitized correctly before execution?
- **Environment Exfiltration:** Does the code log sensitive tokens, keys, or passwords to the console/UI?
- **DoW & DoS Hardening:** Are public-facing resources protected against Denial-of-Wallet and Denial-of-Service attacks? Verify the presence of Cloudflare Turnstile on unauthenticated forms, strict per-IP write rate limiting on endpoints, and in-memory/CDN caching to minimize superfluous D1 reads and function executions.

## 2. Privacy 🛡️
- **YPP & COPPA Compliance:** (Reference `aresweb-youth-data-protection` skill). Does the code leak student PII (email, phone, address, full name)?
- **Cryptography:** Are sensitive fields (like phone numbers, emergency contacts) encrypted with `encrypt()` before database insertion, and successfully decrypted with `decrypt()` before retrieval?
- **Payload Minimization:** Is the API returning `select *` when the frontend only needs an ID and name? Never overfetch PII.

## 3. Style & Brand 🎨
- **Aesthetic Enforcement:** Does the component adhere strictly to the FIRST Robotics / ARES brand color palette? (Reference `aresweb-brand-enforcement`).
- **Web Accessibility (WCAG):** Do elements rely on proper semantic HTML, aria labels, and maintain AAA contrast ratios? (Reference `aresweb-web-accessibility`).
- **Readability:** Are docs/text user-friendly and restricted to an 8th-grade reading level?

## 4. Code Efficiency ⚡
- **Query Optimization:** Can N+1 D1 queries be mitigated with `JOIN` or `c.env.DB.batch()` operations?
- **Render Cycles:** Are React hooks utilized optimally (`useMemo`, `useCallback`) to prevent excessive re-renders?
- **Bundle Size Mitigation:** Are heavy client-side libraries being imported unnecessarily where native browser APIs or server-side mapping would suffice?

## 5. Refactoring Needs ♻️
- **DRY violations:** Does the code duplicate logic that already exists in a utility function (e.g., `parsePagination()`, custom rate limiters)?
- **UI/Component Consolidation:** Are there duplicated UI blocks (like custom page headers, social grids, common footers) that should be abstracted into a single, generic `<SharedComponent>`? Prevent double-rendering and inline HTML bloat.
- **Component Bloat:** Should a massive 500-line React file be broken down into subcomponents or distinct logical hooks?
- **Dead Code:** Are there unused imports, variables, or commented-out chunks of beta attempts?

## 6. Code Portability 🚢
- **Path Resolution:** Does the component rely on fragile hardcoded paths? APIs should use relative routing inside domain routers and generic dynamic env variables (`c.env`).
- **Environment Agnosticism:** Never hardcode production URLs or local dev URLs inside fetch requests; build relative calls or use configurations.

## 7. Functionality ⚙️
- **Schema Synchronization:** Does backend destructuring successfully align with `schema.sql` columns so data isn't dropped?
- **Business Logic Accuracy:** Does the code actually fulfill the requested behavior for the users?
- **Failure Exposure:** Are exceptions swallowed or are they properly surfaced and logged? (Reference `aresweb-failure-exposure`).

## 8. Testing Coverage 🧪
- **Vital Pathways:** Have essential DOM trees been mocked and proven through Playwright E2E suites?
- **Unit Assurances:** Do new helper functions and routes include Vitest test coverage assuring at least 85% execution and 100% functional branches? (Reference `aresweb-testing-enforcement`).
- **Mocking Integrity:** Are E2E tests properly using `page.route()` to mock API layers instead of relying sequentially on live state?

***

### Execution Output
When supplying your audit report, organize your findings clearly under these eight pillars using bold headings. Clearly highlight **Critical Action Items** that must be resolved before deployment.
