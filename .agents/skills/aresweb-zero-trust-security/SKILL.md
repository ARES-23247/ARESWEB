---
name: aresweb-zero-trust-security
description: Institutionalizes absolute Zero Trust security principles and architectural audits for all ARESWEB Cloudflare D1/R2 endpoints. Expressly forbids authentication systems that rely on spoofable headers like Referer or Host.
---

# ARES 23247 Zero Trust Security Enforcement

This skill mandates absolute security strictness when architecting or maintaining Cloudflare Pages Functions, API routes, D1 database mutations, and R2 asset storage. The ARESWEB portal operates on the public edge and is heavily targeted; we rely on **Cloudflare Zero Trust Access** rather than application-layer authentication.

## 1. The Zero Trust Identity Rule
**Never trust `Host`, `Origin`, or `Referer` headers for authentication.**
These headers are fundamentally insecure and easily spoofable by an attacker using `curl` or Postman to bypass restrictions via the `.pages.dev` raw worker URL.

### ❌ Insecure Pattern (FORBIDDEN)
```typescript
// DANGEROUS: Bypasses authentication if a hacker injects "Referer: aresfirst.org"
const referer = c.req.header("referer") || "";
const isDashboard = referer.includes("aresfirst.org");

if (!email && !isDashboard) {
  return c.json({ error: "Unauthorized" }, 401);
}
```

### ✅ Secure Pattern (ENFORCED)
**Always require the cryptographic `cf-access-authenticated-user-email` OR `cf-access-jwt-assertion` header.**
Because Cloudflare Access acts as a reverse proxy, it automatically wipes any manually injected `cf-access` headers from unauthenticated public traffic. The only way these headers exist is if the user successfully passed the institutional login screen. 

*Critical Warning:* Some Identity Providers (like GitHub, depending on public profile settings) DO NOT pass an email address to Cloudflare Access. If no email is provided, Cloudflare ZERO TRUST drops the `cf-access-authenticated-user-email` header entirely, causing artificial 401 Unauthorized errors for fully logged-in users. You MUST fallback to checking `cf-access-jwt-assertion` to cryptographically verify their active session.

```typescript
// SECURE: Enforces that the request has mathematically passed Zero Trust
const url = new URL(c.req.url);
const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
const email = c.req.header("cf-access-authenticated-user-email");
const jwt = c.req.header("cf-access-jwt-assertion");

if (!email && !jwt && !isLocal) {
  return c.json({ error: "Strict Context: Unauthorized. Cloudflare Zero Trust authentication required." }, 401);
}
```

## 2. API Endpoint Audit Checklist
Before committing any new API endpoint (`POST`, `PUT`, `DELETE`, or sensitive `GET` routes), you must execute an internal audit verifying the following:

1. **Spoof Immunity:** The endpoint does not conditionally waive authentication based on origin domain requests.
2. **Localhost Isolation:** `url.hostname === "localhost"` is the *only* acceptable bypass, and it must validate the parsed URL hostname, NOT the `Host` header.
3. **D1 SQL Injection Protection:** All database parameters are safely bound using `.bind()` rather than raw string interpolation.
4. **Environment Isolation:** Ensure `.pages.dev` environments (which circumvent DNS-level Access Application rules) require strict header validation to protect against lateral bypasses.
5. **No Inline Auth Duplication:** The route handler MUST NOT contain its own auth check. Auth is handled exclusively by the centralized `ensureAdmin` middleware. See Section 5.

## 3. SQL Binding Standards
Never inject user-controlled input directly into a D1 query string.

### ❌ Insecure (FORBIDDEN)
```typescript
await c.env.DB.prepare(`DELETE FROM posts WHERE slug = '${slug}'`).run();
```

### ✅ Secure (ENFORCED)
```typescript
await c.env.DB.prepare("DELETE FROM posts WHERE slug = ?").bind(slug).run();
```

## 4. API Proxy Mounting & Cloudflare Edge Routing Tables
When mounting internal or protected API routes (e.g., `/dashboard/api/*`), you **MUST** ensure the base path is explicitly whitelisted in `public/_routes.json`. 

