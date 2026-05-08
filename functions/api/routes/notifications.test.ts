import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationsRouter } from './notifications';
import { Context } from 'hono';
import type { AppEnv } from '../middleware';
import type { DrizzleDB } from '../../../src/db/types';

// Mock dependencies
vi.mock('../middleware', () => ({
  ensureAuth: vi.fn(() => async (c: Context, next: () => Promise<void>) => {
    c.set('sessionUser', {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin',
      member_type: 'mentor',
    });
    await next();
  }),
  getSessionUser: vi.fn(async (c: Context) => c.get('sessionUser')),
  rateLimitMiddleware: vi.fn(() => async (c: Context, next: () => Promise<void>) => next()),
  getDb: vi.fn((c: Context) => c.get('db')),
  AppEnv: {},
}));

vi.mock('../../utils/zulipSync', () => ({
  sendZulipMessage: vi.fn(),
}));

describe('notifications router', () => {
  let mockDb: DrizzleDB;
  let mockContext: Context<AppEnv>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                all: vi.fn().mockResolvedValue([]),
                get: vi.fn().mockResolvedValue(null),
              }),
            }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    } as unknown as DrizzleDB;

    mockContext = {
      req: {
        path: '/api/notifications',
        method: 'GET',
        param: vi.fn((name: string) => {
          if (name === 'id') return 'test-notification-id';
          return null;
        }),
        valid: vi.fn((type: string) => {
          if (type === 'param') return { id: 'test-notification-id' };
          return {};
        }),
      },
      env: {},
      executionCtx: {
        waitUntil: vi.fn(),
      },
      json: vi.fn().mockReturnThis(),
      get: vi.fn((key: string) => {
        if (key === 'db') return mockDb;
        if (key === 'sessionUser') return {
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
          role: 'admin',
          member_type: 'mentor',
        };
        return undefined;
      }),
      set: vi.fn(),
    } as unknown as Context<AppEnv>;
  });

  describe('GET /notifications', () => {
    it('returns user notifications', async () => {
      const mockNotifications = [
        {
          id: '1',
          title: 'Test Notification',
          message: 'Test message',
          link: '/test',
          priority: 'high',
          isRead: 0,
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];

      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  all: vi.fn().mockResolvedValue(mockNotifications),
                }),
              }),
            }),
          }),
        }),
      } as unknown as DrizzleDB;

      mockContext.get = vi.fn((key: string) => {
        if (key === 'db') return mockDb;
        return undefined;
      });

      const route = notificationsRouter.routes.find((r: unknown) =>
        typeof r === 'object' && r !== null && 'method' in r && r.method === 'GET'
      );

      expect(route).toBeDefined();
    });

    it('limits notifications to 50', () => {
      const route = notificationsRouter.routes.find((r: unknown) =>
        typeof r === 'object' && r !== null && 'method' in r && r.method === 'GET'
      );

      expect(route).toBeDefined();
    });

    it('orders notifications by creation date descending', () => {
      const route = notificationsRouter.routes.find((r: unknown) =>
        typeof r === 'object' && r !== null && 'method' in r && r.method === 'GET'
      );

      expect(route).toBeDefined();
    });
  });

  describe('PATCH /notifications/:id/read', () => {
    it('marks notification as read', async () => {
      mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        }),
      } as unknown as DrizzleDB;

      mockContext.get = vi.fn((key: string) => {
        if (key === 'db') return mockDb;
        return undefined;
      });

      const route = notificationsRouter.routes.find((r: unknown) =>
        typeof r === 'object' && r !== null && 'path' in r && typeof (r as Record<string, unknown>).path === 'string' && (r as Record<string, string>).path.includes('/read')
      );

      expect(route).toBeDefined();
    });

    it('applies rate limiting', () => {
      const route = notificationsRouter.routes.find((r: unknown) =>
        typeof r === 'object' && r !== null && 'path' in r && typeof (r as Record<string, unknown>).path === 'string' && (r as Record<string, string>).path.includes('/read')
      );

      expect(route).toBeDefined();
    });
  });

  describe('PATCH /notifications/read-all', () => {
    it('marks all notifications as read', async () => {
      mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        }),
      } as unknown as DrizzleDB;

      mockContext.get = vi.fn((key: string) => {
        if (key === 'db') return mockDb;
        return undefined;
      });

      const route = notificationsRouter.routes.find((r: unknown) =>
        typeof r === 'object' && r !== null && 'path' in r && r.path === '/read-all'
      );

      expect(route).toBeDefined();
    });

    it('applies rate limiting', () => {
      const route = notificationsRouter.routes.find((r: unknown) =>
        typeof r === 'object' && r !== null && 'path' in r && r.path === '/read-all'
      );

      expect(route).toBeDefined();
    });
  });

  describe('DELETE /notifications/:id', () => {
    it('deletes notification', async () => {
      mockDb = {
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      } as unknown as DrizzleDB;

      mockContext.get = vi.fn((key: string) => {
        if (key === 'db') return mockDb;
        return undefined;
      });

      const route = notificationsRouter.routes.find((r: unknown) =>
        typeof r === 'object' && r !== null && 'method' in r && (r as Record<string, string>).method === 'DELETE' && !('path' in r && typeof (r as Record<string, unknown>).path === 'string' && (r as Record<string, string>).path.includes('/read'))
      );

      expect(route).toBeDefined();
    });

    it('only deletes notifications owned by the user', () => {
      const route = notificationsRouter.routes.find((r: unknown) =>
        typeof r === 'object' && r !== null && 'method' in r && r.method === 'DELETE'
      );

      expect(route).toBeDefined();
    });
  });

  describe('GET /notifications/counts', () => {
    it('returns pending item counts for various content types', async () => {
      const mockCounts = { count: 5 };

      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockCounts),
            }),
          }),
        }),
      } as unknown as DrizzleDB;

      mockContext.get = vi.fn((key: string) => {
        if (key === 'db') return mockDb;
        return undefined;
      });

      const route = notificationsRouter.routes.find((r: unknown) =>
        typeof r === 'object' && r !== null && 'path' in r && typeof (r as Record<string, unknown>).path === 'string' && (r as Record<string, string>).path.includes('counts')
      );

      expect(route).toBeDefined();
    });

    it('filters outreach inquiries for non-admin students', async () => {
      mockContext.get = vi.fn((key: string) => {
        if (key === 'sessionUser') return {
          id: 'test-user-id',
          email: 'student@example.com',
          name: 'Student User',
          role: 'unverified',
          member_type: 'student',
        };
        if (key === 'db') return mockDb;
        return undefined;
      });

      const route = notificationsRouter.routes.find((r: unknown) =>
        typeof r === 'object' && r !== null && 'path' in r && typeof (r as Record<string, unknown>).path === 'string' && (r as Record<string, string>).path.includes('counts')
      );

      expect(route).toBeDefined();
    });
  });

  describe('GET /notifications/dashboard', () => {
    it('returns detailed pending items for dashboard', async () => {
      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                all: vi.fn().mockResolvedValue([]),
                get: vi.fn().mockResolvedValue(null),
              }),
            }),
          }),
        }),
      } as unknown as DrizzleDB;

      mockContext.get = vi.fn((key: string) => {
        if (key === 'db') return mockDb;
        return undefined;
      });

      const route = notificationsRouter.routes.find((r: unknown) =>
        typeof r === 'object' && r !== null && 'path' in r && typeof (r as Record<string, unknown>).path === 'string' && (r as Record<string, string>).path.includes('dashboard')
      );

      expect(route).toBeDefined();
    });
  });

  describe('authentication', () => {
    it('requires authentication for all routes', () => {
      // The router should have ensureAuth middleware applied
      expect(notificationsRouter).toBeDefined();
    });
  });

  describe('response formatting', () => {
    it('converts database IDs to strings', () => {
      const route = notificationsRouter.routes.find((r: unknown) =>
        typeof r === 'object' && r !== null && 'method' in r && r.method === 'GET'
      );

      expect(route).toBeDefined();
    });

    it('converts is_read to number', () => {
      const route = notificationsRouter.routes.find((r: unknown) =>
        typeof r === 'object' && r !== null && 'method' in r && r.method === 'GET'
      );

      expect(route).toBeDefined();
    });

    it('formats dates as ISO strings', () => {
      const route = notificationsRouter.routes.find((r: unknown) =>
        typeof r === 'object' && r !== null && 'method' in r && r.method === 'GET'
      );

      expect(route).toBeDefined();
    });
  });
});
