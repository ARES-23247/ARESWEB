---
title: "Phase 69 - Hybrid Storage & KV Fixes"
phase: 69-hybrid-simulation-storage
status: proposed
references:
  - ".planning/phases/69-hybrid-simulation-storage/69-UAT.md"
---

# Fixes for Phase 69 UAT Gaps

I have diagnosed the issues raised during UAT and compiled the following plan to resolve them. 

## Identified Root Causes

**1. "no it does not save" / "no because it does not save them"**
- The frontend `SimulationPlayground.tsx` was sending the code bundle under the key `code` (i.e. `body: JSON.stringify({ ... code: codeToSave })`). 
- However, the backend `/api/simulations` route expects the key to be `files` and checks `if (!files) { return 400; }`. Because `files` was undefined, the server rejected the save silently.

**2. "no I don't see it" / "no" (External Knowledge Sync)**
- The backend routes (`/api/ai/index.ts` and `/api/ai/autoReindex.ts`) were trying to access the Cloudflare KV binding using `env.KV`. 
- In our `wrangler.toml`, the KV namespace is actually bound as `RATE_LIMITS`. Since `env.KV` was undefined, all KV persistence for the AI indexer failed silently, so the Debug Console could never fetch or display any indexing errors.

## Proposed Changes

### `wrangler.toml` & KV Mass Rename
- Rename the KV binding in `wrangler.toml` from `RATE_LIMITS` to `ARES_KV`.
- Perform a project-wide find-and-replace to update all instances of `c.env.RATE_LIMITS` and `env.RATE_LIMITS` to `c.env.ARES_KV` and `env.ARES_KV` respectively (spanning middleware, rate-limiters, event handlers, and tests).
- Update the `AppEnv` interface in `functions/api/middleware/utils.ts` to rename `RATE_LIMITS?: KVNamespace` to `ARES_KV?: KVNamespace`.

### `src/components/SimulationPlayground.tsx`
- Change `code: codeToSave` to `files: files` in the POST body of `handleSave()`.

### `functions/api/routes/ai/index.ts` & `autoReindex.ts`
- Use `c.env.ARES_KV` instead of the broken `(c.env as any).KV` cast so that the Debug Console successfully fetches the index errors.

## User Review Required

The plan has been updated to include the mass rename of `RATE_LIMITS` to `ARES_KV` across the 26 backend references. Once you approve, I will execute these changes!
