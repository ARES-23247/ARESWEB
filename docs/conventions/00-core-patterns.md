# ARESWEB Core Patterns

> Foundational patterns — read this first for context on auth, error handling, and API structure.

## Authentication & Authorization

**Always validate server-side via Better Auth:**
```typescript
import { getSessionUser } from "../middleware";

const user = await getSessionUser(c);
if (!user) throw new ApiError(401, "Authentication required");
```

**Middleware for protected routes:**
- `ensureAuth` - Any authenticated user
- `ensureAdmin` - Admin/author/mentor/coach only

```typescript
analyticsRouter.use("/stats", ensureAuth);
analyticsRouter.use("/admin/*", ensureAdmin);
```

**Role hierarchy:** admin > author > mentor/coach > parent > student > unverified

**NEVER trust spoofable headers:** `Referer`, `Host`, `Origin` for auth decisions.

---

## Error Handling: Throw, Never Return

**All errors MUST be thrown:**
```typescript
import { ApiError } from "../middleware/errorHandler";

router.openapi(route, typedHandler<typeof route>(async (c) => {
  if (!id) throw new ApiError(400, "ID is required", "VALIDATION_ERROR");
  if (!result) throw new ApiError(404, "Not found", "NOT_FOUND");
  return c.json({ success: true }, 200); // Only happy path returned
}));
```

**Global `app.onError()` in `[[route]].ts` catches and formats all thrown errors.**

---

## API Route Structure

**Hono + Zod OpenAPI pattern:**
```typescript
const BodySchema = z.object({ title: z.string().min(1) });
const ResponseSchema = z.object({ success: z.boolean() });

export const myRoute = createRoute({
  method: "post",
  path: "/",
  request: { body: { content: { "application/json": { schema: BodySchema } } } },
  responses: { 200: { content: { "application/json": { schema: ResponseSchema } } } },
});

router.openapi(myRoute, typedHandler<typeof myRoute>(async (c) => {
  const body = c.req.valid("json"); // Fully typed
  return c.json({ success: true }, 200);
}));
```

**Domain-first routing:** Use relative paths (`/list`, `/save`), never absolute (`/api/events/list`).

---

## Type Safety Rules

**`as any` permitted ONLY at Drizzle→OpenAPI boundaries:**
```typescript
// OK: At c.json() return when Drizzle types diverge
return c.json(rows.map((r: any) => ({ id: r.id })) as any, 200);

// NOT OK: In business logic, helper functions, or shared types
const data = response.data as any; // ❌
```

**Always infer types from Zod:**
```typescript
type User = z.infer<typeof UserSchema>;
type CreateUserInput = z.input<typeof UserSchema>;
```

---

## Data & Security

**Soft-delete standard:** `is_deleted = 1` for deletions, never `DELETE FROM`.

**PII encryption:** Phone numbers and parent emails are AES-encrypted; call `decrypt()` before returning to frontend.

**D1 schema sync:** When writing INSERT/UPDATE, verify destructuring matches `schema.sql` exactly.

**Async tasks:** Wrap in `c.executionCtx.waitUntil()` for immediate Worker responses.

---

## API Mount Points

| Prefix | Purpose |
|---|---|
| `/auth` | Better-Auth session management |
| `/posts`, `/events`, `/docs` | Content CRUD |
| `/profile`, `/sponsors`, `/badges` | Team & gamification |
| `/analytics`, `/notifications` | Platform features |
| `/github`, `/zulip`, `/tba` | Integrations |
| `/webhooks/*` | Webhook receivers |
