# Testing Enforcement

> Test coverage requirements and patterns. Read before writing new utilities or API routes.

## Core Directives

1. **85% line coverage, 100% function coverage** — Vitest threshold
2. **Test-Driven Architecture** — Write tests alongside code
3. **Zustand stores** — Must test actions and selectors
4. **3D canvases/diagrams** — Must include `aria-label` + Axe scan
5. **E2E for critical paths** — Playwright for auth, dashboard nav
6. **Mock authentication** — E2E tests use `page.route()`, not live DB

## Coverage Integrity

If CI fails for coverage <85%, write additional tests to reach compliance.

## Implementation Steps

New utility (`src/utils/myHelper.ts`):
1. Create `src/utils/myHelper.test.ts`
2. Write edge-case assertions with `describe`, `it`, `expect`
3. Verify: `npm run test:coverage`
