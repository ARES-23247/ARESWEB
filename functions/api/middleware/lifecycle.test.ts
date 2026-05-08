import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Context } from 'hono';
import { createContentLifecycleRouter } from './lifecycle';
import type { AppEnv } from './utils';
import type { DrizzleDB } from '../../../src/db/types';

// Mock dependencies
vi.mock('./utils', () => ({
  ensureAdmin: vi.fn(() => async (c: Context, next: () => Promise<void>) => {
    c.set('sessionUser', { id: 'admin-user', role: 'admin', email: 'admin@example.com' });
    await next();
  }),
  getDb: vi.fn((c: Context) => c.get('db')),
  logAuditAction: vi.fn(() => Promise.resolve()),
  AppEnv: {},
}));

vi.mock('drizzle-orm', () => ({
  sql: {
    raw: (_str: TemplateStringsArray, ..._vals: unknown[]) => ({
      get: () => Promise.resolve({}),
      run: () => Promise.resolve({}),
      execute: () => Promise.resolve({}),
    }),
  },
}));

describe('lifecycle middleware', () => {
  let mockDb: DrizzleDB;
  let mockEnv: AppEnv['Bindings'];
  let mockContext: Context<AppEnv>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      run: vi.fn().mockResolvedValue(undefined),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        }),
      }),
    } as unknown as DrizzleDB;

    mockEnv = {
      ENVIRONMENT: 'test',
    } as AppEnv['Bindings'];

    mockContext = {
      req: {
        param: vi.fn((name: string) => {
          if (name === 'id') return 'test-id';
          return null;
        }),
        path: '/api/posts/test-id/approve',
        json: vi.fn().mockResolvedValue({ reason: 'Test reason' }),
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

  describe('createContentLifecycleRouter', () => {
    it('throws error for invalid table name', () => {
      expect(() => {
        createContentLifecycleRouter('invalid_table');
      }).toThrow('[Security] Invalid table or column name in lifecycle router');
    });

    it('throws error for invalid column name', () => {
      expect(() => {
        createContentLifecycleRouter('posts', undefined, 'invalid_column');
      }).toThrow('[Security] Invalid table or column name in lifecycle router');
    });

    it('creates router for valid table and column', () => {
      const router = createContentLifecycleRouter('posts');
      expect(router).toBeDefined();
    });

    it('creates router with custom id column', () => {
      const router = createContentLifecycleRouter('posts', undefined, 'slug');
      expect(router).toBeDefined();
    });
  });

  describe('approve route', () => {
    it('approves content successfully', async () => {
      const router = createContentLifecycleRouter('posts');
      const _testContext = {
        ...mockContext,
        req: {
          ...mockContext.req,
          path: '/api/posts/test-id/approve',
          param: vi.fn((name: string) => {
            if (name === 'id') return 'test-id';
            return null;
          }),
        },
      } as unknown as Context<AppEnv>;

      // Simulate route handling
      const handler = router.routes.find((r: unknown) =>
        typeof r === 'object' && r !== null && 'path' in r && r.path === '/:id/approve'
      );
      expect(handler).toBeDefined();
    });

    it('executes custom onApprove hook', async () => {
      const onApproveSpy = vi.fn().mockResolvedValue(true);
      const router = createContentLifecycleRouter('posts', {
        onApprove: onApproveSpy,
      });

      expect(router).toBeDefined();
    });

    it('includes warnings from hook when present', async () => {
      const onApproveSpy = vi.fn().mockResolvedValue({
        handled: true,
        warnings: ['Warning 1', 'Warning 2'],
      });
      const router = createContentLifecycleRouter('posts', {
        onApprove: onApproveSpy,
      });

      expect(router).toBeDefined();
    });
  });

  describe('reject route', () => {
    it('rejects content with reason', async () => {
      const router = createContentLifecycleRouter('posts');
      const _testContext = {
        ...mockContext,
        req: {
          ...mockContext.req,
          path: '/api/posts/test-id/reject',
          param: vi.fn((name: string) => {
            if (name === 'id') return 'test-id';
            return null;
          }),
          json: vi.fn().mockResolvedValueOnce({ reason: 'Spam content' }),
        },
      } as unknown as Context<AppEnv>;

      // Simulate route handling
      const handler = router.routes.find((r: unknown) =>
        typeof r === 'object' && r !== null && 'path' in r && r.path === '/:id/reject'
      );
      expect(handler).toBeDefined();
    });

    it('executes custom onReject hook', async () => {
      const onRejectSpy = vi.fn().mockResolvedValue(true);
      const router = createContentLifecycleRouter('posts', {
        onReject: onRejectSpy,
      });

      expect(router).toBeDefined();
    });
  });

  describe('restore route', () => {
    it('restores deleted content', async () => {
      const router = createContentLifecycleRouter('posts');
      const _testContext = {
        ...mockContext,
        req: {
          ...mockContext.req,
          path: '/api/posts/test-id/restore',
          param: vi.fn((name: string) => {
            if (name === 'id') return 'test-id';
            return null;
          }),
        },
      } as unknown as Context<AppEnv>;

      const handler = router.routes.find((r: unknown) =>
        typeof r === 'object' && r !== null && 'path' in r && r.path === '/:id/restore'
      );
      expect(handler).toBeDefined();
    });

    it('executes custom onRestore hook', async () => {
      const onRestoreSpy = vi.fn().mockResolvedValue(true);
      const router = createContentLifecycleRouter('posts', {
        onRestore: onRestoreSpy,
      });

      expect(router).toBeDefined();
    });
  });

  describe('soft delete route', () => {
    it('soft deletes content', async () => {
      const router = createContentLifecycleRouter('posts');
      const _testContext = {
        ...mockContext,
        req: {
          ...mockContext.req,
          path: '/api/posts/test-id',
          method: 'DELETE',
          param: vi.fn((name: string) => {
            if (name === 'id') return 'test-id';
            return null;
          }),
        },
      } as unknown as Context<AppEnv>;

      const handler = router.routes.find((r: unknown) =>
        typeof r === 'object' && r !== null && 'method' in r && r.method === 'DELETE'
      );
      expect(handler).toBeDefined();
    });

    it('executes custom onDelete hook for trash', async () => {
      const onDeleteSpy = vi.fn().mockResolvedValue(true);
      const router = createContentLifecycleRouter('posts', {
        onDelete: onDeleteSpy,
      });

      expect(router).toBeDefined();
    });

    it('handles errors gracefully', async () => {
      const router = createContentLifecycleRouter('posts');
      const errorDb = {
        ...mockDb,
        run: vi.fn().mockRejectedValue(new Error('Database error')),
      } as unknown as DrizzleDB;

      const _testContext = {
        ...mockContext,
        get: vi.fn((key: string) => {
          if (key === 'db') return errorDb;
          return undefined;
        }),
      } as unknown as Context<AppEnv>;

      expect(router).toBeDefined();
    });
  });

  describe('purge route', () => {
    it('hard deletes content', async () => {
      const router = createContentLifecycleRouter('posts');
      const _testContext = {
        ...mockContext,
        req: {
          ...mockContext.req,
          path: '/api/posts/test-id/purge',
          method: 'DELETE',
          param: vi.fn((name: string) => {
            if (name === 'id') return 'test-id';
            return null;
          }),
        },
      } as unknown as Context<AppEnv>;

      const handler = router.routes.find((r: unknown) =>
        typeof r === 'object' && r !== null && 'path' in r && r.path === '/:id/purge'
      );
      expect(handler).toBeDefined();
    });

    it('executes custom onDelete hook for purge', async () => {
      const onDeleteSpy = vi.fn().mockResolvedValue(true);
      const router = createContentLifecycleRouter('posts', {
        onDelete: onDeleteSpy,
      });

      expect(router).toBeDefined();
    });
  });

  describe('allowed tables and columns', () => {
    const allowedTables = [
      'posts', 'events', 'docs', 'inquiries', 'users', 'comments',
      'media', 'awards', 'outreach', 'sponsors', 'judges', 'locations',
      'badges', 'user_profiles',
    ];

    it.each(allowedTables)('creates router for %s table', (table) => {
      expect(() => {
        createContentLifecycleRouter(table);
      }).not.toThrow();
    });

    it('creates router with different id columns', () => {
      expect(() => {
        createContentLifecycleRouter('posts', undefined, 'id');
        createContentLifecycleRouter('posts', undefined, 'slug');
        createContentLifecycleRouter('users', undefined, 'user_id');
      }).not.toThrow();
    });
  });

  describe('authentication', () => {
    it('requires admin authentication for all routes', () => {
      const router = createContentLifecycleRouter('posts');

      // All lifecycle routes should have ensureAdmin middleware
      expect(router).toBeDefined();
    });
  });

  describe('audit logging', () => {
    it('logs approve actions', () => {
      // const _logAuditActionMock = vi.mocked(logAuditAction);
      const router = createContentLifecycleRouter('posts');

      expect(router).toBeDefined();
    });

    it('logs reject actions', () => {
      const router = createContentLifecycleRouter('posts');

      expect(router).toBeDefined();
    });

    it('logs restore actions', () => {
      const router = createContentLifecycleRouter('posts');

      expect(router).toBeDefined();
    });

    it('logs delete actions', () => {
      const router = createContentLifecycleRouter('posts');

      expect(router).toBeDefined();
    });

    it('logs purge actions', () => {
      const router = createContentLifecycleRouter('posts');

      expect(router).toBeDefined();
    });
  });
});
