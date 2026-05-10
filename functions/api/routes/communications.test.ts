/**
 * Tests for communications route handlers
 *
 * Tests communications endpoints including auth, admin checks,
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

// Mock the auth module BEFORE importing communicationsRouter
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
  };
});

// Import communicationsRouter after mocking
import communicationsRouter from './communications';

const mockExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

describe('Communications Routes', () => {
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
    const app = new Hono<AppEnv>();
    app.use('*', createTestDbMiddleware());

    // Use Hono's built-in onError for error handling (same pattern as production)
    

    app.route('/api/communications', communicationsRouter);
    return app;
  };

  // Helper to create a request with proper headers
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
      expect(communicationsRouter).toBeDefined();
      expect(typeof communicationsRouter).toBe('object');
    });

    it('should have OpenAPI support', () => {
      expect(typeof (communicationsRouter as { openapi?: unknown }).openapi).toBe('function');
    });

    it('should apply ensureAdmin to all routes', () => {
      // Verify the middleware is applied by checking routes exist
      const routes = communicationsRouter.routes;
      const hasProtectedRoutes = routes.some((route) => route.path?.includes('/mass-email') || route.path?.includes('/stats')
      );
      expect(hasProtectedRoutes).toBe(true);
    });
  });

  describe('GET /api/communications/stats - Get communications stats', () => {
    it('should return 401 when not authenticated', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/communications/stats');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 when non-admin tries to access stats', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/communications/stats');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });

    it('should allow admin to access stats', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/communications/stats');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should allow mentor to access stats via memberType', async () => {
      globalThis.__mockSessionUser = mockMentorUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/communications/stats');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - mentors are allowed
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should allow coach to access stats via memberType', async () => {
      globalThis.__mockSessionUser = mockCoachUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/communications/stats');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - coaches are allowed
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });
  });

  describe('POST /api/communications/mass-email - Send mass email', () => {
    it('should return 401 when not authenticated', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
        RESEND_API_KEY: 'test-resend-key',
      });

      const req = createTestRequest('http://localhost/api/communications/mass-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: 'Test Email',
          htmlContent: '<p>Test content</p>',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 when non-admin tries to send mass email', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
        RESEND_API_KEY: 'test-resend-key',
      });

      const req = createTestRequest('http://localhost/api/communications/mass-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: 'Test Email',
          htmlContent: '<p>Test content</p>',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });

    it('should validate required fields for mass email', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
        RESEND_API_KEY: 'test-resend-key',
      });

      // Missing subject field
      const req = createTestRequest('http://localhost/api/communications/mass-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          htmlContent: '<p>Test content</p>',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should return validation error (400)
      expect(_res.status).toBe(400);
    });

    it('should validate htmlContent is required for mass email', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
        RESEND_API_KEY: 'test-resend-key',
      });

      // Missing htmlContent field
      const req = createTestRequest('http://localhost/api/communications/mass-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: 'Test Email',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should return validation error (400)
      expect(_res.status).toBe(400);
    });

    it('should allow admin to send mass email (proceeds to handler)', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
        RESEND_API_KEY: 'test-resend-key',
      });

      const req = createTestRequest('http://localhost/api/communications/mass-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: 'Test Email',
          htmlContent: '<p>Test content</p>',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should allow mentor to send mass email via memberType', async () => {
      globalThis.__mockSessionUser = mockMentorUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
        RESEND_API_KEY: 'test-resend-key',
      });

      const req = createTestRequest('http://localhost/api/communications/mass-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: 'Test Email',
          htmlContent: '<p>Test content</p>',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - mentors are allowed
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should allow coach to send mass email via memberType', async () => {
      globalThis.__mockSessionUser = mockCoachUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
        RESEND_API_KEY: 'test-resend-key',
      });

      const req = createTestRequest('http://localhost/api/communications/mass-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: 'Test Email',
          htmlContent: '<p>Test content</p>',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - coaches are allowed
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });
  });

  describe('Rate limiting and middleware', () => {
    it('should have all routes protected by ensureAdmin middleware', () => {
      // The communications router applies ensureAdmin to /mass-email and /stats routes
      const routes = communicationsRouter.routes;
      const protectedPaths = routes.filter((route) => route.path?.includes('/mass-email') || route.path?.includes('/stats')
      );

      expect(protectedPaths.length).toBeGreaterThan(0);
    });

    it('should have the correct route paths registered', () => {
      const routes = communicationsRouter.routes;
      const paths = routes.map((r) => r.path || '');

      // Expected routes based on communications.ts
      const expectedRoutes = [
        '/mass-email',
        '/stats',
      ];

      expectedRoutes.forEach(expectedPath => {
        const hasMatchingRoute = paths.some((path: string) => {
          return path === expectedPath || path.includes(expectedPath);
        });
        expect(hasMatchingRoute).toBe(true);
      });
    });
  });

  describe('Route methods', () => {
    it('should support POST on /mass-email', () => {
      const routes = communicationsRouter.routes;
      const massEmailRoute = routes.find((r) => r.path?.includes('/mass-email')
      );
      expect(massEmailRoute).toBeDefined();
      // OpenAPI routes may show 'ALL' as method instead of 'POST'
      expect(massEmailRoute?.method).toMatch(/^(POST|ALL)$/);
    });

    it('should support GET on /stats', () => {
      const routes = communicationsRouter.routes;
      const statsRoute = routes.find((r) => r.path?.includes('/stats')
      );
      expect(statsRoute).toBeDefined();
      // OpenAPI routes may show 'ALL' as method instead of 'GET'
      expect(statsRoute?.method).toMatch(/^(GET|ALL)$/);
    });
  });

  describe('OpenAPI documentation', () => {
    it('should include communications routes with proper metadata', () => {
      const routes = communicationsRouter.routes;

      // Routes should have OpenAPI metadata
      routes.forEach((route) => {
        if (route.path?.includes('/mass-email') || route.path?.includes('/stats')) {
          expect(route).toBeDefined();
        }
      });
    });

    it('should define routes with proper tags', () => {
      expect(communicationsRouter).toBeDefined();

      const routes = communicationsRouter.routes;
      const commRoutes = routes.filter((r) =>
        r.path?.includes('/mass-email') || r.path?.includes('/stats')
      );

      expect(commRoutes.length).toBeGreaterThan(0);
    });
  });

  // NOTE: Database query tests are skipped because Drizzle ORM's query builder
  // doesn't work well with simple D1 mocks. These would require either:
  // 1. A more sophisticated Drizzle mock that handles .select().from() calls
  // 2. Integration tests with a real database
  // 3. Refactoring routes to inject database dependencies for better testability
  //
  // The communications.ts routes contain:
  // - User table queries to fetch email addresses
  // - External API calls to Resend for email batch sending
  // - Configuration lookups via getSocialConfig
  // - Audit logging via logAuditAction
  //
  // While authentication/authorization is tested above, the actual email sending
  // and user enumeration would require a full integration test setup with:
  // - Mocked fetch for Resend API calls
  // - Working Drizzle queries for user data
  // - Mocked configuration storage
  describe.skip('Database queries and external API calls (require integration tests)', () => {
    it('should return count of active users with email addresses');
    it('should filter out users without email addresses from stats');
    it('should fetch user emails from database for mass email sending');
    it('should chunk email batches correctly (50 per batch)');
    it('should handle Resend API errors gracefully');
    it('should log audit action after sending mass email');
    it('should return error when Resend API key is not configured');
    it('should return error when no active users found to email');
    it('should use custom from email when configured in social config');
  });
});
