# API Authentication

> Complete guide to authentication and authorization in the ARESWEB API

## Overview

ARESWEB uses **Better-Auth** for session management combined with custom Hono middleware for role-based access control. Authentication is handled through secure HTTP-only cookies with support for Cloudflare Zero Trust integration.

## Authentication Flow

### Session-Based Authentication

All authenticated requests use session tokens stored in HTTP-only cookies:

```typescript
// Cookie names (automatically managed by Better-Auth)
better-auth.session_token          // Development (http)
__Secure-better-auth.session_token // Production (https)
better-auth.csrf_token             // CSRF protection
__Secure-better-auth.csrf_token    // Production CSRF protection
```

### Checking Authentication Status

**Endpoint:** `GET /api/auth-check`

**Response (Authenticated):**
```json
{
  "authenticated": true,
  "user": {
    "id": "user_123",
    "email": "member@ares23247.org",
    "name": "Jane Doe",
    "role": "student",
    "image": "/avatars/jane.jpg"
  }
}
```

**Response (Unauthenticated):**
```json
{
  "authenticated": false
}
```

**Status:** `401 Unauthorized` if not authenticated

---

## Role-Based Access Control

### Role Hierarchy

The platform uses a hierarchical role system. Higher roles include all permissions of lower roles.

| Role | Level | Description | Permissions |
|------|-------|-------------|--------------|
| `admin` | 1 | Platform administrator | Full access to all features including user management |
| `author` | 2 | Content creator | Create and publish posts, manage content |
| `mentor` | 3 | Team mentor | Elevated access based on member_type, logistics access |
| `coach` | 3 | Team coach | Same as mentor, plus team management |
| `parent` | 4 | Parent/guardian | Access to logistics and private rosters |
| `student` | 5 | Student member | Standard member access |
| `unverified` | 6 | Unverified account | Restricted until manual approval |

### Middleware Usage

#### `getSessionUser(c)`

Retrieves the authenticated user from context. Checks cache first (set by `ensureAdmin`) to avoid duplicate queries.

```typescript
import { getSessionUser } from "../middleware";

const user = await getSessionUser(c);
if (!user) {
  return c.json({ error: "Unauthorized" }, 401);
}

console.log(user.role);      // "admin"
console.log(user.email);     // "user@example.com"
console.log(user.memberType); // "student"
```

#### `ensureAuth`

Middleware requiring any valid session. Redirects to login or returns 401.

```typescript
import { ensureAuth } from "../middleware";

// Apply to entire router
postsRouter.use("/admin/*", ensureAuth);

// Apply to specific route
eventsRouter.openapi(submitSignupRoute, ensureAuth, async (c) => {
  // Handler code - user is guaranteed to be authenticated
});
```

#### `ensureAdmin`

Middleware that blocks any role except `admin` or `author`. Coaches and mentors also receive admin privileges (except user management).

```typescript
import { ensureAdmin } from "../middleware";

// Only admins and authors can access
postsRouter.use("/admin/save", ensureAdmin);
eventsRouter.use("/admin/delete", ensureAdmin);
```

---

## Authentication Patterns

### Pattern 1: Public Endpoint (No Auth)

```typescript
export const publicRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: { /* ... */ },
  },
});

publicRouter.openapi(publicRoute, async (c) => {
  // No authentication check needed
  return c.json({ data: "public info" });
});
```

### Pattern 2: Optional Auth (Enhanced Response for Authenticated Users)

```typescript
export const optionalAuthRoute = createRoute({
  method: "get",
  path: "/{id}",
  responses: {
    200: { /* ... */ },
  },
});

eventsRouter.openapi(optionalAuthRoute, async (c) => {
  const user = await getSessionUser(c);
  const isVerified = user && user.role !== "unverified";

  // Show meeting notes only to verified users
  const meetingNotes = isVerified ? event.meetingNotes : null;

  return c.json({ event, meetingNotes });
});
```

### Pattern 3: Required Auth

```typescript
export const protectedRoute = createRoute({
  method: "post",
  path: "/signup",
  responses: {
    200: { /* ... */ },
    401: { /* ... */ },
  },
});

eventsRouter.openapi(protectedRoute, ensureAuth, async (c) => {
  // User is guaranteed to be authenticated
  const user = await getSessionUser(c);

  await db.insert(schema.eventSignups).values({
    userId: user.id,
    // ... other fields
  }).run();

  return c.json({ success: true });
});
```

### Pattern 4: Role-Based Access

```typescript
export const adminRoute = createRoute({
  method: "delete",
  path: "/admin/{id}",
  responses: {
    200: { /* ... */ },
    401: { /* ... */ },
    403: { /* ... */ },
  },
});

postsRouter.openapi(adminRoute, ensureAdmin, async (c) => {
  // User is guaranteed to be admin or author
  const user = await getSessionUser(c);

  if (user.role !== "admin" && user.role !== "author") {
    return c.json({ error: "Forbidden" }, 403);
  }

  // Perform admin action
  await db.update(schema.posts)
    .set({ isDeleted: 1 })
    .where(eq(schema.posts.slug, slug))
    .run();

  return c.json({ success: true });
});
```

