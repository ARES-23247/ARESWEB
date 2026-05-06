# Phase 39: Frontend API Type Unification

## Goal
Re-export `z.infer<>` types from `shared/routes/` into frontend hooks and components to eliminate `any` casts for API response data.

## Proposed Changes

### 1. Remove `eslint-disable @typescript-eslint/no-explicit-any` from target files
We will go through the following files, removing the `no-explicit-any` ESLint overrides and replacing `any` typing with precise generic inference from the `shared/routes/` or local API client responses.

#### `src/pages/JudgesHub.tsx`
- Remove inline `/* eslint-disable-next-line @typescript-eslint/no-explicit-any */`
- Type the data mapping using proper type definitions

#### `src/pages/Events.tsx`
- Remove inline disables and fix typing.

#### `src/pages/About.tsx`
- Remove inline disables and fix typing.

#### `src/pages/Leaderboard.tsx`
- Remove file-level disable and fix type casting.

#### `src/pages/Academy.tsx`
- Remove file-level disable and fix type casting.

#### `src/pages/PrintPortfolio.tsx`
- Remove file-level disable and fix type casting.

#### `src/components/MemberImpactOverview.tsx`
- Ensure data is strictly typed.

#### `src/components/ProfileEditor.tsx`
- Remove disable and fix user profile type bindings.

#### `src/components/command/TaskDetailPage.tsx` / `ProjectBoardKanban.tsx`
- Remove file-level disables and fix dynamic external data typing.

#### `src/components/ContentManager/RevisionManager.tsx`
- Remove disable and properly type revision lists.

#### `src/hooks/useDashboardSession.ts`
- Fix type extraction for API response payloads.

#### `src/components/SEO.tsx`
- Enforce strict typing.

#### `src/components/TiptapRenderer.tsx`
- Type the renderer correctly without relying on `any`.

## Verification Plan
1. Check `npm run lint` for any warnings or remaining `no-explicit-any`.
2. Check `npx tsc --noEmit` to ensure types align perfectly.
3. Run `npm run test` to guarantee test stability.
