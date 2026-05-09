---
name: aresweb-error-architecture
description: Unified ARESWEB error architecture: Backend throwing and Frontend exposure.
---

# ARES Error Architecture (Throw-to-Show)

## 1. Backend: Throw, Never Return
Every route handler MUST return ONLY "happy path" responses. Signal all errors by throwing **`ApiError`**.
- **Helper**: Use `throwErrors.notFound("Item")` or `throwErrors.unauthorized()`.
- **Manual**: `throw new ApiError("Message", 400, "VALIDATION_ERROR");`
- **Constraint**: NEVER `return c.json({ error }, 404)`. This breaks `typedHandler` inference.

## 2. Global Strategy: No Silent Failures
- **No Fake Success**: `catch` blocks MUST NOT return 200 with empty lists. Log the error and return/throw 5xx.
- **Exposure**: UI must display granular diagnostics: `HTTP ${res.status}: ${res.statusText}`.
- **Background**: Tasks in `c.executionCtx.waitUntil()` must have internal `.catch()` to log failures.

## 3. Visual & Diagnostic Standards
- **UI Styling**: Use `bg-ares-red/10` and `font-mono` for error strings/status codes.
- **Auth Rejections**: If error is 401, explicitly suggest session refresh in the UI.

## 4. Reference Files
- **Global Error Handler**: `functions/api/[[route]].ts` (`app.onError`)
- **ApiError Class**: `functions/api/middleware/errorHandler.ts`
