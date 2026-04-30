# Roadmap

## Milestones

- ✅ **v4.7 Gap Closure (v4.6 Tech Debt)** — Phases 51-55 (shipped 2026-04-30)
- ✅ **v4.6 RAG Knowledge Base Pipeline** — Phases 49-50 (shipped 2026-04-30)
- ✅ **v4.5 AI Workers Migration & Copilot Expansion** — Phases 47-48 (shipped 2026-04-30)
- ✅ **v4.4 AI Copilot & CI Stabilization** — Phases 45-46 (shipped 2026-04-30)
- ✅ **v4.3 Inquiries, Notifications & Docs Restoration** — Phases 41-44 (shipped 2026-04-30)
- ✅ **v4.2 Sponsor Fixes & Docs Quality** — Phases 38-40 (shipped 2026-04-30)
## Phases

### ⏳ v4.9 Simulation Playground Evolution (Phases 57-62) — ACTIVE

- [x] **Phase 57: Hardware & Physics IntelliSense** (SIM-03) — Inject React, Three.js, and ARESLib physics `.d.ts` types into the Monaco Editor instances to enable real-time autocomplete, parameter hints, and JSDoc explanations for hardware kinematics.
- [x] **Phase 58: Multi-File Sandbox & Templates** (SIM-04) — Implement a CodeSandbox-style multi-file tree layout allowing users to separate components (e.g., `PIDController.js`, `Constants.js`). Add starting templates (Swerve Drive, Elevator, etc.).
- [ ] **Phase 59: Real-Time Telemetry & Data Inspector** (SIM-05) — Add a telemetry panel to the simulation pane capable of graphing real-time variables (velocity, PID error, outputs) using a custom `useTelemetry` hook.
- [ ] **Phase 60: Visual AI Feedback Loop** (SIM-06) — Hook up `html2canvas` (or similar) to capture iframe screenshots and pass visual context to the z.ai model, enabling V0-style iterative UI and visual physics adjustments.
- [ ] **Phase 61: Built-in Physics Engine Abstractions** (SIM-07) — Pre-load the sandbox environment with `@react-three/fiber` and `@react-three/drei`. Expose global helper components (`<SwerveModule />`, `<PhysicsWorld />`) to eliminate boilerplate.
- [ ] **Phase 62: Cloud Save & Collaborative Sharing** (SIM-08) — Connect the playground to Cloudflare D1 to save simulations and generate unique shareable links for collaboration and mentoring.

<details>
<summary>✅ v4.8 Simulation Playground UI Fixes (Phase 56) — SHIPPED 2026-04-30</summary>

- [x] **Phase 56: Monaco Rendering Fix** (SIM-01, SIM-02) — Diagnose and resolve the Monaco editor rendering failure. Ensure all dependencies and web workers load correctly by whitelisting `cdn.jsdelivr.net` and `blob:` workers in CSP.

</details>

<details>
<summary>✅ v4.7 Gap Closure (v4.6 Tech Debt) (Phases 51-55) — SHIPPED 2026-04-30</summary>

- [x] **Phase 51: RAG Indexer Test Coverage** (TD-01, TD-02) — Add vitest unit tests for `indexer.ts` and `autoReindex.ts`, plus E2E test for admin `POST /api/ai/reindex` endpoint. Closes test coverage gaps from v4.6 audit.
- [x] **Phase 52: Index Pipeline Hardening** (TD-03, TD-04, TD-05) — Add `updated_at` columns to `events` and `posts` tables via D1 migration for true incremental scans. Add rate limiting to `/api/ai/reindex`. Validate cron handler executes in production.
- [x] **Phase 53: AI Inline Suggestions** — Wire up the existing GhostTextExtension with a debounced AI completion trigger. On typing pause, send editor context to z.ai/Workers AI, render ghost text at cursor, accept with Tab. Fixed CopilotMenu SSE chunk spacing bug.
- [x] **Phase 54: Simulation Playground** — Build a split-pane React simulation editor: Monaco code editor on the left, sandboxed live preview on the right. z.AI assists with code generation/modification. Includes CRUD save/load, Babel transpilation, and dashboard routing.
- [x] **Phase 55: AI & Sim Hardening** — Grounded RAG chatbot with temporal context (date awareness, upcoming events, current season, recent blog posts in system prompt). Fixed sim preview sandbox by self-hosting React UMD bundles in `public/vendor/` with absolute URLs. Added auto-heal for AI-generated code (detects Babel compile errors, sends back to z.ai for fix, retries once). Injected key action links (join, sponsor, outreach, blog, etc.) into chatbot system prompt. Excluded vendor JS from ESLint. Fixed SSE `undefined` artifact in chat responses.

