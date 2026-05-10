/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SCHEMA-BASED TEST FIXTURE GENERATORS
 * ─────────────────────────────────────────────────────────────────────────────
 * Generate valid test data from Zod schemas. Eliminates manual fixture maintenance
 * and ensures test data matches schema validation rules.
 *
 * Usage:
 *   import { generateEvent, generatePost, generateUser } from '@test/fixtures/generators';
 *
 *   // Generate with defaults
 *   const mockEvent = generateEvent();
 *
 *   // Generate with overrides
 *   const mockEvent = generateEvent({ title: 'Kickoff Meeting' });
 *
 *   // Generate array of items
 *   const mockEvents = generateEvents(5);
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { z } from 'zod';
import {
  insertEventSchema,
  insertPostSchema,
  insertUserSchema,
  insertSponsorSchema,
  insertBadgeSchema,
  insertTaskSchema,
  insertLocationSchema,
  insertDocSchema,
  insertUserProfileSchema,
} from '../../shared/db/schema-zod';

// ============================================================================
// GENERATOR UTILITIES
// ============================================================================

/**
 * Default options for fixture generation
 */
interface GeneratorOptions<T> {
  overrides?: Partial<T>;
  exclude?: (keyof T)[];
}

/**
 * Generate a single fixture from a schema with defaults and optional overrides
 */
