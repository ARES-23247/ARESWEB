---
phase: 49
name: Vectorize Indexing Pipeline
status: completed
requirements_completed: [AI-04]
files_changed:
  - functions/api/routes/ai/indexer.ts
  - functions/api/routes/ai/autoReindex.ts
  - functions/api/routes/ai/index.ts
  - functions/api/routes/posts.ts
  - functions/api/routes/events/handlers.ts
  - functions/api/routes/docs.ts
  - functions/api/routes/seasons.ts
  - functions/api/[[route]].ts
---

# Phase 49 Summary: Vectorize Indexing Pipeline

## What Was Built
- Incremental RAG knowledge base indexer (`indexer.ts`) that crawls public events, posts, docs, and seasons from D1.
- Generates BGE embeddings via `@cf/baai/bge-base-en-v1.5` Workers AI model.
- Upserts vectors into Cloudflare Vectorize (`ares_knowledge_base` index).
- KV-based timestamp tracking (`rag_last_indexed` in RATE_LIMITS KV) for incremental-only updates.
- `autoReindex.ts` helper for targeted handler-hook triggering (non-blocking via `waitUntil`).
- Wired into 4 route handlers: posts, events, docs, seasons.

## Key Decisions
- **Incremental over full**: Only re-embeds documents changed since last index (~50 neurons/edit vs ~7K full).
- **Handler hooks, not middleware**: Catch-all middleware caused API hangs by interfering with Hono's response chain. Replaced with explicit `triggerBackgroundReindex()` calls.
- **Dynamic import()**: `autoReindex.ts` must use `import("./indexer")` (dynamic), not static import. Static import pulled AI modules into every route handler's startup graph, crashing the worker.
- **Public data only**: Only indexes `status='published'` and `is_deleted=0` records.

## Cost Profile
- ~50 neurons per incremental run (changed docs only)
- ~7,000 neurons for full rebuild
- Safe for free tier: 10K neurons/day handles ~200 edits/day

## Hotfixes Applied
1. Removed catch-all middleware that blocked all API requests
2. Switched from static to dynamic import to prevent worker startup crash