</details>

<details>
<summary>✅ v4.6 RAG Knowledge Base Pipeline (Phases 49-50) — SHIPPED 2026-04-30</summary>

- [x] **Phase 49: Vectorize Indexing Pipeline** (AI-04) — Built incremental site content indexer that crawls public events, posts, docs, and seasons from D1, generates BGE embeddings via Workers AI, and upserts into Cloudflare Vectorize. Uses KV timestamp tracking to only re-embed changed documents (~50 neurons/edit vs 7K full). Auto-triggers via targeted `triggerBackgroundReindex()` handler hooks (not middleware — catch-all middleware caused API hangs).
- [x] **Phase 50: Admin Reindex Controls** (AI-05) — Added admin-only POST /api/ai/reindex endpoint with ensureAdmin middleware. Command Center Quick Actions panel has "Sync AI Knowledge" (incremental) and "FULL" (full rebuild) buttons with loading states and toast feedback.

</details>

<details>
<summary>✅ v4.5 AI Workers Migration & Copilot Expansion (Phases 47-48) — SHIPPED 2026-04-30</summary>

- [x] **Phase 47: Workers AI Migration** (AI-02) — Migrated RAG chatbot from external z.ai API to Cloudflare Workers AI (Llama 3.1 8B, free tier 10K neurons/day). Added z.ai as premium copilot for the document editor with Workers AI fallback. Chatbot stays on free Cloudflare AI.
- [x] **Phase 48: Copilot Expansion** (AI-03) — Expanded CopilotMenu (summarize/expand bubble menu) to all rich text editors: BlogEditor, EventEditor (description + private notes), SeasonEditor, and MassEmailComposer. Previously only DocsEditor had AI support.

</details>

<details>
<summary>✅ v4.4 AI Copilot & CI Stabilization (Phases 45-46) — SHIPPED 2026-04-30</summary>

- [x] **Phase 45: AI Copilot & RAG Chatbot Integration** (AI-01) — Integrated z.ai-powered RAG chatbot, copilot endpoint, PII scrubbing, D1 session persistence, and Turnstile-gated streaming.
- [x] **Phase 46: CI/CD E2E Pipeline Stabilization** (CI-01) — Fixed admin dashboard nested frame layout, resolved Cloudflare API token CI errors via wrangler.ci.toml config swap, fixed circular chunk dependency (syntax→markdown→syntax) causing TDZ crash, lazy-loaded GlobalRAGChatbot, normalized cross-platform build paths.

</details>

<details>
<summary>✅ v4.3 Inquiries, Notifications & Docs Restoration (Phases 41-44) — SHIPPED 2026-04-30</summary>

- [x] **Phase 41: Notification State Fix** (NOTIF-01) — Resolve the persistent notification state issue in the UI and notification bar.
- [x] **Phase 42: Documentation Data Restoration** (DOCS-01) — Restore missing entries to the documentation database.
- [x] **Phase 43: Inquiry Zulip Integration** (INQ-01, INQ-02) — Automate Zulip thread creation and link inquiries to Zulip discussions.
- [x] **Phase 44: Inquiry Notes System** (INQ-03) — Add internal notes functionality to inquiries for team collaboration.

</details>

<details>
<summary>✅ v4.2 Sponsor Fixes & Docs Quality (Phases 38-40) — SHIPPED 2026-04-30</summary>

- [x] Phase 38: Sponsor Logo Upload Fix — completed 2026-04-30
- [x] Phase 39: Documentation Refactor — completed 2026-04-30
- [x] Phase 40: Extended Documentation — completed 2026-04-30

</details>

<details>
<summary>✅ v4.1 System Evolution (Phase 37) — SHIPPED 2026-04-30</summary>

