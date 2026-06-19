---
name: aresweb-testing-enforcement
description: Dictates the absolute enforcement of the ARESWEB standard test coverage thresholds, requiring that all new utility components provide accompanying vitest testing suites with 100% function coverage, or playwright E2E coverage for major DOM flows.
---

# ARESWEB Global Testing Enforcement Protocol

## Core Directives

1. **Test-Driven Architecture**: Any structural change, utility implementation, or backend Express API route you create or modify must pass the Vitest Coverage v8 threshold of 85% line coverage and 100% functional coverage.
2. **Automated Verification**: Never ask the user "does this look right" for critical logic changes. Instead, write a `*.test.ts/x` file, run tests, and verify mathematically that your code succeeds.
3. **State Management Validation**: New **Zustand** stores (`src/store/*.ts`) must include unit tests verifying that actions (setters/toggles) update the state correctly and that selectors return the expected values.
4. **Interactive Component Safety**: Components involving **3D canvases** (React Three Fiber) or **logic diagrams** (React Flow) must include `aria-label` descriptions. E2E tests for these routes MUST run accessibility scans to ensure compliance.
5. **End-to-End Fallback**: If you change mission-critical user paths—such as the admin dashboard navigation or the login module—you must update or append to the Playwright E2E testing suite.
6. **Coverage Integrity**: If you ever see a CI failure resulting from coverage falling beneath thresholds, you must autonomously write additional tests to reach compliance.
7. **E2E Authentication Mocking**: Playwright E2E tests MUST mock authentication states and backend API payloads via `page.route()` rather than relying on live Firebase database environments or fragile cookie states.
