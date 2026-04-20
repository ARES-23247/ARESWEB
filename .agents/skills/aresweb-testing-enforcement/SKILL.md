---
name: aresweb-testing-enforcement
description: Dictates the absolute enforcement of the 80% ARESWEB standard test coverage threshold, requiring that all new utility or complex UI components provide accompanying vitest testing suites or playwright E2E coverage.
---

# ARESWEB Global Testing Enforcement Protocol

## Core Directives

1. **Test-Driven Architecture**: Any structural change, utility implementation, or backend Hono API route you create or modify must pass the 80% coverage threshold enforced by Vitest Coverage v8.
2. **Automated Verification**: Never ask the user "does this look right" for critical logic changes. Instead, write a `*.test.ts/x` file, run `npm run test:coverage`, and verify mathematically that your code succeeds.
3. **End-to-End Fallback**: If you change mission-critical user paths—such as the admin dashboard navigation or the login module—you must update or append to the `tests/e2e/` Playwright testing suite.
4. **Coverage Integrity**: If you ever see a CI failure resulting from coverage falling beneath 80% (`lines`, `functions`, `branches`, or `statements`), you must autonomously write additional tests to reach compliance before declaring the task complete.

## Implementation Steps

When writing a new utility (e.g., `src/utils/myNewHelper.ts`):
1. Immediately create `src/utils/myNewHelper.test.ts`.
2. Write edge-case assertions using `describe`, `it`, and `expect` via Vitest.
3. Verify local success using `npm run test:coverage`.

By following this skill, ARESWEB maintains championship-tier code resilience.