- [x] Phase 37: Tech Stack UI Polish — completed 2026-04-30

</details>

<details>
<summary>✅ v4.0 System Hardening (Phases 34-36) — SHIPPED 2026-04-29</summary>

- [x] Phase 34: Robust Webhook & Background Task Architecture
- [x] Phase 35: Storefront Stock Management & Alerts
- [x] Phase 36: Gamification Points System

</details>

<details>
<summary>✅ v3.9 Stripe Storefront (Phases 31-33) — SHIPPED 2026-04-29</summary>

- [x] Phase 31: Native Stripe eCommerce Storefront
- [x] Phase 32: Shopping Cart State & D1 Product Schemas
- [x] Phase 33: ARES Admin Fulfillment Dashboard

</details>

<details>
<summary>✅ v3.8 Database Audit & Bug Fixes (Phases 28-30) — SHIPPED 2026-04-29</summary>

- [x] Phase 28: Kysely Schema Migration Fixes
- [x] Phase 29: KV Rate Limiting Infrastructure
- [x] Phase 30: 30-Day Soft-Delete Garbage Collection

</details>

<details>
<summary>✅ v3.7 UI Polish & CSS Linting (Phases 25-27) — SHIPPED 2026-04-29</summary>

- [x] Phase 25: Component CSS Utility Conflict Resolution
- [x] Phase 26: Tailwind/PostCSS Directive Warnings Fix
- [x] Phase 27: Strict TypeScript Typings for Tiptap/Yjs

</details>

<details>
<summary>✅ v3.6 Collaboration Polish (Phases 22-24) — SHIPPED 2026-04-29</summary>

- [x] Phase 22: Version History Z-index Fixes
- [x] Phase 23: Snapshot Rate Limiting & Expiration Cron
- [x] Phase 24: MemberCard WCAG Compliance

</details>

<details>
<summary>✅ v3.5 Version Control & Attribution (Phases 19-21) — SHIPPED 2026-04-29</summary>

- [x] Phase 19: Version History Document Viewer
- [x] Phase 20: Draft Rollback Implementation
- [x] Phase 21: Student Avatar Roster Stack

</details>

<details>
<summary>✅ v3.4 Collaborative Editing (Phases 16-18) — SHIPPED 2026-04-29</summary>

- [x] Phase 16: Liveblocks Backend Authentication
- [x] Phase 17: Tiptap Yjs Multiplayer Extension
- [x] Phase 18: Live Cursors and Draft Webhooks

</details>

<details>
<summary>✅ v3.3 Calendar UX Refinement (Phases 14-15) — SHIPPED 2026-04-28</summary>

- [x] Phase 14: Calendar Grid Stability Fixes
- [x] Phase 15: Event Hover Z-axis Optimization

</details>

<details>
<summary>✅ v3.2 Operations & UX (Phases 11-13) — SHIPPED 2026-04-28</summary>

- [x] Phase 11: iCal/WebCal Subscriptions
- [x] Phase 12: Sponsorship Idempotency Fixes
- [x] Phase 13: Retroactive Validation & Verification Generation

</details>

<details>
<summary>✅ v3.1 Calendar Integration Ecosystem (Phases 08-10) — SHIPPED 2026-04-28</summary>

- [x] Phase 08: React Calendar Component Migration
- [x] Phase 09: D1 Calendar Events Backend
- [x] Phase 10: Event Coverage & Background Syncing

</details>

<details>
<summary>✅ v3.0 Finance Dashboard Restoration (Phases 06-07) — SHIPPED 2026-04-28</summary>

- [x] Phase 06: Finance Schema Migrations & Typings
- [x] Phase 07: Kanban Workflow Integration with Zulip

</details>

<details>
<summary>✅ v1.1 Tech Debt Cleanup (Phases 01-05) — SHIPPED 2026-04-28</summary>

- [x] Phase 01: Architectural Fragility Cleanup
- [x] Phase 02: `waitUntil` Test Flakiness Resolution
- [x] Phase 03: Kysely Database Mocks Standardization
- [x] Phase 04: Media Upload Validation Hardening
- [x] Phase 05: Pipeline CI/CD Stabilization

</details>
