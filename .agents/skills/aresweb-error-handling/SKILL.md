---
name: aresweb-error-handling
description: Enforces the ARESWEB throw-first error handling architecture for Hono/OpenAPI route handlers. Use this when writing or reviewing API route handlers to ensure errors are thrown (not returned) and the global onError middleware handles all error responses.
---

# ARESWEB Error Handling Architecture

## Core Principle: Throw, Never Return Errors

**Every route handler MUST only return "happy path" responses.** All error conditions
MUST be signaled by throwing `ApiError` — never by returning `c.json({ error }, status)`.

### Why This Matters

When a Hono/OpenAPI handler returns both success and error shapes, TypeScript infers
a **union return type** (e.g., `Promise<200-response | 500-response>`). Hono's
`RouteHandler` type cannot reconcile this union, causing **TS2345** errors. The fix
is architectural: handlers throw errors, and the global `app.onError()` middleware
catches and serializes them.

## The Architecture

```
┌─────────────────────────────────┐
│  Route Handler                  │
│  ┌───────────────────────────┐  │
│  │ Validation checks         │  │
│  │ → throw new ApiError(…)   │  │  ← Throws on validation failures
│  │                           │  │
│  │ Business logic            │  │
│  │ → uncaught errors bubble  │  │  ← Runtime errors naturally throw
│  │                           │  │
│  │ return c.json(success,200)│  │  ← ONLY happy path returned
│  └───────────────────────────┘  │
└─────────────┬───────────────────┘
              │ throw
              ▼
┌─────────────────────────────────┐
│  Global app.onError()           │
│  [[route]].ts                   │
│  ┌───────────────────────────┐  │
│  │ ApiError? → status + msg  │  │  ← Proper status codes (400/404/429)
│  │ Generic?  → 500 + log     │  │  ← Unexpected errors
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

## Required Patterns

### ✅ CORRECT: Throw ApiError for all error conditions

```typescript
import { ApiError } from "../middleware/errorHandler";

router.openapi(route, typedHandler<typeof route>(async (c) => {
  const db = getDb(c);
  const { id } = c.req.valid("param");

  // Validation — throw, don't return
  if (!id) throw new ApiError("ID is required", 400, "VALIDATION_ERROR");

  // Business logic — errors naturally bubble
  const result = await db.select().from(schema.posts).where(eq(schema.posts.id, id)).get();

  // Not found — throw, don't return
  if (!result) throw new ApiError("Post not found", 404, "NOT_FOUND");

  // Rate limiting — throw, don't return
  if (isRateLimited) throw new ApiError("Rate limit exceeded", 429, "RATE_LIMIT_EXCEEDED");

  // ONLY the happy path is returned
  return c.json({ post: result }, 200);
}));
```

### ❌ WRONG: Returning error responses inline

```typescript
// BAD — creates union return type → TS2345
router.openapi(route, typedHandler<typeof route>(async (c) => {
  const result = await db.select()...;
  if (!result) {
    return c.json({ error: "Not found" }, 404);  // ❌ NEVER DO THIS
  }
  return c.json({ post: result }, 200);
}));
```

### ❌ WRONG: Handler-level try/catch with error returns

```typescript
// BAD — try/catch with c.json error return creates union type
router.openapi(route, typedHandler<typeof route>(async (c) => {
  try {
    const result = await db.select()...;
    return c.json({ post: result }, 200);
  } catch (err) {
    return c.json({ error: "Server error" }, 500);  // ❌ NEVER DO THIS
  }
}));
```

## ApiError Class

Located at `functions/api/middleware/errorHandler.ts`:

```typescript
import { ApiError } from "../middleware/errorHandler";

// Constructor: new ApiError(message, statusCode, errorCode?, details?)
throw new ApiError("Not found", 404, "NOT_FOUND");
throw new ApiError("Validation failed", 400, "VALIDATION_ERROR", { field: "email" });
throw new ApiError("Rate limit exceeded", 429, "RATE_LIMIT_EXCEEDED");
throw new ApiError("Unauthorized", 401, "UNAUTHORIZED");
throw new ApiError("Forbidden", 403, "FORBIDDEN");
```

### Pre-configured Throw Helpers (optional)

```typescript
import { throwErrors } from "../middleware/errorHandler";

throwErrors.notFound("Post");        // → 404
throwErrors.badRequest("Invalid ID"); // → 400
throwErrors.unauthorized();           // → 401
throwErrors.forbidden();              // → 403
throwErrors.internal("DB error");     // → 500
```

## Import Path Rules

The import path depends on the file's directory depth:

| File Location | Import Path |
|---|---|
| `functions/api/routes/*.ts` | `"../middleware/errorHandler"` |
| `functions/api/routes/*/index.ts` | `"../../middleware/errorHandler"` |
| `functions/api/routes/*/**.ts` | `"../../middleware/errorHandler"` |

## When `as any` Is Acceptable

`as any` is **only** acceptable for **Drizzle ORM dynamic table lookups** where
TypeScript cannot track the table type through a `Record<string, unknown>` indirection
(e.g., the backup endpoint's `SCHEMA_MAP[tableName]`).

`as any` is **never** acceptable for:
- Handler return types
- Error response objects
- Route handler function signatures
- `typedHandler` type parameters

## Global Error Handler Location

The global `app.onError()` is at `functions/api/[[route]].ts` (around line 294).
It handles:
1. `ApiError` instances → returns the correct status code and message
2. Generic `Error` instances → returns 500 with logging

## Reference Implementations

- **Clean handler**: `functions/api/routes/badges.ts`
- **Clean handler**: `functions/api/routes/awards.ts`
- **Global error handler**: `functions/api/[[route]].ts` (app.onError)
- **ApiError class**: `functions/api/middleware/errorHandler.ts`
