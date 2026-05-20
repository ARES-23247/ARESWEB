# BRIEFING — 2026-05-20T01:36:28-04:00

## Mission
Plan, delegate, and oversee the implementation of E2E Playwright tests verifying real-time, multi-client collaborative session syncing on the ARES Web Portal's PartyKit server, ensuring 100% success and no port/process leaks.

## 🔒 My Identity
- Archetype: Project Orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\orchestrator
- Original parent: top-level
- Original parent conversation ID: 92581261-1484-4fcf-aa87-b399c0dd758a

## 🔒 My Workflow
- **Pattern**: Project
- **Scope document**: c:\Users\david\dev\robotics\ftc\ARESWEB\PROJECT.md
1. **Decompose**: Decompose the requirements (R1, R2, R3) into sequential milestones to explorer, worker, and reviewer subagents.
2. **Dispatch & Execute**:
   - **Direct (iteration loop)**: Explorer → Worker → Reviewer → test → gate
   - **Delegate (sub-orchestrator)**: Spawn subagents for exploration, implementation, review, and verification.
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: Self-succeed at 16 spawns, write handoff.md, spawn successor.
- **Work items**:
  1. Explore current configuration and existing tests [done]
  2. Implement infrastructure & real-time test settings [in-progress]
  3. Implement E2E Playwright tests verifying multi-client sync [pending]
  4. Verify E2E Playwright tests & run audit [pending]
- **Current phase**: 2
- **Current focus**: Infrastructure Setup & real-time host bypass integration

## 🔒 Key Constraints
- Never write, modify, or create source code files directly.
- Never run build/test commands yourself — require workers to do so.
- You MAY use file-editing tools ONLY for metadata/state files (.md) in your .agents/ folder.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.
- Hard veto on integrity violation from Forensic Auditor.

## Current Parent
- Conversation ID: 92581261-1484-4fcf-aa87-b399c0dd758a
- Updated: not yet

## Key Decisions Made
- [TBD]

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| explorer_m1 | teamwork_preview_explorer | Milestone 1: Exploration & Diagnosis | completed | 0cf5ad90-c349-4762-8c76-5f912a7c5226 |
| worker_m2_m3 | teamwork_preview_worker | Milestones 2 & 3: Infrastructure & E2E Specs | completed | df6a0e93-18c0-4a49-af2e-a228cfbc469f |
| reviewer_1_m4 | teamwork_preview_reviewer | Code Integrity Review | in-progress | 3a379973-d3cc-4bbf-84c0-e4b6b6191db4 |
| reviewer_2_m4 | teamwork_preview_reviewer | Brand & Robustness Review | in-progress | da90ece4-06a7-4240-bcfa-e01b52ae87e4 |
| auditor_m4 | teamwork_preview_auditor | Forensic Integrity Audit | failed | f33eb121-5faa-452c-8346-553f6e3eb803 |

## Succession Status
- Succession required: no
- Spawn count: 7 / 16
- Pending subagents: [3a379973-d3cc-4bbf-84c0-e4b6b6191db4, da90ece4-06a7-4240-bcfa-e01b52ae87e4]
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: 92581261-1484-4fcf-aa87-b399c0dd758a/task-17
- Safety timer: none
- On succession: kill all timers before spawning successor
- On context truncation: run `manage_task(Action="list")` — re-create if missing

## Artifact Index
- c:\Users\david\dev\robotics\ftc\ARESWEB\PROJECT.md — Main Project Scope & Milestones
- c:\Users\david\dev\robotics\ftc\ARESWEB\.agents\orchestrator\progress.md — Progress Heartbeat
