# TESTING.md

**Date:** 2026-04-28

## Testing Frameworks
- **Unit & Integration:** `vitest` (Vite-based test runner).
- **Environment:** `jsdom` is used for React component testing.
- **E2E:** Playwright (`@playwright/test`) for browser automation tests.
- **Accessibility:** `pa11y-ci` used via `npm run pa11y`.

## Structure
- Tests colocate or reside in dedicated test directories (`/tests` or `/src/test`).
- E2E tests reside in `/tests/e2e/` (excluded from Vitest runs).

## Coverage Requirements
- The project enforces stringent CI/CD coverage thresholds defined in `vite.config.ts`:
  - Lines: 85%
  - Functions: 100%
  - Branches: 80%
  - Statements: 85%
- Areas prioritized for coverage: `src/utils/**`, `src/hooks/**`, `functions/api/routes/**`.

## Mocking
- Handled primarily by `msw` (Mock Service Worker) to intercept API requests during UI testing, and Vitest's built-in mocking for internal modules.
