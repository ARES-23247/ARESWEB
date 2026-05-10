# API Contract Deep Audit

**Date:** 2026-05-10
**Auditor:** AI Agent
**Scope:** All API routes in `shared/routes/` and `functions/api/routes/`

---

## Executive Summary

This audit examined **32 route contract files** defining **180+ API endpoints** across the ARES Web Portal. The codebase demonstrates strong patterns in some areas but has critical inconsistencies in others that could lead to runtime errors, broken client integrations, and security vulnerabilities.

### Overall Assessment

| Category | Status | Critical Issues | Notes |
|----------|--------|-----------------|-------|
| Error Response Format | ⚠️ INCONSISTENT | 3 | Mixed patterns between `c.json({ error })` and ApiError class |
| Response Wrapper Patterns | ⚠️ INCONSISTENT | 2 | Multiple ways to express `{ success: boolean }` |
| Pagination | ⚠️ INCONSISTENT | 2 | Three different pagination patterns in use |
| HTTP Method Usage | ✅ GOOD | 0 | RESTful conventions generally followed |
| Route Naming | ⚠️ INCONSISTENT | 1 | Admin routes follow inconsistent patterns |
| Success Response Formats | ⚠️ INCONSISTENT | 2 | Mixed patterns for creation/update responses |
| Admin Tagging | ⚠️ INCONSISTENT | 1 | Not all admin routes properly tagged |

---

## 1. Error Response Format Inconsistencies

### Severity: HIGH

#### 1.1 Dual Error Response Patterns

**Issue:** Two different error response formats are used across the codebase:

1. **Standardized format** (from `shared/routes/common.ts`):
```typescript
{
  error: string,           // Human-readable message
  code?: string,          // Machine-readable code
  details?: unknown       // Additional context
}
```

2. **Legacy simple format** (still used in some implementations):
```typescript
{
  error: string           // Just the message
}
```

**Affected Routes:**
- `functions/api/routes/judges.ts` - Uses `c.json({ error: "..." })` directly
- Test files use the legacy pattern extensively

**Evidence:**
```typescript
// judges.ts:105 - Direct error response
return c.json({ error: "Too many requests" }, 429);

// judges.ts:110 - Another direct error response
return c.json({ error: "Code required" }, 400);

// Contrast with errorHandler.ts - Uses ApiError class
throw new ApiError('Test login only available in test environments', 403);
```

**Impact:** Clients that expect `code` and `details` fields will fail when hitting routes using the legacy format.

**Recommendation:**
1. Audit all route handlers for direct `c.json({ error })` calls
2. Replace with `throw new ApiError()` or `errorResponses` helper functions
3. Add ESLint rule to forbid direct error responses

---

## 2. Response Wrapper Pattern Inconsistencies

### Severity: MEDIUM

#### 2.1 Multiple Ways to Express Success Responses

**Issue:** The `{ success: boolean }` pattern is expressed in at least 3 different ways:

**Pattern 1 - Direct inline:**
```typescript
// posts.ts:292, events.ts:318
z.object({ success: z.boolean() })
```

**Pattern 2 - responseWrappers.success():**
```typescript
// sponsors.ts:133, finance.ts:155
responseWrappers.success()
```

**Pattern 3 - Custom variations:**
```typescript
// tasks.ts:196 - success + task
z.object({ success: z.boolean(), task: TaskSchema })

// auth.ts:110 - success + user + sessionToken
z.object({ success: z.boolean(), user: authUserWithRoleSchema, sessionToken: z.string() })
```

**Pattern 4 - responseWrappers.created():**
```typescript
// locations.ts:123, finance.ts:145
responseWrappers.created()  // { success: boolean, id?: string, warning?: string }
```

**Impact:** Frontend code must handle different response shapes for similar operations. Type safety is compromised when `as any` is used to force conformance.

**Evidence:**
```typescript
// tasks.ts:119 - Type assertion to bypass schema mismatch
return c.json({ tasks: formattedTasks } as any, 200);

// tasks.ts:216 - Another type assertion
return c.json({ success: true, task: createdTask } as any, 200);
```

**Recommendation:**
1. Standardize on `responseWrappers.success()` for simple success responses
2. Use `responseWrappers.created()` for all POST endpoints that create resources
3. Create additional wrappers for common patterns (e.g., `successWithData()`)
4. Remove all `as any` type assertions

