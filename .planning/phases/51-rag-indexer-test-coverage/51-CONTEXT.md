---
phase: 51
name: RAG Indexer Test Coverage
date: 2026-04-30
---

# Phase 51 Context: RAG Indexer Test Coverage

<domain>
Add vitest unit tests for the RAG indexing pipeline (indexer.ts, autoReindex.ts) and an integration test for the admin reindex endpoint.
</domain>

<decisions>
### Test Framework
- Use vitest (already the project standard — all existing tests use it)
- Mock Kysely DB, Workers AI, Vectorize, and KV bindings

### Test Scope
- **TD-01**: `indexer.ts` — test `indexSiteContent()` for incremental mode, full mode, empty DB, error handling
- **TD-01**: `autoReindex.ts` — test `triggerBackgroundReindex()` dynamic import, no-op when bindings missing, waitUntil call
- **TD-02**: Admin endpoint `POST /api/ai/reindex` — test auth guard, incremental vs force mode, error responses

### Test Patterns
- Follow existing test patterns from `posts.test.ts`, `events.test.ts`, `seasons.test.ts`
- Mock `executionCtx.waitUntil` as a jest.fn()
- Mock dynamic `import("./indexer")` resolution

### What NOT to test
- Actual Workers AI embedding generation (external service)
- Actual Vectorize upsert (external service)
- Frontend CommandQuickActions UI (separate E2E concern)
</decisions>

<canonical_refs>
- functions/api/routes/ai/indexer.ts — primary test target
- functions/api/routes/ai/autoReindex.ts — secondary test target
- functions/api/routes/ai/index.ts — reindex endpoint (line 276-292)
- functions/api/routes/posts.test.ts — test pattern reference
- .planning/v4.6-MILESTONE-AUDIT.md — gap source
- .planning/REQUIREMENTS.md — TD-01, TD-02 requirements
</canonical_refs>

<code_context>
### Existing Test Patterns
- All route tests live alongside their source: `routes/posts.test.ts`, `routes/seasons.test.ts`
- Kysely mocking uses `vi.fn()` chains: `selectFrom → select → where → execute`
- Auth middleware mocked via `vi.mock("../middleware")`
- executionCtx mocked as `{ waitUntil: vi.fn() }`

### Key Implementation Details
- `autoReindex.ts` uses dynamic `import("./indexer")` — must mock module resolution
- `indexSiteContent` returns `{ indexed: number, errors: string[] }`
- Incremental mode reads KV timestamp, full mode ignores it
- Public-only filter: `status != 'draft'`, `is_deleted != 1`
</code_context>
