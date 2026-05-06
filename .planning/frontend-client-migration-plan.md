# Frontend API Client Migration Plan: ts-rest to Hono hc()

## Executive Summary

This document outlines the migration strategy for `src/api/client.ts` from ts-rest's `initQueryClient` to Hono's native `hc()` client. The backend already uses `@hono/zod-openapi` with routes defined in `shared/routes/`, making this migration a natural alignment with the current architecture.

**Current State:**
- Backend: Hono with `@hono/zod-openapi` routes in `shared/routes/`
- Frontend Client: ts-rest with contracts in `shared/schemas/contracts/`
- Query Integration: `@ts-rest/react-query` with TanStack Query

**Target State:**
- Backend: Hono with `@hono/zod-openapi` (unchanged)
- Frontend Client: Hono `hc()` with type inference from `AppType`
- Query Integration: Custom TanStack Query wrappers using `hc()` client

---

## 1. Architecture Overview

### 1.1 Current Implementation

**`src/api/client.ts` (ts-rest)**
```typescript
import { initQueryClient } from "@ts-rest/react-query";
import { apiContract } from "@shared/schemas/contracts";

export const api = initQueryClient(apiContract, {
  baseUrl: "/api",
  baseHeaders: {},
  api: async (args) => {
    // Custom fetch implementation
    // - Normalizes trailing slashes
    // - Handles FormData content-type
    // - Returns { status, body, headers }
  }
});
```

**Usage Pattern in Components:**
```typescript
// Query
const { data } = api.analytics.getPlatformAnalytics.useQuery(
  ["platform-analytics"],
  {}
);

// Mutation
const patchMutation = api.users.patchUser.useMutation({
  onSuccess: () => { /* ... */ }
});
patchMutation.mutate({
  params: { id: userId },
  body: { role: "admin" }
});
```

### 1.2 Target Implementation

**`src/api/client.ts` (Hono hc)**
```typescript
import { hc } from "hono/client";
import type { AppType } from "../../functions/api/[[route]]";

export const client = hc<AppType>("/api");
```

**Query Wrappers:**
```typescript
// src/api/queries.ts
import { useQuery, useMutation, type UseQueryOptions } from "@tanstack/react-query";
import { client } from "./client";

export const usePlatformAnalytics = (options?: UseQueryOptions) => {
  return useQuery({
    queryKey: ["platform-analytics"],
    queryFn: async () => {
      const res = await client.analytics.platformAnalytics.$get();
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    },
    ...options
  });
};
```

---

## 2. Migration Steps

### Phase 1: Backend Type Export

**File: `functions/api/[[route]].ts`**

Add `AppType` export for frontend type inference:

```typescript
import { Hono } from "hono";
import { Bindings, AppEnv } from "./middleware";

// Existing imports...

const app = new Hono<AppEnv>();
// ... existing route setup ...

// Export the AppType for frontend client inference
export type AppType = typeof app;
```

### Phase 2: Create New Client Structure

**File: `src/api/client.ts` (new implementation)**

```typescript
import { hc } from "hono/client";
import type { AppType } from "../../functions/api/[[route]]";

/**
 * Type-safe Hono client for API calls
 * Uses hc() for full-stack type inference from Hono routes
 */
export const client = hc<AppType>("/api");

/**
 * Re-export utilities for file operations
 * These are used by components for blob uploads and file handling
 */
export { fetchBlob, uploadFile, fetchJson } from "../utils/apiClient";
```

### Phase 3: Create Query/Mutation Wrappers

**File: `src/api/queries.ts` (new file)**

