# API Design Audit Report
## ARES Web Portal API

**Audit Date:** 2026-05-09
**API Version:** v6.8
**Scope:** All REST endpoints under `/api/` and `/dashboard/api/`
**Total Endpoints Audited:** ~200+ routes across 30+ domain routers

---

## Executive Summary

The ARES Web Portal API demonstrates **strong foundational practices** with:
- Comprehensive OpenAPI 3.1.0 specification generation
- Consistent error response formats via `standardErrors` pattern
- Type-safe routing using `@hono/zod-openapi` and `typedHandler`
- Good separation of concerns with contract definitions in `shared/routes/`

However, **significant inconsistencies** were identified in:
- HTTP method usage for equivalent operations
- Response pagination patterns
- Resource naming conventions (plural vs singular)
- Status code consistency
- Security header standardization

**Overall Grade:** B+ (Good foundation, needs consistency improvements)

---

## 1. Contract Consistency

### 1.1 ts-rest/OpenAPI Contract Usage ✅ **STRONG**

**Status:** Well-implemented with `@hono/zod-openapi`

**Pattern:**
```typescript
// shared/routes/posts.ts - Consistent contract definition
export const getPostsRoute = createRoute({
  method: "get",
  path: "/",
  request: {
    query: z.object({
      q: z.string().optional(),
      limit: z.coerce.number().optional(),
      offset: z.coerce.number().optional(),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            posts: z.array(postResponseSchema),
          }),
        },
      },
      description: "List of public blog posts",
    },
  },
  tags: ["posts"],
});
```

**Coverage:** 301 `createRoute` definitions across 78 route files

### 1.2 Request/Response Type Consistency ⚠️ **NEEDS IMPROVEMENT**

**Issues Found:**

1. **Snake_case vs camelCase inconsistency:**
   - Database fields use `snake_case` (e.g., `cf_email`, `is_deleted`)
   - API responses mix `snake_case` and `camelCase`
   - Example from `users.ts`:
     ```typescript
     {
       emailVerified: true,  // camelCase
       member_type: "student",  // snake_case
       createdAt: 1234567890000  // camelCase
     }
     ```

2. **Nullable vs optional fields:**
   - Inconsistent use of `.nullable()` vs `.optional()` in schemas
   - Example: `posts.ts` uses both patterns for similar fields
     ```typescript
     author: z.string().nullable().optional(),
     thumbnail: z.string().nullable().optional(),
     date: z.string().nullable().optional()
     ```

3. **Timestamp format inconsistency:**
   - Mixed use of `Date.getTime()` numbers vs ISO strings
   - `createdAt` varies between endpoints:
     - Users: number (timestamp)
     - Posts: string | null (ISO date)
     - Events: string (ISO datetime)

**Recommendation:**
```typescript
// Establish consistent response wrapper pattern
export const ApiResponseSchema = <T>(itemSchema: z.ZodType<T>) => z.object({
  data: itemSchema,
  meta: z.object({
    timestamp: z.string(),  // Always ISO 8601
    request_id: z.string().optional(),
  }).optional()
});

// Standardize all timestamps to ISO 8601 strings
export const TimestampField = z.string().datetime().optional();
```

### 1.3 Error Response Format ✅ **EXCELLENT**

**Status:** Centralized error handling via `standardErrors`

**Pattern from `shared/routes/common.ts`:**
```typescript
export const ErrorSchema = z.object({
  error: z.string().openapi({
    description: "Human-readable error message",
    example: "Resource not found",
  }),
  code: z.string().optional().openapi({
    description: "Machine-readable error code",
    example: "NOT_FOUND",
  }),
  details: z.unknown().optional().openapi({
    description: "Additional context",
  }),
});

export const standardErrors = {
  400: { content: { "application/json": { schema: ErrorSchema }}, description: "Bad Request" },
  401: { content: { "application/json": { schema: ErrorSchema }}, description: "Unauthorized" },
  // ... etc
};
```

