---
name: aresweb-error-architecture
description: Unified ARESWEB error architecture: Backend throwing and Frontend exposure.
---

# ARES Error Architecture (Throw-to-Show)

## 1. Backend: Throw, Never Return
Every route handler MUST return ONLY "happy path" responses. Signal all errors by throwing **`ApiError`**.
- **Usage**: `throw new ApiError(400, "Validation error message");`
- **Constraint**: NEVER return `res.status(404).json({ error })` inline inside handlers. Always let the global error middleware handle serializing.
- **Async Wrapper**: Ensure all handlers are wrapped in `asyncHandler` to forward thrown errors.

## 2. Global Strategy: No Silent Failures
- **No Fake Success**: `catch` blocks MUST NOT return 200 with empty lists. Log the error and return/throw 5xx.
- **Exposure**: UI must display granular diagnostics: `HTTP ${res.status}: ${res.statusText}`.

## 3. Visual & Diagnostic Standards
- **UI Styling**: Use `bg-ares-red/10` and `font-mono` for error strings/status codes.
- **Auth Rejections**: If error is 401, explicitly suggest session refresh in the UI.

## 4. Reference Files
- **Global Error Handler**: `functions/src/middleware/errorHandler.ts`
- **Express App Mount**: `functions/src/index.ts`