function generateFixture<T>(
  defaults: T,
  options: GeneratorOptions<T> = {}
): T {
  const { overrides = {}, exclude = [] } = options;

  const result = { ...defaults };

  // Apply overrides
  for (const [key, value] of Object.entries(overrides)) {
    if (!exclude.includes(key as keyof T)) {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  // Remove excluded fields
  for (const key of exclude) {
    delete (result as Record<string, unknown>)[key as string];
  }

  return result;
}

/**
 * Generate an array of fixtures
 */
function generateFixtures<T>(
  generator: (options?: GeneratorOptions<T>) => T,
  count: number,
  options?: GeneratorOptions<T>
): T[] {
  return Array.from({ length: count }, (_, i) =>
    generator({ ...options, overrides: { ...options?.overrides, id: `test-${i}` } })
  );
}

// ============================================================================
// FIELD GENERATORS
// ============================================================================

/**
 * Generate a random ISO date string
 */
function isoDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
}

/**
 * Generate a random UUID
 */
function uuid(): string {
  return crypto.randomUUID();
}

/**
 * Generate a random email
 */
function email(name = 'test'): string {
  return `${name}-${Math.random().toString(36).substring(7)}@ares.org`;
}

/**
 * Generate a random slug
 */
function slug(name = 'test'): string {
  return `${name}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Generate a random URL
 */
function url(path = ''): string {
  return `https://aresfirst.org${path}`;
}


// ============================================================================
// EVENT FIXTURES
// ============================================================================

const EVENT_DEFAULTS = {
  id: uuid(),
  title: 'Team Meeting',
  dateStart: isoDate(),
  dateEnd: isoDate(2),
  location: 'AHS Room 123',
  description: 'Weekly team meeting to discuss upcoming competitions.',
  status: 'published',
  eventType: 'meeting',
  isAllDay: false,
  rsvpRequired: false,
  meetingNotes: null,
  calendarEventId: null,
  googleCalendarEventId: null,
  createdAt: isoDate(-7),
  updatedAt: isoDate(-7),
  isDeleted: false,
} as const;

/**
 * Generate a mock event fixture
 */
export function generateEvent(
  options?: GeneratorOptions<z.infer<typeof insertEventSchema>>
): z.infer<typeof insertEventSchema> {
  return generateFixture(EVENT_DEFAULTS, options);
}

/**
 * Generate multiple mock event fixtures
 */
export function generateEvents(
  count: number,
  options?: GeneratorOptions<z.infer<typeof insertEventSchema>>
): z.infer<typeof insertEventSchema>[] {
  return generateFixtures(generateEvent, count, options);
}

// ============================================================================
// POST FIXTURES
// ============================================================================

const POST_DEFAULTS = {
  slug: slug('post'),
  title: 'Team Update',
  content: 'This is a sample blog post about our team activities.',
  excerpt: 'A brief summary of the team update.',
  authorId: 'test-user-id',
  status: 'published',
  featuredImage: null,
  category: 'updates',
  tags: '["team", "update"]',
  metaTitle: null,
  metaDescription: null,
  publishedAt: isoDate(-1),
  createdAt: isoDate(-2),
  updatedAt: isoDate(-1),
  isDeleted: false,
} as const;

/**
 * Generate a mock post fixture
 */
export function generatePost(
  options?: GeneratorOptions<z.infer<typeof insertPostSchema>>
): z.infer<typeof insertPostSchema> {
  return generateFixture(POST_DEFAULTS, options);
}

/**
 * Generate multiple mock post fixtures
 */
export function generatePosts(
  count: number,
  options?: GeneratorOptions<z.infer<typeof insertPostSchema>>
): z.infer<typeof insertPostSchema>[] {
  return generateFixtures(generatePost, count, options);
}

// ============================================================================
// USER FIXTURES
// ============================================================================

const USER_DEFAULTS = {
  id: uuid(),
  name: 'Test User',
  email: email(),
  emailVerified: true,
  image: null,
  role: 'user',
  createdAt: isoDate(-30),
  updatedAt: isoDate(-30),
} as const;

/**
 * Generate a mock user fixture
 */
export function generateUser(
  options?: GeneratorOptions<z.infer<typeof insertUserSchema>>
): z.infer<typeof insertUserSchema> {
  return generateFixture(USER_DEFAULTS, options);
}

/**
 * Generate multiple mock user fixtures
 */
export function generateUsers(
  count: number,
  options?: GeneratorOptions<z.infer<typeof insertUserSchema>>
): z.infer<typeof insertUserSchema>[] {
  return generateFixtures(generateUser, count, options);
}

// ============================================================================
// USER PROFILE FIXTURES
// ============================================================================

const USER_PROFILE_DEFAULTS = {
  userId: uuid(),
  nickname: 'Testy',
  memberType: 'student',
  graduationYear: new Date().getFullYear() + 2,
  phone: null,
  address: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  allergies: null,
  tshirtSize: null,
  diet: null,
  bio: null,
  skills: null,
  hours: 0,
  attendanceCount: 0,
  subteam: null,
  joinedAt: isoDate(-365),
  isMinor: true,
  createdAt: isoDate(-365),
  updatedAt: isoDate(-365),
} as const;

/**
 * Generate a mock user profile fixture
 */
export function generateUserProfile(
  options?: GeneratorOptions<z.infer<typeof insertUserProfileSchema>>
): z.infer<typeof insertUserProfileSchema> {
  return generateFixture(USER_PROFILE_DEFAULTS, options);
}

/**
 * Generate multiple mock user profile fixtures
 */
export function generateUserProfiles(
  count: number,
  options?: GeneratorOptions<z.infer<typeof insertUserProfileSchema>>
): z.infer<typeof insertUserProfileSchema>[] {
  return generateFixtures(generateUserProfile, count, options);
}

// ============================================================================
// SPONSOR FIXTURES
// ============================================================================

const SPONSOR_DEFAULTS = {
  id: uuid(),
  name: 'Test Sponsor',
  slug: slug('sponsor'),
  logo: null,
  website: url(),
  description: 'A generous sponsor supporting our team.',
  tier: 'silver',
  isActive: true,
  contactName: null,
  contactEmail: null,
  contactPhone: null,
  startDate: isoDate(-365),
  endDate: null,
  createdAt: isoDate(-365),
  updatedAt: isoDate(-30),
  isDeleted: false,
} as const;

/**
 * Generate a mock sponsor fixture
 */
export function generateSponsor(
  options?: GeneratorOptions<z.infer<typeof insertSponsorSchema>>
): z.infer<typeof insertSponsorSchema> {
  return generateFixture(SPONSOR_DEFAULTS, options);
}

/**
 * Generate multiple mock sponsor fixtures
 */
export function generateSponsors(
  count: number,
  options?: GeneratorOptions<z.infer<typeof insertSponsorSchema>>
): z.infer<typeof insertSponsorSchema>[] {
  return generateFixtures(generateSponsor, count, options);
}

// ============================================================================
// BADGE FIXTURES
// ============================================================================

const BADGE_DEFAULTS = {
  id: uuid(),
  name: 'Test Badge',
  description: 'A badge awarded for testing purposes.',
  icon: null,
  category: 'achievement',
  requirement: 'Complete a test',
  xp: 10,
  isActive: true,
  createdAt: isoDate(-30),
  updatedAt: isoDate(-30),
} as const;

/**
 * Generate a mock badge fixture
 */
export function generateBadge(
  options?: GeneratorOptions<z.infer<typeof insertBadgeSchema>>
): z.infer<typeof insertBadgeSchema> {
  return generateFixture(BADGE_DEFAULTS, options);
}

/**
 * Generate multiple mock badge fixtures
 */
export function generateBadges(
  count: number,
  options?: GeneratorOptions<z.infer<typeof insertBadgeSchema>>
): z.infer<typeof insertBadgeSchema>[] {
  return generateFixtures(generateBadge, count, options);
}

// ============================================================================
// TASK FIXTURES
// ============================================================================

const TASK_DEFAULTS = {
  id: uuid(),
  title: 'Test Task',
  description: 'A task for testing purposes.',
  status: 'todo',
  priority: 'medium',
  assigneeId: null,
  dueDate: null,
  completedAt: null,
  tags: null,
  createdAt: isoDate(-1),
  updatedAt: isoDate(-1),
  isDeleted: false,
} as const;

/**
 * Generate a mock task fixture
 */
export function generateTask(
  options?: GeneratorOptions<z.infer<typeof insertTaskSchema>>
): z.infer<typeof insertTaskSchema> {
  return generateFixture(TASK_DEFAULTS, options);
}

/**
 * Generate multiple mock task fixtures
 */
export function generateTasks(
  count: number,
  options?: GeneratorOptions<z.infer<typeof insertTaskSchema>>
): z.infer<typeof insertTaskSchema>[] {
  return generateFixtures(generateTask, count, options);
}

// ============================================================================
// LOCATION FIXTURES
// ============================================================================

const LOCATION_DEFAULTS = {
  id: uuid(),
  name: 'Test Location',
  address: '123 Main St',
  city: 'Andover',
  state: 'MA',
  zipCode: '01810',
  lat: null,
  lng: null,
  type: 'meeting',
  capacity: null,
  amenities: null,
  notes: null,
  isActive: true,
  createdAt: isoDate(-365),
  updatedAt: isoDate(-30),
  isDeleted: false,
} as const;

/**
 * Generate a mock location fixture
 */
export function generateLocation(
  options?: GeneratorOptions<z.infer<typeof insertLocationSchema>>
): z.infer<typeof insertLocationSchema> {
  return generateFixture(LOCATION_DEFAULTS, options);
}

/**
 * Generate multiple mock location fixtures
 */
export function generateLocations(
  count: number,
  options?: GeneratorOptions<z.infer<typeof insertLocationSchema>>
): z.infer<typeof insertLocationSchema>[] {
  return generateFixtures(generateLocation, count, options);
}

// ============================================================================
// DOC FIXTURES
// ============================================================================

const DOC_DEFAULTS = {
  slug: slug('doc'),
  title: 'Test Documentation',
  content: '# Test Document\n\nThis is a test documentation page.',
  excerpt: 'A brief summary of the documentation.',
  authorId: 'test-user-id',
  status: 'published',
  category: 'technical',
  tags: '["docs", "test"]',
  order: 0,
  parentSlug: null,
  metaTitle: null,
  metaDescription: null,
  publishedAt: isoDate(-1),
  createdAt: isoDate(-2),
  updatedAt: isoDate(-1),
  isDeleted: false,
} as const;

/**
 * Generate a mock doc fixture
 */
export function generateDoc(
  options?: GeneratorOptions<z.infer<typeof insertDocSchema>>
): z.infer<typeof insertDocSchema> {
  return generateFixture(DOC_DEFAULTS, options);
}

/**
 * Generate multiple mock doc fixtures
 */
export function generateDocs(
  count: number,
  options?: GeneratorOptions<z.infer<typeof insertDocSchema>>
): z.infer<typeof insertDocSchema>[] {
  return generateFixtures(generateDoc, count, options);
}

// ============================================================================
// SESSION FIXTURES
// ============================================================================

/**
 * Generate a mock session user for authentication tests
 */
export function generateSessionUser(overrides: Partial<{
  id: string;
  email: string;
  name: string;
  nickname: string;
  role: 'admin' | 'user';
  memberType: 'student' | 'mentor' | 'coach' | 'alumnus' | 'parent';
  image: string | null;
}> = {}): {
  id: string;
  email: string;
  name: string;
  nickname: string;
  role: 'admin' | 'user';
  memberType: 'student' | 'mentor' | 'coach' | 'alumnus' | 'parent';
  image: string | null;
} {
  return {
    id: uuid(),
    email: email(),
    name: 'Test User',
    nickname: 'Testy',
    role: 'user',
    memberType: 'student',
    image: null,
    ...overrides,
  };
}

/**
 * Generate an admin session user
 */
export function generateAdminSessionUser(): ReturnType<typeof generateSessionUser> {
  return generateSessionUser({
    role: 'admin',
    memberType: 'mentor',
  });
}

/**
 * Generate a mentor session user
 */
export function generateMentorSessionUser(): ReturnType<typeof generateSessionUser> {
  return generateSessionUser({
    role: 'user',
    memberType: 'mentor',
  });
}