**Adoption:** Used across 27 route definition files

---

## 2. Endpoint Design

### 2.1 RESTful Conventions ⚠️ **MIXED ADHERENCE**

**Good Patterns:**
- Resource grouping: `/posts`, `/events`, `/users`
- Hierarchical resources: `/posts/{slug}/history`
- Query parameters for filtering: `?q=search&limit=10`

**Violations Found:**

1. **Inconsistent CRUD operations:**

   | Resource | Create | Read | Update | Delete |
   |----------|--------|------|--------|--------|
   | Posts | POST `/admin/save` | GET `/{slug}` | POST `/admin/{slug}` | DELETE `/admin/{slug}` |
   | Events | POST `/admin/save` | GET `/{id}` | PATCH `/admin/{id}` | DELETE `/admin/{id}` |
   | Docs | POST `/admin/save` | GET `/{slug}` | POST `/admin/save` | DELETE `/admin/{slug}` |
   | Users | N/A | GET `/admin/{id}` | PATCH `/admin/{id}` | DELETE `/admin/{id}` |
   | Tasks | POST `/` | GET `/` | PATCH `/{id}` | DELETE `/{id}` |

   **Issues:**
   - Posts/Docs use POST for updates (should be PATCH/PUT)
   - Mixed use of `{slug}` vs `{id}` parameter naming
   - Non-standard `/admin/save` for create-or-update semantics

2. **Action endpoints not following REST:**
   ```
   POST /posts/{slug}/approve     ✅ Should be: PATCH /posts/{slug}  {status: "approved"}
   POST /posts/{slug}/reject      ✅ Should be: PATCH /posts/{slug}  {status: "rejected"}
   POST /posts/{slug}/undelete    ✅ Should be: PATCH /posts/{slug}  {is_deleted: false}
   POST /posts/{slug}/purge       ✅ Should be: DELETE /posts/{slug}/permanent
   POST /events/{id}/approve      ✅ Should be: PATCH /events/{id}   {status: "approved"}
   PUT /notifications/{id}/read   ✅ Should be: PATCH /notifications/{id} {is_read: true}
   PUT /notifications/read-all    ✅ Should be: PATCH /notifications  {all_read: true}
   ```

**Recommendation:**
```typescript
// Standardize on RESTful PATCH for updates
export const updatePostStatusRoute = createRoute({
  method: "patch",
  path: "/posts/{slug}",
  request: {
    params: z.object({ slug: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            status: z.enum(["published", "pending", "rejected", "draft"]),
            is_deleted: z.boolean().optional(),
          }),
        },
      },
    },
  },
  responses: { ...standardErrors, 200: { /* ... */ } },
  tags: ["posts", "admin"],
});
```

### 2.2 Naming Consistency ❌ **NEEDS IMPROVEMENT**

**Issues:**

1. **Plural vs Singular resource names:**
   - ✅ Plural: `/posts`, `/events`, `/users`, `/comments`, `/badges`
   - ❓ Mixed: `/profile` (singular), `/settings` (singular but acts as collection)
   - Recommendation: Use plural consistently: `/profiles`, `/settings`

2. **ID parameter naming:**
   - Posts use `{slug}`: `/posts/{slug}`
   - Events use `{id}`: `/events/{id}`
   - Users use `{id}`: `/users/admin/{id}`
   - Docs use `{slug}`: `/docs/{slug}`
   - Tasks use `{id}`: `/tasks/{id}`

   **Recommendation:** Document which resources use slugs vs IDs and maintain consistency

3. **Admin path prefixing:**
   - Mixed patterns:
     - `/posts/admin/list` vs `/admin/posts`
     - `/users/admin/{id}` vs `/admin/users/{id}`
     - `/settings/admin/settings` vs `/admin/settings`

   **Current:** Admin routes are prefixed at resource level
   **Recommendation:** Consider `/admin/{resource}` pattern for consistency

