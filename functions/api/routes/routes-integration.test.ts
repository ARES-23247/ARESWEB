import { describe, it, expect } from 'vitest';
import authRouter from './auth';
import usersRouter from './users';
import postsRouter from './posts';
import tasksRouter from './tasks';
import inquiriesRouter from './inquiries/index';
import eventsRouter from './events/index';

// Define a type for OpenAPIHono router interface
interface OpenAPIRouter {
  openapi: (...args: unknown[]) => unknown;
  routes: unknown[];
}

// Helper function to cast router to OpenAPIRouter type
function asOpenAPIRouter(router: unknown): OpenAPIRouter {
  return router as OpenAPIRouter;
}

describe('API route modules', () => {
  describe('auth routes', () => {
    it('exports an auth router', () => {
      expect(authRouter).toBeDefined();
      expect(typeof asOpenAPIRouter(authRouter).openapi).toBe('function');
    });

    it('has routes defined', () => {
      expect(asOpenAPIRouter(authRouter).routes).toBeDefined();
      expect(asOpenAPIRouter(authRouter).routes.length).toBeGreaterThan(0);
    });
  });

  describe('users routes', () => {
    it('exports a users router', () => {
      expect(usersRouter).toBeDefined();
      expect(typeof asOpenAPIRouter(usersRouter).openapi).toBe('function');
    });

    it('has routes defined', () => {
      expect(asOpenAPIRouter(usersRouter).routes).toBeDefined();
      expect(asOpenAPIRouter(usersRouter).routes.length).toBeGreaterThan(0);
    });
  });

  describe('posts routes', () => {
    it('exports a posts router', () => {
      expect(postsRouter).toBeDefined();
      expect(typeof asOpenAPIRouter(postsRouter).openapi).toBe('function');
    });

    it('has routes defined', () => {
      expect(asOpenAPIRouter(postsRouter).routes).toBeDefined();
      expect(asOpenAPIRouter(postsRouter).routes.length).toBeGreaterThan(0);
    });
  });

  describe('tasks routes', () => {
    it('exports a tasks router', () => {
      expect(tasksRouter).toBeDefined();
      expect(typeof asOpenAPIRouter(tasksRouter).openapi).toBe('function');
    });

    it('has routes defined', () => {
      expect(asOpenAPIRouter(tasksRouter).routes).toBeDefined();
      expect(asOpenAPIRouter(tasksRouter).routes.length).toBeGreaterThan(0);
    });
  });

  describe('inquiries routes', () => {
    it('exports an inquiries router', () => {
      expect(inquiriesRouter).toBeDefined();
      expect(typeof asOpenAPIRouter(inquiriesRouter).openapi).toBe('function');
    });

    it('has routes defined', () => {
      expect(asOpenAPIRouter(inquiriesRouter).routes).toBeDefined();
      expect(asOpenAPIRouter(inquiriesRouter).routes.length).toBeGreaterThan(0);
    });
  });

  describe('events routes', () => {
    it('exports an events router', () => {
      expect(eventsRouter).toBeDefined();
      expect(typeof asOpenAPIRouter(eventsRouter).openapi).toBe('function');
    });

    it('has routes defined', () => {
      expect(asOpenAPIRouter(eventsRouter).routes).toBeDefined();
      expect(asOpenAPIRouter(eventsRouter).routes.length).toBeGreaterThan(0);
    });
  });
});
