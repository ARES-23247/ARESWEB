# TypeScript Type Safety Deep Audit Report

**Generated:** 2026-05-09
**Scope:** `functions/` and `src/` directories
**Total Violations Found:** 250+

## Executive Summary

This audit found **250+** type safety violations across the codebase. The violations have been categorized by severity and compliance with the ARES TypeScript Safety Standards (`.agents/skills/aresweb-typescript-safety/SKILL.md`).

### Severity Breakdown

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 1 | User-identified issue at `functions/api/routes/users.ts:76` |
| HIGH | 50+ | Route handlers, API client, form fields |
| MEDIUM | 150+ | Test files, generated code, boundary casts |
| LOW | 50+ | Comments, acceptable infrastructure `any` |

---

## CRITICAL Issues

### 1. User-Identified Issue: `functions/api/routes/users.ts:76`

**File:** `functions/api/routes/users.ts`
**Line:** 76
**Severity:** CRITICAL
**Category:** API Response Type

**Issue:**
```typescript
return c.json({ users, nextCursor } as any, 200);
```

**Context:**
The users list endpoint returns a response with a manual `as any` cast. The `users` array is manually constructed from Drizzle query results, and `nextCursor` is a string timestamp.

**Recommended Fix:**
```typescript
// Define response schema in shared/routes/users.ts
import { z } from "zod";

export const getUsersResponseSchema = z.object({
  users: z.array(z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string(),
    emailVerified: z.boolean(),
    image: z.string().nullable(),
    role: z.string(),
    createdAt: z.number(),
    updatedAt: z.number(),
    nickname: z.string().nullable(),
    memberType: z.enum(["student", "mentor", "coach", "parent", "alumnus", "alumni", "sponsor", "other"]).nullable(),
  })),
  nextCursor: z.string().nullable(),
});

// In handler:
return c.json({ users, nextCursor }, 200);
// The OpenAPI schema will validate this
```

---

## HIGH Severity Issues

### 2. Hono Client Type: `src/api/honoClient.ts:22`

**File:** `src/api/honoClient.ts`
**Lines:** 22, 99, 135, 144
**Severity:** HIGH
**Category:** Infrastructure Type

**Issues:**
```typescript
export const client: any = hc<AppType>("/api", { ... });
(options?.onSuccess as any)?.(data, variables, context);
await (options?.onSuccess as any)?.(data as never, variables as never, context as never);
await (options?.onError as any)?.(error as never, variables as never, context as never);
```

**Context:**
Per the ARES TypeScript Safety Standards, the Hono client MUST be typed as `any` because OpenAPIHono extends Hono with metadata incompatible with `hc()` type inference. However, the callback casts in `withMutationCallbacks` are problematic.

**Recommended Fix:**
```typescript
// Add proper type constraints for callbacks
export function withMutationCallbacks<TData, TError, TVariables>(
  queryClient: QueryClient,
  options: UseMutationOptions<TData, TError, TVariables> | undefined,
  callbacks: {
    onSuccess?: (queryClient: QueryClient, data: TData, variables: TVariables) => void | Promise<void>;
    onError?: (queryClient: QueryClient, error: TError, variables: TVariables) => void | Promise<void>;
  }
): UseMutationOptions<TData, TError, TVariables> {
  return {
    onSuccess: async (data, variables, context) => {
      await callbacks.onSuccess?.(queryClient, data, variables);
      if (options?.onSuccess) {
        await options.onSuccess(data, variables, context);
      }
    },
    onError: async (error, variables, context) => {
      await callbacks.onError?.(queryClient, error, variables);
      if (options?.onError) {
        await options.onError(error, variables, context);
      }
    },
  };
}
```

### 3. Route Handler Response Casts

**Pattern:** `c.json(... as any, 200)`
**Files:** 20+ route files
**Severity:** HIGH
**Category:** API Response Boundary

**Affected Files:**
- `functions/api/routes/posts/index.ts` (14 occurrences)
- `functions/api/routes/seasons.ts` (4 occurrences)
- `functions/api/routes/tasks.ts` (4 occurrences)
- `functions/api/routes/users.ts` (5 occurrences)
- `functions/api/routes/sponsors.ts` (4 occurrences)
- `functions/api/routes/store.ts` (4 occurrences)
- `functions/api/routes/socialQueue.ts` (3 occurrences)
- `functions/api/routes/outreach/list.ts` (2 occurrences)
- `functions/api/routes/simulations.ts` (3 occurrences)

**Sample Issues:**
```typescript
// functions/api/routes/seasons.ts:73
return c.json({ seasons } as any, 200);

// functions/api/routes/seasons.ts:281
return c.json({ season, awards, events, posts, outreach } as any, 200);

// functions/api/routes/tasks.ts:119
return c.json({ tasks: formattedTasks } as any, 200);

// functions/api/routes/sponsors.ts:168
const body = c.req.valid("json") as any;
```