### 2.3 HTTP Method Usage ⚠️ **INCONSISTENT**

**Correct Usage:**
```
GET    /posts              ✅ List
GET    /posts/{slug}       ✅ Retrieve
DELETE /posts/{slug}       ✅ Delete (soft)
PATCH  /users/{id}         ✅ Partial update
```

**Incorrect Usage:**
```
POST   /posts/admin/{slug}       ❌ Should be PATCH for updates
PUT    /notifications/{id}/read  ❌ Should be PATCH (partial update)
POST   /events/{id}/approve      ❌ Should be PATCH with status body
POST   /docs/admin/{slug}/reject ❌ Should be PATCH with status body
GET    /auth/emergency-clear     ❌ Should be POST (state-changing)
```

### 2.4 Status Code Consistency ⚠️ **GENERALLY GOOD WITH EXCEPTIONS**

**Proper Usage:**
- 200: Successful operations
- 401: Unauthorized (auth.ts)
- 403: Forbidden (auth checks)
- 404: Not found (resource lookups)
- 429: Rate limit exceeded (security.ts)

**Issues:**
1. **Conflict handling varies:**
   - Posts: Returns 409 on duplicate title ✅
   - Other resources: May return 400 or 500

2. **Deletion status codes:**
   - Soft delete (update): Returns 200 ✅
   - Should consider 204 No Content for successful DELETE without body

---

## 3. Documentation

### 3.1 OpenAPI/Swagger Coverage ✅ **EXCELLENT**

**Configuration:**
```typescript
// functions/api/[[route]].ts
apiRouter.doc('/openapi.json', {
  openapi: '3.1.0',
  info: { title: 'ARESWEB API', version: 'v6.8' }
});

const scalarConfig = {
  spec: { url: '/api/openapi.json' },
  theme: 'moon' as const
};
apiRouter.get('/reference', apiReference(scalarConfig));
```

**Access Points:**
- OpenAPI Spec: `/api/openapi.json`
- Scalar UI: `/api/reference`
- Dashboard access: `/dashboard/api/reference`

### 3.2 JSDoc Completeness ❌ **NEEDS IMPROVEMENT**

**Findings:**
- Route contracts have OpenAPI descriptions ✅
- Handler implementations lack JSDoc comments ❌
- Middleware has minimal documentation ⚠️

**Example of Current:**
```typescript
// functions/api/routes/posts.ts
postsRouter.openapi(savePostRoute, typedHandler<typeof savePostRoute>(async (c) => {
  // No JSDoc explaining implementation details
  const body = c.req.valid("json");
  // ...
}));
```

**Recommended:**
```typescript
/**
 * Create or update a blog post.
 *
 * Creates a new post if `slug` is not provided, otherwise updates existing.
 * Non-admin users create pending posts requiring approval.
 * Admin posts are auto-published unless `isDraft=true`.
 *
 * @throws {ApiError} 409 - When post with same title exists for current date
 * @throws {ApiError} 400 - When title exceeds MAX_INPUT_LENGTHS.title
 *
 * Side effects:
 * - Captures revision history for existing posts
 * - Triggers social media dispatch for published posts
 * - Sends notifications to admins for pending posts
 * - Queues background reindexing
 */
postsRouter.openapi(savePostRoute, typedHandler<typeof savePostRoute>(async (c) => {
  // ...
}));
```

### 3.3 Usage Examples ❌ **MISSING**

**Status:** No usage examples in OpenAPI specs

**Recommendation:**
```typescript
export const savePostRoute = createRoute({
  // ...
  examples: {
    "request": {
      "summary": "Create a published post",
      "value": {
        title: "Match Preview: Competition 234",
        ast: { type: "doc", content: [] },
        isDraft: false,
        publishedAt: "2025-01-15T10:00:00Z",
        seasonId: 1
      }
    },
    "success": {
      "summary": "Post created successfully",
      "value": {
        success: true,
        slug: "match-preview-competition-234"
      }
    },
    "conflict": {
      "summary": "Duplicate post title",
      "value": {
        error: "A post with this title already exists for today"
      }
    }
  }
});
```

