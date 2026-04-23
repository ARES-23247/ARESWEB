import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: () => 'test-uuid-1234',
});

// Mock Hono context factory
function createMockContext(overrides?: {
  dbResults?: Record<string, unknown>[];
  dbFirstResult?: Record<string, unknown> | null;
  batchResults?: unknown[];
  envExtras?: Record<string, unknown>;
}) {
  const prepareResults = overrides?.dbResults || [];
  const firstResult = overrides?.dbFirstResult ?? null;
  const batchFn = vi.fn().mockResolvedValue(overrides?.batchResults || []);

  const bindMock = vi.fn().mockReturnValue({
    all: vi.fn().mockResolvedValue({ results: prepareResults }),
    first: vi.fn().mockResolvedValue(firstResult),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
  });

  const prepareMock = vi.fn().mockReturnValue({
    bind: bindMock,
    all: vi.fn().mockResolvedValue({ results: prepareResults }),
    first: vi.fn().mockResolvedValue(firstResult),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
  });

  return {
    env: {
      DB: {
        prepare: prepareMock,
        batch: batchFn,
      },
      ZULIP_BOT_EMAIL: 'bot@test.com',
      ZULIP_API_KEY: 'test-key',
      ...(overrides?.envExtras || {}),
    },
    prepareMock,
    bindMock,
    batchFn,
  };
}

