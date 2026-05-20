# ARESWEB Global Testing Enforcement Protocol

## Core Directives

1. **Test-Driven Architecture**: Any structural change, utility implementation, or backend Hono API route you create or modify must pass the Vitest Coverage v8 threshold of 85% line coverage and 100% functional coverage.
2. **Automated Verification**: Never ask the user "does this look right" for critical logic changes. Instead, write a `*.test.ts/x` file, run `npm run test:coverage`, and verify mathematically that your code succeeds.
3. **State Management Validation**: New **Zustand** stores (`src/store/*.ts`) must include unit tests verifying that actions (setters/toggles) update the state correctly and that selectors return the expected values.
4. **Interactive Component Safety**: Components involving **3D canvases** (React Three Fiber) or **logic diagrams** (React Flow) must include `aria-label` descriptions. E2E tests for these routes MUST run an `AxeBuilder` scan to ensure accessibility compliance.
5. **End-to-End Fallback**: If you change mission-critical user paths—such as the admin dashboard navigation or the login module—you must update or append to the `tests/e2e/` Playwright testing suite.
6. **Coverage Integrity**: If you ever see a CI failure resulting from coverage falling beneath 85% (`lines` and `statements`) or 100% (`functions`), you must autonomously write additional tests to reach compliance.
5. **E2E Authentication Mocking**: Playwright E2E tests MUST mock authentication states and backend API payloads via `page.route()` rather than relying on live Cloudflare database environments or fragile cookie states. Flaky tests resulting from un-mocked dependencies are unacceptable.

## Implementation Steps

When writing a new utility (e.g., `src/utils/myNewHelper.ts`):
1. Immediately create `src/utils/myNewHelper.test.ts`.
2. Write edge-case assertions using `describe`, `it`, and `expect` via Vitest.
3. Verify local success using `npm run test:coverage`.

By following this skill, ARESWEB maintains championship-tier code resilience.
