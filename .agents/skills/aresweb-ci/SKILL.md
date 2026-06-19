---
name: aresweb-ci
description: Helps understand build automations, Vite testing, ESLint linting, and deployment workflows for the ARES Web Portal. Use when modifying code, running tests, or diagnosing build failures.
---

# ARESWEB Continuous Integration Skill

You are the DevOps lead for Team ARES 23247. When working with builds, formatting, or deployment:

## 1. Architecture

ARESWEB uses Node/npm scripts for compiling, linting, and deploying via Firebase Hosting and Functions:

| Tool | Purpose |
|---|---|
| `npm run dev` | Runs the Vite local development server |
| `npm run lint` | Runs ESLint and TypeScript checks across `src/` and `functions/` |
| `npx tsc --noEmit` | Runs the TypeScript compiler in type-check-only mode |
| `npm run build` | Compiles the React SPA via Vite into `dist/` |
| `npm run test` | Runs Vitest unit/integration tests |
| `firebase emulators:start` | Starts local Firebase Emulators (Firestore, Auth, Storage, Functions, Hosting) |

### CI Pipeline
GitHub Actions and Firebase hosting deployments enforce these gates in order:
1. `npx tsc --noEmit` — TypeScript type check (hard gate)
2. `npm run lint` — ESLint with `--max-warnings 0` (hard gate)
3. `npm run test` — Vitest unit/integration tests
4. `npm run build` — Vite production build
5. Playwright E2E tests

If any gate fails, the PR cannot be merged or deployed.

---

## 2. Mandatory Rules

### Rule A: Always Run Linters Before Committing
Every code change **MUST** pass `npm run lint` before committing. Unused variables, hook dependency array warnings, and orphaned accessibility labels are non-negotiable.

### Rule B: Verify the Vite & Functions Build
Always run `npm run build` at the root and `npm run build` in `functions/` to verify the module chunking and compilation succeeds before committing.

### Rule C: Self-Healing Builds
If a build or lint fails in the terminal, you must autonomously read the terminal output, identify the specific error causing the failure, modify the source code to resolve it, and re-run the build until SUCCESS. Do not halt to ask the user for permission to fix a syntax error.

### Rule D: Never Use `@ts-ignore` — Use `@ts-expect-error` with Descriptions
Always use the form:
```ts
// @ts-expect-error -- Firestore untyped response
const data = doc.data();
```
The description after `--` must be **3+ characters** explaining why the suppression is necessary.

### Rule E: Always Commit Before Ending a Session
If you modify files, you **MUST** run `npm run lint` and `npm run build`, then `git add -A && git commit` before your session ends. Never leave dirty working trees.
