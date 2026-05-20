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