```typescript
import {
  useQuery,
  useMutation,
  type UseQueryOptions,
  type UseMutationOptions,
  queryClient,
} from "@tanstack/react-query";
import { client } from "./client";
import { toast } from "sonner";

// ============================================================================
// ANALYTICS QUERIES
// ============================================================================

export const usePlatformAnalytics = (
  options?: Omit<UseQueryOptions, "queryKey" | "queryFn">
) => {
  return useQuery({
    queryKey: ["platform-analytics"],
    queryFn: async () => {
      const res = await client.analytics.adminPlatformAnalytics.$get();
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    },
    ...options,
  });
};

export const useStats = (options?: Omit<UseQueryOptions, "queryKey" | "queryFn">) => {
  return useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const res = await client.analytics.adminStats.$get();
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    },
    ...options,
  });
};

export const useRosterStats = (
  options?: Omit<UseQueryOptions, "queryKey" | "queryFn">
) => {
  return useQuery({
    queryKey: ["roster-stats"],
    queryFn: async () => {
      const res = await client.analytics.adminRosterStats.$get();
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    },
    ...options,
  });
};

export const useLeaderboard = (
  options?: Omit<UseQueryOptions, "queryKey" | "queryFn">
) => {
  return useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const res = await client.analytics.leaderboard.$get();
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    },
    ...options,
  });
};

// ============================================================================
// USER QUERIES & MUTATIONS
// ============================================================================

export const useUsers = (
  query: { limit?: number; cursor?: string },
  options?: Omit<UseQueryOptions, "queryKey" | "queryFn">
) => {
  return useQuery({
    queryKey: ["admin_users", query.cursor],
    queryFn: async () => {
      const res = await client.users.adminList.$get({
        query: { limit: query.limit, cursor: query.cursor },
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    },
    ...options,
  });
};

export const usePatchUser = (
  options?: UseMutationOptions<
    unknown,
    Error,
    { id: string; role?: string; member_type?: string }
  >
) => {
  return useMutation({
    mutationFn: async ({ id, role, member_type }) => {
      const res = await client.users.adminAdminId.$patch({
        param: { id },
        json: { role, member_type },
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

export const useDeleteUser = (
  options?: UseMutationOptions<unknown, Error, string>
) => {
  return useMutation({
    mutationFn: async (id) => {
      const res = await client.users.adminAdminId.$delete({
        param: { id },
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    },
    ...options,
  });
};

// ============================================================================
// ANALYTICS MUTATIONS
// ============================================================================

export const useTrackPageView = (
  options?: UseMutationOptions<
    unknown,
    Error,
    { path?: string; category?: string; referrer?: string }
  >
) => {
  return useMutation({
    mutationFn: async (data) => {
      const res = await client.analytics.track.$post({
        json: data,
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    },
    ...options,
  });
};

export const useTrackSponsorClick = (
  options?: UseMutationOptions<unknown, Error, { sponsor_id: string }>
) => {
  return useMutation({
    mutationFn: async ({ sponsor_id }) => {
      const res = await client.analytics.sponsorClick.$post({
        json: { sponsor_id },
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    },
    ...options,
  });
};
```

**Note:** This is a starting point. Additional query/mutation wrappers will be needed for all contracts (posts, events, settings, sponsors, tasks, etc.).

### Phase 4: Backward Compatibility Layer

**File: `src/api/client-legacy.ts` (temporary)**

```typescript
/**
 * LEGACY CLIENT - For gradual migration
 * This maintains the ts-rest API surface during transition
 * @deprecated Use new query hooks from src/api/queries.ts instead
 */

import { initQueryClient } from "@ts-rest/react-query";
import { apiContract } from "@shared/schemas/contracts";

export const api = initQueryClient(apiContract, {
  baseUrl: "/api",
  baseHeaders: {},
  api: async (args) => {
    const normalizedPath = args.path.replace(/\/+(\?|$)/, "$1");

    const headers = new Headers(args.headers);
    if (!(args.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const res = await fetch(normalizedPath, {
      method: args.method,
      headers,
      body: args.body,
    });

    let body;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }

    return {
      status: res.status,
      body,
      headers: res.headers,
    };
  },
});
```

---

## 3. Before/After Examples

### Example 1: Analytics Query

**Before (ts-rest):**
```typescript
import { api } from "../api/client";

const { data, isLoading, isError } =
  api.analytics.getPlatformAnalytics.useQuery(
    ["platform-analytics"],
    {}
  );

const data = analyticsData?.status === 200 ? analyticsData.body : null;
```