---

## 3. Pagination Pattern Inconsistencies

### Severity: MEDIUM

#### 3.1 Three Different Pagination Patterns

**Pattern 1 - Limit/Offset (most common):**
```typescript
// posts.ts:118-119, awards.ts:35-36, inquiries.ts:81-85
query: z.object({
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
})
```

**Pattern 2 - Cursor-based:**
```typescript
// users.ts:69-70, events.ts:113-114
query: z.object({
  limit: z.coerce.number().optional(),
  cursor: z.string().optional(),
})
```

**Pattern 3 - String limit/offset:**
```typescript
// tasks.ts:95-96, internal.ts:131-132
query: z.object({
  limit: z.string().optional(),
  offset: z.string().optional(),
})
```

**Issues:**
1. Pattern 3 uses **strings** instead of numbers - likely a bug
2. No consistent response format for pagination metadata
3. Some endpoints return `{ items, nextCursor }`, others return `{ items }` only

**Evidence:**
```typescript
// tasks.ts:95-96 - INCORRECT: string types
limit: z.string().optional(),
offset: z.string().optional(),

// users.ts:69-70 - CORRECT: cursor-based pagination
limit: z.coerce.number().optional(),
cursor: z.string().optional(),

// Response shape inconsistency:
// users.ts returns: { users: [], nextCursor?: string }
// posts.ts returns: { posts: [] }  // No pagination metadata!
```

**Recommendation:**
1. Fix tasks.ts and internal.ts to use `z.coerce.number()` instead of `z.string()`
2. Decide on a single pagination strategy for new endpoints (recommend cursor-based for large datasets)
3. Add pagination metadata to all list endpoints: `{ items: [], total?: number, nextCursor?: string }`
4. Use `createPaginatedSchema()` helper consistently

---

## 4. Route Naming Convention Issues

### Severity: MEDIUM

#### 4.1 Admin Route Pattern Inconsistency

**Issue:** Admin endpoints use at least 3 different URL patterns:

**Pattern 1 - `/admin/{action}`:**
```typescript
// awards.ts:57, posts.ts:263, events.ts:158
POST /admin/save
GET  /admin/list
```

**Pattern 2 - `/admin/{resource}`:**
```typescript
// users.ts:144, locations.ts:106
PATCH /admin/{id}
GET   /admin/list
```

**Pattern 3 - `/admin/{resource}/{action}`:**
```typescript
// inquiries.ts:150, notifications.ts:69
PATCH /admin/{id}/status
PUT   /admin/{id}/profile
```

**Pattern 4 - Resource-scoped admin actions:**
```typescript
// posts.ts:419, events.ts:367
POST /{slug}/approve
POST /{id}/restore
```

**Impact:** Predictability is reduced. Developers must check documentation for each endpoint.

**Recommendation:**
1. Standardize on `/admin/{resource}` for admin-only endpoints
2. Use resource-scoped actions (`/{id}/approve`) when permission logic is shared
3. Document the pattern in CONTRIBUTING.md

---

## 5. HTTP Method Usage

### Severity: LOW

#### 5.1 Generally RESTful with Minor Issues

**Good patterns:**
- GET for retrieval
- POST for creation
- PATCH for partial updates
- DELETE for deletion

**Minor inconsistencies:**

1. **Profile update uses PUT:**
```typescript
// profiles.ts:142 - PUT /me
export const updateMeRoute = createRoute({
  method: "put",  // Should be PATCH for partial update
  path: "/me",
```

2. **Some POST endpoints for idempotent operations:**
```typescript
// events.ts:367, posts.ts:375
POST /{id}/restore    // Could be PUT
POST /{id}/approve    // Could be PATCH (adds status field)
```

**Impact:** Low - these work correctly but violate strict REST semantics.

**Recommendation:**
1. Change `PUT /me` to `PATCH /me`
2. Document why status change endpoints use POST (trigger side effects like notifications)

---

## 6. Success Response Format Inconsistencies

### Severity: MEDIUM

#### 6.1 Create/Update Response Variations

**Issue:** Endpoints that create or update resources return different response shapes:

