import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Context } from 'hono';
import {
  checkPersistentRateLimit,
  verifyTurnstile,
  rateLimitMiddleware,
  persistentRateLimitMiddleware,
  originIntegrityMiddleware,
  turnstileMiddleware,
  contentTypeValidationMiddleware,
  _resetCircuitBreakerStateForTest,
} from './security';
import type { AppEnv } from './utils';

// Mock drizzle schema
vi.mock('../../../src/db/schema', () => ({
  rateLimits: {},
  auditLog: {},
}));

describe('security middleware', () => {
  let mockDb: Parameters<typeof checkPersistentRateLimit>[0];
  let mockEnv: AppEnv['Bindings'];
  let mockContext: Context<AppEnv>;

  // Create fresh mock helpers for each test
  const createMockRateLimitChain = (count: number) => {
    const returningMock = vi.fn().mockResolvedValue([{ count, expiresAt: Math.floor(Date.now() / 1000) + 60 }]);
    const onConflictMock = vi.fn().mockReturnValue({ returning: returningMock });
    const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictMock });
    // Use onConflictMock to avoid unused warning
    void onConflictMock;
    return valuesMock;
  };

  const createMockInsertWithExecute = () => {
    const executeMock = vi.fn().mockResolvedValue(undefined);
    const valuesMock = vi.fn().mockReturnValue({ execute: executeMock });
    return valuesMock;
  };

  beforeEach(() => {
    _resetCircuitBreakerStateForTest();
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Setup mock db for rate limit checks
    mockDb = {
      insert: vi.fn().mockReturnValue({
        values: createMockRateLimitChain(1),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    } as unknown as Parameters<typeof checkPersistentRateLimit>[0];

    mockEnv = {
      ENVIRONMENT: 'test',
      DEV_BYPASS: 'false',
      TURNSTILE_SECRET_KEY: 'test-secret-key',
    } as AppEnv['Bindings'];

    mockContext = {
      req: {
        url: 'http://localhost:5173/api/test',
        path: '/api/test',
        method: 'POST',
        header: vi.fn((name: string) => {
          const headers: Record<string, string> = {
            'cf-connecting-ip': '127.0.0.1',
            'user-agent': 'test-agent',
            'origin': 'http://localhost:5173',
            'content-type': 'application/json',
          };
          return headers[name.toLowerCase()] || null;
        }),
        raw: {
          clone: vi.fn().mockReturnValue({
            json: vi.fn().mockResolvedValue({ turnstileToken: 'test-token' }),
            formData: vi.fn().mockResolvedValue(new FormData()),
          }),
          headers: new Headers(),
        },
      },
      env: mockEnv,
      executionCtx: {
        waitUntil: vi.fn(),
      },
      json: vi.fn().mockReturnThis(),
      get: vi.fn((key: string) => {
        if (key === 'db') {
          // Return db with auditLog insert support
          return {
            insert: vi.fn().mockReturnValue({
              values: createMockInsertWithExecute(),
            }),
          };
        }
        return mockDb;
      }),
      set: vi.fn(),
      header: vi.fn().mockReturnThis(),
    } as unknown as Context<AppEnv>;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkPersistentRateLimit', () => {
    it('allows requests under the limit', async () => {
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue({
        values: createMockRateLimitChain(1),
      });

      const result = await checkPersistentRateLimit(mockDb, '127.0.0.1', 'test-agent', 10, 60);
      expect(result).toBe(true);
    });

    it('denies requests over the limit', async () => {
      const mockDbOverLimit = {
        insert: vi.fn().mockReturnValue({
          values: createMockRateLimitChain(20),
        }),
      } as unknown as Parameters<typeof checkPersistentRateLimit>[0];

      const result = await checkPersistentRateLimit(mockDbOverLimit, '127.0.0.1', 'test-agent', 10, 60);
      expect(result).toBe(false);
    });

    it('allows requests in non-production when database is unavailable', async () => {
      const result = await checkPersistentRateLimit(null as unknown as Parameters<typeof checkPersistentRateLimit>[0], '127.0.0.1', 'test-agent', 10, 60);
      expect(result).toBe(true);
    });
  });

  describe('persistentRateLimitMiddleware', () => {
    beforeEach(() => {
      // Reset the mock context with fresh mocks
      mockContext.get = vi.fn((key: string) => {
        if (key === 'db') {
          return {
            insert: vi.fn().mockReturnValue({
              values: createMockInsertWithExecute(),
            }),
          };
        }
        return mockDb;
      });
    });

    it('bypasses rate limit when DEV_BYPASS is enabled', async () => {
      mockContext.env.DEV_BYPASS = '1';

      const middleware = persistentRateLimitMiddleware(10, 60);
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(next).toHaveBeenCalled();
      expect(mockContext.json).not.toHaveBeenCalled();
    });

    it('allows requests under the rate limit', async () => {
      // Reset db mock to ensure clean state
      mockContext.get = vi.fn((key: string) => {
        if (key === 'db') {
          return {
            insert: vi.fn().mockReturnValue({
              values: createMockInsertWithExecute(),
            }),
          };
        }
        return mockDb;
      });

      const middleware = persistentRateLimitMiddleware(10, 60);
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(next).toHaveBeenCalled();
    });

    it('blocks requests over the rate limit', async () => {
      // Ensure DEV_BYPASS is not interfering
      mockContext.env.DEV_BYPASS = 'false';

      // Mock the db to return a count over the limit for rateLimits insert
      // and provide execute for the auditLog insert
      // We need to distinguish between the two inserts by checking the call chain

      let insertCallCount = 0;
      const mockDbOverLimit = {
        insert: vi.fn().mockImplementation(() => {
          insertCallCount++;
          // First call is for rateLimits (needs onConflictDoUpdate chain)
          // Second call is for auditLog (needs execute)
          if (insertCallCount === 1) {
            return {
              values: vi.fn().mockReturnValue({
                onConflictDoUpdate: vi.fn().mockReturnValue({
                  returning: vi.fn().mockResolvedValue([{ count: 20, expiresAt: Math.floor(Date.now() / 1000) + 60 }]),
                }),
              }),
            };
          }
          // Second call for auditLog
          return {
            values: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue(undefined),
            }),
          };
        }),
      };

      mockContext.get = vi.fn().mockReturnValue(mockDbOverLimit);

      const middleware = persistentRateLimitMiddleware(10, 60);
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Too many requests. Please try again later.' },
        429
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('verifyTurnstile', () => {
    it('returns true for test bypass token in development', async () => {
      (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process = { env: { NODE_ENV: 'development' } };

      const result = await verifyTurnstile('test-bypass-token', 'secret', '127.0.0.1');
      expect(result).toBe(true);
    });

    it('returns false for missing token', async () => {
      const result = await verifyTurnstile(null, 'test-secret', '127.0.0.1');
      expect(result).toBe(false);
    });

    it('returns false for undefined token', async () => {
      const result = await verifyTurnstile(undefined, 'test-secret', '127.0.0.1');
      expect(result).toBe(false);
    });

    it('returns true when secret is not set in non-production', async () => {
      (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process = { env: { NODE_ENV: 'development' } };

      const result = await verifyTurnstile(null, undefined, '127.0.0.1');
      expect(result).toBe(true);
    });

    it('returns false when secret is not set in production', async () => {
      (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process = { env: { NODE_ENV: 'production' } };

      const result = await verifyTurnstile(null, undefined, '127.0.0.1');
      expect(result).toBe(false);
    });

    it('verifies token with Cloudflare API', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      }) as unknown as typeof fetch;

      const result = await verifyTurnstile('valid-token', 'secret', '127.0.0.1');
      expect(result).toBe(true);
    });

    it('returns false when verification fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, 'error-codes': ['invalid-input'] }),
      }) as unknown as typeof fetch;

      const result = await verifyTurnstile('invalid-token', 'secret', '127.0.0.1');
      expect(result).toBe(false);
    });
  });

  describe('rateLimitMiddleware', () => {
    it('creates middleware with default parameters', () => {
      const middleware = rateLimitMiddleware();
      expect(middleware).toBeTypeOf('function');
    });

    it('creates middleware with custom parameters', () => {
      const middleware = rateLimitMiddleware(5, 30);
      expect(middleware).toBeTypeOf('function');
    });
  });

  describe('originIntegrityMiddleware', () => {
    it('bypasses check when DEV_BYPASS is enabled', async () => {
      mockContext.env.DEV_BYPASS = '1';

      const middleware = originIntegrityMiddleware();
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(next).toHaveBeenCalled();
    });

    it('skips check for GET requests', async () => {
      (mockContext.req as unknown as { method: string }).method = 'GET';

      const middleware = originIntegrityMiddleware();
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(next).toHaveBeenCalled();
    });

    it('skips check for OPTIONS requests', async () => {
      (mockContext.req as unknown as { method: string }).method = 'OPTIONS';

      const middleware = originIntegrityMiddleware();
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(next).toHaveBeenCalled();
    });

    it('skips check for HEAD requests', async () => {
      (mockContext.req as unknown as { method: string }).method = 'HEAD';

      const middleware = originIntegrityMiddleware();
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(next).toHaveBeenCalled();
    });

    it('skips check for webhook routes', async () => {
      mockContext.req.path = '/api/webhooks/github';

      const middleware = originIntegrityMiddleware();
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(next).toHaveBeenCalled();
    });

    it('blocks requests missing both Origin and Referer headers', async () => {
      (mockContext.req as unknown as { header: unknown }).header = vi.fn((name: string) => {
        if (name.toLowerCase() === 'user-agent') return 'test-agent';
        return null;
      });

      const middleware = originIntegrityMiddleware();
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Security check failed: Origin integrity required.' },
        403
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('allows requests with trusted Origin header', async () => {
      (mockContext.req as unknown as { header: unknown }).header = vi.fn((name: string) => {
        const headers: Record<string, string> = {
          'origin': 'http://localhost:5173',
          'user-agent': 'test-agent',
        };
        return headers[name.toLowerCase()] || null;
      });

      const middleware = originIntegrityMiddleware();
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(next).toHaveBeenCalled();
      expect(mockContext.json).not.toHaveBeenCalled();
    });

    it('allows requests with trusted Referer header', async () => {
      (mockContext.req as unknown as { header: unknown }).header = vi.fn((name: string) => {
        const headers: Record<string, string> = {
          'referer': 'https://aresfirst.org/',
          'user-agent': 'test-agent',
        };
        return headers[name.toLowerCase()] || null;
      });

      const middleware = originIntegrityMiddleware();
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(next).toHaveBeenCalled();
    });

    it('blocks requests with untrusted Origin header', async () => {
      (mockContext.req as unknown as { header: unknown }).header = vi.fn((name: string) => {
        const headers: Record<string, string> = {
          'origin': 'https://malicious-site.com',
          'user-agent': 'test-agent',
        };
        return headers[name.toLowerCase()] || null;
      });

      const middleware = originIntegrityMiddleware();
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Untrusted request origin.' },
        403
      );
    });

    it('allows requests from .pages.dev subdomains', async () => {
      (mockContext.req as unknown as { header: unknown }).header = vi.fn((name: string) => {
        const headers: Record<string, string> = {
          'origin': 'https://aresweb.pages.dev',
          'user-agent': 'test-agent',
        };
        return headers[name.toLowerCase()] || null;
      });

      const middleware = originIntegrityMiddleware();
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(next).toHaveBeenCalled();
    });

    it('allows requests from .aresfirst.org subdomains', async () => {
      (mockContext.req as unknown as { header: unknown }).header = vi.fn((name: string) => {
        const headers: Record<string, string> = {
          'origin': 'https://blog.aresfirst.org',
          'user-agent': 'test-agent',
        };
        return headers[name.toLowerCase()] || null;
      });

      const middleware = originIntegrityMiddleware();
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('turnstileMiddleware', () => {
    it('bypasses verification when DEV_BYPASS is enabled', async () => {
      mockContext.env.DEV_BYPASS = '1';
      mockContext.env.ENVIRONMENT = 'development';

      const middleware = turnstileMiddleware();
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(next).toHaveBeenCalled();
    });

    it('bypasses verification in non-production environments', async () => {
      mockContext.env.ENVIRONMENT = 'development';

      const middleware = turnstileMiddleware();
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(next).toHaveBeenCalled();
    });

    it('verifies token from JSON body', async () => {
      mockContext.env.ENVIRONMENT = 'production';
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      }) as unknown as typeof fetch;

      const middleware = turnstileMiddleware();
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(next).toHaveBeenCalled();
    });

    it('blocks requests with invalid token', async () => {
      mockContext.env.ENVIRONMENT = 'production';
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: false }),
      }) as unknown as typeof fetch;

      const middleware = turnstileMiddleware();
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Security verification failed. Please try again.' },
        403
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('contentTypeValidationMiddleware', () => {
    it('skips validation for non-write methods', async () => {
      (mockContext.req as unknown as { method: string }).method = 'GET';

      const middleware = contentTypeValidationMiddleware();
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(next).toHaveBeenCalled();
    });

    it('allows application/json content type', async () => {
      (mockContext.req as unknown as { method: string }).method = 'POST';
      (mockContext.req as unknown as { header: unknown }).header = vi.fn((name: string) => {
        const headers: Record<string, string> = {
          'content-type': 'application/json',
        };
        return headers[name.toLowerCase()] || null;
      });

      const middleware = contentTypeValidationMiddleware();
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(next).toHaveBeenCalled();
    });

    it('allows multipart/form-data content type', async () => {
      (mockContext.req as unknown as { method: string }).method = 'POST';
      (mockContext.req as unknown as { header: unknown }).header = vi.fn((name: string) => {
        const headers: Record<string, string> = {
          'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary',
        };
        return headers[name.toLowerCase()] || null;
      });

      const middleware = contentTypeValidationMiddleware();
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(next).toHaveBeenCalled();
    });

    it('allows application/x-www-form-urlencoded content type', async () => {
      (mockContext.req as unknown as { method: string }).method = 'POST';
      (mockContext.req as unknown as { header: unknown }).header = vi.fn((name: string) => {
        const headers: Record<string, string> = {
          'content-type': 'application/x-www-form-urlencoded',
        };
        return headers[name.toLowerCase()] || null;
      });

      const middleware = contentTypeValidationMiddleware();
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(next).toHaveBeenCalled();
    });

    it('allows text/plain content type', async () => {
      (mockContext.req as unknown as { method: string }).method = 'POST';
      (mockContext.req as unknown as { header: unknown }).header = vi.fn((name: string) => {
        const headers: Record<string, string> = {
          'content-type': 'text/plain',
        };
        return headers[name.toLowerCase()] || null;
      });

      const middleware = contentTypeValidationMiddleware();
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(next).toHaveBeenCalled();
    });

    it('blocks unsupported content types', async () => {
      (mockContext.req as unknown as { method: string }).method = 'POST';
      (mockContext.req as unknown as { header: unknown }).header = vi.fn((name: string) => {
        const headers: Record<string, string> = {
          'content-type': 'application/xml',
        };
        return headers[name.toLowerCase()] || null;
      });

      const middleware = contentTypeValidationMiddleware();
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Unsupported content type' },
        415
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('allows requests without content type header', async () => {
      (mockContext.req as unknown as { method: string }).method = 'POST';
      (mockContext.req as unknown as { header: unknown }).header = vi.fn(() => null);

      const middleware = contentTypeValidationMiddleware();
      const next = vi.fn();

      await middleware(mockContext, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
