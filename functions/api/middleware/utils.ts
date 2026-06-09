import { Context } from "hono";
import { siteConfig } from "../../utils/site.config";
import { parseAstToText } from "../../utils/content";
import { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../../src/db/schema";
import type { DrizzleDB } from "../../../src/db/types";
import { safeJSONParse } from "../../utils/json";
import { inArray } from "drizzle-orm";
import type { D1Database, R2Bucket, VectorizeIndex, Ai, KVNamespace } from "@cloudflare/workers-types";

// ── Cloudflare Bindings ──────────────────────────────────────────────
export type Bindings = {
  DB: D1Database;
  ENVIRONMENT?: string;
  CI?: string;
  ARES_STORAGE: R2Bucket;
  AI: Ai;
  VECTORIZE_DB?: VectorizeIndex;
  Z_AI_API_KEY?: string;
  DISCORD_WEBHOOK_URL?: string;
  GCAL_SERVICE_ACCOUNT_EMAIL?: string;
  GCAL_PRIVATE_KEY?: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_PAT?: string;
  GITHUB_PROJECT_ID?: string;
  GITHUB_ORG?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  GITHUB_REPO_OWNER?: string;
  GITHUB_REPO_NAME?: string;
  GITHUB_BRANCH?: string;
  ENCRYPTION_SECRET: string;
  FIREBASE_API_HOST?: string;
  ZULIP_CLIENT_ID?: string;
  ZULIP_CLIENT_SECRET?: string;
  ZULIP_URL?: string;
  ZULIP_BOT_EMAIL?: string;
  ZULIP_API_KEY?: string;
  ZULIP_WEBHOOK_TOKEN?: string;
  ZULIP_COMMENT_STREAM?: string;
  ZULIP_ADMIN_STREAM?: string;
  INITIAL_ADMIN_EMAIL?: string;
  RESEND_API_KEY?: string;
  DEV_BYPASS?: string;
  TURNSTILE_SECRET_KEY?: string;
  CRON_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  TWITTER_BEARER_TOKEN?: string;
  BLUESKY_IDENTIFIER?: string;
  BLUESKY_PASSWORD?: string;
  SENTRY_DSN?: string;
  TOA_API_KEY?: string;
  TWITTER_API_KEY?: string;
  BLUESKY_HANDLE?: string;
  FACEBOOK_ACCESS_TOKEN?: string;
  INSTAGRAM_ACCESS_TOKEN?: string;
  SLACK_WEBHOOK_URL?: string;
  LINKEDIN_ACCESS_TOKEN?: string;
  FTC_EVENTS_USERNAME?: string;
  FTC_EVENTS_API_KEY?: string;
  AUDIT_LOG_RETENTION_DAYS?: string;
  YOUTUBE_API_KEY?: string;
  YOUTUBE_CLIENT_ID?: string;
  YOUTUBE_CLIENT_SECRET?: string;
  AUTHORIZED_GOOGLE_ACCOUNT?: string;
  // Onshape OAuth state storage (Phase 78)
  ONSHAPE_OAUTH_STATE: KVNamespace;
  ONSHAPE_CLIENT_ID?: string;
  ONSHAPE_CLIENT_SECRET?: string;
  ONSHAPE_REDIRECT_URI?: string;
  ONSHAPE_BASE_URL?: string;
  // Onshape export state storage (Phase 78-03)
  ONSHAPE_EXPORTS: KVNamespace;
};

export type Variables = {
  sessionUser: SessionUser;
  socialConfig?: SocialConfig;
  db: DrizzleDB;
  env: Bindings;
  requestId?: string;
};

// ── Database Types ───────────────────────────────────────────────────────
/**
 * Type alias for the Drizzle database with schema and relations.
 * Use this to type database parameters instead of `any`.
 */
export type { DrizzleDB };

// ── Database Context Helper ─────────────────────────────────────────────
/**
 * Type-safe helper to get the database from Hono context.
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 * Use this instead of `c.get("db") as any` to avoid lint errors.
 */
export function getDb(c: Context<AppEnv>): DrizzleDB {
  return c.get("db");
}

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};

// ── Content Status Constants ─────────────────────────────────────────
export const ContentStatus = {
  PUBLISHED: "published",
  PENDING: "pending",
  REJECTED: "rejected",
} as const;
export type ContentStatusType = typeof ContentStatus[keyof typeof ContentStatus];

export const UserRole = {
  ADMIN: "admin",
  AUTHOR: "author",
  UNVERIFIED: "unverified",
} as const;

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  nickname: string | null;
  github_login?: string | null;
  image: string | undefined | null;
  role: string | "admin" | "author" | "unverified";
  memberType: "student" | "mentor" | "coach" | string;
}

