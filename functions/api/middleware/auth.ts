import { Context, Next } from "hono";
import { getAuth } from "../../utils/auth";
import { eq } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { AppEnv, UserRole, SessionUser } from "./utils";

// ── Localhost Dev Bypass Check ────────────────────────────────────────
export function isDevBypassEnabled(c: Context<AppEnv>): boolean {
  // CR-03 FIX: Only bypass auth in local development, NOT in preview environments
  // Preview deployments on Cloudflare Pages are publicly accessible and should not bypass auth
  const isDev = c.env.ENVIRONMENT === "development" || ((globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV === "test");
  if (!isDev) return false;

  const url = new URL(c.req.url);
  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";

  return isLocalhost && (c.env.DEV_BYPASS === "true" || c.env.DEV_BYPASS === "1");
}

// ── Admin Auth Middleware ─────────────────────────────────────────────
export const ensureAdmin = async (c: Context<AppEnv>, next: Next) => {
  if (isDevBypassEnabled(c)) {
    c.set("sessionUser", { id: "local-dev", email: "local-dev@localhost", name: "Local Dev", nickname: "Local Dev", image: null, role: "admin", member_type: "mentor" });
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
  // WR-03: Normalize role to lowercase for consistent comparison
  const rawRole = (session.user as { role?: string }).role || UserRole.UNVERIFIED;
  const role = rawRole.toLowerCase() as string;

  // EFF-05: Store session in context so handlers don't need to re-fetch
  const db: DrizzleDB = c.get("db");
  const profile = await db.select({
    nickname: schema.userProfiles.nickname,
    member_type: schema.userProfiles.memberType
  })
  .from(schema.userProfiles)
  .where(eq(schema.userProfiles.userId, session.user.id))
  .get();

  const memberType = profile?.member_type || "student";
  const nickname = profile?.nickname || "ARES Member";

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
    nickname,
    image: session.user.image,
    role,
    member_type: memberType,
  });

  await next();
};

// ── Authentication Middleware (Logged In Only) ──────────────────────
export const ensureAuth = async (c: Context<AppEnv>, next: Next) => {
  if (isDevBypassEnabled(c)) {
    c.set("sessionUser", { id: "local-dev", email: "local-dev@localhost", name: "Local Dev", nickname: "Local Dev", image: null, role: "admin", member_type: "mentor" });
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
    return { id: "local-dev", email: "local-dev@localhost", name: "Local Dev", nickname: "Local Dev", image: null, role: "admin", member_type: "mentor" };
  }
  try {
    const auth = getAuth(c.env.DB, c.env, c.req.url);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (session && session.user) {
      // Fetch member_type and nickname from profile
      const db: DrizzleDB = c.get("db");
      const profile = await db.select({
        nickname: schema.userProfiles.nickname,
        member_type: schema.userProfiles.memberType
      })
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, session.user.id))
      .get();

      const sessionUser = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        nickname: profile?.nickname || "ARES Member",
        image: session.user.image,
        // WR-03: Normalize role to lowercase for consistent comparison
        role: ((session.user as { role?: string }).role || UserRole.UNVERIFIED).toLowerCase() as string,
        member_type: profile?.member_type || "student",
      };
      // WR-02: Cache sessionUser in context so subsequent getSessionUser calls don't re-fetch
      c.set("sessionUser", sessionUser);
      return sessionUser;
    }
  } catch (err) {
    // WR-04: Log authentication errors instead of silently swallowing them
    console.error("[Auth] getSessionUser failed:", err);
    return null;
  }
  return null;
}
