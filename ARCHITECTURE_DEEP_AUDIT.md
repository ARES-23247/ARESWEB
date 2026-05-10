# ARES Web Portal - Architecture Deep Audit

**Date:** 2025-05-10
**Scope:** Full codebase architecture analysis
**Methodology:** Static analysis, dependency graph examination, pattern recognition

---

## Executive Summary

The ARES Web Portal demonstrates a **mature, well-structured monorepo architecture** with clear separation of concerns between frontend (`src/`) and backend (`functions/`). However, several architectural concerns require attention for long-term maintainability and scalability.

### Overall Health Score: 7.5/10

**Strengths:**
- Clear frontend/backend boundary
- Strong type safety via TypeScript and Zod
- Comprehensive test coverage (145 test files)
- Well-organized shared type definitions
- Consistent middleware patterns

**Critical Concerns:**
- Layer boundary violations in database access
- God object files (>1400 lines)
- Deep dependency chains reaching across boundaries
- Inconsistent handler patterns across routes

---

## 1. CIRCULAR DEPENDENCIES

### Severity: MEDIUM

### Analysis

**No direct circular dependencies detected**, but several **potential circular import risks** exist through deep directory traversal:

#### 1.1 Deep Schema Import Pattern
```typescript
// functions/api/routes/events/handlers.ts:17
import * as schema from "../../../../src/db/schema";

// functions/api/middleware/auth.ts:4
import * as schema from "../../../src/db/schema";
```

**Issue:** Routes import from `src/db/schema` (frontend database definitions) rather than using a shared abstraction layer.

**Impact:**
- Backend tightly coupled to frontend directory structure
- Difficult to extract backend as standalone service
- Violates dependency direction (backend should not import from frontend src)

**Occurrences:** 47+ files across `functions/api/routes/`

**Recommendation:**
```typescript
// Create shared/db/schema.ts that both import from
// functions/shared/db/schema.ts
export * from '../../src/db/schema'; // Delegate to canonical source

// Or move schema to shared/ directory entirely
```

---

## 2. LAYER VIOLATIONS

### Severity: HIGH

### 2.1 Database Layer Violations

**Problem:** Test factories in `src/test/factories/` directly import database schema:

```typescript
// src/test/factories/userFactory.ts
import * as schema from "../../db/schema";
```

**Issue:** Frontend test code has direct knowledge of database structure.

**Impact:**
- Tests couple implementation to storage details
- Frontend developers need database knowledge
- Cannot change schema without breaking frontend tests

**Affected Files:**
- `src/test/factories/userFactory.ts`
- `src/test/factories/systemFactory.ts`
- `src/test/factories/logisticsFactory.ts`
- `src/test/factories/eventFactory.ts`
- `src/test/factories/contentFactory.ts`

**Recommendation:**
```typescript
// Create test-specific abstractions
// src/test/factories/createMockUser.ts
import type { MockUser } from '../../test-types';

export function createMockUser(overrides?: Partial<MockUser>): MockUser {
  return {
    id: 'test-id',
    name: 'Test User',
    // ... no schema imports
  };
}
```

### 2.2 API Client Architecture (GOOD PATTERN)

**Positive Finding:** The API client layer properly isolates frontend from backend:

```typescript
// src/api/honoClient.ts - Proper boundary
import type { AppType } from "../../functions/api/[[route]]";

// src/api/events.ts - Type-safe wrappers
export function useGetEvents(id: string) {
  return useQuery<Event>({
    queryKey: ["events", id],
    queryFn: async () => {
      const response = await client.events.$get();
      return unwrapResponse<EventsResponse>(response);
    },
  });
}
```

This is the **correct pattern** - frontend should not know about database schemas.

---

## 3. GOD OBJECTS

### Severity: HIGH

### 3.1 Oversized Route Handlers

**Problem:** Several files exceed 1000 lines with multiple responsibilities:

