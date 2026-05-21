# BRIEFING — 2026-05-21T09:26:29-04:00

## Mission
Perform a comprehensive, multi-domain audit of the codebase against the 12 Pillars of Excellence in the Team ARES audit protocol, producing a high-fidelity AUDIT_REPORT.md and roadmap.

## 🔒 My Identity
- Archetype: Project Orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\orchestrator
- Original parent: top-level
- Original parent conversation ID: 92581261-1484-4fcf-aa87-b399c0dd758a

## 🔒 My Workflow
- **Pattern**: Project
- **Scope document**: c:\Users\david\dev\robotics\ftc\ARESWEB\PROJECT.md
1. **Decompose**: Decompose the comprehensive codebase audit into multi-domain exploration, consolidation, synthesis, report writing, and rigorous reviews/auditing.
2. **Dispatch & Execute**:
   - **Direct (iteration loop)**: Explorer → Worker → Reviewer → test → gate
   - **Delegate (sub-orchestrator)**: Spawn subagents for domain audits, report compiling, and verification.
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: Self-succeed at 16 spawns, write handoff.md, spawn successor.
- **Work items**:
  1. Multi-domain parallel audits (Backend, Frontend, Testing) [in-progress]
  2. Findings consolidation and synthesis [pending]
  3. Compile `AUDIT_REPORT.md` [pending]
  4. Final review and forensic integrity audit [pending]
- **Current phase**: 1
- **Current focus**: Parallel multi-domain audits with explorers

## 🔒 Key Constraints
- Never write, modify, or create source code files directly.
- Never run build/test commands yourself — require workers to do so.
- You MAY use file-editing tools ONLY for metadata/state files (.md) in your .agents/ folder.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.
- Hard veto on integrity violation from Forensic Auditor.

## Current Parent
- Conversation ID: 92581261-1484-4fcf-aa87-b399c0dd758a
- Updated: yes

## Key Decisions Made
- Partition the codebase into Backend (D1 database, routes, authentication, schema, queue), Frontend (Next.js components, brand compliance, WCAG accessibility, Zustand state), and Testing (Vitest, Playwright, mock integrity, console logs, environment hygiene) to ensure comprehensive parallel coverage.
- Arm backend explorer with `aresweb-database-management`, `aresweb-error-handling`, `aresweb-failure-exposure`, and `aresweb-typescript-safety` skills.
- Arm frontend explorer with `aresweb-brand-enforcement`, `aresweb-web-accessibility`, `aresweb-youth-data-protection` skills.
- Arm testing explorer with `aresweb-testing-enforcement` and `aresweb-ci` skills.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| explorer_audit_backend | teamwork_preview_explorer | Audit Backend API, D1 queries, and Security | in-progress | ba83e804-006b-429b-b17f-58a4587289b7 |
| explorer_audit_frontend | teamwork_preview_explorer | Audit Frontend, Brand palette, Accessibility | in-progress | ed6c63c4-013e-4ea4-8161-90eac88de4dc |
| explorer_audit_testing | teamwork_preview_explorer | Audit Test coverage, Mocks, and Hygiene | in-progress | c0627278-f64e-41e8-a8ec-57725dd98f16 |

## Succession Status
- Succession required: no
- Spawn count: 13 / 16
- Pending subagents: ba83e804-006b-429b-b17f-58a4587289b7, ed6c63c4-013e-4ea4-8161-90eac88de4dc, c0627278-f64e-41e8-a8ec-57725dd98f16
- Predecessor: none
- Successor: none

## Active Timers
- Heartbeat cron: task-33
- Safety timer: none
- On succession: kill all timers before spawning successor
- On context truncation: run `manage_task(Action="list")` — re-create if missing

## Artifact Index
- c:\Users\david\dev\robotics\ftc\ARESWEB\PROJECT.md — Main Project Scope
- c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\orchestrator\progress.md — Progress Heartbeat
- c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\orchestrator\plan.md — Audit Plan
