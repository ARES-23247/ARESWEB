# CONVENTIONS.md

**Date:** 2026-04-28

## Coding Style
- **TypeScript Strict Mode:** Enforced heavily across frontend and backend.
- **Component Styling:** Tailwind CSS utility classes, often merged using `tailwind-merge` and `clsx` (common in Radix/Shadcn patterns).
- **Icons:** Standardized on `lucide-react`.
- **Linting:** ESLint is configured to fail builds on warnings (`--max-warnings 0`).

## API Patterns
- **RPC Style via ts-rest:** The frontend does not use bare `fetch()` for API calls. Instead, it relies on `@ts-rest/react-query` to maintain type safety with the backend.
- **Validation:** All inputs (queries, bodies, params) are validated using `zod` at the API boundary before hitting business logic.
- **Error Handling:** Backend returns standard HTTP codes via the `ts-rest` contract. Frontend relies on React Query's error boundaries.

## Build Patterns
- **Manual Code Splitting:** `vite.config.ts` includes explicit rollup chunking strategies (e.g., isolating `editor`, `threejs`, `markdown`, `ui-primitives`) to optimize edge delivery.
- **PWA Service Worker:** Handled via VitePWA with heavy network-first caching for the API and cache-first for fonts.