1. **`functions/api/routes/events/handlers.ts` (1427 lines)**
   - Handles CRUD operations
   - Calendar synchronization
   - Social media dispatch
   - Zulip notifications
   - Cache invalidation
   - Recurring event logic

2. **`functions/api/routes/docs.ts` (1050 lines)**
   - Document CRUD
   - Search functionality
   - Revision history
   - Approval workflow
   - Feedback handling
   - Analytics tracking

3. **`functions/api/routes/posts/handlers.ts` (990 lines)**
   - Blog post management
   - Social syndication
   - History tracking
   - Content approval

**Impact:**
- Difficult to test individual concerns
- High cognitive load for maintenance
- Merge conflicts frequent
- Violates Single Responsibility Principle

**Recommendation:**
```typescript
// Split by concern
// functions/api/routes/events/
//   ├── handlers/
//   │   ├── create.ts
//   │   ├── update.ts
//   │   ├── delete.ts
//   │   └── list.ts
//   ├── integrations/
//   │   ├── gcalSync.ts
//   │   ├── socialDispatch.ts
//   │   └── zulipNotify.ts
//   └── index.ts (orchestrator)
```

### 3.2 Large Frontend Components

**Problem:** Several simulation components exceed 800 lines:

1. **`src/sims/battleship/index.tsx` (855 lines)**
2. **`src/sims/risk/index.tsx` (841 lines)**
3. **`src/sims/bee/index.tsx` (827 lines)**

**Impact:**
- Game logic mixed with UI rendering
- Difficult to test game rules independently
- Reusability limited

**Recommendation:**
```typescript
// Separate concerns
// src/sims/battleship/
//   ├── hooks/
//   │   ├── useGameState.ts
//   │   └── useShipPlacement.ts
//   ├── components/
//   │   ├── GameBoard.tsx
//   │   └── ShipPicker.tsx
//   ├── game/
//   │   ├── rules.ts
//   │   └── ai.ts
//   └── index.tsx (composition)
```

---

## 4. TIGHT COUPLING

### Severity: MEDIUM

### 4.1 Middleware Coupling

**Problem:** Route handlers tightly coupled to specific middleware implementations:

```typescript
// functions/api/routes/analytics.ts:9
import { AppEnv, ensureAuth, ensureAdmin, rateLimitMiddleware, 
         turnstileMiddleware, getDbSettings, checkPersistentRateLimit, 
         getDb } from "../middleware";
```

**Impact:**
- Difficult to swap middleware implementations
- Testing requires mocking entire middleware stack
- Changes to middleware propagate to all routes

**Recommendation:**
```typescript
// Create middleware facades
// functions/api/middleware/facades.ts
export interface AdminEndpoint {
  checkAuth: (c: Context) => Promise<void>;
  checkRateLimit: (c: Context) => Promise<boolean>;
}

// Routes depend on interface, not implementation
```

### 4.2 Utility Function Dependencies

**Problem:** Utils deeply coupled to database schema:

```typescript
// functions/utils/socialSync.ts:17
import * as schema from "../../src/db/schema";
import { SocialQueuePost } from "../../shared/routes/socialQueue";
```

**Issue:** Social sync utility knows about both database schema AND route schemas.

**Recommendation:**
```typescript
// Define domain models in shared/
// shared/models/SocialPost.ts
export interface SocialPost {
  id: string;
  title: string;
  url: string;
  // ... no database or routing concerns
}
```

---

## 5. DEPENDENCY DIRECTION VIOLATIONS

### Severity: HIGH

### 5.1 Backend → Frontend Dependencies

**Critical Issue:** Backend code imports from frontend `src/` directory:

```typescript
// Multiple files in functions/api/routes/
import * as schema from "../../../../src/db/schema";
```

**Dependency Flow (WRONG):**
```
functions/api/routes → src/db/schema
     ↓                        ↑
   Backend                 Frontend
```

