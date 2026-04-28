# ARESWEB

## What This Is
The official dashboard, team portal, and website for ARES 23247 FIRST Robotics team. It provides authenticated management of team operations including tasks, posts, finance, robotics resources, and outreach.

## Core Value
Providing a highly accessible, fast, and feature-rich unified portal for students, mentors, and administrators.

## Context
ARESWEB is a brownfield project built heavily on Cloudflare Pages and D1 using Hono and React. It enforces high quality standards, including 100% backend function coverage and strict TypeScript compilation.

## Requirements

### Validated

- ✓ **Authentication** — Better-Auth integration with role-based access control.
- ✓ **Tasks** — Kanban board, Zulip notifications, Markdown assignments.
- ✓ **Posts** — Blog and social media integrations, TipTap rich text.
- ✓ **Finance** — Ledger for transactions and sponsorships.
- ✓ **Analytics** — Aggregated team statistics.
- ✓ **Outreach** — External team engagement tracking.
- ✓ **Milestone 2 (Tech Debt Cleanup)** — Addressed architectural fragility, resolved `waitUntil` test flakiness, standardized Kysely database mocks, and hardened media upload validation.

### Active

## Current State

**v3.0 Shipped Features:**
- Restored Finance Dashboard functionality, explicitly fixing the `estimated_value` coercion and `season_id` type mismatch preventing card creation.
- Stabilized and verified the backend via the `ts-rest` contract and 100% vitest line coverage requirement.

## Next Milestone Goals
*Run `/gsd-new-milestone` to define the next objective.*

- Self-hosting (Project relies strictly on Cloudflare's serverless edge ecosystem).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Cloudflare D1 + Hono | Low latency, edge native, zero-config deployment. | Validated |
| 100% Test Coverage | Ensures no regressions in the API logic. | Validated |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-28 after v3.0 initialization*
