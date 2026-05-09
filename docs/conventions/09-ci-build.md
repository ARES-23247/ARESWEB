# CI & Build

> Build, test, and deployment workflows. Read when running commands or diagnosing build failures.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run lint` | ESLint + TypeScript |
| `npx tsc --noEmit` | Type check only |
| `npm run build` | Production build |
| `npm run test:e2e` | Playwright E2E |

## CI Gates

1. `tsc --noEmit` — Type check (hard gate)
2. `npm run lint` — ESLint with `--max-warnings 0`
3. `npm run test` — Vitest unit/integration
4. `npm run build` — Vite build
5. Bundle size check (10% threshold)
6. Playwright E2E + accessibility

## Mandatory Rules

- **Always lint before committing**
- **Always verify build succeeds before committing**
- **Never use `@ts-ignore`** — Use `@ts-expect-error -- <reason>` (3+ chars)
- **Always commit before session ends** — dirty trees break CI

## Handler Extraction Pattern

File-level `/* eslint-disable @typescript-eslint/no-explicit-any */` permitted for backend routes. Don't add inline disables in files with file-level header.

## Common Build Errors

- "Calling setState synchronously" — Use module-level constant for initial state
- "Cannot access refs during render" — Access refs only in `useEffect` or handlers
- "@typescript-eslint/no-explicit-any" — Use destructured types for AI responses
- "color-contrast" failures — Use Red Badge Pattern (white text on red bg)

## Performance Baseline (v7.0)

- `index`: 600KB raw / 180KB gzipped
- `vendor`: 1.5MB raw / 400KB gzipped
- 10% threshold for CI failure
