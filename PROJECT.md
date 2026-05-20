# Project: E2E Playwright PartyKit Tests Verification

## Architecture
- **Web App**: React SPA built with Vite, utilizing Hono API and Cloudflare D1 for SQLite compatibility.
- **Real-Time Collaboration**: Powered by PartyKit (based on Cloudflare Durable Objects and Yjs).
  - Front-end providers in `src/components/editor/CollaborativeEditorRoom.tsx` and `src/components/TaskBoardPage.tsx`.
  - Server endpoints in `partykit/server.ts` and `partykit/kanban-server.ts`.
- **Testing Framework**: Playwright running E2E tests, simulating multiple concurrent browser contexts.

## Code Layout
- `tests/e2e/` — Contains Playwright test specs.
- `partykit/` — Contains PartyKit server configurations and implementations.
- `src/components/editor/` — Collaborative editor room and status indicator.
- `.agents/orchestrator/` — Orchestrator coordination folder.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Exploration & Diagnosis | Search existing files, run initial commands, understand how PartyKit is run, examine how test configurations bypass real-time sync. | None | DONE |
| 2 | Infrastructure Setup | Set up clean starting/teardown commands for Vite, local D1, and PartyKit without port leaks. | M1 | IN_PROGRESS |
| 3 | E2E Spec Implementation | Write robust multi-client tests under `tests/e2e/collaboration.spec.ts` or a new file verifying concurrent presence and updates. | M2 | PLANNED |
| 4 | Verification & Hardening | Execute full test suite, guarantee 100% pass rate, ensure lint and formatting success, run forensic audit. | M3 | PLANNED |

## Interface Contracts
- **PartyKit WS Connection**: Websocket connection to local PartyKit server (`127.0.0.1:1999` by default for local PartyKit dev server).
- **Vite Local Server**: Server running on `127.0.0.1:8788` or `127.0.0.1:5173`.
