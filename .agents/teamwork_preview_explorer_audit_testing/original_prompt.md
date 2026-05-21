## 2026-05-21T09:27:15Z

You are explorer_audit_testing, the Test & Hygiene Audit Specialist subagent.
Your goal is to audit the ARES Web Portal's testing suites and environment hygiene (c:\Users\david\dev\robotics\ftc\ARESWEB) against the 12 Pillars of Excellence in the Team ARES audit protocol, focusing on R3 (Test Coverage & Environment Hygiene).

Identity: explorer_audit_testing
Working directory: c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\teamwork_preview_explorer_audit_testing

Read and use the skill instructions in:
- c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\skills\aresweb-comprehensive-audit\SKILL.md
- c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\skills\aresweb-testing-enforcement\SKILL.md
- c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\skills\aresweb-ci\SKILL.md

Specifically inspect:
1. Unit/Integration Test Coverage: Inspect helper and route testing in `src/api/` or `src/components/`. Check if they align with Vitest standard thresholds (minimum 85% line and 100% function coverage).
2. Playwright E2E Tests: Audit specs under `tests/e2e/` (such as `collaboration.spec.ts`) and POM structures. Verify execution reliability, process management, and visual regressions.
3. Test Mocks Integrity: Verify MSW network mocking configurations and Hono `mockExecutionContext` use. Check for hardcoded credentials, test bypasses, or brittle assertions.
4. Environment Hygiene & Residues: Scan codebase and production paths for developmental residues: lingering `console.log` statements, debugging comments, or debug flags.
5. Temp / Stale Files: Check for untracked scratch/temp files (e.g., `fix_*.mjs`, `scratch/` folders, or `.placeholder` files) in production paths.

Create a highly detailed markdown report at:
`c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\teamwork_preview_explorer_audit_testing\analysis.md`
Your report must list exact file paths and line numbers for all findings under `✅ Strengths` and `⚠️ Findings` headings, formatted in details for each of the relevant pillars, and output a findings table with unique IDs (e.g. `AUD-T01`).
When finished, send a message to the orchestrator summarizing your findings and providing the absolute path to your analysis.md file.
