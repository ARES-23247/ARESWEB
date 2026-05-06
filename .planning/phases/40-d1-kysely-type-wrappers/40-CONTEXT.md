# Phase 40: D1 Kysely Type Wrappers

**Objective**: 
Replace `@ts-expect-error` and widespread `as any` casts within database query operations, specifically bridging the gap between Kysely's strict schema types and the actual data flow in routes.

**Context**:
The `functions/api/routes/tasks.ts`, `zulipWebhook.ts`, `users.ts`, and `postHistory.ts` files utilize `as any` when making `.where()` and `.offset()` Kysely builder calls, and mapping database rows. This bypasses the schema safety that Kysely provides. 

This phase will eliminate these bypasses by refining the DB types or correctly formatting data before insertion/querying.
