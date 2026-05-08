# API Type Safety Migration Guide

This guide explains how to migrate existing route files to follow the new type safety standards.

## Summary of Changes

| Before | After |
|--------|-------|
| `c.json({ error: "..." } as any, 404)` | `errorResponses.notFound(c, "Resource")` |
| Manual `validateLength()` calls | Zod schema validators with `.refine()` |
| Inconsistent error formats | Standard `{ error, code?, details? }` format |
| `async (c: any) => {...}` | `typedHandler<typeof route>(async (c) => {...})` |

## Files Created

1. **`shared/routes/common.ts`** - Updated with clean `ErrorSchema` and `ErrorCode` constants
2. **`shared/errors/api.ts`** - Error response utilities and helpers
3. **`shared/validation/constants.ts`** - Centralized validation constraints and zod helpers
4. **`functions/api/middleware/errorHandler.ts`** - Error handler middleware and `ApiError` class

## Migration Steps

### Step 1: Update Imports

```typescript
// Add these imports
import { errorResponses, ErrorCode } from "../../../shared/errors/api";
import { titleField, slugField, /* etc */ } from "../../../shared/validation/constants";
```

### Step 2: Remove `as any` from Error Responses

**Before:**
```typescript
return c.json({ error: "Post not found" } as any, 404 as any);
return c.json({ error: "Unauthorized" } as any, 401 as any);
return c.json({ error: "Failed" } as any, 500 as any);
```

**After:**
```typescript
return errorResponses.notFound(c, "Post");
return errorResponses.unauthorized(c);
return errorResponses.internalError(c, "Failed");
```

### Step 3: Use `typedHandler` Instead of `async (c: any)`

**Before:**
```typescript
router.openapi(myRoute, async (c: any) => {
  // ...
});
```

**After:**
```typescript
router.openapi(myRoute, typedHandler<typeof myRoute>(async (c) => {
  // ...
}));
```

### Step 4: Replace Manual Validation with Zod

**Before:**
```typescript
const titleError = validateLength(body.title, MAX_INPUT_LENGTHS.title, "Title");
if (titleError) return c.json({ error: titleError } as any, 400);
```

**After:**
```typescript
// In your schema file (shared/routes/*.ts):
import { titleField } from "../../validation/constants";

export const myRoute = createRoute({
  // ...
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            title: titleField, // Handles min/max validation automatically
          }),
        },
      },
    },
  },
});

// In handler - zod validation happens automatically:
const body = c.req.valid("json"); // Will throw if validation fails
```

### Step 5: Use `ApiError` for Complex Error Handling

For errors that need context or custom handling:

```typescript
import { ApiError, throwErrors } from "../../../middleware/errorHandler";

// Throw errors that will be caught by error middleware
if (!user) {
  throwErrors.notFound("User");
}

// Or throw ApiError directly
if (!hasPermission) {
  throw new ApiError("Insufficient permissions", 403, ErrorCode.FORBIDDEN);
}
```

## Available Error Response Helpers

| Helper | Status | Description |
|--------|--------|-------------|
| `errorResponses.badRequest(c, msg?, details?)` | 400 | Invalid input or validation error |
| `errorResponses.unauthorized(c, msg?)` | 401 | Authentication required |
| `errorResponses.forbidden(c, msg?)` | 403 | Insufficient permissions |
| `errorResponses.notFound(c, resource?)` | 404 | Resource does not exist |
| `errorResponses.conflict(c, msg?)` | 409 | Resource already exists |
| `errorResponses.tooManyRequests(c, msg?)` | 429 | Rate limit exceeded |
| `errorResponses.internalError(c, msg?)` | 500 | Server error |

## Available Field Validators

```typescript
import {
  titleField,
  optionalTitleField,
  nameField,
  optionalNameField,
  slugField,
  emailField,
  optionalEmailField,
  descriptionField,
  contentField,
  commentField,
  codeField,
  createUrlValidator,
  createDateRangeValidator,
} from "../../../shared/validation/constants";
```

## Files Still Needing Migration

Run this to find files with `as any`:

```bash
grep -r "as any" functions/api/routes --include="*.ts" -l
```

Current count (approximate): 18 files

## Example: Full Route Migration

**Before:**
```typescript
router.openapi(savePostRoute, async (c: any) => {
  try {
    const body = await c.req.json();
    const titleError = validateLength(body.title, 500, "Title");
    if (titleError) return c.json({ error: titleError } as any, 400);

    const result = await db.insert(posts).values(body).returning().get();
    return c.json({ success: true, post: result } as any, 200);
  } catch (e) {
    return c.json({ error: "Failed" } as any, 500);
  }
});
```

**After:**
```typescript
router.openapi(savePostRoute, typedHandler<typeof savePostRoute>(async (c) => {
  const body = c.req.valid("json"); // Already validated by zod

  const result = await db.insert(posts).values(body).returning().get();
  return c.json({ success: true, post: result }, 200);
}));
```

Note: With error handler middleware, try-catch blocks are often unnecessary since errors are automatically formatted.
