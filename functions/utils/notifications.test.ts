import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Context } from 'hono';
import { AppEnv } from '../api/middleware/utils';
import { emitNotification, notifyByRole, notifyAdmins } from './notifications';

// Mock crypto.randomUUID safely without overwriting the whole crypto object
vi.spyOn(crypto, 'randomUUID').mockReturnValue('12345678-1234-1234-1234-123456789012');

function createMockContext(overrides?: {
  dbResults?: unknown[];
  envExtras?: Record<string, unknown>;
}) {
  const mockAll = vi.fn().mockResolvedValue(overrides?.dbResults ?? []);
  const mockRun = vi.fn().mockResolvedValue({});
  const mockDynamic = vi.fn().mockReturnThis();

  // Create chainable query builder
  const queryBuilder = {
    $dynamic: mockDynamic,
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    all: mockAll,
  };

  // Create from builder that returns the query builder
  const fromBuilder = {
    $dynamic: mockDynamic,
    where: vi.fn().mockReturnValue(queryBuilder),
    innerJoin: vi.fn().mockReturnValue(queryBuilder),
  };

  const mockDb = {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        run: mockRun,
        onConflictDoUpdate: vi.fn().mockReturnValue({
          run: mockRun,
        }),
        onConflictDoNothing: vi.fn().mockReturnValue({
          run: mockRun,
        }),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue(fromBuilder),
    }),
    query: {
      notifications: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  const mockCtx = {
    get: vi.fn().mockReturnValue(mockDb),
    env: {
      ZULIP_BOT_EMAIL: 'bot@test.com',
      ZULIP_API_KEY: 'test-key',
      ...(overrides?.envExtras || {}),
    },
    executionCtx: {
      waitUntil: vi.fn(),
    },
  } as unknown as Context<AppEnv>;

  return {
    mockCtx,
    mockDb,
    mockRun,
    mockAll,
  };
}

describe('notifications utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('emitNotification()', () => {
    it('inserts notification with priority into D1', async () => {
      const { mockCtx, mockDb, mockRun } = createMockContext();

      await emitNotification(mockCtx, {
        userId: 'user-123',
        title: 'Test Alert',
        message: 'Something happened',
        link: '/dashboard',
        priority: 'high',
      });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.insert().values).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-123',
        priority: 'high'
      }));
      expect(mockRun).toHaveBeenCalled();
    });

    it('handles missing link gracefully (null)', async () => {
      const { mockCtx, mockDb } = createMockContext();

      await emitNotification(mockCtx, {
        userId: 'user-456',
        title: 'No Link Alert',
        message: 'No link provided',
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('defaults priority to low', async () => {
      const { mockCtx, mockDb } = createMockContext();

      await emitNotification(mockCtx, {
        userId: 'user-789',
        title: 'Default Priority',
        message: 'Should default to low',
      });

      expect(mockDb.insert().values).toHaveBeenCalledWith(expect.objectContaining({
        priority: 'low'
      }));
    });

    it('survives D1 failure without throwing', async () => {
      const { mockCtx, mockRun } = createMockContext();
      mockRun.mockRejectedValueOnce(new Error('D1_ERROR'));

      await expect(emitNotification(mockCtx, {
        userId: 'user-fail',
        title: 'Fail Test',
        message: 'Should not throw',
      })).resolves.not.toThrow();
    });
  });

  describe('notifyByRole()', () => {
    it('returns early for empty audiences', async () => {
      const { mockCtx, mockDb } = createMockContext();

      await notifyByRole(mockCtx, [], {
        title: 'Empty',
        message: 'No audience',
      });

      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('queries admin users when audience includes admin', async () => {
      const { mockCtx, mockAll } = createMockContext({
        dbResults: [{ id: 'admin-1' }],
      });

      await notifyByRole(mockCtx, ['admin'], {
        title: 'Admin Alert',
        message: 'Test',
        priority: 'high',
      });

      expect(mockAll).toHaveBeenCalled();
    });

    it('queries profile types when audience includes coach/mentor', async () => {
      const { mockCtx, mockAll } = createMockContext({
        dbResults: [{ id: 'coach-1' }],
      });

      await notifyByRole(mockCtx, ['coach', 'mentor'], {
        title: 'Staff Alert',
        message: 'Test',
      });

      expect(mockAll).toHaveBeenCalled();
    });

    it('chunks notifications into batches of 100 to respect D1 limits', async () => {
      const mockUsers = Array.from({ length: 150 }, (_, i) => ({ id: `user-${i}` }));

      const { mockCtx, mockDb } = createMockContext({
        dbResults: mockUsers,
      });

      await notifyByRole(mockCtx, ['student'], {
        title: 'Chunk Alert',
        message: 'Testing chunking',
      });

      // 150 users / 100 max batch size = 2 chunks + 1 initial query
      // Initial query for users, then 2 batch inserts
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('survives D1 failure without throwing', async () => {
      const { mockCtx, mockRun } = createMockContext();
      mockRun.mockRejectedValueOnce(new Error('D1_ERROR'));

      await expect(notifyByRole(mockCtx, ['admin'], {
        title: 'Fail',
        message: 'Should not throw',
      })).resolves.not.toThrow();
    });
  });

  describe('notifyAdmins()', () => {
    it('delegates to notifyByRole with admin audience', async () => {
      const { mockCtx, mockAll } = createMockContext({
        dbResults: [{ id: 'admin-1' }],
      });

      await notifyAdmins(mockCtx, {
        title: 'Admin Only',
        message: 'Test',
      });

      expect(mockAll).toHaveBeenCalled();
    });
  });
});