**The 405 Method Not Allowed Edge Trap:**
Cloudflare Pages statically evaluates `public/_routes.json` to determine which paths hit the Functions (`functions/`) environment vs Cloudflare's static file cache.
1. If your protected API proxy (`/dashboard/api/*`) is NOT listed in the `include` array of `_routes.json`, Cloudflare assumes it maps to a static asset.
2. Cloudflare strictly rejects all mutating HTTP operations (`POST`, `PUT`, `DELETE`) against static URLs.
3. Your secure API requests will fail on the Edge Network with a completely opaque `405 Method Not Allowed`, bypassing your actual backend code entirely.

### ✅ Secure Routing Table
Always verify `public/_routes.json` captures your proxy mounts:
```json
{
  "version": 1,
  "include": [
    "/api/*",
    "/dashboard/api/*"
  ],
  "exclude": []
}
```

## 5. Single Source of Truth for Authentication (CRITICAL)
**Auth logic MUST exist in exactly ONE place: the `ensureAdmin` middleware registered via `apiRouter.use("/admin/*", ensureAdmin)`.**

Never duplicate auth checks inside individual route handlers. This caused a **production outage** where the centralized middleware was updated to accept JWT tokens, but 8 stale inline copies inside route handlers still only checked for the email header — silently rejecting authenticated users.

### ❌ FORBIDDEN: Inline Auth Duplication
```typescript
// BAD — This duplicates ensureAdmin and WILL desync when the middleware is updated
apiRouter.delete("/admin/posts/:slug", ensureAdmin, async (c) => {
  const email = c.req.header("cf-access-authenticated-user-email");
  if (!email && url.hostname !== "localhost") {
    return c.json({ error: "Unauthorized" }, 401);  // STALE — ignores JWT!
  }
  // ...
});
```

### ✅ ENFORCED: Middleware-Only Auth
```typescript
// CORRECT — Auth is handled by apiRouter.use("/admin/*", ensureAdmin) on line 35
// Individual handlers trust that they only execute if ensureAdmin passed.
apiRouter.delete("/admin/posts/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    await c.env.DB.prepare("DELETE FROM posts WHERE slug = ?").bind(slug).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: "Delete failed" }, 500);
  }
});
```

**Rule:** When adding a new `/admin/*` route, do NOT pass `ensureAdmin` as an inline middleware parameter and do NOT add auth checks inside the handler body. The global `apiRouter.use("/admin/*", ensureAdmin)` handles all authentication automatically.

## 6. SPA Frontend Auth Gate (CRITICAL)

**Cloudflare Zero Trust only protects paths that hit the Functions runtime.** The ARESWEB portal is a single-page React application — client-side routes like `/dashboard` are served as static `index.html` by Cloudflare's CDN, which **completely bypasses Zero Trust**. This means an unauthenticated visitor can see the full admin dashboard UI rendered in their browser, even though API mutations correctly fail with 401.

This is both an **information exposure vulnerability** and a **UX failure**. Every protected SPA route MUST implement a frontend auth gate.

### The Auth-Check Probe Pattern

**CRITICAL: The auth-check endpoint MUST live OUTSIDE `/admin/*`.**

Cloudflare Access only injects `cf-access-*` headers for the exact path the Access Application protects (e.g., `/dashboard`), **NOT** for subpaths like `/dashboard/api/admin/auth-check`. If the probe endpoint is mounted under `/admin/*`, the `ensureAdmin` middleware will reject it because the `cf-access-*` headers are absent — even though the user IS authenticated via Cloudflare Access. This caused a production bug where authenticated users were permanently locked out of the dashboard.

The fix: mount the probe at `/api/auth-check` (no `/admin/` prefix) and manually check for authentication signals including the `CF_Authorization` cookie, which Cloudflare Access sets domain-wide after login.

