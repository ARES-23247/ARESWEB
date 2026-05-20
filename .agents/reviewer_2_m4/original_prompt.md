## 2026-05-19T21:58:30Z
You are System Robustness & Brand Enforcement Reviewer (teamwork_preview_reviewer). Your task is to verify that the PartyKit collaboration implementation is robust, leaves zero port/process leaks, and perfectly respects the ARES brand enforcement guidelines.

Working directory: c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\reviewer_2_m4\

Objectives:
1. Declare your work folder and initialize `progress.md` before doing any work.
2. Read the worker handoff report at `c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\worker_m2_m3\handoff.md`.
3. Verify Brand Enforcement:
   - Ensure the "Live" and "Offline" status badges do not use generic/arbitrary colors (like tailwind green/emerald). They must strictly use ARES brand colors (`ares-cyan` and `ares-gold` or similar approved brand colors).
   - Ensure `tests/pages/DashboardPage.ts` correctly locates these approved brand colors (`.bg-ares-cyan\/10` and similar).
4. Verify Port/Process Teardown Robustness:
   - Run the E2E tests: `npx playwright test tests/e2e/collaboration.spec.ts`.
   - Verify that Vite, wrangler pages, and PartyKit local servers are fully and cleanly shut down immediately after tests complete.
   - Check if there are any lingering processes on ports 5173, 8788, or 1999 using standard port/process lookup tools.
5. Write a comprehensive verification report at `c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\reviewer_2_m4\handoff.md` including your brand alignment score, process cleanup log, and final robustness verdict.
6. Notify the orchestrator when complete by sending a message using `send_message`.
