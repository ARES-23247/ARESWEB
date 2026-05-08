/**
 * Factory functions for creating mock data in E2E tests.
 * This provides consistent test data across all test files.
 */

/**
 * Media item interface matching assetSchema from mediaContract.
 */
export interface MockMediaItem {
  key: string;
  size: number;
  uploaded: string;
  url: string;
  httpEtag?: string;
  httpMetadata?: {
    contentType?: string;
  };
  folder?: string | null;
  tags?: string | null;
}

/**
 * Task item interface matching taskSchema from taskContract.
 */
export interface MockTaskItem {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  sort_order: number;
  assignees?: Array<{
    id: string;
    nickname?: string | null;
  }>;
  created_by: string;
  creator_name?: string | null;
  due_date?: string | null;
  created_at: string;
  updated_at: string;
  subteam?: string | null;
  zulip_stream?: string | null;
  zulip_topic?: string | null;
  assigned_to?: string | null;
  assignee_name?: string | null;
  parent_id?: string | null;
  time_spent_seconds?: number | null;
}

/**
 * Creates a mock media item.
 */
export function createMockMediaItem(overrides: Partial<MockMediaItem> = {}): MockMediaItem {
  const now = new Date().toISOString();
  return {
    key: 'test-asset.png',
    size: 12345,
    uploaded: now,
    url: '/api/media/test-asset.png',
    folder: null,
    tags: null,
    ...overrides,
  };
}

/**
 * Creates multiple mock media items for testing filters.
 */
export function createMockMediaItems(): MockMediaItem[] {
  return [
    createMockMediaItem({
      key: 'Gallery/photo1.png',
      folder: 'Gallery',
      size: 10000,
    }),
    createMockMediaItem({
      key: 'Gallery/photo2.png',
      folder: 'Gallery',
      size: 15000,
    }),
    createMockMediaItem({
      key: 'Blog/post1.jpg',
      folder: 'Blog',
      size: 20000,
    }),
    createMockMediaItem({
      key: 'Events/award.png',
      folder: 'Events',
      size: 25000,
    }),
  ];
}

/**
 * Creates a mock task item.
 */
export function createMockTask(overrides: Partial<MockTaskItem> = {}): MockTaskItem {
  const now = new Date().toISOString();
  return {
    id: 'test-task',
    title: 'Test Task',
    description: null,
    status: 'todo',
    priority: 'normal',
    sort_order: 0,
    created_by: 'admin-user',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

/**
 * Creates a mock task with a ProseMirror description.
 */
export function createMockTaskWithDescription(descriptionText: string): MockTaskItem {
  const description = JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: descriptionText }],
      },
    ],
  });

  return createMockTask({
    id: 'existing-task',
    title: 'Existing Task',
    description,
  });
}

/**
 * Creates a minimal PNG buffer (1x1 pixel) for file upload tests.
 */
export function createMinimalPngBuffer(): Buffer {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk start
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d,
    0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

/**
 * Common timeout values for E2E tests.
 * Centralized to avoid magic numbers.
 */
export const TEST_TIMEOUTS = {
  /** Default timeout for element visibility */
  DEFAULT: 10_000,
  /** Timeout for slow-loading pages (dashboard, etc.) */
  SLOW_PAGE: 15_000,
  /** Timeout for very slow operations */
  VERY_SLOW: 30_000,
} as const;