### 3.4 Deprecation Notices ❌ **NONE FOUND**

**Finding:** No deprecated endpoints marked

**Recommendation:** Add to routes being phased out:
```typescript
export const legacyPostRoute = createRoute({
  deprecated: true,
  "x-deprecation-message": "Use /posts/{slug} instead. Will be removed in v7.0",
  // ...
});
```

---

## 4. Security Headers

### 4.1 CORS Configuration ✅ **WELL CONFIGURED**

**Implementation:**
```typescript
// functions/api/[[route]].ts
apiRouter.use("*", cors({
  origin: (origin, c) => {
    if (!origin) return origin;
    const requestOrigin = new URL(c.req.url).origin;
    if (origin === requestOrigin) return origin;
    const trusted = ["http://localhost:5173", "http://localhost:8788"];
    if (trusted.includes(origin)) return origin;
    return undefined;
  },
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "x-better-auth-origin", "x-better-auth-session-id"],
  credentials: true,
  maxAge: 86400,
}));
```

**Strengths:**
- Origin validation with whitelist
- Credentials support for session cookies
- Appropriate method whitelist
- Pre-flight cache (24 hours)

**Minor Issues:**
- Local development ports hardcoded (consider env var)
- No `Access-Control-Expose-Headers` for custom response headers

### 4.2 CSP Headers ⚠️ **NOT CONSISTENTLY APPLIED**

**Finding:** No Content-Security-Policy headers detected in API responses

**Recommendation:**
```typescript
// Add to middleware
app.use("*", async (c, next) => {
  await next();
  if (c.req.path.startsWith("/api/")) {
    c.res.headers.set("Content-Security-Policy",
      "default-src 'none'; " +
      "script-src 'none'; " +
      "style-src 'none'; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self'"
    );
  }
});
```

### 4.3 Rate Limiting Headers ❌ **MISSING**

**Current Implementation:**
- D1-backed persistent rate limiting ✅
- Circuit breaker pattern ✅
- Audit logging for blocked requests ✅

**Missing:**
```typescript
// Standard rate limit headers not being set
c.header("X-RateLimit-Limit", limit.toString());
c.header("X-RateLimit-Remaining", Math.max(0, limit - count).toString());
c.header("X-RateLimit-Reset", expiresAt.toString());
```

**Current Response:**
```typescript
return c.json(
  { error: "Too many requests. Please try again later." },
  429
);
```

**Should Include:**
```typescript
return c.json(
  { error: "Too many requests. Please try again later." },
  429,
  {
    "X-RateLimit-Limit": "15",
    "X-RateLimit-Remaining": "0",
    "X-RateLimit-Reset": new Date(expiresAt * 1000).toISOString(),
    "Retry-After": Math.ceil((expiresAt - now) / 60).toString()
  }
);
```

### 4.4 Authentication Headers ⚠️ **MIXED APPROACH**

**Session-based auth (Better Auth):**
- Uses cookies: `better-auth.session_token`
- Header: `x-better-auth-session-id` for Better Auth client

**API Key auth (not found but should be documented):**
- No `Authorization: Bearer` pattern for service accounts
- Consider adding for external integrations

**Current auth check:**
```typescript
// functions/api/middleware/auth.ts
export async function getSessionUser(c: Context<AppEnv>): Promise<SessionUser | null> {
  const auth = getAuth(c.env.DB, c.env, c.req.url);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  // ...
}
```

**Recommendation:** Document authentication patterns for API consumers

---

## 5. Performance

### 5.1 Pagination Consistency ❌ **INCONSISTENT PATTERNS**

**Patterns Found:**

