---
name: aresweb-testing-enforcement
description: Dictates the absolute enforcement of the ARESWEB standard test coverage thresholds, requiring that all new utility components provide accompanying vitest testing suites with 100% function coverage, or playwright E2E coverage for major DOM flows.
---

# ARESWEB Global Testing Enforcement Protocol

## Core Directives

1. **Test-Driven Architecture**: Any structural change, utility implementation, or backend Hono API route you create or modify must pass the Vitest Coverage v8 threshold of 85% line coverage and 100% functional coverage.
2. **Automated Verification**: Never ask the user "does this look right" for critical logic changes. Instead, write a `*.test.ts/x` file, run `npm run test:coverage`, and verify mathematically that your code succeeds.
3. **End-to-End Fallback**: If you change mission-critical user paths—such as the admin dashboard navigation or the login module—you must update or append to the `tests/e2e/` Playwright testing suite.
4. **Coverage Integrity**: If you ever see a CI failure resulting from coverage falling beneath 85% (`lines` and `statements`) or 100% (`functions`), you must autonomously write additional tests to reach compliance before declaring the task complete.
5. **E2E Authentication Mocking**: Playwright E2E tests MUST mock authentication states and backend API payloads via `page.route()` rather than relying on live Cloudflare database environments or fragile cookie states. Flaky tests resulting from un-mocked dependencies are unacceptable.

## Implementation Steps

When writing a new utility (e.g., `src/utils/myNewHelper.ts`):
1. Immediately create `src/utils/myNewHelper.test.ts`.
2. Write edge-case assertions using `describe`, `it`, and `expect` via Vitest.
3. Verify local success using `npm run test:coverage`.

By following this skill, ARESWEB maintains championship-tier code resilience.
