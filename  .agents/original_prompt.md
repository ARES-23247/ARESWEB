## 2026-05-20T01:36:15Z

Construct comprehensive end-to-end Playwright tests to verify real-time, multi-client collaborative session syncing on the ARES Web Portal's PartyKit server, ensuring bulletproof synchronicity under concurrent editing loads.

Working directory: c:\Users\david\dev\robotics\ftc\ARESWEB
Integrity mode: development

## Requirements

### R1. Multi-Client Collaborative Sync E2E Test Suite
Establish a Playwright E2E test suite that dynamically launches multiple browser contexts to simulate concurrent users interacting with collaborative features (e.g., collaborative editors, boards, or real-time simulation components) synced via the PartyKit server.

### R2. Real-Time Telemetry and Load Testing
Verify that edits, cursors, active presence states, and updates propagate to all other connected clients with minimal latency and maintain absolute integrity. Simulate realistic concurrent user behaviors such as simultaneous cursor movements, quick deletions, and simultaneous form updates.

### R3. Network Boundary Resilience & Clean Teardown
Ensure the tests cleanly launch and tear down the necessary server contexts (Vite, local PartyKit, database instances) without leaving lingering processes or polluting shared local state.

## Verification Resources
- The agent team should inspect `playwright.config.ts` and the existing files in `tests/` or `src/tests/` to align with current patterns.

## Acceptance Criteria

### E2E Flow Coverage & Presence
- [ ] At least one E2E spec verifies multi-context client collaborative interaction (presence cursors or text edits) over dynamic WebSocket connections.
- [ ] Multiple browser contexts (at least 2) are launched concurrently within a single test to verify real-time syncing.
- [ ] Connected active user presence state counts are verified to increment and decrement properly on client viewports.

### Environment & Execution Stability
- [ ] Running the command `npm run test:e2e` (or a dedicated Playwright command targeted at the new specs) compiles successfully and passes with 100% success.
- [ ] Local server processes (Vite, PartyKit, Wrangler) spin up and close cleanly during the testing lifecycle without port leaks.

## 2026-05-21T09:26:03Z

This project performs a comprehensive, multi-domain audit of the ARES Web Portal codebase and website (`c:\Users\david\dev\robotics\ftc\ARESWEB`). The audit evaluates the platform against the 12 Pillars of Excellence defined in the Team ARES audit protocol, culminating in a high-fidelity, structured compliance report and actionable roadmap.

Working directory: c:\Users\david\dev\robotics\ftc\ARESWEB
Integrity mode: development

## Requirements

### R1. Backend API, Security, and Database Audit
- Evaluate the authentication/authorization flows, input validation schemas (`OpenAPIHono`/Zod), Turnstile integrations, rate-limiting, and error-handling architectures.
- Check Cloudflare D1 query patterns for direct template string concatenation vs. parameterized bindings (`?`) and investigate efficiency bottlenecks (N+1 queries, indexing, migrations).
- Check asynchronous worker tasks to ensure proper use of `c.executionCtx.waitUntil()`.

### R2. Frontend Component, Brand, and Accessibility Audit
- Audit Next.js React components, forms, and pages for strict brand compliance (no arbitrary Tailwind color scales or raw hex codes outside the ARES palette).
- Validate web accessibility (WCAG 2.1 AA conformance, keyboard navigation, contrast ratios, and ARIA roles for complex lists or tables).
- Verify state management patterns (Zustand over render-heavy React Contexts, `nuqs` for deep URL state, React Hook Form for inputs, and react-virtual for heavy lists).

### R3. Test Coverage & Environment Hygiene
- Assess Vitest unit and integration test coverage (minimum 85% line and 100% function coverage thresholds) and Playwright E2E integration pathways.
- Inspect test mock implementations (MSW for network, `mockExecutionContext` for Hono).
- Scan for developmental residues, log noise (`console.log`), and untracked scratch/temp files.

## Acceptance Criteria

### Audit Report Standards
- [ ] An `AUDIT_REPORT.md` file is generated in the root of the workspace.
- [ ] The report contains a clear header specifying the date, auditor names, and scope.
- [ ] The report contains a complete **Summary Scorecard Table** grading each of the 12 pillars (A-F) with a brief summary of critical items.
- [ ] The report includes a **Sectioned Detail** using exact `✅ Strengths` and `⚠️ Findings` headings for each of the 12 pillars.
- [ ] Any discovered flaw is logged in a **Findings Table** specifying a unique ID (e.g., `AUD-F01`), severity (e.g., `[HIGH]`, `[MEDIUM]`, `[LOW]`), exact details, and file location with line numbers.
- [ ] The report details a clear, prioritized **Roadmap to Compliance** divided into `🔴 Must Fix`, `🟡 Should Fix`, and `🟢 Backlog` blocks.
