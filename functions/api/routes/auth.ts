import { Hono } from "hono";
import { AppEnv, getSessionUser  } from "./_shared";
import { getAuth } from "../../utils/auth";

const authRouter = new Hono<AppEnv>();

// ── GET /api/auth-check — verify session (UI gate only) ────────────────
authRouter.get("/auth-check", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ authenticated: false }, 401);
  return c.json({ 
    authenticated: true, 
    user
  });
});

// ── Better Auth Routes ────────────────────────────────────────────────
authRouter.on(["POST", "GET"], "/*", async (c) => {
  console.log(`[Auth Handler] Request URL: ${c.req.url}`);
  try {
    const auth = getAuth(c.env.DB, c.env, c.req.url);
    const response = await auth.handler(c.req.raw);
    console.log(`[Auth Handler] Response Status: ${response.status}`);
    return response;
  } catch (error: unknown) {
    const err = error as Error & { status?: number };
    console.error("[Auth Handler] Internal Exception:", err);
    return c.json({ 
      message: err.message || "Internal Server Error during Authentication", 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stack: (c.env as any).ENVIRONMENT === "development" ? err.stack : undefined
    }, 500);
  }
});

export default authRouter;
