# Phase 40: D1 Kysely Type Wrappers Plan

## 1. Eliminate `@ts-expect-error` in `postHistory.ts`
- Fix type definitions for `captureHistory` and `approveAndMergeRevision` to accept `string | null` instead of strictly `string` for properties like `thumbnail`, `snippet`, `ast`, and `cf_email`.

## 2. Refactor `tasks.ts`
- Remove `as any` casting for query fields: `status`, `subteam`, `assigned_to`. Use type assertions against the Kysely `Tasks` interface if needed, or adjust the query object type.
- Remove `as any` from `offset()`.

## 3. Refactor `users.ts` and `zulipWebhook.ts`
- Target `as any` bypasses in `.where()` and `.executeTakeFirst()` assignments. Ensure returned types match Zod schemas.

## 4. Compile and Validate
- Verify with `npx tsc --noEmit` and `npm run lint`.