**Correct Flow Should Be:**
```
functions/api/routes → shared/db/schema
     ↓                        ↑
   Backend                 Shared
```

**Affected Modules:**
- All route handlers (30+ files)
- Middleware (auth.ts, db.ts, security.ts, utils.ts)
- Utility functions (socialSync.ts, notifications.ts, postHistory.ts)

**Recommendation:**
```
Repository Root
├── shared/
│   └── db/
│       ├── schema.ts         # Move from src/db/schema.ts
│       ├── types.ts          # Move from src/db/types.ts
│       └── query-helpers.ts  # Move from src/db/query-helpers.ts
├── src/
│   └── (no database code)
└── functions/
    └── (imports from shared/db)
```

### 5.2 Shared Type Pollution

**Good Pattern:** Proper use of shared types:

```typescript
// shared/routes/events.ts
export const eventResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  // ...
});

// Both backend and frontend import from @shared/routes/events
```

This is the **correct approach** - shared contracts prevent duplication.

---

## 6. ABSTRACTION LEVELS

### Severity: MEDIUM

### 6.1 Mixed Abstraction Levels in Handlers

**Problem:** Handlers mix high-level orchestration with low-level details:

```typescript
// functions/api/routes/posts/handlers.ts (example pattern)
export const postHandlers = {
  getPosts: async (input, c) => {
    const db = getDb(c);              // Low-level
    const { limit = 10, offset = 0 } = input.query; // High-level
    const cleanQ = sanitizeFtsQuery(String(q || "")); // Low-level
    // ... mixed concerns
  }
}
```

**Recommendation:**
```typescript
// Separate concerns
// functions/api/routes/posts/service.ts
export class PostService {
  async findAll(pagination: PaginationParams): Promise<Post[]> {
    // High-level business logic
  }
}

// functions/api/routes/posts/repository.ts
export class PostRepository {
  async search(query: string, limit: number): Promise<DbPost[]> {
    // Low-level data access
  }
}
```

### 6.2 Query Helpers (GOOD PATTERN)

**Positive Finding:** `src/db/query-helpers.ts` properly abstracts complex joins:

```typescript
// src/db/query-helpers.ts
export const queryHelpers = {
  getEventSignups: async (db: DrizzleDB, eventId: string, userId?: string) => {
    // Encapsulates join logic
  }
}
```

This is the **correct abstraction level** for data access.

---

## 7. DRY VIOLATIONS

### Severity: LOW

### 7.1 Repeated Handler Patterns

**Observation:** Similar patterns repeated across routes:

```typescript
// Pattern appears in 20+ files
export const xxxRouter = new OpenAPIHono<AppEnv>();
xxxRouter.use("*", ensureAdmin);
xxxRouter.openapi(createRoute({...}), async (c) => {
  const db = getDb(c);
  // ... handler
});
```

**Recommendation:**
```typescript
// functions/api/routes/crudFactory.ts
export function createCrudRouter<T>({
  resource,
  schema,
  permissions,
}: CrudConfig<T>) {
  const router = new OpenAPIHono<AppEnv>();
  // Generate standard CRUD endpoints
  return router;
}

// Usage
export const awardsRouter = createCrudRouter({
  resource: 'awards',
  schema: awardSchema,
  permissions: { read: 'public', write: 'admin' }
});
```

### 7.2 Test Setup Duplication

**Observation:** Test files repeat similar setup:

```typescript
// Appears in 80+ test files
const testEnv = createTestEnv({...});
const mockDb = createMockDb();
```

**Current State:** Partially addressed by `functions/test/test-env.ts`

**Recommendation:** Expand test utilities further for common scenarios.

---

## 8. ARCHITECTURAL PATTERNS

### 8.1 Current Patterns