1. **Offset-based pagination:**
   ```typescript
   // Posts, Events, Docs
   { limit: 10, offset: 0 }
   Response: { posts: [...], nextCursor: null }
   ```

2. **Cursor-based pagination:**
   ```typescript
   // Users, Events (admin)
   { limit: 50, cursor: "1234567890000" }
   Response: { users: [...], nextCursor: "1234567899999" }
   ```

3. **No pagination:**
   - Badges list (returns all)
   - Settings (single object)

**Issues:**
- Inconsistent parameter names (`offset` vs `cursor`)
- Not all endpoints return pagination metadata
- No `total_count` for UI page display
- Maximum limits not consistently enforced

**Recommendation:**
```typescript
// Standard pagination contract
export const PaginationParams = z.object({
  page: z.coerce.number().min(1).default(1).optional(),
  per_page: z.coerce.number().min(1).max(100).default(20).optional(),
  cursor: z.string().optional(),
});

export const PaginatedResponseSchema = <T>(itemSchema: z.ZodType<T>) => z.object({
  data: z.array(itemSchema),
  pagination: z.object({
    total_count: z.number(),
    per_page: z.number(),
    current_page: z.number(),
    total_pages: z.number(),
    has_next: z.boolean(),
    has_prev: z.boolean(),
    next_cursor: z.string().optional(),
    prev_cursor: z.string().optional(),
  })
});
```

### 5.2 Filtering/Sorting Standards ❌ **INCONSISTENT**

**Examples Found:**

1. **Posts:**
   ```
   GET /posts?q=search&limit=10&offset=0
   ```

2. **Tasks:**
   ```
   GET /tasks?status=todo&subteam=mechanical&assigned_to=user_id
   ```

3. **Events:**
   ```
   GET /events?q=search&limit=10&offset=0
   ```

**Issues:**
- No standard filter parameter format
- No sorting parameters (`sort`, `order`)
- No multi-value filter support (e.g., `status=pending,draft`)

**Recommendation:**
```typescript
// Standard filtering
export const FilterParams = z.object({
  filter: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
  sort: z.string().optional(), // "created_at:desc", "title:asc"
  search: z.string().optional(), // Full-text search
});
```

### 5.3 Field Selection (Partial Response) ❌ **NOT IMPLEMENTED**

**Finding:** No support for field selection

**Recommendation for large resources:**
```typescript
// Add support for field selection
GET /users?fields=id,name,nickname,email
GET /posts?fields=slug,title,date,author

export const FieldSelectionParams = z.object({
  fields: z.string().optional().openapi({
    description: "Comma-separated list of fields to return",
    example: "id,name,email"
  })
});
```

### 5.4 Compression ✅ **HANDLED BY INFRASTRUCTURE**

**Status:** Cloudflare Workers/Pages handles gzip/brotli automatically

**No manual compression needed** - handled at edge

---

## 6. Additional Findings

### 6.1 Edge Caching ✅ **GOOD IMPLEMENTATION**

