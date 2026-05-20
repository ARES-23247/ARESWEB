# Progress Tracker

Last visited: 2026-05-20T01:42:00Z

## Done
- Initialized briefing and progress tracking.
- Clean Ports: Added port `1999` to `npx kill-port` in the `pretest:e2e` script in `package.json`.
- Configure PartyKit: Expanded `webServer` block in `playwright.config.ts` to run wrangler and local PartyKit server concurrently on port 1999.
- Expose Test Host Variable: Declared `__TEST_PARTYKIT_HOST__` as an optional string on `interface Window` in `src/types/window.d.ts` and `src/vite-env.d.ts`.
- Integrate Test Host in CollaborativeEditorRoom: Updated host calculation useMemo hook and bypass condition.
- Integrate Test Host in Task Board: Updated host calculation in `src/components/TaskBoardPage.tsx`.
- Fix Status Badge Selector: Updated `.bg-emerald-500\/10` to `.bg-ares-cyan\/10` in `tests/pages/DashboardPage.ts` to comply with the brand color palette.
- E2E Specs: Rewrote `tests/e2e/collaboration.spec.ts` to test multi-client typing, presence avatars, and clean disconnects.
- Support leave event in KanbanServer to broadcast to clients, and handled in TaskBoardPage.
- Fixed stale `schema.sql` definitions: changed `task_checklists.title` to `task_checklists.content` and added missing `uploaded_files` & `file_usage` tables.

## In Progress
- Compiling, bootstrapping, and seeding database locally via `npm run pretest:e2e`.

## Todo
- Run Playwright E2E tests: `npx playwright test tests/e2e/collaboration.spec.ts`.
- Verify all tests pass 100% successfully.
- Check for process/port leaks.
