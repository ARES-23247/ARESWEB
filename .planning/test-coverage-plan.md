# ARES Web Portal - Test Coverage Enhancement Plan

## Executive Summary

After the Hono/Zod/Drizzle migration, the codebase has solid middleware and utility test coverage, but significant gaps remain in:
1. **Backend API route handlers** - Only 2 integration tests exist for 30+ route files
2. **Database integration** - No D1/Drizzle integration tests
3. **E2E testing** - Heavy local setup burden, should shift to remote testing

This plan outlines a phased approach to fill these gaps while reducing developer friction.

---

## Current State Analysis

### ✅ Well Covered

| Area | Coverage | Notes |
|------|----------|-------|
| Middleware (security, cache, env, error, lifecycle) | High | All 5 middleware files tested |
| Utils (auth, crypto, email, IRV, etc.) | High | Most utility functions have tests |
| Frontend hooks (useSimulationChat, useDocs, etc.) | High | 116 test files, 1886 tests passing |
| E2E (Playwright) | Exists | 40+ E2E test files exist |

### ❌ Coverage Gaps

| Area | Current | Target | Priority |
|------|---------|--------|----------|
| **API Route Handlers** | 2 files / 30+ routes | 80% coverage | HIGH |
| **Database Integration** | 0 tests | Critical paths covered | HIGH |
| **typedHandler Pattern** | 0 tests | All typed handlers tested | MED |
| **Zod Validation** | Indirect (via E2E) | Direct unit tests | MED |

---

## Phase 1: Backend Unit & Integration Tests

### 1.1 Route Handler Test Pattern

Create a reusable test helper for Hono routes:

```typescript
// functions/api/test-helpers/test-route.ts
import { Hono } from 'hono';
import { hc } from 'hono/client';

export async function testRoute<T extends Hono>(
  app: T,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  path: string,
  options: {
    body?: unknown;
    headers?: Record<string, string>;
    env?: Partial<AppEnv['Bindings']>;
    user?: { id: string; email: string; role: string };
  }
) {
  // Mock D1, KV, R2, auth context
  // Create request with proper headers
  // Return response for assertions
}
```

### 1.2 Priority Routes to Test (in order)

| Route | Reason | Test Focus |
|-------|--------|------------|
| `/api/auth/*` | Security critical | Auth flows, token validation, zero-trust headers |
| `/api/tasks` | High usage | CRUD operations, permissions |
| `/api/profiles` | User data | Validation, updates, privacy |
| `/api/simulations` | Complex logic | State management, AI integration |
| `/api/ai/*` | External deps | Error handling, rate limiting |
| `/api/admin/*` | Privileged ops | Authorization, audit logging |

### 1.3 Test Categories per Route

Each route test should cover:

1. **Happy Path** - Valid request succeeds
2. **Validation** - Invalid input rejected (Zod schemas)
3. **Authentication** - Unauthenticated requests blocked
4. **Authorization** - Unauthorized users blocked
5. **Error Cases** - Database errors, network failures
6. **Edge Cases** - Empty results, pagination, rate limits

### 1.4 Database Mocking Strategy

**Option A: Mock Drizzle (for unit tests)**
```typescript
vi.mock('drizzle-orm', () => ({
  // Reuse existing setup from src/test/setup.ts
}));
```

**Option B: In-memory D1 (for integration)**
Use `@cloudflare/vitest-pool-workers` for real D1 testing (future consideration)

---

## Phase 2: Deployed Preview E2E Strategy

### 2.1 Current State

- 40+ E2E test files in `tests/e2e/`
- Local testing requires: build + dev server + full environment
- Remote config exists (`playwright.remote.config.ts`) but underutilized

### 2.2 Remote-First Testing Workflow

```bash
# Development: Use remote for quick feedback
PREVIEW_URL=https://aresweb.pages.dev npm run test:e2e:remote

# PR Preview: Test against exact PR build
PREVIEW_URL=https://pr-123-branch.pages.dev npm run test:e2e:remote

# CI: Test against staging before prod
npm run test:e2e:remote  # Uses PREVIEW_URL from CI env
```

### 2.3 E2E Test Categories

| Category | Focus | Remote |
|----------|-------|--------|
| **Smoke** | Core paths work | ✅ Ideal |
| **Critical Paths** | Login, create task, save profile | ✅ Ideal |
| **Admin Features** | Protected routes, bulk operations | ⚠️ Needs test env |
| **Webhooks** | GitHub webhook processing | ❌ Requires request bin |
| **AI Features** | Simulation chat, code gen | ✅ Real environment |

### 2.4 Test Environment Setup

Create dedicated preview environments:

```yaml
# .github/workflows/e2e-remote.yml
test-e2e-remote:
  runs-on: ubuntu-latest
  steps:
    - name: Deploy to preview
      run: npx wrangler pages deploy dist --project-name aresweb-pr-${{ pr.number }}
    - name: Run E2E against preview
      env:
        PREVIEW_URL: https://aresweb-pr-${{ pr.number }}.pages.dev
      run: npm run test:e2e:remote
```

---

## Phase 3: Test Infrastructure Improvements

### 3.1 Shared Test Utilities

Create reusable test helpers:

```
functions/api/test-helpers/
├── test-route.ts       # Generic route tester
├── mock-d1.ts          # D1 database mocks
├── mock-auth.ts        # Auth context helpers
├── mock-env.ts         # Cloudflare env mocks
└── fixtures/
    ├── users.ts        # Test user data
    └── data.ts         # Common test data
```

### 3.2 Test Data Management

```typescript
// Fixtures with deterministic data
export const testUsers = {
  admin: { id: 'admin-1', email: 'admin@ares.test', role: 'admin' },
  member: { id: 'member-1', email: 'member@ares.test', role: 'member' },
  guest: { id: 'guest-1', email: 'guest@ares.test', role: 'guest' },
};
```

### 3.3 CI/CD Integration

```yaml
# .github/workflows/test-suite.yml
test:
  strategy:
    matrix:
      suite: [unit, backend-integration, e2e-smoke, e2e-full]
  steps:
    - run: npm run test:${{ matrix.suite }}
```

---

## Implementation Roadmap

### Week 1: Foundation
- [ ] Create test helper utilities
- [ ] Add example route test (auth.ts)
- [ ] Document testing patterns

### Week 2-3: Critical Routes
- [ ] Test `/api/auth/*` routes
- [ ] Test `/api/tasks` routes
- [ ] Test `/api/profiles` routes

### Week 4: Remote E2E
- [ ] Configure CI for remote testing
- [ ] Migrate smoke tests to remote-first
- [ ] Add PR comment with test results

### Week 5+: Coverage Expansion
- [ ] Test remaining high-priority routes
- [ ] Add D1 integration tests
- [ ] Expand E2E coverage

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Backend route test files | 2 | 25+ |
| Unit test coverage (functions/) | ~40% | 80% |
| E2E tests running remotely | 0% | 80% |
| Local E2E test time | 10+ min | <2 min (smoke) |
| CI feedback time | 15+ min | <5 min (remote E2E) |

---

## Open Questions

1. **D1 Integration Testing**: Should we use `@cloudflare/vitest-pool-workers` for real database tests, or stick with mocks?

2. **Test Data**: How do we handle test data isolation? Can we use a dedicated D1 database for testing?

3. **Webhook Testing**: For GitHub webhooks, should we build a test harness or rely on E2E with real webhooks?

4. **AI Features**: How do we test AI-powered endpoints without hitting real APIs or consuming quota?
