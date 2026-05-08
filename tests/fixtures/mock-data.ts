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
 * The url is auto-generated from the key if not provided.
 */
export function createMockMediaItem(overrides: Partial<MockMediaItem> = {}): MockMediaItem {
  const now = new Date().toISOString();
  const key = overrides.key ?? 'test-asset.png';
  return {
    key,
    size: 12345,
    uploaded: now,
    url: overrides.url ?? `/api/media/${key}`,
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
 * Badge item interface matching badgeSchema from badges route.
 */
export interface MockBadgeItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  color_theme: string;
  created_at: string;
}

/**
 * Sponsor item interface matching sponsorResponseSchema from sponsors route.
 */
export interface MockSponsorItem {
  id: string;
  name: string;
  tier: 'Titanium' | 'Gold' | 'Silver' | 'Bronze' | 'In-Kind';
  logo_url: string | null;
  website_url: string | null;
  is_active: number;
  created_at?: string;
}

/**
 * User record interface for badge assignment tests.
 */
export interface MockUserItem {
  id: string;
  name: string | null;
  nickname: string | null;
  email: string;
}

/**
 * Creates a mock badge item.
 */
export function createMockBadge(overrides: Partial<MockBadgeItem> = {}): MockBadgeItem {
  const now = new Date().toISOString();
  return {
    id: 'test-badge',
    name: 'Test Badge',
    description: 'A test badge for E2E testing.',
    icon: 'Award',
    color_theme: 'text-ares-gold',
    created_at: now,
    ...overrides,
  };
}

/**
 * Creates a mock user item for badge assignment tests.
 */
export function createMockUser(overrides: Partial<MockUserItem> = {}): MockUserItem {
  return {
    id: 'test-user',
    name: 'Test User',
    nickname: 'Testy',
    email: 'test@ares.org',
    ...overrides,
  };
}

/**
 * Creates multiple mock badges for testing badge management.
 */
export function createMockBadges(): MockBadgeItem[] {
  return [
    createMockBadge({
      id: 'outreach-mvp',
      name: 'Outreach MVP',
      description: 'Awarded to members who attain top 3 in outreach hours.',
      icon: 'Award',
      color_theme: 'text-ares-gold',
    }),
    createMockBadge({
      id: 'safety-certified',
      name: 'Safety Certified',
      description: 'Completed all safety training modules.',
      icon: 'Shield',
      color_theme: 'text-green-500',
    }),
    createMockBadge({
      id: 'programming-excellence',
      name: 'Programming Excellence',
      description: 'Awarded for outstanding code contributions.',
      icon: 'Code',
      color_theme: 'text-blue-500',
    }),
  ];
}

/**
 * Creates a mock sponsor item.
 */
export function createMockSponsor(overrides: Partial<MockSponsorItem> = {}): MockSponsorItem {
  const now = new Date().toISOString();
  return {
    id: 'test-sponsor',
    name: 'Test Sponsor',
    tier: 'Gold',
    logo_url: null,
    website_url: null,
    is_active: 1,
    created_at: now,
    ...overrides,
  };
}

/**
 * Creates multiple mock sponsors for testing sponsor management.
 */
export function createMockSponsors(): MockSponsorItem[] {
  return [
    createMockSponsor({
      id: 'nasa',
      name: 'NASA',
      tier: 'Titanium',
      logo_url: 'https://example.com/nasa-logo.png',
      website_url: 'https://nasa.gov',
      is_active: 1,
    }),
    createMockSponsor({
      id: 'google',
      name: 'Google',
      tier: 'Gold',
      logo_url: 'https://example.com/google-logo.png',
      website_url: 'https://google.com',
      is_active: 1,
    }),
    createMockSponsor({
      id: 'local-business',
      name: 'Local Hardware Store',
      tier: 'Bronze',
      logo_url: null,
      website_url: 'https://localhardware.com',
      is_active: 1,
    }),
    createMockSponsor({
      id: 'software-donation',
      name: 'Software Company',
      tier: 'In-Kind',
      logo_url: null,
      website_url: 'https://softwareco.com',
      is_active: 1,
    }),
  ];
}

/**
 * Location item interface matching locationSchema from locations route.
 */
export interface MockLocationItem {
  id: string;
  name: string;
  address: string;
  maps_url: string | null;
  is_deleted: number;
}

/**
 * Creates a mock location item.
 */
export function createMockLocation(overrides: Partial<MockLocationItem> = {}): MockLocationItem {
  return {
    id: 'test-location',
    name: 'Test Location',
    address: '123 Test Street, Test City, TX 75001',
    maps_url: 'https://www.google.com/maps/search/?api=1&query=123%20Test%20Street%2C%20Test%20City%2C%20TX%2075001',
    is_deleted: 0,
    ...overrides,
  };
}

/**
 * Creates multiple mock locations for testing location management.
 */
export function createMockLocations(): MockLocationItem[] {
  return [
    createMockLocation({
      id: 'mars-workspace',
      name: 'Mars Workspace',
      address: '123 Robotics Lane, Plano, TX 75074',
      maps_url: 'https://www.google.com/maps/search/?api=1&query=123%20Robotics%20Lane%2C%20Plano%2C%20TX%2075074',
      is_deleted: 0,
    }),
    createMockLocation({
      id: 'competition-arena',
      name: 'Competition Arena',
      address: '4500 W. Illinois St, Midland, TX 79703',
      maps_url: 'https://www.google.com/maps/search/?api=1&query=4500%20W.%20Illinois%20St%2C%20Midland%2C%20TX%2079703',
      is_deleted: 0,
    }),
    createMockLocation({
      id: 'community-center',
      name: 'Community Center',
      address: '1500 Avenue J, Huntsville, TX 77320',
      maps_url: 'https://www.google.com/maps/search/?api=1&query=1500%20Avenue%20J%2C%20Huntsville%2C%20TX%2077320',
      is_deleted: 0,
    }),
  ];
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
