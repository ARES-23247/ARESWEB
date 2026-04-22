import { Hono, Context, Next } from "hono";
import { siteConfig } from "../../utils/site.config";
import { getAuth } from "../../utils/auth";
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
  // ── GitHub Projects v2 ──
  GITHUB_PAT?: string;
  GITHUB_PROJECT_ID?: string;
  GITHUB_ORG?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  ENCRYPTION_SECRET: string;
  // ── Zulip ──

  ZULIP_CLIENT_ID: string;
  ZULIP_CLIENT_SECRET: string;
  ZULIP_URL?: string;
  ZULIP_BOT_EMAIL?: string;
  ZULIP_API_KEY?: string;
  ZULIP_WEBHOOK_TOKEN?: string;
  ZULIP_COMMENT_STREAM?: string;
  ZULIP_ADMIN_STREAM?: string;
  // ── Bootstrap ──
  INITIAL_ADMIN_EMAIL?: string;
  RESEND_API_KEY?: string;
  DEV_BYPASS?: string;
  // ── Turnstile ──
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

// ── Localhost Dev Bypass Check ────────────────────────────────────────
function isDevBypassEnabled(c: Context<AppEnv>): boolean {
  const url = new URL(c.req.url);
  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  // SEC-03: Only bypass auth in local dev when DEV_BYPASS env var is set
  return isLocalhost && (c.env.DEV_BYPASS === "true" || c.env.DEV_BYPASS === "1");
}

// ── Admin Auth Middleware ─────────────────────────────────────────────
export const ensureAdmin = async (c: Context<AppEnv>, next: Next) => {
  if (isDevBypassEnabled(c)) {
    c.set("sessionUser", { id: "local-dev", email: "local-dev@localhost", name: "Local Dev", image: null, role: "admin", member_type: "mentor" });
    return await next();
  }

  const auth = getAuth(c.env.DB, c.env, c.req.url);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session || !session.user) {
    return c.json({ error: "Unauthorized: Please log in." }, 401);
  }

  // RBAC: Granular path-based role checks
  const url = new URL(c.req.url);
  const role = (session.user as { role?: string }).role || UserRole.UNVERIFIED;

  // EFF-05: Store session in context so handlers don't need to re-fetch
  const profile = await c.env.DB.prepare(
    "SELECT member_type FROM user_profiles WHERE user_id = ?"
  ).bind(session.user.id).first<{ member_type: string }>();

  const memberType = profile?.member_type || "student";

  // Authors and Adult Leaders can do everything EXCEPT manage users
  const isSuperAdminRoute = url.pathname.includes("/admin/users") || url.pathname.includes("/admin/roles");
  const allowedRoles: string[] = isSuperAdminRoute ? [UserRole.ADMIN] : [UserRole.ADMIN, UserRole.AUTHOR];

  let isAuthorized = allowedRoles.includes(role);
  
  // Grant standard admin privileges to verified Coaches and Mentors
  if (!isAuthorized && !isSuperAdminRoute) {
    if (role !== UserRole.UNVERIFIED && (memberType === "coach" || memberType === "mentor")) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
     console.warn(`[Auth Check] Access Denied for ${session.user.email}. Role: ${role}, MemberType: ${memberType}. Path: ${url.pathname}`);
     return c.json({ error: `Forbidden: Requires one of [${allowedRoles.join(", ")}] privileges or adult leader status.` }, 403);
  }

  c.set("sessionUser", {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
    role,
    member_type: memberType,
  });

  await next();
};

// ── Authentication Middleware (Logged In Only) ──────────────────────
export const ensureAuth = async (c: Context<AppEnv>, next: Next) => {
  if (isDevBypassEnabled(c)) {
    c.set("sessionUser", { id: "local-dev", email: "local-dev@localhost", name: "Local Dev", image: null, role: "admin", member_type: "mentor" });
    return await next();
  }

  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized: Please log in." }, 401);
  }

  c.set("sessionUser", user);
  await next();
};

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  image: string | undefined | null;
  role: string | "admin" | "author" | "unverified";
  member_type: string;
}

// ── REF-08: Audit Logging ────────────────────────────────────────────
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
    // Never let audit logging break the request
    console.error("[AuditLog] Failed to record action:", action, err);
  }
}

/**
 * Logs a system-level integration failure for admin visibility.
 * Used in utility functions where Context might not be available.
 */
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

// ── Session Helper ───────────────────────────────────────────────────
export async function getSessionUser(c: Context<AppEnv>): Promise<SessionUser | null> {
  // Check if ensureAdmin already stored session in context
  const cached = c.get("sessionUser");
  if (cached) return cached as SessionUser;

  if (isDevBypassEnabled(c)) {
    return { id: "local-dev", email: "local-dev@localhost", name: "Local Dev", image: null, role: "admin", member_type: "mentor" };
  }
  try {
    const auth = getAuth(c.env.DB, c.env, c.req.url);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (session && session.user) {
      // Fetch member_type from profile
      const profile = await c.env.DB.prepare(
        "SELECT member_type FROM user_profiles WHERE user_id = ?"
      ).bind(session.user.id).first<{ member_type: string }>();

      return {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
        role: (session.user as { role?: string }).role || UserRole.UNVERIFIED,
        member_type: profile?.member_type || "student",
      };
    }
  } catch { /* ignore */ }
  return null;
}

