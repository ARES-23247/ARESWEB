---
name: aresweb-error-handling
description: Enforces the ARESWEB throw-first error handling architecture for Express route handlers in Firebase Cloud Functions. Use this when writing or reviewing API route handlers to ensure errors are thrown (not manually returned) and are handled by the global error middleware.
---

# ARESWEB Error Handling Architecture

## Core Principle: Throw, Never Manually Return Errors

**Every route handler MUST only return "happy path" responses.** All error conditions MUST be signaled by throwing `ApiError` — never by returning `res.status(status).json({ error })` manually.

### Why This Matters
Returning inline error shapes creates duplicate boilerplate and makes code harder to maintain. By utilizing an Express-native async error bubble pattern, all thrown errors are caught in one place, formatted uniformly, and safely logged.

---

## The Architecture

```
┌─────────────────────────────────┐
│  Express Route Handler          │
│  ┌───────────────────────────┐  │
│  │ Validation checks         │  │
│  │ → throw new ApiError(…)   │  │  ← Throws on validation failures
│  │                           │  │
│  │ Business logic            │  │
│  │ → uncaught errors bubble  │  │  ← Runtime errors naturally throw
│  │                           │  │
│  │ res.json(successPayload)  │  │  ← ONLY happy path returned
│  └───────────────────────────┘  │
└─────────────┬───────────────────┘
              │ throw (caught by asyncHandler)
              ▼
┌─────────────────────────────────┐
│  globalErrorHandler Middleware  │
│  index.ts                       │
│  ┌───────────────────────────┐  │
│  │ ApiError? → status + msg  │  │  ← Proper status codes (400/404/429)
│  │ Generic?  → 500 + log     │  │  ← Unexpected errors logged to stack
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

---

## Required Patterns

### 1. Handler Wrapper (`asyncHandler`)
Every route handler in Express MUST be wrapped with `asyncHandler` to safely forward promise rejections to `next(err)`:

```typescript
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";

router.post("/example", asyncHandler(async (req, res) => {
  const { id } = req.body;
  if (!id) {
    throw new ApiError(400, "ID parameter is required.");
  }

  const doc = await fetchDocFromFirestore(id);
  if (!doc) {
    throw new ApiError(404, "Document not found.");
  }

  res.json({ success: true, doc });
}));
```

### 2. Error Shapes
All HTTP errors returned by the API will follow this unified structure:
```json
{
  "error": "Human readable error message"
}
```
The status code is returned as the HTTP response status.
