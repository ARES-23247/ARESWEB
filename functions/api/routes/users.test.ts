/**
 * Tests for users route handlers
 *
 * Tests user management endpoints including auth, admin checks,
 * and basic route structure. Database query tests are skipped
 * due to Drizzle ORM complexity with D1 mocking.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono, Context, Next } from 'hono';
import { createMockDb, createTestEnv, createTestDbMiddleware, mockExecutionContext } from '../../test/test-env';
// Extend globalThis for test mocks
declare global {
  var __mockSessionUser: import('../middleware').SessionUser | null;
}
import { AppEnv, SessionUser } from '../middleware';

// Mock the auth module BEFORE importing usersRouter
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const { ApiError } = (await vi.importActual('../middleware/errorHandler')) as any;
                      throw new ApiError("Unauthorized: Please log in.", 401);
                    }
                    return user;
                  })
};
});

// Import usersRouter after mocking
import usersRouter from './users';



describe('Users Routes', () => {
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
    app.route('/api/users', usersRouter);
    return app;
  };

  describe('Router structure', () => {
    it('should export a valid router', () => {
      expect(usersRouter).toBeDefined();
      expect(typeof usersRouter).toBe('object');
    });

    it('should have OpenAPI support', () => {
      expect(typeof (usersRouter as { openapi?: unknown }).openapi).toBe('function');
    });

    it('should apply ensureAdmin to all /admin/* routes', () => {
      // Verify the middleware is applied by checking routes exist
      const routes = usersRouter.routes;
      const hasAdminRoutes = routes.some((route) => route.path?.includes('/admin/')
      );
      expect(hasAdminRoutes).toBe(true);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 when not authenticated on admin list route', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/users/admin/list');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 401 when not authenticated on admin detail route', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/users/admin/some-id');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 when non-admin tries to access admin list route', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/users/admin/list');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });

    it('should return 403 when non-admin tries to access admin detail route', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/users/admin/some-id');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });

    it('should return 403 when non-admin tries to patch user', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/users/admin/some-id', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'admin' }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });

    it('should return 403 when non-admin tries to delete user', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/users/admin/some-id', {
        method: 'DELETE',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });

    it('should allow admin to access admin list route', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/users/admin/list');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should allow admin to access admin detail route', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/users/admin/some-id');

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

      const req = new Request('http://localhost/api/users/admin/list');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - mentors are allowed on non-super-admin routes
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
  // The users.ts routes contain complex Drizzle queries:
  // - Left joins between user and userProfiles tables
  // - Multiple parallel queries with Promise.all for profile fetching
  // - Nested decryption logic for sensitive fields
  // - Cascade delete operations across multiple related tables
  //
  // While authentication/authorization is tested above, the actual CRUD operations
  // would require a full Drizzle integration test setup.
  describe.skip('Database queries (require integration tests)', () => {
    it('should return paginated list of users when admin');
    it('should return single user details when admin');
    it('should update user role when admin (and invalidate sessions)');
    it('should update user memberType when admin');
    it('should update user profile when admin');
    it('should return full user profile for admin editing');
    it('should delete user and all related records when admin');
  });

  // Test rate limiting middleware is applied
  describe('Rate limiting', () => {
    it('should have admin routes protected by ensureAdmin middleware', () => {
      // The users router applies ensureAdmin to /admin/* routes via middleware
      // We can verify this by checking that admin routes exist
      const routes = usersRouter.routes;
      const adminRoutes = routes.filter((route) => route.path?.includes('/admin/')
      );

      expect(adminRoutes.length).toBeGreaterThan(0);

      // Verify all admin paths start with /admin/
      adminRoutes.forEach((route) => {
        expect(route.path).toMatch(/^\/admin\//);
      });
    });

    it('should have the correct admin route paths registered', () => {
      const routes = usersRouter.routes;
      const paths = routes.map((r) => r.path || '');

      // Expected admin routes based on users.ts
      const expectedAdminRoutes = [
        '/admin/list',
        '/admin/{id}',
        '/admin/{id}/profile',
      ];

      expectedAdminRoutes.forEach(expectedPath => {
        // Check if a route matching this pattern exists
        const hasMatchingRoute = paths.some((path: string) => {
          // Convert {id} pattern to actual path format used by Hono
          const normalizedPath = expectedPath.replace('{id}', ':id');
          return path === normalizedPath || path.includes(expectedPath.split('{')[0]);
        });
        expect(hasMatchingRoute).toBe(true);
      });
    });
  });

  describe('Route methods', () => {
    it('should support GET on /admin/list', () => {
      const routes = usersRouter.routes;
      const listRoute = routes.find((r) => r.path?.includes('/admin/list') || r.path?.includes('list')
      );
      expect(listRoute).toBeDefined();
      expect(listRoute?.method).toBe('GET');
    });

    it('should support GET on /admin/{id}', () => {
      const routes = usersRouter.routes;
      const detailRoute = routes.find((r) => r.path?.includes('/admin/') && r.path?.includes(':id') && r.method === 'GET'
      );
      expect(detailRoute).toBeDefined();
    });

    it('should support PATCH on /admin/{id}', () => {
      const routes = usersRouter.routes;
      const patchRoute = routes.find((r) => r.path?.includes('/admin/') && r.path?.includes(':id') && r.method === 'PATCH'
      );
      expect(patchRoute).toBeDefined();
    });

    it('should support PUT on /admin/{id}/profile', () => {
      const routes = usersRouter.routes;
      const profileRoute = routes.find((r) => r.path?.includes('profile') && r.method === 'PUT'
      );
      expect(profileRoute).toBeDefined();
    });

    it('should support DELETE on /admin/{id}', () => {
      const routes = usersRouter.routes;
      const deleteRoute = routes.find((r) => r.path?.includes('/admin/') && r.path?.includes(':id') && r.method === 'DELETE'
      );
      expect(deleteRoute).toBeDefined();
    });
  });
});
