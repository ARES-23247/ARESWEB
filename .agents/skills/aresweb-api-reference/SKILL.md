---
name: aresweb-api-reference
description: Provides a comprehensive reference for the ARESWEB Hono API, including standardized routing, authentication, and core resource endpoints. Use this when interacting with the backend or documenting API behavior.
---

# ARESWEB API Reference Skill

You are the Lead Backend Architect for Team ARES 23247. When interacting with the ARESWEB Hono API (Cloudflare Pages Functions):

## 1. Core Routing Architecture

The API follows a standardized modular structure mounted at `/api`. Each resource domain has its own sub-router.

### Static Mount Points (in `[[route]].ts`)
| Prefix | Sub-Router | Primary Purpose |
|---|---|---|
| `/auth` | `authRouter` | Authentication lifecycle (Better-Auth) |
| `/posts` | `postsRouter` | Blog content and administrative CRUD |
| `/events` | `eventsRouter` | Team events, attendance, and sign-ups |
| `/docs` | `docsRouter` | Technical documentation and ARESLib portal |
| `/profile` | `profilesRouter` | User profile management and roster |
| `/sponsors` | `sponsorsRouter` | Sponsor display and ROI metrics |
| `/inquiries` | `inquiriesRouter` | Form submissions (Join, Sponsor, etc.) |
| `/media` | `mediaRouter` | R2 Storage management and AI tagging |
| `/badges` | `badgesRouter` | Gamification and achievements |
| `/comments` | `commentsRouter` | Threaded discussions across all content |
| `/analytics` | `analyticsRouter` | Platform-wide tracking and metrics |
| `/notifications`| `notificationsRouter`| In-portal user alerts |
| `/locations` | `locationsRouter` | Location management with OSM geocoding |
| `/logistics` | `logisticsRouter` | Administrative logistics (dietary, T-shirt, emergency contacts) |
| `/judges` | `judgesRouter` | Judges Hub portfolio export |
| `/github` | `githubRouter` | GitHub Project v2 CRUD operations |
| `/zulip` | `zulipRouter` | Zulip integration settings and test |
| `/tba` | `tbaRouter` | The Blue Alliance FRC data proxy |
| `/awards` | `awardsRouter` | Team awards management |
| `/outreach` | `outreachRouter` | Outreach activity logs and hours |
| `/settings` | `settingsRouter` | Platform configuration key-value store |
| `/sitemap.xml` | Inline handler | SEO sitemap generation |
| `/search` | Inline handler | Global FTS5 full-text search |
| `/webhooks/github` | `githubWebhookRouter` | GitHub webhook receiver (HMAC-SHA256) |
| `/webhooks/zulip` | `zulipWebhookRouter` | Zulip interactive bot webhook |

## 2. Authentication & Authorization

ARESWEB uses **Better-Auth** for session management and custom Hono middleware for internal security.

### Auth Patterns
- **`getSessionUser(c)`**: Standard utility to retrieve the authenticated user from the context. Checks context cache first (set by `ensureAdmin`), avoiding duplicate D1 queries.
- **`ensureAdmin`**: Middleware that blocks any role except `admin` or `author`. Coaches and mentors also receive standard admin privileges (except user management).
- **`ensureAuth`**: Middleware requiring any valid session.

### Role Hierarchy
1. `admin`: Full platform control.
2. `author`: Content management privileges.
3. `mentor` / `coach`: Elevated access based on member_type.
4. `parent`: Access to logistics and private rosters.
5. `student`: Standard member access.
6. `unverified`: Account created but restricted until manual approval.

## 3. Data Models (D1 Database)

Common resource structures to expect in API responses:

### `posts` (Blog)
- `slug`: Unique identifier.
- `status`: `published` or `pending_review`.
- `is_deleted`: Soft-delete flag (integer 0 or 1).

### `events`
- `id`: UUID.
- `is_volunteer`: Boolean (0/1) for outreach tracking.
- `date_start` / `date_end`: ISO timestamps.

### `docs`
- `category`: Grouping (e.g., 'Mech', 'Software').
- `is_portfolio`: Flags content for the Engineering Portfolio.

## 4. FTS5 Full-Text Search

