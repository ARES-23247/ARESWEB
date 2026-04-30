---
milestone: v4.9
name: Simulation Playground Evolution
status: active
progress:
  phases_total: 6
  phases_completed: 2
  tasks_total: 0
  tasks_completed: 0
---

# Project State

## Current Position

- **Current Phase:** Phase 59: Real-Time Telemetry & Data Inspector

Phase: Phase 58
Plan: —
Status: Planning phase 58
Last activity: 2026-04-30 — Milestone v4.9 started

## Accumulated Context

### Active Blockers
- None

### Deferred Debt
- TODO: Fix Playwright headless WebGL crashes for RobotViewer component in TechStack.tsx. Currently commented out.
- TODO: Remove CI sourcemap diagnostic step after 5+ consecutive green CI runs.
- TODO: Add `BETTER_AUTH_SECRET` CI secret to suppress auth fallback warnings in E2E logs.
- TODO: Implement inline AI auto-completion (Notion-style ghost text). Feasible with Tiptap but will burn free-tier neurons fast. Best as z.ai premium-only feature.
- TODO: Events and Posts tables lack `updated_at` columns — incremental indexing for those tables does a full scan. Consider adding updated_at triggers.
- TODO: Add unit tests for SimulationPlayground auto-heal and CRUD logic.

### Cross-Phase Decisions
- Using Stripe Checkout to handle PCI compliance and mobile wallet payments.
- Using Cloudflare D1 for inventory management and order fulfillment tracking.
- The 3D robot viewer is deferred until an environment configuration for headless WebGL is established.
- GlobalRAGChatbot MUST be lazy-loaded (`React.lazy()`) — eager import causes TDZ crashes in production builds.
- manualChunks: syntax/highlight packages MUST stay in the `markdown` chunk to prevent circular chunk dependencies (`syntax → markdown → syntax`).
- CI E2E uses `wrangler.ci.toml` swap strategy — `wrangler pages dev` does NOT support `--config` flag.
- All `manualChunks` path matching must normalize separators with `id.replace(/\\\\/g, '/')` for cross-platform consistency.
- AI Architecture: RAG chatbot uses Cloudflare Workers AI (Llama 3.1 8B, free tier). Editor copilot uses z.ai (Claude) with Workers AI fallback. `Z_AI_API_KEY` is set in Cloudflare Pages secrets.
- CopilotMenu is attached to ALL rich text editors (DocsEditor, BlogEditor, EventEditor, SeasonEditor, MassEmailComposer).
- RAG Indexing: Incremental via KV timestamp (`rag_last_indexed` in RATE_LIMITS KV). Only public data indexed (status != 'draft', is_deleted != 1). Auto-triggers via targeted `triggerBackgroundReindex()` calls inside individual route handlers (posts, events, docs, seasons) using `executionCtx.waitUntil()`. Catch-all middleware approach was removed — it caused API hangs by interfering with Hono's response chain.
- **CRITICAL**: Any module under `routes/ai/` that references Workers AI or Vectorize bindings MUST be loaded via dynamic `import()`, never static `import`. Static imports pull the module into every route handler's startup graph, crashing the entire worker if the binding resolution fails during initialization. See `autoReindex.ts` and `ai/index.ts:283` for the correct pattern.
- Vectorize index name: `ares_knowledge_base`. Embedding model: `@cf/baai/bge-base-en-v1.5`. Batch size: 20 vectors per upsert.
- Sim preview iframe uses `srcdoc` with `sandbox="allow-scripts allow-same-origin"`. React/ReactDOM UMD bundles are self-hosted in `public/vendor/` and loaded via absolute URLs (`${window.location.origin}/vendor/...`) because srcdoc iframes resolve relative paths against `about:srcdoc`.
- Sim Playground AI auto-heal: single retry only. On Babel compile error, sends error + broken code back to z.ai, applies fix, re-compiles. No infinite loops.
- RAG chatbot system prompt includes KEY LINKS section with all team action URLs (join, sponsors, outreach, blog, events, etc.) so the bot can direct users appropriately.
