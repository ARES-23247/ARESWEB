import { Context, Next } from "hono";
import { getAuth } from "../../utils/auth";
import { AppEnv, UserRole, SessionUser } from "./utils";

// ── Localhost Dev Bypass Check ────────────────────────────────────────
export function isDevBypassEnabled(c: Context<AppEnv>): boolean {
  // SEC-03: Only bypass auth in local dev/preview when DEV_BYPASS env var is set
  const isDev = c.env.ENVIRONMENT === "development" || c.env.ENVIRONMENT === "preview" || c.env.ENVIRONMENT === "test" || process.env.NODE_ENV === "test";
  if (!isDev) return false;

  const url = new URL(c.req.url);
  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  
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

  // EFF-F05: Store fetched user in context to satisfy subsequent getSessionUser() calls
  c.set("sessionUser", user);
  await next();
};

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
