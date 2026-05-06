import { Hono } from "hono";
import type { Context } from "hono";
import { AppEnv, getSessionUser, persistentRateLimitMiddleware } from "../middleware";
import { getAuth } from "../../utils/auth";

const authRouter = new Hono<AppEnv>();

// NOTE: Rate limiting is applied to authentication endpoints to prevent brute force attacks.
// For enhanced security, consider implementing account lockout after N failed attempts:
// - Track failed login attempts per email/IP
// - Implement exponential backoff for repeated failures
// - Notify users of suspicious login attempts
// - See AUTH_PATTERNS.md for security best practices

// ── GET /api/auth-check — verify session (UI gate only) ────────────────
authRouter.get("/auth-check", persistentRateLimitMiddleware(60, 60), async (c: Context<AppEnv>) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ authenticated: false }, 401);
  return c.json({ 
    authenticated: true, 
    user
  });
});

// ── Better Auth Routes ────────────────────────────────────────────────
authRouter.on(["POST", "GET"], "/*", persistentRateLimitMiddleware(20, 60), async (c: Context<AppEnv>) => {
  try {
    const auth = getAuth(c.env.DB, c.env, c.req.url);
    const response = await auth.handler(c.req.raw);
    return response;
  } catch (error: unknown) {
    const err = error as Error & { status?: number };
    console.error("[Auth Handler] Internal Exception:", err);
    // Only expose stack traces when explicitly enabled via DEV_BYPASS
    // Header-based detection (Host, CF-Connecting-IP) is spoofable and unsafe
    const isDevBypass = c.env.DEV_BYPASS === "true" || c.env.DEV_BYPASS === "1";
    return c.json({
      message: err.message || "Internal Server Error during Authentication",
      stack: isDevBypass ? err.stack : undefined
    }, 500);
  }
});

export default authRouter;

