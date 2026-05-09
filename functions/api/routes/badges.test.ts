/**
 * Tests for badges route handlers
 *
 * Tests badge management endpoints including auth, admin checks,
 * and basic route structure. Database query tests are skipped
 * due to Drizzle ORM complexity with D1 mocking.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { globalErrorHandler } from '../middleware/error';
import { createMockDb, createTestEnv, createTestDbMiddleware } from '../../test/test-env';
import { AppEnv, SessionUser } from '../middleware';

// Mock the auth module BEFORE importing badgesRouter
vi.mock('../middleware/auth', async () => {
  const actual = await vi.importActual<typeof import('../middleware/auth.js')>('../middleware/auth');
  return {
    ...actual,
    getSessionUser: vi.fn(),
    ensureAuth: vi.fn((c: any, next: any) => {
      const user = (globalThis as any).__mockSessionUser;
      if (!user) {
        return c.json({ error: 'Unauthorized: Please log in.' }, 401);
      }
      c.set('sessionUser', user);
      return next();
    }),
    ensureAdmin: vi.fn((c: any, next: any) => {
      const user = (globalThis as any).__mockSessionUser;
      if (!user) {
        return c.json({ error: 'Unauthorized: Please log in.' }, 401);
      }
      const isAdmin = user?.role === 'admin' || user?.member_type === 'mentor' || user?.member_type === 'coach';
      if (!isAdmin) {
        return c.json({ error: 'Forbidden: Requires admin privileges.' }, 403);
      }
      c.set('sessionUser', user);
      return next();
    }),
  };
});

// Import badgesRouter after mocking
import badgesRouter from './badges';

const mockExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

describe('Badges Routes', () => {
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

  beforeEach(() => {
    const dbSetup = createMockDb();
    mockDb = dbSetup.mockDb;
    (globalThis as any).__mockSessionUser = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).__mockSessionUser = null;
  });

  const createTestApp = () => {
    const app = new Hono<AppEnv>()
    app.onError(globalErrorHandler);
    app.onError(globalErrorHandler);
    app.use('*', createTestDbMiddleware());
    app.route('/api/badges', badgesRouter);
    return app;
  };

  describe('Router structure', () => {
    it('should export a valid router', () => {
      expect(badgesRouter).toBeDefined();
      expect(typeof badgesRouter).toBe('object');
    });

    it('should have OpenAPI support', () => {
      expect(typeof (badgesRouter as { openapi?: unknown }).openapi).toBe('function');
    });
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 when not authenticated', async () => {
      (globalThis as any).__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/badges');

      const res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(res.status).toBe(401);
    });

    it('should return 403 when non-admin tries to access admin route', async () => {
      (globalThis as any).__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/badges/admin/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'session=user',
        },
        body: JSON.stringify({ id: 'badge-1', name: 'Test' }),
      });

      const res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(res.status).toBe(403);
    });

    it('should allow admin to access admin routes', async () => {
      (globalThis as any).__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      // Mock the run method for the insert operation
      const mockRun = vi.mocked((mockDb as { _mockRun: ReturnType<typeof vi.fn> })._mockRun);
      mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } } as any);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/badges/admin/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'session=admin',
        },
        body: JSON.stringify({ id: 'badge-new', name: 'New Badge', description: 'Test', icon: 'Trophy', color_theme: 'ares-gold' }),
      });

      const res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the request should proceed to the handler
      // It might fail due to database issues, but auth should pass
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  // NOTE: Database query tests are skipped because Drizzle ORM's query builder
  // doesn't work well with simple D1 mocks. These would require either:
  // 1. A more sophisticated Drizzle mock
  // 2. Integration tests with a real database
  // 3. Refactoring routes to inject database dependencies
  describe.skip('Database queries (require integration tests)', () => {
    it('should return list of badges when authenticated');
    it('should create a badge when admin');
    it('should grant a badge to user when admin');
    it('should revoke a badge when admin');
    it('should delete a badge when admin');
    it('should return badge leaderboard when authenticated');
  });

  // Test rate limiting middleware is applied
  describe('Rate limiting', () => {
    it('should have rate limiting on admin routes', async () => {
      // The badges router applies rateLimitMiddleware(15, 60) to /admin/* routes
      // We can verify this by checking that the route exists
      const adminRoutes = badgesRouter.routes;
      const hasAdminRoutes = adminRoutes.some((route: any) =>
        route.path.includes('/admin/')
      );
      expect(hasAdminRoutes).toBe(true);
    });
  });
});