**Recommended Fix:**
According to the ARES TypeScript Safety Standards, these `as any` casts at response boundaries are PERMITTED when Drizzle return types diverge from Zod schemas. However, they should:

1. Have inline comments explaining the divergence
2. Use explicit response schemas from `shared/routes/*.ts`

```typescript
// ✅ Better: Add comment
return c.json({ seasons } as any, 200); // Drizzle types diverge from SeasonSchema

// ✅ Best: Use typed response schema (if available)
// Define response schema in shared/routes/seasons.ts and let OpenAPIHono validate
```

### 4. Profile Form Field Types

**Pattern:** `field: any` in form components
**Files:** 5 profile component files
**Severity:** HIGH
**Category:** React Component Props

**Affected Files:**
- `src/components/profile/ContactForm.tsx` (lines 15, 31, 55, 73)
- `src/components/profile/FunFirstSection.tsx` (5 occurrences)
- `src/components/profile/PrivateLogisticsSection.tsx` (3 occurrences)

**Sample Issue:**
```typescript
<form.Field name="phone">
  {(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    field: any
  ) => (
    <input
      name={field.name}
      value={field.state.value}
      onBlur={field.handleBlur}
      onChange={(e) => field.handleChange(e.target.value)}
      className={inputClass}
    />
  )}
</form.Field>
```

**Context:**
These are TanStack Form field render props. The type should come from the form schema.

**Recommended Fix:**
```typescript
// Import or infer the field type from the form schema
import type { FieldApi } from '@tanstack/react-form';

// Define a generic field component
type FormFieldProps = {
  name: string;
  children: (field: FieldApi<any, any, any, any>) => React.ReactNode;
};

// Or use proper generics based on your form schema
```

### 5. Component State and Mutation Casts

**Pattern:** Various `as any` casts in components
**Files:** 10+ component files
**Severity:** HIGH

**Sample Issues:**
```typescript
// src/components/AdminUsers.tsx:67-70
return [...filtered, ...users] as any;
setAllUsers(users as any);
patchMutation.mutate({ id: userId, role: validRole as any });

// src/components/AdminInquiries.tsx:100
const inquiries = useMemo(() => (res?.inquiries || []) as any as Inquiry[], [res?.inquiries]);

// src/components/EventEditor.tsx:237-239
updateMutation.mutate({ id: editId, body: payload as any });
saveMutation.mutate(payload as any);
```

**Recommended Fix:**
```typescript
// Define proper types for mutation payloads
type UpdateUserPayload = { id: string; role: UserRole };
patchMutation.mutate({ id: userId, role: validRole } satisfies UpdateUserPayload);

// For inquiries, define the response schema
type InquiriesResponse = { inquiries: Inquiry[] };
const inquiries = useMemo(() => (res?.inquiries || []) as Inquiry[], [res?.inquiries]);
```

---

## MEDIUM Severity Issues

### 6. Test File Type Violations

**Pattern:** Mock objects and test data typed as `any`
**Files:** 30+ test files
**Severity:** MEDIUM
**Category:** Test Infrastructure

**Sample Issues:**
```typescript
// src/hooks/useDashboardNotifications.test.ts (14 occurrences)
const mockSession: any = { authenticated: true, user: { role: "admin" } };
const mockPermissions: any = { isAuthorized: true, canSeeInquiries: true };

// src/api/*.test.tsx files
const mockPosts: any[] = [...];
const mockSponsors: any[] = [...];
(result.current.mutate as any)({ ... });
```

**Context:**
Test files often use `any` for mocks. This is acceptable but should be minimized where possible.

**Recommended Fix:**
```typescript
// Define test fixture types
interface MockSession {
  authenticated: boolean;
  user: { role: string };
}

const mockSession: MockSession = { authenticated: true, user: { role: "admin" } };
```

### 7. Generated Route Tree

**File:** `src/routeTree.gen.ts`
**Lines:** 87-427 (60+ occurrences)
**Severity:** MEDIUM
**Category:** Generated Code

**Issue:**
```typescript
} as any)
```

**Context:**
This is auto-generated by TanStack Router. The `as any` is generated by the framework and cannot be fixed manually.

**Action:** Ignore (generated code)

### 8. Social Queue Route Handlers

**File:** `functions/api/routes/socialQueue.ts`
**Lines:** 177, 280-282, 298
**Severity:** MEDIUM

**Issues:**
```typescript
const update: any = {};
const totalSent = results.filter((r: any) => r.status === "sent").length;
const totalPending = results.filter((r: any) => r.status === "pending").length;
const totalFailed = results.filter((r: any) => r.status === "failed").length;
results.forEach((r: any) => { ... });
```

