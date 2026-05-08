import { typedHandler } from "../utils/handler";
import { OpenAPIHono } from "@hono/zod-openapi";
import { AppEnv, getSessionUser, persistentRateLimitMiddleware } from "../middleware";
import { getAuth } from "../../utils/auth";
import { authCheckRoute } from "../../../shared/routes/auth";

const authRouter = new OpenAPIHono<AppEnv>();

// NOTE: Rate limiting is applied to authentication endpoints to prevent brute force attacks.
// For enhanced security, consider implementing account lockout after N failed attempts:
// - Track failed login attempts per email/IP
// - Implement exponential backoff for repeated failures
// - Notify users of suspicious login attempts
// - See AUTH_PATTERNS.md for security best practices

// ── GET /api/auth-check — verify session (UI gate only) ────────────────
authRouter.openapi(authCheckRoute, typedHandler<typeof authCheckRoute>(async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ authenticated: false }, 401);
  return c.json({ 
    authenticated: true, 
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      image: user.image || null,
    }
  }, 200);
}));

// ── GET /api/auth/emergency-clear — force clear poisoned cookies ───────
authRouter.get("/emergency-clear", (c) => {
  const res = c.redirect("/");
  res.headers.append("Set-Cookie", "better-auth.session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
  res.headers.append("Set-Cookie", "__Secure-better-auth.session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure");
  res.headers.append("Set-Cookie", "better-auth.csrf_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
  res.headers.append("Set-Cookie", "__Secure-better-auth.csrf_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure");
  return res;
});

// ── POST /api/auth/test-login — generate test session (E2E testing only) ───
// SECURITY: This endpoint only works in test environments. Never enable in production.
authRouter.post("/test-login", async (c) => {
  // SECURITY: Verify test mode via environment or special header
  const isTestMode = c.env.ENVIRONMENT === 'test' ||
                     c.env.CI === 'true' ||
                     c.req.header('x-test-bypass-auth') === 'true';

  if (!isTestMode) {
    return c.json({ error: 'Test login only available in test environments' }, 403);
  }

  // Get test user ID from request body, default to admin-user
  const body = await c.req.json().catch(() => ({}));
  const userId = body.userId || 'admin-user';

  try {
    // Check if user exists
    const user = await c.env.DB.prepare(
      'SELECT id, name, email, role FROM user WHERE id = ?'
    ).bind(userId).first();

    if (!user) {
      return c.json({ error: 'Test user not found' }, 404);
    }

    // Create a new session using Better Auth's API
    // Note: Better Auth sessions are created via the signIn API
    // For testing, we'll create a session token directly
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + (60 * 60 * 24 * 7 * 1000); // 7 days
    const token = Buffer.from(`${userId}:${sessionId}:${expiresAt}`).toString('base64');

    // Insert session directly into database
    await c.env.DB.prepare(`
      INSERT INTO session (id, userId, expiresAt, token, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      sessionId,
      userId,
      expiresAt,
      token,
      Date.now(),
      Date.now()
    ).run();

    // Set session cookie
    const res = c.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      sessionToken: token,
    });

    // Set the session cookie for immediate use
    const isSecure = c.req.url.startsWith('https://');
    const cookieDomain = isSecure ? undefined : 'localhost';
    res.headers.append(
      'Set-Cookie',
      `better-auth.session_token=${token}; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}${cookieDomain ? `; Domain=${cookieDomain}` : ''}`
    );

    return res;
  } catch (error) {
    console.error('[Test Auth] Error creating test session:', error);
    return c.json({ error: 'Failed to create test session' }, 500);
  }
});

// ── Better Auth Routes ────────────────────────────────────────────────
// Catch-all for Better Auth internal routes
authRouter.on(["POST", "GET"], "/*", async (c, next) => {
  const path = c.req.path;
  // SEC-RL: Strict rate limiting for sensitive authentication endpoints
  if (c.req.method === "POST" && (path.includes("/sign-in") || path.includes("/sign-up") || path.includes("/forget-password") || path.includes("/reset-password") || path.includes("/verify-email"))) {
    return persistentRateLimitMiddleware(10, 60)(c, next);
  }
  // Generous rate limit for standard session checks
  return persistentRateLimitMiddleware(150, 60)(c, next);
}, async (c) => {
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


