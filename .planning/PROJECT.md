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
- ✓ **Milestone 5.3 (GitHub Rate Limits)** — Fixed GitHub indexer Forbidden errors by configuring `GITHUB_PAT` and verifying external RAG fetches.
- ✓ **Milestone 5.4 (Simulation Sandbox)** — Migrated Simulation Sandbox entirely to GitHub API, added fullscreen IDE mode.
- ✓ **Milestone 5.5 (Kanban, Science & Events)** — Kanban subteams, expanded Science Corner engine wrappers, robust E2E auth tests, and recurring calendar events.
- ✓ **Milestone 5.6 (Stability & Polish)** — Infrastructure bug fixes for media uploads (bypassed ts-rest parser), calendar repair endpoint, and Zulip audit stabilization.
- ✓ **Milestone 5.7 (Platform Maturity)** — Stabilized Zulip audit, finalized repair endpoints, established unit and E2E coverage for major testing gaps, and executed performance optimization (lazy-loading, chunking).
- ✓ **Milestone 5.8 (Feature Expansion)** — Recurring GCal sync, admin cursor pagination, Sentry integration, API latency middleware, and PartyKit collab migration.
- ✓ **Milestone 5.9 (Trello Parity & Zulip Sync)** — Monday.com-style task modals with embedded PartyKit collaborative editing and ZulipThread integration. Fixed critical tasks API 404 and calendar list view bugs.

- ✓ **Milestone 6.1 (Deferred Items & Type Safety)** — Type Safety for Kysely dynamic table names and Cloudflare AI instances. Zulip API authorization hardening with `ensureAuth` middleware.
- ✓ **Milestone 6.2 (Metrics, Testing & UI Polish)** — Delivered deferred E2E testing for media manager, built an admin dashboard for platform usage metrics, and polished nested sub-task rendering UI in Kanbans and tables.
- ✓ **Milestone 6.3 (Outreach Restoration)** — Restored Impact Logging and built FTC Scouting endpoints.
- ✓ **Milestone 6.4 (Science & Math Expansion)** — Introduced Math Corner UI, added universal document visibility fields, and added persistence to AI Scouting Analyses.
- ✓ **Milestone 6.5 (Zulip Sync & Social Media)** — Resolved `aresfirst.org` Google Workspace dot-mismatches and created architectural documentation for the Social Media Manager.

- ✓ **Milestone 6.7 (TypeScript Any Elimination)** — Created shared type infrastructure, migrated all route handlers to contract inference, typed test mocks, and eliminated explicit any violations.
- ✓ **Milestone 6.9 (Type Safety Debt Elimination)** — Achieved 100% compile-time type safety by creating `typedHandler` wrappers, unifying frontend API types, and eliminating all `as any` and `eslint-disable` bypasses.

### Active
- **Milestone v8.2 (Native Photo Albums)** — Build a native album object that holds and displays photos, integrating with the new Google Photos picker, and supporting dynamic masonry and moving gallery layouts.

### Recently Shipped
- **v8.1 Google Workspace Integrations** (May 2026): Integrated Google Drive API for browsing documents and importing images to R2.
- **v8.0 End-to-End Hono RPC Type Safety** (May 2026): Achieved full end-to-end type inference from server handlers through `hc<AppType>()` to frontend calls.
- **v7.3 Full Codebase ESLint Sanitization** (May 2026): Accepted frontend suppressions, addressed backend unused code.
- **v7.2 TypeScript Safety & ESLint Compliance** (May 2026): Achieved complete strict TypeScript type safety across the entire codebase.
- **v7.1 Drizzle ORM Migration** (May 2026): Converted all remaining raw D1 queries to Drizzle ORM and Zod schemas.

### Current Milestone: v8.2 Native Photo Albums (Active)
**Goal:** Build a native album object that holds and displays photos, integrating with the new Google Photos picker, and supporting dynamic masonry and moving gallery layouts.

## Current State

<details>
<summary>v8.1 Shipped Features</summary>

- Native Photo Picker modal leveraging backend-proxied Google Photos API integration.
- Service Account authentication architecture for Google APIs.
- Upload abstraction mapping Google Drive and Photos media into R2 buckets.
- File manager UI improvements.
</details>

<details>
<summary>v7.0 Shipped Features</summary>

- Bundle Size Optimization: Lazy loading Monaco editor and Babel to reduce initial payload by ~5MB.
- Media Optimization: Automated WebP conversion pipeline and responsive image variants.
- Loading Strategy: Route-based chunk splitting and critical resource preloading.
- Caching Improvements: HTTP caching strategies (SWR) and edge caching middleware.
- Monitoring: Web Vitals tracking and bundle size CI/CD gating.
- UX Flattening: Aligned Academy headers and Social Media Manager UI to the ARES-cut design system.
</details>

