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
| `npm run build` | Compiles the React SPA via Vite and prepares the Cloudflare worker (`functions/api/`) |

### CI Pipeline
Cloudflare Pages runs an automatic build on every push to `master`. If the build or linting fails, the deployment is rejected, breaking the production dashboard.

## 2. Mandatory Rules

### Rule A: Always Run Linters Before Committing
Every code change **MUST** pass `npm run lint` before committing. Unused variables, hook dependency array warnings, and orphaned accessibility labels are non-negotiable. **Never use `eslint-disable`** to bypass rules; fix the architectural root cause.

### Rule B: Verify the Vite Build
Always run `npm run build` to verify the module chunking and frontend compilation succeeds before committing. 

### Rule C: Self-Healing Builds
If a build or lint fails in the terminal, you must autonomously read the terminal output, identify the specific TypeScript/React error causing the failure, modify the source code to resolve it, and re-run the build until SUCCESS. Do not halt to ask the user for permission to fix a syntax error.

## 3. Resolving Common Build Errors
- **"Calling setState synchronously within an effect"**: Do not call functions that execute `setState` immediately during render or inside the body of a `useEffect` loop without an explicit trigger.
- **"JSX element 'label' has no corresponding control"**: Replace `for=` with `htmlFor=`, and verify the `id=` attribute matches the `<input>` element immediately adjacent. 
- **"Cannot call impure function Date.now() during render"**: Move pure-computation randomizers or time checks into a React `useEffect` hook, or evaluate them server-side before hydration.
