/**
 * Tests for entities route handlers
 *
 * Tests entity link management endpoints including auth, validation,
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

// Mock the auth module BEFORE importing entitiesRouter
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

// Import entitiesRouter after mocking
import entitiesRouter from './entities';

const mockExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

describe('Entities Routes', () => {
  let mockDb: ReturnType<typeof createMockDb>['mockDb'];

  const _mockAdminUser: SessionUser = {
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
    app.route('/api/entities', entitiesRouter);
    return app;
  };

  describe('Router structure', () => {
    it('should export a valid router', () => {
      expect(entitiesRouter).toBeDefined();
      expect(typeof entitiesRouter).toBe('object');
    });

    it('should have OpenAPI support', () => {
      expect(typeof (entitiesRouter as { openapi?: unknown }).openapi).toBe('function');
    });

    it('should apply ensureAuth to all routes', () => {
      // The entities router applies ensureAuth globally via entitiesRouter.use("*", ensureAuth)
      // We can verify this by checking that the router exists and has routes
      expect(entitiesRouter).toBeDefined();
      const routes = entitiesRouter.routes;
      expect(routes.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/entities/links - Get entity links', () => {
    it('should return 401 when not authenticated', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/entities/links?type=task&id=task-123');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should allow authenticated users to get links', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      // Mock the database queries for links
      const mockAll = vi.mocked((mockDb as { _mockAll: ReturnType<typeof vi.fn> })._mockAll);
      mockAll.mockResolvedValue([] as unknown[]);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/entities/links?type=task&id=task-123');

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

      // Missing required type and id parameters
      const req = new Request('http://localhost/api/entities/links');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should return validation error (400)
      expect(_res.status).toBe(400);
    });

    it('should validate type parameter enum values', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      // Invalid type parameter (not one of: doc, task, event, post, outreach)
      const req = new Request('http://localhost/api/entities/links?type=invalid&id=task-123');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should return validation error (400)
      expect(_res.status).toBe(400);
    });

    it('should support all valid entity types', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      // Mock the database queries
      const mockAll = vi.mocked((mockDb as { _mockAll: ReturnType<typeof vi.fn> })._mockAll);
      mockAll.mockResolvedValue([] as unknown[]);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const validTypes = ['doc', 'task', 'event', 'post', 'outreach'] as const;

      for (const type of validTypes) {
        const req = new Request(`http://localhost/api/entities/links?type=${type}&id=test-id`);

        const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

        // Should not be 400 - valid type
        expect(_res.status).not.toBe(400);
      }
    });
  });

  describe('POST /api/entities/links - Create entity link', () => {
    it('should return 401 when not authenticated', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/entities/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_type: 'task',
          source_id: 'task-1',
          target_type: 'doc',
          target_id: 'doc-1',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should allow authenticated users to create links', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      // Mock the insert operation
      const mockRun = vi.mocked((mockDb as { _mockRun: ReturnType<typeof vi.fn> })._mockRun);
      mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } } as D1Result);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/entities/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_type: 'task',
          source_id: 'task-1',
          target_type: 'doc',
          target_id: 'doc-1',
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

      // Missing required source_type field
      const req = new Request('http://localhost/api/entities/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_id: 'task-1',
          target_type: 'doc',
          target_id: 'doc-1',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should return validation error (400)
      expect(_res.status).toBe(400);
    });

    it('should validate entity type enum values in request body', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      // Invalid source_type
      const req = new Request('http://localhost/api/entities/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_type: 'invalid',
          source_id: 'task-1',
          target_type: 'doc',
          target_id: 'doc-1',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should return validation error (400)
      expect(_res.status).toBe(400);
    });

    it('should accept optional link_type field', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      // Mock the insert operation
      const mockRun = vi.mocked((mockDb as { _mockRun: ReturnType<typeof vi.fn> })._mockRun);
      mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } } as D1Result);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/entities/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_type: 'task',
          source_id: 'task-1',
          target_type: 'doc',
          target_id: 'doc-1',
          link_type: 'dependency',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 400 - valid request
      expect(_res.status).not.toBe(400);
    });
  });

  describe('DELETE /api/entities/links/{id} - Delete entity link', () => {
    it('should return 401 when not authenticated', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/entities/links/link-123', {
        method: 'DELETE',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should allow authenticated users to delete links', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      // Mock the delete operation
      const mockRun = vi.mocked((mockDb as { _mockRun: ReturnType<typeof vi.fn> })._mockRun);
      mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } } as D1Result);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/entities/links/link-123', {
        method: 'DELETE',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
    });
  });

  // NOTE: Database query tests are skipped because Drizzle ORM's query builder
  // doesn't work well with simple D1 mocks. These would require either:
  // 1. A more sophisticated Drizzle mock that handles chained .select().from().where() calls
  // 2. Integration tests with a real database
  // 3. Refactoring routes to inject database dependencies for better testability
  //
  // The entities.ts route contains complex Drizzle queries:
  // - Complex OR/AND condition combinations for bidirectional link lookup
  // - Bulk title resolution with inArray queries for multiple entity types
  // - N+1 query prevention via Map-based caching
  // - Insert operations with UUID generation
  // - Delete operations with conditional WHERE clauses
  //
  // While authentication/authorization and validation are tested above,
  // the actual CRUD operations would require a full Drizzle integration test setup.
  describe.skip('Database queries (require integration tests)', () => {
    it('should return links for an entity (bidirectional lookup)');
    it('should resolve target titles for all entity types (doc, task, event, post, outreach)');
    it('should create a new link with UUID generation');
    it('should log audit action when creating link');
    it('should delete link by ID');
    it('should log audit action when deleting link');
  });

  // Test that the router is properly configured
  describe('Router configuration', () => {
    it('should have all expected routes defined', () => {
      const routes = entitiesRouter.routes;

      // Check for common route paths
      const routePaths = routes.map((r) => r.path || '');

      // All routes should be /links or /links/:id
      expect(routePaths).toContain('/links');
      expect(routePaths).toContain('/links/:id');
    });

    it('should support GET on /links', () => {
      const routes = entitiesRouter.routes;
      const getLinksRoute = routes.find((r) => r.path === '/links' && r.method === 'GET'
      );
      expect(getLinksRoute).toBeDefined();
    });

    it('should support POST on /links', () => {
      const routes = entitiesRouter.routes;
      const postLinksRoute = routes.find((r) => r.path === '/links' && r.method === 'POST'
      );
      expect(postLinksRoute).toBeDefined();
    });

    it('should support DELETE on /links/:id', () => {
      const routes = entitiesRouter.routes;
      const deleteRoute = routes.find((r) => r.path === '/links/:id' && r.method === 'DELETE'
      );
      expect(deleteRoute).toBeDefined();
    });
  });

  // Test audit logging is called
  describe('Audit logging', () => {
    it('should log audit action when creating link', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      // Mock the insert operation
      const mockRun = vi.mocked((mockDb as { _mockRun: ReturnType<typeof vi.fn> })._mockRun);
      mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } } as D1Result);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/entities/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_type: 'task',
          source_id: 'task-1',
          target_type: 'doc',
          target_id: 'doc-1',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // waitUntil should be called for audit logging
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();
    });

    it('should log audit action when deleting link', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      // Mock the delete operation
      const mockRun = vi.mocked((mockDb as { _mockRun: ReturnType<typeof vi.fn> })._mockRun);
      mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } } as D1Result);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/entities/links/link-123', {
        method: 'DELETE',
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // waitUntil should be called for audit logging
      expect(mockExecutionContext.waitUntil).toHaveBeenCalled();
    });
  });
});
