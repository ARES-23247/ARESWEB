/**
 * Tests for auth route handlers
 *
 * Tests authentication endpoints including session checking,
 * emergency session clearing, and test session creation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import authRouter from './auth';
import { createMockDb, createTestEnv, createMockRequest, mockSingleResult, mockMutationResult } from '../../test/test-env';

describe('Auth Routes', () => {
  let mockDb: ReturnType<typeof createMockDb>['mockDb'];
  let mockEnv: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    const dbSetup = createMockDb();
    mockDb = dbSetup.mockDb;
    mockEnv = createTestEnv({ DB: mockDb } as typeof mockEnv);
  });

  describe('GET /api/auth-check', () => {
    it('should return authenticated: true with user data when session is valid', async () => {
      // Arrange: Mock database to return a valid user
      const mockUser = {
        id: 'admin-user',
        email: 'admin@ares.org',
        name: 'Admin User',
        role: 'admin',
        image: null,
      };

      vi.spyOn(mockDb, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockSingleResult(mockUser)),
        }),
      } as never);

      // Create a test app with the auth router
      const app = new Hono();
      app.route('/api/auth', authRouter);

      // Create mock request with session cookie
      const mockReq = createMockRequest('http://localhost/api/auth-check', {
        headers: {
          'Cookie': 'better-auth.session_token=valid-session-token',
        },
      });

      // Act: Call the route
      const res = await app.request(mockReq, { env: mockEnv });
      const json = await res.json() as { authenticated: boolean; user?: unknown };

      // Assert
      expect(res.status).toBe(200);
      expect(json.authenticated).toBe(true);
      expect(json.user).toBeDefined();
      expect(json.user).toEqual({
        id: 'admin-user',
        email: 'admin@ares.org',
        name: 'Admin User',
        role: 'admin',
        image: null,
      });
    });

    it('should return authenticated: false when no session exists', async () => {
      // Arrange: Mock database to return no user
      vi.spyOn(mockDb, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockSingleResult(null)),
        }),
      } as never);

      const app = new Hono();
      app.route('/api/auth', authRouter);

      const mockReq = createMockRequest('http://localhost/api/auth-check');

      // Act
      const res = await app.request(mockReq, { env: mockEnv });
      const json = await res.json() as { authenticated: boolean };

      // Assert
      expect(res.status).toBe(401);
      expect(json.authenticated).toBe(false);
      expect(json.user).toBeUndefined();
    });

    it('should return 401 when database query fails', async () => {
      // Arrange: Mock database error
      vi.spyOn(mockDb, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockRejectedValue(new Error('Database connection failed')),
        }),
      } as never);

      const app = new Hono();
      app.route('/api/auth', authRouter);

      const mockReq = createMockRequest('http://localhost/api/auth-check', {
        headers: {
          'Cookie': 'better-auth.session_token=some-token',
        },
      });

      // Act
      const res = await app.request(mockReq, { env: mockEnv });

      // Assert
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/emergency-clear', () => {
    it('should redirect to home with cleared cookies', async () => {
      // Arrange
      const app = new Hono();
      app.route('/api/auth', authRouter);

      const mockReq = createMockRequest('http://localhost/api/auth/emergency-clear');

      // Act
      const res = await app.request(mockReq, { env: mockEnv });

      // Assert
      expect(res.status).toBe(302); // Redirect status
      expect(res.headers.get('Location')).toBe('/');

      // Verify all session cookies are cleared
      const setCookieHeaders = res.headers.getSetCookie();
      const cookieNames = setCookieHeaders.map(h => h.split('=')[0].trim());

      expect(cookieNames).toContain('better-auth.session_token');
      expect(cookieNames).toContain('__Secure-better-auth.session_token');
      expect(cookieNames).toContain('better-auth.csrf_token');
      expect(cookieNames).toContain('__Secure-better-auth.csrf_token');

      // Verify cookies are set with Max-Age=0 (deleted)
      for (const header of setCookieHeaders) {
        if (header.includes('better-auth') || header.includes('__Secure')) {
          expect(header).toContain('Max-Age=0');
        }
      }
    });
  });

  describe('POST /api/auth/test-login', () => {
    it('should create test session in test environment', async () => {
      // Arrange
      const mockUser = {
        id: 'admin-user',
        name: 'Admin User',
        email: 'admin@ares.org',
        role: 'admin',
      };

      vi.spyOn(mockDb, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockSingleResult(mockUser)),
        }),
      } as never);

      vi.spyOn(mockDb, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue(mockMutationResult(1, 'session-123')),
        }),
      } as never);

      const app = new Hono();
      app.route('/api/auth', authRouter);

      const mockReq = createMockRequest('http://localhost/api/auth/test-login', {
        method: 'POST',
        body: { userId: 'admin-user' },
        headers: {
          'x-test-bypass-auth': 'true',
        },
      });

      // Act
      const res = await app.request(mockReq, { env: mockEnv });
      const json = await res.json() as { success: boolean; user: unknown; sessionToken: string };

      // Assert
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.user).toEqual({
        id: 'admin-user',
        name: 'Admin User',
        email: 'admin@ares.org',
        role: 'admin',
      });
      expect(json.sessionToken).toBeDefined();

      // Verify session cookie is set
      const setCookieHeaders = res.headers.getSetCookie();
      const sessionCookie = setCookieHeaders.find(h => h.startsWith('better-auth.session_token='));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('SameSite=Lax');
    });

    it('should return 403 when not in test environment', async () => {
      // Arrange: Use production environment (no test bypass header)
      const prodEnv = createTestEnv({
        ENVIRONMENT: 'production',
        DEV_BYPASS: 'false',
      });

      const app = new Hono();
      app.route('/api/auth', authRouter);

      const mockReq = createMockRequest('http://localhost/api/auth/test-login', {
        method: 'POST',
        body: { userId: 'admin-user' },
      });

      // Act
      const res = await app.request(mockReq, { env: prodEnv });
      const json = await res.json() as { error: string };

      // Assert
      expect(res.status).toBe(403);
      expect(json.error).toContain('Test login only available in test environments');
    });

    it('should return 404 when test user does not exist', async () => {
      // Arrange: Mock database to return no user
      vi.spyOn(mockDb, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockSingleResult(null)),
        }),
      } as never);

      const app = new Hono();
      app.route('/api/auth', authRouter);

      const mockReq = createMockRequest('http://localhost/api/auth/test-login', {
        method: 'POST',
        body: { userId: 'nonexistent-user' },
        headers: {
          'x-test-bypass-auth': 'true',
        },
      });

      // Act
      const res = await app.request(mockReq, { env: mockEnv });
      const json = await res.json() as { error: string };

      // Assert
      expect(res.status).toBe(404);
      expect(json.error).toBe('Test user not found');
    });

    it('should default to admin-user when no userId provided', async () => {
      // Arrange
      const mockUser = {
        id: 'admin-user',
        name: 'Admin User',
        email: 'admin@ares.org',
        role: 'admin',
      };

      vi.spyOn(mockDb, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockSingleResult(mockUser)),
        }),
      } as never);

      vi.spyOn(mockDb, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue(mockMutationResult(1, 'session-123')),
        }),
      } as never);

      const app = new Hono();
      app.route('/api/auth', authRouter);

      const mockReq = createMockRequest('http://localhost/api/auth/test-login', {
        method: 'POST',
        body: {}, // No userId provided
        headers: {
          'x-test-bypass-auth': 'true',
        },
      });

      // Act
      const res = await app.request(mockReq, { env: mockEnv });
      const json = await res.json() as { success: boolean; user: unknown };

      // Assert
      expect(res.status).toBe(200);
      expect(json.user.id).toBe('admin-user');
    });

    it('should return 500 on database error during session creation', async () => {
      // Arrange: User exists but session insertion fails
      const mockUser = {
        id: 'admin-user',
        name: 'Admin User',
        email: 'admin@ares.org',
        role: 'admin',
      };

      vi.spyOn(mockDb, 'prepare')
        // Mock user lookup to succeed
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(mockSingleResult(mockUser)),
          }),
        } as never)
        // Mock session insertion to fail
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockRejectedValue(new Error('Database constraint violation')),
          }),
        } as never);

      const app = new Hono();
      app.route('/api/auth', authRouter);

      const mockReq = createMockRequest('http://localhost/api/auth/test-login', {
        method: 'POST',
        body: { userId: 'admin-user' },
        headers: {
          'x-test-bypass-auth': 'true',
        },
      });

      // Act
      const res = await app.request(mockReq, { env: mockEnv });
      const json = await res.json() as { error: string };

      // Assert
      expect(res.status).toBe(500);
      expect(json.error).toBe('Failed to create test session');
    });
  });

  describe('OpenAPI route registration', () => {
    it('should have all routes registered', () => {
      // The auth router should be an OpenAPIHono instance
      expect(authRouter).toBeDefined();
      expect(typeof (authRouter as { openapi: unknown }).openapi).toBe('function');
    });
  });
});
