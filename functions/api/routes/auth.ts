import { Hono } from "hono";
import { AppEnv, getSessionUser, rateLimitMiddleware } from "../middleware";
import { getAuth } from "../../utils/auth";

const authRouter = new Hono<AppEnv>();

// ── GET /api/auth-check — verify session (UI gate only) ────────────────
authRouter.get("/auth-check", rateLimitMiddleware(60, 60), async (c: any) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ authenticated: false }, 401);
  return c.json({ 
    authenticated: true, 
    user
  });
});

// ── Better Auth Routes ────────────────────────────────────────────────
authRouter.on(["POST", "GET"], "/*", rateLimitMiddleware(20, 60), async (c: any) => {
  try {
    const auth = getAuth(c.env.DB, c.env, c.req.url);
    const response = await auth.handler(c.req.raw);
    return response;
  } catch (error: unknown) {
    const err = error as Error & { status?: number };
    console.error("[Auth Handler] Internal Exception:", err);
    return c.json({ 
      message: err.message || "Internal Server Error during Authentication", 
       
      stack: (c.env as any).ENVIRONMENT === "development" ? err.stack : undefined
    }, 500);
  }
});

export default authRouter;
