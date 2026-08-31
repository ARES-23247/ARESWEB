# CI & Build

> Build, test, and deployment workflows. Read when running commands or diagnosing build failures.

The repository is a pnpm workspace (root app + `functions/`). Always use
`pnpm`; the npm/npx commands below are exact script names run through pnpm
(see `package.json` scripts and `.github/workflows/ci.yml` for the wired
pipeline).

## Commands

| Command | Purpose |
|---|---|
| `pnpm install --frozen-lockfile` | Install exact workspace dependencies |
| `pnpm run dev` | Vite dev server |
| `pnpm run lint` | ESLint (`--max-warnings 0`) |
| `pnpm --filter functions lint` | ESLint for Cloud Functions |
| `pnpm run typecheck` | Type check only through the cross-platform project script |
| `pnpm run validate:agents` | Workspace/agent configuration checks |
| `pnpm run test:coverage` | Frontend Vitest with coverage ratchets |
| `pnpm --filter functions build` | Functions TypeScript build |
| `pnpm --filter functions test:coverage` | Functions Vitest with thresholds |
| `pnpm run test:rules` | Firestore/Storage rules via Firebase emulators (needs Java 21+) |
| `pnpm run build` | Production build + prerendered route shells |
| `node scripts/check-bundle-size.mjs` | Enforce `config/bundle-budgets.json` |
| `pnpm run test:e2e` | Playwright E2E (5 browser engines incl. mobile WebKit) |
| `pnpm audit --prod --audit-level=high` | Production dependency audit |

## Local ARES source-drift audit

Before refreshing Academy content from a local ARES Robotics checkout, run:

```powershell
pnpm run content:audit-source-worktree -- --repo C:\path\to\ARES-Robotics
```

This manual audit compares every pinned Academy source path with the catalog's
immutable authority commit. It distinguishes an aligned checkout from a newer
checkout with relevant changes, an older checkout, a divergent branch, missing
sources, and uncommitted edits to referenced files. Do not refresh lesson
authority from `checkout-behind`, `blocked-dirty`, `blocked-divergent`, or
`blocked-missing` results. This check is intentionally not a CI gate because CI
does not contain the separate ARES Robotics worktree.

## CI Gates

The required test gate aggregates all of these on every PR. Branch protection
requires that gate and CodeQL before `master` can advance. After merge, the
release job refuses commits that are not associated with exactly one merged PR
into `master`, rebuilds the frontend and Functions from the merged tree, checks
the release bundle budgets, and deploys that immutable artifact. It does not
repeat the PR's lint, coverage, rules-emulator, or E2E suites (see
`docs/SECURITY_OPERATIONS.md` for the deploy contract):

1. `pnpm install --frozen-lockfile` and `pnpm run validate:agents`
2. `pnpm run lint` and `pnpm --filter functions lint`
3. `pnpm run typecheck`
4. `pnpm run test:coverage` (frontend; ratchets include a mechanical
   new-file inventory check)
5. `pnpm --filter functions build` and `pnpm --filter functions test:coverage`
6. `pnpm run test:rules` (emulator-backed)
7. `pnpm run build` then `node scripts/check-bundle-size.mjs` (absolute
   budgets, not percentages — see below)
8. `pnpm run test:e2e`
9. CodeQL analysis (GitHub default setup)
10. `pnpm audit --prod --audit-level=high`

## Mandatory Rules

- **Always lint before committing**
- **Always verify build succeeds before committing**
- **Never use `@ts-ignore`** — Use `@ts-expect-error -- <reason>` (3+ chars)
- **Always commit before session ends** — dirty trees break CI
- **Register new backend files in the coverage thresholds** — the ratchet
  test fails otherwise (85% lines / 100% functions)

## Handler Extraction Pattern

File-level `/* eslint-disable @typescript-eslint/no-explicit-any */` permitted for backend routes. Don't add inline disables in files with file-level header.

## Common Build Errors

- "Calling setState synchronously" — Use module-level constant for initial state
- "Cannot access refs during render" — Access refs only in `useEffect` or handlers
- "@typescript-eslint/no-explicit-any" — Use destructured types for AI responses
- "color-contrast" failures — Use Red Badge Pattern (white text on red bg)

## Bundle Budgets

Absolute byte budgets live in `config/bundle-budgets.json` and are enforced
by `scripts/check-bundle-size.mjs` (raw and gzip per budget; there is no
percentage threshold). Current headline budgets include `initialCss`,
`initialJs`, `largestLazyJs`, `totalRouteJs`, `academyInteractiveJs`,
`largestAcademyInteractiveJs`, `editorRuntimeJs`, and `largestEditorJs` —
raise them consciously in review, never to make a check pass. Academy
interactives remain one lazy chunk per activity, then receive separate
aggregate and largest-activity budgets. This preserves small per-lesson
downloads without letting curriculum growth disappear from the bundle gate.