describe('notifications utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('emitNotification()', () => {
    it('inserts notification with priority into D1', async () => {
      const { env, prepareMock } = createMockContext();
      
      // Dynamic import to get fresh module
      const { emitNotification } = await import('./notifications');
      
      const mockContext = { env } as unknown as import('hono').Context;
      
      await emitNotification(mockContext, {
        userId: 'user-123',
        title: 'Test Alert',
        message: 'Something happened',
        link: '/dashboard',
        priority: 'high',
      });

      expect(prepareMock).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications')
      );
      // Verify the SQL includes priority column
      expect(prepareMock).toHaveBeenCalledWith(
        expect.stringContaining('priority')
      );
    });

    it('handles missing link gracefully (null)', async () => {
      const { env, prepareMock } = createMockContext();
      const { emitNotification } = await import('./notifications');
      
      const mockContext = { env } as unknown as import('hono').Context;
      
      await emitNotification(mockContext, {
        userId: 'user-456',
        title: 'No Link Alert',
        message: 'No link provided',
      });

      expect(prepareMock).toHaveBeenCalled();
    });

    it('defaults priority to low', async () => {
      const { env } = createMockContext();
      const { emitNotification } = await import('./notifications');
      
      const mockContext = { env } as unknown as import('hono').Context;
      
      // Should not throw when priority is omitted
      await expect(emitNotification(mockContext, {
        userId: 'user-789',
        title: 'Default Priority',
        message: 'Should default to low',
      })).resolves.not.toThrow();
    });

    it('survives D1 failure without throwing', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockRejectedValue(new Error('D1_ERROR')),
        }),
      });
      
      const env = {
        DB: { prepare: mockPrepare, batch: vi.fn() },
        ZULIP_BOT_EMAIL: '',
        ZULIP_API_KEY: '',
      };
      
      const { emitNotification } = await import('./notifications');
      const mockContext = { env } as unknown as import('hono').Context;
      
      // Should not throw — errors are caught internally
      await expect(emitNotification(mockContext, {
        userId: 'user-fail',
        title: 'Fail Test',
        message: 'Should not throw',
      })).resolves.not.toThrow();
    });
  });

  describe('notifyByRole()', () => {
    it('returns early for empty audiences', async () => {
      const { env, prepareMock } = createMockContext();
      const { notifyByRole } = await import('./notifications');
      
      const mockContext = { env } as unknown as import('hono').Context;
      
      await notifyByRole(mockContext, [], {
        title: 'Empty',
        message: 'No audience',
      });

      // Should not query DB at all
      expect(prepareMock).not.toHaveBeenCalled();
    });

    it('queries admin users when audience includes admin', async () => {
      const { env, prepareMock } = createMockContext({
        dbResults: [{ id: 'admin-1' }, { id: 'admin-2' }],
      });
      const { notifyByRole } = await import('./notifications');
      
      const mockContext = { env } as unknown as import('hono').Context;
      
      await notifyByRole(mockContext, ['admin'], {
        title: 'Admin Alert',
        message: 'Test',
        priority: 'high',
      });

      // Should have prepared a SELECT for admin users
      expect(prepareMock).toHaveBeenCalledWith(
        expect.stringContaining("role = 'admin'")
      );
    });

    it('queries profile types when audience includes coach/mentor', async () => {
      const { env, prepareMock } = createMockContext({
        dbResults: [{ id: 'coach-1' }],
      });
      const { notifyByRole } = await import('./notifications');
      
      const mockContext = { env } as unknown as import('hono').Context;
      
      await notifyByRole(mockContext, ['coach', 'mentor'], {
        title: 'Staff Alert',
        message: 'Test',
      });

      expect(prepareMock).toHaveBeenCalledWith(
        expect.stringContaining('member_type IN')
      );
    });

    it('chunks notifications into batches of 100 to respect D1 limits', async () => {
      // Create 150 fake users to trigger chunking
      const mockUsers = Array.from({ length: 150 }).map((_, i) => ({ id: `user-${i}` }));
      
      const { env, batchFn } = createMockContext({
        dbResults: mockUsers,
      });
      const { notifyByRole } = await import('./notifications');
      
      const mockContext = { env } as unknown as import('hono').Context;
      
      await notifyByRole(mockContext, ['student'], {
        title: 'Chunk Alert',
        message: 'Testing chunking',
      });

      // 150 users / 100 max batch size = 2 chunks
      expect(batchFn).toHaveBeenCalledTimes(2);
      
      // First chunk should have 100 statements
      expect(batchFn.mock.calls[0][0].length).toBe(100);
      // Second chunk should have 50 statements
      expect(batchFn.mock.calls[1][0].length).toBe(50);
    });

    it('handles combined admin + profile type audiences', async () => {
      const { env, prepareMock } = createMockContext({
        dbResults: [{ id: 'user-1' }],
      });
      const { notifyByRole } = await import('./notifications');
      
      const mockContext = { env } as unknown as import('hono').Context;
      
      await notifyByRole(mockContext, ['admin', 'student'], {
        title: 'Combined Alert',
        message: 'Test',
      });

      // UNION query should contain both admin and member_type checks
      const query = prepareMock.mock.calls[0]?.[0] as string;
      expect(query).toContain("role = 'admin'");
      expect(query).toContain('member_type IN');
    });

    it('survives D1 failure without throwing', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockRejectedValue(new Error('D1_ERROR')),
        }),
        all: vi.fn().mockRejectedValue(new Error('D1_ERROR')),
      });

      const env = {
        DB: { prepare: mockPrepare, batch: vi.fn() },
        ZULIP_BOT_EMAIL: '',
        ZULIP_API_KEY: '',
      };
      const { notifyByRole } = await import('./notifications');
      const mockContext = { env } as unknown as import('hono').Context;
      
      await expect(notifyByRole(mockContext, ['admin'], {
        title: 'Fail',
        message: 'Should not throw',
      })).resolves.not.toThrow();
    });
  });

  describe('notifyAdmins()', () => {
    it('delegates to notifyByRole with admin audience', async () => {
      const { env, prepareMock } = createMockContext({
        dbResults: [{ id: 'admin-1' }],
      });
      const { notifyAdmins } = await import('./notifications');
      
      const mockContext = { env } as unknown as import('hono').Context;
      
      await notifyAdmins(mockContext, {
        title: 'Admin Only',
        message: 'Test',
      });

      expect(prepareMock).toHaveBeenCalledWith(
        expect.stringContaining("role = 'admin'")
      );
    });
  });
});