| Pattern | Status | Notes |
|---------|--------|-------|
| Repository | ❌ Missing | Direct DB access in handlers |
| Service Layer | ❌ Missing | Business logic in handlers |
| Factory | ✅ Partial | Test factories exist |
| Strategy | ❌ Missing | Hardcoded auth rules |
| Observer | ✅ Partial | Event lifecycle hooks |
| Command | ✅ Partial | Handler-v2 utilities |

### 8.2 Recommended Patterns

**Implement Service Layer:**
```typescript
// functions/api/services/EventService.ts
export class EventService {
  constructor(
    private db: DrizzleDB,
    private notifications: NotificationService,
    private cache: CacheService
  ) {}

  async create(input: CreateEventInput): Promise<Event> {
    // Business rules
    // Validation
    // Orchestration
  }
}
```

**Implement Repository Pattern:**
```typescript
// functions/api/repositories/EventRepository.ts
export class EventRepository {
  async findById(id: string): Promise<Event | null> {
    // Pure data access
  }

  async save(event: Event): Promise<void> {
    // Pure persistence
  }
}
```

---

## 9. MODULE BOUNDARIES

### 9.1 Current Boundaries

```
┌─────────────────────────────────────────────────────────┐
│                       Repository                         │
├───────────────┬───────────────────┬─────────────────────┤
│     src/      │     functions/    │      shared/        │
│   (Frontend)  │     (Backend)     │    (Contracts)      │
├───────────────┼───────────────────┼─────────────────────┤
│ • Components  │ • API Routes      │ • Type Definitions  │
│ • API Clients │ • Middleware      │ • Zod Schemas       │
│ • Hooks       │ • Utilities       │ • Route Schemas     │
│ • Store       │ • Handlers        │                     │
│ ❌ DB Schema  │ ❌ Imports src/   │                     │
└───────────────┴───────────────────┴─────────────────────┘
```

### 9.2 Recommended Boundaries

```
┌─────────────────────────────────────────────────────────┐
│                       Repository                         │
├───────────────┬───────────────────┬─────────────────────┤
│     src/      │     functions/    │      shared/        │
│   (Frontend)  │     (Backend)     │    (Contracts)      │
├───────────────┼───────────────────┼─────────────────────┤
│ • Components  │ • API Routes      │ • Type Definitions  │
│ • API Clients │ • Services        │ • Zod Schemas       │
│ • Hooks       │ • Repositories    │ • Route Schemas     │
│ • Store       │ • Handlers        │ • DB Schema ← Move  │
│ • View Models │ • Middleware      │ • Domain Models     │
│               │ • Utilities       │                     │
└───────────────┴───────────────────┴─────────────────────┘

Dependency Rules:
✅ functions → shared (allowed)
✅ src → shared (allowed)
✅ src → functions (for types only, via @shared)
❌ functions → src (FORBIDDEN)
❌ shared → src or functions (FORBIDDEN)
```

---

## 10. PRIORITIZED RECOMMENDATIONS

### Phase 1: Critical (Immediate Action)

1. **Move Database Schema to Shared**
   - Move `src/db/schema.ts` → `shared/db/schema.ts`
   - Update all imports
   - **Effort:** 2-3 days
   - **Impact:** Eliminates backend→frontend dependency

2. **Extract Route Handlers**
   - Split `events/handlers.ts` (1427 lines) into focused modules
   - Split `docs.ts` (1050 lines) into CRUD + workflow
   - **Effort:** 1 week
   - **Impact:** Improved maintainability, testability

### Phase 2: High Priority (Within 1 Month)

3. **Implement Service Layer**
   - Create `functions/api/services/` directory
   - Extract business logic from handlers
   - **Effort:** 2 weeks
   - **Impact:** Better testability, reusability

4. **Create Repository Pattern**
   - Create `functions/api/repositories/` directory
   - Abstract data access
   - **Effort:** 1 week
   - **Impact:** Easier to swap ORMs, test

### Phase 3: Medium Priority (Within 3 Months)

