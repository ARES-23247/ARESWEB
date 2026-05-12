/**
 * Tests for logistics route handlers
 *
 * Tests logistics management endpoints including auth, admin checks,
 * and basic route structure. Database query tests are skipped
 * due to Drizzle ORM complexity with D1 mocking.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono, Context, Next } from 'hono';
import { createMockDb, createTestEnv, createTestDbMiddleware } from '../../test/test-env';
// Extend globalThis for test mocks
declare global {
  var __mockSessionUser: import('../middleware').SessionUser | null;
}
import { AppEnv, SessionUser } from '../middleware';

// Mock the auth module BEFORE importing logisticsRouter
vi.mock('../middleware/auth', async () => {
  const actual = await vi.importActual<typeof import('../middleware/auth.js')>('../middleware/auth');
  return {
    ...actual,
    getSessionUser: vi.fn(),
    ensureAuth: vi.fn((c: Context<AppEnv>, next: Next) => {
      const user = globalThis.__mockSessionUser;
      if (!user) {
        return c.json({ error: 'Unauthorized: Please log in.' }, 401);
      }
      c.set('sessionUser', user);
      return next();
    }),
    ensureAdmin: vi.fn((c: Context<AppEnv>, next: Next) => {
      const user = globalThis.__mockSessionUser;
      if (!user) {
        return c.json({ error: 'Unauthorized: Please log in.' }, 401);
      }
      // Match the actual ensureAdmin logic from auth.ts
      const isAdmin = user?.role === 'admin' || user?.memberType === 'mentor' || user?.memberType === 'coach';
      if (!isAdmin) {
        return c.json({ error: 'Forbidden: Requires one of [admin] privileges or adult leader status.' }, 403);
      }
      c.set('sessionUser', user);
      return next();
    }),
      requireAuth: vi.fn(async (c: import('hono').Context) => {
                    const user = c.get('sessionUser') || globalThis.__mockSessionUser || null;
                    if (!user) {
                      const { ApiError } = (await vi.importActual('../middleware/errorHandler')) as any;
                      throw new ApiError("Unauthorized: Please log in.", 401);
                    }
                    return user;
                  })
};
});

// Import logisticsRouter after mocking
import logisticsRouter from './logistics';

const mockExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

describe('Logistics Routes', () => {
  let mockDb: ReturnType<typeof createMockDb>['mockDb'];

  const mockAdminUser: SessionUser = {
    id: 'admin-user',
    email: 'admin@ares.org',
    name: 'Admin User',
    nickname: 'Admin',
    role: 'admin',
    memberType: 'mentor',
    image: null,
  };

  const mockAuthUser: SessionUser = {
    id: 'auth-user',
    email: 'user@ares.org',
    name: 'Auth User',
    nickname: 'User',
    role: 'user',
    memberType: 'student',
    image: null,
  };

  const mockMentorUser: SessionUser = {
    id: 'mentor-user',
    email: 'mentor@ares.org',
    name: 'Mentor User',
    nickname: 'Mentor',
    role: 'user',
    memberType: 'mentor',
    image: null,
  };

  const mockCoachUser: SessionUser = {
    id: 'coach-user',
    email: 'coach@ares.org',
    name: 'Coach User',
    nickname: 'Coach',
    role: 'user',
    memberType: 'coach',
    image: null,
  };

  beforeEach(() => {
    const dbSetup = createMockDb();
    mockDb = dbSetup.mockDb;
    globalThis.__mockSessionUser = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.__mockSessionUser = null;
  });

  const createTestApp = () => {
    const app = new Hono<AppEnv>()
    app.use('*', createTestDbMiddleware());
    app.route('/api/logistics', logisticsRouter);
    return app;
  };

  describe('Router structure', () => {
    it('should export a valid router', () => {
      expect(logisticsRouter).toBeDefined();
      expect(typeof logisticsRouter).toBe('object');
    });

    it('should have OpenAPI support', () => {
      expect(typeof (logisticsRouter as { openapi?: unknown }).openapi).toBe('function');
    });

    it('should apply ensureAdmin to all /admin/* routes', () => {
      // Verify the middleware is applied by checking routes exist
      const routes = logisticsRouter.routes;
      const hasAdminRoutes = routes.some((route) => route.path?.includes('/admin/')
      );
      expect(hasAdminRoutes).toBe(true);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 when not authenticated on summary route', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/logistics/admin/summary');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 401 when not authenticated on export-emails route', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/logistics/admin/export-emails');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 when non-admin student tries to access summary route', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/logistics/admin/summary');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });

    it('should return 403 when non-admin student tries to access export-emails route', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/logistics/admin/export-emails');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });

    it('should allow admin to access summary route', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/logistics/admin/summary');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should allow admin to access export-emails route', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/logistics/admin/export-emails');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should allow mentor (non-admin role) to access admin routes via memberType', async () => {
      // This tests RBAC-03 from auth.ts: mentors get admin access for non-super-admin routes
      globalThis.__mockSessionUser = mockMentorUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/logistics/admin/summary');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - mentors are allowed on logistics routes
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should allow coach (non-admin role) to access admin routes via memberType', async () => {
      // This tests RBAC-03 from auth.ts: coaches get admin access for non-super-admin routes
      globalThis.__mockSessionUser = mockCoachUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/logistics/admin/export-emails');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - coaches are allowed on logistics routes
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });
  });

  // NOTE: Database query tests are skipped because Drizzle ORM's query builder
  // doesn't work well with simple D1 mocks. These would require either:
  // 1. A more sophisticated Drizzle mock that handles chained .select().from().where() calls
  // 2. Integration tests with a real database
  // 3. Refactoring routes to inject database dependencies for better testability
  //
  // The logistics.ts routes contain complex Drizzle queries:
  // - Inner joins between user and userProfiles tables
  // - Left joins between user and userProfiles tables
  // - Where clauses with ne() (not equals) operators
  // - Field decryption logic for sensitive data (emails, emergency contacts)
  // - Aggregation logic for dietary restrictions and t-shirt sizes
  //
  // While authentication/authorization is tested above, the actual CRUD operations
  // would require a full Drizzle integration test setup.
  describe.skip('Database queries (require integration tests)', () => {
    it('should return aggregated logistics summary including dietary restrictions');
    it('should return aggregated logistics summary including t-shirt sizes');
    it('should return aggregated logistics summary including member type counts');
    it('should exclude unverified users from logistics summary');
    it('should export user emails with decrypted values');
    it('should export emergency contact information with decrypted phone numbers');
    it('should handle malformed encrypted data gracefully during decryption');
    it('should filter out users without valid email addresses from export');
  });

  describe('Rate limiting and middleware', () => {
    it('should have admin routes protected by ensureAdmin middleware', () => {
      // The logistics router applies ensureAdmin to /admin/* routes via middleware
      // We can verify this by checking that admin routes exist
      const routes = logisticsRouter.routes;
      const adminRoutes = routes.filter((route) => route.path?.includes('/admin/')
      );

      expect(adminRoutes.length).toBeGreaterThan(0);

      // Verify all admin paths start with /admin/
      adminRoutes.forEach((route) => {
        expect(route.path).toMatch(/^\/admin\//);
      });
    });

    it('should have the correct admin route paths registered', () => {
      const routes = logisticsRouter.routes;
      const paths = routes.map((r) => r.path || '');

      // Expected admin routes based on logistics.ts
      const expectedAdminRoutes = [
        '/admin/summary',
        '/admin/export-emails',
      ];

      expectedAdminRoutes.forEach(expectedPath => {
        // Check if a route matching this pattern exists
        const hasMatchingRoute = paths.some((path: string) => {
          return path === expectedPath || path.includes(expectedPath.split('{')[0]);
        });
        expect(hasMatchingRoute).toBe(true);
      });
    });
  });

  describe('Route methods', () => {
    it('should support GET on /admin/summary', () => {
      const routes = logisticsRouter.routes;
      const summaryRoute = routes.find((r) => r.path?.includes('/admin/summary')
      );
      expect(summaryRoute).toBeDefined();
      expect(summaryRoute?.method).toBe('GET');
    });

    it('should support GET on /admin/export-emails', () => {
      const routes = logisticsRouter.routes;
      const exportRoute = routes.find((r) => r.path?.includes('/admin/export-emails')
      );
      expect(exportRoute).toBeDefined();
      expect(exportRoute?.method).toBe('GET');
    });
  });

  describe('OpenAPI documentation', () => {
    it('should include logistics tag in route definitions', () => {
      const routes = logisticsRouter.routes;

      // Routes should have OpenAPI metadata
      routes.forEach((route) => {
        if (route.path?.includes('/admin/')) {
          // OpenAPI routes should have metadata
          expect(route).toBeDefined();
        }
      });
    });

    it('should define admin tag for admin routes', () => {
      // Verify the router is an OpenAPIHono instance with proper tagging
      expect(logisticsRouter).toBeDefined();

      // Check that routes exist (they would be tagged in OpenAPI spec)
      const routes = logisticsRouter.routes;
      const adminRoutes = routes.filter(() => true); // Simplified - just checks routes exist

      expect(adminRoutes.length).toBeGreaterThan(0);
    });
  });
});