Several endpoints support full-text search via the `?q=` query parameter:
- **`GET /posts?q=term`**: Searches posts via `posts_fts` virtual table (title, snippet, author).
- **`GET /events?q=term`**: Searches events via `events_fts` virtual table (title, location, description).
- **`GET /profile/team-roster?q=term`**: Searches profiles via `profiles_fts` (nickname, bio, subteams).
- **`GET /search?q=term`**: Global cross-domain search across posts, events, and docs.

**JOIN Rule**: All FTS5 queries MUST join the virtual table with the base table to enforce row-level security (`is_deleted = 0`, `status = 'published'`).

## 5. Development Standards

- **Standardized Endpoints**: Use `/admin/list` for pagination lists and `/admin/save` for create/update logic.
- **OpenAPIHono Architecture (REQUIRED)**: All API features MUST be defined using `@hono/zod-openapi` with `createRoute` and `zod` schemas. See **Section 6** for mandatory type safety patterns — NO `as any`, NO manual validation, consistent error formats.
- **D1 Schema Synchronization (CRITICAL)**: Whenever mapping UI models to D1 databases in `INSERT` or `UPDATE` transactions, you MUST verify destructuring and sql parameter bindings strictly match the column definitions in `schema.sql`. Missing a field silently drops user data.
- **PII Cryptography Compliance (CRITICAL)**: PII fields like phone numbers and parent emails are stored as AES-encrypted cyphertext in the database. You MUST explicitly call `decrypt()` on these fields in `GET` routes before returning them to authorized users. Never expose raw `iv:hex` strings to the frontend.
- **Domain-First Relative Routing**: When building modular Hono routers, NEVER use absolute paths (e.g., `/api/events/list`). Always use relative paths (`/list`) and let the root `[[route]].ts` gateway mount the domain prefixes. Overlapping absolute paths will cause silent 404s.
- **Soft-Delete Standard**: All content deletion MUST use `is_deleted = 1` (or `is_active = 0` for sponsors). Hard `DELETE FROM` is prohibited — data must remain recoverable for audit compliance.
- **Scalability & Resiliency**: Long-running tasks (notifications, social dispatches, batch processing) MUST be wrapped in `c.executionCtx.waitUntil()` to ensure immediate Worker responses.
- **Error Handling**: Use `c.json({ error: "Message" }, status)` for all failures. Never return raw text or unhandled exceptions.
- **Audit Logging**: Use `logAuditAction` for all sensitive administrative changes (deletions, role changes, settings updates).

## 6. Hono OpenAPI & Zod Pattern Standards (MANDATORY)

All API routes MUST follow these patterns when working with `@hono/zod-openapi` and `zod`. Violations WILL cause type safety issues and runtime errors.

### 6.1 Absolute Type Safety (NO `as any`)

**FORBIDDEN:**
```typescript
// ❌ NEVER use type assertions
return c.json({ error: "Not found" } as any, 404 as any);
return c.json({ success: true, slug } as any, 200);
```

**REQUIRED:**
```typescript
// ✅ Use proper typing from createRoute
route.openapi(myRoute, typedHandler<typeof myRoute>(async (c) => {
  // c.var is properly typed from the route definition
  return c.json({ error: "Not found" }, 404);
}));
```

### 6.2 Zod Schema Validation (NO Manual Validation)

**FORBIDDEN:**
```typescript
// ❌ Manual validation in route handler
const titleError = validateLength(body.title, MAX_INPUT_LENGTHS.title, "Title");
if (titleError) return c.json({ error: titleError }, 400);
```

**REQUIRED:**
```typescript
// ✅ Use zod schema with .refine() for custom validation
const createPostSchema = z.object({
  title: z.string().min(1).max(MAX_INPUT_LENGTHS.title),
  description: z.string().max(MAX_INPUT_LENGTHS.description).optional(),
});

export const createPostRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createPostSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            post: PostSchema,
          }),
        },
      },
    },
    // Use standardErrors for consistency
    ...standardErrors,
  },
});
```

### 6.3 Consistent Error Response Format

**STANDARD ERROR FORMAT:**
```typescript
// ✅ All errors MUST follow this structure
interface ErrorResponse {
  error: string;           // Human-readable message
  code?: string;          // Machine-readable error code (optional)
  details?: unknown;      // Additional validation errors (optional)
}

// Examples:
return c.json({ error: "Post not found" }, 404);
return c.json({ error: "Validation failed", code: "VALIDATION_ERROR", details: zodError }, 400);
return c.json({ error: "Unauthorized: Please log in", code: "UNAUTHORIZED" }, 401);
```

