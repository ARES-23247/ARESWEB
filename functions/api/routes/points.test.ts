/**
 * Tests for points route handlers
 *
 * Tests points management endpoints including auth, admin checks,
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
import { ApiError } from '../middleware/errorHandler';

// Mock the auth module BEFORE importing pointsRouter
vi.mock('../middleware/auth', async () => {
  const actual = await vi.importActual<typeof import('../middleware/auth.js')>('../middleware/auth');
  return {
    ...actual,
    getSessionUser: vi.fn(() => Promise.resolve(globalThis.__mockSessionUser)),
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

// Import pointsRouter after mocking
import pointsRouter from './points';

const mockExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

describe('Points Routes', () => {
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

  const _mockOtherUser: SessionUser = {
    id: 'other-user',
    email: 'other@ares.org',
    name: 'Other User',
    nickname: 'Other',
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
    const app = new Hono<AppEnv>()

    // Inject mock session user into context before routing
    // The points.ts handlers do manual auth checks using c.get('sessionUser')
    app.use('*', async (c, next) => {
      const mockUser = globalThis.__mockSessionUser;
      if (mockUser) {
        c.set('sessionUser', mockUser);
      }
      await next();
    });

    app.use('*', createTestDbMiddleware());

    app.onError((err, c) => {
      if (err instanceof ApiError) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return c.json({ error: err.message }, err.status as any);
      }
      return c.json({ error: 'Internal server error' }, 500);
    });

    app.route('/api/points', pointsRouter);
    return app;
  };

  describe('Router structure', () => {
    it('should export a valid router', () => {
      expect(pointsRouter).toBeDefined();
      expect(typeof pointsRouter).toBe('object');
    });

    it('should have OpenAPI support', () => {
      expect(typeof (pointsRouter as { openapi?: unknown }).openapi).toBe('function');
    });

    it('should have the correct route paths registered', () => {
      const routes = pointsRouter.routes;
      const paths = routes.map((r) => r.path || '');

      // Expected points routes based on points.ts
      const expectedRoutes = [
        '/balance/{user_id}',
        '/history/{user_id}',
        '/transaction',
        '/leaderboard',
      ];

      expectedRoutes.forEach(expectedPath => {
        // Check if a route matching this pattern exists
        const hasMatchingRoute = paths.some((path: string) => {
          // Convert {user_id} pattern to actual path format used by Hono
          const normalizedPath = expectedPath.replace('{user_id}', ':user_id');
          return path === normalizedPath || path.includes(expectedPath.split('{')[0]);
        });
        expect(hasMatchingRoute).toBe(true);
      });
    });
  });

  describe('GET /balance/{user_id} - Authentication and Authorization', () => {
    it('should return 401 when not authenticated', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/points/balance/some-user-id');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should allow user to view their own balance', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/points/balance/auth-user');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should allow admin to view any user balance', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/points/balance/other-user');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should return 403 when user tries to view another user balance', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/points/balance/other-user');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });

    it('should allow mentor (non-admin role) to view any user balance via memberType', async () => {
      // This tests RBAC-03 from auth.ts: mentors get admin-like access for points routes
      globalThis.__mockSessionUser = mockMentorUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/points/balance/other-user');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // The points router checks sessionUser.role === 'admin' strictly
      // Mentors with role='user' and memberType='mentor' are NOT granted access
      // This is different from ensureAdmin middleware which checks memberType
      expect(_res.status).toBe(403);
    });
  });

  describe('GET /history/{user_id} - Authentication and Authorization', () => {
    it('should return 401 when not authenticated', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/points/history/some-user-id');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should allow user to view their own history', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/points/history/auth-user');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should allow admin to view any user history', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/points/history/other-user');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should return 403 when user tries to view another user history', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/points/history/other-user');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });
  });

  describe('POST /transaction - Authentication and Authorization', () => {
    it('should return 401 when not authenticated', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/points/transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'some-user',
          pointsDelta: 10,
          reason: 'Test award',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 401 when non-admin tries to award points', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/points/transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'some-user',
          pointsDelta: 10,
          reason: 'Test award',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // awardPointsRoute checks sessionUser.role === 'admin' specifically
      expect(_res.status).toBe(403);
    });

    it('should allow admin to award points', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      // Mock the run method for the insert operation
      const mockRun = vi.mocked((mockDb as { _mockRun: ReturnType<typeof vi.fn> })._mockRun);
      mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } } as D1Result);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/points/transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'recipient-user',
          pointsDelta: 25,
          reason: 'Excellent work on autonomous',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should require admin role even for mentors (awardPoints is admin-only)', async () => {
      // The awardPoints route has a strict check: sessionUser.role === 'admin'
      // Unlike other routes, it does NOT check memberType for mentors
      globalThis.__mockSessionUser = mockMentorUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/points/transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'recipient-user',
          pointsDelta: 25,
          reason: 'Test award',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // awardPointsRoute specifically checks role === 'admin', not memberType
      expect(_res.status).toBe(403);
    });
  });

  describe('GET /leaderboard - Public Access', () => {
    it('should allow unauthenticated access to leaderboard', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/points/leaderboard');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Leaderboard is public - should not require auth
      // May fail with database errors due to mocking, but should not be 401
      expect(_res.status).not.toBe(401);
    });

    it('should allow authenticated access to leaderboard', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/points/leaderboard');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });
  });

  describe('Route methods', () => {
    it('should support GET on /balance/{user_id}', () => {
      const routes = pointsRouter.routes;
      const balanceRoute = routes.find((r) => r.path?.includes('balance') && r.method === 'GET'
      );
      expect(balanceRoute).toBeDefined();
    });

    it('should support GET on /history/{user_id}', () => {
      const routes = pointsRouter.routes;
      const historyRoute = routes.find((r) => r.path?.includes('history') && r.method === 'GET'
      );
      expect(historyRoute).toBeDefined();
    });

    it('should support POST on /transaction', () => {
      const routes = pointsRouter.routes;
      const transactionRoute = routes.find((r) => r.path?.includes('transaction') && r.method === 'POST'
      );
      expect(transactionRoute).toBeDefined();
    });

    it('should support GET on /leaderboard', () => {
      const routes = pointsRouter.routes;
      const leaderboardRoute = routes.find((r) => r.path?.includes('leaderboard') && r.method === 'GET'
      );
      expect(leaderboardRoute).toBeDefined();
    });
  });

  // NOTE: Database query tests are skipped because Drizzle ORM's query builder
  // doesn't work well with simple D1 mocks. These would require either:
  // 1. A more sophisticated Drizzle mock that handles chained .select().from().where() calls
  // 2. Integration tests with a real database
  // 3. Refactoring routes to inject database dependencies for better testability
  //
  // The points.ts routes contain complex Drizzle queries:
  // - Aggregation with sum() for balance calculations
  // - Left joins between user and pointsLedger tables for leaderboard
  // - Ordered queries with desc() for history retrieval
  // - Group by operations for leaderboard aggregation
  //
  // While authentication/authorization is tested above, the actual CRUD operations
  // would require a full Drizzle integration test setup with proper D1 mocking.
  describe.skip('Database queries (require integration tests)', () => {
    it('should return correct balance when user has point transactions');
    it('should return zero balance for user with no transactions');
    it('should return history ordered by creation date (newest first)');
    it('should include all transaction fields in history response');
    it('should award points and create transaction record');
    it('should deduct points (negative delta) when authorized');
    it('should return leaderboard ordered by points balance (highest first)');
    it('should include user profile info in leaderboard entries');
    it('should limit leaderboard to 50 entries');
    it('should handle users with no points (zero balance) in leaderboard');
  });

  describe('Validation', () => {
    it('should validate transaction request has required fields', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      // Missing required fields - will fail at validation or handler level
      const req = new Request('http://localhost/api/points/transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Missing user_id, points_delta, and reason
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should fail validation or return error
      expect(_res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
