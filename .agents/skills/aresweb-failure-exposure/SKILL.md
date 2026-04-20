---
name: aresweb-failure-exposure
description: Enforces championship-grade error reporting and diagnostic visibility across the ARES Web Portal, ensuring that technical failures are never "silent" and always surface actionable data (like HTTP status codes) to administrators and developers.
---

# ARES 23247 Failure Exposure & Diagnostic Protocol

To maintain a championship-tier production environment, the ARES Web Portal must be resilient AND diagnosable. This skill dictates how failures should be handled and presented to ensure rapid remediation by team members.

## 1. The "No Silent Failure" Rule
Technical failures (network errors, API rejections, database crashes) must **NEVER** fail silently with a generic message like "Something went wrong." 

When an operation fails, you must capture the most granular data possible and present it in a secondary diagnostic layer.

## 2. Mandatory HTTP Status Exposure
All `fetch` calls or API mutations in the Dashboard must verify the `response.ok` status. If a request fails, the UI must display the numeric HTTP status code and the status text.

- ❌ **BANNED**: `throw new Error("Failed to load")`
- ✅ **AUTHORIZED**: `if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)`

## 3. Visual Treatment of Diagnostics
Diagnostic data (error codes, internal messages, stack traces) must be clearly separated from user-facing instructions using technical styling.

- **Typography**: Always use `font-mono` (the monospace stack) for status codes and internal error strings.
- **Opacity**: Use subtle opacities (e.g., `/80`) for diagnostic text to keep the primary UI clean while still providing detail.
- **Color**: Diagnostic errors must use `ares-red` backgrounds (`bg-ares-red/10`) and borders to signal urgency.

## 4. Protected Route Failure Context
Because the ARES Dashboard is protected by rigorous Better Auth session validation, many failures are actually authentication rejections (401/403). 

- If an error is an `HTTP 401`, the UI should explicitly suggest checking their session and logging in again.
- Backend middleware (`ensureAdmin`) must return structured JSON errors describing *why* access was denied (e.g., "Forbidden: Requires author privileges").

## 5. Backend Logging Parity
Every error returned to the client must also be logged on the edge using `console.error`. 
- Include the request path, the user email (if available via the active session object), and the specific error message.
- This ensures that Cloudflare Logpush or real-time logs capture the failure for remote debugging.

## 6. Execution
Whenever you are building or refactoring API-connected components, you must verify that the error states satisfy these requirements. If you find a component with a "lazy" error state, rewrite it to include a diagnostic breakdown before finalizing your work.

## 7. Banning Asynchronous Execution Hooks (waitUntil)
Relying on Cloudflare's `c.executionCtx.waitUntil()` for crucial API mutations (e.g., social syndication or Google Calendar syncing) is strictly prohibited.
- `waitUntil` causes background execution that cannot bubble errors back to the caller. If the worker crashes or the API fails, it happens completely *silently* relative to the user interface.
- ❌ **BANNED**: `c.executionCtx.waitUntil( dispatchSocials(...) )`
- ✅ **AUTHORIZED**: `try { await dispatchSocials(...); } catch(err) { return c.json({ error }, 502); }`
- Always wait for the Promise to evaluate natively, catch the exception, and return it directly as a `502 Bad Gateway` schema so the Dashboard displays the network rejection string.
