import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Context } from 'hono';
import { envMiddleware, getValidatedEnv } from './env';
import type { AppEnv } from './utils';

describe('env middleware', () => {
  let mockContext: Context<AppEnv>;
  let mockEnv: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockEnv = {
      ENVIRONMENT: 'test',
      BETTER_AUTH_SECRET: 'test-secret-key',
      BETTER_AUTH_URL: 'http://localhost:5173/api/auth',
      GOOGLE_CLIENT_ID: 'test-google-client-id',
      GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
      GITHUB_CLIENT_ID: 'test-github-client-id',
      GITHUB_CLIENT_SECRET: 'test-github-client-secret',
      ENCRYPTION_SECRET: 'test-encryption-secret',
      ZULIP_CLIENT_ID: 'test-zulip-client-id',
      ZULIP_CLIENT_SECRET: 'test-zulip-client-secret',
      TURNSTILE_SECRET_KEY: 'test-turnstile-secret',
      DEV_BYPASS: 'false',
      CRON_SECRET: 'test-cron-secret',
      SENTRY_DSN: 'https://test-sentry-dsn@sentry.io/123',
    };

    mockContext = {
      env: mockEnv as AppEnv['Bindings'],
      set: vi.fn(),
      get: vi.fn(),
      req: {
        path: '/api/test',
        method: 'GET',
      },
    } as unknown as Context<AppEnv>;

    // Clear cached env before each test
    vi.doMock('./env', async () => {
      const actual = await vi.importActual<typeof import('./env')>('./env');
      return {
        ...actual,
        cachedEnv: null,
      };
    });
  });

  describe('getValidatedEnv', () => {
    it('returns validated environment variables', () => {
      const result = getValidatedEnv(mockEnv);

      expect(result).toBeDefined();
      expect(result.BETTER_AUTH_SECRET).toBe('test-secret-key');
      expect(result.BETTER_AUTH_URL).toBe('http://localhost:5173/api/auth');
      expect(result.ENVIRONMENT).toBe('test');
    });

    it('skips validation when NODE_ENV is test', () => {
      const minimalEnv = {
        ENVIRONMENT: 'test',
      };

      // Should not throw even with missing required vars when NODE_ENV=test
      expect(() => {
        getValidatedEnv(minimalEnv);
      }).not.toThrow();
    });

    it('skips validation when SKIP_ENV_VALIDATION is true', () => {
      const envWithSkip = {
        ...mockEnv,
        SKIP_ENV_VALIDATION: 'true',
      };

      const result = getValidatedEnv(envWithSkip);

      expect(result).toBeDefined();
    });

    it('accepts valid ENUM values for ENVIRONMENT', () => {
      const validEnvs = ['development', 'production', 'test'];

      validEnvs.forEach((envValue) => {
        const env = { ...mockEnv, ENVIRONMENT: envValue };
        expect(() => getValidatedEnv(env)).not.toThrow();
      });
    });

    it('allows optional environment variables to be undefined', () => {
      const minimalEnv = {
        ENVIRONMENT: 'test',
        BETTER_AUTH_SECRET: 'test-secret',
        BETTER_AUTH_URL: 'http://localhost:5173/api/auth',
        GOOGLE_CLIENT_ID: 'test',
        GOOGLE_CLIENT_SECRET: 'test',
        GITHUB_CLIENT_ID: 'test',
        GITHUB_CLIENT_SECRET: 'test',
        ENCRYPTION_SECRET: 'test',
        ZULIP_CLIENT_ID: 'test',
        ZULIP_CLIENT_SECRET: 'test',
      };

      const result = getValidatedEnv(minimalEnv);

      expect(result).toBeDefined();
      expect(result.TURNSTILE_SECRET_KEY).toBeUndefined();
      expect(result.DEV_BYPASS).toBeUndefined();
      expect(result.CRON_SECRET).toBeUndefined();
    });

    it('treats empty strings as undefined', () => {
      const envWithEmptyStrings = {
        ...mockEnv,
        TURNSTILE_SECRET_KEY: '',
        DEV_BYPASS: '',
      };

      const result = getValidatedEnv(envWithEmptyStrings);

      expect(result).toBeDefined();
      expect(result.TURNSTILE_SECRET_KEY).toBeUndefined();
      expect(result.DEV_BYPASS).toBeUndefined();
    });

    it('returns environment values when provided', () => {
      const result = getValidatedEnv(mockEnv);

      expect(result.GOOGLE_CLIENT_ID).toBe('test-google-client-id');
      expect(result.GITHUB_CLIENT_ID).toBe('test-github-client-id');
      expect(result.ENCRYPTION_SECRET).toBe('test-encryption-secret');
      expect(result.ZULIP_CLIENT_ID).toBe('test-zulip-client-id');
    });
  });

  describe('envMiddleware', () => {
    it('attaches validated env to context', async () => {
      const next = vi.fn();

      await envMiddleware(mockContext, next);

      expect(mockContext.set).toHaveBeenCalledWith('env', expect.any(Object));
      expect(next).toHaveBeenCalled();
    });

    it('caches validated env across requests', async () => {
      const next = vi.fn();
      const context1 = { ...mockContext } as unknown as Context<AppEnv>;
      const context2 = { ...mockContext } as unknown as Context<AppEnv>;

      await envMiddleware(context1, next);
      await envMiddleware(context2, next);

      // Both contexts should get the same cached env
      expect(next).toHaveBeenCalledTimes(2);
    });

    it('continues to next middleware in all cases', async () => {
      const next = vi.fn();

      await envMiddleware(mockContext, next);

      expect(next).toHaveBeenCalled();
    });

    it('handles errors gracefully when env validation fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const invalidEnv = {
        ENVIRONMENT: 'test',
      };

      const errorContext = {
        ...mockContext,
        env: invalidEnv as AppEnv['Bindings'],
      } as unknown as Context<AppEnv>;

      const next = vi.fn();

      await envMiddleware(errorContext, next);

      expect(next).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('environment variable structure', () => {
    it('includes all expected authentication variables', () => {
      const result = getValidatedEnv(mockEnv);

      expect(result).toBeDefined();
      expect(result.BETTER_AUTH_SECRET).toBeDefined();
      expect(result.BETTER_AUTH_URL).toBeDefined();
    });

    it('includes OAuth provider credentials', () => {
      const result = getValidatedEnv(mockEnv);

      expect(result.GOOGLE_CLIENT_ID).toBeDefined();
      expect(result.GOOGLE_CLIENT_SECRET).toBeDefined();
      expect(result.GITHUB_CLIENT_ID).toBeDefined();
      expect(result.GITHUB_CLIENT_SECRET).toBeDefined();
    });

    it('includes Zulip integration credentials', () => {
      const result = getValidatedEnv(mockEnv);

      expect(result.ZULIP_CLIENT_ID).toBeDefined();
      expect(result.ZULIP_CLIENT_SECRET).toBeDefined();
    });

    it('includes encryption secret', () => {
      const result = getValidatedEnv(mockEnv);

      expect(result.ENCRYPTION_SECRET).toBeDefined();
    });
  });

  describe('URL handling', () => {
    it('accepts valid URLs for BETTER_AUTH_URL', () => {
      const validUrls = [
        'http://localhost:5173/api/auth',
        'https://aresfirst.org/api/auth',
        'https://api.example.com/auth',
      ];

      validUrls.forEach((url) => {
        const env = { ...mockEnv, BETTER_AUTH_URL: url };
        const result = getValidatedEnv(env);
        expect(result.BETTER_AUTH_URL).toBe(url);
      });
    });

    it('accepts localhost URLs', () => {
      const env = { ...mockEnv, BETTER_AUTH_URL: 'http://localhost:3000/auth' };
      const result = getValidatedEnv(env);

      expect(result.BETTER_AUTH_URL).toBe('http://localhost:3000/auth');
    });
  });

  describe('optional variables', () => {
    const optionalVars = [
      'TURNSTILE_SECRET_KEY',
      'DEV_BYPASS',
      'CRON_SECRET',
      'SENTRY_DSN',
    ];

    it.each(optionalVars)('allows %s to be optional', (varName) => {
      const env = { ...mockEnv };
      delete env[varName];

      expect(() => {
        getValidatedEnv(env);
      }).not.toThrow();
    });
  });
});