// ── Pagination Helper (DRY-01) ───────────────────────────────────────
export function parsePagination(c: Context<AppEnv>, defaultLimit = 50, maxLimit = 200) {
  const limit = Math.min(Number(c.req.query("limit") || String(defaultLimit)), maxLimit);
  const offset = Math.max(Number(c.req.query("offset") || "0"), 0);
  return { limit, offset };
}

// ── Centralized Settings Fetch (EFF-01) ──────────────────────────────
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
  // EFF-01: Per-request caching in context to avoid redundant D1 queries
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
      // ── Zulip Integration ──
      ZULIP_BOT_EMAIL: c.env.ZULIP_BOT_EMAIL || dbSettings["ZULIP_BOT_EMAIL"],
      ZULIP_API_KEY: c.env.ZULIP_API_KEY || dbSettings["ZULIP_API_KEY"],
      ZULIP_URL: c.env.ZULIP_URL || dbSettings["ZULIP_URL"] || "https://ares.zulipchat.com",
      ZULIP_ADMIN_STREAM: c.env.ZULIP_ADMIN_STREAM || dbSettings["ZULIP_ADMIN_STREAM"] || "leadership",
      ZULIP_COMMENT_STREAM: c.env.ZULIP_COMMENT_STREAM || dbSettings["ZULIP_COMMENT_STREAM"] || "website-discussion",
      // ── GitHub Projects v2 ──
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
  // Students & parents: NEVER expose PII or career/education fields
  if (memberType === "student" || memberType === "parent") {
    return safe;
  }
  // Adults: include optional fields if user opted in
  return {
    ...safe,
    email: Number(profile.show_email) ? (profile.contact_email || profile.email) : undefined,
    phone: Number(profile.show_phone) ? profile.phone : undefined,
    colleges: safeParseArray(profile.colleges),
    employers: safeParseArray(profile.employers),
    grade_year: profile.grade_year,
  };
}

// ── Rate Limiting (In-Memory Worker V8 Isolate) ────────────────────────
// This replaces the dangerous D1 database rate limiter. Since this runs in 
// local Worker memory, it costs $0 and won't crash the database under DDoS.
const rateLimitCache = new Map<string, { count: number; expiresAt: number }>();

export function checkRateLimit(ip: string, limit = 100, windowSeconds = 60): boolean {
  const now = Date.now();
  
  // Random garbage collection (5% chance) to prevent memory leaks in the isolate map
  if (Math.random() < 0.05) {
    for (const [key, data] of rateLimitCache.entries()) {
      if (data.expiresAt < now) {
        rateLimitCache.delete(key);
      }
    }
  }

  let record = rateLimitCache.get(ip);
  if (!record || record.expiresAt < now) {
    record = { count: 0, expiresAt: now + windowSeconds * 1000 };
  }

  record.count += 1;
  rateLimitCache.set(ip, record);

  return record.count <= limit;
}

// ── Write-Endpoint Rate Limiting (Stricter) ────────────────────────────
// Separate limiter for unauthenticated POST endpoints that write to D1/R2.
// Prevents bots from spamming analytics/track, sponsor-click, inquiries etc.
const writeRateLimitCache = new Map<string, { count: number; expiresAt: number }>();

export function checkWriteRateLimit(ip: string, limit = 15, windowSeconds = 60): boolean {
  const now = Date.now();

  if (Math.random() < 0.05) {
    for (const [key, data] of writeRateLimitCache.entries()) {
      if (data.expiresAt < now) writeRateLimitCache.delete(key);
    }
  }

  let record = writeRateLimitCache.get(ip);
  if (!record || record.expiresAt < now) {
    record = { count: 0, expiresAt: now + windowSeconds * 1000 };
  }

  record.count += 1;
  writeRateLimitCache.set(ip, record);

  return record.count <= limit;
}

// ── SEC-DoW: Cloudflare Turnstile Verification ──────────────────────
// Validates a Turnstile challenge token server-side.
// Returns true if the token is valid, false on failure.
// Gracefully allows requests if TURNSTILE_SECRET_KEY is not configured
// (dev environments, or before the secret is set in Cloudflare dashboard).
export async function verifyTurnstile(
  token: string | null | undefined,
  secretKey: string | undefined,
  clientIp: string
): Promise<boolean> {
  // If Turnstile is not configured, allow (graceful degradation)
  if (!secretKey) return true;

  // If no token provided, block
  if (!token) return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}&remoteip=${encodeURIComponent(clientIp)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const result = await res.json() as { success: boolean };
    return result.success === true;
  } catch (err) {
    console.error("[Turnstile] Verification failed:", err);
    // On network error, fail open to avoid blocking legitimate traffic
    return true;
  }
}

// ── Middlewares ────────────────────────────────────────────────────────

/**
 * Middleware: Rate Limit
 */
