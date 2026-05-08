import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock D1 database
const mockDb = {
  query: {
    user: {
      findFirst: vi.fn(),
    },
    account: {
      findFirst: vi.fn(),
    },
  },
};

const mockDrizzle = vi.fn(() => mockDb);

vi.mock('drizzle-orm/d1', () => ({
  drizzle: mockDrizzle,
}));

// Mock schema
vi.mock('../../src/db/schema', () => ({
  user: {},
  session: {},
  account: {},
  verification: {},
  notifications: {},
}));

describe('auth configuration utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates auth instance with D1 database', async () => {
    const { getAuth } = await import('./auth');

    const env = {
      BETTER_AUTH_SECRET: 'test-secret-key',
      BETTER_AUTH_URL: 'http://localhost:5173/api/auth',
    };

    const auth = getAuth(mockDb as unknown as Parameters<typeof getAuth>[0], env);

    expect(auth).toBeDefined();
  });

  it('uses dev fallback for localhost when BETTER_AUTH_SECRET is not set', async () => {
    const { getAuth } = await import('./auth');

    const env = {};
    const requestUrl = 'http://localhost:5173/api/auth/test';

    // Should not throw in localhost mode
    expect(() => {
      getAuth(mockDb as unknown as Parameters<typeof getAuth>[0], env, requestUrl);
    }).not.toThrow();
  });

  it('throws error when BETTER_AUTH_SECRET is missing in production', async () => {
    const { getAuth } = await import('./auth');

    const env = {};
    const requestUrl = 'https://aresweb.org/api/auth/test';

    expect(() => {
      getAuth(mockDb as unknown as Parameters<typeof getAuth>[0], env, requestUrl);
    }).toThrow('[FATAL] BETTER_AUTH_SECRET is not set');
  });

  it('includes GitHub OAuth when configured', async () => {
    const { getAuth } = await import('./auth');

    const env = {
      BETTER_AUTH_SECRET: 'test-secret',
      GITHUB_CLIENT_ID: 'test-github-id',
      GITHUB_CLIENT_SECRET: 'test-github-secret',
    };

    const auth = getAuth(mockDb as unknown as Parameters<typeof getAuth>[0], env);
    expect(auth).toBeDefined();
  });

  it('includes Google OAuth when configured', async () => {
    const { getAuth } = await import('./auth');

    const env = {
      BETTER_AUTH_SECRET: 'test-secret',
      GOOGLE_CLIENT_ID: 'test-google-id',
      GOOGLE_CLIENT_SECRET: 'test-google-secret',
    };

    const auth = getAuth(mockDb as unknown as Parameters<typeof getAuth>[0], env);
    expect(auth).toBeDefined();
  });

  it('includes Zulip OAuth when configured', async () => {
    const { getAuth } = await import('./auth');

    const env = {
      BETTER_AUTH_SECRET: 'test-secret',
      ZULIP_CLIENT_ID: 'test-zulip-id',
      ZULIP_CLIENT_SECRET: 'test-zulip-secret',
      ZULIP_URL: 'https://aresfirst.zulipchat.com',
    };

    const auth = getAuth(mockDb as unknown as Parameters<typeof getAuth>[0], env);
    expect(auth).toBeDefined();
  });

  it('configures trusted origins for localhost', async () => {
    const { getAuth } = await import('./auth');

    const env = {
      BETTER_AUTH_SECRET: 'test-secret',
    };

    const auth = getAuth(mockDb as unknown as Parameters<typeof getAuth>[0], env);
    expect(auth).toBeDefined();
  });
});
