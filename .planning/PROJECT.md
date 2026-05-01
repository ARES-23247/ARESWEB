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
- ✓ **Milestone 3.4 (Collaborative Editing Ecosystem)** — Integrated real-time multiplayer document editing using Tiptap and Liveblocks.
- ✓ **Milestone 3.5 (Version Control & Contributor Attribution)** — Delivered historical version control and YPP-compliant public avatar attribution across ARESWEB documents.

- ✓ **Milestone 3.9 (Stripe Storefront)** — Delivered D1 ecommerce schemas, Hono Stripe backend, persistent Zustand cart, and admin fulfillment dashboard.

- ✓ **Milestone 4.0 (Gamification)** — Implemented Gamified member activity points system and leaderboard.
- ✓ **Milestone 4.0 (Documentation)** — Created comprehensive tech stack architecture and GSD orchestration documentation.
- ✓ **Milestone 4.1 (System Evolution)** — Modernized tech stack UI with dynamic physics-based grid and integrated Playwright/Turnstile cards.

- ✓ **Milestone 4.2 (Sponsor Fixes & Docs Quality)** — Fixed sponsor logo uploads and upgraded documentation leveraging `areslib` patterns.
- ✓ **Milestone 4.3 (Inquiries, Notifications & Docs)** — Fixed notification bugs, restored docs data, generated Zulip threads for inquiries, and added inquiry notes.
- ✓ **Milestone 4.4 (AI Copilot & CI Stabilization)** — Integrated z.ai RAG chatbot and copilot endpoint, stabilized CI pipelines, fixed TDZ chunk circular dependencies.
- ✓ **Milestone 4.5 (AI Workers Migration & Copilot)** — Migrated RAG chatbot to Cloudflare Workers AI Llama 3.1 8B (free tier), expanded CopilotMenu to all editors.
- ✓ **Milestone 4.6 (RAG Knowledge Base Pipeline)** — Built incremental site content indexer with Workers AI embeddings and Cloudflare Vectorize. Added admin reindex controls.
- ✓ **Milestone 4.8 (Simulation Playground UI Fixes)** — Resolved Monaco editor rendering failure by updating CSP to allow jsdelivr and blob web workers.
- ✓ **Milestone 5.1 (IDE Experience)** — Overhauled the simulation playground's z.AI assistant to stream markdown-fenced code blocks directly into the Monaco Editor. Migrated simulation template storage to a hybrid architecture bridging official GitHub team templates with Cloudflare D1 custom saves.

### Active
- None

## Current Milestone: v5.3

**Goal:** Address GitHub Rate limits ("Forbidden" errors) by injecting GITHUB_PAT authentication into the Vectorize RAG knowledge base indexing pipeline.

## Current State

<details>
<summary>v5.2 Shipped Features</summary>

- Re-engineered Document Revision tracking by injecting manual AST snapshots into Cloudflare D1.
- Abstracted the Document Version History panel to a React Portal to resolve deep Z-index layout conflicts.
- Built a native debouncer hook for the internal Notes area to prevent dataloss when switching views.
</details>

<details>
<summary>v5.1 Shipped Features</summary>

- Streaming Markdown code generation into the Simulation Playground editor.
- Hybrid Architecture for storing user-created simulation templates to Cloudflare D1.
</details>

<details>
<summary>v4.6 Shipped Features</summary>

- Incremental Vectorize indexing pipeline for public site content (posts, events, docs, seasons).
- Admin reindex controls (`POST /api/ai/reindex`) with incremental and force modes.
</details>

<details>
<summary>v4.5 Shipped Features</summary>

- Migrated chatbot to Cloudflare Workers AI (Llama 3.1 8B).
- Expanded CopilotMenu to BlogEditor, EventEditor, SeasonEditor, and MassEmailComposer.
</details>

<details>
<summary>v4.4 Shipped Features</summary>

- Integrated z.ai-powered RAG chatbot with streaming and Turnstile gating.
- Fixed Cloudflare API token CI errors and nested frame layouts.
</details>

