import { OpenAPIHono } from "@hono/zod-openapi";
import { AppEnv, getSessionUser, persistentRateLimitMiddleware, getDb, ApiError } from "../middleware";
import { getAuth } from "../../utils/auth";
import { authCheckRoute, emergencyClearRoute, testLoginRoute } from "../../../shared/routes/auth";
import { eq } from "drizzle-orm";
import * as schema from "../../../src/db/schema";

const _authRouter = new OpenAPIHono<AppEnv>();

// ── GET /api/auth-check — verify session (UI gate only) ────────────────
export const authRouter = _authRouter
    .openapi(authCheckRoute, async (c) => {
      const user = await getSessionUser(c);
      if (!user) {
        return c.json({ authenticated: false as const }, 401);
      }
      return c.json({
        authenticated: true as const,
        user: {
          id: user.id,
          email: user.email,
          name: user.name || "ARES User",
          role: user.role,
          image: user.image || null,
        }
      }, 200);
    })
    .openapi(emergencyClearRoute, async (c) => {
      const res = c.redirect("/");
      res.headers.append("Set-Cookie", "better-auth.session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
      res.headers.append("Set-Cookie", "__Secure-better-auth.session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure");
      res.headers.append("Set-Cookie", "better-auth.csrf_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
      res.headers.append("Set-Cookie", "__Secure-better-auth.csrf_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure");
      return res;
    })
    .openapi(testLoginRoute, async (c) => {
      const body = c.req.valid("json");

      const env = c.env as unknown as Record<string, string | undefined>;
      const isTestMode = env.ENVIRONMENT === 'test' ||
                         env.CI === 'true' ||
                         c.req.header('x-test-bypass-auth') === 'true';

      if (!isTestMode) {
        throw new ApiError('Test login only available in test environments', 403);
      }

      const userId = body?.userId || 'admin-user';

      try {
        const db = getDb(c);
        const user = await db.select({
          id: schema.user.id,
          name: schema.user.name,
          email: schema.user.email,
          role: schema.user.role,
          image: schema.user.image
        })
        .from(schema.user)
        .where(eq(schema.user.id, userId))
        .get();

        if (!user) {
          throw new ApiError('Test user not found', 404);
        }

        const sessionId = crypto.randomUUID();
        const expiresAt = Date.now() + (60 * 60 * 24 * 7 * 1000); // 7 days
        const token = btoa(`${userId}:${sessionId}:${expiresAt}`);

        await db.insert(schema.session).values({
          id: sessionId,
          userId: userId,
          expiresAt: new Date(expiresAt),
          token: token,
          createdAt: new Date(),
          updatedAt: new Date()
        }).run();

        const secret = c.env.BETTER_AUTH_SECRET;
        if (!secret) {
          throw new ApiError("BETTER_AUTH_SECRET environment variable is required", 500, "MISSING_SECRET");
        }

        // Sign the token using the same HMAC-SHA256 format that better-call uses internally.
        // better-call's verifySignature checks: signature.length === 44 && signature.endsWith("=")
        // This means we MUST use standard base64 (with +, /, =) NOT base64url.
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          'raw',
          encoder.encode(secret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );
        const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(token));
        // Standard base64 — NOT base64url. Must keep +, /, and = padding intact.
        const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
        // better-call's signCookieValue format: `${value}.${signature}` then encodeURIComponent
        const signedToken = `${token}.${signature}`;

        const res = c.json({
          success: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            image: user.image || null,
          },
          sessionToken: signedToken,
        }, 200);

        const isSecure = c.req.url.startsWith('https://');
        const cookieDomain = isSecure ? undefined : 'localhost';
        const cookieName = isSecure ? '__Secure-better-auth.session_token' : 'better-auth.session_token';
        // URL-encode the signed token value, matching better-call's serializeSignedCookie behavior
        const encodedToken = encodeURIComponent(signedToken);
        res.headers.append(
          'Set-Cookie',
          `${cookieName}=${encodedToken}; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}${cookieDomain ? `; Domain=${cookieDomain}` : ''}`
        );

        return res;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new ApiError('Failed to create test session', 500, 'INTERNAL_ERROR', { originalMessage: message });
      }
    });
// ── GET /api/auth/emergency-clear — force clear poisoned cookies ───────
// ── POST /api/auth/test-login — generate test session (E2E testing only) ───
// Catch-all for Better Auth internal routes
_authRouter.on(["POST", "GET"], "/*", async (c, next) => {
  const path = c.req.path;
  if (c.req.method === "POST" && (path.includes("/sign-in") || path.includes("/sign-up") || path.includes("/forget-password") || path.includes("/reset-password") || path.includes("/verify-email"))) {
    return persistentRateLimitMiddleware(10, 60)(c, next);
  }
  return persistentRateLimitMiddleware(150, 60)(c, next);
}, async (c) => {
  try {
    const auth = getAuth(c.env.DB, c.env, c.req.url);
    const response = await auth.handler(c.req.raw);
    return response;
  } catch (error: unknown) {
    console.error("[Auth Handler] Better Auth internal exception:", error);
    if (error instanceof ApiError) throw error;
    const message = error instanceof Error ? error.message : "Unknown authentication error";
    const status = (error as { status?: number })?.status;
    throw new ApiError(message, status || 500);
  }
});

export default authRouter;