export const rateLimitMiddleware = (limit = 15, windowSeconds = 60) => {
  return async (c: Context<AppEnv>, next: Next) => {
    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    if (!checkWriteRateLimit(`mw:${ip}`, limit, windowSeconds)) {
      return c.json({ error: "Too many submissions. Please try again later." }, 429);
    }
    await next();
  };
};

/**
 * Middleware: Turnstile Verification
 * Assumes the client sends a JSON payload with a `turnstileToken` field.
 */
export const turnstileMiddleware = () => {
  return async (c: Context<AppEnv>, next: Next) => {
    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    
    let token: string | undefined;
    try {
      const clonedReq = c.req.raw.clone();
      const body = await clonedReq.json() as { turnstileToken?: string };
      token = body.turnstileToken;
    } catch (err) {
      // Body might not be JSON, skip token extraction
    }

    const valid = await verifyTurnstile(token, c.env.TURNSTILE_SECRET_KEY, ip);
    if (!valid) {
      return c.json({ error: "Security verification failed. Please try again." }, 403);
    }
    await next();
  };
};

// ── Generic Content Management Factory ────────────────────────────────

export interface ContentLifecycleHooks {
  onApprove?: (c: Context<AppEnv>, id: string) => Promise<boolean | void>;
  onReject?: (c: Context<AppEnv>, id: string, reason?: string) => Promise<boolean | void>;
  onRestore?: (c: Context<AppEnv>, id: string) => Promise<boolean | void>;
  onDelete?: (c: Context<AppEnv>, id: string, type: "trashed" | "purged") => Promise<boolean | void>;
}

export function createContentLifecycleRouter(tableName: string, hooks?: ContentLifecycleHooks) {
  const router = new Hono<AppEnv>();

  // Use ensureAdmin for all lifecycle routes
  router.use("*", ensureAdmin);

  // Approve
  router.patch("/:id/approve", async (c) => {
    const id = c.req.param("id");
    
    let handled = false;
    if (hooks?.onApprove) handled = (await hooks.onApprove(c, id)) === true;

    if (!handled) {
      const { success } = await c.env.DB.prepare(
        `UPDATE ${tableName} SET status = 'published' WHERE slug = ? OR id = ?`
      ).bind(id, id).run();
      if (!success) return c.json({ error: "Failed to approve" }, 500);
    }

    await logAuditAction(c, `APPROVE_${tableName.toUpperCase()}`, tableName, id);
    return c.json({ success: true });
  });

  // Reject
  router.patch("/:id/reject", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({})) as { reason?: string };

    let handled = false;
    if (hooks?.onReject) handled = (await hooks.onReject(c, id, body.reason)) === true;

    if (!handled) {
      const { success } = await c.env.DB.prepare(
        `UPDATE ${tableName} SET status = 'rejected' WHERE slug = ? OR id = ?`
      ).bind(id, id).run();
      if (!success) return c.json({ error: "Failed to reject" }, 500);
    }

    await logAuditAction(c, `REJECT_${tableName.toUpperCase()}`, tableName, id);
    return c.json({ success: true });
  });

  // Restore
  router.patch("/:id/restore", async (c) => {
    const id = c.req.param("id");

    let handled = false;
    if (hooks?.onRestore) handled = (await hooks.onRestore(c, id)) === true;

    if (!handled) {
      const { success } = await c.env.DB.prepare(
        `UPDATE ${tableName} SET is_deleted = 0, status = 'draft' WHERE slug = ? OR id = ?`
      ).bind(id, id).run();
      if (!success) return c.json({ error: "Failed to restore" }, 500);
    }

    await logAuditAction(c, `RESTORE_${tableName.toUpperCase()}`, tableName, id);
    return c.json({ success: true });
  });

  // Soft Delete (Trash)
  router.delete("/:id", async (c) => {
    const id = c.req.param("id");
    
    let handled = false;
    if (hooks?.onDelete) handled = (await hooks.onDelete(c, id, "trashed")) === true;

    if (!handled) {
      const { success } = await c.env.DB.prepare(
        `UPDATE ${tableName} SET is_deleted = 1 WHERE slug = ? OR id = ?`
      ).bind(id, id).run();
      if (!success) return c.json({ error: "Operation failed" }, 500);
    }
    
    await logAuditAction(c, `DELETE_${tableName.toUpperCase()}`, tableName, id);
    return c.json({ success: true, action: "trashed" });
  });

  // Hard Delete (Purge)
  router.delete("/:id/purge", async (c) => {
    const id = c.req.param("id");
    
    let handled = false;
    if (hooks?.onDelete) handled = (await hooks.onDelete(c, id, "purged")) === true;

    if (!handled) {
      const { success } = await c.env.DB.prepare(
        `DELETE FROM ${tableName} WHERE slug = ? OR id = ?`
      ).bind(id, id).run();
      if (!success) return c.json({ error: "Operation failed" }, 500);
    }
    
    await logAuditAction(c, `PURGE_${tableName.toUpperCase()}`, tableName, id);
    return c.json({ success: true, action: "purged" });
  });

  return router;
}