```typescript
// functions/api/middleware/cache.ts
export const edgeCacheMiddleware = (
  sMaxAge = 300,
  maxAge = 60,
  staleWhileRevalidate = 300
) => {
  return cache({
    cacheName: 'aresweb-global-cache',
    cacheControl: `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
  });
};
```

**Applied to:**
- Public posts: 5min edge, 1min browser, 5min SWR
- Public docs: 3min edge, 1min browser, 3min SWR
- Public events: 3min edge, 1min browser, 3min SWR

### 6.2 API Versioning ❌ **NONE DETECTED**

**Current:** No `/v1/`, `/v2/` prefix in URLs
**Version info:** Only in OpenAPI info (`v6.8`)

**Recommendation:** Add versioning before breaking changes:
```
/api/v1/posts
/api/v2/posts  # When contract changes
```

### 6.3 Bulk Operations ❌ **LIMITED**

**Found:**
- Task reordering: `POST /tasks/reorder` with array
- Settings update: `POST /settings/admin/settings` with object

**Missing:**
- Bulk delete (with filter)
- Bulk status update
- Batch operations

---

## 7. Priority Recommendations

### HIGH PRIORITY

1. **Standardize HTTP Methods**
   - Change update actions from POST to PATCH
   - Change read actions to PUT for state changes

2. **Consistent Response Naming**
   - Choose snake_case OR camelCase (recommend camelCase for JSON APIs)
   - Apply consistently across all endpoints

3. **Add Rate Limit Headers**
   - Include standard rate limit headers in 429 responses
   - Add `Retry-After` header

4. **Pagination Standardization**
   - Choose offset-based OR cursor-based (recommend cursor for large datasets)
   - Apply consistent pagination metadata

### MEDIUM PRIORITY

5. **Documentation Enhancement**
   - Add JSDoc to handler functions
   - Include usage examples in OpenAPI specs
   - Document authentication patterns

6. **Error Code Enumeration**
   - Standardize error codes across all endpoints
   - Document in developer guide

7. **Security Headers**
   - Add CSP headers for API responses
   - Expose appropriate headers via CORS

### LOW PRIORITY

8. **Field Selection**
   - Add `fields` parameter for partial responses
   - Implement in resource-heavy endpoints

9. **API Versioning**
   - Add `/v1/` prefix before breaking changes
   - Document versioning policy

10. **Deprecation Process**
    - Mark deprecated routes
    - Add sunset headers

---

## 8. Compliance Summary

| Area | Status | Grade | Notes |
|------|--------|-------|-------|
| OpenAPI Coverage | ✅ Complete | A | All routes defined |
| Type Safety | ✅ Strong | A | Zod + TypeScript |
| Error Handling | ✅ Excellent | A | Centralized format |
| HTTP Methods | ⚠️ Mixed | C | POST for updates |
| Naming | ⚠️ Inconsistent | C | Mixed conventions |
| Pagination | ⚠️ Varied | D | Multiple patterns |
| Documentation | ⚠️ Partial | C | Specs present, examples missing |
| Security Headers | ⚠️ Basic | B | CORS good, others missing |
| Performance | ✅ Good | B+ | Caching, rate limiting |
| Versioning | ❌ None | F | No URL versioning |

**Overall Grade: B+**

---

## Appendix: Route Inventory

**Total Routers:** 30+
**Total Routes:** ~200+

**Router List:**
- `/api/auth` - Authentication (Better Auth)
- `/api/posts` - Blog posts
- `/api/docs` - Documentation
- `/api/events` - Events/calendar
- `/api/users` - User management
- `/api/badges` - Achievement badges
- `/api/comments` - Comments system
- `/api/notifications` - User notifications
- `/api/tasks` - Task management
- `/api/finance` - Financial tracking
- `/api/sponsors` - Sponsor management
- `/api/analytics` - Usage analytics
- `/api/settings` - Platform settings
- `/api/media` - Media management
- `/api/outreach` - Outreach tracking
- `/api/locations` - Location data
- `/api/seasons` - Season management
- `/api/logistics` - Logistics tracking
- `/api/awards` - Awards management
- `/api/profiles` - User profiles
- `/api/points` - Point system
- `/api/judges` - Judges data
- `/api/entities` - Entity links
- `/api/simulations` - Simulations
- `/api/store` - Store/inventory
- `/api/social-queue` - Social media queue
- `/api/ai` - AI features
- `/api/scouting` - Scouting data
- `/api/tba` - The Blue Alliance integration
- `/api/github` - GitHub integration
- `/api/zulip` - Zulip integration
- `/webhooks/github` - GitHub webhooks
- `/webhooks/zulip` - Zulip webhooks

---

**Report Generated:** 2026-05-09
**Auditor:** API Design Audit System
**Method:** Static analysis of route contracts and implementations
