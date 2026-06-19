---
name: aresweb-failure-exposure
description: Enforces championship-grade error reporting and diagnostic visibility across the ARES Web Portal, ensuring that technical failures are never "silent" and always surface actionable data (like HTTP status codes) to administrators and developers.
---

# ARES 23247 Failure Exposure & Diagnostic Protocol

To maintain a championship-tier production environment, the ARES Web Portal must be resilient AND diagnosable. This skill dictates how failures should be handled and presented to ensure rapid remediation by team members.

## 1. The "No Silent Failure" Rule
Technical failures (network errors, API rejections, database crashes) must **NEVER** fail silently with a generic message like "Something went wrong." 

When an operation fails, you must capture the most granular data possible and present it in a secondary diagnostic layer.

### 1a. The "No Fake Success" Rule
A particularly dangerous variant of silent failure is **catch blocks that return HTTP 200 with empty data** (e.g., `catch { res.json({ docs: [] }) }` when the query crashed). This makes the frontend believe the request succeeded with zero results, when in reality the database query or upstream call crashed.

- ❌ **BANNED**: `catch { res.json({ items: [] }); }`
- ✅ **AUTHORIZED**: `catch (e) { console.error("HANDLER_NAME ERROR", e); res.status(500).json({ error: "Failed to fetch items" }); }`

All `catch` blocks in API route handlers MUST log the error with `console.error` AND return a non-2xx status code.

---

## 2. Mandatory HTTP Status Exposure
All `fetch` calls or API mutations in the Dashboard must verify the response status. If a request fails, the UI must display the numeric HTTP status code and the status text.

- ❌ **BANNED**: `throw new Error("Failed to load")`
- ✅ **AUTHORIZED**: `if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)`

---

## 3. Visual Treatment of Diagnostics
Diagnostic data (error codes, internal messages, stack traces) must be clearly separated from user-facing instructions using technical styling.

- **Typography**: Always use `font-mono` for status codes and internal error strings.
- **Opacity**: Use subtle opacities (e.g., `/80`) for diagnostic text to keep the primary UI clean while still providing detail.
- **Color**: Diagnostic errors must use `ares-red` backgrounds (`bg-ares-red/10`) and borders to signal urgency.

---

## 4. Protected Route Failure Context
Because the ARES Dashboard is protected by Firebase Auth session validation, many failures are actually authentication rejections (401/403). 

- If an error is an `HTTP 401`, the UI should explicitly suggest checking their session and logging in again.
- Backend middleware (`ensureAdmin`) must return structured JSON errors describing *why* access was denied (e.g., "Forbidden: Requires author privileges").

---

## 5. Backend Logging Parity
Every error returned to the client must also be logged on the server using `console.error`.
- Include the request path, the user email/UID (if available), and the specific error message.
- This ensures that Google Cloud Logging captures the failure for remote debugging.
