# Error Handling Architecture

> Throw-first error handling for Hono/OpenAPI routes.

## Core Principle

**Every route handler MUST only return happy-path responses.** All errors MUST be thrown via `ApiError` — never returned.

### Why
Returning both success and error shapes creates union types (`200-response | 500-response`), causing TypeScript `TS2345` overload errors. Throwing lets the global `app.onError()` middleware handle all error formatting.

---

## Required Pattern
```typescript
import { ApiError } from "../middleware/errorHandler";

router.openapi(route, typedHandler<typeof route>(async (c) => {
  // Validation errors
  if (!id) throw new ApiError(400, "ID is required", "VALIDATION_ERROR");

  // Not found
  if (!result) throw new ApiError(404, "Post not found", "NOT_FOUND");

  // Rate limiting
  if (isRateLimited) throw new ApiError(429, "Rate limit exceeded", "RATE_LIMIT_EXCEEDED");

  // ONLY happy path returned
  return c.json({ post: result }, 200);
}));
```

---

## Forbidden Patterns

### ❌ Returning Error Responses
```typescript
// NEVER DO THIS — creates union return type
if (!result) return c.json({ error: "Not found" }, 404);
```

### ❌ Handler-Level Try/Catch
```typescript
// NEVER DO THIS
try {
  return c.json({ post: result }, 200);
} catch (err) {
  return c.json({ error: "Server error" }, 500);  // ❌
}
```

---

## ApiError Class

Located at `functions/api/middleware/errorHandler.ts`

```typescript
// new ApiError(message, statusCode, errorCode?, details?)
throw new ApiError("Not found", 404, "NOT_FOUND");
throw new ApiError("Validation failed", 400, "VALIDATION_ERROR", { field: "email" });
throw new ApiError("Unauthorized", 401, "UNAUTHORIZED");
throw new ApiError("Forbidden", 403, "FORBIDDEN");
```

### Optional Helpers
```typescript
import { throwErrors } from "../middleware/errorHandler";
throwErrors.notFound("Post");        // → 404
throwErrors.badRequest("Invalid ID"); // → 400
throwErrors.unauthorized();           // → 401
throwErrors.forbidden();              // → 403
throwErrors.internal("DB error");     // → 500
```

---

## Import Paths

| File Location | Import Path |
|---|---|
| `functions/api/routes/*.ts` | `"../middleware/errorHandler"` |
| `functions/api/routes/*/index.ts` | `"../../middleware/errorHandler"` |

---

## When `as any` Is Acceptable

Only for **Drizzle ORM dynamic table lookups** where TypeScript cannot track type through `Record<string, unknown>` indirection (e.g., backup endpoint's `SCHEMA_MAP[tableName]`).

Never acceptable for: handler return types, error responses, route signatures, `typedHandler` parameters.

---

## Reference Implementations

- Clean handlers: `functions/api/routes/badges.ts`, `functions/api/routes/awards.ts`
- Global handler: `functions/api/[[route]].ts` (app.onError, ~line 294)
- ApiError class: `functions/api/middleware/errorHandler.ts`
