/**
 * Tests for auth route handlers
 *
 * Tests authentication endpoints including session checking,
 * emergency session clearing, and test session creation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import authRouter from './auth';
import { createMockDb, createMockContext, mockSingleResult, mockMutationResult } from '../../test/test-env';

describe('Auth Routes', () => {
  let mockDb: ReturnType<typeof createMockDb>['mockDb'];

  beforeEach(() => {
    vi.clearAllMocks();
    const dbSetup = createMockDb();
    mockDb = dbSetup.mockDb;
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

  describe('GET /api/auth-check', () => {
    it('should return 401 when no session cookie is provided', async () => {
      // Create a test app
      const app = new Hono();
      app.route('/api/auth', authRouter);

      // Mock database to return null (no user found)
      const mockFirst = vi.mocked((mockDb as { _mockFirst: ReturnType<typeof vi.fn> })._mockFirst);
      mockFirst.mockResolvedValue(mockSingleResult(null));

      const req = new Request('http://localhost/api/auth/check', {
        headers: {
          'Cookie': 'better-auth.session_token=invalid-token',
        },
      });

      const res = await app.request(req, {
        env: {
          DB: mockDb,
          ENVIRONMENT: 'test',
        } as never,
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json).toEqual({ authenticated: false });
    });

    it('should return user data when valid session exists', async () => {
      const app = new Hono();
      app.route('/api/auth', authRouter);

      const mockUser = {
        id: 'admin-user',
        email: 'admin@ares.org',
        name: 'Admin User',
        role: 'admin',
        image: null,
      };

      const mockFirst = vi.mocked((mockDb as { _mockFirst: ReturnType<typeof vi.fn> })._mockFirst);
      mockFirst.mockResolvedValue(mockSingleResult(mockUser));

      const req = new Request('http://localhost/api/auth/check', {
        headers: {
          'Cookie': 'better-auth.session_token=valid-token',
        },
      });

      const res = await app.request(req, {
        env: {
          DB: mockDb,
          ENVIRONMENT: 'test',
        } as never,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
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
      const app = new Hono();
      app.route('/api/auth', authRouter);

      const req = new Request('http://localhost/api/auth/emergency-clear');

      const res = await app.request(req, {
        env: {
          DB: mockDb,
          ENVIRONMENT: 'test',
        } as never,
      });

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

  describe('POST /api/auth/test-login', () => {
    it('should return 403 when not in test environment', async () => {
      const app = new Hono();
      app.route('/api/auth', authRouter);

      const req = new Request('http://localhost/api/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: 'admin-user' }),
      });

      const res = await app.request(req, {
        env: {
          DB: mockDb,
          ENVIRONMENT: 'production', // Production environment
          DEV_BYPASS: 'false',
          CI: 'false',
        } as never,
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json).toHaveProperty('error');
    });

    it('should return 403 when test bypass header is not set', async () => {
      const app = new Hono();
      app.route('/api/auth', authRouter);

      const req = new Request('http://localhost/api/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: 'admin-user' }),
      });

      const res = await app.request(req, {
        env: {
          DB: mockDb,
          ENVIRONMENT: 'test',
          CI: 'false',
        } as never,
      });

      expect(res.status).toBe(403);
    });

    it('should create test session when test bypass header is provided', async () => {
      const app = new Hono();
      app.route('/api/auth', authRouter);

      const mockUser = {
        id: 'admin-user',
        name: 'Admin User',
        email: 'admin@ares.org',
        role: 'admin',
      };

      // Mock user lookup
      const mockFirst = vi.mocked((mockDb as { _mockFirst: ReturnType<typeof vi.fn> })._mockFirst);
      mockFirst.mockResolvedValueOnce(mockSingleResult(mockUser)); // User lookup
      mockFirst.mockResolvedValueOnce(mockSingleResult(null)); // Session check (returns null to verify insertion)

      // Mock session insertion
      const mockRun = vi.mocked((mockDb as { _mockRun: ReturnType<typeof vi.fn> })._mockRun);
      mockRun.mockResolvedValue(mockMutationResult(1, 'session-123'));

      const req = new Request('http://localhost/api/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-bypass-auth': 'true',
        },
        body: JSON.stringify({ userId: 'admin-user' }),
      });

      const res = await app.request(req, {
        env: {
          DB: mockDb,
          ENVIRONMENT: 'test',
        } as never,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('success', true);
      expect(json).toHaveProperty('user');
      expect(json.user).toHaveProperty('id', 'admin-user');
      expect(json).toHaveProperty('sessionToken');

      // Verify cookie is set
      const setCookieHeaders = res.headers.getSetCookie();
      const sessionCookie = setCookieHeaders.find(h => h.startsWith('better-auth.session_token='));
      expect(sessionCookie).toBeDefined();
    });

    it('should default to admin-user when no userId is provided', async () => {
      const app = new Hono();
      app.route('/api/auth', authRouter);

      const mockUser = {
        id: 'admin-user',
        name: 'Admin User',
        email: 'admin@ares.org',
        role: 'admin',
      };

      const mockFirst = vi.mocked((mockDb as { _mockFirst: ReturnType<typeof vi.fn> })._mockFirst);
      mockFirst.mockResolvedValueOnce(mockSingleResult(mockUser));
      mockFirst.mockResolvedValueOnce(mockSingleResult(null));

      const mockRun = vi.mocked((mockDb as { _mockRun: ReturnType<typeof vi.fn> })._mockRun);
      mockRun.mockResolvedValue(mockMutationResult(1, 'session-123'));

      const req = new Request('http://localhost/api/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-bypass-auth': 'true',
        },
        body: JSON.stringify({}), // No userId
      });

      const res = await app.request(req, {
        env: {
          DB: mockDb,
          ENVIRONMENT: 'test',
        } as never,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.user.id).toBe('admin-user');
    });

    it('should return 404 when test user does not exist', async () => {
      const app = new Hono();
      app.route('/api/auth', authRouter);

      const mockFirst = vi.mocked((mockDb as { _mockFirst: ReturnType<typeof vi.fn> })._mockFirst);
      mockFirst.mockResolvedValue(mockSingleResult(null)); // User not found

      const req = new Request('http://localhost/api/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-bypass-auth': 'true',
        },
        body: JSON.stringify({ userId: 'nonexistent-user' }),
      });

      const res = await app.request(req, {
        env: {
          DB: mockDb,
          ENVIRONMENT: 'test',
        } as never,
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json).toHaveProperty('error', 'Test user not found');
    });
  });
});
