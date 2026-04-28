import { Hono } from "hono";
import { AppEnv, ensureAdmin, persistentRateLimitMiddleware } from "../../middleware";
import { Liveblocks } from "@liveblocks/node";

const liveblocksRouter = new Hono<AppEnv>();

// ── GET /api/liveblocks/auth — Mint Token ────────────────
liveblocksRouter.post("/auth", persistentRateLimitMiddleware(60, 60), ensureAdmin, async (c) => {
  const sessionUser = c.get("sessionUser");
  
  if (!sessionUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const liveblocks = new Liveblocks({
      secret: c.env.LIVEBLOCKS_SECRET_KEY,
    });

    const body = await c.req.json();
    const room = body.room;

    if (!room) {
      return c.json({ error: "Room ID is required" }, 400);
    }

    const session = liveblocks.prepareSession(sessionUser.id, {
      userInfo: {
        name: sessionUser.nickname || sessionUser.name || "Anonymous",
        avatar: sessionUser.image || "",
      }
    });

    // ensureAdmin already confirms they have Author or Admin privileges
    session.allow(room, session.FULL_ACCESS);

    const { body: lbBody, status } = await session.authorize();
    
    return new Response(lbBody, { 
      status, 
      headers: { 
        "Content-Type": "application/json" 
      } 
    });
  } catch (error: unknown) {
    console.error("[Liveblocks Auth] Error minting token:", error);
    const err = error as Error;
    return c.json({ error: "Failed to authenticate with Liveblocks", details: err.message }, 500);
  }
});

export default liveblocksRouter;
