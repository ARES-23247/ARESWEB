# ARESWEB Deep Codebase Audit Report (2026-05-09)

**Status:** YELLOW (Structural integrity high, quality metrics need stabilizing)
**Frameworks:** React 19, Vite 8, Hono, Drizzle ORM, TanStack (Router, Query)

## 1. Executive Summary
The ARESWEB architecture has successfully transitioned to a modern, "Platinum Tier" stack. The migration from Kysely to Drizzle ORM is complete, and the backend is correctly using the OpenAPI-first approach with Hono. However, while the foundations are strong, there is "invisible debt" in the frontend components and a significant stabilization requirement for the test suite.

## 2. TanStack Ecosystem Analysis
While core TanStack features are present, we are missing several "obvious" integrations that would improve the developer experience and performance.

| Integration | Status | Recommendation |
| :--- | :--- | :--- |
| **TanStack Router** | **FULL** | Excellent implementation. Fully type-safe routes with Nuqs integration. |
| **TanStack Query** | **FULL** | High-fidelity implementation with IDB persistence (offline-first). |
| **TanStack Table** | **PARTIAL** | **Legacy Debt Identified.** In `package.json` but unused in `ContentManager.tsx`. We are still using manual `.filter()` and `.map()` for admin lists. |
| **TanStack Virtual** | **PARTIAL** | In `package.json` but missing in telemetry/audit logs. Large lists will cause DOM lag. |
| **TanStack Form** | **MISSING** | We are using `react-hook-form`. While valid, TanStack Form would provide better type safety across the Edge/UI boundary. |
| **TanStack Start** | **N/A** | Currently an SPA on Cloudflare Pages. Moving to Start would enable SSR/Streaming but is a high-effort migration. |

## 3. Legacy Debt & Technical Gaps
- **Ghost Dependencies**: `react-router-dom` remains in `package.json` but is unused. This bloats the lockfile and complicates dependency audits.
- **Manual Response Mapping**: Substantial boilerplate exists to map Drizzle `camelCase` results to the API's `snake_case` contracts. 
  - *Recommendation*: Implement a global Hono interceptor or Zod transformation layer to handle this automatically in Milestone 8.0.
- **Brittle Mocks**: The `vitest` suite suffers from 36 logic failures. Most are due to `createMockDb()` not supporting the fluent Drizzle API fully (chained calls like `select().from().where()`).

## 4. Best Practices Audit (The 12 Pillars)

| Pillar | Status | Notes |
| :--- | :---: | :--- |
| **1. Security** | 🟢 | Strict Zod validation and Better-Auth integration are solid. |
| **2. Privacy** | 🟢 | PII stripping (cf_email vs nickname) is correctly handled in public routes. |
| **3. Accessibility** | 🟡 | `AxeBuilder` scans are not yet fully integrated into the standard Playwright pipeline. |
| **5. Efficiency** | 🔴 | **Major Gap.** Lack of virtualization in admin dashboards violates "Efficiency" standards. |
| **8. Functionality** | 🟢 | `throw new ApiError` pattern is consistently applied across routes. |
| **9. Testing** | 🔴 | **Failure.** 1.2% failure rate and "logic errors" in mocks prevent CI/CD automation. |
| **11. Hygiene** | 🟢 | Kysely and Liveblocks have been successfully purged from the source tree. |

## 5. Milestone 8.0 Roadmap

### Phase 70: Quality Stabilization
1. **Refactor `createMockDb()`**: Upgrade the mock utility to support fluent chaining, resolving the `500` error trend in tests.
2. **Fix `zulipWebhook.test.ts`**: Resolve specific logic errors where assertions fail on `undefined`.

### Phase 71: Performance & Consolidation
1. **Refactor `ContentManager.tsx`**: Implement `TanStack Table` and `TanStack Virtual` for all admin registries.

### Phase 72: API Boilerplate Reduction
1. **Unified Mapping**: Create a utility to automate `camelCase` ↔ `snake_case` transitions to reduce boilerplate in routes.

### Phase 73: Hygiene
1. **Purge Ghost Dependencies**: Remove `react-router-dom` and other unused libraries.
