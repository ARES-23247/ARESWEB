import { Hono } from "hono";
import { AppEnv, ensureAdmin, persistentRateLimitMiddleware } from "../../middleware";
import { Liveblocks } from "@liveblocks/node";
import { Kysely } from "kysely";
import { DB } from "../../../../shared/schemas/database";

import webhooksRouter from "./webhooks";

const liveblocksRouter = new Hono<AppEnv>();

liveblocksRouter.route("/webhooks", webhooksRouter);

// ── GET /api/liveblocks/history/:roomId — Fetch version snapshots ──
liveblocksRouter.get("/history/:roomId", ensureAdmin, async (c) => {
  const roomId = c.req.param("roomId");
  if (!roomId) {
    return c.json({ error: "Room ID is required" }, 400);
  }

  try {
    const db = c.get("db") as Kysely<DB>;
    const history = await db.selectFrom("document_history")
      .selectAll()
      .where("room_id", "=", roomId)
      .orderBy("created_at", "desc")
      .execute();

    return c.json({ history });
  } catch (error: unknown) {
    console.error("[Liveblocks History] Error fetching history:", error);
    const err = error as Error;
    return c.json({ error: "Failed to fetch document history", details: err.message }, 500);
  }
});

// ── GET /api/liveblocks/contributors/:roomId — Fetch document contributors ──
liveblocksRouter.get("/contributors/:roomId", async (c) => {
  const roomId = c.req.param("roomId");
  if (!roomId) {
    return c.json({ error: "Room ID is required" }, 400);
  }

  try {
    const db = c.get("db") as Kysely<DB>;
    
    // YPP Protection: Only select contributors who are NOT coaches or mentors
    const contributors = await db.selectFrom("document_contributors")
      .innerJoin("user", "user.id", "document_contributors.user_id")
      .select([
        "document_contributors.id",
        "document_contributors.room_id",
        "document_contributors.user_id",
        "document_contributors.user_name",
        "document_contributors.user_avatar",
        "document_contributors.last_contributed_at"
      ])
      .where("document_contributors.room_id", "=", roomId)
      .where("user.role", "not in", ["coach", "mentor"])
      .orderBy("document_contributors.last_contributed_at", "desc")
      .execute();

    return c.json({ contributors });
  } catch (error: unknown) {
    console.error("[Liveblocks Contributors] Error fetching contributors:", error);
    const err = error as Error;
    return c.json({ error: "Failed to fetch document contributors", details: err.message }, 500);
  }
});

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
