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
- ✓ **Milestone 3.2 (Operations & UX)** — Delivered native iCal/WebCal calendar subscriptions, resolved Kanban sponsorship idempotency bugs, and fixed Finance Manager budget deletion, achieving 100% API coverage.

- ✓ **Milestone 3.3 (Calendar UX Refinement)** — Prevented webkit scrollbar overflow issues when hovering over calendar events, preserving grid stability.

### Active
- [v3.4] Collaborative Editing Ecosystem

## Current Milestone: v3.4 Collaborative Editing Ecosystem

**Goal:** Integrate real-time multiplayer document editing using Tiptap and Liveblocks.

**Target features:**
- Liveblocks backend authentication integration for secure token generation
- Tiptap Yjs extension implementation for multiplayer document state syncing
- Live cursors and presence avatars to visualize active collaborators

## Current State

<details>
<summary>v3.3 Shipped Features</summary>

- Calendar Hover CSS Fixes (prevented scrollbars on event hover by shifting scaling behavior onto the relative Z-axis).
</details>

<details>
<summary>v3.2 Shipped Features</summary>

- Operations and UX improvements, retroactive verification generation.
</details>

<details>
<summary>v3.1 Shipped Features</summary>

- Replaced the embedded Google Calendar iframe with a native React calendar component.
- Built D1-backed event management with automatic background syncing to Google Calendar via `waitUntil`.
- Established `ts-rest` contracts for full CRUD local event management.
- Successfully achieved 100% test coverage across all new event API routes.
</details>

<details>
<summary>v3.0 Shipped Features</summary>

- Restored Finance Dashboard functionality, explicitly fixing the `estimated_value` coercion and `season_id` type mismatch preventing card creation.
- Stabilized and verified the backend via the `ts-rest` contract and 100% vitest line coverage requirement.
- Hotfix: Removed unsupported interactive D1 transactions (`db.transaction()`) from `savePipeline` to ensure Cloudflare compatibility.
- Hotfix: Resolved outstanding ESLint warnings (empty blocks, unused variables) across the test suite.
- Hotfix: Fixed Playwright E2E test failures (`interactive-systems.spec.ts`) by correctly mocking the Better-Auth session required for Zulip components to render.
- Feature: Integrated Zulip thread comments and multi-user task assignments to the Sponsorship Kanban pipeline.
</details>

## Next Milestone Goals
*Run `/gsd-new-milestone` to define the next objective.*

- Self-hosting (Project relies strictly on Cloudflare's serverless edge ecosystem).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Cloudflare D1 + Hono | Low latency, edge native, zero-config deployment. | Validated |
| 100% Test Coverage | Ensures no regressions in the API logic. | Validated |
| Local Calendar > Google Embeds | Guarantees ARES brand aesthetic, prevents event duplication, and allows linking events to tasks/zulip. | Active |

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
*Last updated: 2026-04-28 after v3.3 milestone completion*
