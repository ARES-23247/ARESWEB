import { describe, it, expect } from 'vitest';
import authRouter from './auth';
import usersRouter from './users';
import postsRouter from './posts';
import tasksRouter from './tasks';
import inquiriesRouter from './inquiries/index';
import eventsRouter from './events/index';

type RouteMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type RouteInfo = { method: RouteMethod; path: string };

interface OpenAPIRouter {
  openapi: (...args: unknown[]) => unknown;
  routes: RouteInfo[];
}

function asOpenAPIRouter(router: unknown): OpenAPIRouter {
  return router as OpenAPIRouter;
}

function getRoutes(router: unknown): RouteInfo[] {
  return (asOpenAPIRouter(router).routes || []) as RouteInfo[];
}

function hasRouteWithMethod(routes: RouteInfo[], method: RouteMethod): boolean {
  return routes.some(r => r.method === method);
}

function hasRouteWithPathPattern(routes: RouteInfo[], pattern: RegExp): boolean {
  return routes.some(r => pattern.test(r.path));
}

describe('API route integration', () => {
  describe('auth routes', () => {
    const routes = getRoutes(authRouter);

    it('exports a valid OpenAPIHono router', () => {
      expect(authRouter).toBeDefined();
      expect(typeof asOpenAPIRouter(authRouter).openapi).toBe('function');
      expect(routes.length).toBeGreaterThan(0);
    });

    it('has auth-check route', () => {
      expect(hasRouteWithPathPattern(routes, /auth-check/)).toBe(true);
    });

    it('has test-login route', () => {
      expect(hasRouteWithPathPattern(routes, /test-login/)).toBe(true);
    });

    it('has GET method routes', () => {
      expect(hasRouteWithMethod(routes, 'GET')).toBe(true);
    });

    it('has POST method routes', () => {
      expect(hasRouteWithMethod(routes, 'POST')).toBe(true);
    });
  });

  describe('users routes', () => {
    const routes = getRoutes(usersRouter);

    it('exports a valid OpenAPIHono router', () => {
      expect(usersRouter).toBeDefined();
      expect(typeof asOpenAPIRouter(usersRouter).openapi).toBe('function');
      expect(routes.length).toBeGreaterThan(0);
    });

    it('has PATCH method routes', () => {
      expect(hasRouteWithMethod(routes, 'PATCH')).toBe(true);
    });

    it('has DELETE method routes', () => {
      expect(hasRouteWithMethod(routes, 'DELETE')).toBe(true);
    });
  });

  describe('posts routes', () => {
    const routes = getRoutes(postsRouter);

    it('exports a valid OpenAPIHono router', () => {
      expect(postsRouter).toBeDefined();
      expect(typeof asOpenAPIRouter(postsRouter).openapi).toBe('function');
      expect(routes.length).toBeGreaterThan(0);
    });

    it('has GET method routes', () => {
      expect(hasRouteWithMethod(routes, 'GET')).toBe(true);
    });

    it('has POST method routes', () => {
      expect(hasRouteWithMethod(routes, 'POST')).toBe(true);
    });

    it('has DELETE method routes', () => {
      expect(hasRouteWithMethod(routes, 'DELETE')).toBe(true);
    });
  });

  describe('tasks routes', () => {
    const routes = getRoutes(tasksRouter);

    it('exports a valid OpenAPIHono router', () => {
      expect(tasksRouter).toBeDefined();
      expect(typeof asOpenAPIRouter(tasksRouter).openapi).toBe('function');
      expect(routes.length).toBeGreaterThan(0);
    });

    it('has root GET route', () => {
      expect(hasRouteWithMethod(routes, 'GET') && routes.some(r => r.method === 'GET' && r.path === '/')).toBe(true);
    });

    it('has root POST route', () => {
      expect(hasRouteWithMethod(routes, 'POST') && routes.some(r => r.method === 'POST' && r.path === '/')).toBe(true);
    });

    it('has reorder route', () => {
      expect(hasRouteWithPathPattern(routes, /reorder/)).toBe(true);
    });

    it('has PATCH routes', () => {
      expect(hasRouteWithMethod(routes, 'PATCH')).toBe(true);
    });

    it('has DELETE routes', () => {
      expect(hasRouteWithMethod(routes, 'DELETE')).toBe(true);
    });
  });

  describe('inquiries routes', () => {
    const routes = getRoutes(inquiriesRouter);

    it('exports a valid OpenAPIHono router', () => {
      expect(inquiriesRouter).toBeDefined();
      expect(typeof asOpenAPIRouter(inquiriesRouter).openapi).toBe('function');
      expect(routes.length).toBeGreaterThan(0);
    });

    it('has GET method routes', () => {
      expect(hasRouteWithMethod(routes, 'GET')).toBe(true);
    });

    it('has POST method routes', () => {
      expect(hasRouteWithMethod(routes, 'POST')).toBe(true);
    });

    it('has PATCH method routes', () => {
      expect(hasRouteWithMethod(routes, 'PATCH')).toBe(true);
    });
  });

  describe('events routes', () => {
    const routes = getRoutes(eventsRouter);

    it('exports a valid OpenAPIHono router', () => {
      expect(eventsRouter).toBeDefined();
      expect(typeof asOpenAPIRouter(eventsRouter).openapi).toBe('function');
      expect(routes.length).toBeGreaterThan(0);
    });

    it('has GET method routes', () => {
      expect(hasRouteWithMethod(routes, 'GET')).toBe(true);
    });

    it('has POST method routes', () => {
      expect(hasRouteWithMethod(routes, 'POST')).toBe(true);
    });

    it('has PATCH method routes', () => {
      expect(hasRouteWithMethod(routes, 'PATCH')).toBe(true);
    });

    it('has DELETE method routes', () => {
      expect(hasRouteWithMethod(routes, 'DELETE')).toBe(true);
    });
  });

  describe('cross-router consistency', () => {
    const routers = [
      { name: 'auth', router: authRouter },
      { name: 'users', router: usersRouter },
      { name: 'posts', router: postsRouter },
      { name: 'tasks', router: tasksRouter },
      { name: 'inquiries', router: inquiriesRouter },
      { name: 'events', router: eventsRouter },
    ];

    it('all routers have defined route arrays', () => {
      routers.forEach(({ router }) => {
        expect(asOpenAPIRouter(router).routes).toBeDefined();
      });
    });

    it('all routers have routes defined', () => {
      routers.forEach(({ router }) => {
        const routes = getRoutes(router);
        expect(routes.length).toBeGreaterThan(0);
      });
    });

    it('all routers use OpenAPI registration', () => {
      routers.forEach(({ router }) => {
        expect(typeof asOpenAPIRouter(router).openapi).toBe('function');
      });
    });
  });
});
