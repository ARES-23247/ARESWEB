# Phase 66: Frontend Sanitization

## Goal
Resolve 291 ESLint problems in the `src/` directory, focusing on removing `any` types and unused variables in API wrappers, hooks, and components.

## Tasks
- [ ] **Task 1: Sanitize API Wrappers (`src/api/*.ts`)**
  - Refactor `onSuccess` handlers to use proper types instead of `any`.
  - Fix any residual `any` in request/response mapping.
  - Files: `events.ts`, `docs.ts`, `posts.ts`, `badges.ts`, `finance.ts`, `seasons.ts`, `socialQueue.ts`, `tasks.ts`, `media.ts`, `sponsors.ts`, `users.ts`.
- [ ] **Task 2: Sanitize Hooks and Tests (`src/hooks/`)**
  - Fix high `any` count in `useAcademy.test.ts` and `useDocs.test.ts`.
  - Refactor mock data to use explicit types or `Satisfies`.
- [ ] **Task 3: Sanitize Components and Pages**
  - Address remaining problems in `src/components/` and `src/pages/`.
  - Fix `react/require-render-return` errors.

## Verification
- Run `npx eslint src` to ensure zero errors in frontend.
- Run `npx tsc --noEmit` to ensure no regression in type safety.