5. **Refactor Large Components**
   - Split simulation components (>800 lines)
   - Extract game logic to pure functions
   - **Effort:** 2 weeks
   - **Impact:** Better testing, reusability

6. **Create CRUD Factory**
   - Reduce duplicate handler code
   - Standardize route patterns
   - **Effort:** 1 week
   - **Impact:** Faster feature development

### Phase 4: Low Priority (Technical Debt)

7. **Implement Middleware Facades**
   - Decouple routes from middleware implementations
   - **Effort:** 1 week
   - **Impact:** Easier testing, swapping

8. **Extract Domain Models**
   - Create `shared/models/` directory
   - Remove DB concerns from business logic
   - **Effort:** 2 weeks
   - **Impact:** Cleaner separation of concerns

---

## 11. TESTING ARCHITECTURE

### Current State

**Strengths:**
- 145 test files (87 in functions, 58 in src)
- Test utilities in `functions/test/test-env.ts`
- Mock factories for test data

**Concerns:**

1. **Test Factory Coupling**
   - Frontend tests directly import DB schema
   - Should use domain models instead

2. **Test File Size**
   - Some test files exceed 1000 lines
   - `githubWebhook.test.ts` (1023 lines)
   - `docs.test.ts` (971 lines)

3. **Test Skips**
   - Several tests skipped due to complex mocking
   - Indicates tight coupling to implementation

**Recommendations:**
```typescript
// Create test-specific abstractions
// src/test/fixtures/createEvent.ts
import type { TestEvent } from '../test-types';

export function createTestEvent(overrides?: Partial<TestEvent>): TestEvent {
  return {
    id: 'test-event-id',
    title: 'Test Event',
    // ... no schema imports
  };
}
```

---

## 12. SECURITY ARCHITECTURE

### Positive Findings

1. **Zero Trust Implementation**
   - Proper authentication checks via `ensureAuth`, `ensureAdmin`
   - Development bypass properly secured
   - Rate limiting with circuit breaker

2. **Input Validation**
   - Zod schemas for all API inputs
   - Content-Type validation middleware
   - Turnstile integration for bots

3. **Audit Logging**
   - Comprehensive audit trail
   - Security event logging

### Concerns

1. **Schema Exposure**
   - Frontend tests import DB schema
   - Potential information disclosure

2. **Mixed Auth Patterns**
   - Some routes use `ensureAuth`, others use `getSessionUser`
   - Inconsistent authorization checks

---

## 13. PERFORMANCE CONSIDERATIONS

### Database Access

**Current:** Direct queries in handlers

**Impact:**
- N+1 query risks
- Difficult to optimize queries
- No query reuse

**Recommendation:**
```typescript
// Repository pattern enables query optimization
class EventRepository {
  private cache = new Map();

  async findByIdWithCache(id: string) {
    if (this.cache.has(id)) {
      return this.cache.get(id);
    }
    const result = await this.findById(id);
    this.cache.set(id, result);
    return result;
  }
}
```

### Bundle Size

**Current:** Large components in bundle

**Recommendation:**
- Code splitting for simulations
- Lazy loading for editors
- Tree-shake unused utilities

---

## 14. CONCLUSION

The ARES Web Portal demonstrates **strong architectural foundations** with proper type safety, comprehensive testing, and clear separation between frontend and backend concerns. However, **critical dependency direction violations** and **god object files** pose risks to long-term maintainability.

### Key Takeaways

1. **Immediate Action Required:** Move database schema to shared location
2. **High Priority:** Split oversized handler files
3. **Medium Priority:** Implement service and repository layers
4. **Low Priority:** Refactor large components, create CRUD factory

### Overall Assessment

The architecture is **functional and well-organized** but requires **refactoring to address technical debt** before scaling becomes problematic. The recommended changes will improve maintainability, testability, and prepare the codebase for future growth.

---

**Audit Completed:** 2025-05-10
**Next Review:** After Phase 1 completion
**Auditor:** Architecture Analysis Tool
