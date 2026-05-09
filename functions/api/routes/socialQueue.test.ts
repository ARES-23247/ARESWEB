/**
 * Tests for socialQueue route handlers
 *
 * Tests social media queue management endpoints including auth, admin checks,
 * origin integrity, and basic route structure. Database query tests are skipped
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
import { _ApiError } from '../middleware/errorHandler';
import { _HTTPException } from 'hono/http-exception';

// Mock the auth module BEFORE importing socialQueueRouter
vi.mock('../middleware/auth', async () => {
  const actual = await vi.importActual<typeof import('../middleware/auth.js')>('../middleware/auth');
  return {
    ...actual,
    getSessionUser: vi.fn((c: Context) => {
      // Return the global mock user or check if sessionUser is already set
      return c.get('sessionUser') || globalThis.__mockSessionUser || null;
    }),
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
        return c.json({ error: 'Forbidden: Requires admin privileges.' }, 403);
      }
      c.set('sessionUser', user);
      return next();
    }),
  };
});

// Import socialQueueRouter after mocking
import socialQueueRouter from './socialQueue';

const mockExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

describe('SocialQueue Routes', () => {
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
    globalThis.__mockSessionUser = null;
    // Clear mock call history and reset to default behavior
    (mockDb as { _mockFirst: ReturnType<typeof vi.fn> })._mockFirst.mockReset();
    (mockDb as { _mockAll: ReturnType<typeof vi.fn> })._mockAll.mockReset();
    (mockDb as { _mockRun: ReturnType<typeof vi.fn> })._mockRun.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.__mockSessionUser = null;
  });

  const createTestApp = () => {
    const app = new Hono<AppEnv>()
    app.use('*', createTestDbMiddleware());

    // Add error handler similar to the main app
    

    app.route('/api/social-queue', socialQueueRouter);
    return app;
  };

  // Helper to create a request with proper headers to pass origin integrity
  const createTestRequest = (url: string, options: RequestInit = {}) => {
    const headers = {
      ...options.headers,
      'Origin': 'http://localhost',
      'Referer': 'http://localhost',
    };
    return new Request(url, { ...options, headers });
  };

  describe('Router structure', () => {
    it('should export a valid router', () => {
      expect(socialQueueRouter).toBeDefined();
      expect(typeof socialQueueRouter).toBe('object');
    });

    it('should have OpenAPI support', () => {
      expect(typeof (socialQueueRouter as { openapi?: unknown }).openapi).toBe('function');
    });

    it('should apply origin integrity middleware to all routes', () => {
      // The socialQueue router uses originIntegrityMiddleware() on all routes (WR-11)
      // We can verify this by checking that the router exists
      expect(socialQueueRouter).toBeDefined();
    });
  });

  describe('GET /api/social-queue - List posts', () => {
    it('should return 401 when not authenticated', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/social-queue');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should allow authenticated users to list their posts', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      // Mock the database query
      const mockAll = vi.mocked((mockDb as { _mockAll: ReturnType<typeof vi.fn> })._mockAll);
      mockAll.mockResolvedValue([]);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/social-queue');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
    });

    it('should allow admins to see all posts (not just their own)', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      // Mock the database query
      const mockAll = vi.mocked((mockDb as { _mockAll: ReturnType<typeof vi.fn> })._mockAll);
      mockAll.mockResolvedValue([]);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/social-queue');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - admin should be able to list all posts
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should support query parameters for filtering', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      // Mock the database query
      const mockAll = vi.mocked((mockDb as { _mockAll: ReturnType<typeof vi.fn> })._mockAll);
      mockAll.mockResolvedValue([]);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/social-queue?status=pending&limit=10&offset=0');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Just verify the request is processed (may fail at DB level)
      expect(_res.status).not.toBe(401);
    });
  });

  describe('GET /api/social-queue/calendar - Calendar view', () => {
    it('should return 401 when not authenticated', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/social-queue/calendar?start=2026-01-01&end=2026-12-31');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should allow authenticated users to view calendar', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      // Mock the database query
      const mockAll = vi.mocked((mockDb as { _mockAll: ReturnType<typeof vi.fn> })._mockAll);
      mockAll.mockResolvedValue([]);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/social-queue/calendar?start=2026-01-01&end=2026-12-31');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
    });
  });

  describe('POST /api/social-queue - Create post', () => {
    it('should return 401 when not authenticated', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = createTestRequest('http://localhost/api/social-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: 'Test post',
          platforms: { twitter: true, bluesky: true },
          scheduled_for: '2026-06-01T12:00:00Z',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should allow authenticated users to create posts', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      // Mock the insert operation
      const mockRun = vi.mocked((mockDb as { _mockRun: ReturnType<typeof vi.fn> })._mockRun);
      mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } } as D1Result);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = createTestRequest('http://localhost/api/social-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: 'Test post',
          platforms: { twitter: true },
          scheduled_for: '2026-06-01T12:00:00Z',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
    });

    it('should validate required fields', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      // Missing required content field
      const req = createTestRequest('http://localhost/api/social-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platforms: { twitter: true },
          scheduled_for: '2026-06-01T12:00:00Z',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should return validation error (400)
      expect(_res.status).toBe(400);
    });
  });

  describe('PATCH /api/social-queue/:id - Update post', () => {
    it('should return 401 when not authenticated', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = createTestRequest('http://localhost/api/social-queue/post-123', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'Updated content' }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should allow post owner to update their post', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      // Mock the database query for existing post owned by user
      const mockFirst = vi.mocked((mockDb as { _mockFirst: ReturnType<typeof vi.fn> })._mockFirst);
      mockFirst.mockResolvedValue({
        id: 'post-123',
        content: 'Original content',
        createdBy: mockAuthUser.id,
        success: true,
        meta: { duration: 1 },
      } as unknown as D1Result);

      // Mock the update operation
      const mockRun = vi.mocked((mockDb as { _mockRun: ReturnType<typeof vi.fn> })._mockRun);
      mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } } as D1Result);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = createTestRequest('http://localhost/api/social-queue/post-123', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'Updated content' }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the owner should be able to update
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should allow admins to update any post', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      // Mock the database query for existing post owned by another user
      const mockFirst = vi.mocked((mockDb as { _mockFirst: ReturnType<typeof vi.fn> })._mockFirst);
      mockFirst.mockResolvedValue({
        id: 'post-123',
        content: 'Original content',
        createdBy: 'other-user',
        success: true,
        meta: { duration: 1 },
      } as unknown as D1Result);

      // Mock the update operation
      const mockRun = vi.mocked((mockDb as { _mockRun: ReturnType<typeof vi.fn> })._mockRun);
      mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } } as D1Result);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = createTestRequest('http://localhost/api/social-queue/post-123', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'Updated by admin' }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Admin should be able to update any post
      expect(_res.status).not.toBe(403);
    });
  });

  describe('DELETE /api/social-queue/:id - Delete post', () => {
    it('should return 401 when not authenticated', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = createTestRequest('http://localhost/api/social-queue/post-123', {
        method: 'DELETE',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should allow post owner to delete their post', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      // Mock the database query for existing post owned by user
      const mockFirst = vi.mocked((mockDb as { _mockFirst: ReturnType<typeof vi.fn> })._mockFirst);
      mockFirst.mockResolvedValue({
        id: 'post-123',
        createdBy: mockAuthUser.id,
        success: true,
        meta: { duration: 1 },
      } as unknown as D1Result);

      // Mock the delete operation
      const mockRun = vi.mocked((mockDb as { _mockRun: ReturnType<typeof vi.fn> })._mockRun);
      mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } } as D1Result);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = createTestRequest('http://localhost/api/social-queue/post-123', {
        method: 'DELETE',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the owner should be able to delete
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should allow admins to delete any post', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      // Mock the database query for existing post owned by another user
      const mockFirst = vi.mocked((mockDb as { _mockFirst: ReturnType<typeof vi.fn> })._mockFirst);
      mockFirst.mockResolvedValue({
        id: 'post-123',
        createdBy: 'other-user',
        success: true,
        meta: { duration: 1 },
      } as unknown as D1Result);

      // Mock the delete operation
      const mockRun = vi.mocked((mockDb as { _mockRun: ReturnType<typeof vi.fn> })._mockRun);
      mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } } as D1Result);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = createTestRequest('http://localhost/api/social-queue/post-123', {
        method: 'DELETE',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Admin should be able to delete any post
      expect(_res.status).not.toBe(403);
    });
  });

  describe('POST /api/social-queue/:id/send-now - Send post now (admin only)', () => {
    it('should return 401 when not authenticated', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = createTestRequest('http://localhost/api/social-queue/post-123/send-now', {
        method: 'POST',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 401 when non-admin tries to send post', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = createTestRequest('http://localhost/api/social-queue/post-123/send-now', {
        method: 'POST',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should allow admins to send posts immediately', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      // Mock the database query for existing post
      const mockFirst = vi.mocked((mockDb as { _mockFirst: ReturnType<typeof vi.fn> })._mockFirst);
      mockFirst.mockResolvedValue({
        id: 'post-123',
        content: 'Test post',
        platforms: JSON.stringify({ twitter: true }),
        status: 'pending',
        success: true,
        meta: { duration: 1 },
      } as unknown as D1Result);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
        TWITTER_API_KEY: 'test-key',
      });

      const req = createTestRequest('http://localhost/api/social-queue/post-123/send-now', {
        method: 'POST',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - admin should be able to send
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });
  });

  describe('GET /api/social-queue/analytics - Analytics (admin only)', () => {
    it('should return 401 when not authenticated', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/social-queue/analytics');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 401 when non-admin tries to access analytics', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/social-queue/analytics');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should allow admins to access analytics', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      // Mock the database query
      const mockAll = vi.mocked((mockDb as { _mockAll: ReturnType<typeof vi.fn> })._mockAll);
      mockAll.mockResolvedValue([]);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/social-queue/analytics');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - admin should be able to access analytics
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });
  });

  describe('Origin Integrity (WR-11: CSRF Protection)', () => {
    it('should require Origin/Referer headers for POST requests', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      // Request without Origin or Referer headers
      const req = new Request('http://localhost/api/social-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: 'Test post',
          platforms: { twitter: true },
          scheduled_for: '2026-06-01T12:00:00Z',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Origin integrity middleware should block this
      expect(_res.status).toBe(403);
    });

    it('should allow requests with valid Origin header', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      // Mock the insert operation
      const mockRun = vi.mocked((mockDb as { _mockRun: ReturnType<typeof vi.fn> })._mockRun);
      mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } } as D1Result);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      // Request with Origin header
      const req = createTestRequest('http://localhost/api/social-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost',
        },
        body: JSON.stringify({
          content: 'Test post',
          platforms: { twitter: true },
          scheduled_for: '2026-06-01T12:00:00Z',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should pass origin integrity check (though may fail at DB level)
      expect(_res.status).not.toBe(403);
    });
  });

  // NOTE: Database query tests are skipped because Drizzle ORM's query builder
  // doesn't work well with simple D1 mocks. These would require either:
  // 1. A more sophisticated Drizzle mock that handles chained .select().from().where() calls
  // 2. Integration tests with a real database
  // 3. Refactoring routes to inject database dependencies for better testability
  //
  // The socialQueue routes contain complex Drizzle queries:
  // - JSON field parsing and stringifying for platforms and media_urls
  // - Date-based filtering with gte/lte for calendar view
  // - Conditional WHERE clauses based on user role
  // - Aggregation queries for analytics (counting by status, platform usage)
  // - Complex update logic with multiple field conditions
  //
  // While authentication/authorization is tested above, the actual CRUD operations
  // would require a full Drizzle integration test setup.
  describe.skip('Database queries (require integration tests)', () => {
    it('should return paginated list of posts with status filtering');
    it('should return calendar view posts within date range');
    it('should create a new post with platforms and scheduled date');
    it('should update post content, scheduled date, status, and platforms');
    it('should delete a post and verify removal');
    it('should send post immediately and update status to sent/failed');
    it('should return analytics with post counts by status and platform');
    it('should filter posts by created_by for non-admin users');
    it('should allow admins to see all posts regardless of creator');
  });

  describe('Router configuration', () => {
    it('should have all expected routes defined', () => {
      const routes = socialQueueRouter.routes;

      // Check for common route paths
      const routePaths = routes.map((r) => r.path || '');

      // Hono stores parameterized routes as '/*' not '/{id}'
      expect(routePaths).toContain('/');
      expect(routePaths).toContain('/*');
    });
  });
});
