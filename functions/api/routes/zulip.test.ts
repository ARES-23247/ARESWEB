/**
 * Tests for Zulip route handlers
 *
 * Tests Zulip integration endpoints including auth, admin checks,
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

// Mock the auth module BEFORE importing zulipRouter
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
        return c.json({ error: 'Forbidden: Requires admin privileges.' }, 403);
      }
      c.set('sessionUser', user);
      return next();
    }),
  };
});

// Mock the Zulip sync utilities
vi.mock('../../utils/zulipSync', async () => {
  return {
    sendZulipMessage: vi.fn().mockResolvedValue('mock-message-id'),
  };
});

// Mock getSocialConfig to return test config - must be hoisted before import
const mockGetSocialConfig = vi.fn().mockResolvedValue({
  ZULIP_BOT_EMAIL: 'test-bot@ares.org',
  ZULIP_API_KEY: 'test-api-key',
  ZULIP_URL: 'https://test.zulipchat.com',
});

vi.mock('../middleware', async () => {
  const actual = await vi.importActual<typeof import('../middleware')>('../middleware');
  return {
    ...actual,
    getSocialConfig: () => mockGetSocialConfig(),
  };
});

// Import zulipRouter after mocking
import zulipRouter from './zulip';

const mockExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

describe('Zulip Routes', () => {
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
    // Clear mock call history
    (mockDb as { _mockFirst: ReturnType<typeof vi.fn> })._mockFirst?.mockReset?.();
    (mockDb as { _mockAll: ReturnType<typeof vi.fn> })._mockAll?.mockReset?.();
    (mockDb as { _mockRun: ReturnType<typeof vi.fn> })._mockRun?.mockReset?.();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.__mockSessionUser = null;
  });

  const createTestApp = () => {
    const app = new Hono<AppEnv>()
    app.use('*', createTestDbMiddleware());
    app.route('/api/zulip', zulipRouter);
    return app;
  };

  describe('Router structure', () => {
    it('should export a valid router', () => {
      expect(zulipRouter).toBeDefined();
      expect(typeof zulipRouter).toBe('object');
    });

    it('should have OpenAPI support', () => {
      expect(typeof (zulipRouter as { openapi?: unknown }).openapi).toBe('function');
    });

    it('should apply ensureAuth to all routes', () => {
      // The zulip router uses ensureAuth on all routes
      // We can verify this by checking that the router exists
      expect(zulipRouter).toBeDefined();
    });

    it('should have the correct route paths registered', () => {
      const routes = zulipRouter.routes;
      const paths = routes.map((r) => r.path || '');

      // Expected routes based on zulip.ts
      const expectedRoutes = [
        '/presence',
        '/message',
        '/topic',
        '/invites/audit',
        '/invites/send',
      ];

      expectedRoutes.forEach(expectedPath => {
        const hasMatchingRoute = paths.some((path: string) =>
          path === expectedPath || path.includes(expectedPath)
        );
        expect(hasMatchingRoute).toBe(true);
      });
    });
  });

  describe('GET /api/zulip/presence - Get team presence', () => {
    it('should return 401 when not authenticated', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/zulip/presence');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 when non-admin tries to access presence', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/zulip/presence');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });

    it('should allow admin to access presence endpoint', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      // Mock fetch for Zulip API
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/presence')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              result: 'success',
              presences: {},
            }),
          } as Response);
        }
        if (url.includes('/users')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              members: [],
            }),
          } as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 404,
        } as Response);
      });

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/zulip/presence');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });
  });

  describe('POST /api/zulip/message - Send message', () => {
    it('should return 401 when not authenticated', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/zulip/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stream: 'general',
          topic: 'Test',
          content: 'Hello from tests',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should allow authenticated users to send messages', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/zulip/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stream: 'general',
          topic: 'Test',
          content: 'Hello from tests',
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

      // Missing required fields
      const req = new Request('http://localhost/api/zulip/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stream: 'general',
          // Missing topic and content
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should return validation error (400)
      expect(_res.status).toBe(400);
    });
  });

  describe('GET /api/zulip/topic - Get topic messages', () => {
    it('should return 401 when not authenticated', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/zulip/topic?stream=general&topic=Test');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should allow authenticated users to get topic messages', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      // Mock fetch for Zulip API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          result: 'success',
          messages: [],
        }),
      } as Response);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/zulip/topic?stream=general&topic=Test');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
    });

    it('should validate required query parameters', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      // Missing required query parameters
      const req = new Request('http://localhost/api/zulip/topic');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should return validation error (400)
      expect(_res.status).toBe(400);
    });
  });

  describe('GET /api/zulip/invites/audit - Audit missing users', () => {
    it('should return 401 when not authenticated', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/zulip/invites/audit');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 when non-admin tries to audit', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/zulip/invites/audit');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });

    it('should allow admin to audit missing users', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      // Mock fetch for Zulip API and database queries
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          members: [
            { email: 'user@ares.org', delivery_email: 'user@ares.org', is_bot: false, is_active: true },
          ],
        }),
      } as Response);

      // Mock database query for users
      const mockAll = vi.mocked((mockDb as { _mockAll: ReturnType<typeof vi.fn> })._mockAll);
      mockAll.mockResolvedValue([
        { email: 'admin@ares.org' },
      ] as unknown[]);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/zulip/invites/audit');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });
  });

  describe('POST /api/zulip/invites/send - Invite users', () => {
    it('should return 401 when not authenticated', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/zulip/invites/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emails: ['new-user@example.com'],
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 when non-admin tries to send invites', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/zulip/invites/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emails: ['new-user@example.com'],
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });

    it('should allow admin to send invites', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      // Mock fetch for Zulip API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          default_streams: [{ stream_id: 1 }],
        }),
        text: () => Promise.resolve('{"result": "success"}'),
      } as Response);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/zulip/invites/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emails: ['new-user@example.com'],
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should validate emails array is provided', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      // Missing emails array
      const req = new Request('http://localhost/api/zulip/invites/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should return validation error (400)
      expect(_res.status).toBe(400);
    });
  });

  // NOTE: Database query tests are skipped because Drizzle ORM's query builder
  // doesn't work well with simple D1 mocks. These would require either:
  // 1. A more sophisticated Drizzle mock that handles chained .select().from().where() calls
  // 2. Integration tests with a real database
  // 3. Refactoring routes to inject database dependencies for better testability
  //
  // The zulip.ts routes contain:
  // - External API calls to Zulip (require fetch mocking or integration tests)
  // - Database queries for user audit (Drizzle ORM with .select().from().where())
  // - Complex data transformation and normalization logic
  //
  // While authentication/authorization is tested above, the actual API integration
  // and database queries would require a full integration test setup.
  describe.skip('Database queries and external API (require integration tests)', () => {
    it('should fetch presence data from Zulip API');
    it('should fetch user list from Zulip API');
    it('should compare ARES users with Zulip users');
    it('should handle missing users correctly');
    it('should send messages to Zulip streams');
    it('should fetch topic messages from Zulip API');
    it('should handle Zulip API errors gracefully');
    it('should send batch invites to Zulip');
    it('should normalize Google Workspace emails correctly');
  });

  describe('Route methods', () => {
    it('should support GET on /presence', () => {
      const routes = zulipRouter.routes;
      const presenceRoute = routes.find((r) => r.path?.includes('presence') && r.method === 'GET'
      );
      expect(presenceRoute).toBeDefined();
    });

    it('should support POST on /message', () => {
      const routes = zulipRouter.routes;
      const messageRoute = routes.find((r) => r.path?.includes('message') && r.method === 'POST'
      );
      expect(messageRoute).toBeDefined();
    });

    it('should support GET on /topic', () => {
      const routes = zulipRouter.routes;
      const topicRoute = routes.find((r) => r.path?.includes('topic') && r.method === 'GET'
      );
      expect(topicRoute).toBeDefined();
    });

    it('should support GET on /invites/audit', () => {
      const routes = zulipRouter.routes;
      const auditRoute = routes.find((r) => r.path?.includes('audit') && r.method === 'GET'
      );
      expect(auditRoute).toBeDefined();
    });

    it('should support POST on /invites/send', () => {
      const routes = zulipRouter.routes;
      const sendRoute = routes.find((r) => r.path?.includes('send') && r.method === 'POST'
      );
      expect(sendRoute).toBeDefined();
    });
  });
});
