import { MockedFunction } from "vitest";

/**
 * Test mock types and interfaces for database and API testing
 * Provides proper typing for Vitest mocks while maintaining flexibility
 */

// Base mock function types
export type MockFn = ReturnType<typeof vi.fn>;

// Terminal methods that return Promises
export interface TerminalMethods {
  all: MockFn;
  get: MockFn;
  run: MockFn;
  execute: MockFn;
  executeTakeFirst: MockFn;
  first: MockFn;
}

// Mock method types (mockResolvedValueOnce, etc.)
export interface MockMethodTypes {
  mockResolvedValueOnce: TerminalMethods;
  mockResolvedValue: TerminalMethods;
  mockRejectedValueOnce: TerminalMethods;
  mockRejectedValue: TerminalMethods;
}

// Chainable query builder interface
export interface ChainableQuery extends TerminalMethods {
  select: MockFn & ChainableQuery;
  selectDistinct: MockFn & ChainableQuery;
  from: MockFn & ChainableQuery;
  where: MockFn & ChainableQuery;
  insert: MockFn & ChainableQuery;
  values: MockFn & ChainableQuery;
  update: MockFn & ChainableQuery;
  set: MockFn & ChainableQuery;
  delete: MockFn & ChainableQuery;
  limit: MockFn & ChainableQuery;
  offset: MockFn & ChainableQuery;
  orderBy: MockFn & ChainableQuery;
  returning: MockFn & ChainableQuery;
  leftJoin: MockFn & ChainableQuery;
  innerJoin: MockFn & ChainableQuery;
  rightJoin: MockFn & ChainableQuery;
  fullJoin: MockFn & ChainableQuery;
  groupBy: MockFn & ChainableQuery;
  having: MockFn & ChainableQuery;
  onConflictDoUpdate: MockFn & ChainableQuery;
  onConflictDoNothing: MockFn & ChainableQuery;
  transaction: MockFn;
  [key: string]: MockFn | ChainableQuery | unknown;
}

// Query builder proxy interface
export interface QueryBuilderProxy extends TerminalMethods {
  [key: string]: MockFn | ChainableQuery | unknown;
  query?: {
    [key: string]: {
      findFirst: MockFn;
      findMany: MockFn;
      [key: string]: unknown;
    };
  };
}

// Database row result types
export type DbRow = Record<string, unknown>;
export type DbRows = DbRow[];

// Run result type
export interface RunResult {
  success: boolean;
  meta?: {
    changes?: number;
    last_row_id?: number;
    duration?: number;
  };
}

// Execution context mock
export interface MockExecutionContext {
  waitUntil: MockedFunction<(promise: Promise<unknown>) => void>;
  passThroughOnException: MockedFunction<() => void>;
  props: Record<string, unknown>;
}

// Session user types
export interface SessionUser {
  id: string;
  email: string;
  role: string;
  name: string;
  nickname?: string;
  image: string | null;
  member_type: string;
}

// API response types for assertions
export interface ApiResponse<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
  [key: string]: unknown;
}

// Common database result types
export interface SummaryResult {
  type: string;
  total: number;
}

export interface TransactionResult {
  id: string;
  amount: number;
  type: string;
  category: string;
  date: string;
  receiptUrl?: string;
}

export interface SponsorshipResult {
  id: string;
  companyName: string;
  status: string;
  estimatedValue: number;
}

// Calendar config types
export interface CalendarConfig {
  GCAL_SERVICE_ACCOUNT_EMAIL?: string;
  GCAL_PRIVATE_KEY?: string;
  CALENDAR_ID?: string;
  CALENDAR_ID_INTERNAL?: string;
  CALENDAR_ID_OUTREACH?: string;
  CALENDAR_ID_EXTERNAL?: string;
}

// Social config types
export interface SocialConfig {
  ZULIP_BOT_EMAIL?: string;
  ZULIP_API_KEY?: string;
  ZULIP_SITE?: string;
  GITHUB_PAT?: string;
  GITHUB_PROJECT_ID?: string;
  GITHUB_TOKEN?: string;
  GITHUB_ORG?: string;
  DISCORD_WEBHOOK_URL?: string;
}

// GitHub project item types
export interface GitHubProjectItem {
  id: string;
  title: string;
  status: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface GitHubProjectBoard {
  title: string;
  shortDescription: string;
  items: GitHubProjectItem[];
  totalCount: number;
}

// Inquiry types
export interface Inquiry {
  id: string;
  type: string;
  name: string;
  email: string;
  status: string;
  created_at: string;
  metadata: string;
  [key: string]: unknown;
}

// Event types
export interface Event {
  id: string;
  title: string;
  category: string;
  date_start: string;
  date_end?: string;
  location?: string;
  description?: string;
  status: string;
  is_deleted?: number | boolean;
  cover_image?: string | null;
  meeting_notes?: string | null;
  gcalEventId?: string | null;
  [key: string]: unknown;
}

// Location type
export interface Location {
  name: string;
  address?: string;
  [key: string]: unknown;
}

// Helper type for mock returns with cast to any for legitimate use cases
export type MockReturn<T = unknown> = T;

// Award types
export interface Award {
  id: string | number;
  title: string;
  date?: string;
  year?: number;
  event_name?: string;
  description?: string;
  image_url?: string | null;
  season_id?: number | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface AwardResponse {
  awards: Award[];
  [key: string]: unknown;
}

// Badge types
export interface Badge {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color_theme?: string;
  created_at: string;
  [key: string]: unknown;
}

export interface BadgeResponse {
  badges: Badge[];
  [key: string]: unknown;
}

export interface BadgeLeaderboardEntry {
  user_id: string;
  nickname: string | null;
  member_type: string | null;
  badge_count: number;
  [key: string]: unknown;
}

export interface BadgeLeaderboardResponse {
  leaderboard: BadgeLeaderboardEntry[];
  [key: string]: unknown;
}

// Entity link types
export interface EntityLink {
  id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  link_type: string;
  target_title?: string;
  [key: string]: unknown;
}

export interface EntityLinksResponse {
  links: EntityLink[];
  [key: string]: unknown;
}

// Communications types
export interface CommunicationsStatsResponse {
  activeUsers?: number;
  [key: string]: unknown;
}

export interface MassEmailResponse {
  success?: boolean;
  error?: string;
  recipientCount?: number;
  [key: string]: unknown;
}

// User profile with email
export interface UserProfileWithEmail {
  email: string | null;
  [key: string]: unknown;
}

// Proxy target type for query builder
export interface ProxyTarget {
  [key: string]: MockFn | ChainableQuery | unknown;
}