---

## Cloudflare Zero Trust Integration

For production deployments, ARESWEB integrates with Cloudflare Zero Trust for additional security.

### Configuration

```typescript
// In middleware/auth.ts
export async function getSessionUser(c: HonoContext): Promise<User | null> {
  // Check Cloudflare Access authenticated user email
  const cfEmail = c.req.header("cf-access-authenticated-user-email");

  if (cfEmail) {
    // User authenticated via Cloudflare Access
    const user = await db.select()
      .from(schema.user)
      .where(eq(schema.user.email, cfEmail))
      .get();

    return user;
  }

  // Fall back to session-based auth
  // ... session token validation
}
```

### Zero Trust Rules

Configure in Cloudflare Dashboard:

1. **Auto Zero Trust**: Automatically protect all routes under `/api/admin/*`
2. **Email Domains**: Restrict to `@ares23247.org` for admin routes
3. **Service Auth**: Use service tokens for webhook endpoints

---

## Session Management

### Session Lifecycle

1. **Creation:** User signs in via Better-Auth (`/api/auth/sign-in`)
2. **Storage:** Session token stored in HTTP-only cookie
3. **Validation:** Each request validates token against database
4. **Expiry:** Sessions expire after 7 days of inactivity
5. **Revocation:** Admins can revoke sessions via user management

### Emergency Session Clear

**Endpoint:** `GET /api/auth/emergency-clear`

Forces immediate logout by clearing all auth cookies:

```typescript
// Redirects to home with cleared cookies
res.headers.append("Set-Cookie", "better-auth.session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
```

Use this if users experience "poisoned cookie" issues.

### Test Login (E2E Testing Only)

**Endpoint:** `POST /api/auth/test-login`

**Request Body:**
```json
{
  "userId": "admin-user"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "admin-user",
    "name": "Test Admin",
    "email": "admin@ares23247.org",
    "role": "admin"
  },
  "sessionToken": "..."
}
```

**Security:** Only available when `ENVIRONMENT=test` or `CI=true`.

---

## Error Handling

### Standard Error Responses

All authentication errors follow this format:

```typescript
interface AuthErrorResponse {
  error: string;           // Human-readable message
  code?: string;          // Machine-readable error code
}
```

### Common Status Codes

| Status | Code | Description |
|--------|------|-------------|
| 401 | UNAUTHORIZED | No valid session or invalid token |
| 403 | FORBIDDEN | Valid session but insufficient permissions |
| 419 | SESSION_EXPIRED | Session token has expired |
| 429 | TOO_MANY_REQUESTS | Rate limit exceeded (sign-in attempts) |

### Example Error Responses

```json
// 401 Unauthorized
{
  "error": "Unauthorized: Please log in",
  "code": "UNAUTHORIZED"
}

// 403 Forbidden
{
  "error": "Forbidden: Admin access required",
  "code": "INSUFFICIENT_PERMISSIONS"
}

// 419 Session Expired
{
  "error": "Your session has expired. Please sign in again.",
  "code": "SESSION_EXPIRED"
}
```

---

## Best Practices

### 1. Always Validate Session in Admin Routes

```typescript
// ❌ BAD: No auth check
postsRouter.delete("/admin/{slug}", async (c) => {
  await db.delete(schema.posts).where(eq(schema.posts.slug, slug)).run();
  return c.json({ success: true });
});

// ✅ GOOD: Use ensureAdmin middleware
postsRouter.use("/admin/*", ensureAdmin);
postsRouter.delete("/admin/{slug}", async (c) => {
  // Auth check handled by middleware
  await db.delete(schema.posts).where(eq(schema.posts.slug, slug)).run();
  return c.json({ success: true });
});
```

### 2. Check Role for Granular Permissions

```typescript
// ✅ GOOD: Explicit role check
const user = await getSessionUser(c);
if (user?.role !== "admin") {
  return c.json({ error: "Admin access required" }, 403);
}
```

### 3. Use Audit Logging for Sensitive Actions

```typescript
import { logAuditAction } from "../middleware";

await db.delete(schema.posts).where(eq(schema.posts.slug, slug)).run();

// Log the deletion for audit trail
c.executionCtx.waitUntil(
  logAuditAction(c, "DELETE_POST", "posts", slug, "Deleted via admin panel")
);
```

### 4. Never Expose PII in Error Messages

```typescript
// ❌ BAD: Exposes email
return c.json({ error: `User ${user.email} not authorized` }, 403);

// ✅ GOOD: Generic message
return c.json({ error: "Unauthorized access" }, 403);
```

---

## Related Documentation

- [API Reference](./conventions/02-api-reference.md) - Full API routing patterns
- [Zero Trust Security](./conventions/03-zero-trust-security.md) - Security architecture
- [Error Handling](./conventions/04-error-handling.md) - Standard error formats