**FORBIDDEN:**
```typescript
// ❌ Inconsistent formats
{ message: "Error" }                    // Use "error", not "message"
{ error: "Failed", status: 500 }        // Status goes in HTTP status, not body
{ success: false, error: "..." }        // Don't mix success/error in error responses
```

### 6.4 Proper Route Handler Typing

**REQUIRED PATTERN:**
```typescript
// 1. Define zod schemas (shared/routes/ or inline)
const BodySchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().optional(),
});

const ResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.string(),
    title: z.string(),
  }),
});

// 2. Create route with createRoute
export const myRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: BodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ResponseSchema,
        },
      },
    },
    ...standardErrors,
  },
});

// 3. Use typedHandler for type safety
myRouter.openapi(myRoute, typedHandler<typeof myRoute>(async (c) => {
  // Request is fully typed
  const body = c.req.valid("json");  // Type: BodySchema

  // Response is validated against schema
  return c.json({
    success: true,
    data: { id: "123", title: body.title },
  }, 200);
}));
```

### 6.5 Advanced Zod Patterns (For Complex Validation)

**Use `.refine()` for custom validation:**
```typescript
const CreateEventSchema = z.object({
  title: z.string().min(1).max(200),
  date_start: z.string().datetime(),
  date_end: z.string().datetime(),
}).refine(
  (data) => new Date(data.date_end) > new Date(data.date_start),
  {
    message: "End date must be after start date",
    path: ["date_end"],
  }
);
```

**Use `.transform()` for data normalization:**
```typescript
const CreatePostSchema = z.object({
  title: z.string(),
  slug: z.string().optional(),
}).transform((data) => ({
  ...data,
  slug: data.slug ?? slugify(data.title),
}));
```

### 6.6 Route Definition Checklist

Before creating or modifying any route, ensure:

- [ ] Route uses `createRoute` from `@hono/zod-openapi`
- [ ] Handler uses `typedHandler<typeof routeName>`
- [ ] Request body/query/params use zod schemas
- [ ] Responses use zod schemas (200, 400, 401, 404, 500)
- [ ] Error responses follow `{ error: string, code?: string }` format
- [ ] NO `as any` type assertions
- [ ] NO manual validation in handlers
- [ ] `standardErrors` is spread into responses

### 6.7 Migration Pattern (For Legacy Routes)

When updating legacy routes to proper zod patterns:

```typescript
// BEFORE (legacy):
postsRouter.post("/save", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.title) return c.json({ error: "Title required" } as any, 400);
  // ...
});

// AFTER (proper zod pattern):
const SavePostSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().optional(),
  // ...
});

export const savePostRoute = createRoute({
  method: "post",
  path: "/save",
  request: {
    body: {
      content: {
        "application/json": {
          schema: SavePostSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            slug: z.string(),
          }),
        },
      },
    },
    ...standardErrors,
  },
});

postsRouter.openapi(savePostRoute, typedHandler<typeof savePostRoute>(async (c) => {
  const body = c.req.valid("json");  // Fully typed
  // No manual validation needed!
  // ...
  return c.json({ success: true, slug: body.slug ?? "generated" }, 200);
}));
```

## 7. Global State Management (Zustand)

- **UI State**: Use **Zustand** (`src/store/uiStore.ts`) for global UI toggles, active season tracking, and theme preferences. This replaces prop-drilling and high-re-render Context providers.
- **Store Access**: Prefer specific selectors `const isOpen = useUIStore(s => s.isOpen)` over destructuring the entire store to optimize React render cycles.
- **Persistence**: Any state that should survive a refresh (e.g., Active Season) must be synchronized with `localStorage` or `c.env.DB` settings via the store's action logic.

## 8. Integration Hooks

- **Zulip**: All content updates (posts, inquiries, signups) should trigger `sendZulipAlert` to the appropriate stream. The `sendZulipMessage` utility accepts either full `Bindings` or minimal `ZulipCredentials`.
- **GitHub**: High-priority inquiries (Status: Sponsor/Join) should be escalated via `createProjectItem`.
- **Social Syndication**: Use `dispatchSocialSync()` for multi-platform content broadcast. Providers use `Promise.allSettled` for resilience.

