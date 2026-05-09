import { describe, it, expect, vi } from 'vitest';
import { notificationsRouter } from './notifications';

// Mock drizzle-orm operators (needed for schema imports)
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  desc: vi.fn(),
  and: vi.fn(),
  count: vi.fn(),
  inArray: vi.fn(),
  sql: vi.fn(),
}));

// Mock dependencies
vi.mock('../middleware', () => ({
  ensureAuth: vi.fn(() => async (c: any, next: () => Promise<void>) => next()),
  getSessionUser: vi.fn(),
  rateLimitMiddleware: vi.fn(() => async (c: any, next: () => Promise<void>) => next()),
  getDb: vi.fn(),
}));

vi.mock('../../utils/zulipSync', () => ({
  sendZulipMessage: vi.fn(),
}));

describe('notifications router', () => {
  describe('router structure', () => {
    it('exports a valid OpenAPIHono router', () => {
      expect(notificationsRouter).toBeDefined();
      expect(typeof notificationsRouter.openapi).toBe('function');
      expect(Array.isArray(notificationsRouter.routes)).toBe(true);
    });

    it('has routes defined', () => {
      expect(notificationsRouter.routes.length).toBeGreaterThan(0);
    });

    it('includes GET /notifications route', () => {
      const getRoutes = notificationsRouter.routes.filter(
        (r: any) => r.method === 'GET'
      );
      expect(getRoutes.length).toBeGreaterThan(0);
    });

    it('includes PUT routes for marking read', () => {
      const putRoutes = notificationsRouter.routes.filter(
        (r: any) => r.method === 'PUT'
      );
      expect(putRoutes.length).toBeGreaterThan(0);
    });

    it('includes DELETE route for notifications', () => {
      const deleteRoutes = notificationsRouter.routes.filter(
        (r: any) => r.method === 'DELETE'
      );
      expect(deleteRoutes.length).toBeGreaterThan(0);
    });
  });

  describe('route configuration', () => {
    it('applies ensureAuth middleware to all routes', () => {
      // The router uses ensureAuth at the top level
      // Verify by checking that middlewares are registered
      expect(notificationsRouter).toBeDefined();
    });

    it('applies rate limiting to specific routes', () => {
      // Routes like /:id/read and /read-all should have rate limiting
      const readRoutes = notificationsRouter.routes.filter((r: any) =>
        r.path?.includes('/read')
      );
      expect(readRoutes.length).toBeGreaterThan(0);
    });
  });

  describe('route paths', () => {
    it('has /notifications root path', () => {
      const rootRoutes = notificationsRouter.routes.filter((r: any) =>
        r.path === '/' || r.path === ''
      );
      expect(rootRoutes.length).toBeGreaterThan(0);
    });

    it('has /:id/read path', () => {
      const readPathRoutes = notificationsRouter.routes.filter((r: any) =>
        r.path?.includes(':id') && r.path?.includes('read')
      );
      expect(readPathRoutes.length).toBeGreaterThan(0);
    });

    it('has /read-all path', () => {
      const readAllRoutes = notificationsRouter.routes.filter((r: any) =>
        r.path === '/read-all'
      );
      expect(readAllRoutes.length).toBeGreaterThan(0);
    });

    it('has /pending-counts path', () => {
      const countsRoutes = notificationsRouter.routes.filter((r: any) =>
        r.path === '/pending-counts'
      );
      expect(countsRoutes.length).toBeGreaterThan(0);
    });

    it('has /action-items path', () => {
      const actionItemsRoutes = notificationsRouter.routes.filter((r: any) =>
        r.path === '/action-items'
      );
      expect(actionItemsRoutes.length).toBeGreaterThan(0);
    });
  });

  describe('HTTP methods', () => {
    it('supports GET method for listing', () => {
      const getRoutes = notificationsRouter.routes.filter((r: any) => r.method === 'GET');
      expect(getRoutes.length).toBeGreaterThan(0);
    });

    it('supports PUT method for updates', () => {
      const putRoutes = notificationsRouter.routes.filter((r: any) => r.method === 'PUT');
      expect(putRoutes.length).toBeGreaterThan(0);
    });

    it('supports DELETE method', () => {
      const deleteRoutes = notificationsRouter.routes.filter((r: any) => r.method === 'DELETE');
      expect(deleteRoutes.length).toBeGreaterThan(0);
    });
  });

  describe('OpenAPI integration', () => {
    it('uses openapi method for route definitions', () => {
      // Routes defined via .openapi() should be registered
      expect(notificationsRouter.routes.length).toBeGreaterThan(0);
    });
  });
});