**After (Hono hc):**
```typescript
import { usePlatformAnalytics } from "../api/queries";

const { data, isLoading, isError } = usePlatformAnalytics();

// data is already the response body, no status check needed
```

### Example 2: User Mutation with Toast

**Before (ts-rest):**
```typescript
import { api } from "../api/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const queryClient = useQueryClient();

const patchMutation = api.users.patchUser.useMutation({
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    toast.success("User updated");
  },
  onError: (err: Error) => {
    toast.error(err.message || "Update failed");
  }
});

// Usage
patchMutation.mutate({
  params: { id: userId },
  body: { role: "admin" }
});
```

**After (Hono hc):**
```typescript
import { usePatchUser } from "../api/queries";
import { toast } from "sonner";

const patchMutation = usePatchUser({
  onSuccess: () => {
    toast.success("User updated");
  },
  onError: (err: Error) => {
    toast.error(err.message || "Update failed");
  }
});

// Usage - simplified signature
patchMutation.mutate({ id: userId, role: "admin" });
```

### Example 3: Query with Parameters

**Before (ts-rest):**
```typescript
const { data } = api.users.getUsers.useQuery(
  ["admin_users", cursor],
  { query: { limit: 100, cursor: cursor || undefined } }
);

const rawBody = data?.body as unknown as {
  users: unknown[];
  nextCursor?: string | null;
};
```

**After (Hono hc):**
```typescript
const { data } = useUsers({
  limit: 100,
  cursor: cursor || undefined
});

// data is already typed as { users: User[], nextCursor?: string | null }
```

---

## 4. Migration Strategy

### Option A: Big Bang (Recommended for New Features)
- Create all query/mutation wrappers upfront
- Update all components in a single PR
- Remove ts-rest dependency
- **Pros:** Cleanest result, no technical debt
- **Cons:** Large PR, higher coordination needed

### Option B: Gradual Migration
- Keep both clients side-by-side
- Migrate one route/domain at a time
- Use `api-legacy.ts` during transition
- **Pros:** Safer, incremental changes
- **Cons:** Longer migration period, maintaining both clients

### Recommended Approach: Hybrid
1. Export `client` from `src/api/client.ts`
2. Create `src/api/queries.ts` with new hooks
3. Keep `api` export for existing usage (mark as `@deprecated`)
4. New components use new hooks
5. Incrementally migrate existing components by domain
6. Remove ts-rest after full migration

---

## 5. Type Safety Comparison

### ts-rest Types
```typescript
// Contract defines request/response shapes
const api = initQueryClient(apiContract, { baseUrl: "/api" });

// Type narrowing required based on status
const result = await api.analytics.getPlatformAnalytics();
if (result.status === 200) {
  result.body; // { totalPageViews: number, ... }
}
```

### Hono hc Types
```typescript
// Types inferred directly from route definitions
const client = hc<AppType>("/api");

// Response type is inferred from route's response schema
const res = await client.analytics.adminPlatformAnalytics.$get();
if (res.ok) {
  const data = await res.json(); // Fully typed!
}
```

---

## 6. Checklist

### Backend Changes
- [ ] Export `AppType` from `functions/api/[[route]].ts`
- [ ] Verify all OpenAPI routes have proper Zod schemas
- [ ] Ensure route paths align with client expectations

### Frontend Client Setup
- [ ] Install `hono/client` dependency
- [ ] Create new `src/api/client.ts` with `hc()` export
- [ ] Create `src/api/queries.ts` with query/mutation wrappers
- [ ] Create `src/api/client-legacy.ts` for backward compatibility

