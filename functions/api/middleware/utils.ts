import { Context } from "hono";
import { siteConfig } from "../../utils/site.config";
import { parseAstToText } from "../../utils/gcalSync";

// ── Cloudflare Bindings ──────────────────────────────────────────────
export type Bindings = {
  DB: D1Database;
  ARES_STORAGE: R2Bucket;
  AI: { run: (model: string, input: unknown) => Promise<unknown> };
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
  ENCRYPTION_SECRET: string;
  ZULIP_CLIENT_ID: string;
  ZULIP_CLIENT_SECRET: string;
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
};

export type Variables = {
  sessionUser: SessionUser;
  socialConfig?: Record<string, string | undefined>;
};

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
  image: string | undefined | null;
  role: string | "admin" | "author" | "unverified";
  member_type: string;
}

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

// ── Audit Logging ────────────────────────────────────────────
export async function logAuditAction(
  c: Context<AppEnv>,
  action: string,
  resource_type: string,
  resource_id: string | null,
  details?: string
): Promise<void> {
  try {
    const sessionUser = c.get("sessionUser") as SessionUser | undefined;
    const actor = sessionUser?.email || "unknown";
    await c.env.DB.prepare(
      `INSERT INTO audit_log (id, actor, action, resource_type, resource_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      crypto.randomUUID(),
      actor,
      action,
      resource_type,
      resource_id || null,
      details || null
    ).run();
  } catch (err) {
    console.error("[AuditLog] Failed to record action:", action, err);
  }
}

export async function logSystemError(
  db: D1Database,
  service: string,
  error: string,
  details?: string
): Promise<void> {
  try {
    await db.prepare(
      `INSERT INTO audit_log (id, actor, action, resource_type, resource_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      crypto.randomUUID(),
      "system",
      "INTEGRATION_FAILURE",
      service,
      null,
      JSON.stringify({ error, details, timestamp: new Date().toISOString() })
    ).run();
  } catch (err) {
    console.error("[AuditLog] Failed to log system error:", err);
  }
}

// ── Pagination Helper ───────────────────────────────────────
export function parsePagination(c: Context<AppEnv>, defaultLimit = 50, maxLimit = 200) {
  const limit = Math.min(Number(c.req.query("limit") || String(defaultLimit)), maxLimit);
  const offset = Math.max(Number(c.req.query("offset") || "0"), 0);
  return { limit, offset };
}

// ── Centralized Settings Fetch ──────────────────────────────
export async function getDbSettings(c: Context<AppEnv>): Promise<Record<string, string>> {
  const keys = [
    'DISCORD_WEBHOOK_URL', 'MAKE_WEBHOOK_URL', 'BLUESKY_HANDLE', 'BLUESKY_APP_PASSWORD',
    'SLACK_WEBHOOK_URL', 'TEAMS_WEBHOOK_URL', 'GCHAT_WEBHOOK_URL', 'FACEBOOK_PAGE_ID',
    'FACEBOOK_ACCESS_TOKEN', 'TWITTER_API_KEY', 'TWITTER_API_SECRET', 'TWITTER_ACCESS_TOKEN',
    'TWITTER_ACCESS_SECRET', 'INSTAGRAM_ACCOUNT_ID', 'INSTAGRAM_ACCESS_TOKEN',
    'CALENDAR_ID', 'GCAL_SERVICE_ACCOUNT_EMAIL', 'GCAL_PRIVATE_KEY',
    'ZULIP_BOT_EMAIL', 'ZULIP_API_KEY', 'ZULIP_URL', 'ZULIP_ADMIN_STREAM', 'ZULIP_COMMENT_STREAM',
    'GITHUB_PAT', 'GITHUB_PROJECT_ID', 'GITHUB_ORG', 'GITHUB_WEBHOOK_SECRET',
    'ENCRYPTION_SECRET', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL',
    'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_DATABASE_ID', 'R2_ACCESS_KEY', 'R2_SECRET_KEY'
  ];
  const placeholders = keys.map(() => '?').join(',');
  const { results: settingsRows } = await c.env.DB.prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`).bind(...keys).all();
  const settings: Record<string, string> = {};
  if (settingsRows) {
    for (const row of settingsRows as { key: string, value: string }[]) {
      settings[row.key] = row.value;
    }
  }
  return settings;
}

// ── Social Config Helper ─────────────────────────────────────────────
export async function getSocialConfig(c: Context<AppEnv>): Promise<Record<string, string | undefined>> {
  const cached = c.get("socialConfig");
  if (cached) return cached;

  try {
    const dbSettings = await getDbSettings(c);

    const config = {
      DISCORD_WEBHOOK_URL: c.env.DISCORD_WEBHOOK_URL || dbSettings["DISCORD_WEBHOOK_URL"],
      MAKE_WEBHOOK_URL: dbSettings["MAKE_WEBHOOK_URL"],
      BLUESKY_HANDLE: dbSettings["BLUESKY_HANDLE"],
      BLUESKY_APP_PASSWORD: dbSettings["BLUESKY_APP_PASSWORD"],
      SLACK_WEBHOOK_URL: dbSettings["SLACK_WEBHOOK_URL"],
      TEAMS_WEBHOOK_URL: dbSettings["TEAMS_WEBHOOK_URL"],
      GCHAT_WEBHOOK_URL: dbSettings["GCHAT_WEBHOOK_URL"],
      FACEBOOK_PAGE_ID: dbSettings["FACEBOOK_PAGE_ID"],
      FACEBOOK_ACCESS_TOKEN: dbSettings["FACEBOOK_ACCESS_TOKEN"],
      TWITTER_API_KEY: dbSettings["TWITTER_API_KEY"],
      TWITTER_API_SECRET: dbSettings["TWITTER_API_SECRET"],
      TWITTER_ACCESS_TOKEN: dbSettings["TWITTER_ACCESS_TOKEN"],
      TWITTER_ACCESS_SECRET: dbSettings["TWITTER_ACCESS_SECRET"],
      INSTAGRAM_ACCOUNT_ID: dbSettings["INSTAGRAM_ACCOUNT_ID"],
      INSTAGRAM_ACCESS_TOKEN: dbSettings["INSTAGRAM_ACCESS_TOKEN"],
      CALENDAR_ID: dbSettings["CALENDAR_ID"],
      GCAL_SERVICE_ACCOUNT_EMAIL: dbSettings["GCAL_SERVICE_ACCOUNT_EMAIL"],
      GCAL_PRIVATE_KEY: dbSettings["GCAL_PRIVATE_KEY"],
      ZULIP_BOT_EMAIL: c.env.ZULIP_BOT_EMAIL || dbSettings["ZULIP_BOT_EMAIL"],
      ZULIP_API_KEY: c.env.ZULIP_API_KEY || dbSettings["ZULIP_API_KEY"],
      ZULIP_URL: c.env.ZULIP_URL || dbSettings["ZULIP_URL"] || "https://ares.zulipchat.com",
      ZULIP_ADMIN_STREAM: c.env.ZULIP_ADMIN_STREAM || dbSettings["ZULIP_ADMIN_STREAM"] || "leadership",
      ZULIP_COMMENT_STREAM: c.env.ZULIP_COMMENT_STREAM || dbSettings["ZULIP_COMMENT_STREAM"] || "website-discussion",
      GITHUB_PAT: c.env.GITHUB_PAT || dbSettings["GITHUB_PAT"],
      GITHUB_PROJECT_ID: c.env.GITHUB_PROJECT_ID || dbSettings["GITHUB_PROJECT_ID"],
      GITHUB_ORG: c.env.GITHUB_ORG || dbSettings["GITHUB_ORG"] || siteConfig.urls.githubOrg,
      GITHUB_WEBHOOK_SECRET: c.env.GITHUB_WEBHOOK_SECRET || dbSettings["GITHUB_WEBHOOK_SECRET"],
    };
    c.set("socialConfig", config);
    return config;
  } catch (err) {
    console.error("Failed to fetch settings for social integration:", err);
    return {};
  }
}

// ── AST Text Extraction ──────────────────────────────────────────────
export function extractAstText(jsonStr: string | undefined | null): string {
  return parseAstToText(jsonStr);
}

// ── PII Sanitization (FIRST Youth Protection) ────────────────────────
export function sanitizeProfileForPublic(profile: Record<string, unknown>, memberType: string, bypassSecurity = false) {
  if (bypassSecurity) {
    return {
      ...profile,
      email: profile.contact_email || profile.email,
      nickname: profile.nickname || profile.first_name || "ARES Member",
    };
  }

  const safeParseArray = (val: unknown) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return []; }
    }
    return [];
  };

  const safe: Record<string, unknown> = {
    user_id: profile.user_id,
    nickname: profile.nickname || "ARES Member",
    avatar: profile.avatar,
    pronouns: profile.pronouns,
    subteams: safeParseArray(profile.subteams),
    member_type: profile.member_type,
    bio: profile.bio,
    favorite_first_thing: profile.favorite_first_thing,
    fun_fact: profile.fun_fact,
    show_on_about: profile.show_on_about,
    favorite_robot_mechanism: profile.favorite_robot_mechanism,
    pre_match_superstition: profile.pre_match_superstition,
    leadership_role: profile.leadership_role,
    rookie_year: profile.rookie_year,
    favorite_food: profile.favorite_food,
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
    email: (Number(profile.show_email) && !isEncrypted(profile.contact_email)) ? (profile.contact_email || profile.email) : undefined,
    phone: (Number(profile.show_phone) && !isEncrypted(profile.phone)) ? profile.phone : undefined,
    colleges: safeParseArray(profile.colleges),
    employers: safeParseArray(profile.employers),
    grade_year: profile.grade_year,
  };
}
