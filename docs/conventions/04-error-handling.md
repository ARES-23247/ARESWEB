# Error Handling Architecture

> Throw-first error handling for Express sub-router endpoints.

## Core Principle

**Every route handler MUST only return happy-path responses.** All errors MUST be thrown via `ApiError` — never manually returned as status code structures.

### Why
Returning both success and error shapes inside Express handlers without bubbling leads to cluttered controller code. Throwing errors lets the global Express `globalErrorHandler` handle all logging, metrics, and consistent JSON formatting.

---

## Required Pattern

Wrap all async Express router handlers in the `asyncHandler` utility, and throw `ApiError` on errors:
```typescript
import { ApiError } from "../middleware/errorHandler";
import { asyncHandler } from "../lib/utils";

router.post("/save", ensureAdmin, asyncHandler(async (req, res) => {
  const { title } = req.body as { title: string };
  
  // Validation error
  if (!title) {
    throw new ApiError(400, "Title is required");
  }

  // Database checks
  const result = await saveArticle(title);
  if (!result) {
    throw new ApiError(500, "Failed to save article");
  }

  // ONLY happy path returned
  res.json({ success: true });
}));
```

---

## Forbidden Patterns

### ❌ Returning Error Responses Directly
```typescript
// NEVER DO THIS — creates inconsistent handling and leaks structure
if (!result) {
  return res.status(404).json({ error: "Not found" });
}
```

### ❌ Handler-Level Try/Catch
```typescript
// NEVER DO THIS
try {
  const item = await getItem(id);
  res.json({ item });
} catch (err) {
  res.status(500).json({ error: "Server error" }); // ❌
}
```

---

## ApiError Class

Located at `functions/src/middleware/errorHandler.ts`

```typescript
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}
```
Standard usage:
```typescript
throw new ApiError(400, "Validation failed");
throw new ApiError(401, "Unauthorized");
throw new ApiError(403, "Forbidden");
throw new ApiError(404, "Resource not found");
```

---

## Global Handler

The global handler catches all thrown errors and returns a standardized JSON structure:
```json
{
  "error": "Error message content"
}
```
Location: `functions/src/middleware/errorHandler.ts`
```typescript
export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error("[Global Error Handler] Caught Exception:", err);

  const status = err.status || 500;
  const message = err.message || "Internal server error.";

  res.status(status).json({
    error: message
  });
};
```
This is registered in `functions/src/index.ts` as the very last middleware.
