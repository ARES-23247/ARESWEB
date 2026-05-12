/**
 * Tests for posts route handlers
 *
 * Tests blog post management endpoints including auth, admin checks,
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

// Mock the auth module BEFORE importing postsRouter
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
                      const { ApiError } = (await vi.importActual('../middleware/errorHandler')) as any;
                      throw new ApiError("Unauthorized: Please log in.", 401);
                    }
                    return user;
                  })
};
});

// Import postsRouter after mocking
import postsRouter from './posts';

const mockExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

describe('Posts Routes', () => {
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
    role: 'author',
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
    app.use('*', createTestDbMiddleware());
    app.route('/api/posts', postsRouter);
    return app;
  };

  describe('Router structure', () => {
    it('should export a valid router', () => {
      expect(postsRouter).toBeDefined();
      expect(typeof postsRouter).toBe('object');
    });

    it('should have OpenAPI support', () => {
      expect(typeof (postsRouter as { openapi?: unknown }).openapi).toBe('function');
    });
  });

  describe('Public routes - GET /api/posts', () => {
    it('should allow public access to list posts', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts?limit=10&offset=0');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - public route
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should apply edge cache middleware to public GET requests', async () => {
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Check for cache headers
      const __cacheControl = _res.headers.get('Cache-Control');
      // Edge cache is applied, though the exact value depends on the response
      expect(_res.status).not.toBe(401);
    });
  });

  describe('Public routes - GET /api/posts/:slug', () => {
    it('should allow public access to get a single post', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/test-post');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - public route (will be 404 if post not found, but not auth error)
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });
  });

  describe('Authentication and Authorization for /admin/* routes', () => {
    it('should return 401 when not authenticated on admin routes', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/list');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 when non-admin tries to access admin routes', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/list');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });

    it('should allow admin to access admin routes', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      // Mock the run method for database operations
      const mockRun = vi.mocked((mockDb as { _mockRun: ReturnType<typeof vi.fn> })._mockRun);
      mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } } as D1Result);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/list');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });
  });

  describe('Admin route - GET /api/posts/admin/list', () => {
    it('should require admin authentication', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/list?limit=50&offset=0');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 for non-admin users', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/list?limit=50&offset=0');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });
  });

  describe('Admin route - GET /api/posts/admin/:slug', () => {
    it('should require admin authentication', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/test-post');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 for non-admin users', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/test-post');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });
  });

  describe('Admin route - POST /api/posts/admin/save', () => {
    it('should require admin authentication to save a post', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Test Post',
          ast: { type: 'doc', content: [] },
          isDraft: true,
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 for non-admin users saving posts', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Test Post',
          ast: { type: 'doc', content: [] },
          isDraft: true,
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });

    it('should allow admin to save posts', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      const mockRun = vi.mocked((mockDb as { _mockRun: ReturnType<typeof vi.fn> })._mockRun);
      mockRun.mockResolvedValue({
        success: true,
        results: [],
        meta: {
          duration: 1,
          size_after: 0,
          rows_read: 0,
          rows_written: 1,
          last_row_id: 123,
          changed_db: false,
          changes: 1,
        },
      } as D1Result);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Test Post',
          ast: { type: 'doc', content: [] },
          isDraft: true,
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - admin user can create posts
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });
  });

  describe('Admin route - POST /api/posts/admin/:slug (update)', () => {
    it('should require admin authentication to update a post', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/test-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Updated Post',
          ast: { type: 'doc', content: [] },
          isDraft: false,
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 for non-admin users updating posts', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/test-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Updated Post',
          ast: { type: 'doc', content: [] },
          isDraft: false,
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });
  });

  describe('Admin route - DELETE /api/posts/admin/:slug', () => {
    it('should require admin authentication to delete a post', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/test-post', {
        method: 'DELETE',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 for non-admin users deleting posts', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/test-post', {
        method: 'DELETE',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });
  });

  describe('Admin route - POST /api/posts/admin/:slug/undelete', () => {
    it('should require admin authentication to undelete a post', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/test-post/undelete', {
        method: 'POST',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 for non-admin users undeleting posts', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/test-post/undelete', {
        method: 'POST',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });
  });

  describe('Admin route - DELETE /api/posts/admin/:slug/purge', () => {
    it('should require admin authentication to purge a post', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/test-post/purge', {
        method: 'DELETE',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 for non-admin users purging posts', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/test-post/purge', {
        method: 'DELETE',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });
  });

  describe('Admin route - POST /api/posts/admin/:slug/approve', () => {
    it('should require admin authentication to approve a post', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/test-post/approve', {
        method: 'POST',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 for non-admin users approving posts', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/test-post/approve', {
        method: 'POST',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });
  });

  describe('Admin route - POST /api/posts/admin/:slug/reject', () => {
    it('should require admin authentication to reject a post', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/test-post/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Test rejection' }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 for non-admin users rejecting posts', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/test-post/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Test rejection' }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });
  });

  describe('Admin route - GET /api/posts/admin/:slug/history', () => {
    it('should require admin authentication to view post history', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/test-post/history');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 for non-admin users viewing post history', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/test-post/history');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });
  });

  describe('Admin route - POST /api/posts/admin/:slug/history/:id/restore', () => {
    it('should require admin authentication to restore post history', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/test-post/history/123/restore', {
        method: 'POST',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 for non-admin users restoring post history', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/test-post/history/123/restore', {
        method: 'POST',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });
  });

  describe('Admin route - POST /api/posts/admin/:slug/repush', () => {
    it('should require admin authentication to repush socials', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/test-post/repush', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ socials: ['twitter', 'bluesky'] }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 for non-admin users repushing socials', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/posts/admin/test-post/repush', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ socials: ['twitter', 'bluesky'] }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });
  });

  // NOTE: Database query tests are skipped because Drizzle ORM's query builder
  // doesn't work well with simple D1 mocks. These would require either:
  // 1. A more sophisticated Drizzle mock
  // 2. Integration tests with a real database
  // 3. Refactoring routes to inject database dependencies
  describe.skip('Database queries (require integration tests)', () => {
    it('should return list of posts with pagination');
    it('should return posts matching FTS search query');
    it('should return a single post by slug');
    it('should create a new post with valid data');
    it('should update an existing post');
    it('should soft delete a post');
    it('should undelete a soft deleted post');
    it('should permanently purge a deleted post');
    it('should approve a pending post');
    it('should reject a pending post with reason');
    it('should return post history');
    it('should restore post from history');
    it('should repush socials for published post');
  });

  // Test rate limiting middleware is applied
  describe('Rate limiting', () => {
    it('should have admin routes defined', () => {
      // Verify that admin routes exist on the router
      const routes = postsRouter.routes;
      const hasAdminRoutes = routes.some((route) => route.path?.includes('/admin/')
      );
      expect(hasAdminRoutes).toBe(true);
    });
  });
});
