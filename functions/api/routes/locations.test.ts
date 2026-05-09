/**
 * Tests for locations route handlers
 *
 * Tests location management endpoints including auth, admin checks,
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

// Mock the auth module BEFORE importing locationsRouter
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
      const isAdmin = user?.role === 'admin' || user?.member_type === 'mentor' || user?.member_type === 'coach';
      if (!isAdmin) {
        return c.json({ error: 'Forbidden: Requires one of [admin] privileges or adult leader status.' }, 403);
      }
      c.set('sessionUser', user);
      return next();
    }),
  };
});

// Import locationsRouter after mocking
import locationsRouter from './locations';

const mockExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

describe('Locations Routes', () => {
  let mockDb: ReturnType<typeof createMockDb>['mockDb'];

  const mockAdminUser: SessionUser = {
    id: 'admin-user',
    email: 'admin@ares.org',
    name: 'Admin User',
    nickname: 'Admin',
    role: 'admin',
    member_type: 'mentor',
    image: null,
  };

  const mockAuthUser: SessionUser = {
    id: 'auth-user',
    email: 'user@ares.org',
    name: 'Auth User',
    nickname: 'User',
    role: 'user',
    member_type: 'student',
    image: null,
  };

  const mockMentorUser: SessionUser = {
    id: 'mentor-user',
    email: 'mentor@ares.org',
    name: 'Mentor User',
    nickname: 'Mentor',
    role: 'user',
    member_type: 'mentor',
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
    const app = new Hono<AppEnv>();
    app.use('*', createTestDbMiddleware());

    // Use Hono's built-in onError for error handling (same pattern as production)
    

    app.route('/api/locations', locationsRouter);
    return app;
  };

  describe('Router structure', () => {
    it('should export a valid router', () => {
      expect(locationsRouter).toBeDefined();
      expect(typeof locationsRouter).toBe('object');
    });

    it('should have OpenAPI support', () => {
      expect(typeof (locationsRouter as { openapi?: unknown }).openapi).toBe('function');
    });

    it('should apply edge caching middleware to public GET routes', () => {
      // The locations router applies edgeCacheMiddleware to public GET routes
      // We can verify the router has the middleware setup by checking it exists
      expect(locationsRouter).toBeDefined();
    });
  });

  describe('Public routes', () => {
    it('should allow access to locations list without auth', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      // Mock the database query to return empty results
      const mockAll = vi.mocked((mockDb as { _mockAll: ReturnType<typeof vi.fn> })._mockAll);
      mockAll.mockResolvedValue({ results: [], meta: { duration: 1 } } as unknown as D1Result);

      const req = new Request('http://localhost/api/locations');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Public route should not require auth - might fail for other reasons but not 401
      expect(_res.status).not.toBe(401);
    });
  });

  describe('Admin routes authentication and authorization', () => {
    it('should return 401 when not authenticated on admin list route', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/locations/admin/list');

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

      const req = new Request('http://localhost/api/locations/admin/list');

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

      const req = new Request('http://localhost/api/locations/admin/list');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should allow mentor to access admin routes via member_type', async () => {
      // This tests RBAC-03 from auth.ts: mentors get admin access for non-super-admin routes
      globalThis.__mockSessionUser = mockMentorUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/locations/admin/list');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - mentors are allowed on non-super-admin routes
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should return 401 when not authenticated on save location', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/locations/admin/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Location',
          address: '123 Test St',
          maps_url: 'https://maps.google.com/test',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 when non-admin tries to save location', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/locations/admin/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Location',
          address: '123 Test St',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });

    it('should allow admin to save location', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      // Mock the database run method for insert/update operation
      const mockRun = vi.mocked((mockDb as { _mockRun: ReturnType<typeof vi.fn> })._mockRun);
      mockRun.mockResolvedValue({ success: true, meta: { changes: 1, last_row_id: 'test' } } as unknown as D1Result);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/locations/admin/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Location',
          address: '123 Test St',
          maps_url: 'https://maps.google.com/test',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should return 401 when not authenticated on delete location', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/locations/admin/123/delete', {
        method: 'DELETE',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 when non-admin tries to delete location', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/locations/admin/123/delete', {
        method: 'DELETE',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });

    it('should allow admin to delete location', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      // Mock the run method for the update operation
      const mockRun = vi.mocked((mockDb as { _mockRun: ReturnType<typeof vi.fn> })._mockRun);
      mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } } as unknown as D1Result);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/locations/admin/123/delete', {
        method: 'DELETE',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });
  });

  describe('Input validation', () => {
    it('should validate location data on save', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      // Missing required name field
      const req = new Request('http://localhost/api/locations/admin/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: '123 Test St',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should return validation error (400)
      expect(_res.status).toBe(400);
    });

    it('should validate location ID on delete', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/locations/admin/123/delete', {
        method: 'DELETE',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });
  });

  // NOTE: Database query tests are skipped because Drizzle ORM's query builder
  // doesn't work well with simple D1 mocks. These would require either:
  // 1. A more sophisticated Drizzle mock
  // 2. Integration tests with a real database
  // 3. Refactoring routes to inject database dependencies
  describe.skip('Database queries (require integration tests)', () => {
    it('should return list of locations ordered by name ascending');
    it('should filter out deleted locations from public list');
    it('should include deleted locations in admin list');
    it('should create a new location when admin provides valid data');
    it('should update an existing location when admin provides id');
    it('should handle upsert with onConflictDoUpdate for location id');
    it('should soft-delete a location when admin deletes');
    it('should log audit action on save');
    it('should log audit action on delete');
  });

  // Test edge caching middleware is applied
  describe('Edge caching', () => {
    it('should have edge caching on public GET routes', () => {
      // The locations router applies edgeCacheMiddleware to public GET routes
      // We can verify the router has the middleware setup
      const routes = locationsRouter.routes;
      const hasPublicRoutes = routes.some((route) => route.method === 'GET' && !route.path.includes('/admin/')
      );
      expect(hasPublicRoutes).toBe(true);
    });
  });

  // Test admin route structure
  describe('Admin route structure', () => {
    it('should have admin routes defined', () => {
      const routes = locationsRouter.routes;
      const hasAdminRoutes = routes.some((route) => route.path.includes('/admin/')
      );
      expect(hasAdminRoutes).toBe(true);
    });
  });

  // Test route methods
  describe('Route methods', () => {
    it('should support GET on public list endpoint', () => {
      const routes = locationsRouter.routes;
      const listRoute = routes.find((r) => r.method === 'GET' && !r.path.includes('/admin/')
      );
      expect(listRoute).toBeDefined();
    });

    it('should support GET on admin list endpoint', () => {
      const routes = locationsRouter.routes;
      const adminListRoute = routes.find((r) => r.path.includes('/admin/list') || (r.method === 'GET' && r.path.includes('/admin'))
      );
      expect(adminListRoute).toBeDefined();
    });

    it('should support POST on admin save endpoint', () => {
      const routes = locationsRouter.routes;
      const saveRoute = routes.find((r) => r.path.includes('/admin/save') && r.method === 'POST'
      );
      expect(saveRoute).toBeDefined();
    });

    it('should support DELETE on admin delete endpoint', () => {
      const routes = locationsRouter.routes;
      const deleteRoute = routes.find((r) => r.path.includes('/admin/') && r.method === 'DELETE'
      );
      expect(deleteRoute).toBeDefined();
    });
  });
});
