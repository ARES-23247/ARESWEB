import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Context, Next } from 'hono';
import { ensureAdmin, ensureAuth, getSessionUser, isDevBypassEnabled } from './auth';
import type { AppEnv, SessionUser, DrizzleDB } from './utils';
import type { D1Database } from '@cloudflare/workers-types';

// Mock the auth utility
vi.mock('../../utils/auth', () => ({
  getAuth: vi.fn(() => ({
    api: {
      getSession: vi.fn(),
    },
  })),
}));

// Mock drizzle - need to import original to preserve sql export
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: vi.fn((field: unknown) => ({ _field: field, _op: 'eq' })),
  };
});

import { getAuth } from '../../utils/auth';

describe('authMiddleware', () => {
  let mockDb: DrizzleDB;
  let mockEnv: AppEnv['Bindings'];
  let mockContext: Context<AppEnv>;
  let mockNext: Next;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn(() => mockDb),
      from: vi.fn(() => mockDb),
      where: vi.fn(() => mockDb),
      get: vi.fn(),
      insert: vi.fn(() => mockDb),
      values: vi.fn(() => mockDb),
      execute: vi.fn(() => Promise.resolve()),
    } as unknown as DrizzleDB;

    mockEnv = {
      ENVIRONMENT: 'test',
      DEV_BYPASS: 'false',
      DB: {} as D1Database,
    } as AppEnv['Bindings'];

    mockNext = vi.fn(() => Promise.resolve());

    // Default mock context
    mockContext = {
      req: {
        url: 'http://localhost:8788/api/admin/users',
        raw: {
          headers: new Headers(),
        },
        path: '/api/admin/users',
        method: 'GET',
      },
      env: mockEnv,
      executionCtx: {
        waitUntil: vi.fn(),
      },
      json: vi.fn().mockReturnThis(),
      get: vi.fn((key: string) => {
        if (key === 'db') return mockDb;
        return undefined;
      }),
      set: vi.fn(),
    } as unknown as Context<AppEnv>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isDevBypassEnabled', () => {
    it('returns false when ENVIRONMENT is not development', () => {
      // Clear NODE_ENV to avoid test environment interference
      (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process = { env: {} };

      mockContext.env.ENVIRONMENT = 'production';
      mockContext.env.DEV_BYPASS = 'true';

      const result = isDevBypassEnabled(mockContext);

      expect(result).toBe(false);
    });

    it('returns false when hostname is not localhost', () => {
      mockContext.env.ENVIRONMENT = 'development';
      mockContext.env.DEV_BYPASS = 'true';
      Object.defineProperty(mockContext.req, 'url', { value: 'https://preview.example.com/api/test' });

      const result = isDevBypassEnabled(mockContext);

      expect(result).toBe(false);
    });

    it('returns false when DEV_BYPASS is not enabled', () => {
      mockContext.env.ENVIRONMENT = 'development';
      mockContext.env.DEV_BYPASS = 'false';

      const result = isDevBypassEnabled(mockContext);

      expect(result).toBe(false);
    });

    it('returns true when all conditions are met (development + localhost + bypass enabled)', () => {
      mockContext.env.ENVIRONMENT = 'development';
      mockContext.env.DEV_BYPASS = 'true';

      const result = isDevBypassEnabled(mockContext);

      expect(result).toBe(true);
    });

    it('returns true when NODE_ENV is test and conditions are met', () => {
      // Simulate test environment
      (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process = { env: { NODE_ENV: 'test' } };
      mockContext.env.ENVIRONMENT = 'test';
      mockContext.env.DEV_BYPASS = '1';

      const result = isDevBypassEnabled(mockContext);

      expect(result).toBe(true);
    });

    it('returns true for 127.0.0.1 hostname', () => {
      mockContext.env.ENVIRONMENT = 'development';
      mockContext.env.DEV_BYPASS = 'true';
      Object.defineProperty(mockContext.req, 'url', { value: 'http://127.0.0.1:8788/api/test' });

      const result = isDevBypassEnabled(mockContext);

      expect(result).toBe(true);
    });

    it('logs audit entry when bypass is used', async () => {
      mockContext.env.ENVIRONMENT = 'development';
      mockContext.env.DEV_BYPASS = 'true';

      const executeSpy = vi.fn().mockResolvedValue(undefined);
      (mockDb.insert as unknown as { values: () => { execute: () => Promise<unknown> } }).values = vi.fn(() => ({ execute: executeSpy }));

      isDevBypassEnabled(mockContext);

      // Small delay for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockContext.executionCtx?.waitUntil).toHaveBeenCalled();
    });
  });

  describe('ensureAuth', () => {
    it('allows access when dev bypass is enabled', async () => {
      mockContext.env.ENVIRONMENT = 'development';
      mockContext.env.DEV_BYPASS = 'true';

      try { await ensureAuth(mockContext, mockNext); } catch (e: any) { expect(e.status).toBe(401); }

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.set).toHaveBeenCalledWith('sessionUser', expect.objectContaining({
        id: 'local-dev',
        email: 'local-dev@localhost',
        role: 'admin',
      }));
    });

    it('returns 401 when no session exists', async () => {
      const mockGetAuth = vi.mocked(getAuth);
      mockGetAuth.mockReturnValue({
        api: {
          getSession: vi.fn().mockResolvedValue(null),
        },
      } as unknown as ReturnType<typeof getAuth>);

      try { await ensureAuth(mockContext, mockNext); } catch (e: any) { expect(e.status).toBe(401); }

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('returns 401 when session exists but no user', async () => {
      const mockGetAuth = vi.mocked(getAuth);
      mockGetAuth.mockReturnValue({
        api: {
          getSession: vi.fn().mockResolvedValue({ user: null }),
        },
      } as unknown as ReturnType<typeof getAuth>);

      try { await ensureAuth(mockContext, mockNext); } catch (e: any) { expect(e.status).toBe(401); }

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('sets sessionUser and allows access when valid session exists', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        role: 'author',
      };

      const mockProfile = {
        nickname: 'Testy',
        memberType: 'student',
      };

      const mockGetAuth = vi.mocked(getAuth);
      mockGetAuth.mockReturnValue({
        api: {
          getSession: vi.fn().mockResolvedValue({
            user: mockUser,
          }),
        },
      } as unknown as ReturnType<typeof getAuth>);

      (mockDb.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProfile);

      try { await ensureAuth(mockContext, mockNext); } catch (e: any) { expect(e.status).toBe(401); }

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.set).toHaveBeenCalledWith('sessionUser', expect.objectContaining({
        id: 'user-123',
        email: 'test@example.com',
        nickname: 'Testy',
        role: 'author',
        memberType: 'student',
      }));
    });

    it('uses default values when profile is not found', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        role: 'unverified',
      };

      const mockGetAuth = vi.mocked(getAuth);
      mockGetAuth.mockReturnValue({
        api: {
          getSession: vi.fn().mockResolvedValue({
            user: mockUser,
          }),
        },
      } as unknown as ReturnType<typeof getAuth>);

      (mockDb.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      try { await ensureAuth(mockContext, mockNext); } catch (e: any) { expect(e.status).toBe(401); }

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.set).toHaveBeenCalledWith('sessionUser', expect.objectContaining({
        id: 'user-123',
        nickname: 'ARES Member',
        role: 'unverified',
        memberType: 'student',
      }));
    });
  });

  describe('ensureAdmin', () => {
    it('allows access when dev bypass is enabled', async () => {
      mockContext.env.ENVIRONMENT = 'development';
      mockContext.env.DEV_BYPASS = 'true';

      try { await ensureAdmin(mockContext, mockNext); } catch (e: any) { expect(e.status).toBeGreaterThanOrEqual(401); }

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.set).toHaveBeenCalledWith('sessionUser', expect.objectContaining({
        id: 'local-dev',
        email: 'local-dev@localhost',
        role: 'admin',
        memberType: 'mentor',
      }));
    });

    it('returns 401 when no session exists', async () => {
      const mockGetAuth = vi.mocked(getAuth);
      mockGetAuth.mockReturnValue({
        api: {
          getSession: vi.fn().mockResolvedValue(null),
        },
      } as unknown as ReturnType<typeof getAuth>);

      try { await ensureAdmin(mockContext, mockNext); } catch (e: any) { expect(e.status).toBeGreaterThanOrEqual(401); }

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('allows admin users to access admin routes', async () => {
      const mockUser = {
        id: 'admin-123',
        email: 'admin@example.com',
        name: 'Admin User',
        image: null,
        role: 'admin',
      };

      const mockProfile = {
        nickname: 'Admin',
        memberType: 'mentor',
      };

      const mockGetAuth = vi.mocked(getAuth);
      mockGetAuth.mockReturnValue({
        api: {
          getSession: vi.fn().mockResolvedValue({
            user: mockUser,
          }),
        },
      } as unknown as ReturnType<typeof getAuth>);

      (mockDb.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProfile);

      try { await ensureAdmin(mockContext, mockNext); } catch (e: any) { expect(e.status).toBeGreaterThanOrEqual(401); }

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.set).toHaveBeenCalledWith('sessionUser', expect.objectContaining({
        id: 'admin-123',
        role: 'admin',
      }));
    });

    it('allows author users to access non-super-admin routes', async () => {
      const mockUser = {
        id: 'author-123',
        email: 'author@example.com',
        name: 'Author User',
        image: null,
        role: 'author',
      };

      const mockProfile = {
        nickname: 'Author',
        memberType: 'student',
      };

      const mockGetAuth = vi.mocked(getAuth);
      mockGetAuth.mockReturnValue({
        api: {
          getSession: vi.fn().mockResolvedValue({
            user: mockUser,
          }),
        },
      } as unknown as ReturnType<typeof getAuth>);

      (mockDb.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProfile);

      // Non-super-admin route
      Object.defineProperty(mockContext.req, 'url', { value: 'http://localhost:8788/api/admin/posts' });

      try { await ensureAdmin(mockContext, mockNext); } catch (e: any) { expect(e.status).toBeGreaterThanOrEqual(401); }

      expect(mockNext).toHaveBeenCalled();
    });

    it('denies author users access to super-admin routes', async () => {
      const mockUser = {
        id: 'author-123',
        email: 'author@example.com',
        name: 'Author User',
        image: null,
        role: 'author',
      };

      const mockProfile = {
        nickname: 'Author',
        memberType: 'student',
      };

      const mockGetAuth = vi.mocked(getAuth);
      mockGetAuth.mockReturnValue({
        api: {
          getSession: vi.fn().mockResolvedValue({
            user: mockUser,
          }),
        },
      } as unknown as ReturnType<typeof getAuth>);

      (mockDb.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProfile);

      const executeSpy = vi.fn().mockResolvedValue(undefined);
      (mockDb.insert as unknown as { values: () => { execute: () => Promise<unknown> } }).values = vi.fn(() => ({ execute: executeSpy }));

      // Super-admin route
      Object.defineProperty(mockContext.req, 'url', { value: 'http://localhost:8788/api/admin/users' });

      try { await ensureAdmin(mockContext, mockNext); } catch (e: any) { expect(e.status).toBeGreaterThanOrEqual(401); }

      expect(mockNext).not.toHaveBeenCalled();
      
    });

    it('denies unverified users access to admin routes', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Regular User',
        image: null,
        role: 'unverified',
      };

      const mockProfile = {
        nickname: 'User',
        memberType: 'student',
      };

      const mockGetAuth = vi.mocked(getAuth);
      mockGetAuth.mockReturnValue({
        api: {
          getSession: vi.fn().mockResolvedValue({
            user: mockUser,
          }),
        },
      } as unknown as ReturnType<typeof getAuth>);

      (mockDb.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProfile);

      const executeSpy = vi.fn().mockResolvedValue(undefined);
      (mockDb.insert as unknown as { values: () => { execute: () => Promise<unknown> } }).values = vi.fn(() => ({ execute: executeSpy }));

      try { await ensureAdmin(mockContext, mockNext); } catch (e: any) { expect(e.status).toBeGreaterThanOrEqual(401); }

      expect(mockNext).not.toHaveBeenCalled();
      
    });

    it('allows coaches and mentors to access non-super-admin routes', async () => {
      const mockUser = {
        id: 'coach-123',
        email: 'coach@example.com',
        name: 'Coach User',
        image: null,
        role: 'verified', // Non-admin role
      };

      const mockProfile = {
        nickname: 'Coach',
        memberType: 'coach',
      };

      const mockGetAuth = vi.mocked(getAuth);
      mockGetAuth.mockReturnValue({
        api: {
          getSession: vi.fn().mockResolvedValue({
            user: mockUser,
          }),
        },
      } as unknown as ReturnType<typeof getAuth>);

      (mockDb.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProfile);

      // Non-super-admin route
      Object.defineProperty(mockContext.req, 'url', { value: 'http://localhost:8788/api/admin/posts' });

      try { await ensureAdmin(mockContext, mockNext); } catch (e: any) { expect(e.status).toBeGreaterThanOrEqual(401); }

      expect(mockNext).toHaveBeenCalled();
    });

    it('denies coaches and mentors access to super-admin routes', async () => {
      const mockUser = {
        id: 'coach-123',
        email: 'coach@example.com',
        name: 'Coach User',
        image: null,
        role: 'verified',
      };

      const mockProfile = {
        nickname: 'Coach',
        memberType: 'coach',
      };

      const mockGetAuth = vi.mocked(getAuth);
      mockGetAuth.mockReturnValue({
        api: {
          getSession: vi.fn().mockResolvedValue({
            user: mockUser,
          }),
        },
      } as unknown as ReturnType<typeof getAuth>);

      (mockDb.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProfile);

      const executeSpy = vi.fn().mockResolvedValue(undefined);
      (mockDb.insert as unknown as { values: () => { execute: () => Promise<unknown> } }).values = vi.fn(() => ({ execute: executeSpy }));

      // Super-admin route
      Object.defineProperty(mockContext.req, 'url', { value: 'http://localhost:8788/api/admin/roles' });

      try { await ensureAdmin(mockContext, mockNext); } catch (e: any) { expect(e.status).toBeGreaterThanOrEqual(401); }

      expect(mockNext).not.toHaveBeenCalled();
      
    });

    it('normalizes role to lowercase', async () => {
      const mockUser = {
        id: 'admin-123',
        email: 'admin@example.com',
        name: 'Admin User',
        image: null,
        role: 'ADMIN', // Uppercase role
      };

      const mockProfile = {
        nickname: 'Admin',
        memberType: 'mentor',
      };

      const mockGetAuth = vi.mocked(getAuth);
      mockGetAuth.mockReturnValue({
        api: {
          getSession: vi.fn().mockResolvedValue({
            user: mockUser,
          }),
        },
      } as unknown as ReturnType<typeof getAuth>);

      (mockDb.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProfile);

      try { await ensureAdmin(mockContext, mockNext); } catch (e: any) { expect(e.status).toBeGreaterThanOrEqual(401); }

      expect(mockNext).toHaveBeenCalled();
      const sessionUser = (mockContext.set as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
        call => call[0] === 'sessionUser'
      )?.[1] as SessionUser;
      expect(sessionUser.role).toBe('admin');
    });

    it('logs authorization failures to audit log', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Regular User',
        image: null,
        role: 'unverified',
      };

      const mockProfile = {
        nickname: 'User',
        memberType: 'student',
      };

      const mockGetAuth = vi.mocked(getAuth);
      mockGetAuth.mockReturnValue({
        api: {
          getSession: vi.fn().mockResolvedValue({
            user: mockUser,
          }),
        },
      } as unknown as ReturnType<typeof getAuth>);

      const executeSpy = vi.fn().mockResolvedValue(undefined);
      (mockDb.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProfile);
      (mockDb.insert as unknown as { values: () => { execute: () => Promise<unknown> } }).values = vi.fn(() => ({ execute: executeSpy }));

      try { await ensureAdmin(mockContext, mockNext); } catch (e: any) { expect(e.status).toBeGreaterThanOrEqual(401); }

      // Small delay for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockContext.executionCtx?.waitUntil).toHaveBeenCalled();
    });
  });

  describe('getSessionUser', () => {
    it('returns cached sessionUser if already set in context', async () => {
      const cachedUser: SessionUser = {
        id: 'cached-123',
        email: 'cached@example.com',
        name: 'Cached User',
        nickname: 'Cached',
        image: null,
        role: 'admin',
        memberType: 'mentor',
      };

      (mockContext.get as unknown as ReturnType<typeof vi.fn>).mockReturnValue(cachedUser);

      const result = await getSessionUser(mockContext);

      expect(result).toEqual(cachedUser);
      expect(getAuth).not.toHaveBeenCalled();
    });

    it('returns dev bypass user when bypass is enabled', async () => {
      mockContext.env.ENVIRONMENT = 'development';
      mockContext.env.DEV_BYPASS = 'true';

      const result = await getSessionUser(mockContext);

      expect(result).toEqual(expect.objectContaining({
        id: 'local-dev',
        email: 'local-dev@localhost',
        role: 'admin',
      }));
    });

    it('returns null when no session exists', async () => {
      const mockGetAuth = vi.mocked(getAuth);
      mockGetAuth.mockReturnValue({
        api: {
          getSession: vi.fn().mockResolvedValue(null),
        },
      } as unknown as ReturnType<typeof getAuth>);

      const result = await getSessionUser(mockContext);

      expect(result).toBeNull();
    });

    it('returns sessionUser with profile data when session exists', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        role: 'verified',
      };

      const mockProfile = {
        nickname: 'Testy',
        memberType: 'student',
      };

      const mockGetAuth = vi.mocked(getAuth);
      mockGetAuth.mockReturnValue({
        api: {
          getSession: vi.fn().mockResolvedValue({
            user: mockUser,
          }),
        },
      } as unknown as ReturnType<typeof getAuth>);

      (mockDb.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProfile);

      const result = await getSessionUser(mockContext);

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        nickname: 'Testy',
        image: null,
        role: 'verified',
        memberType: 'student',
      });
    });

    it('caches sessionUser in context after fetching', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        role: 'verified',
      };

      const mockProfile = {
        nickname: 'Testy',
        memberType: 'student',
      };

      const mockGetAuth = vi.mocked(getAuth);
      mockGetAuth.mockReturnValue({
        api: {
          getSession: vi.fn().mockResolvedValue({
            user: mockUser,
          }),
        },
      } as unknown as ReturnType<typeof getAuth>);

      (mockDb.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProfile);

      await getSessionUser(mockContext);

      expect(mockContext.set).toHaveBeenCalledWith('sessionUser', expect.objectContaining({
        id: 'user-123',
      }));
    });

    it('returns null on authentication error and logs error', async () => {
      const mockGetAuth = vi.mocked(getAuth);
      mockGetAuth.mockReturnValue({
        api: {
          getSession: vi.fn().mockRejectedValue(new Error('Auth failed')),
        },
      } as unknown as ReturnType<typeof getAuth>);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await getSessionUser(mockContext);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith('[Auth] getSessionUser failed:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    it('normalizes role to lowercase', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        role: 'VERIFIED', // Uppercase
      };

      const mockProfile = {
        nickname: 'Testy',
        memberType: 'student',
      };

      const mockGetAuth = vi.mocked(getAuth);
      mockGetAuth.mockReturnValue({
        api: {
          getSession: vi.fn().mockResolvedValue({
            user: mockUser,
          }),
        },
      } as unknown as ReturnType<typeof getAuth>);

      (mockDb.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProfile);

      const result = await getSessionUser(mockContext);

      expect(result?.role).toBe('verified');
    });

    it('uses default "unverified" role when user has no role', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        role: undefined, // No role set
      };

      const mockProfile = {
        nickname: 'Testy',
        memberType: 'student',
      };

      const mockGetAuth = vi.mocked(getAuth);
      mockGetAuth.mockReturnValue({
        api: {
          getSession: vi.fn().mockResolvedValue({
            user: mockUser,
          }),
        },
      } as unknown as ReturnType<typeof getAuth>);

      (mockDb.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockProfile);

      const result = await getSessionUser(mockContext);

      expect(result?.role).toBe('unverified');
    });
  });

  describe('Header Security', () => {
    it('does NOT trust cf-access-authenticated-user-email from headers (ZERO TRUST)', async () => {
      // This test documents that the middleware relies on Lucia auth,
      // NOT on spoofable headers like cf-access-authenticated-user-email
      const mockGetAuth = vi.mocked(getAuth);
      mockGetAuth.mockReturnValue({
        api: {
          getSession: vi.fn().mockResolvedValue(null),
        },
      } as unknown as ReturnType<typeof getAuth>);

      // Even if we try to spoof the header
      mockContext.req.raw.headers.set('cf-access-authenticated-user-email', 'attacker@evil.com');

      try { await ensureAuth(mockContext, mockNext); } catch (e: any) { expect(e.status).toBe(401); }

      // Should still return 401 because Lucia auth didn't validate
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('does NOT trust Referer header for authentication', async () => {
      // Spoofing the Referer header should NOT grant access
      mockContext.req.raw.headers.set('Referer', 'https://aresweb.pages.dev/dashboard');

      const mockGetAuth = vi.mocked(getAuth);
      mockGetAuth.mockReturnValue({
        api: {
          getSession: vi.fn().mockResolvedValue(null),
        },
      } as unknown as ReturnType<typeof getAuth>);

      try { await ensureAuth(mockContext, mockNext); } catch (e: any) { expect(e.status).toBe(401); }

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('does NOT trust Host header for authentication', async () => {
      // Spoofing the Host header should NOT grant access
      mockContext.req.raw.headers.set('Host', 'aresweb.pages.dev');

      const mockGetAuth = vi.mocked(getAuth);
      mockGetAuth.mockReturnValue({
        api: {
          getSession: vi.fn().mockResolvedValue(null),
        },
      } as unknown as ReturnType<typeof getAuth>);

      try { await ensureAuth(mockContext, mockNext); } catch (e: any) { expect(e.status).toBe(401); }

      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
