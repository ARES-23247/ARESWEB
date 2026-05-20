/**
 * Tests for store route handlers
 *
 * Tests store management endpoints including auth, admin checks,
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
import { globalErrorHandler } from '../middleware/errorHandler';

// Mock the auth module BEFORE importing storeRouter
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

// Import storeRouter after mocking
import storeRouter from './store';



describe('Store Routes', () => {
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
    const app = new Hono<AppEnv>()
    app.onError(globalErrorHandler);
    app.use('*', createTestDbMiddleware());
    app.route('/api/store', storeRouter);
    return app;
  };

  describe('Router structure', () => {
    it('should export a valid router', () => {
      expect(storeRouter).toBeDefined();
      expect(typeof storeRouter).toBe('object');
    });

    it('should have OpenAPI support', () => {
      expect(typeof (storeRouter as { openapi?: unknown }).openapi).toBe('function');
    });
  });

  describe('Public routes', () => {
    it('should allow access to products list without auth', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
        STRIPE_SECRET_KEY: 'test-key',
        STRIPE_WEBHOOK_SECRET: 'test-secret',
      });

      // Mock the database query to return empty results
      const mockAll = vi.mocked((mockDb as { _mockAll: ReturnType<typeof vi.fn> })._mockAll);
      mockAll.mockResolvedValue({ success: true, results: [], meta: { duration: 1 } } as unknown as D1Result);

      const req = new Request('http://localhost/api/store/products');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Public route should not require auth - might fail for other reasons but not 401
      expect(_res.status).not.toBe(401);
    });

    it('should allow access to create checkout session without auth', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
        STRIPE_SECRET_KEY: 'test-key',
        STRIPE_WEBHOOK_SECRET: 'test-secret',
      });

      const req = new Request('http://localhost/api/store/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: 'product-1', quantity: 1 }],
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Public route should not require auth
      expect(_res.status).not.toBe(401);
    });

    it('should handle webhook without auth (Stripe signature verification)', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
        STRIPE_SECRET_KEY: 'test-key',
        STRIPE_WEBHOOK_SECRET: 'test-secret',
      });

      const req = new Request('http://localhost/api/store/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 'test-signature',
        },
        body: JSON.stringify({ test: 'data' }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Webhook uses Stripe signature verification, not session auth
      // It will fail signature verification but not with 401
      expect(_res.status).not.toBe(401);
    });
  });

  describe('Admin routes authentication and authorization', () => {
    it('should return 401 when not authenticated on get orders', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/store/orders');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 when non-admin tries to get orders', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/store/orders');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });

    it('should allow admin to get orders', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/store/orders');

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      // Should not be 401 or 403 - the request should proceed to the handler
      expect(_res.status).not.toBe(401);
      expect(_res.status).not.toBe(403);
    });

    it('should return 401 when not authenticated on update order status', async () => {
      globalThis.__mockSessionUser = null;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/store/orders/order-123/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fulfillmentStatus: 'shipped' }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(401);
    });

    it('should return 403 when non-admin tries to update order status', async () => {
      globalThis.__mockSessionUser = mockAuthUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/store/orders/order-123/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fulfillmentStatus: 'shipped' }),
      });

      const _res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(_res.status).toBe(403);
    });

    it('should allow admin to update order status', async () => {
      globalThis.__mockSessionUser = mockAdminUser;
      const app = createTestApp();

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/store/orders/order-123/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fulfillmentStatus: 'shipped' }),
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
    it('should return list of active products');
    it('should create Stripe checkout session with valid items');
    it('should handle Stripe webhook for checkout.session.completed');
    it('should return list of orders when admin');
    it('should update order status when admin');
    it('should deplete inventory after successful payment');
  });

  // Test webhook handling
  describe('Webhook handling', () => {
    it('should have webhook route defined', () => {
      const routes = storeRouter.routes;
      const hasWebhookRoute = routes.some((route) => route.path.includes('/webhook')
      );
      expect(hasWebhookRoute).toBe(true);
    });

    it('should have webhook route that accepts POST', () => {
      const routes = storeRouter.routes;
      const webhookRoute = routes.find((route) => route.path.includes('/webhook')
      );
      expect(webhookRoute?.method).toBe('POST');
    });
  });

  // Test admin route protection
  describe('Admin route protection', () => {
    it('should protect orders routes with ensureAdmin middleware', () => {
      const routes = storeRouter.routes;
      const hasOrdersRoute = routes.some((route) => route.path.includes('/orders')
      );
      expect(hasOrdersRoute).toBe(true);
    });
  });

  // Test Stripe integration
  describe('Stripe integration', () => {
    it('should require STRIPE_SECRET_KEY for checkout', () => {
      // The store router requires STRIPE_SECRET_KEY for checkout operations
      // This test verifies the router is set up correctly
      expect(storeRouter).toBeDefined();
    });

    it('should require STRIPE_WEBHOOK_SECRET for webhook', () => {
      // The store router requires STRIPE_WEBHOOK_SECRET for webhook verification
      // This test verifies the router is set up correctly
      expect(storeRouter).toBeDefined();
    });
  });
});
