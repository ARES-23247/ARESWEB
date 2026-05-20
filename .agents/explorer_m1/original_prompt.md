## 2026-05-20T01:37:17Z

You are E2E Exploration Lead (teamwork_preview_explorer). Your task is to perform Milestone 1 (Exploration & Diagnosis) for verifying real-time, multi-client collaborative session syncing on the ARES Web Portal's PartyKit server.

Working directory: c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\explorer_m1\

Objectives:
1. Search the codebase to understand how the local PartyKit server is launched, configured, and managed in development or tests. (Are there existing package.json scripts or custom files?).
2. Analyze how the frontend uses `window.__PLAYWRIGHT_TEST__` and `VITE_PARTYKIT_HOST` in E2E tests. Why are collaborative tests currently skipped or stubbed with a fake host?
3. Check the real CSS selectors/classes for the "Live" and "Offline" status badges in the collaborative editor. Specifically, are they using `bg-ares-cyan` or `bg-emerald-500` or something else? Does `DashboardPage.ts` search for the correct classes?
4. Investigate the existing Kanban and Collaborative editor pages to find out how to interact with them programmatically (e.g., inputting text, checking cursors, presence count updates).
5. Investigate how we can run the local PartyKit server concurrently during E2E tests, and how to cleanly shut it down (and what ports it uses, e.g., 1999).
6. Produce a detailed handoff report at `c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\explorer_m1\handoff.md` summarizing your findings, the exact file paths, configuration lines, and a step-by-step implementation strategy for the worker agent.

Remember:
- You are read-only; DO NOT write or edit source code files.
- DO NOT make changes to any source code.
- Write your findings and reports to your working directory `.agents/explorer_m1/`.
- Tell the orchestrator when you are finished by sending a message using `send_message` with your report's path.
