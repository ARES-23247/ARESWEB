# E2E PartyKit Collaboration Test Suite Plan

## Objective
Establish a robust, multi-client, end-to-end Playwright test suite verifying real-time collaborative syncing on the ARES Web Portal's PartyKit server, ensuring that simultaneous presence, cursor movements, text edits, and network resilience are programmatically verified without port leaks or lingering processes.

## Architecture & Integration Details
- **Frontend Rooms**: `CollaborativeEditorRoom.tsx` handles room synchronization using `y-partykit/provider`.
- **PartyKit Server**: Lives in `partykit/server.ts` and `partykit/kanban-server.ts`.
- **Bypass Flag**: In Playwright tests, the frontend forces standalone mode when `window.__PLAYWRIGHT_TEST__` is `true`. To verify real-time, multi-client syncing over live local PartyKit WebSocket server, the tests must be able to selectively bypass/disable or configure this flag or we need to spin up the local PartyKit server and ensure the client can connect.
- **Port/Process Management**: Local processes (Vite, local PartyKit, database instances) must spin up and tear down cleanly without port leaks.

## Milestones & Decompositions

| # | Milestone Name | Goal | Status |
|---|----------------|------|--------|
| M1 | Exploration & Diagnosis | Gather precise information on how the local PartyKit server is executed, how `window.__PLAYWRIGHT_TEST__` behaves, and why tests are currently skipped. | PLANNED |
| M2 | Infrastructure Setup | Configure a test runner or custom script/playwright project that launches the local Vite server, the local PartyKit server, and local database instances cleanly before E2E execution, and tears them down. | PLANNED |
| M3 | E2E Spec Implementation | Implement/update the Playwright E2E spec to simulate at least 2 concurrent browser contexts, verify cursor/typing updates in real-time, and check presence counts incrementing/decrementing. | PLANNED |
| M4 | Validation & Hardening | Run all E2E specs, ensure 100% success rate, verify zero port leaks, and pass all lints/checks. | PLANNED |

## Verifications
- Run `npm run test:e2e` or custom test runner.
- Validate that all server processes close cleanly.
- Verify presence count changes.
- Verify text updates are synchronized between two browser contexts.