### Query/Migration Wrappers
- [ ] Analytics (trackPageView, trackSponsorClick, getStats, getPlatformAnalytics, etc.)
- [ ] Users (getUsers, patchUser, deleteUser, updateUserProfile)
- [ ] Posts (list, get, create, update, delete)
- [ ] Events (list, get, create, update, delete, rsvp)
- [ ] Settings (get, update)
- [ ] Sponsors (list, get, create, update, delete)
- [ ] Tasks (list, get, create, update, delete)
- [ ] Seasons, Finance, Social Queue, etc.

### Component Migration
- [ ] AnalyticsDashboard.tsx
- [ ] AdminUsers.tsx
- [ ] Blog.tsx, BlogPost.tsx, BlogEditor.tsx
- [ ] Calendar components (EventEditor, EventSignups, etc.)
- [ ] Task components (TaskDetailsModal, TaskEditDrawer)
- [ ] All other components using `api.`

### Cleanup
- [ ] Remove `@ts-rest/core` and `@ts-rest/react-query` dependencies
- [ ] Remove `client-legacy.ts` and contract files from `shared/schemas/contracts/`
- [ ] Update documentation
- [ ] Run TypeScript check and fix any remaining issues

---

## 7. Potential Issues & Solutions

### Issue 1: Trailing Slash Normalization
The current ts-rest client normalizes paths (`/api/tasks/?parent_id=null` -> `/api/tasks?parent_id=null`).

**Solution:** Add a fetch wrapper in the new client:
```typescript
export const client = hc<AppType>("/api", {
  init: {
    // Custom init can be added here if needed
  },
});

// Or handle in each query wrapper with query parameter normalization
```

### Issue 2: FormData Handling
Current client skips Content-Type for FormData.

**Solution:** Hono's hc handles this automatically. No special handling needed.

### Issue 3: Error Response Parsing
Current client has sophisticated error parsing in `fetchJson`.

**Solution:** Create a wrapper function:
```typescript
async function handleResponse(res: Response) {
  if (!res.ok && res.status !== 207) {
    let errorMessage = `API Error [${res.status}]: ${res.statusText}`;
    try {
      const errorData = await res.json();
      // ... existing error parsing logic ...
    } catch { /* ignore */ }
    throw new Error(errorMessage);
  }
  return res.json();
}
```

### Issue 4: Query Invalidation Patterns
ts-rest's `initQueryClient` includes automatic query key generation.

**Solution:** Standardize query keys in the new hooks:
```typescript
// Define constants for query keys
export const QUERY_KEYS = {
  analytics: {
    platform: ["platform-analytics"] as const,
    stats: ["platform-stats"] as const,
  },
  users: {
    list: (cursor?: string) => ["admin_users", cursor] as const,
  },
  // ...
} as const;
```

---

## 8. Estimated Effort

| Task | Estimated Time |
|------|----------------|
| Backend AppType export | 30 minutes |
| New client setup | 1 hour |
| Query wrapper creation (all domains) | 4-6 hours |
| Component migration (26+ files) | 4-6 hours |
| Testing & validation | 2-3 hours |
| Cleanup & documentation | 1 hour |
| **Total** | **12-17 hours** |

---

## 9. Next Steps

1. **Review this plan** with the team to confirm approach
2. **Create a feature branch** for the migration
3. **Start with Phase 1-2** (backend export, new client setup)
4. **Build out query wrappers** domain by domain
5. **Migrate components** incrementally
6. **Test thoroughly** before removing legacy code
7. **Update documentation** and close out the migration

---

## Appendix: Hono hc() Reference

### Basic Usage
```typescript
import { hc } from "hono/client";
import type { AppType } from "./backend";

const client = hc<AppType>("http://localhost:8788");

// GET request
const res = await client.users.$get();
const users = await res.json();

// POST request
const res = await client.users.$post({
  json: { name: "John", email: "john@example.com" }
});

// Path parameters
const res = await client.users[":id"].$get({
  param: { id: "123" }
});

// Query parameters
const res = await client.users.$get({
  query: { limit: 10, offset: 0 }
});
```

### Integration with TanStack Query
```typescript
import { useQuery } from "@tanstack/react-query";

const useUsers = () => {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await client.users.$get();
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });
};
```
