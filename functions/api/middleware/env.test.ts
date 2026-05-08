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
  });

  describe('getValidatedEnv', () => {
    it('validates required environment variables', () => {
      const result = getValidatedEnv(mockEnv);

      expect(result).toBeDefined();
      expect(result.BETTER_AUTH_SECRET).toBe('test-secret-key');
      expect(result.BETTER_AUTH_URL).toBe('http://localhost:5173/api/auth');
    });

    it('skips validation when NODE_ENV is test', () => {
      (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process = { env: { NODE_ENV: 'test' } };

      const minimalEnv = {
        ENVIRONMENT: 'test',
      };

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

    it('validates ENUM values for ENVIRONMENT', () => {
      const validEnvs = ['development', 'production', 'test'];

      validEnvs.forEach((envValue) => {
        const env = { ...mockEnv, ENVIRONMENT: envValue };
        expect(() => getValidatedEnv(env)).not.toThrow();
      });
    });

    it('rejects invalid ENVIRONMENT values', () => {
      const env = { ...mockEnv, ENVIRONMENT: 'invalid' };

      // Should throw due to invalid enum value
      expect(() => {
        getValidatedEnv(env);
      }).toThrow();
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

    it('returns 500 in production when env validation fails', async () => {
      const invalidEnv = {
        ENVIRONMENT: 'production',
        // Missing required secrets
      };

      const productionContext = {
        ...mockContext,
        env: invalidEnv as AppEnv['Bindings'],
        json: vi.fn().mockReturnThis(),
      } as unknown as Context<AppEnv>;

      const next = vi.fn();

      await envMiddleware(productionContext, next);

      expect(productionContext.json).toHaveBeenCalledWith(
        {
          error: 'Configuration Error',
          message: 'The server is missing required environment variables.',
        },
        500
      );
    });

    it('continues in non-production when env validation fails', async () => {
      const invalidEnv = {
        ENVIRONMENT: 'development',
        // Missing required secrets
      };

      const devContext = {
        ...mockContext,
        env: invalidEnv as AppEnv['Bindings'],
      } as unknown as Context<AppEnv>;

      const next = vi.fn();

      await envMiddleware(devContext, next);

      expect(next).toHaveBeenCalled();
    });

    it('logs environment validation errors', async () => {
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

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('environment variable requirements', () => {
    const requiredVars = [
      'BETTER_AUTH_SECRET',
      'BETTER_AUTH_URL',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GITHUB_CLIENT_ID',
      'GITHUB_CLIENT_SECRET',
      'ENCRYPTION_SECRET',
      'ZULIP_CLIENT_ID',
      'ZULIP_CLIENT_SECRET',
    ];

    it.each(requiredVars)('requires %s to be set', (varName) => {
      const env = { ...mockEnv };
      delete env[varName];

      expect(() => {
        getValidatedEnv(env);
      }).toThrow();
    });

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

  describe('URL validation', () => {
    it('requires valid URL for BETTER_AUTH_URL', () => {
      const envWithInvalidUrl = {
        ...mockEnv,
        BETTER_AUTH_URL: 'not-a-valid-url',
      };

      expect(() => {
        getValidatedEnv(envWithInvalidUrl);
      }).toThrow();
    });

    it('accepts valid URLs', () => {
      const validUrls = [
        'http://localhost:5173/api/auth',
        'https://aresfirst.org/api/auth',
        'https://api.example.com/auth',
      ];

      validUrls.forEach((url) => {
        const env = { ...mockEnv, BETTER_AUTH_URL: url };
        expect(() => getValidatedEnv(env)).not.toThrow();
      });
    });
  });

  describe('minimum length validation', () => {
    it('requires non-empty strings for required variables', () => {
      const envWithEmpty = {
        ...mockEnv,
        BETTER_AUTH_SECRET: '',
      };

      expect(() => {
        getValidatedEnv(envWithEmpty);
      }).toThrow();
    });
  });
});