**Variation 1 - Just success:**
```typescript
// badges.ts:57, comments.ts:84
{ success: true }
```

**Variation 2 - Success + ID:**
```typescript
// awards.ts:72, sponsors.ts:112
{ success: true, id: string }
```

**Variation 3 - Success + ID + warning:**
```typescript
// locations.ts:123 (responseWrappers.created())
{ success: true, id?: string, warning?: string }
```

**Variation 4 - Full resource:**
```typescript
// tasks.ts:134
{ success: true, task: TaskSchema }
```

**Variation 5 - Multiple fields:**
```typescript
// auth.ts:103
{ success: true, user: {...}, sessionToken: string }
```

**Impact:** Frontend must handle different response patterns for similar operations.

**Recommendation:**
1. Standardize create responses to `{ success: true, id: string }`
2. Use `responseWrappers.created()` consistently
3. For operations returning full resources, use a clear naming pattern like `{ task: TaskSchema }`

---

## 7. Admin Tagging Inconsistencies

### Severity: LOW

#### 7.1 Missing Admin Tags

**Issue:** Not all admin-only routes are tagged with `["admin"]` for OpenAPI documentation.

**Examples of correctly tagged routes:**
```typescript
// awards.ts:77, inquiries.ts:109, users.ts:143
tags: ["awards", "admin"],
tags: ["inquiries", "admin"],
tags: ["users", "admin"],
```

**Routes missing admin tag:**
- Some routes in `internal.ts` use only `tags: ["admin"]`
- Some routes duplicate admin logic but don't reflect it in tags

**Impact:** OpenAPI documentation may not accurately reflect permission requirements.

**Recommendation:**
1. Audit all routes for correct `tags: ["resource", "admin"]` pattern
2. Add automated test to verify all `/admin/*` routes have admin tag

---

## 8. Type Assertion Anti-Patterns

### Severity: HIGH

#### 8.1 Extensive Use of `as any`

**Issue:** Type assertions are used to bypass type checking instead of fixing schema mismatches.

**Evidence:**
```typescript
// tasks.ts:119
return c.json({ tasks: formattedTasks } as any, 200);

// tasks.ts:216
return c.json({ success: true, task: createdTask } as any, 200);

// tasks.ts:236
return c.json({ success: true } as any, 200);
```

**Impact:**
- Type safety is compromised
- Bugs only caught at runtime
- Refactoring becomes dangerous

**Recommendation:**
1. Add ESLint rule: `@typescript-eslint/no-explicit-any = error`
2. Fix all schema mismatches instead of using assertions
3. Use proper type inference from Zod schemas

---

## 9. Query Parameter Type Inconsistencies

### Severity: MEDIUM

#### 9.1 String vs Number for IDs and Counters

**Issue:** Inconsistent use of string vs number for IDs, limits, and offsets.

**String IDs (correct):**
```typescript
// posts.ts, users.ts, etc.
id: z.string()  // UUIDs are strings
```

**Number limits/offsets (correct):**
```typescript
// posts.ts:118-119, awards.ts:35-36
limit: z.coerce.number().optional(),
offset: z.coerce.number().optional(),
```

**String limits/offsets (INCORRECT):**
```typescript
// tasks.ts:95-96
limit: z.string().optional(),   // Should be z.coerce.number()
offset: z.string().optional(),  // Should be z.coerce.number()
```

**Impact:** Clients may send numeric values that are rejected or fail validation.

**Recommendation:**
1. Fix tasks.ts and internal.ts to use `z.coerce.number()`
2. Use `z.coerce.number()` for all numeric query parameters (accepts strings and converts)

---

## 10. Validation Schema Locations

### Severity: LOW

#### 10.1 Scattered Validation Logic

**Issue:** Validation schemas exist in multiple locations:

1. `shared/routes/{resource}.ts` - API contracts
2. `shared/schemas/{resource}Schema.ts` - Shared validation schemas
3. Inline in route handlers

**Example:**
```typescript
// posts.ts uses inline schema definition
export const postSchema = z.object({ ... });

// awards.ts imports from shared
import { awardFormSchema } from "../schemas/awardSchema";
```

**Impact:** Developers don't know where to find or add validation.

**Recommendation:**
1. Keep simple schemas inline in route contracts
2. Move complex/reused schemas to `shared/schemas/`
3. Document the convention in CONTRIBUTING.md

