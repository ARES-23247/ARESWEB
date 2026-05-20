## 2026-05-19T21:40:04Z
You are Lead Collaborative Testing Implementer (teamwork_preview_worker). Your task is to implement Milestones 2 and 3 for verifying real-time, multi-client collaborative session syncing on the ARES Web Portal's PartyKit server, as detailed in the Explorer's handoff report at `c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\explorer_m1\handoff.md`.

Working directory: c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\worker_m2_m3\

Objectives:
1. Declare your work folder and initialize `progress.md` before doing any work.
2. Clean Ports in `package.json` line 27: Add port `1999` to `npx kill-port` in the `pretest:e2e` script so any lingering local PartyKit servers are cleared before/after tests.
3. Configure PartyKit in `playwright.config.ts` WebServer: Expand the `webServer` block so it starts the local PartyKit server concurrently during local E2E tests:
   ```typescript
   webServer: previewUrl ? undefined : [
     {
       command: WRANGLER_COMMAND,
       url: 'http://127.0.0.1:8788',
       reuseExistingServer: !process.env.CI,
       timeout: 120 * 1000,
     },
     {
       command: 'npx partykit dev --port 1999',
       cwd: './partykit',
       url: 'http://127.0.0.1:1999/parties/main/room/test-health-check',
       reuseExistingServer: !process.env.CI,
       timeout: 30 * 1000,
     }
   ]
   ```
4. Expose Test Host Variable: Declare `__TEST_PARTYKIT_HOST__` as an optional string on `interface Window` in `src/types/window.d.ts` and `src/vite-env.d.ts`.
5. Integrate Test Host in CollaborativeEditorRoom: In `src/components/editor/CollaborativeEditorRoom.tsx`, update the `host` calculation Hook to:
   - Check if `window.__TEST_PARTYKIT_HOST__` is set, and if so, return it as the host.
   - If not set, check `window.__PLAYWRIGHT_TEST__` and return `""`.
   - Otherwise, fall back to `import.meta.env.VITE_PARTYKIT_HOST`.
   Also, in the `useEffect` block of `ConnectedEditorRoom`, ensure the mock connection bypass is only triggered when `window.__PLAYWRIGHT_TEST__` is `true` AND `window.__TEST_PARTYKIT_HOST__` is NOT set:
   ```tsx
   if (typeof window !== 'undefined' && window.__PLAYWRIGHT_TEST__ && !window.__TEST_PARTYKIT_HOST__) {
     queueMicrotask(() => { ... });
   } else { ... }
   ```
6. Integrate Test Host in Task Board: In `src/components/TaskBoardPage.tsx`, update the `host` calculation to:
   ```tsx
   const host = (typeof window !== 'undefined' && window.__TEST_PARTYKIT_HOST__)
     ? window.__TEST_PARTYKIT_HOST__
     : ((typeof window !== 'undefined' && window.__PLAYWRIGHT_TEST__)
       ? "dummy-host-for-playwright"
       : (import.meta.env.VITE_PARTYKIT_HOST || ""));
   ```
7. Fix Status Badge Selector: In `tests/pages/DashboardPage.ts` (lines 75 and 84), update the selector from `.bg-emerald-500\/10` to `.bg-ares-cyan\/10` to comply with the brand color palette.
8. Update & Extend E2E Specs:
   In `tests/e2e/collaboration.spec.ts`:
   - Initialize both standard tests and new multi-client E2E tests.
   - Ensure the `__TEST_PARTYKIT_HOST__` is injected via `page.addInitScript()` (value: `"localhost:1999"`) for all tests in this file.
   - For `INT-02` (multi-client synchronization), simulate User 1 and User 2 by configuring their respective page contexts with custom mock auth details (User 1 = "User One", User 2 = "User Two") via custom `/api/auth/get-session` route mocking.
   - Navigate both users to the same room. Wait for both to show the `Live` status badge (verifying connection is successfully established!).
   - Simulate editing: Have User 1 select the editor and type something (using `pressSequentially()` or `keyboard.type()` into ProseMirror). Verify that User 2 sees User 1's changes synchronized in real time.
   - Simulate Task Board Presence: Have both User 1 and User 2 navigate to the Task Board (`/dashboard/tasks`). Verify that User 1's page shows User 2's presence avatar (title "User Two") and User 2's page shows User 1's presence avatar (title "User One"). Verify that closing/disconnecting one user context correctly decrements/updates the presence list on the other client's viewport.
9. Compile and Local Test Run: Run the newly created/updated tests using Playwright locally to ensure they compile and pass 100% successfully.
10. Check for process/port leaks: Verify that all spawned servers exit cleanly after the test suite finishes.