<details>
<summary>v4.3 Shipped Features</summary>

- Fixed persistent notification state issues.
- Restored missing documentation entries to the database.
- Automated Zulip thread creation for new inquiries and added internal notes system.
</details>

<details>
<summary>v4.2 Shipped Features</summary>

- Investigated and resolved the bug preventing logo updates on `dashboard/sponsors`.
- Audited and upgraded the quality of `aresfirst.org/docs/` leveraging patterns/code from `areslib`.
</details>

<details>
<summary>v4.1 Shipped Features</summary>

- Modernized the `/tech-stack` page with a physics-based, glassmorphic grid layout.
- Added integration documentation cards for Cloudflare Turnstile and Playwright E2E.
- Resolved all remaining ESLint warnings to achieve 100% clean CI pipeline.
- Established infrastructure for the 3D Hardware Visualizer (RobotViewer), tracked for future headless WebGL optimization.
</details>

<details>
<summary>v4.0 Shipped Features</summary>

- Eliminated brittle assertions and built an isolated webhook testing suite.
- Added Zulip alerts and database-level inventory depletion for the storefront.
- Implemented a gamified points ledger and UI for member engagement.
- Refreshed documentation covering the tech stack, Liveblocks/Tiptap, and GSD orchestration.
</details>

<details>
<summary>v3.9 Shipped Features</summary>

- Native Stripe eCommerce Storefront with ARES branding.
- Cloudflare D1 robust `products` and `orders` management schemas.
- `ts-rest` Hono backend for Stripe Checkout Session generation and Webhook processing.
- Persistent local shopping cart state via Zustand.
- Internal ARES Admin Fulfillment Dashboard to track shipping addresses and toggle order statuses.
</details>

<details>
<summary>v3.8 Shipped Features</summary>

- Fixed duplicate `content_draft` columns in legacy Liveblocks migrations.
- Audited and refactored backend raw SQL queries into Kysely standard types.
- Rewrote the V8 isolate rate limiter to a globally synchronized Cloudflare KV namespace (`RATE_LIMITS`).
- Implemented a 30-day soft-delete garbage collection Cron worker.
- Sharded the Playwright E2E test matrix and optimized the GitHub Actions CI pipeline.
</details>

<details>
<summary>v3.7 Shipped Features</summary>

- Resolved component-level CSS utility conflicts in AgendaViewList and PresenceAvatars
- Suppressed IDE warnings related to PostCSS/Tailwind directives in `index.css`
- Eliminated all ESLint warnings and errors across the codebase, enforcing `--max-warnings 0`
- Fixed `LiveblocksYjsProvider` strict TypeScript typings in Tiptap extensions
</details>

<details>
<summary>v3.6 Shipped Features</summary>

- Fixed Z-index layout conflicts for the Version History sidebar
- Implemented a 10-minute snapshot rate limiter on collaborative document webhooks
- Added autonomous 30-day snapshot expiration via background D1 cron tasks
- Perfected `MemberCard` rendering, standardizing row height and fixing backdrop blur artifacts
- Passed WCAG 2.1 AA accessibility contrast rules for Roster UI components
</details>

<details>
<summary>v3.5 Shipped Features</summary>

- Version history viewer UI for documents, posts, and events
- Draft rollback functionality from historical snapshots
- Contributor tracking backend for tracking unique users who edited documents
- Dynamic overlapping student avatar stack on public pages, enforcing FIRST youth protection guidelines
</details>

<details>
<summary>v3.4 Shipped Features</summary>

- Liveblocks backend authentication integration for secure token generation
- Tiptap Yjs extension implementation for multiplayer document state syncing
- Live cursors and presence avatars to visualize active collaborators
- Draft persistence and historical snapshotting via Webhooks
</details>

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
1. Add `GITHUB_PAT` secrets configuration via `.dev.vars` and Cloudflare Secrets.
2. Confirm indexing succeeds for all referenced external documentation sites.
3. Validate Vectorize batch size limits.

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
*Last updated: 2026-04-30 after v4.7 milestone completion*