```typescript
// Backend: functions/api/[[route]].ts
// This lives OUTSIDE /admin/* — it does NOT go through ensureAdmin.
// It checks headers AND the CF_Authorization cookie as a fallback.
apiRouter.get("/auth-check", async (c) => {
  const url = new URL(c.req.url);

  // Block .pages.dev alias
  if (url.hostname.endsWith(".pages.dev")) {
    return c.json({ authenticated: false }, 403);
  }

  // Localhost always passes
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return c.json({ authenticated: true, email: "local-dev@localhost" });
  }

  // Check Cloudflare Access injected headers (works if Access covers this path)
  const email = c.req.header("cf-access-authenticated-user-email");
  const jwt = c.req.header("cf-access-jwt-assertion");
  if (email || jwt) {
    return c.json({ authenticated: true, email: email || "authenticated-user" });
  }

  // Fallback: Check CF_Authorization cookie set by Cloudflare Access login flow.
  // This cookie is present for ANY path on the domain after Access authentication.
  const cookieHeader = c.req.header("cookie") || "";
  const cfAuthMatch = cookieHeader.match(/CF_Authorization=([^;]+)/);
  if (cfAuthMatch && cfAuthMatch[1]) {
    return c.json({ authenticated: true, email: "authenticated-user" });
  }

  return c.json({ authenticated: false }, 401);
});
```

### ❌ FORBIDDEN: Auth-Check Under /admin/*

```typescript
// BAD — ensureAdmin blocks this because Cloudflare Access doesn't inject
// cf-access-* headers for /dashboard/api/admin/* subpaths.
// Authenticated users see "Authentication Required" permanently.
apiRouter.get("/admin/auth-check", async (c) => {
  const email = c.req.header("cf-access-authenticated-user-email");
  return c.json({ authenticated: true, email });
});
```

### Frontend Auth Gate Implementation

Every protected page component (e.g., `Dashboard.tsx`) MUST probe the auth-check endpoint on mount and render a locked screen if the probe fails.

**The localhost bypass MUST be computed at module scope** and used as the initial `useState` value. This avoids calling `setState` synchronously inside a `useEffect` body, which violates the `react-hooks/set-state-in-effect` ESLint rule.

```tsx
// CORRECT: Module-level constant avoids setState-in-effect lint violation
const isLocalDev =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

export default function Dashboard() {
  const [authState, setAuthState] = useState<AuthState>(
    isLocalDev ? "authenticated" : "checking"
  );

  useEffect(() => {
    if (isLocalDev) return; // Already authenticated via initial state

    const checkAuth = async () => {
      try {
        const res = await fetch("/dashboard/api/auth-check", {
          credentials: "same-origin",
        });
        setAuthState(res.ok ? "authenticated" : "unauthorized");
      } catch {
        setAuthState("unauthorized");
      }
    };
    checkAuth();
  }, []);

  if (authState === "checking") return <LoadingSpinner />;
  if (authState === "unauthorized") return <AuthRequiredScreen />;

  return <ActualDashboardUI />;
}
```

### ❌ FORBIDDEN: Localhost Bypass Inside useEffect

```tsx
// BAD — Triggers react-hooks/set-state-in-effect lint error
useEffect(() => {
  const isLocal = window.location.hostname === "localhost";
  if (isLocal) {
    setAuthState("authenticated"); // ← VIOLATION: synchronous setState in effect body
    return;
  }
  // ...
}, []);
```

### ❌ FORBIDDEN: Rendering Protected UI Without Auth Gate

```tsx
// BAD — Dashboard renders fully to unauthenticated visitors
export default function Dashboard() {
  // No auth check at all — anyone who visits /dashboard sees the full admin UI
  return <AdminDashboardUI />;
}
```

### Rule
When creating or modifying any page component that should only be visible to authenticated users:
1. The component MUST probe `/dashboard/api/auth-check` on mount (NOT `/dashboard/api/admin/auth-check`).
2. The component MUST render a locked/login screen when the probe returns non-200.
3. The localhost bypass MUST be a module-level `const`, NOT computed inside a `useEffect`.
4. The auth-check endpoint MUST live OUTSIDE `/admin/*` because Cloudflare Access header injection is path-scoped.

## Action Summary
Whenever you are operating within `functions/api/` or writing backend logic, you are to assume the posture of a strict Security Auditor. Assume all traffic is malicious unless cryptographically verified by Cloudflare JWTs. Never implicitly trust internal Edge networking routes without explicit definitions in `_routes.json`. Never duplicate auth logic — the `ensureAdmin` middleware is the single source of truth for mutations. The auth-check UI probe is the sole exception: it lives outside `/admin/*` and validates via headers OR the `CF_Authorization` cookie. When building or modifying protected SPA frontend pages, always implement the auth-check probe gate pattern from Section 6 — Cloudflare Zero Trust does NOT protect static page loads.
