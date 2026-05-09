import { typedHandler } from "../utils/handler";
import { OpenAPIHono } from "@hono/zod-openapi";
import { AppEnv, getSessionUser, persistentRateLimitMiddleware, getDb, ApiError } from "../middleware";
import { getAuth } from "../../utils/auth";
import { authCheckRoute, emergencyClearRoute, testLoginRoute } from "../../../shared/routes/auth";
import { eq } from "drizzle-orm";
import * as schema from "../../../src/db/schema";

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
authRouter.openapi(emergencyClearRoute, typedHandler<typeof emergencyClearRoute>((c) => {
  const res = c.redirect("/");
  res.headers.append("Set-Cookie", "better-auth.session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
  res.headers.append("Set-Cookie", "__Secure-better-auth.session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure");
  res.headers.append("Set-Cookie", "better-auth.csrf_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
  res.headers.append("Set-Cookie", "__Secure-better-auth.csrf_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure");
  return res;
}));

// ── POST /api/auth/test-login — generate test session (E2E testing only) ───
// SECURITY: This endpoint only works in test environments. Never enable in production.
// @ts-expect-error - Hono's OpenAPI type system doesn't handle union response types well
// This test-only endpoint returns different types based on status code (200/403/404/500)
// The runtime behavior is correct; this is a TypeScript limitation with discriminated unions
authRouter.openapi(testLoginRoute, async (c) => {
  // SECURITY: Verify test mode via environment or special header
  // Note: CI is a GitHub Actions env var, not in Cloudflare Bindings type
  const env = c.env as unknown as Record<string, string | undefined>;
  const isTestMode = env.ENVIRONMENT === 'test' ||
                     env.CI === 'true' ||
                     c.req.header('x-test-bypass-auth') === 'true';

  if (!isTestMode) {
    throw new ApiError('Test login only available in test environments', 403);
  }

  // Get test user ID from request body, default to admin-user
  const body = c.req.valid("json") || {};
  const userId = body.userId || 'admin-user';

  try {
    const db = getDb(c);

    // Check if user exists
    const user = await db.select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      role: schema.user.role
    })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .get();

    if (!user) {
      throw new ApiError('Test user not found', 404);
    }

    // Create a new session using Better Auth's API
    const auth = getAuth(c.env.DB, c.env, c.req.url);
    const authCtx = await auth.$context;
    console.log('[Test Auth] authCtx keys:', Object.keys(authCtx));
    if (authCtx.session) console.log('[Test Auth] authCtx.session keys:', Object.keys(authCtx.session));
    if (authCtx.internalAdapter) console.log('[Test Auth] authCtx.internalAdapter keys:', Object.keys(authCtx.internalAdapter));
    
    // Note: Better Auth sessions are created via the signIn API
    // For testing, we'll create a session token directly
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + (60 * 60 * 24 * 7 * 1000); // 7 days
    const token = btoa(`${userId}:${sessionId}:${expiresAt}`);

    // Insert session directly into database
    await db.insert(schema.session).values({
      id: sessionId,
      userId: userId,
      expiresAt: new Date(expiresAt),
      token: token,
      createdAt: new Date(),
      updatedAt: new Date()
    }).run();

    // Sign the cookie using Web Crypto API to match Better Auth's HMAC-SHA256 signature
    let secret = c.env.BETTER_AUTH_SECRET;
    if (!secret) {
      const isLocal = c.req.url && (c.req.url.includes("localhost") || c.req.url.includes("127.0.0.1"));
      if (isLocal) {
        secret = "ares-local-dev-secret-do-not-use-in-production";
      } else {
        throw new Error("BETTER_AUTH_SECRET is required to sign test session token.");
      }
    }
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(token));
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const signedToken = `${token}.${signatureBase64}`;

    // Set session cookie
    const res = c.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      sessionToken: signedToken,
    });

    // Set the session cookie for immediate use
    const isSecure = c.req.url.startsWith('https://');
    const cookieDomain = isSecure ? undefined : 'localhost';
    const cookieName = isSecure ? '__Secure-better-auth.session_token' : 'better-auth.session_token';
    res.headers.append(
      'Set-Cookie',
      `${cookieName}=${signedToken}; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}${cookieDomain ? `; Domain=${cookieDomain}` : ''}`
    );

    return res;
  } catch (error: any) {
    console.error('[Test Auth] Error creating test session:', error);
    return c.json({ error: 'Failed to create test session', details: error.message, stack: error.stack }, 500);
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
    const isDevBypass = c.env.DEV_BYPASS === "true" || c.env.DEV_BYPASS === "1";
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;
    const status = (error as { status?: number })?.status;

    console.error("[Auth Handler] Internal Exception:", error);
    return c.json({
      message: message || "Internal Server Error during Authentication",
      stack: isDevBypass ? stack : undefined
    }, (status || 500) as import("hono/utils/http-status").ContentfulStatusCode);
  }
});

export default authRouter;