**Recommended Fix:**
```typescript
interface SocialQueueStatus {
  status: 'sent' | 'pending' | 'failed';
}

type QueueUpdate = Partial<Pick<SocialQueueRow, 'status' | 'scheduledAt' | 'error'>>;

const update: QueueUpdate = {};
const totalSent = results.filter((r) => r.status === "sent").length;
```

### 9. Database Query Result Maps

**Pattern:** `.map((r: any) => ...)`
**Files:** Multiple route files
**Severity:** MEDIUM

**Sample Issues:**
```typescript
// functions/api/[[route]].ts:282
const logs = results.map((r: any) => ({ ... }));

// functions/api/routes/inquiries/index.ts:207
return Promise.all(results.map(async (r: any) => { ... }));

// functions/api/routes/settings.ts:201
data: ((data as any[]) || []).map((r: any) => { ... });
```

**Recommended Fix:**
```typescript
// Infer types from the schema select
type LogRow = /* ... */;
const logs = results.map((r: LogRow) => ({ ... }));
```

### 10. @ts-expect-error Comments

**Files:** 8 files
**Severity:** MEDIUM
**Category:** Type Suppression

**Issues:**
```typescript
// functions/api/routes/events/index.ts:66-113 (3 occurrences)
// @ts-expect-error - Type inference issue with eventHandler params order

// src/utils/lazyBabel.ts:39
// @ts-expect-error - no type declarations for @babel/standalone

// src/pages/Join.tsx:52
// @ts-expect-error - zodValidator generic type mismatch with form schema

// src/components/SponsorEditor.tsx:38
// @ts-expect-error - Type definitions are outdated
```

**Context:**
These are legitimate uses of `@ts-expect-error` with explanatory comments, which aligns with the ARES standards.

**Action:** Monitor for changes in upstream libraries that may resolve these issues.

---

## LOW Severity Issues

### 11. ESLint Disable Comments

**Pattern:** `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
**Files:** 30+ files
**Severity:** LOW
**Category:** Lint Suppression

**Context:**
These are documented suppressions for known `any` types, often at acceptable boundaries.

**Action:** Review quarterly to ensure still necessary.

### 12. Record<string, any> Types

**Files:** `shared/types/api.ts`, `functions/utils/caseMapper.ts`
**Severity:** LOW
**Category:** Generic Record Types

**Issues:**
```typescript
// shared/types/api.ts:32-34
TParams extends Record<string, any> = Record<string, any>,
TQuery extends Record<string, any> = Record<string, any>

// functions/utils/caseMapper.ts:27-31
export function toSnakeCase<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
```

**Context:**
These are generic utility types where `any` is used as a type parameter constraint. This is a common pattern for utilities that work with arbitrary object shapes.

**Recommended Fix (Optional):**
```typescript
// Use `unknown` for better type safety
export function toSnakeCase<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  // ... but this may require additional type assertions internally
}
```

---

## Acceptable `any` Usage (Per ARES Standards)

The following `any` usages are **ACCEPTED** per the ARES TypeScript Safety Standards:

1. **Hono client export** (`src/api/honoClient.ts:22`) - OpenAPIHono/hc incompatibility
2. **Drizzle ↔ OpenAPI response boundaries** - Route handler `c.json(... as any, 200)` casts
3. **Drizzle insert/update values** - When schema types are overly strict
4. **Third-party library integrations** - When types are missing or incomplete

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Route response casts (`c.json(... as any)`) | ~60 |
| Form field types (`field: any`) | ~13 |
| Test mocks (`const mockX: any`) | ~50 |
| Component state casts (`as any`) | ~40 |
| Mutation/callback casts (`as any`) | ~15 |
| Database query maps (`(r: any) =>`) | ~20 |
| Generated code (`routeTree.gen.ts`) | ~60 |
| Other/miscellaneous | ~20 |
| **TOTAL** | **~278** |

---

## Prioritized Action Items

### Phase 1: Critical (Immediate)
1. Fix `functions/api/routes/users.ts:76` - Define proper response schema

### Phase 2: High Priority (1-2 weeks)
2. Fix form field types in `src/components/profile/` - Infer from schema
3. Fix `src/api/honoClient.ts` callback casts - Use proper generics
4. Fix component state casts in Admin/Editor components
5. Define proper types for social queue operations

### Phase 3: Medium Priority (2-4 weeks)
6. Define test fixture types to reduce `any` in test files
7. Fix database query result map types
8. Review and consolidate @ts-expect-error usage

### Phase 4: Low Priority (Ongoing)
9. Review ESLint disable comments quarterly
10. Consider `unknown` over `any` in utility types

---

## Notes

- Generated files (`routeTree.gen.ts`) should be ignored
- Many response boundary casts are accepted per ARES standards
- The ARES codebase follows a pragmatic approach: strict typing in business logic, accepted `any` at framework/library boundaries