<details>
<summary>v6.4 Shipped Features</summary>

- Math Corner section built and styled consistently with Science Corner.
- Expanded Document D1 schema and UI to support universal visibility toggles (`display_in_areslib`, `display_in_math_corner`, `display_in_science_corner`).
- Math Corner, Science Corner, and areslib dynamically query documents based on new visibility flags.
- AI Scouting Analysis endpoints updated with D1 persistence to store historical predictions and reduce z.ai requests.
</details>

<details>
<summary>v6.3 Shipped Features</summary>

- Restored full persistence, metrics aggregation, and editing capabilities to the Impact Logging section.
- Established an embedded architecture framework to support custom utility tools directly within ARESWEB.
- Integrated FTC Scouting Tool with server-side API proxies for TOA and FTC Events, and an AI-powered analysis endpoint using Z.ai GLM 5.1.
</details>

<details>
<summary>v6.2 Shipped Features</summary>

- Media manager E2E Playwright coverage
- Admin dashboard for monitoring usage metrics
- Polished sub-task rendering and task details UI
</details>

<details>
<summary>v6.1 Shipped Features</summary>

- Type Safety for Kysely dynamic table names and Cloudflare AI instances
- Zulip API authorization hardening with `ensureAuth` middleware
</details>

<details>
<summary>v6.0 Shipped Features</summary>

- Real-Time Collaboration Infrastructure using PartyKit
- D1 document snapshot persistence and exponential backoff
</details>

<details>
<summary>v5.9 Shipped Features</summary>

- **Task ↔ Zulip:** Auto-create Zulip topics when tasks are created/moved, embedded thread in modal.
- **Collaborative Task Editing:** PartyKit-backed real-time description editing in TaskDetailsModal.
- **Monday.com Parity:** TableView toggle, subtasks (parent_id), time tracking fields.
- **Bug Fixes:** ts-rest trailing slash, calendar month filter, optimistic cache handling.
</details>

<details>
<summary>v5.7 Shipped Features</summary>

- Scaffolded and completed the testing suite for Calendar (/repair) and Media (/multipart) handlers with 100% unit coverage.
- Validated Zulip API audit and invitation endpoints in `zulip.test.ts`.
- Developed Playwright E2E test coverage for the Dashboard’s critical workflows, including Calendar repair and Zulip audit UIs.
- Delivered lazy-loaded routing, React Suspense, and Vite code-splitting chunks to heavily optimize dashboard payload size.
</details>


<details>
<summary>v5.6 Shipped Features</summary>

- Fixed media uploader silent failures by adding `contentType: "multipart/form-data"` to the ts-rest contract
- Bypassed ts-rest-hono's broken multipart parser with a raw Hono POST route for uploads
- Fixed R2 delete/move for keys containing slashes using a wildcard regex route
- Built a "Repair Calendar" admin endpoint to bulk-push missing events to Google Calendar
- Stabilized Zulip audit with bot/inactive filtering and batched invite flow with partial failure resilience
</details>

<details>
<summary>v5.5 Shipped Features</summary>

- Fixed the Simulation Playground menu so it can load existing simulations from the GitHub repository.
- Expanded the Science Corner sandbox with hybrid engine wrappers (Matter.js & Dyn4j).
- Built robust end-to-end (e2e) tests for authentication.
- Implemented recurring calendar events with frequency limiters.
- Unified Kanban Subteams.
- Delivered an automated Zulip User Auditor inside the Admin Dashboard.
</details>

<details>
<summary>v5.4 Shipped Features</summary>

- Migrated the Simulation Sandbox entirely to the GitHub API.
- Replaced auto-fix loop with a dynamic manual prompt system in the simulation IDE.
- Added fullscreen IDE mode for the simulation sandbox.
- Integrated persistent Editor Chat Sidebar and resolved conversational "amnesia" bugs across RAG Chatbot.
- Added Fullscreen Maximize toggle to the Rich Text Editor.
</details>

<details>
<summary>v5.3 Shipped Features</summary>

- Addressed GitHub REST API Forbidden errors in the `fetchGithubRepoFiles` pipeline.
- Synchronized `GITHUB_PAT` environment variables across local `.dev.vars` and Cloudflare configuration to allow authenticated RAG indexing of `ARES-23247` and external dependencies.
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
- Migrate API contract layer from ts-rest to @hono/zod-openapi for native Zod v4 type inference.

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
*Last updated: 2026-05-06 after v6.8 milestone start*
