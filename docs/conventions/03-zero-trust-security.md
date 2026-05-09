# Zero Trust Security

> Security rules for authentication and authorization. Read before editing auth flows, protected routes, or user data handling.

## Core Rule

**Never trust client-provided headers for auth decisions.** Spoofable headers include: `Referer`, `Host`, `Origin`, `X-Forwarded-For`.

---

## Server-Side Auth

### Required Pattern
```typescript
import { getSessionUser, ensureAuth, ensureAdmin } from "../middleware";

// In handler
const user = await getSessionUser(c);
if (!user) throw new ApiError(401, "Authentication required");
```

### Middleware Protection
```typescript
// Apply at router level
analyticsRouter.use("/stats", ensureAuth);     // Any authenticated user
analyticsRouter.use("/admin/*", ensureAdmin);  // Admin/author/mentor/coach
```

### Role Hierarchy
`admin` (full access) → `author` (content) → `mentor/coach` (elevated by member_type) → `parent` → `student` → `unverified` (restricted)

---

## Cloudflare Zero Trust

**Headers:** `cf-access-authenticated-user-email` (verified email), `cf-access-jwt-assertion` (JWT)

```typescript
const cfEmail = c.req.header("cf-access-authenticated-user-email");
if (!cfEmail) throw new ApiError(401, "Unauthorized");
// Still verify against Better Auth for permissions
```

---

## Common Pitfalls

### Handler-Only Auth (Wrong)
```typescript
// ❌ No middleware at router level
getOrders: async (_, c) => {
  if (!c.get("sessionUser")?.role === "admin") return unauthorized();
}
```

**Correct:**
```typescript
// ✅ Middleware at router level
storeHandler.use("/orders", ensureAdmin);
```

### Optional Chaining on User Role (Wrong)
```typescript
// ❌ Allows unauthenticated access
const status = user?.role === "admin" ? "published" : "pending";
```

**Correct:**
```typescript
// ✅ Explicit auth check
const user = await getSessionUser(c);
if (!user) throw new ApiError(401, "Unauthorized");
const status = user.role === "admin" ? "published" : "pending";
```

---

## Dev Bypass Rules

Allowed ONLY in true local development:
- `ENVIRONMENT === "development"` AND localhost hostname
- `NODE_ENV === "test"` for automated testing

**NOT allowed:** `ENVIRONMENT === "preview"` (preview deployments are public!)

---

## Audit Logging
```typescript
import { logAuditAction } from "../middleware";
await logAuditAction(c, "DELETE", "events", eventId, `Deleted: ${title}`);
```

Log all sensitive actions: deletions, role changes, settings updates.

---

## Security Checklist

Before committing auth/authorization code:

- [ ] No decisions based on `Referer`, `Host`, or `Origin`
- [ ] Protected routes use `ensureAuth` or `ensureAdmin` middleware
- [ ] Handler checks verify user existence before using data
- [ ] Cloudflare headers are supplemental, not primary auth
- [ ] Sensitive actions logged via `logAuditAction`
- [ ] Dev bypass only for `development` + localhost
