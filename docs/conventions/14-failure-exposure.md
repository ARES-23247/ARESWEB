# Failure Exposure Protocol

> Error reporting and diagnostic visibility. Read when handling errors or building error UIs.

## Core Rule

**No silent failures.** Never return generic "Something went wrong" or HTTP 200 with empty data in catch blocks.

```typescript
// ❌ BANNED — fake success
catch { return { status: 200, body: { items: [] } }; }

// ✅ AUTHORIZED — log + proper status
catch (e) {
  console.error("HANDLER_NAME ERROR", e);
  return { status: 500, body: { error: "Failed to fetch items" } };
}
```

## HTTP Status Exposure

Always show numeric status code:

```typescript
// ❌ BANNED
throw new Error("Failed to load");

// ✅ AUTHORIZED
if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
```

## Visual Treatment

- Use `font-mono` for status codes and error strings
- Use subtle opacity (`/80`) for diagnostic text
- Use `ares-red` backgrounds/borders (`bg-ares-red/10`) for errors

## Auth Failure Context

If error is 401, explicitly suggest re-authenticating. Middleware must return structured JSON explaining why access was denied.

## Backend Logging

Every client error must also be `console.error` on edge with: request path, user email, error message.

## Async Tasks (waitUntil)

Non-critical background tasks (social, Zulip) must use `c.executionCtx.waitUntil()` with internal `.catch()` for logging.

```typescript
c.executionCtx.waitUntil(
  dispatchSocials(...).catch(err => console.error(err))
);
```