export type SocialConfig = {
  BLUESKY_HANDLE?: string;
  BLUESKY_APP_PASSWORD?: string;
  FACEBOOK_PAGE_ID?: string;
  FACEBOOK_ACCESS_TOKEN?: string;
  TWITTER_API_KEY?: string;
  TWITTER_API_SECRET?: string;
  TWITTER_ACCESS_TOKEN?: string;
  TWITTER_ACCESS_SECRET?: string;
  INSTAGRAM_ACCOUNT_ID?: string;
  INSTAGRAM_ACCESS_TOKEN?: string;
  COMMUNITY_PHOTO_DRIVE_URL?: string;
  COMMUNITY_DOCS_URL?: string;
  ZULIP_BOT_EMAIL?: string;
  ZULIP_API_KEY?: string;
  ZULIP_URL?: string;
  ZULIP_ADMIN_STREAM?: string;
  ZULIP_COMMENT_STREAM?: string;
  ZULIP_WEBHOOK_TOKEN?: string;
  GITHUB_PAT?: string;
  GITHUB_PROJECT_ID?: string;
  GITHUB_ORG?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
};

// ── Input Validation Helpers ─────────────────────────────────────────
export const MAX_INPUT_LENGTHS = {
  title: 500,
  comment: 5000,
  description: 50000,
  content: 500000,
  name: 200,
  email: 320,
  address: 1000,
  slug: 200,
  code: 50,
  generic: 10000,
} as const;

export function validateLength(value: string | undefined | null, maxLength: number, fieldName: string): string | null {
  if (!value) return null;
  if (value.length > maxLength) {
    return `${fieldName} exceeds maximum length of ${maxLength} characters`;
  }
  return null;
}

