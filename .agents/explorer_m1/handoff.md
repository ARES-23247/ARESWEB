# Handoff Report — PartyKit Collaboration E2E Test Exploration & Diagnosis

## 1. Observation
We observed the following technical elements across the ARES Web Portal codebase:

### A. Status Badge CSS Classes
1. In `src/components/editor/CollaborativeEditorRoom.tsx` (lines 296-297), the "Live" status badge is rendered as:
   ```tsx
   <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium bg-ares-cyan/10 text-ares-cyan border border-ares-cyan/20">
     <Wifi size={10} /> Live
   </div>
   ```
   For the "Offline" status badge (lines 305-308):
   ```tsx
   <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium bg-ares-gold/10 text-ares-gold border border-ares-gold/20">
     <WifiOff size={10} /> Offline
     {!isCollaborative && <span className="text-ares-bronze-light/80 text-[9px] ml-1">(Local only)</span>}
   </div>
   ```
2. In `src/components/TaskBoardPage.tsx` (lines 303-305), the Live status badge uses a similar styling:
   ```tsx
   <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium bg-ares-cyan/10 text-ares-cyan border border-ares-cyan/20">
     <div className="w-1.5 h-1.5 rounded-full bg-ares-cyan animate-pulse"></div> Live
   </div>
   ```
3. In `tests/pages/DashboardPage.ts` (lines 75 and 84), the class searched by Playwright is `.bg-emerald-500\/10`:
   ```typescript
   const badge = this.page.locator('.bg-emerald-500\\/10').filter({ hasText: 'Live' }).first();
   ```

### B. Playwright Test Bypass & Hosts
1. In `src/components/editor/CollaborativeEditorRoom.tsx` (lines 343-349):
   ```tsx
   const host = useMemo(() => {
     // In Playwright tests, force standalone mode by returning empty string
     if (typeof window !== 'undefined' && window.__PLAYWRIGHT_TEST__) {
       return "";
     }
     return import.meta.env.VITE_PARTYKIT_HOST || "";
   }, []);
   ```
2. In `src/components/TaskBoardPage.tsx` (lines 85-87):
   ```tsx
   const host = (typeof window !== 'undefined' && window.__PLAYWRIGHT_TEST__)
     ? "dummy-host-for-playwright"
     : (import.meta.env.VITE_PARTYKIT_HOST || "");
   ```
3. In `tests/fixtures/auth.ts` (lines 133-136), `setupMockAuth` automatically injects the bypass variable:
   ```typescript
   // Set test flag
   await page.addInitScript(() => {
     Object.assign(window, { __PLAYWRIGHT_TEST__: true });
   });
   ```

### C. Live Test Run Failures
When running the collaboration tests with `npx playwright test tests/e2e/collaboration.spec.ts`, the tests failed with a timeout:
```
1) [chromium] › tests\e2e\collaboration.spec.ts:24:3 › Collaboration › INT-01: All editors display Live badge when connected 

  TimeoutError: locator.waitFor: Timeout 15000ms exceeded.
  Call log:
    - waiting for locator('.bg-emerald-500\\/10').filter({ hasText: 'Live' }).first() to be visible
```
Accompanied by this browser console log:
```
BROWSER CONSOLE: [CollaborativeEditor] VITE_PARTYKIT_HOST is not set! Collaborative editing will be disabled.
```

### D. PartyKit Local Server
1. The local PartyKit server was successfully spun up in the background during investigation by executing `npx partykit dev --port 1999` in the `partykit` directory, which prints:
   ```
   🎈 PartyKit v0.0.115
   Build succeeded, starting server...
   [pk:inf] Ready on http://0.0.0.0:1999
   [pk:inf] - http://127.0.0.1:1999
   ```
2. In `package.json` (line 27), the cleanup script is:
   ```json
   "pretest:e2e": "npx kill-port 5173 8788 || true && npm run build && npm run db:setup:local && npm run db:seed:local"
   ```

---

