---
name: aresweb-ci
description: Helps understand build automations, Vite testing, ESLint linting, and deployment workflows for the ARES Web Portal. Use when modifying code, running tests, or diagnosing Cloudflare Edge build failures.
---

# ARESWEB Continuous Integration Skill

You are the DevOps lead for Team ARES 23247. When working with builds, formatting, or deployment:

## 1. Architecture

ARESWEB uses Node/npm scripts for compiling, linting, and deploying via Cloudflare Pages:

| Tool | Purpose |
|---|---|
| `npm run dev` | Runs the Vite local development server |
| `npm run lint` | Runs ESLint and TypeScript checks across `src/` and `functions/` |
| `npx tsc --noEmit` | Runs the TypeScript compiler in type-check-only mode (mandatory CI gate) |
| `npm run build` | Compiles the React SPA via Vite and prepares the Cloudflare worker (`functions/api/`) |
| `npm run test:e2e` | Runs Playwright E2E smoke tests including Axe-core accessibility scans |

### CI Pipeline
Cloudflare Pages runs an automatic build on every push to `master`. The GitHub Actions CI pipeline enforces these gates in order:
1. `npx tsc --noEmit` — TypeScript type check (hard gate)
2. `npm run lint` — ESLint with `--max-warnings 0` (hard gate)
3. `npm run test` — Vitest unit/integration tests
4. `npm run build` — Vite production build
5. Playwright E2E + pa11y accessibility tests

If any gate fails, the PR cannot be merged.

## 2. Mandatory Rules

### Rule A: Always Run Linters Before Committing
Every code change **MUST** pass `npm run lint` before committing. Unused variables, hook dependency array warnings, and orphaned accessibility labels are non-negotiable. **File-level `/* eslint-disable @typescript-eslint/no-explicit-any */` headers are permitted** in backend route handlers and utility files where the handler extraction pattern requires `any` typing. Do not add inline `// eslint-disable-next-line` comments inside files that already have the file-level header — they will trigger "unused eslint-disable directive" errors.

### Rule B: Verify the Vite Build
Always run `npm run build` to verify the module chunking and frontend compilation succeeds before committing. 

### Rule C: Self-Healing Builds
If a build or lint fails in the terminal, you must autonomously read the terminal output, identify the specific TypeScript/React error causing the failure, modify the source code to resolve it, and re-run the build until SUCCESS. Do not halt to ask the user for permission to fix a syntax error.

### Rule D: Never Use `@ts-ignore` — Use `@ts-expect-error` with Descriptions
The ESLint config enforces `@typescript-eslint/ban-ts-comment`. Using `// @ts-ignore` will fail the lint check. Always use the form:

```ts
// @ts-expect-error -- D1 untyped response
const data = json.results;
```

The description after `--` must be **3+ characters** explaining why the suppression is necessary. Never place `@ts-expect-error` inside JSX children (it becomes literal text) — place it on the line *before* the offending expression.

### Rule E: Always Commit Before Ending a Session
If you modify files, you **MUST** run `npm run lint` and `npm run build`, then `git add -A && git commit && git push` before your session ends. Uncommitted local changes that break lint will block the Cloudflare CI pipeline for the next session, causing cascading failures. Never leave dirty working trees.

### Rule F: Accessibility (Axe) is a Blocker
Playwright smoke tests now include `AxeBuilder`. If a test fails with `accessibilityScanResults.violations`, you must inspect the failing route, identify the WCAG violation (e.g., contrast, missing alt, nested buttons), and fix it. Never suppress Axe violations in code.

### Rule G: Handler Extraction Pattern (Backend Routes)
const router = s.router(myContract, myHandlers);
createHonoEndpoints(myContract, router, myHonoRouter);
```

3. For Kysely SQL builder expressions that fail type inference (e.g., `sql` template literals, `ReferenceExpression`, `.set()` values), apply targeted `as any` casts:
```ts
.where("created_at", "<", sql`datetime('now', '-90 days')` as any)
.values({ id: crypto.randomUUID() } as any)
.select(["code", "label"] as any)
```

**Never** inline handler logic directly in `s.router()` calls — this triggers `TS2589: Type instantiation is excessively deep` errors.

## 3. Resolving Common Build Errors
- **"Calling setState synchronously within an effect"**: Do not call functions that execute `setState` immediately during render or inside the body of a `useEffect` loop without an explicit trigger. If the initial state depends on a runtime condition (e.g., `window.location.hostname === "localhost"`), compute it as a **module-level constant** and pass it directly to `useState()` as the initial value. Never wrap the workaround in `setTimeout()` — that suppresses the lint warning but introduces a flash of loading state on every localhost render. For modal cleanup, use conditional rendering (`{isOpen && <Modal />}`) so React unmounts the component and resets state naturally — never use `useEffect` to reset state on prop changes.
- **"Cannot access refs during render" (react-hooks/refs)**: Never read or write `ref.current` in the component body. Access refs only inside `useEffect`, event handlers, or callbacks. The `useRef` + render-time check pattern that works in React 18 is banned under the React 19 strict lint rules.
- **"@typescript-eslint/no-unused-vars"**: Remove unused variables immediately. Do not leave dead state variables (e.g., `authEmail`) from refactors. If a variable was used for debugging, delete it before committing.
- **"@typescript-eslint/no-explicit-any"**: Do not cast JSON or AI responses to `any`. Construct deterministic inline destructured types like `(aiResponse as { response?: string })` when validating Cloudflare `env.AI` objects.
- **"@typescript-eslint/ban-ts-comment"**: Never use `@ts-ignore`. Use `@ts-expect-error -- description` (3+ char description required). See Rule E.
- **"JSX element 'label' has no corresponding control"**: Replace `for=` with `htmlFor=`, and verify the `id=` attribute matches the `<input>` element immediately adjacent. 
- **"Cannot call impure function Date.now() during render"**: Move pure-computation randomizers or time checks into a React `useEffect` hook, or evaluate them server-side before hydration.
- **"'ComponentName' is not defined" (react/jsx-no-undef)**: Verify the component is properly imported. If lucide-react icons report as undefined, check the installed version (`npm ls lucide-react`) — some icons were added in later versions. Always use named imports from `lucide-react`.
- **Playwright "Timeout" or "Target Closed"**: This usually means the local `wrangler` dev server or Vite preview hasn't started yet. Ensure `start-server-and-test` is working correctly. If debugging a failing E2E test, use `npx playwright test --debug` and look for the specific DOM selector that isn't appearing.
- **Axe "color-contrast" Failures**: These are now enforced. If a brand color (#C00000) fails on a dark background, use the "Red Badge Pattern" (white text on red background) as defined in the accessibility skill.

