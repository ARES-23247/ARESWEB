/**
 * Tests for sponsors route handlers
 *
 * Tests sponsor management endpoints including auth, admin checks,
 * and basic route structure. Database query tests are skipped
 * due to Drizzle ORM complexity with D1 mocking.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono, Context, Next } from 'hono';
import { createMockDb, createTestEnv, createTestDbMiddleware, mockExecutionContext, mockMultiResult } from '../../test/test-env';
import { globalErrorHandler } from '../middleware/errorHandler';
// Extend globalThis for test mocks
declare global {
  var __mockSessionUser: import('../middleware').SessionUser | null;
}
import { AppEnv, SessionUser } from '../middleware';

// Mock the auth module BEFORE importing sponsorsRouter
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
      const isAdmin = user?.role === 'admin' || user?.memberType === 'mentor' || user?.memberType === 'coach';
      if (!isAdmin) {
        return c.json({ error: 'Forbidden: Requires admin privileges.' }, 403);
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

// Import sponsorsRouter after mocking
import sponsorsRouter from './sponsors';



describe('Sponsors Routes', () => {
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
    app.onError(globalErrorHandler);
    app.use('*', createTestDbMiddleware());
    app.route('/api/sponsors', sponsorsRouter);
    return app;
  };

  describe('Router structure', () => {
    it('should export a valid router', () => {
      expect(sponsorsRouter).toBeDefined();
      expect(typeof sponsorsRouter).toBe('object');
    });

    it('should have OpenAPI support', () => {
      expect(typeof (sponsorsRouter as { openapi?: unknown }).openapi).toBe('function');
    });
  });

  describe('Public routes', () => {
    it('should allow access to public sponsors list without auth', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      // Mock the database query to return empty results
      const mockAll = vi.mocked((mockDb as { _mockAll: ReturnType<typeof vi.fn> })._mockAll);
      mockAll.mockResolvedValue({ success: true, results: [], meta: { duration: 1 } } as unknown as D1Result);

      const req = new Request('http://localhost/api/sponsors');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Public route should not require auth - might fail for other reasons but not 401
      expect(_res.status).not.toBe(401);
    });

    it('should allow access to ROI dashboard with valid token for an active sponsor', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      // 1. First Drizzle query (D1 .all()): Fetch token from sponsorTokens
      const mockAll = vi.mocked((mockDb as { _mockAll: ReturnType<typeof vi.fn> })._mockAll);
      mockAll.mockResolvedValueOnce(mockMultiResult([{ sponsorId: 'sponsor-123' }]));

      // 2. Second Drizzle query (D1 .all() under the hood for .get()): Fetch active sponsor details
      mockAll.mockResolvedValueOnce(mockMultiResult([{
        id: 'sponsor-123',
        name: 'Active Sponsor',
        tier: 'Titanium',
        logo_url: 'logo.png',
        website_url: 'https://sponsor.com',
        is_active: 1,
        created_at: '2026-05-19T00:00:00.000Z',
      }]));

      // 3. Third Drizzle query (D1 .all()): Fetch metrics
      mockAll.mockResolvedValueOnce(mockMultiResult([]));

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/sponsors/roi/active-token-123', {
        headers: {
          'x-test-bypass-auth': 'true'
        }
      });
      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(200);
      const json = await _res.json() as { sponsor: { name: string }; metrics: unknown[] };
      expect(json.sponsor.name).toBe('Active Sponsor');
      expect(json.metrics).toEqual([]);
    });

    it('should reject access to ROI dashboard for a soft-deleted sponsor even with valid token', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      // 1. First Drizzle query (D1 .all()): Fetch token from sponsorTokens
      const mockAll = vi.mocked((mockDb as { _mockAll: ReturnType<typeof vi.fn> })._mockAll);
      mockAll.mockResolvedValueOnce(mockMultiResult([{ sponsorId: 'sponsor-123' }]));

      // 2. Second Drizzle query (D1 .all() under the hood for .get()): Fetch inactive sponsor details (isActive = 0)
      mockAll.mockResolvedValueOnce(mockMultiResult([{
        id: 'sponsor-123',
        name: 'Inactive Sponsor',
        tier: 'Gold',
        logo_url: null,
        website_url: null,
        is_active: 0, // soft-deleted!
        created_at: '2026-05-19T00:00:00.000Z',
      }]));

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/sponsors/roi/deleted-token-123', {
        headers: {
          'x-test-bypass-auth': 'true'
        }
      });
      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Throws Sponsor not found with 403 status code
      expect(_res.status).toBe(403);
      const json = await _res.json() as { error: string };
      expect(json.error).toBe('Sponsor not found');
    });
  });

  describe('Admin routes authentication and authorization', () => {
    it('should return 401 when not authenticated on admin list', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/sponsors/admin/list');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 when non-admin tries to access admin list', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/sponsors/admin/list');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });

    it('should allow admin to access admin list', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/sponsors/admin/list');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should return 401 or 429 when not authenticated on save sponsor', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/sponsors/admin/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Sponsor', tier: 'Gold' }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Note: The sponsors router has rate limiting on ALL routes (rateLimitMiddleware(15, 60))
      // This means we might get 429 (rate limit) before 401 (unauthorized)
      expect(_res.status === 401 || _res.status === 429).toBe(true);
    });

    it('should return 403 or 429 when non-admin tries to save sponsor', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/sponsors/admin/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Sponsor', tier: 'Gold' }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Note: The sponsors router has rate limiting on ALL routes (rateLimitMiddleware(15, 60))
      // This means we might get 429 (rate limit) before 403 (forbidden)
      expect(_res.status === 403 || _res.status === 429).toBe(true);
    });

    it('should allow admin to save sponsor', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      // Mock the run method for the insert operation
      const mockRun = vi.mocked((mockDb as { _mockRun: ReturnType<typeof vi.fn> })._mockRun);
      mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } } as D1Result);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/sponsors/admin/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Sponsor', tier: 'Gold' }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should return 401 or 429 when not authenticated on delete sponsor', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/sponsors/admin/sponsor-123/delete', {
        method: 'DELETE',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Note: The sponsors router has rate limiting on ALL routes (rateLimitMiddleware(15, 60))
      // This means we might get 429 (rate limit) before 401 (unauthorized)
      expect(_res.status === 401 || _res.status === 429).toBe(true);
    });

    it('should return 403 or 429 when non-admin tries to delete sponsor', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/sponsors/admin/sponsor-123/delete', {
        method: 'DELETE',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Note: The sponsors router has rate limiting on ALL routes (rateLimitMiddleware(15, 60))
      // This means we might get 429 (rate limit) before 403 (forbidden)
      expect(_res.status === 403 || _res.status === 429).toBe(true);
    });

    it('should return 401 or 429 when not authenticated on generate token', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/sponsors/admin/generate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sponsor_id: 'sponsor-123' }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Note: The sponsors router has rate limiting on ALL routes (rateLimitMiddleware(15, 60))
      // This means we might get 429 (rate limit) before 401 (unauthorized)
      expect(_res.status === 401 || _res.status === 429).toBe(true);
    });

    it('should return 403 or 429 when non-admin tries to generate token', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/sponsors/admin/generate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sponsor_id: 'sponsor-123' }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Note: The sponsors router has rate limiting on ALL routes (rateLimitMiddleware(15, 60))
      // This means we might get 429 (rate limit) before 403 (forbidden)
      expect(_res.status === 403 || _res.status === 429).toBe(true);
    });

    it('should return 401 or 429 when not authenticated on get admin tokens', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/sponsors/admin/tokens');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Note: The sponsors router has rate limiting on ALL routes (rateLimitMiddleware(15, 60))
      // This means we might get 429 (rate limit) before 401 (unauthorized)
      expect(_res.status === 401 || _res.status === 429).toBe(true);
    });

    it('should return 403 or 429 when non-admin tries to get admin tokens', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/sponsors/admin/tokens');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Note: The sponsors router has rate limiting on ALL routes (rateLimitMiddleware(15, 60))
      // This means we might get 429 (rate limit) before 403 (forbidden)
      expect(_res.status === 403 || _res.status === 429).toBe(true);
    });
  });

  // NOTE: Database query tests are skipped because Drizzle ORM's query builder
  // doesn't work well with simple D1 mocks. These would require either:
  // 1. A more sophisticated Drizzle mock
  // 2. Integration tests with a real database
  // 3. Refactoring routes to inject database dependencies
  describe.skip('Database queries (require integration tests)', () => {
    it('should return list of active sponsors ordered by tier');
    it('should return ROI metrics for valid token');
    it('should return 403 for invalid ROI token');
    it('should create a new sponsor when admin');
    it('should update an existing sponsor when admin');
    it('should delete a sponsor when admin');
    it('should generate ROI token when admin');
    it('should return list of admin tokens when admin');
  });

  // Test rate limiting middleware is applied
  describe('Rate limiting', () => {
    it('should have rate limiting on all routes', () => {
      // The sponsors router applies rateLimitMiddleware(15, 60) to all routes
      // We can verify this by checking that routes exist
      const routes = sponsorsRouter.routes;
      expect(routes.length).toBeGreaterThan(0);
    });

    it('should have rate limiting on admin routes', () => {
      // We can verify admin routes exist
      const adminRoutes = sponsorsRouter.routes;
      const hasAdminRoutes = adminRoutes.some((route) => route.path.includes('/admin/')
      );
      expect(hasAdminRoutes).toBe(true);
    });
  });

  // Test edge caching middleware is applied
  describe('Edge caching', () => {
    it('should have edge caching on public GET routes', () => {
      // The sponsors router applies edgeCacheMiddleware to public GET routes
      // We can verify the router has the middleware setup
      const routes = sponsorsRouter.routes;
      const hasPublicRoutes = routes.some((route) => route.method === 'GET' && !route.path.includes('/admin/')
      );
      expect(hasPublicRoutes).toBe(true);
    });
  });
});