---

## 11. Standard Error Code Usage

### Severity: LOW

#### 11.1 Error Codes Not Always Used

**Issue:** `ErrorCode` constants are defined but not consistently used.

**Defined codes:**
```typescript
// common.ts:43-72
export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  // ... more codes
}
```

**Actual usage in implementations:**
```typescript
// awards.ts:79 - Using custom code
throw new ApiError("Invalid award ID", 400, "BAD_REQUEST");

// awards.ts:84 - Using standard code
throw new ApiError("Award not found", 404, "NOT_FOUND");

// Many places don't specify code at all
throw new ApiError("Unauthorized", 401);
```

**Impact:** Clients can't reliably parse error codes for programmatic handling.

**Recommendation:**
1. Always specify error code (third parameter to ApiError)
2. Use ErrorCode constants instead of string literals
3. Add ESLint rule to enforce error code usage

---

## 12. Case Convention Inconsistencies

### Severity: LOW

#### 12.1 Mixed Naming Conventions

**Issue:** While the codebase aims for camelCase, there are exceptions:

**camelCase (correct):**
```typescript
// Most response schemas
dateStart, dateEnd, coverImage, isDeleted, createdAt, updatedAt
```

**snake_case in database:**
```typescript
// Drizzle schemas use snake_case
date_start, date_end, cover_image, is_deleted, created_at, updated_at
```

**The toCamelCaseResponse helper:**
```typescript
// schema-openapi.ts:271-277
export function toCamelCaseResponse<T extends ZodTypeAny>(schema: T): T {
  // Drizzle ORM handles snake_case to camelCase mapping natively
  // This is now an identity pass-through
  return schema;
}
```

**Impact:** The mapping happens at the Drizzle level, but the helper's name is misleading.

**Recommendation:**
1. Rename `toCamelCaseResponse` to `passthroughSchema` or remove it
2. Document that Drizzle handles the snake_case to camelCase conversion

---

## Summary of Critical Issues

| # | Issue | Severity | Files Affected | Fix Effort |
|---|-------|----------|----------------|------------|
| 1 | Type assertions (`as any`) | HIGH | tasks.ts, multiple routes | Medium |
| 2 | String instead of number for limit/offset | MEDIUM | tasks.ts, internal.ts | Low |
| 3 | Inconsistent success response formats | MEDIUM | 30+ route files | High |
| 4 | Mixed error response patterns | HIGH | judges.ts, test files | Medium |
| 5 | Missing pagination metadata | MEDIUM | posts.ts, awards.ts, others | Medium |

---

## Recommendations by Priority

### Immediate (High Priority)

1. **Fix type assertions** - Replace all `as any` with proper types
2. **Standardize error responses** - Use ApiError class everywhere
3. **Fix query parameter types** - Change string to number for limit/offset

### Short Term (Medium Priority)

4. **Standardize success responses** - Use responseWrappers consistently
5. **Add pagination metadata** - Include total/nextCursor in list endpoints
6. **Document route patterns** - Create API style guide

### Long Term (Low Priority)

7. **Audit admin tags** - Ensure all admin routes are properly tagged
8. **Consolidate validation schemas** - Decide on inline vs. shared location
9. **Review HTTP methods** - Align with REST semantics where practical

---

## Appendix A: Files Audited

### Contract Files (shared/routes/)
- auth.ts
- posts.ts
- profiles.ts
- tasks.ts
- badges.ts
- awards.ts
- comments.ts
- analytics.ts
- events.ts
- sponsors.ts
- users.ts
- inquiries.ts
- finance.ts
- locations.ts
- notifications.ts
- judges.ts
- docs.ts
- And 14 others...

### Implementation Files (functions/api/routes/)
- All corresponding implementation files
- middleware/errorHandler.ts
- middleware/cache.ts

---

## Appendix B: Testing Recommendations

1. **Add contract validation tests** - Verify responses match schemas
2. **Add error format tests** - Ensure all errors use standard format
3. **Add pagination tests** - Verify pagination metadata is correct
4. **Add type checking tests** - Run tsc --noEmit in CI

---

**End of Audit**

For questions or clarifications, please refer to the specific line numbers cited in each issue.
