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

### Rule D: Dashboard API Prefix Convention (CRITICAL)
All `fetch()` calls from dashboard components (`src/components/` and `src/pages/Dashboard.tsx`) MUST use the `/dashboard/api/` prefix — never bare `/api/`. This is a **mandatory routing convention**, not optional.

**Why:** The Cloudflare Access Application protects `/dashboard*`. Requests to `/dashboard/api/*` inherit the `CF_Authorization` cookie scope and trigger Cloudflare to inject `cf-access-*` headers into the Functions runtime. Requests to bare `/api/*` bypass this entirely, causing `ensureAdmin` to reject authenticated users with 401.

```tsx
// ❌ FORBIDDEN — breaks on production, returns "Access denied or network error"
const res = await fetch("/api/admin/settings");

// ✅ CORRECT — routes through the Access-protected path
const res = await fetch("/dashboard/api/admin/settings");
```

**Audit rule:** Before committing any new frontend `fetch()` call that targets an `/admin/*` endpoint, verify it starts with `/dashboard/api/`. Run this grep to find violations:
```bash
grep -rn 'fetch("/api/admin/' src/
```

## 3. Resolving Common Build Errors
- **"Calling setState synchronously within an effect"**: Do not call functions that execute `setState` immediately during render or inside the body of a `useEffect` loop without an explicit trigger. If the initial state depends on a runtime condition (e.g., `window.location.hostname === "localhost"`), compute it as a **module-level constant** and pass it directly to `useState()` as the initial value. This is the enforced pattern for the Zero Trust auth gate — see the `aresweb-zero-trust-security` skill, Section 6. Never wrap the workaround in `setTimeout()` — that suppresses the lint warning but introduces a flash of loading state on every localhost render.
- **"@typescript-eslint/no-unused-vars"**: Remove unused variables immediately. Do not leave dead state variables (e.g., `authEmail`) from refactors. If a variable was used for debugging, delete it before committing.
- **"@typescript-eslint/no-explicit-any"**: Do not cast JSON or AI responses to `any`. Construct deterministic inline destructured types like `(aiResponse as { response?: string })` when validating Cloudflare `env.AI` objects.
- **"JSX element 'label' has no corresponding control"**: Replace `for=` with `htmlFor=`, and verify the `id=` attribute matches the `<input>` element immediately adjacent. 
- **"Cannot call impure function Date.now() during render"**: Move pure-computation randomizers or time checks into a React `useEffect` hook, or evaluate them server-side before hydration.
- **"'ComponentName' is not defined" (react/jsx-no-undef)**: Verify the component is properly imported. If lucide-react icons report as undefined, check the installed version (`npm ls lucide-react`) — some icons were added in later versions. Always use named imports from `lucide-react`.
- **"Failed to load integrations. Access denied or network error."**: The dashboard component is using `/api/admin/*` instead of `/dashboard/api/admin/*`. Add the `/dashboard` prefix. See Rule D above.
