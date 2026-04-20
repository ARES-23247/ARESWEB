import { Context, Next } from "hono";
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
  ZULIP_CLIENT_ID: string;
  ZULIP_CLIENT_SECRET: string;
  DEV_BYPASS?: string;
};

export type Variables = {
  sessionUser: SessionUser;
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

  // Authors can do everything EXCEPT manage users
  const isSuperAdminRoute = url.pathname.includes("/admin/users") || url.pathname.includes("/admin/roles");
  const allowedRoles: string[] = isSuperAdminRoute ? [UserRole.ADMIN] : [UserRole.ADMIN, UserRole.AUTHOR];

  if (!allowedRoles.includes(role)) {
     console.warn(`[Auth Check] Access Denied for ${session.user.email}. Role: ${role}. Path: ${url.pathname}`);
     return c.json({ error: `Forbidden: Requires one of [${allowedRoles.join(", ")}] privileges.` }, 403);
  }

  // EFF-05: Store session in context so handlers don't need to re-fetch
  const profile = await c.env.DB.prepare(
    "SELECT member_type FROM user_profiles WHERE user_id = ?"
  ).bind(session.user.id).first<{ member_type: string }>();

  c.set("sessionUser", {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
    role,
    member_type: profile?.member_type || "student",
  });

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

// ── Centralized Settings Fetch (EFF-01) ──────────────────────────────
export async function getDbSettings(c: Context<AppEnv>): Promise<Record<string, string>> {
  const { results: settingsRows } = await c.env.DB.prepare("SELECT key, value FROM settings").all();
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
  try {
    const dbSettings = await getDbSettings(c);

    return {
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
      GCAL_PRIVATE_KEY: dbSettings["GCAL_PRIVATE_KEY"]
    };
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

  const safe: Record<string, unknown> = {
    user_id: profile.user_id,
    nickname: profile.nickname || "ARES Member",
    avatar: profile.avatar,
    pronouns: profile.pronouns,
    subteams: profile.subteams,
    member_type: profile.member_type,
    bio: profile.bio,
    favorite_first_thing: profile.favorite_first_thing,
    fun_fact: profile.fun_fact,
    show_on_about: profile.show_on_about,
    favorite_robot_mechanism: profile.favorite_robot_mechanism,
    pre_match_superstition: profile.pre_match_superstition,
    leadership_role: profile.leadership_role,
    rookie_year: profile.rookie_year,
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
    colleges: profile.colleges,
    employers: profile.employers,
    grade_year: profile.grade_year,
  };
}

// ── Audit Log Helper (GAP-01) ────────────────────────────────────────
export async function logAuditAction(
  c: Context<AppEnv>,
  action: string,
  targetType: string,
  targetId: string | null,
  details?: string
) {
  try {
    const user = await getSessionUser(c);
    await c.env.DB.prepare(
      "INSERT INTO audit_log (action, target_type, target_id, actor_email, actor_role, details) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(
      action,
      targetType,
      targetId,
      user?.email || "system",
      user?.role || "unknown",
      details || null
    ).run();
  } catch (err) {
    // Never let audit logging break the main request
    console.error("[AuditLog] Failed to log action:", err);
  }
}