## 2. Logic Chain
1. Since `setupMockAuth` sets `window.__PLAYWRIGHT_TEST__ = true` for all E2E tests (Observation B.3), the frontend components override their host setting to `""` or `"dummy-host-for-playwright"` (Observation B.1, B.2).
2. Because the host is empty/dummy, the components log that collaborative editing is disabled and fall back to standalone offline mode (Observation C.2).
3. The component renders an "Offline" badge (`bg-ares-gold/10`) instead of the "Live" badge (Observation A.1).
4. The Playwright spec's locator in `DashboardPage.ts` waits for a `.bg-emerald-500\/10` class containing "Live" (Observation A.3).
5. Even if collaboration had worked, this selector would have timed out because the actual UI is hard-coded to comply with ARES Brand Enforcement and uses `.bg-ares-cyan\/10` instead of the banned green Tailwind scale (Observation A.1, A.2).
6. Therefore, to make collaboration tests pass, we must:
   - Provide a way for specific tests to specify a real PartyKit host (e.g. `window.__TEST_PARTYKIT_HOST__ = "127.0.0.1:1999"`) to bypass the offline stub.
   - Correct the selector in `DashboardPage.ts` from `.bg-emerald-500\/10` to `.bg-ares-cyan\/10`.
   - Update Playwright's config to run the local PartyKit dev server on port 1999.
   - Clean up port 1999 in the E2E script lifecycle.

---

## 3. Caveats
- We assume port `1999` is free in the local environment and won't conflict with other active development processes. If a conflict occurs, `npx kill-port 1999` in `pretest:e2e` will resolve it.
- In CI preview environments, if local processes are constrained, `test.skip(!!process.env.CI)` can still be kept as a safeguard, but with local background running, it will pass 100% locally.

---

## 4. Conclusion
The collaborative tests fail because:
1. The frontend shuts down real connections in testing to avoid timeouts.
2. The page object is looking for a green emerald class that violates the ARES design system and does not exist.
3. The local PartyKit dev server is not launched programmatically in the test suites.

By introducing a new `window.__TEST_PARTYKIT_HOST__` configuration option, fixing the badge CSS selector, and configuring Playwright's `webServer` block to spawn the local PartyKit server, we can verify full multi-client session syncing safely without breaking any other existing tests.

---

## 5. Verification Method

### A. Step-by-Step Implementation Plan for the Worker Agent
The worker agent should execute these steps in order:

1. **Clean Ports**: In `package.json` line 27, add port `1999` to `npx kill-port` to clean up any lingering local PartyKit servers before/after tests:
   ```json
   "pretest:e2e": "npx kill-port 5173 8788 1999 || true && npm run build && npm run db:setup:local && npm run db:seed:local"
   ```

2. **Add PartyKit to WebServer**: In `playwright.config.ts`, expand the `webServer` section to run the local PartyKit server concurrently during E2E tests:
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

3. **Expose Test Host Variable**: Update `src/vite-env.d.ts` and `src/types/window.d.ts` to include `__TEST_PARTYKIT_HOST__` as an optional string.

4. **Integrate Test Host in Editor Room**: In `src/components/editor/CollaborativeEditorRoom.tsx`, update the `host` hook:
   ```tsx
   const host = useMemo(() => {
     if (typeof window !== 'undefined') {
       if (window.__TEST_PARTYKIT_HOST__) {
         return window.__TEST_PARTYKIT_HOST__;
       }
       if (window.__PLAYWRIGHT_TEST__) {
         return "";
       }
     }
     return import.meta.env.VITE_PARTYKIT_HOST || "";
   }, []);
   ```

5. **Integrate Test Host in Task Board**: In `src/components/TaskBoardPage.tsx`, update the `host` resolution:
   ```tsx
   const host = (typeof window !== 'undefined' && window.__TEST_PARTYKIT_HOST__)
     ? window.__TEST_PARTYKIT_HOST__
     : ((typeof window !== 'undefined' && window.__PLAYWRIGHT_TEST__)
       ? "dummy-host-for-playwright"
       : (import.meta.env.VITE_PARTYKIT_HOST || ""));
   ```

6. **Fix Status Badge Selector**: In `tests/pages/DashboardPage.ts` (lines 75 and 84), update `.bg-emerald-500\\/10` to `.bg-ares-cyan\\/10`.

7. **Update Spec File**: In `tests/e2e/collaboration.spec.ts`, update `setupMockAuth` usage to inject `__TEST_PARTYKIT_HOST__ = "localhost:1999"` into both contexts.
   Ensure that for typing into ProseMirror, `pressSequentially()` or `keyboard.type()` is used instead of `fill()`.

### B. Verification Commands
To verify the implementation:
1. Run `npx playwright test tests/e2e/collaboration.spec.ts`
2. Ensure all 3 tests pass successfully.
3. Check `netstat -ano | findstr :1999` after tests complete to confirm the process has exited cleanly.