// ── PII Scrubbing for Logs ───────────────────────────────────────────
function scrubPii(text: string | null): string | null {
  if (!text) return null;
  // Mask emails: ares@example.com -> a***@example.com
  let scrubbed = text.replace(/([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '$1***@$2');
  // Mask phone numbers (basic): +1-555-555-5555 -> +1-555-***-****
  // eslint-disable-next-line security/detect-unsafe-regex
  scrubbed = scrubbed.replace(/(\+?\d{1,2}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, (match) => {
     return match.slice(0, -8) + '***-****';
  });
  return scrubbed;
}

// ── Audit Logging ────────────────────────────────────────────
export async function logAuditAction(
  c: Context<AppEnv>,
  action: string,
  resource_type: string,
  resource_id: string | null,
  details?: string
): Promise<void> {
  const db: DrizzleD1Database<typeof schema> = c.get("db");
  try {
    const sessionUser = c.get("sessionUser") as SessionUser | undefined;
    const actor = sessionUser?.email || "unknown";

    const id = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") ? crypto.randomUUID() : `log-${Date.now()}`;

    await db.insert(schema.auditLog)
      .values({
        id,
        actor,
        action,
        resourceType: resource_type,
        resourceId: resource_id || null,
        details: scrubPii(details || null)
      });
  } catch (err) {
    console.error("[AuditLog] Failed to record action:", action, err);
  }
}

/**
 * Convenience wrapper for audit logging in route handlers.
 * Handles the executionCtx/waitUntil pattern automatically.
 *
 * @example
 * audit(c, "video_create", "video", id, "Created video: My Title");
 */
export function audit(
  c: Context<AppEnv>,
  action: string,
  resourceType: string,
  resourceId: string | null,
  details?: string
): void {
  if (c.executionCtx) {
    c.executionCtx.waitUntil(logAuditAction(c, action, resourceType, resourceId, details));
  }
}

export async function logSystemError(
  db: DrizzleD1Database<typeof schema>,
  service: string,
  error: string,
  details?: string
): Promise<void> {
  try {
    const id = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") ? crypto.randomUUID() : `err-${Date.now()}`;
    
    await db.insert(schema.auditLog)
      .values({
        id,
        actor: "system",
        action: "INTEGRATION_FAILURE",
        resourceType: service,
        resourceId: null,
        details: JSON.stringify({ error, details, timestamp: new Date().toISOString() })
      });
  } catch (err) {
    console.error("[AuditLog] Failed to log system error:", err);
  }
}

// ── Pagination Helper ───────────────────────────────────────
/**
 * Parse a positive integer from a query parameter with fallback.
 * Returns the fallback value if the input is NaN, not an integer, or negative.
 */
function parsePositiveInt(val: string | undefined, fallback: number): number {
  if (!val) return fallback;
  const num = Number(val);
  return isNaN(num) || !Number.isInteger(num) || num < 0 ? fallback : num;
}

export function parsePagination(c: Context<AppEnv>, defaultLimit = 50, maxLimit = 200) {
  const limit = Math.min(parsePositiveInt(c.req.query("limit"), defaultLimit), maxLimit);
  const offset = parsePositiveInt(c.req.query("offset"), 0);
  const cursor = c.req.query("cursor") || null;
  return { limit, offset, cursor };
}

// ── Request ID Tracing (IN-09) ────────────────────────────────
/**
 * Get or generate a request ID for tracing and debugging.
 *
 * IN-09: Request ID middleware for correlation across logs and error tracking.
 *
 * Usage in route handlers:
 *   const requestId = getRequestId(c);
 *   console.error(`[${requestId}] Error processing request`);
 *
 * The request ID is also available via the X-Request-ID response header.
 */
export function getRequestId(c: Context<AppEnv>): string {
  // Check if request ID was already set by middleware
  const existing = c.get("requestId") as string | undefined;
  if (existing) return existing;

  // Check for client-provided request ID
  const clientRequestId = c.req.header("X-Request-ID");
  if (clientRequestId) {
    c.set("requestId", clientRequestId);
    c.header("X-Request-ID", clientRequestId);
    return clientRequestId;
  }

  // Generate new request ID
  const generatedId = crypto.randomUUID();
  c.set("requestId", generatedId);
  c.header("X-Request-ID", generatedId);
  return generatedId;
}

/**
 * Hono middleware that adds request ID tracing to all requests.
 *
 * IN-09: Request ID middleware for correlation across logs.
 *
 * Usage:
 *   app.use("*", requestIdMiddleware);
 *
 * After this middleware, use getRequestId(c) to retrieve the request ID.
 */
export async function requestIdMiddleware(c: Context<AppEnv>, next: () => Promise<void>) {
  const id = c.req.header("X-Request-ID") || crypto.randomUUID();
  c.set("requestId", id);
  c.header("X-Request-ID", id);
  await next();
}

// ── Centralized Settings Fetch ──────────────────────────────
export async function getDbSettings(c: Context<AppEnv>): Promise<Record<string, string>> {
  const keys = [
    'BLUESKY_HANDLE', 'BLUESKY_APP_PASSWORD',
    'FACEBOOK_PAGE_ID', 'FACEBOOK_ACCESS_TOKEN',
    'TWITTER_API_KEY', 'TWITTER_API_SECRET', 'TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_SECRET',
    'INSTAGRAM_ACCOUNT_ID', 'INSTAGRAM_ACCESS_TOKEN',
    'COMMUNITY_PHOTO_DRIVE_URL', 'COMMUNITY_DOCS_URL',
    'ZULIP_BOT_EMAIL', 'ZULIP_API_KEY', 'ZULIP_URL', 'ZULIP_ADMIN_STREAM', 'ZULIP_COMMENT_STREAM', 'ZULIP_WEBHOOK_TOKEN',
    'GITHUB_PAT', 'GITHUB_PROJECT_ID', 'GITHUB_ORG', 'GITHUB_WEBHOOK_SECRET',
    'RESEND_API_KEY', 'RESEND_FROM_EMAIL',
    'CALENDAR_ID', 'CALENDAR_ID_INTERNAL', 'CALENDAR_ID_OUTREACH', 'CALENDAR_ID_EXTERNAL',
    'LAST_SYNCED_CALENDAR_ID_INTERNAL', 'LAST_SYNCED_CALENDAR_ID_OUTREACH', 'LAST_SYNCED_CALENDAR_ID_EXTERNAL'
  ];

  const db: DrizzleD1Database<typeof schema> = c.get("db");
  const results = await db
    .select({ key: schema.settings.key, value: schema.settings.value })
    .from(schema.settings)
    .where(inArray(schema.settings.key, keys));
  const settings: Record<string, string> = {};
  for (const row of results) {
    if (row.key) {
      settings[row.key] = row.value;
    }
  }
  return settings;
}

// ── Social Config Helper ─────────────────────────────────────────────
export async function getSocialConfig(c: Context<AppEnv>): Promise<SocialConfig> {
  const cached = c.get("socialConfig");
  if (cached) return cached;

  try {
    const dbSettings = await getDbSettings(c);

    const config = {
      BLUESKY_HANDLE: dbSettings["BLUESKY_HANDLE"],
      BLUESKY_APP_PASSWORD: dbSettings["BLUESKY_APP_PASSWORD"],
      FACEBOOK_PAGE_ID: dbSettings["FACEBOOK_PAGE_ID"],
      FACEBOOK_ACCESS_TOKEN: dbSettings["FACEBOOK_ACCESS_TOKEN"],
      TWITTER_API_KEY: dbSettings["TWITTER_API_KEY"],
      TWITTER_API_SECRET: dbSettings["TWITTER_API_SECRET"],
      TWITTER_ACCESS_TOKEN: dbSettings["TWITTER_ACCESS_TOKEN"],
      TWITTER_ACCESS_SECRET: dbSettings["TWITTER_ACCESS_SECRET"],
      INSTAGRAM_ACCOUNT_ID: dbSettings["INSTAGRAM_ACCOUNT_ID"],
      INSTAGRAM_ACCESS_TOKEN: dbSettings["INSTAGRAM_ACCESS_TOKEN"],
      COMMUNITY_PHOTO_DRIVE_URL: dbSettings["COMMUNITY_PHOTO_DRIVE_URL"],
      COMMUNITY_DOCS_URL: dbSettings["COMMUNITY_DOCS_URL"],
      ZULIP_BOT_EMAIL: c.env.ZULIP_BOT_EMAIL || dbSettings["ZULIP_BOT_EMAIL"],
      ZULIP_API_KEY: c.env.ZULIP_API_KEY || dbSettings["ZULIP_API_KEY"],
      ZULIP_URL: c.env.ZULIP_URL || dbSettings["ZULIP_URL"] || "https://aresfirst.zulipchat.com",
      ZULIP_ADMIN_STREAM: c.env.ZULIP_ADMIN_STREAM || dbSettings["ZULIP_ADMIN_STREAM"] || "leadership",
      ZULIP_COMMENT_STREAM: c.env.ZULIP_COMMENT_STREAM || dbSettings["ZULIP_COMMENT_STREAM"] || "website-discussion",
      ZULIP_WEBHOOK_TOKEN: c.env.ZULIP_WEBHOOK_TOKEN || dbSettings["ZULIP_WEBHOOK_TOKEN"],
      GITHUB_PAT: c.env.GITHUB_PAT || dbSettings["GITHUB_PAT"],
      GITHUB_PROJECT_ID: c.env.GITHUB_PROJECT_ID || dbSettings["GITHUB_PROJECT_ID"],
      GITHUB_ORG: c.env.GITHUB_ORG || dbSettings["GITHUB_ORG"] || siteConfig.urls.githubOrg,
      GITHUB_WEBHOOK_SECRET: c.env.GITHUB_WEBHOOK_SECRET || dbSettings["GITHUB_WEBHOOK_SECRET"],
      RESEND_API_KEY: c.env.RESEND_API_KEY || dbSettings["RESEND_API_KEY"],
      RESEND_FROM_EMAIL: dbSettings["RESEND_FROM_EMAIL"],
    };
    c.set("socialConfig", config);
    return config;
  } catch (err) {
    console.error("Failed to fetch settings for social integration:", err);
    return {};
  }
}

// ── AST Text Extraction ──────────────────────────────────────────────
export function extractAstText(ast: unknown): string {
  return parseAstToText(ast);
}

// ── PII Sanitization (FIRST Youth Protection) ────────────────────────
export function sanitizeProfileForPublic(profile: Record<string, unknown>, memberType: string, bypassSecurity = false) {
  if (bypassSecurity) {
    return {
      ...profile,
      email: profile.contactEmail || profile.email,
      nickname: profile.nickname || profile.firstName || "ARES Member",
    };
  }

  const safeParseArray = (val: unknown) => {
    return safeJSONParse<string[]>(val, []);
  };

  const safe: Record<string, unknown> = {
    userId: profile.userId,
    nickname: profile.nickname || "ARES Member",
    avatar: profile.avatar,
    pronouns: profile.pronouns,
    subteams: safeParseArray(profile.subteams),
    memberType: profile.memberType,
    bio: profile.bio,
    favoriteFirstThing: profile.favoriteFirstThing,
    funFact: profile.funFact,
    showOnAbout: profile.showOnAbout,
    favoriteRobotMechanism: profile.favoriteRobotMechanism,
    preMatchSuperstition: profile.preMatchSuperstition,
    leadershipRole: profile.leadershipRole,
    rookieYear: profile.rookieYear,
    favoriteFood: profile.favoriteFood,
  };
  if (memberType === "student" || memberType === "parent") {
    return safe;
  }

  // PII-P04: Mentors/Coaches can show public contact info,
  // but we MUST ensure the router has already decrypted them before calling this.
  // We check if the value looks like a hex-IV (contains ':'). If so, we strip it.
  const isEncrypted = (val: unknown) => typeof val === 'string' && val.includes(':');

  return {
    ...safe,
    email: (Number(profile.showEmail) && !isEncrypted(profile.contactEmail)) ? (profile.contactEmail || profile.email) : null,
    phone: (Number(profile.showPhone) && !isEncrypted(profile.phone)) ? profile.phone : null,
    colleges: safeParseArray(profile.colleges),
    employers: safeParseArray(profile.employers),
    gradeYear: profile.gradeYear,
  };
}

// ── Response Formatting Helper ───────────────────────────────────────
/**
 * Utility to bypass Drizzle -> OpenAPI type mismatches without cluttering
 * route handlers with eslint disable comments and "any" casts.
 */
export function typedJson(c: Context<AppEnv>, data: unknown, status = 200) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return c.json(data as any, status as any);
}

