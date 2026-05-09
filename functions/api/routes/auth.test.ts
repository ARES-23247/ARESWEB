/**
 * Tests for auth route handlers
 *
 * Tests authentication endpoints including session checking,
 * emergency session clearing, and test session creation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import authRouter from './auth';
import { createMockDb, createTestEnv, mockSingleResult, createTestDbMiddleware } from '../../test/test-env';
import { AppEnv } from '../middleware';
import * as authUtils from '../middleware/auth';
import { globalErrorHandler } from '../middleware/errorHandler';
import type { SessionUser } from '../middleware/utils';

// Create a mock execution context for tests
const mockExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

describe('Auth Routes', () => {
  let mockDb: ReturnType<typeof createMockDb>['mockDb'];

  beforeEach(() => {
    const dbSetup = createMockDb();
    mockDb = dbSetup.mockDb;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Router structure', () => {
    it('should export a valid router', () => {
      expect(authRouter).toBeDefined();
      expect(typeof authRouter).toBe('object');
    });

    it('should have OpenAPI support', () => {
      expect(typeof (authRouter as { openapi?: unknown }).openapi).toBe('function');
    });
  });

  describe('GET /api/auth/auth-check', () => {
    it('should return 401 when no session cookie is provided', async () => {
      // Create a test app with db middleware
      const app = new Hono<AppEnv>();
      app.onError(globalErrorHandler);
      app.use('*', createTestDbMiddleware());
      app.route('/api/auth', authRouter);

      // Mock database to return null (no user found)
      const mockFirst = vi.mocked((mockDb as { _mockFirst: ReturnType<typeof vi.fn> })._mockFirst);
      mockFirst.mockResolvedValue(mockSingleResult(null));

      // IMPORTANT: Disable DEV_BYPASS to prevent "local-dev" user from being returned
      // Otherwise isDevBypassEnabled() returns true and getSessionUser() returns
      // the hardcoded local-dev user without hitting the database
      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/auth/auth-check', {
        headers: {
          'Cookie': 'better-auth.session_token=invalid-token',
        },
      });

      const res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(res.status).toBe(401);
      const json = (await res.json()) as unknown;
      expect(json).toEqual({ authenticated: false });
    });

    it('should return user data when valid session exists', async () => {
      const app = new Hono<AppEnv>();
      app.onError(globalErrorHandler);
      app.use('*', createTestDbMiddleware());
      app.route('/api/auth', authRouter);

      const mockUser = {
        id: 'admin-user',
        email: 'admin@ares.org',
        name: 'Admin User',
        role: 'admin',
        image: null,
      };

      // NOTE: Better Auth uses Drizzle adapter which doesn't use our D1 mock directly.
      // We mock at a higher level by spying on getSessionUser from the auth middleware.
      const getSessionUserSpy = vi.spyOn(authUtils, 'getSessionUser')
        .mockResolvedValue(mockUser as SessionUser);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/auth/auth-check', {
        headers: {
          'Cookie': 'better-auth.session_token=valid-token',
        },
      });

      const res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(res.status).toBe(200);
      const json = (await res.json()) as unknown;
      expect(getSessionUserSpy).toHaveBeenCalled();
      expect(json).toEqual({
        authenticated: true,
        user: {
          id: 'admin-user',
          email: 'admin@ares.org',
          name: 'Admin User',
          role: 'admin',
          image: null,
        },
      });
    });
  });

  describe('GET /api/auth/emergency-clear', () => {
    it('should redirect to home and clear cookies', async () => {
      const app = new Hono<AppEnv>();
      app.onError(globalErrorHandler);
      app.use('*', createTestDbMiddleware());
      app.route('/api/auth', authRouter);

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        DEV_BYPASS: 'false',
      });

      const req = new Request('http://localhost/api/auth/emergency-clear');

      const res = await app.request(req, undefined, testEnv, mockExecutionContext);

      expect(res.status).toBe(302); // Redirect status
      expect(res.headers.get('Location')).toBe('/');

      // Verify cookies are being cleared
      const setCookieHeaders = res.headers.getSetCookie();
      expect(setCookieHeaders.length).toBeGreaterThan(0);

      // Check that session cookies are being cleared (Max-Age=0)
      for (const header of setCookieHeaders) {
        if (header.includes('better-auth.session_token')) {
          expect(header).toContain('Max-Age=0');
        }
      }
    });
  });

  // NOTE: The test-login endpoint requires complex database mocking for Drizzle.
  // These tests are skipped for now - they require integration tests or proper Drizzle mocks.
  describe.skip('POST /api/auth/test-login', () => {
    it('should return 403 when not in test environment', async () => {
      const app = new Hono<AppEnv>();
      app.onError(globalErrorHandler);
      app.use('*', createTestDbMiddleware());
      app.route('/api/auth', authRouter);

      const req = new Request('http://localhost/api/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: 'admin-user' }),
      });

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        ENVIRONMENT: 'production', // Production environment
        DEV_BYPASS: 'false',
      });
      const res = await app.request(req, undefined, testEnv);

      expect(res.status).toBe(403);
      const json = (await res.json()) as unknown;
      expect(json).toHaveProperty('error');
    });

    it('should return 403 when test bypass header is not set', async () => {
      const app = new Hono<AppEnv>();
      app.onError(globalErrorHandler);
      app.use('*', createTestDbMiddleware());
      app.route('/api/auth', authRouter);

      const req = new Request('http://localhost/api/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: 'admin-user' }),
      });

      const testEnv = createTestEnv({
        DB: mockDb as AppEnv['Bindings']['DB'],
        ENVIRONMENT: 'test',
      });
      const res = await app.request(req, undefined, testEnv);

      expect(res.status).toBe(403);
    });

    it('should create test session when test bypass header is provided', async () => {
      // This test requires mocking Drizzle queries
      // Skipping for now
    });

    it('should default to admin-user when no userId is provided', async () => {
      // This test requires mocking Drizzle queries
      // Skipping for now
    });

    it('should return 404 when test user does not exist', async () => {
      // This test requires mocking Drizzle queries
      // Skipping for now
    });
  });
});
